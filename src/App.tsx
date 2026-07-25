import { useState } from 'react'
import BottomNav from './components/BottomNav'
import InputScreen from './screens/InputScreen'
import CalendarScreen from './screens/CalendarScreen'
import ReportScreen from './screens/ReportScreen'
import BudgetScreen from './screens/BudgetScreen'
import MenuScreen from './screens/MenuScreen'
import type { NavTab, TransactionWithDetails } from './types'

export default function App() {
  // 初期表示画面は「入力」で固定(前回の設計確認どおり)
  const [activeTab, setActiveTab] = useState<NavTab>('input')

  // カレンダー画面から「編集」を選んだ際に、入力画面へ渡すデータ
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithDetails | null>(null)

  const handleEditTransaction = (t: TransactionWithDetails) => {
    setEditingTransaction(t)
    setActiveTab('input')
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'input':
        return (
          <InputScreen
            editTransaction={editingTransaction}
            onEditDone={() => setEditingTransaction(null)}
          />
        )
      case 'calendar':
        return <CalendarScreen onEditTransaction={handleEditTransaction} />
      case 'report':
        return <ReportScreen />
      case 'budget':
        return <BudgetScreen />
      case 'menu':
        return <MenuScreen />
    }
  }

  return (
    <div className="min-h-screen pb-16">
      {renderScreen()}
      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  )
}
