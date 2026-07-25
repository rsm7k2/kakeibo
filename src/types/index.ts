export type TransactionType = 'income' | 'expense'

export interface Scope {
  id: number
  name: string
  sort_order: number
  is_default: number
}

export interface Category {
  id: number
  name: string
  type: TransactionType
  icon: string | null
  color: string
  sort_order: number
  is_default: number
}

export interface PaymentMethod {
  id: number
  name: string
  icon: string | null
  sort_order: number
  is_default: number
}

export interface Transaction {
  id: number
  type: TransactionType
  amount: number
  category_id: number
  scope_id: number
  payment_method_id: number | null
  transaction_date: string // 'YYYY-MM-DD'
  memo: string | null
  created_at: string
  updated_at: string
}

export interface Budget {
  id: number
  year_month: string // 'YYYY-MM'
  scope_id: number
  category_id: number | null // null = その範囲全体の予算
  amount: number
}

// 画面下部ナビゲーションのタブ識別子
export type NavTab = 'input' | 'calendar' | 'report' | 'budget' | 'menu'
