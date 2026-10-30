import { ShoppingBag } from 'lucide-react'
import { Panel, Empty, AnimatedStat, MINT } from './shared'
import { orderStatusMeta } from '../../lib/constants'

export default function OrdersOverview({ orders, onViewAll }) {
  const active = orders.filter((o) => o.status !== 'cancelled')
  const value = active.reduce((s, o) => s + (Number(o.order_value) || 0), 0)
  const avg = active.length ? Math.round(value / active.length) : 0
  const byStatus = Object.values(orders.reduce((acc, o) => {
    const m = orderStatusMeta(o.status)
    acc[o.status] = acc[o.status] || { label: m.label, color: m.color, count: 0, value: 0 }
    acc[o.status].count++
    acc[o.status].value += Number(o.order_value) || 0
    return acc
  }, {})).sort((a, b) => b.count - a.count)
  const max = Math.max(...byStatus.map((s) => s.count), 1)
  const inr = (n) => `₹${n.toLocaleString('en-IN')}`
  return (
    <Panel title="Orders Overview" subtitle="Revenue and order status at a glance" action={<button className="dx-link" onClick={onViewAll}>View all</button>}>
      {orders.length === 0 ? <Empty icon={ShoppingBag} text="No orders yet." /> : (
        <>
          <div className="dx-ord-stats">
            <div><b><AnimatedStat value={orders.length} /></b><span>Orders</span></div>
            <div><b><AnimatedStat value={value} format={inr} /></b><span>Total value</span></div>
            <div><b><AnimatedStat value={avg} format={inr} /></b><span>Avg. order</span></div>
          </div>
          <ul className="dx-perf">
            {byStatus.map((s, i) => (
              <li key={s.label}>
                <div className="dx-perf-top">
                  <span className="dx-source-name"><i style={{ background: s.color || MINT.emerald }} />{s.label}</span>
                  <span className="dx-perf-stats">{s.count} {s.count === 1 ? "order" : "orders"} <em>{inr(s.value)}</em></span>
                </div>
                <div className="dx-source-track"><div style={{ '--w': (s.count / max) * 100 + '%', '--c': s.color || MINT.emerald, '--d': i * 0.07 + 's' }} /></div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}
