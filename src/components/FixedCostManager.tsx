import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { todayJst } from '../utils/date'
import { useAppData } from '../contexts/AppDataContext'
import CalculatorInput from './CalculatorInput'
import LoadingOverlay from './LoadingOverlay'
import type {
  FixedCostRuleWithDetails,
  HolidayAdjustment,
  RecurrenceUnit,
  TransactionType
} from '../types'

// 13択のフラットな繰り返しパターン(unit + interval の組み合わせ)
const RECURRENCE_OPTIONS: { label: string; unit: RecurrenceUnit; interval: number }[] = [
  { label: '繰り返しない', unit: 'none', interval: 1 },
  { label: '毎日', unit: 'day', interval: 1 },
  { label: '平日', unit: 'weekday', interval: 1 },
  { label: '毎週', unit: 'week', interval: 1 },
  { label: '2週間ごと', unit: 'week', interval: 2 },
  { label: '3週間ごと', unit: 'week', interval: 3 },
  { label: '毎月', unit: 'month', interval: 1 },
  { label: '2ヶ月ごと', unit: 'month', interval: 2 },
  { label: '3ヶ月ごと', unit: 'month', interval: 3 },
  { label: '4ヶ月ごと', unit: 'month', interval: 4 },
  { label: '5ヶ月ごと', unit: 'month', interval: 5 },
  { label: '半年ごと', unit: 'month', interval: 6 },
  { label: '毎年', unit: 'year', interval: 1 }
]

const HOLIDAY_ADJUSTMENT_OPTIONS: { value: HolidayAdjustment; label: string }[] = [
  { value: 'none', label: '何もしない' },
  { value: 'before', label: '発生日を直前の平日にする' },
  { value: 'after', label: '発生日を直後の平日にする' }
]

function findRecurrenceIndex(unit: RecurrenceUnit, interval: number): number {
  const index = RECURRENCE_OPTIONS.findIndex((o) => o.unit === unit && o.interval === interval)
  return index >= 0 ? index : 0
}

function recurrenceLabel(unit: RecurrenceUnit, interval: number): string {
  return RECURRENCE_OPTIONS[findRecurrenceIndex(unit, interval)].label
}

function yen(n: number): string {
  return n.toLocaleString('ja-JP')
}

function formatMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

