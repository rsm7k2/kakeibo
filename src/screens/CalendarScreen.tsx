import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { nowJstYearMonth } from '../utils/date'
import { useAppData } from '../contexts/AppDataContext'
import SwipeableRow from '../components/SwipeableRow'
import LoadingOverlay from '../components/LoadingOverlay'
import type { TransactionWithDetails } from '../types'

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatYmd(year: number, month0: number, day: number): string {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`
}

function yen(n: number): string {
  return n.toLocaleString('ja-JP')
}

// 範囲(個人/世帯など)のバッジ配色。scope_id に応じて一覧から順番に割り当てる
const SCOPE_BADGE_CLASSES = [
  'bg-blue-50 text-blue-500',
  'bg-purple-50 text-purple-500',
  'bg-teal-50 text-teal-600',
  'bg-orange-50 text-orange-500',
  'bg-pink-50 text-pink-500'
]

function scopeBadgeClass(scopeId: number): string {
  return SCOPE_BADGE_CLASSES[(scopeId - 1 + SCOPE_BADGE_CLASSES.length) % SCOPE_BADGE_CLASSES.length]
}

interface Props {
  onEditTransaction: (t: TransactionWithDetails) => void
}

export default function CalendarScreen({ onEditTransaction }: Props) {
  const { scopes, transactionsVersion, bumpTransactionsVersion } = useAppData()

  // 表示中の月(その月の1日を保持)。初期値は日本時間(JST)基準の「今月」。
  const [currentMonth, setCurrentMonth] = useState(() => {
    const { year, month0 } = nowJstYearMonth()
    return new Date(year, month0, 1)
  })
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([])
  const [loading, setLoading] = useState(false)

  // 範囲での絞り込み。初期表示は「全て」
  const [scopeFilter, setScopeFilter] = useState<number | 'all'>('all')

  const year = currentMonth.getFullYear()
  const month0 = currentMonth.getMonth() // 0-indexed

  const load = () => {
    const start = formatYmd(year, month0, 1)
    const lastDay = new Date(year, month0 + 1, 0).getDate()
    const end = formatYmd(year, month0, lastDay)
    setLoading(true)
    api
      .get<TransactionWithDetails[]>(`/transactions?start=${start}&end=${end}`)
      .then(setTransactions)
      .finally(() => setLoading(false))
  }

  // 表示月が変わった時、または他画面で収支データが変更された時(transactionsVersion)に再取得する。
  // 画面はタブ切替で破棄されないため、transactionsVersionへの依存がないと
  // 他画面での保存・編集・削除がこの画面に反映されないままになる。
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month0, transactionsVersion])

  const goToPrevMonth = () => setCurrentMonth(new Date(year, month0 - 1, 1))
  const goToNextMonth = () => setCurrentMonth(new Date(year, month0 + 1, 1))

  // カレンダーの日付タップ時、下の支出一覧内の該当日付までスクロールする
  // (その日の支出まで手でスワイプ移動したのと同じ見た目にする)
  const scrollToDate = (ymd: string) => {
    document.getElementById(`expense-date-${ymd}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleDeleteTransaction = async (id: number) => {
    if (!confirm('この収支データを削除しますか?元に戻せません。')) return
    await api.delete(`/transactions/${id}`)
    bumpTransactionsVersion()
  }

  // 範囲フィルタを適用した取引一覧(カレンダーグリッド・サマリーで使用)
  const scopedTransactions = transactions.filter(
    (t) => scopeFilter === 'all' || t.scope_id === scopeFilter
  )

  // 日付ごとの収入/支出集計(カレンダーグリッド用)
  const byDate = new Map<string, { income: number; expense: number }>()
  for (const t of scopedTransactions) {
    const entry = byDate.get(t.transaction_date) ?? { income: 0, expense: 0 }
    if (t.type === 'income') entry.income += t.amount
    else entry.expense += t.amount
    byDate.set(t.transaction_date, entry)
  }

  // カレンダーグリッド用のセル配列(月初の曜日ぶん空白パディング)
  const firstWeekday = new Date(year, month0, 1).getDay()
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ]

  const monthIncomeTotal = scopedTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
  const monthExpenseTotal = scopedTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  // 当月の支出一覧(範囲フィルタ適用、日付降順)
  const expenseList = scopedTransactions
    .filter((t) => t.type === 'expense')
    .sort((a, b) => {
      if (a.transaction_date !== b.transaction_date) {
        return a.transaction_date < b.transaction_date ? 1 : -1
      }
      return b.id - a.id
    })

  // 日付ごとにグルーピングして見出しを付けて表示するための整形
  const groupedByDate: { date: string; items: TransactionWithDetails[] }[] = []
  for (const t of expenseList) {
    const last = groupedByDate[groupedByDate.length - 1]
    if (last && last.date === t.transaction_date) {
      last.items.push(t)
    } else {
      groupedByDate.push({ date: t.transaction_date, items: [t] })
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* 上部(月切替・範囲フィルタ・サマリー・カレンダー本体)は固定表示 */}
      <div className="p-4 pb-2 shrink-0">
        {/* 月切替 */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={goToPrevMonth} className="px-3 py-1 text-gray-500">
            ＜
          </button>
          <h1 className="text-lg font-bold">
            {year}年{month0 + 1}月
          </h1>
          <button onClick={goToNextMonth} className="px-3 py-1 text-gray-500">
            ＞
          </button>
        </div>

        {/* 範囲切替タブ */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setScopeFilter('all')}
            className={`flex-1 py-2 rounded-lg text-sm border ${
              scopeFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'
            }`}
          >
            全て
          </button>
          {scopes.map((s) => (
            <button
              key={s.id}
              onClick={() => setScopeFilter(s.id)}
              className={`flex-1 py-2 rounded-lg text-sm border ${
                scopeFilter === s.id ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* 月間サマリー(範囲フィルタ反映) */}
        <div className="flex justify-around text-sm mb-4 border rounded-lg py-2">
          <div className="text-center">
            <div className="text-gray-400 text-xs">収入</div>
            <div className="text-green-600 font-bold">¥{yen(monthIncomeTotal)}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-400 text-xs">支出</div>
            <div className="text-red-500 font-bold">¥{yen(monthExpenseTotal)}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-400 text-xs">収支</div>
            <div className="font-bold">¥{yen(monthIncomeTotal - monthExpenseTotal)}</div>
          </div>
        </div>

        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-1">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>

        {/* カレンダーグリッド(タップでその日の支出一覧までスクロール) */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`pad-${i}`} />
            const ymd = formatYmd(year, month0, day)
            const entry = byDate.get(ymd)
            return (
              <button
                key={ymd}
                type="button"
                onClick={() => scrollToDate(ymd)}
                className="aspect-square border border-gray-200 rounded-lg p-1 text-left active:bg-gray-100"
              >
                <div className="text-xs">{day}</div>
                {entry && entry.expense > 0 && (
                  <div className="text-[9px] text-red-500 leading-tight truncate">
                    -{yen(entry.expense)}
                  </div>
                )}
                {entry && entry.income > 0 && (
                  <div className="text-[9px] text-green-600 leading-tight truncate">
                    +{yen(entry.income)}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 当月の支出一覧(日付降順)。ここだけがスクロール対象 */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <h2 className="text-sm font-bold text-gray-600 mb-2">
          {month0 + 1}月の支出一覧
          {scopeFilter !== 'all' && (
            <span className="text-gray-400 font-normal">
              (
              {scopes.find((s) => s.id === scopeFilter)?.name}
              )
            </span>
          )}
        </h2>

        {groupedByDate.length === 0 && !loading && (
          <p className="text-sm text-gray-400 py-4 text-center">この条件の支出データはありません</p>
        )}

        <div className="bg-white border rounded-2xl divide-y overflow-hidden">
          {groupedByDate.map((group) => (
            <div key={group.date} id={`expense-date-${group.date}`} className="scroll-mt-4">
              <div className="bg-gray-50 px-3 py-1 text-xs text-gray-500 font-bold">
                {group.date}
              </div>
              <div className="divide-y">
                {group.items.map((t) => (
                  <SwipeableRow
                    key={t.id}
                    onClick={() => onEditTransaction(t)}
                    onDelete={() => handleDeleteTransaction(t.id)}
                    disabled={loading}
                  >
                    <div className="w-full flex items-center gap-2 p-3 text-left">
                      <span
                        className="w-8 h-8 flex items-center justify-center rounded-full text-base shrink-0"
                        style={{ backgroundColor: t.category_color }}
                      >
                        {t.category_icon ?? '•'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">
                          {t.category_name}
                          {t.memo && (
                            <span className="text-[10px] text-gray-400 font-normal">
                              (
                              {t.memo}
                              )
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${scopeBadgeClass(t.scope_id)}`}
                          >
                            {t.scope_name}
                          </span>
                          {t.payment_method_name && (
                            <span className="text-[10px] text-gray-400 truncate">
                              {t.payment_method_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-red-500 shrink-0">-¥{yen(t.amount)}</div>
                      <span className="text-gray-300 text-xs shrink-0">＞</span>
                    </div>
                  </SwipeableRow>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading && <LoadingOverlay text="更新中" />}
    </div>
  )
}
