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
  is_fixed_cost: number
  fixed_cost_rule_id: number | null
  created_at: string
  updated_at: string
}

// 固定費ルールの繰り返し単位。recurrence_interval と組み合わせて13種類の繰り返しパターンを表現する
// (none/day/weekday/yearはinterval=1固定、weekは1〜3、monthは1〜6で隔週・隔月等を表す)
export type RecurrenceUnit = 'none' | 'day' | 'weekday' | 'week' | 'month' | 'year'

// 発生日が土日祝だった場合の調整方法
export type HolidayAdjustment = 'none' | 'before' | 'after'

export interface FixedCostRule {
  id: number
  title: string
  type: TransactionType
  amount: number
  category_id: number
  scope_id: number
  recurrence_unit: RecurrenceUnit
  recurrence_interval: number
  start_date: string // 'YYYY-MM-DD'
  end_date: string | null
  holiday_adjustment: HolidayAdjustment
  occurrence_count: number
  created_at: string
  updated_at: string
}

// GET /api/fixed_cost_rules が返す、表示名を結合したルール
export interface FixedCostRuleWithDetails extends FixedCostRule {
  category_name: string
  category_icon: string | null
  category_color: string
  scope_name: string
}

export interface Budget {
  id: number
  year_month: string // 'YYYY-MM'
  scope_id: number
  category_id: number | null // null = その範囲全体の予算
  amount: number
}

// GET /api/transactions (期間指定) が返す、表示名を結合したトランザクション
export interface TransactionWithDetails extends Transaction {
  category_name: string
  category_icon: string | null
  category_color: string
  scope_name: string
  payment_method_name: string | null
}

// 画面下部ナビゲーションのタブ識別子
export type NavTab = 'input' | 'calendar' | 'report' | 'budget' | 'menu'
