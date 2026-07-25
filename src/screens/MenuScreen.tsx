import { useState } from 'react'
import { api } from '../api/client'
import { useAppData } from '../contexts/AppDataContext'
import { CATEGORY_ICON_PRESETS } from '../constants/categoryPresets'
import MasterListEditor from '../components/MasterListEditor'
import type { MasterListFormData } from '../components/MasterListEditor'
import type { TransactionType } from '../types'

type MenuTab = 'scopes' | 'categories' | 'paymentMethods'

export default function MenuScreen() {
  const {
    categories,
    scopes,
    paymentMethods,
    reloadCategories,
    reloadScopes,
    reloadPaymentMethods
  } = useAppData()

  const [tab, setTab] = useState<MenuTab>('scopes')
  const [categoryType, setCategoryType] = useState<TransactionType>('expense')

  const filteredCategories = categories.filter((c) => c.type === categoryType)

  return (
    <div className="p-4 pb-24">
      <h1 className="text-lg font-bold mb-3">メニュー</h1>

      {/* 管理対象の切替 */}
      <div className="flex rounded-lg overflow-hidden border mb-4">
        <button
          className={`flex-1 py-2 text-sm font-bold ${
            tab === 'scopes' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500'
          }`}
          onClick={() => setTab('scopes')}
        >
          範囲
        </button>
        <button
          className={`flex-1 py-2 text-sm font-bold ${
            tab === 'categories' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500'
          }`}
          onClick={() => setTab('categories')}
        >
          カテゴリ
        </button>
        <button
          className={`flex-1 py-2 text-sm font-bold ${
            tab === 'paymentMethods' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500'
          }`}
          onClick={() => setTab('paymentMethods')}
        >
          支払い方法
        </button>
      </div>

      {tab === 'scopes' && (
        <MasterListEditor
          items={scopes}
          addLabel="＋ 範囲を追加"
          emptyText="範囲がありません"
          entityLabel="範囲"
          onAdd={async (data: MasterListFormData) => {
            await api.post('/scopes', { name: data.name })
            await reloadScopes()
          }}
          onSave={async (id, data) => {
            await api.put(`/scopes/${id}`, { name: data.name })
            await reloadScopes()
          }}
          onDelete={async (id) => {
            await api.delete(`/scopes/${id}`)
            await reloadScopes()
          }}
          onReorder={async (ids) => {
            await api.put('/scopes/reorder', { ids })
            await reloadScopes()
          }}
        />
      )}

      {tab === 'categories' && (
        <>
          {/* 収入/支出 切替 */}
          <div className="flex rounded-lg overflow-hidden border mb-3">
            <button
              className={`flex-1 py-2 text-sm font-bold ${
                categoryType === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-gray-500'
              }`}
              onClick={() => setCategoryType('expense')}
            >
              支出
            </button>
            <button
              className={`flex-1 py-2 text-sm font-bold ${
                categoryType === 'income' ? 'bg-green-500 text-white' : 'bg-white text-gray-500'
              }`}
              onClick={() => setCategoryType('income')}
            >
              収入
            </button>
          </div>

          <MasterListEditor
            items={filteredCategories}
            showColor
            showIcon
            iconPresets={CATEGORY_ICON_PRESETS}
            addLabel="＋ カテゴリを追加"
            emptyText="カテゴリがありません"
            entityLabel="カテゴリ"
            onAdd={async (data) => {
              await api.post('/categories', { ...data, type: categoryType })
              await reloadCategories()
            }}
            onSave={async (id, data) => {
              await api.put(`/categories/${id}`, data)
              await reloadCategories()
            }}
            onDelete={async (id) => {
              await api.delete(`/categories/${id}`)
              await reloadCategories()
            }}
            onReorder={async (ids) => {
              await api.put('/categories/reorder', { type: categoryType, ids })
              await reloadCategories()
            }}
          />
        </>
      )}

      {tab === 'paymentMethods' && (
        <MasterListEditor
          items={paymentMethods}
          showIcon
          addLabel="＋ 支払い方法を追加"
          emptyText="支払い方法がありません"
          entityLabel="支払い方法"
          onAdd={async (data) => {
            await api.post('/payment_methods', { name: data.name, icon: data.icon })
            await reloadPaymentMethods()
          }}
          onSave={async (id, data) => {
            await api.put(`/payment_methods/${id}`, { name: data.name, icon: data.icon })
            await reloadPaymentMethods()
          }}
          onDelete={async (id) => {
            await api.delete(`/payment_methods/${id}`)
            await reloadPaymentMethods()
          }}
          onReorder={async (ids) => {
            await api.put('/payment_methods/reorder', { ids })
            await reloadPaymentMethods()
          }}
        />
      )}
    </div>
  )
}