export default function FixedCostManager() {
  const { categories, scopes } = useAppData()

  const [rules, setRules] = useState<FixedCostRuleWithDetails[]>([])
  const [loading, setLoading] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<FixedCostRuleWithDetails | null>(null)

  const load = () => {
    setLoading(true)
    api
      .get<FixedCostRuleWithDetails[]>('/fixed_cost_rules')
      .then(setRules)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openAddForm = () => {
    setEditingRule(null)
    setFormOpen(true)
  }

  const openEditForm = (rule: FixedCostRuleWithDetails) => {
    setEditingRule(rule)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingRule(null)
  }

  const handleSaved = () => {
    closeForm()
    load()
  }

  return (
    <div>
      {loading && <LoadingOverlay text="読み込み中" />}

      {rules.length === 0 && !loading && (
        <p className="text-sm text-gray-400 py-4 text-center">固定費が登録されていません</p>
      )}

      <div className="bg-white border rounded-2xl divide-y overflow-hidden">
        {rules.map((rule) => (
          <button
            key={rule.id}
            onClick={() => openEditForm(rule)}
            className="w-full flex items-center gap-2 p-3 text-left active:bg-gray-50"
          >
            <span
              className="w-8 h-8 flex items-center justify-center rounded-full text-base shrink-0"
              style={{ backgroundColor: rule.category_color }}
            >
              {rule.category_icon ?? '•'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{rule.title}</div>
              <div className="text-[10px] text-gray-400">
                {rule.scope_name} ・ {recurrenceLabel(rule.recurrence_unit, rule.recurrence_interval)} ・
                開始{formatMonthDay(rule.start_date)}
              </div>
            </div>
            <div
              className={`text-sm font-bold shrink-0 ${
                rule.type === 'expense' ? 'text-red-500' : 'text-green-600'
              }`}
            >
              {rule.type === 'expense' ? '-' : '+'}¥{yen(rule.amount)}
            </div>
            <span className="text-gray-300 text-xs shrink-0">＞</span>
          </button>
        ))}
      </div>

      <button
        onClick={openAddForm}
        className="w-full mt-3 py-2.5 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500"
      >
        ＋ 固定費を追加
      </button>

      {formOpen && (
        <FixedCostRuleForm
          rule={editingRule}
          categories={categories}
          scopes={scopes}
          onSaved={handleSaved}
          onClose={closeForm}
        />
      )}
    </div>
  )
}

interface FormProps {
  rule: FixedCostRuleWithDetails | null
  categories: ReturnType<typeof useAppData>['categories']
  scopes: ReturnType<typeof useAppData>['scopes']
  onSaved: () => void
  onClose: () => void
}

function FixedCostRuleForm({ rule, categories, scopes, onSaved, onClose }: FormProps) {
  const { bumpTransactionsVersion } = useAppData()
  const [title, setTitle] = useState(rule?.title ?? '')
  const [type, setType] = useState<TransactionType>(rule?.type ?? 'expense')
  const [amount, setAmount] = useState(rule?.amount ?? 0)
  const [categoryId, setCategoryId] = useState<number | null>(rule?.category_id ?? null)
  const [scopeId, setScopeId] = useState<number | null>(rule?.scope_id ?? scopes[0]?.id ?? null)
  const [recurrenceIndex, setRecurrenceIndex] = useState(
    rule ? findRecurrenceIndex(rule.recurrence_unit, rule.recurrence_interval) : 6 // デフォルト「毎月」
  )
  const [startDate, setStartDate] = useState(rule?.start_date ?? todayJst())
  const [hasEndDate, setHasEndDate] = useState(!!rule?.end_date)
  const [endDate, setEndDate] = useState(rule?.end_date ?? todayJst())
  const [holidayAdjustment, setHolidayAdjustment] = useState<HolidayAdjustment>(
    rule?.holiday_adjustment ?? 'none'
  )

  const [previewDates, setPreviewDates] = useState<string[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredCategories = categories.filter((c) => c.type === type)

  useEffect(() => {
    if (filteredCategories.length === 0) {
      setCategoryId(null)
      return
    }
    if (!filteredCategories.some((c) => c.id === categoryId)) {
      setCategoryId(filteredCategories[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, categories])

  const buildPayload = () => {
    const option = RECURRENCE_OPTIONS[recurrenceIndex]
    return {
      title: title.trim(),
      type,
      amount,
      category_id: categoryId,
      scope_id: scopeId,
      recurrence_unit: option.unit,
      recurrence_interval: option.interval,
      start_date: startDate,
      end_date: hasEndDate ? endDate : null,
      holiday_adjustment: holidayAdjustment
    }
  }

  const handlePreview = async () => {
    if (!title.trim() || !categoryId || !scopeId || !(amount > 0)) {
      setError('タイトル・金額・カテゴリ・範囲を入力してから次回発生日を確認できます')
      return
    }
    setError(null)
    setPreviewLoading(true)
    try {
      const res = await api.post<{ dates: string[] }>('/fixed_cost_rules/preview', {
        ...buildPayload(),
        occurrence_count: rule?.occurrence_count ?? 0
      })
      setPreviewDates(res.dates)
    } catch {
      setError('プレビューの取得に失敗しました')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setError('タイトルを入力してください')
      return
    }
    if (!(amount > 0)) {
      setError('金額は0より大きい数値を入力してください')
      return
    }
    if (!categoryId) {
      setError('カテゴリを選択してください')
      return
    }
    if (!scopeId) {
      setError('範囲を選択してください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = buildPayload()
      if (rule) {
        await api.put(`/fixed_cost_rules/${rule.id}`, payload)
      } else {
        await api.post('/fixed_cost_rules', payload)
      }
      // ルールの保存(作成・編集)は即時に該当分のtransactionsを生成するため、
      // カレンダー・レポート・予算画面が再取得するよう通知する
      bumpTransactionsVersion()
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました。通信環境を確認して再度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!rule) return
    if (!confirm('この固定費を削除しますか?過去に生成済みの収支データは残ります。')) return
    setDeleting(true)
    setError(null)
    try {
      await api.delete(`/fixed_cost_rules/${rule.id}`)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました。通信環境を確認して再度お試しください。')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-2xl p-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm">{rule ? '固定費の編集' : '固定費の追加'}</h2>
          <button onClick={onClose} className="text-sm text-gray-400">
            閉じる
          </button>
        </div>

        <div className="space-y-4">
          {/* 収入/支出 */}
          <div className="flex rounded-lg overflow-hidden border">
            <button
              className={`flex-1 py-2 text-sm font-bold ${
                type === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-gray-500'
              }`}
              onClick={() => setType('expense')}
            >
              支出
            </button>
            <button
              className={`flex-1 py-2 text-sm font-bold ${
                type === 'income' ? 'bg-green-500 text-white' : 'bg-white text-gray-500'
              }`}
              onClick={() => setType('income')}
            >
              収入
            </button>
          </div>

          {/* タイトル */}
          <div>
            <label className="text-xs text-gray-500">タイトル</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 家賃"
              className="w-full border rounded-lg px-3 py-2 mt-1"
            />
          </div>

          {/* 金額 */}
          <div>
            <label className="text-xs text-gray-500">金額</label>
            <div className="border rounded-lg p-2 mt-1">
              <CalculatorInput initialValue={amount > 0 ? amount : undefined} onChange={setAmount} />
            </div>
          </div>

          {/* カテゴリ */}
          <div>
            <label className="text-xs text-gray-500">カテゴリ</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {filteredCategories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  className={`flex flex-col items-center py-2 rounded-lg border-2 ${
                    categoryId === c.id ? 'border-gray-800' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.color + '22' }}
                >
                  <span
                    className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.icon ?? '•'}
                  </span>
                  <span className="text-[10px] mt-1 text-gray-700">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 範囲 */}
          <div>
            <label className="text-xs text-gray-500">範囲</label>
            <div className="flex gap-2 mt-1">
              {scopes.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setScopeId(s.id)}
                  className={`flex-1 py-2 rounded-lg text-sm border ${
                    scopeId === s.id ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* 繰り返し */}
          <div>
            <label className="text-xs text-gray-500">繰り返し</label>
            <select
              value={recurrenceIndex}
              onChange={(e) => setRecurrenceIndex(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 mt-1"
            >
              {RECURRENCE_OPTIONS.map((o, i) => (
                <option key={o.label} value={i}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* 開始日 */}
          <div>
            <label className="text-xs text-gray-500">開始日</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mt-1"
            />
          </div>

          {/* 終了日(任意) */}
          <div>
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={hasEndDate}
                onChange={(e) => setHasEndDate(e.target.checked)}
                className="w-4 h-4"
              />
              終了日を設定する
            </label>
            {hasEndDate && (
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 mt-1"
              />
            )}
          </div>

          {/* 土日祝の場合 */}
          <div>
            <label className="text-xs text-gray-500">発生日が土日祝の場合</label>
            <select
              value={holidayAdjustment}
              onChange={(e) => setHolidayAdjustment(e.target.value as HolidayAdjustment)}
              className="w-full border rounded-lg px-3 py-2 mt-1"
            >
              {HOLIDAY_ADJUSTMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* 次回発生日プレビュー */}
          <div>
            <button
              onClick={handlePreview}
              disabled={previewLoading}
              className="text-sm text-gray-500 underline disabled:opacity-50"
            >
              {previewLoading ? '確認中...' : '次回以降の発生日を確認する'}
            </button>
            {previewDates && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {previewDates.length === 0 && (
                  <span className="text-xs text-gray-400">該当する発生日がありません</span>
                )}
                {previewDates.map((d) => (
                  <span key={d} className="text-xs bg-gray-100 rounded-full px-2 py-1">
                    {d}
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving || deleting}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-lg disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存する'}
          </button>

          {rule && (
            <button
              onClick={handleDelete}
              disabled={saving || deleting}
              className="w-full border border-red-400 text-red-500 font-bold py-3 rounded-lg disabled:opacity-50"
            >
              {deleting ? '削除中...' : 'この固定費を削除する'}
            </button>
          )}
        </div>
      </div>

      {(saving || deleting) && <LoadingOverlay text={saving ? '保存中' : '削除中'} />}
    </div>
  )
}
