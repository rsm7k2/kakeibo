import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { todayJst } from '../utils/date'
import CalculatorInput from '../components/CalculatorInput'
import { useAppData } from '../contexts/AppDataContext'
import type { TransactionType, TransactionWithDetails } from '../types'

interface Props {
  editTransaction?: TransactionWithDetails | null
  onEditDone?: () => void
}

export default function InputScreen({ editTransaction = null, onEditDone }: Props) {
  const { categories, scopes, paymentMethods, loadingMaster, reloadCategories, bumpTransactionsVersion } =
    useAppData()

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState(0)
  const [showCalculator, setShowCalculator] = useState(false)
  const [date, setDate] = useState(todayJst())
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [scopeId, setScopeId] = useState<number | null>(null)
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null)
  const [memo, setMemo] = useState('')

  // 編集対象のトランザクションID(nullなら新規登録モード)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState(false)

  // カテゴリのクイック追加用
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryIcon, setNewCategoryIcon] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#4CAF50')
  const [addingCategory, setAddingCategory] = useState(false)

  // 円グラフで隣り合っても区別しやすいよう、色相を分散させた18色のプリセット
  const COLOR_PRESETS = [
    '#4CAF50', '#FF7043', '#42A5F5', '#AB47BC',
    '#FFCA28', '#8D6E63', '#26A69A', '#EC407A',
    '#7E57C2', '#29B6F6', '#9CCC65', '#FFA726',
    '#5C6BC0', '#EF5350', '#26C6DA', '#D4E157',
    '#8E24AA', '#78909C'
  ]

  // 家計簿カテゴリでよく使う絵文字の候補(タップで選択)
  const ICON_PRESETS = [
    '🍚', '☕', '🍺', '🚃', '🚗', '✈️', '🏠', '💡',
    '🧻', '👕', '💊', '🏥', '📚', '🎮', '🎁', '🐶',
    '📱', '💰', '💳', '🛒', '💇', '⚽', '🎵', '🔧'
  ]

  // 選択中の収入/支出に対応するカテゴリだけを、共有データから絞り込む
  const filteredCategories = categories.filter((c) => c.type === type)

  // 範囲(scope)のデフォルト選択(共有データが届いた後、まだ何も選ばれていなければ先頭を選ぶ)
  useEffect(() => {
    if (scopes.length > 0 && scopeId === null) {
      setScopeId(scopes[0].id)
    }
  }, [scopes, scopeId])

  // 収入/支出の切り替え、または編集対象の変化に応じてカテゴリの選択状態を調整する
  useEffect(() => {
    if (filteredCategories.length === 0) {
      setCategoryId(null)
      return
    }
    const editMatch =
      editTransaction && editTransaction.type === type
        ? filteredCategories.find((c) => c.id === editTransaction.category_id)
        : undefined
    setCategoryId(editMatch ? editMatch.id : filteredCategories[0].id)
    setShowAddCategory(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, editTransaction, categories])

  // カレンダー画面から編集対象が渡された場合、フォームに反映する
  useEffect(() => {
    if (editTransaction) {
      setType(editTransaction.type)
      setAmount(editTransaction.amount)
      setDate(editTransaction.transaction_date)
      setScopeId(editTransaction.scope_id)
      setPaymentMethodId(editTransaction.payment_method_id)
      setMemo(editTransaction.memo ?? '')
      setEditingId(editTransaction.id)
    }
  }, [editTransaction])

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setError('カテゴリ名を入力してください')
      return
    }
    setAddingCategory(true)
    setError(null)
    try {
      const res = await api.post<{ id: number }>('/categories', {
        name: newCategoryName.trim(),
        type,
        icon: newCategoryIcon || null,
        color: newCategoryColor
      })
      await reloadCategories()
      setCategoryId(res.id)
      setNewCategoryName('')
      setNewCategoryIcon('')
      setNewCategoryColor('#4CAF50')
      setShowAddCategory(false)
    } catch {
      setError('カテゴリの追加に失敗しました')
    } finally {
      setAddingCategory(false)
    }
  }

  const resetForm = () => {
    setAmount(0)
    setDate(todayJst())
    setMemo('')
    setPaymentMethodId(null)
    setEditingId(null)
    // カテゴリ・範囲・種別は連続入力しやすいよう保持する
  }

  const handleCancelEdit = () => {
    resetForm()
    onEditDone?.()
  }

  const handleDelete = async () => {
    if (!editingId) return
    if (!confirm('この収支データを削除しますか?元に戻せません。')) return
    setDeleting(true)
    setError(null)
    try {
      await api.delete(`/transactions/${editingId}`)
      bumpTransactionsVersion()
      resetForm()
      onEditDone?.()
    } catch {
      setError('削除に失敗しました。通信環境を確認して再度お試しください。')
    } finally {
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    setError(null)

    if (!(amount > 0)) {
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
      const payload = {
        type,
        amount,
        category_id: categoryId,
        scope_id: scopeId,
        payment_method_id: paymentMethodId,
        transaction_date: date,
        memo: memo || null
      }
      if (editingId) {
        await api.put(`/transactions/${editingId}`, payload)
        bumpTransactionsVersion()
        resetForm()
        onEditDone?.()
      } else {
        await api.post('/transactions', payload)
        bumpTransactionsVersion()
        resetForm()
      }
      setSavedMessage(true)
      setTimeout(() => setSavedMessage(false), 2000)
    } catch (e) {
      setError('保存に失敗しました。通信環境を確認して再度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  if (loadingMaster) {
    return <p className="p-4 text-center text-gray-400 text-sm">読み込み中...</p>
  }

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{editingId ? '収支の編集' : '収支の入力'}</h1>
        {editingId && (
          <button onClick={handleCancelEdit} className="text-sm text-gray-500 underline">
            編集をやめる
          </button>
        )}
      </div>

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

      {/* 金額(タップで計算機オーバーレイを表示) */}
      <div>
        <label className="text-xs text-gray-500">金額</label>
        <button
          onClick={() => setShowCalculator(true)}
          className="w-full flex items-center border rounded-lg px-3 py-2 mt-1"
          type="button"
        >
          <span className="text-gray-400 mr-1">¥</span>
          <span className="text-2xl font-bold">{amount.toLocaleString('ja-JP')}</span>
        </button>
      </div>

      {/* 計算機オーバーレイ */}
      {showCalculator && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={() => setShowCalculator(false)}
        >
          <div className="w-full bg-white rounded-t-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-sm">金額を入力</h2>
              <button
                onClick={() => setShowCalculator(false)}
                className="bg-green-600 text-white text-sm font-bold px-4 py-1.5 rounded-lg"
              >
                確定
              </button>
            </div>
            <CalculatorInput
              initialValue={amount > 0 ? amount : undefined}
              onChange={setAmount}
            />
          </div>
        </div>
      )}

      {/* カテゴリ(アイコン+色付きグリッド選択) */}
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

          {/* カテゴリのクイック追加タイル */}
          <button
            onClick={() => setShowAddCategory((v) => !v)}
            className="flex flex-col items-center py-2 rounded-lg border-2 border-dashed border-gray-300"
          >
            <span className="w-8 h-8 flex items-center justify-center rounded-full text-lg bg-gray-100 text-gray-400">
              ＋
            </span>
            <span className="text-[10px] mt-1 text-gray-500">追加</span>
          </button>
        </div>

        {/* カテゴリ追加フォーム */}
        {showAddCategory && (
          <div className="mt-3 p-3 border rounded-lg bg-gray-50 space-y-2">
            <div>
              <label className="text-xs text-gray-500">カテゴリ名</label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="例: 医療費"
                className="w-full border rounded-lg px-3 py-2 mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">アイコン</label>
              <div className="grid grid-cols-8 gap-1 mt-1">
                {ICON_PRESETS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setNewCategoryIcon(icon)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg border-2 ${
                      newCategoryIcon === icon ? 'border-gray-800 bg-gray-100' : 'border-transparent'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <label className="text-xs text-gray-500 block mt-2">
                候補にない場合(端末の絵文字キーボードから自由入力)
              </label>
              <input
                type="text"
                value={newCategoryIcon}
                onChange={(e) => setNewCategoryIcon(e.target.value)}
                placeholder="任意の絵文字"
                className="w-20 border rounded-lg px-3 py-2 mt-1 text-center text-lg"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">色(円グラフの色にもなります)</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewCategoryColor(c)}
                    className={`w-7 h-7 rounded-full border-2 ${
                      newCategoryColor === c ? 'border-gray-800' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                {/* プリセットにない色を使いたい場合の自由選択 */}
                <label className="w-7 h-7 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center text-[10px] text-gray-400 cursor-pointer overflow-hidden">
                  ？
                  <input
                    type="color"
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                    className="opacity-0 w-0 h-0 absolute"
                  />
                </label>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAddCategory}
                disabled={addingCategory}
                className="flex-1 bg-gray-800 text-white text-sm font-bold py-2 rounded-lg disabled:opacity-50"
              >
                {addingCategory ? '追加中...' : 'このカテゴリを追加'}
              </button>
              <button
                onClick={() => setShowAddCategory(false)}
                className="px-4 text-sm text-gray-500"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
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

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {savedMessage && <p className="text-green-600 text-sm">保存しました</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-green-600 text-white font-bold py-3 rounded-lg disabled:opacity-50"
      >
        {saving ? '保存中...' : editingId ? '更新する' : '保存する'}
      </button>

      {editingId && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-full border border-red-400 text-red-500 font-bold py-3 rounded-lg disabled:opacity-50"
        >
          {deleting ? '削除中...' : 'この収支データを削除する'}
        </button>
      )}
    </div>
  )
}
