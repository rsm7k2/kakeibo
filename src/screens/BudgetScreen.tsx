import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { nowJstYearMonth } from '../utils/date'
import CalculatorInput from '../components/CalculatorInput'
import LoadingOverlay from '../components/LoadingOverlay'
import { useAppData } from '../contexts/AppDataContext'
import type { Budget, TransactionWithDetails } from '../types'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function yen(n: number): string {
  return Math.round(n).toLocaleString('ja-JP')
}

function lastDayOf(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

// 予算に対する実績の割合に応じたプログレスバーの色
function progressColor(actual: number, budget: number): string {
  if (budget <= 0) return 'bg-gray-300'
  const percent = (actual / budget) * 100
  if (percent >= 100) return 'bg-red-500'
  if (percent >= 80) return 'bg-orange-400'
  return 'bg-green-500'
}

// 編集対象(全体予算 or 特定カテゴリの予算)
interface EditTarget {
  categoryId: number | null // null = 範囲全体の予算
  label: string
  icon: string | null
}

export default function BudgetScreen() {
  const { categories, scopes, loadingMaster, transactionsVersion } = useAppData()

  const { year: initYear, month0: initMonth0 } = nowJstYearMonth()
  const [year, setYear] = useState(initYear)
  const [month0, setMonth0] = useState(initMonth0)

  const [scopeId, setScopeId] = useState<number | null>(null)

  const [budgets, setBudgets] = useState<Budget[]>([])
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 編集オーバーレイ(タップした予算行の金額をその場で設定する)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [editAmount, setEditAmount] = useState(0)
  const [saving, setSaving] = useState(false)

  const yearMonth = `${year}-${pad2(month0 + 1)}`

  // 範囲(scope)のデフォルト選択(共有データが届いた後、まだ何も選ばれていなければ先頭を選ぶ)
  useEffect(() => {
    if (scopes.length > 0 && scopeId === null) {
      setScopeId(scopes[0].id)
    }
  }, [scopes, scopeId])

  const loadBudgets = () => {
    if (scopeId === null) return
    setLoading(true)
    Promise.all([
      api.get<Budget[]>(`/budgets?year_month=${yearMonth}&scope_id=${scopeId}`).then(setBudgets),
      api
        .get<TransactionWithDetails[]>(
          `/transactions?start=${yearMonth}-01&end=${yearMonth}-${pad2(lastDayOf(year, month0))}`
        )
        .then(setTransactions)
    ]).finally(() => setLoading(false))
  }

  // 月・範囲が変わった時、または他画面で収支データが変更された時(transactionsVersion)に再取得する
  useEffect(() => {
    loadBudgets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonth, scopeId, transactionsVersion])

  const goToPrevMonth = () => {
    if (month0 === 0) {
      setYear((y) => y - 1)
      setMonth0(11)
    } else {
      setMonth0((m) => m - 1)
    }
  }

  const goToNextMonth = () => {
    if (month0 === 11) {
      setYear((y) => y + 1)
      setMonth0(0)
    } else {
      setMonth0((m) => m + 1)
    }
  }

  const expenseCategories = categories.filter((c) => c.type === 'expense')
  const expenseTransactions = transactions.filter((t) => t.type === 'expense')

  const overallBudget = budgets.find((b) => b.category_id === null)?.amount ?? 0
  const overallActual = expenseTransactions.reduce((sum, t) => sum + t.amount, 0)

  const budgetFor = (categoryId: number) =>
    budgets.find((b) => b.category_id === categoryId)?.amount ?? 0
  const actualFor = (categoryId: number) =>
    expenseTransactions
      .filter((t) => t.category_id === categoryId)
      .reduce((sum, t) => sum + t.amount, 0)

  const openEditor = (target: EditTarget, currentAmount: number) => {
    setEditTarget(target)
    setEditAmount(currentAmount)
  }

  const closeEditor = () => {
    setEditTarget(null)
    setEditAmount(0)
  }

  const handleSaveBudget = async () => {
    if (!editTarget || scopeId === null) return
    setSaving(true)
    setError(null)
    try {
      await api.put('/budgets', {
        year_month: yearMonth,
        scope_id: scopeId,
        category_id: editTarget.categoryId,
        amount: editAmount
      })
      loadBudgets()
      closeEditor()
    } catch {
      setError('予算の保存に失敗しました。通信環境を確認して再度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  if (loadingMaster) {
    return <LoadingOverlay text="読み込み中" />
  }

  return (
    <div className="p-4 pb-24">
      <h1 className="text-lg font-bold mb-3">予算</h1>

      {/* 月切替 */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={goToPrevMonth} className="px-3 py-1 text-gray-500">
          ＜
        </button>
        <h2 className="text-base font-bold">
          {year}年{month0 + 1}月
        </h2>
        <button onClick={goToNextMonth} className="px-3 py-1 text-gray-500">
          ＞
        </button>
      </div>

      {/* 範囲切替タブ */}
      <div className="flex gap-2 mb-4">
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

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      {loading && <LoadingOverlay text="更新中" />}

      {/* 全体の予算 */}
      <button
        onClick={() => openEditor({ categoryId: null, label: '全体の予算', icon: null }, overallBudget)}
        className="w-full bg-white border rounded-2xl p-4 mb-4 text-left active:bg-gray-50"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-bold text-gray-700">全体の予算</span>
          <span className="text-gray-300 text-xs">＞</span>
        </div>
        <div className="flex items-end justify-between mb-2">
          <span className="text-xl font-bold">¥{yen(overallActual)}</span>
          <span className="text-xs text-gray-400">
            {overallBudget > 0 ? `/ ¥${yen(overallBudget)}` : '予算未設定'}
          </span>
        </div>
        {overallBudget > 0 && (
          <>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${progressColor(overallActual, overallBudget)}`}
                style={{ width: `${Math.min((overallActual / overallBudget) * 100, 100)}%` }}
              />
            </div>
            <div className="text-right text-xs mt-1">
              {overallActual > overallBudget ? (
                <span className="text-red-500 font-bold">
                  ¥{yen(overallActual - overallBudget)} 超過
                </span>
              ) : (
                <span className="text-gray-400">残り ¥{yen(overallBudget - overallActual)}</span>
              )}
            </div>
          </>
        )}
      </button>

      {/* カテゴリ別予算 */}
      <h2 className="text-sm font-bold text-gray-600 mb-2">カテゴリ別予算</h2>

      {expenseCategories.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">支出カテゴリがありません</p>
      )}

      <div className="bg-white border rounded-2xl divide-y overflow-hidden">
        {expenseCategories.map((c) => {
          const budget = budgetFor(c.id)
          const actual = actualFor(c.id)
          return (
            <button
              key={c.id}
              onClick={() => openEditor({ categoryId: c.id, label: c.name, icon: c.icon }, budget)}
              className="w-full p-3 text-left active:bg-gray-50"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-7 h-7 flex items-center justify-center rounded-full text-sm shrink-0"
                  style={{ backgroundColor: c.color }}
                >
                  {c.icon ?? '•'}
                </span>
                <span className="flex-1 text-sm font-bold truncate">{c.name}</span>
                <span
                  className={`text-sm font-bold shrink-0 ${
                    budget > 0 && actual > budget ? 'text-red-500' : ''
                  }`}
                >
                  ¥{yen(actual)}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  {budget > 0 ? `/ ¥${yen(budget)}` : '未設定'}
                </span>
                <span className="text-gray-300 text-xs shrink-0">＞</span>
              </div>
              {budget > 0 && (
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${progressColor(actual, budget)}`}
                    style={{ width: `${Math.min((actual / budget) * 100, 100)}%` }}
                  />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* 予算金額の編集オーバーレイ */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={closeEditor}>
          <div className="w-full bg-white rounded-t-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-sm flex items-center gap-1">
                {editTarget.icon && <span>{editTarget.icon}</span>}
                {editTarget.label}
              </h2>
              <button onClick={closeEditor} className="text-sm text-gray-400">
                閉じる
              </button>
            </div>
            <CalculatorInput
              initialValue={editAmount > 0 ? editAmount : undefined}
              onChange={setEditAmount}
            />
            <button
              onClick={handleSaveBudget}
              disabled={saving}
              className="w-full bg-green-600 text-white font-bold py-3 rounded-lg mt-3 disabled:opacity-50"
            >
              {saving ? '保存中...' : 'この金額で設定する'}
            </button>
          </div>
        </div>
      )}

      {saving && <LoadingOverlay text="保存中" />}
    </div>
  )
}
