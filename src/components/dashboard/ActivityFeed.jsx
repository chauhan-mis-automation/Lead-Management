import { useState } from 'react'
import { Phone, Sun, Activity as ActivityIcon, Receipt } from 'lucide-react'
import { Panel, Badge, Empty } from './shared'
import { orderStatusMeta, actionTypeMeta } from '../../lib/constants'

export function TodayList({ leads, onOpenLead, delay }) {
  return (
    <Panel title={`Today's Activities`} subtitle={`${leads.length} due today`} delay={delay}>
      {leads.length === 0 ? (
        <Empty icon={Sun} text="Nothing scheduled for today." />
      ) : (
        <ul className="dx-today">
          {leads.slice(0, 5).map((l) => {
            const a = actionTypeMeta(l.next_action_type)
            return (
              <li key={l.id}>
                <span className="dx-today-time">
                  {new Date(l.next_followup_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="dx-today-main">
                  <div className="dx-cell-name">{a.icon} {l.company || l.lead_name}</div>
                  <div className="dx-cell-sub">{l.lead_name}</div>
                </div>
                {a.value === 'call' && l.mobile
                  ? <a className="dx-mini-btn" href={`tel:${l.mobile}`}><Phone size={13} /> Call</a>
                  : <button className="dx-mini-btn" onClick={() => onOpenLead(l.id)}>{a.label}</button>}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

export function FeedPanel({ activity, orders, onViewOrders, delay }) {
  const [tab, setTab] = useState('activity')
  return (
    <Panel
      title="Recent Updates"
      delay={delay}
      action={
        <div className="dx-tabs">
          <button className={tab === 'activity' ? 'on' : ''} onClick={() => setTab('activity')}>Activity</button>
          <button className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}>Orders</button>
        </div>
      }
    >
      {tab === 'activity' ? (
        activity.length === 0 ? <Empty icon={ActivityIcon} text="No recent activity." /> : (
          <ul className="dx-timeline">
            {activity.map((a, i) => (
              <li key={i} style={{ '--i': i }}>
                <i />
                <div>
                  <p>{a.text}</p>
                  <time>{new Date(a.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : orders.length === 0 ? <Empty icon={Receipt} text="No orders yet." /> : (
        <>
          <ul className="dx-orders">
            {orders.map((o) => {
              const m = orderStatusMeta(o.status)
              return (
                <li key={o.id}>
                  <div>
                    <div className="dx-cell-name">{o.order_number}</div>
                    <div className="dx-cell-sub">{o.company || o.lead?.lead_name || '—'}</div>
                  </div>
                  <b>{o.order_value ? `₹${Number(o.order_value).toLocaleString('en-IN')}` : '—'}</b>
                  <Badge color={m.color}>{m.label}</Badge>
                </li>
              )
            })}
          </ul>
          <button className="dx-link dx-link-block" onClick={onViewOrders}>View all orders</button>
        </>
      )}
    </Panel>
  )
}
