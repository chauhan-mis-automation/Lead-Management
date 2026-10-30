import { Phone, Check, ChevronRight, CheckCircle2 } from 'lucide-react'
import { Panel, Badge, Empty, dateKey } from './shared'
import { statusMeta, actionTypeMeta } from '../../lib/constants'

export default function FollowupsTable({ rows, filter, onFilter, todayKey, markingId, onMarkDone, onOpenLead, delay }) {
  const shown = rows.slice(0, 10)
  return (
    <Panel
      title="Upcoming Follow-ups"
      subtitle={`${rows.length} scheduled`}
      delay={delay}
      action={
        <select className="dx-select" value={filter} onChange={(e) => onFilter(e.target.value)} aria-label="Filter follow-ups">
          <option value="all">All upcoming</option>
          <option value="today">Due today</option>
          <option value="overdue">Overdue</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
      }
    >
      {shown.length === 0 ? (
        <Empty icon={CheckCircle2} text="No follow-ups in this range. You're all caught up!" />
      ) : (
        <div className="dx-table-wrap">
          <table className="dx-table">
            <thead>
              <tr><th>Lead</th><th>Type</th><th>Scheduled</th><th>Status</th><th className="dx-th-actions">Actions</th></tr>
            </thead>
            <tbody>
              {shown.map((l) => {
                const k = dateKey(new Date(l.next_followup_date))
                const overdue = k < todayKey
                const isToday = k === todayKey
                const a = actionTypeMeta(l.next_action_type)
                const canCall = a.value === 'call' && l.mobile
                return (
                  <tr key={l.id} onClick={() => onOpenLead(l.id)}>
                    <td data-label="Lead">
                      <div className="dx-cell-name">{l.lead_name}</div>
                      {l.company && <div className="dx-cell-sub">{l.company}</div>}
                    </td>
                    <td data-label="Type"><span className="dx-type-chip">{a.icon} {a.label}</span></td>
                    <td data-label="Scheduled" className="dx-nowrap">
                      {new Date(l.next_followup_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td data-label="Status">
                      {overdue ? <Badge color={MINT_ROSE} dot>Overdue</Badge>
                        : isToday ? <Badge color={MINT_AMBER} dot>Due today</Badge>
                        : <Badge color={MINT_GREEN} dot>Scheduled</Badge>}
                      <span className="dx-stage">{statusMeta(l.status).label}</span>
                    </td>
                    <td className="dx-actions" onClick={(e) => e.stopPropagation()}>
                      {canCall && (
                        <a className="dx-icon-btn" href={`tel:${l.mobile}`} title="Call" aria-label="Call"><Phone size={15} /></a>
                      )}
                      <button className="dx-icon-btn done" disabled={markingId === l.id} onClick={(e) => onMarkDone(l, e)} title="Mark as done" aria-label="Mark as done">
                        <Check size={15} />
                      </button>
                      <button className="dx-icon-btn" onClick={() => onOpenLead(l.id)} title="Open lead" aria-label="Open lead"><ChevronRight size={15} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > shown.length && <p className="dx-foot-note">Showing {shown.length} of {rows.length}. Use Leads to see everything.</p>}
    </Panel>
  )
}

const MINT_ROSE = '#F43F5E'
const MINT_AMBER = '#F59E0B'
const MINT_GREEN = '#059669'
