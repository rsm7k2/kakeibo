import { useState } from 'react'
import LoadingOverlay from './LoadingOverlay'
import { CATEGORY_COLOR_PRESETS } from '../constants/categoryPresets'

export interface MasterListItem {
  id: number
  name: string
  icon?: string | null
  color?: string
}

export interface MasterListFormData {
  name: string
  icon: string | null
  color: string
}

interface Props {
  items: MasterListItem[]
  /** カテゴリのみ: 色の選択(プリセット+カスタムピッカー)を表示する */
  showColor?: boolean
  /** カテゴリ・支払い方法: アイコン(絵文字)入力を表示する。プリセット未指定なら自由入力欄のみ */
  showIcon?: boolean
  iconPresets?: string[]
  addLabel: string
  emptyText: string
  /** 削除確認ダイアログ・削除不可メッセージで使う名称(例: 「カテゴリ」「範囲」) */
  entityLabel: string
  onAdd: (data: MasterListFormData) => Promise<void>
  onSave: (id: number, data: MasterListFormData) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onReorder: (ids: number[]) => Promise<void>
}

const DEFAULT_COLOR = CATEGORY_COLOR_PRESETS[0]

export default function MasterListEditor({
  items,
  showColor = false,
  showIcon = false,
  iconPresets,
  addLabel,
  emptyText,
  entityLabel,
  onAdd,
  onSave,
  onDelete,
  onReorder
}: Props) {
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openAddForm = () => {
    setFormMode('add')
    setEditingId(null)
    setName('')
    setIcon('')
    setColor(DEFAULT_COLOR)
    setError(null)
  }

  const openEditForm = (item: MasterListItem) => {
    setFormMode('edit')
    setEditingId(item.id)
    setName(item.name)
    setIcon(item.icon ?? '')
    setColor(item.color ?? DEFAULT_COLOR)
    setError(null)
  }

  const closeForm = () => {
    setFormMode(null)
    setEditingId(null)
    setError(null)
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('名前を入力してください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const data: MasterListFormData = { name: name.trim(), icon: icon || null, color }
      if (formMode === 'edit' && editingId !== null) {
        await onSave(editingId, data)
      } else {
        await onAdd(data)
      }
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました。通信環境を確認して再度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (editingId === null) return
    if (!confirm(`この${entityLabel}を削除しますか?元に戻せません。`)) return
    setDeleting(true)
    setError(null)
    try {
      await onDelete(editingId)
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました。通信環境を確認して再度お試しください。')
    } finally {
      setDeleting(false)
    }
  }

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const reordered = [...items]
    const tmp = reordered[index]
    reordered[index] = reordered[target]
    reordered[target] = tmp
    setReordering(true)
    setError(null)
    try {
      await onReorder(reordered.map((it) => it.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '並び替えに失敗しました')
    } finally {
      setReordering(false)
    }
  }

  return (
    <div>
      {error && !formMode && <p className="text-red-500 text-sm mb-3">{error}</p>}

      {items.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">{emptyText}</p>}

      <div className="bg-white border rounded-2xl divide-y overflow-hidden">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-center gap-1 p-1">
            <div className="flex flex-col shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  move(index, -1)
                }}
                disabled={index === 0 || reordering}
                className="px-2 text-gray-400 disabled:opacity-20"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  move(index, 1)
                }}
                disabled={index === items.length - 1 || reordering}
                className="px-2 text-gray-400 disabled:opacity-20"
              >
                ▼
              </button>
            </div>
            <button
              type="button"
              onClick={() => openEditForm(item)}
              className="flex-1 flex items-center gap-2 p-2 text-left active:bg-gray-50 rounded-lg"
            >
              {showColor && (
                <span
                  className="w-7 h-7 flex items-center justify-center rounded-full text-sm shrink-0"
                  style={{ backgroundColor: item.color }}
                >
                  {item.icon ?? '•'}
                </span>
              )}
              {showIcon && !showColor && item.icon && <span className="text-lg shrink-0">{item.icon}</span>}
              <span className="flex-1 text-sm font-bold truncate">{item.name}</span>
              <span className="text-gray-300 text-xs shrink-0">＞</span>
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={openAddForm}
        className="w-full mt-3 py-2.5 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500"
      >
        {addLabel}
      </button>

      {/* 追加・編集フォーム */}
      {formMode && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={closeForm}>
          <div
            className="w-full bg-white rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm">{formMode === 'edit' ? '編集' : '新規追加'}</h2>
              <button onClick={closeForm} className="text-sm text-gray-400">
                閉じる
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">名前</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                />
              </div>

              {showIcon && (
                <div>
                  <label className="text-xs text-gray-500">アイコン(任意)</label>
                  {iconPresets && (
                    <div className="grid grid-cols-8 gap-1 mt-1">
                      {iconPresets.map((presetIcon) => (
                        <button
                          key={presetIcon}
                          type="button"
                          onClick={() => setIcon(presetIcon)}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg border-2 ${
                            icon === presetIcon ? 'border-gray-800 bg-gray-100' : 'border-transparent'
                          }`}
                        >
                          {presetIcon}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="端末の絵文字キーボードから自由入力も可能"
                    className="w-20 border rounded-lg px-3 py-2 mt-2 text-center text-lg"
                  />
                </div>
              )}

              {showColor && (
                <div>
                  <label className="text-xs text-gray-500">色(円グラフの色にもなります)</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {CATEGORY_COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-7 h-7 rounded-full border-2 ${
                          color === c ? 'border-gray-800' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <label className="w-7 h-7 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center text-[10px] text-gray-400 cursor-pointer overflow-hidden">
                      ？
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="opacity-0 w-0 h-0 absolute"
                      />
                    </label>
                  </div>
                </div>
              )}

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || deleting}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-lg disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存する'}
              </button>

              {formMode === 'edit' && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving || deleting}
                  className="w-full border border-red-400 text-red-500 font-bold py-3 rounded-lg disabled:opacity-50"
                >
                  {deleting ? '削除中...' : '削除する'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {saving && <LoadingOverlay text="保存中" />}
      {deleting && <LoadingOverlay text="削除中" />}
    </div>
  )
}
