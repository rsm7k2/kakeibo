import { useState } from 'react'
import BottomNav from './components/BottomNav'
import InputScreen from './screens/InputScreen'
import CalendarScreen from './screens/CalendarScreen'
import ReportScreen from './screens/ReportScreen'
import BudgetScreen from './screens/BudgetScreen'
import MenuScreen from './screens/MenuScreen'
import { AppDataProvider } from './contexts/AppDataContext'
import type { NavTab, TransactionWithDetails } from './types'

function AppContent() {
  // 初期表示画面は「入力」で固定(前回の設計確認どおり)
  const [activeTab, setActiveTab] = useState<NavTab>('input')

  // カレンダー画面から「編集」を選んだ際に、入力画面へ渡すデータ
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithDetails | null>(null)

  const handleEditTransaction = (t: TransactionWithDetails) => {
    setEditingTransaction(t)
    setActiveTab('input')
  }

  // 編集の保存・削除・キャンセルが完了したら、編集の呼び出し元(カレンダー画面)に戻る
  const handleEditDone = () => {
    setEditingTransaction(null)
    setActiveTab('calendar')
  }

  // 画面はアンマウントせず、CSSの表示/非表示切り替えで保持する。
  // これにより、タブを切り替えるたびにカテゴリ・範囲・支払い方法・収支データを
  // 再取得する必要がなくなり、2回目以降の切り替えがほぼ瞬時になる。
  return (
    <div className="min-h-screen pb-16">
      <div className={activeTab === 'input' ? '' : 'hidden'}>
        <InputScreen editTransaction={editingTransaction} onEditDone={handleEditDone} />
      </div>
      <div className={activeTab === 'calendar' ? '' : 'hidden'}>
        <CalendarScreen onEditTransaction={handleEditTransaction} />
      </div>
      <div className={activeTab === 'report' ? '' : 'hidden'}>
        <ReportScreen />
      </div>
      <div className={activeTab === 'budget' ? '' : 'hidden'}>
        <BudgetScreen />
      </div>
      <div className={activeTab === 'menu' ? '' : 'hidden'}>
        <MenuScreen />
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  )
}

export default function App() {
  return (
    <AppDataProvider>
      <AppContent />
    </AppDataProvider>
  )
}
