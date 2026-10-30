import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Panel, buildMonthGrid, dateKey } from './shared'
import { actionTypeMeta } from '../../lib/constants'

export default function MiniCalendar({ today, leadsByDay, onViewAll, delay }) {
  const [offset, setOffset] = useState(0)
  const base = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const days = buildMonthGrid(base.getFullYear(), base.getMonth())
  const todayKey = dateKey(today)
  const eventCount = days.filter((d) => d.getMonth() === base.getMonth() && leadsByDay[dateKey(d)]).length

  return (
    <Panel
      title="Call Calendar"
      subtitle={`${eventCount} day${eventCount === 1 ? '' : 's'} with follow-ups`}
      delay={delay}
      action={
        <div className="dx-cal-nav">
          <button onClick={() => setOffset((o) => o - 1)} aria-label="Previous month"><ChevronLeft size={15} /></button>
          <button className="dx-cal-month" onClick={onViewAll} title="Open calendar">
            {base.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
          </button>
          <button onClick={() => setOffset((o) => o + 1)} aria-label="Next month"><ChevronRight size={15} /></button>
        </div>
      }
    >
      <div className="dx-cal-week">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="dx-cal-grid">
        {days.map((d) => {
          const key = dateKey(d)
          const inMonth = d.getMonth() === base.getMonth()
          const dayLeads = leadsByDay[key] || []
          const col = d.getDay()
          return (
            <div key={key}
              className={'dx-cal-cell' + (inMonth ? '' : ' out') + (key === todayKey ? ' today' : '') + (dayLeads.length ? ' has' : '') + (col >= 5 ? ' tip-left' : '')}>
              {d.getDate()}
              {dayLeads.length > 0 && <i className="dx-cal-dot" />}
              {dayLeads.length > 0 && (
                <div className="dx-cal-tip">
                  <b>{d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</b>
                  {dayLeads.slice(0, 4).map((l) => (
                    <div key={l.id}>
                      <em>{new Date(l.next_followup_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</em>
                      {actionTypeMeta(l.next_action_type).icon} {l.lead_name}
                    </div>
                  ))}
                  {dayLeads.length > 4 && <small>+{dayLeads.length - 4} more</small>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
