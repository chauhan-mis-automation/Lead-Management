import { CalendarDays } from 'lucide-react'
import { Panel, Badge, statusTone } from './shared'
import { statusMeta } from '../../lib/constants'

export default function PipelineBoard({ columns, leads, onOpenLead, onViewAll, delay }) {
  return (
    <Panel
      title="Lead Pipeline"
      subtitle="Latest leads in each stage"
      delay={delay}
      action={<button className="dx-link" onClick={onViewAll}>View all</button>}
    >
      <div className="dx-board">
        {columns.map((col) => {
          const colLeads = leads.filter((l) => col.statuses.includes(l.status))
          const visible = colLeads.slice(0, 3)
          const extra = colLeads.length - visible.length
          return (
            <div className="dx-col" key={col.key} style={{ '--c': col.color }}>
              <div className="dx-col-head">
                <span className="dx-col-title"><i />{col.label}</span>
                <span className="dx-col-count">{colLeads.length}</span>
              </div>
              <div className="dx-col-body">
                {visible.map((l) => {
                  const meta = statusMeta(l.status)
                  return (
                    <button key={l.id} className="dx-lead-card" onClick={() => onOpenLead(l.id)}>
                      <span className="dx-lead-name">{l.lead_name}</span>
                      <span className="dx-lead-company">{l.company || '—'}</span>
                      <span className="dx-lead-foot">
                        <span className="dx-date-tag">
                          <CalendarDays size={11} />
                          {new Date(l.next_followup_date || l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                        <Badge color={statusTone(l.status)}>{meta.label}</Badge>
                      </span>
                    </button>
                  )
                })}
                {extra > 0 && <button className="dx-more" onClick={onViewAll}>+ {extra} more</button>}
                {colLeads.length === 0 && <div className="dx-col-empty">No leads</div>}
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
