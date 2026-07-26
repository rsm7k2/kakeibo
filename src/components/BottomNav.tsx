import type { NavTab } from '../types'

const TABS: { key: NavTab; label: string; icon: string }[] = [
  { key: 'input', label: '入力', icon: '✏️' },
  { key: 'calendar', label: 'カレンダー', icon: '📅' },
  { key: 'report', label: 'レポート', icon: '📊' },
  { key: 'budget', label: '予算', icon: '💰' },
  { key: 'menu', label: 'メニュー', icon: '☰' }
]

interface Props {
  active: NavTab
  onChange: (tab: NavTab) => void
}

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t bg-white pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex-1 flex flex-col items-center py-2 text-xs ${
            active === tab.key ? 'text-green-600 font-bold' : 'text-gray-500'
          }`}
        >
          <span className="text-xl">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
