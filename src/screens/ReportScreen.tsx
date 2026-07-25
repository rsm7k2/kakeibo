import { useEffect, useState } from 'react'
import { Pie, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { api } from '../api/client'
import { nowJstYearMonth } from '../utils/date'
import type { Scope, TransactionType, TransactionWithDetails } from '../types'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ChartDataLabels)

type PeriodType = 'month' | 'year'

interface CategoryEntry {
  id: number
  name: string
  color: string
  icon: string | null
  total: number
}

interface DrilldownTarget {
  id: number
  name: string
  color: string
  icon: string | null
}

interface MonthBucket {
  label: string
  total: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function yen(n: number): string {
  return Math.round(n).toLocaleString('ja-JP')
}

function lastDayOf(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

export default function ReportScreen() {
  const [periodType, setPeriodType] = useState<PeriodType>('month')

  const { year: initYear, month0: initMonth0 } = nowJstYearMonth()
  const [year, setYear] = useState(initYear)
  const [month0, setMonth0] = useState(initMonth0) // 0-indexed、月間モードでのみ使用

  const [scopeFilter, setScopeFilter] = useState<number | 'all'>('all')
  const [txType, setTxType] = useState<TransactionType>('expense')

  const [scopes, setScopes] = useState<Scope[]>([])
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([])
  const [loading, setLoading] = useState(false)

  // カテゴリドリルダウン(棒グラフ)表示用
  const [drilldown, setDrilldown] = useState<DrilldownTarget | null>(null)
  const [drilldownTx, setDrilldownTx] = useState<TransactionWithDetails[]>([])
  const [drilldownLoading, setDrilldownLoading] = useState(false)

  useEffect(() => {
    api.get<Scope[]>('/scopes').then(setScopes)
  }, [])

  // 期間(月間 or 年間)に応じた開始日・終了日を算出して取得
  useEffect(() => {
    let start: string
    let end: string
    if (periodType === 'month') {
      start = `${year}-${pad2(month0 + 1)}-01`
      end = `${year}-${pad2(month0 + 1)}-${pad2(lastDayOf(year, month0))}`
    } else {
      start = `${year}-01-01`
      end = `${year}-12-31`
    }
    setLoading(true)
    api
      .get<TransactionWithDetails[]>(`/transactions?start=${start}&end=${end}`)
      .then(setTransactions)
      .finally(() => setLoading(false))
    setDrilldown(null)
  }, [periodType, year, month0])

  const goToPrev = () => {
    if (periodType === 'month') {
      if (month0 === 0) {
        setYear((y) => y - 1)
        setMonth0(11)
      } else {
        setMonth0((m) => m - 1)
      }
    } else {
      setYear((y) => y - 1)
    }
  }

  const goToNext = () => {
    if (periodType === 'month') {
      if (month0 === 11) {
        setYear((y) => y + 1)
        setMonth0(0)
      } else {
        setMonth0((m) => m + 1)
      }
    } else {
      setYear((y) => y + 1)
    }
  }

  // 範囲フィルタを適用
  const scoped = transactions.filter((t) => scopeFilter === 'all' || t.scope_id === scopeFilter)

  const totalIncome = scoped.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = scoped.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // 円グラフ用: 選択中のtxType(支出 or 収入)でカテゴリ別に集計
  const targetTx = scoped.filter((t) => t.type === txType)
  const byCategory = new Map<number, CategoryEntry>()
  for (const t of targetTx) {
    const entry = byCategory.get(t.category_id) ?? {
      id: t.category_id,
      name: t.category_name,
      color: t.category_color,
      icon: t.category_icon,
      total: 0
    }
    entry.total += t.amount
    byCategory.set(t.category_id, entry)
  }
  const categoryBreakdown = Array.from(byCategory.values()).sort((a, b) => b.total - a.total)
  const targetTotal = categoryBreakdown.reduce((s, c) => s + c.total, 0)

  const chartData = {
    labels: categoryBreakdown.map((c) => c.name),
    datasets: [
      {
        data: categoryBreakdown.map((c) => c.total),
        backgroundColor: categoryBreakdown.map((c) => c.color),
        borderWidth: 1,
        borderColor: '#ffffff'
      }
    ]
  }

  // --- カテゴリクリック時のドリルダウン(月別棒グラフ)処理 ---

  const openDrilldown = async (c: CategoryEntry) => {
    setDrilldown({ id: c.id, name: c.name, color: c.color, icon: c.icon })
    if (periodType === 'year') {
      // 年間モードは、既に取得済みの年間データからそのまま集計できる(再取得不要)
      return
    }
    // 月間モードは、選択月を含む過去12ヶ月分のデータを別途取得する
    const totalMonthIndex = year * 12 + month0
    const startTotal = totalMonthIndex - 11
    const startYear = Math.floor(startTotal / 12)
    const startMonth0 = ((startTotal % 12) + 12) % 12
    const start = `${startYear}-${pad2(startMonth0 + 1)}-01`
    const end = `${year}-${pad2(month0 + 1)}-${pad2(lastDayOf(year, month0))}`

    setDrilldownLoading(true)
    try {
      const data = await api.get<TransactionWithDetails[]>(`/transactions?start=${start}&end=${end}`)
      setDrilldownTx(data)
    } finally {
      setDrilldownLoading(false)
    }
  }

  const closeDrilldown = () => {
    setDrilldown(null)
    setDrilldownTx([])
  }

  // ドリルダウン用の月別バケットを作成(月間モード: 過去12ヶ月 / 年間モード: 1〜12月)
  const monthBuckets: MonthBucket[] = (() => {
    if (!drilldown) return []

    const matches = (t: TransactionWithDetails) =>
      t.category_id === drilldown.id &&
      t.type === txType &&
      (scopeFilter === 'all' || t.scope_id === scopeFilter)

    if (periodType === 'year') {
      const buckets: MonthBucket[] = Array.from({ length: 12 }, (_, m) => ({
        label: `${m + 1}月`,
        total: 0
      }))
      for (const t of transactions.filter(matches)) {
        const m = Number(t.transaction_date.slice(5, 7)) - 1
        buckets[m].total += t.amount
      }
      return buckets
    }

    // 月間モード: 選択月を含む過去12ヶ月
    const totalMonthIndex = year * 12 + month0
    const startTotal = totalMonthIndex - 11
    const buckets: MonthBucket[] = Array.from({ length: 12 }, (_, i) => {
      const idx = startTotal + i
      const y = Math.floor(idx / 12)
      const m0 = ((idx % 12) + 12) % 12
      return { label: `${y}/${pad2(m0 + 1)}`, total: 0 }
    })
    for (const t of drilldownTx.filter(matches)) {
      const [ty, tm] = t.transaction_date.split('-').map(Number)
      const idx = ty * 12 + (tm - 1) - startTotal
      if (idx >= 0 && idx < 12) buckets[idx].total += t.amount
    }
    return buckets
  })()

  const drilldownTotal = monthBuckets.reduce((s, b) => s + b.total, 0)
  const drilldownAverage = monthBuckets.length > 0 ? drilldownTotal / monthBuckets.length : 0

  const barData = {
    labels: monthBuckets.map((b) => b.label),
    datasets: [
      {
        data: monthBuckets.map((b) => b.total),
        backgroundColor: drilldown?.color ?? '#888888'
      }
    ]
  }

  // --- ドリルダウン画面(棒グラフ) ---
  if (drilldown) {
    return (
      <div className="p-4 pb-24">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={closeDrilldown} className="text-gray-500 text-sm">
            ＜ 戻る
          </button>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <span
            className="w-8 h-8 flex items-center justify-center rounded-full text-lg"
            style={{ backgroundColor: drilldown.color }}
          >
            {drilldown.icon ?? '•'}
          </span>
          <h1 className="text-lg font-bold">
            {drilldown.name}の推移
            {periodType === 'month' ? '(過去12ヶ月)' : `(${year}年・月別)`}
          </h1>
        </div>

        {drilldownLoading && <p className="text-center text-gray-400 text-sm py-4">読み込み中...</p>}

        {!drilldownLoading && (
          <>
            {/* 合計額・平均額 */}
            <div className="flex justify-around text-sm my-4 border rounded-lg py-2">
              <div className="text-center">
                <div className="text-gray-400 text-xs">合計額</div>
                <div className="font-bold">¥{yen(drilldownTotal)}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 text-xs">月平均</div>
                <div className="font-bold">¥{yen(drilldownAverage)}</div>
              </div>
            </div>

            {/* 棒グラフ */}
            <div className="mb-4" style={{ height: 220 }}>
              <Bar
                data={barData}
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    datalabels: { display: false }
                  },
                  scales: {
                    y: { beginAtZero: true }
                  }
                }}
              />
            </div>

            {/* 月ごとの金額(数字リスト) */}
            <div className="bg-white border rounded-2xl divide-y overflow-hidden">
              {monthBuckets.map((b) => (
                <div key={b.label} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-gray-500">{b.label}</span>
                  <span className="font-bold">¥{yen(b.total)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // --- 通常のレポート画面(円グラフ+内訳リスト) ---
  return (
    <div className="p-4 pb-24">
      <h1 className="text-lg font-bold mb-3">レポート</h1>

      {/* 月間/年間 切替 */}
      <div className="flex rounded-lg overflow-hidden border mb-3">
        <button
          className={`flex-1 py-2 text-sm font-bold ${
            periodType === 'month' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500'
          }`}
          onClick={() => setPeriodType('month')}
        >
          月間
        </button>
        <button
          className={`flex-1 py-2 text-sm font-bold ${
            periodType === 'year' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500'
          }`}
          onClick={() => setPeriodType('year')}
        >
          年間
        </button>
      </div>

      {/* 期間移動 */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={goToPrev} className="px-3 py-1 text-gray-500">
          ＜
        </button>
        <h2 className="text-base font-bold">
          {periodType === 'month' ? `${year}年${month0 + 1}月` : `${year}年`}
        </h2>
        <button onClick={goToNext} className="px-3 py-1 text-gray-500">
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

      {/* サマリー(収入・支出・収支) */}
      <div className="flex justify-around text-sm mb-4 border rounded-lg py-2">
        <div className="text-center">
          <div className="text-gray-400 text-xs">収入</div>
          <div className="text-green-600 font-bold">¥{yen(totalIncome)}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-400 text-xs">支出</div>
          <div className="text-red-500 font-bold">¥{yen(totalExpense)}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-400 text-xs">収支</div>
          <div className="font-bold">¥{yen(totalIncome - totalExpense)}</div>
        </div>
      </div>

      {/* 支出/収入 切替(円グラフ対象) */}
      <div className="flex rounded-lg overflow-hidden border mb-3">
        <button
          className={`flex-1 py-2 text-sm font-bold ${
            txType === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-gray-500'
          }`}
          onClick={() => setTxType('expense')}
        >
          支出の内訳
        </button>
        <button
          className={`flex-1 py-2 text-sm font-bold ${
            txType === 'income' ? 'bg-green-500 text-white' : 'bg-white text-gray-500'
          }`}
          onClick={() => setTxType('income')}
        >
          収入の内訳
        </button>
      </div>

      {loading && <p className="text-center text-gray-400 text-sm mb-2">読み込み中...</p>}

      {!loading && categoryBreakdown.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-8">この条件のデータはありません</p>
      )}

      {!loading && categoryBreakdown.length > 0 && (
        <>
          {/* 円グラフ(内側にカテゴリ名を表示、10%未満は省略) */}
          <div className="max-w-[280px] mx-auto mb-4">
            <Pie
              data={chartData}
              options={{
                plugins: {
                  legend: { display: false },
                  datalabels: {
                    color: '#ffffff',
                    font: { size: 10, weight: 'bold' },
                    formatter: (value: number, context: { dataIndex: number }) => {
                      const percent = targetTotal > 0 ? (value / targetTotal) * 100 : 0
                      if (percent < 10) return ''
                      return categoryBreakdown[context.dataIndex]?.name ?? ''
                    }
                  }
                }
              }}
            />
          </div>

          {/* 内訳リスト(行クリックで月別推移の棒グラフを表示) */}
          <div className="bg-white border rounded-2xl divide-y overflow-hidden">
            {categoryBreakdown.map((c) => {
              const percent = targetTotal > 0 ? (c.total / targetTotal) * 100 : 0
              return (
                <button
                  key={c.id}
                  onClick={() => openDrilldown(c)}
                  className="w-full flex items-center gap-2 p-3 text-left active:bg-gray-50"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-lg shrink-0">{c.icon ?? '•'}</span>
                  <span className="flex-1 text-sm font-bold truncate">{c.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{percent.toFixed(1)}%</span>
                  <span className="text-sm font-bold shrink-0">¥{yen(c.total)}</span>
                  <span className="text-gray-300 text-xs shrink-0">＞</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
