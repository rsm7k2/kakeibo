import { useState } from 'react'
import BottomNav from './components/BottomNav'
import InputScreen from './screens/InputScreen'
import CalendarScreen from './screens/CalendarScreen'
import ReportScreen from './screens/ReportScreen'
import BudgetScreen from './screens/BudgetScreen'
import MenuScreen from './screens/MenuScreen'
import type { NavTab } from './types'

export default function App() {
  // 初期表示画面は「入力」で固定(前回の設計確認どおり)
  const [activeTab, setActiveTab] = useState<NavTab>('input')

  const renderScreen = () => {
    switch (activeTab) {
      case 'input':
        return <InputScreen />
      case 'calendar':
        return <CalendarScreen />
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
