import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { nowJstYearMonth, todayJst } from '../utils/date'
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

interface Props {
  onEditTransaction: (t: TransactionWithDetails) => void
}

export default function CalendarScreen({ onEditTransaction }: Props) {
  // 表示中の月(その月の1日を保持)。初期値は日本時間(JST)基準の「今月」。
  const [currentMonth, setCurrentMonth] = useState(() => {
    const { year, month0 } = nowJstYearMonth()
    return new Date(year, month0, 1)
  })
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([])
  const [loading, setLoading] = useState(false)
  // 初期選択日は日本時間(JST)基準の「今日」
  const [selectedDate, setSelectedDate] = useState<string | null>(() => todayJst())

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

  // 月が変わったらデータを再取得する(選択日のリセットは月切替ボタン側で行う)
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month0])

  const goToPrevMonth = () => {
    setCurrentMonth(new Date(year, month0 - 1, 1))
    setSelectedDate(null)
  }

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month0 + 1, 1))
    setSelectedDate(null)
  }

  // 日付ごとに集計・グルーピング
  const byDate = new Map<string, { income: number; expense: number; items: TransactionWithDetails[] }>()
  for (const t of transactions) {
    const entry = byDate.get(t.transaction_date) ?? { income: 0, expense: 0, items: [] }
    if (t.type === 'income') entry.income += t.amount
    else entry.expense += t.amount
    entry.items.push(t)
    byDate.set(t.transaction_date, entry)
  }

  // カレンダーグリッド用のセル配列(月初の曜日ぶん空白パディング)
  const firstWeekday = new Date(year, month0, 1).getDay()
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ]

  const monthIncomeTotal = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
  const monthExpenseTotal = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const selectedEntry = selectedDate ? byDate.get(selectedDate) : null

  return (
    <div className="p-4 pb-24">
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

      {/* 月間サマリー */}
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

      {loading && <p className="text-center text-gray-400 text-sm">読み込み中...</p>}

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-1">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />
          const ymd = formatYmd(year, month0, day)
          const entry = byDate.get(ymd)
          return (
            <button
              key={ymd}
              onClick={() => setSelectedDate(ymd)}
              className={`aspect-square border rounded-lg p-1 text-left ${
                selectedDate === ymd ? 'border-gray-800' : 'border-gray-200'
              }`}
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

      {/* 選択した日の内訳(カレンダー直下に表示) */}
      {selectedDate && (
        <div className="mt-4 bg-white border rounded-2xl shadow-sm">
          <div className="flex items-center justify-between p-3 border-b">
            <h2 className="font-bold text-sm">{selectedDate} の内訳</h2>
            <button onClick={() => setSelectedDate(null)} className="text-gray-400 text-sm">
              閉じる
            </button>
          </div>
          {(!selectedEntry || selectedEntry.items.length === 0) && (
            <p className="p-4 text-sm text-gray-400">この日の記録はありません</p>
          )}
          <div className="divide-y">
            {selectedEntry?.items.map((t) => (
              <button
                key={t.id}
                onClick={() => onEditTransaction(t)}
                className="w-full flex items-center gap-2 p-3 text-left active:bg-gray-50"
              >
                <span
                  className="w-8 h-8 flex items-center justify-center rounded-full text-base shrink-0"
                  style={{ backgroundColor: t.category_color }}
                >
                  {t.category_icon ?? '•'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{t.category_name}</div>
                  <div className="text-[10px] text-gray-400 truncate">
                    {t.scope_name}
                    {t.payment_method_name ? ` ・ ${t.payment_method_name}` : ''}
                    {t.memo ? ` ・ ${t.memo}` : ''}
                  </div>
                </div>
                <div
                  className={`text-sm font-bold shrink-0 ${
                    t.type === 'income' ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {t.type === 'income' ? '+' : '-'}¥{yen(t.amount)}
                </div>
                <span className="text-gray-300 text-xs shrink-0">＞</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
