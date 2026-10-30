import { UserPlus, ShoppingCart, Upload, CalendarDays, ClipboardList, BarChart3 } from 'lucide-react'
import { Panel } from './shared'

export default function QuickActions({ canCreate, isManager, handlers, delay }) {
  const items = [
    canCreate && { label: 'Add Lead', icon: UserPlus, tone: '#10B981', on: handlers.addLead },
    canCreate && { label: 'Create Order', icon: ShoppingCart, tone: '#6366F1', on: handlers.addOrder },
    canCreate && { label: 'Bulk Upload', icon: Upload, tone: '#0EA5E9', on: handlers.bulk },
    { label: 'View Calendar', icon: CalendarDays, tone: '#F59E0B', on: handlers.calendar },
    { label: 'View Orders', icon: ClipboardList, tone: '#14B8A6', on: handlers.orders },
    isManager && { label: 'View Reports', icon: BarChart3, tone: '#F43F5E', on: handlers.reports }
  ].filter(Boolean)
  return (
    <Panel title="Quick Actions" delay={delay}>
      <div className="dx-qa-grid">
        {items.map((a) => (
          <button key={a.label} className="dx-qa" style={{ '--tone': a.tone }} onClick={a.on}>
            <span className="dx-qa-icon"><a.icon size={19} strokeWidth={2.2} /></span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </Panel>
  )
}
