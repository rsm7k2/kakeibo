import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../api/client'
import type { Category, PaymentMethod, Scope } from '../types'

interface AppDataContextValue {
  categories: Category[]
  scopes: Scope[]
  paymentMethods: PaymentMethod[]
  loadingMaster: boolean
  /** カテゴリ追加後などに呼び出して、共有中のカテゴリ一覧を再取得する */
  reloadCategories: () => Promise<void>
  /** 収支データが変更された回数。この値の変化を見て、各画面が再取得のタイミングを判断する */
  transactionsVersion: number
  /** 収支の保存・更新・削除が成功した際に呼び出す */
  bumpTransactionsVersion: () => void
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [scopes, setScopes] = useState<Scope[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loadingMaster, setLoadingMaster] = useState(true)
  const [transactionsVersion, setTransactionsVersion] = useState(0)

  const reloadCategories = useCallback(async () => {
    const data = await api.get<Category[]>('/categories')
    setCategories(data)
  }, [])

  // マスタデータはアプリ起動時に1度だけ取得し、以降は各画面で使い回す
  useEffect(() => {
    setLoadingMaster(true)
    Promise.all([
      api.get<Category[]>('/categories').then(setCategories),
      api.get<Scope[]>('/scopes').then(setScopes),
      api.get<PaymentMethod[]>('/payment_methods').then(setPaymentMethods)
    ]).finally(() => setLoadingMaster(false))
  }, [])

  const bumpTransactionsVersion = useCallback(() => {
    setTransactionsVersion((v) => v + 1)
  }, [])

  return (
    <AppDataContext.Provider
      value={{
        categories,
        scopes,
        paymentMethods,
        loadingMaster,
        reloadCategories,
        transactionsVersion,
        bumpTransactionsVersion
      }}
    >
      {children}
    </AppDataContext.Provider>
  )
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData は AppDataProvider の内側で使用してください')
  return ctx
}
