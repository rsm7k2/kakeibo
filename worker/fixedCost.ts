import holidayJp from '@holiday-jp/holiday_jp'
import { todayJst } from '../src/utils/date'
import type { Env } from './index'

export interface FixedCostRuleRow {
  id: number
  title: string
  type: string
  amount: number
  category_id: number
  scope_id: number
  recurrence_unit: string
  recurrence_interval: number
  start_date: string
  end_date: string | null
  holiday_adjustment: string
  occurrence_count: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function parseYmd(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

function toYmd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

// 'YYYY-MM-DD' の暦日に days 日を加算する(タイムゾーンに依存しないよう年月日で直接計算)
function addDaysYmd(dateStr: string, days: number): string {
  const { y, m, d } = parseYmd(dateStr)
  const date = new Date(y, m - 1, d + days)
  return toYmd(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

// 月を加算し、対象月に存在しない日付(31日等)はその月の最終日に丸める
function addMonthsClamped(dateStr: string, months: number): string {
  const { y, m, d } = parseYmd(dateStr)
  const totalMonthIndex = y * 12 + (m - 1) + months
  const targetYear = Math.floor(totalMonthIndex / 12)
  const targetMonth0 = ((totalMonthIndex % 12) + 12) % 12
  const clampedDay = Math.min(d, lastDayOfMonth(targetYear, targetMonth0 + 1))
  return toYmd(targetYear, targetMonth0 + 1, clampedDay)
}

// 年を加算し、2/29開始で対象年がうるう年でない場合は2/28に丸める
function addYearsClamped(dateStr: string, years: number): string {
  return addMonthsClamped(dateStr, years * 12)
}

function dayOfWeek(dateStr: string): number {
  const { y, m, d } = parseYmd(dateStr)
  return new Date(y, m - 1, d).getDay() // 0=日, 6=土
}

function isWeekend(dateStr: string): boolean {
  const w = dayOfWeek(dateStr)
  return w === 0 || w === 6
}

function isHoliday(dateStr: string): boolean {
  return holidayJp.isHoliday(dateStr)
}

// 「平日」繰り返し: occurrenceIndex=0 は開始日(土日ならその直後の平日)、以降1件ずつ平日を進める
function addWeekdaysFrom(startDateStr: string, occurrenceIndex: number): string {
  let current = startDateStr
  while (isWeekend(current)) {
    current = addDaysYmd(current, 1)
  }
  let count = 0
  while (count < occurrenceIndex) {
    current = addDaysYmd(current, 1)
    if (!isWeekend(current)) count++
  }
  return current
}

/**
 * ルールの occurrenceIndex(0始まり)回目の「調整前(生の)」発生日を計算する。
 * 月末クランプのドリフトを防ぐため、常に start_date からの計算し直しとする。
 * これ以上発生しない場合(繰り返しなしの2回目以降)は null を返す。
 */
export function computeRawOccurrenceDate(
  rule: Pick<FixedCostRuleRow, 'recurrence_unit' | 'recurrence_interval' | 'start_date'>,
  occurrenceIndex: number
): string | null {
  switch (rule.recurrence_unit) {
    case 'none':
      return occurrenceIndex === 0 ? rule.start_date : null
    case 'day':
      return addDaysYmd(rule.start_date, occurrenceIndex * rule.recurrence_interval)
    case 'weekday':
      return addWeekdaysFrom(rule.start_date, occurrenceIndex)
    case 'week':
      return addDaysYmd(rule.start_date, occurrenceIndex * rule.recurrence_interval * 7)
    case 'month':
      return addMonthsClamped(rule.start_date, occurrenceIndex * rule.recurrence_interval)
    case 'year':
      return addYearsClamped(rule.start_date, occurrenceIndex * rule.recurrence_interval)
    default:
      return null
  }
}

// 土日祝であれば直前/直後の平日にずらす('none'なら調整しない)
export function applyHolidayAdjustment(dateStr: string, adjustment: string): string {
  if (adjustment === 'none') return dateStr
  const step = adjustment === 'before' ? -1 : 1
  let current = dateStr
  while (isWeekend(current) || isHoliday(current)) {
    current = addDaysYmd(current, step)
  }
  return current
}

const MAX_ITERATIONS_PER_RULE = 500

/**
 * 期限が来ている(発生日 <= 今日)固定費ルールの発生分をtransactionsへ生成する。
 * ruleId を指定すればそのルールのみ、省略時は全ルールを対象にする(日次バッチ用)。
 * 過去分は変更せず、occurrence_count 以降の未生成分だけを進める。
 */
export async function generateDueOccurrences(env: Env, ruleId?: number): Promise<void> {
  const today = todayJst()

  const { results: rules } = await (ruleId
    ? env.DB.prepare('SELECT * FROM fixed_cost_rules WHERE id = ?').bind(ruleId)
    : env.DB.prepare('SELECT * FROM fixed_cost_rules')
  ).all<FixedCostRuleRow>()

  for (const rule of rules) {
    let occurrenceCount = rule.occurrence_count
    const statements = []
    let iterations = 0

    while (iterations < MAX_ITERATIONS_PER_RULE) {
      const rawDate = computeRawOccurrenceDate(rule, occurrenceCount)
      if (rawDate === null) break
      if (rawDate > today) break
      if (rule.end_date && rawDate > rule.end_date) break

      const actualDate = applyHolidayAdjustment(rawDate, rule.holiday_adjustment)
      statements.push(
        env.DB.prepare(
          `INSERT INTO transactions
            (type, amount, category_id, scope_id, payment_method_id, transaction_date, memo, is_fixed_cost, fixed_cost_rule_id)
           VALUES (?, ?, ?, ?, NULL, ?, ?, 1, ?)`
        ).bind(rule.type, rule.amount, rule.category_id, rule.scope_id, actualDate, rule.title, rule.id)
      )

      occurrenceCount++
      iterations++
      if (rule.recurrence_unit === 'none') break
    }

    if (occurrenceCount !== rule.occurrence_count) {
      statements.push(
        env.DB.prepare(
          `UPDATE fixed_cost_rules SET occurrence_count = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(occurrenceCount, rule.id)
      )
      await env.DB.batch(statements)
    }
  }
}

/**
 * ルール保存前の次回発生日プレビュー用。今日でのカットオフはせず、
 * occurrence_count(既存ルールなら現在値、新規なら0)から先の発生日を count 件分計算する。
 */
export function previewUpcomingDates(
  rule: Pick<
    FixedCostRuleRow,
    'recurrence_unit' | 'recurrence_interval' | 'start_date' | 'end_date' | 'holiday_adjustment'
  >,
  fromOccurrenceIndex: number,
  count: number
): string[] {
  const dates: string[] = []
  let index = fromOccurrenceIndex
  while (dates.length < count) {
    const rawDate = computeRawOccurrenceDate(rule, index)
    if (rawDate === null) break
    if (rule.end_date && rawDate > rule.end_date) break
    dates.push(applyHolidayAdjustment(rawDate, rule.holiday_adjustment))
    index++
  }
  return dates
}
