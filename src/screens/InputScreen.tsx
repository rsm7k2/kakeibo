import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Category, PaymentMethod, Scope, TransactionType } from '../types'

function today(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export default function InputScreen() {
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [scopeId, setScopeId] = useState<number | null>(null)
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null)
  const [memo, setMemo] = useState('')

  const [categories, setCategories] = useState<Category[]>([])
  const [scopes, setScopes] = useState<Scope[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState(false)

  // 範囲・支払い方法は type に依存しないため初回のみ取得
  useEffect(() => {
    api.get<Scope[]>('/scopes').then((data) => {
      setScopes(data)
      if (data.length > 0) setScopeId(data[0].id)
    })
    api.get<PaymentMethod[]>('/payment_methods').then(setPaymentMethods)
  }, [])

  // カテゴリは収入/支出の切り替えに応じて再取得し、選択状態をリセットする
  useEffect(() => {
    api.get<Category[]>(`/categories?type=${type}`).then((data) => {
      setCategories(data)
      setCategoryId(data.length > 0 ? data[0].id : null)
    })
  }, [type])

  const resetForm = () => {
    setAmount('')
    setDate(today())
    setMemo('')
    setPaymentMethodId(null)
    // カテゴリ・範囲・種別は連続入力しやすいよう保持する
  }

  const handleSave = async () => {
    setError(null)

    const amountNum = Number(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setError('金額は0より大きい数値を入力してください')
      return
    }
    if (!categoryId) {
      setError('カテゴリを選択してください')
      return
    }
    if (!scopeId) {
      setError('範囲(個人/世帯)を選択してください')
      return
    }

    setSaving(true)
    try {
      await api.post('/transactions', {
        type,
        amount: amountNum,
        category_id: categoryId,
        scope_id: scopeId,
        payment_method_id: paymentMethodId,
        transaction_date: date,
        memo: memo || null
      })
      setSavedMessage(true)
      resetForm()
      setTimeout(() => setSavedMessage(false), 2000)
    } catch (e) {
      setError('保存に失敗しました。通信環境を確認して再度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 space-y-5">
      <h1 className="text-lg font-bold">収支の入力</h1>

      {/* 収入/支出 切替 */}
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

      {/* 金額 */}
      <div>
        <label className="text-xs text-gray-500">金額</label>
        <div className="flex items-center border rounded-lg px-3 py-2">
          <span className="text-gray-400 mr-1">¥</span>
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full text-2xl outline-none"
          />
        </div>
      </div>

      {/* 日付 */}
      <div>
        <label className="text-xs text-gray-500">日付</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      {/* カテゴリ(アイコン+色付きグリッド選択) */}
      <div>
        <label className="text-xs text-gray-500">カテゴリ</label>
        <div className="grid grid-cols-4 gap-2 mt-1">
          {categories.map((c) => (
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

      {/* 範囲(個人/世帯) */}
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

      {/* 支払い方法(任意) */}
      <div>
        <label className="text-xs text-gray-500">支払い方法(任意)</label>
        <select
          value={paymentMethodId ?? ''}
          onChange={(e) => setPaymentMethodId(e.target.value ? Number(e.target.value) : null)}
          className="w-full border rounded-lg px-3 py-2"
        >
          <option value="">選択なし</option>
          {paymentMethods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* メモ(任意) */}
      <div>
        <label className="text-xs text-gray-500">メモ(任意)</label>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {savedMessage && <p className="text-green-600 text-sm">保存しました</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-green-600 text-white font-bold py-3 rounded-lg disabled:opacity-50"
      >
        {saving ? '保存中...' : '保存する'}
      </button>
    </div>
  )
}
