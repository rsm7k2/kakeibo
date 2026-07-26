import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../api/client'
import { useAppData } from '../contexts/AppDataContext'
import { CATEGORY_ICON_PRESETS } from '../constants/categoryPresets'
import MasterListEditor from '../components/MasterListEditor'
import type { MasterListFormData } from '../components/MasterListEditor'
import FixedCostManager from '../components/FixedCostManager'
import CsvImportExport from '../components/CsvImportExport'
import type { TransactionType } from '../types'

type MenuTab = 'scopes' | 'categories' | 'paymentMethods' | 'fixedCosts' | 'csv'

function IconScopes() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  )
}

function IconCategories() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.6 12.3 12.7 20.2a2 2 0 0 1-2.83 0L3.8 14.1a2 2 0 0 1 0-2.83L11.7 3.4a2 2 0 0 1 1.42-.6H19a2 2 0 0 1 2 2v5.68a2 2 0 0 1-.4 1.22Z" />
      <circle cx="15.5" cy="7.5" r="1.2" />
    </svg>
  )
}

function IconPayment() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.2" />
      <path d="M2.5 9.5h19" />
    </svg>
  )
}

function IconFixedCosts() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15.3-6.4M21 12a9 9 0 0 1-15.3 6.4" />
      <path d="M17.5 3v4h-4M6.5 21v-4h4" />
    </svg>
  )
}

function IconCsv() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  )
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function IconBack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

interface SectionProps {
  title: string
  open: boolean
  onBack: () => void
  contentRef: React.RefObject<HTMLDivElement>
  children: ReactNode
}

function Section({ title, open, onBack, contentRef, children }: SectionProps) {
  return (
    <div
      className={`fixed left-0 right-0 top-0 bottom-16 z-30 bg-white flex flex-col transition-transform duration-300 ease-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center gap-1 px-2 py-3 border-b shrink-0">
        <button onClick={onBack} className="flex items-center gap-0.5 text-green-600 font-bold text-sm px-1.5 py-2">
          <IconBack />
          メニュー
        </button>
        <span className="flex-1 text-center font-bold text-base pr-16">{title}</span>
      </div>
      <div ref={contentRef} className="flex-1 overflow-y-auto p-4 pb-24">
        {children}
      </div>
    </div>
  )
}

export default function MenuScreen() {
  const {
    categories,
    scopes,
    paymentMethods,
    reloadCategories,
    reloadScopes,
    reloadPaymentMethods
  } = useAppData()

  const [openItem, setOpenItem] = useState<MenuTab | null>(null)
  const [categoryType, setCategoryType] = useState<TransactionType>('expense')

  const filteredCategories = categories.filter((c) => c.type === categoryType)

  const scopesRef = useRef<HTMLDivElement>(null)
  const categoriesRef = useRef<HTMLDivElement>(null)
  const paymentRef = useRef<HTMLDivElement>(null)
  const fixedRef = useRef<HTMLDivElement>(null)
  const csvRef = useRef<HTMLDivElement>(null)

  // 詳細画面を開くたびに、前回のスクロール位置を引き継がず必ず上部から表示する
  useEffect(() => {
    const refs: Record<MenuTab, React.RefObject<HTMLDivElement>> = {
      scopes: scopesRef,
      categories: categoriesRef,
      paymentMethods: paymentRef,
      fixedCosts: fixedRef,
      csv: csvRef
    }
    if (openItem) refs[openItem].current?.scrollTo(0, 0)
  }, [openItem])

  const MENU_ITEMS: { key: MenuTab; label: string; meta: string; icon: ReactNode }[] = [
    { key: 'scopes', label: '範囲', meta: `${scopes.length}件`, icon: <IconScopes /> },
    {
      key: 'categories',
      label: 'カテゴリ',
      meta: `支出${categories.filter((c) => c.type === 'expense').length}・収入${
        categories.filter((c) => c.type === 'income').length
      }`,
      icon: <IconCategories />
    },
    { key: 'paymentMethods', label: '支払い方法', meta: `${paymentMethods.length}件`, icon: <IconPayment /> },
    { key: 'fixedCosts', label: '固定費', meta: '繰り返し収支の管理', icon: <IconFixedCosts /> },
    { key: 'csv', label: 'CSV', meta: 'インポート・エクスポート', icon: <IconCsv /> }
  ]

  return (
    <div className="p-4 pb-24">
      <h1 className="text-lg font-bold mb-3">メニュー</h1>

      <div className="bg-white border rounded-2xl divide-y overflow-hidden">
        {MENU_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => setOpenItem(item.key)}
            className="w-full flex items-center gap-3 p-3.5 text-left active:bg-gray-50"
          >
            <span className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0 [&_svg]:w-[19px] [&_svg]:h-[19px]">
              {item.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold">{item.label}</span>
              <span className="block text-xs text-gray-400 mt-0.5 truncate">{item.meta}</span>
            </span>
            <span className="text-gray-300 shrink-0">
              <IconChevron />
            </span>
          </button>
        ))}
      </div>

      <Section title="範囲" open={openItem === 'scopes'} onBack={() => setOpenItem(null)} contentRef={scopesRef}>
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
      </Section>

      <Section
        title="カテゴリ"
        open={openItem === 'categories'}
        onBack={() => setOpenItem(null)}
        contentRef={categoriesRef}
      >
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
      </Section>

      <Section
        title="支払い方法"
        open={openItem === 'paymentMethods'}
        onBack={() => setOpenItem(null)}
        contentRef={paymentRef}
      >
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
      </Section>

      <Section title="固定費" open={openItem === 'fixedCosts'} onBack={() => setOpenItem(null)} contentRef={fixedRef}>
        <FixedCostManager />
      </Section>

      <Section title="CSV" open={openItem === 'csv'} onBack={() => setOpenItem(null)} contentRef={csvRef}>
        <CsvImportExport />
      </Section>
    </div>
  )
}
