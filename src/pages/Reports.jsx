import { useEffect, useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { SOURCE_OPTIONS } from '../lib/constants'
import StatDetailModal from '../components/StatDetailModal'
import './Reports.css'

const ROLE_LABELS = { admin: 'Admin', subadmin: 'Subadmin', sales: 'Sales', bde: 'BDE', calling: 'Calling' }

function firstDayOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function Reports() {
  const { profile } = useAuth()
  const canView = ['admin', 'subadmin'].includes(profile?.role)

  const [fromDate, setFromDate] = useState(firstDayOfMonth())
  const [toDate, setToDate] = useState(today())
  const [leads, setLeads] = useState([])
  const [users, setUsers] = useState([])
  const [pendingOrders, setPendingOrders] = useState([])
  const [products, setProducts] = useState([])
  const [ordersWithProduct, setOrdersWithProduct] = useState([])
  const [loading, setLoading] = useState(true)
  const [statModal, setStatModal] = useState(null)
  const [trendData, setTrendData] = useState([])
  const [trendLoading, setTrendLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const rangeStart = new Date(fromDate + 'T00:00:00').toISOString()
    const rangeEnd = new Date(toDate + 'T23:59:59').toISOString()

    const [leadsRes, usersRes, pendingOrdersRes, productsRes, ordersWithProductRes] = await Promise.all([
      supabase
        .from('leads')
        .select('id, lead_name, company, status, source, assigned_to, product_id, order_value, next_followup_date, created_at')
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd),
      supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['sales', 'bde', 'calling'])
        .order('full_name'),
      supabase
        .from('orders')
        .select('order_number, company, order_value, paid_amount, payment_status, order_date')
        .in('payment_status', ['pending', 'partial'])
        .neq('status', 'cancelled'),
      supabase.from('products').select('id, product_name').order('product_name'),
      supabase
        .from('orders')
        .select('id, order_number, company, order_value, status, order_date, lead:leads(lead_name, product_id)')
        .gte('order_date', fromDate)
        .lte('order_date', toDate)
        .neq('status', 'cancelled')
    ])

    setLeads(leadsRes.data || [])
    setUsers(usersRes.data || [])
    setPendingOrders(pendingOrdersRes.data || [])
    setProducts(productsRes.data || [])
    setOrdersWithProduct(ordersWithProductRes.data || [])
    setLoading(false)
  }, [fromDate, toDate])

  useEffect(() => {
    if (canView) loadData()
  }, [canView, loadData])

  useEffect(() => {
    async function loadTrend() {
      if (!canView) return
      setTrendLoading(true)

      const months = []
      const now = new Date()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-IN', { month: 'short' }), start: d, end: new Date(d.getFullYear(), d.getMonth() + 1, 1) })
      }
      const rangeStart = months[0].start.toISOString()
      const rangeEnd = months[months.length - 1].end.toISOString()

      const [leadsRes, ordersRes] = await Promise.all([
        supabase.from('leads').select('created_at').gte('created_at', rangeStart).lt('created_at', rangeEnd),
        supabase.from('orders').select('order_value, order_date').neq('status', 'cancelled').gte('order_date', months[0].start.toISOString().slice(0, 10)).lt('order_date', months[months.length - 1].end.toISOString().slice(0, 10))
      ])

      const leadRows = leadsRes.data || []
      const orderRows = ordersRes.data || []

      const data = months.map((m) => {
        const leadCount = leadRows.filter((l) => {
          const d = new Date(l.created_at)
          return d >= m.start && d < m.end
        }).length
        const salesValue = orderRows.filter((o) => {
          const d = new Date(o.order_date)
          return d >= m.start && d < m.end
        }).reduce((sum, o) => sum + (Number(o.order_value) || 0), 0)
        return { month: m.label, leads: leadCount, sales: salesValue }
      })

      setTrendData(data)
      setTrendLoading(false)
    }
    loadTrend()
  }, [canView])

  if (!canView) {
    return (
      <div>
        <h1>Reports & MIS</h1>
        <p className="reports-subtitle">This page is only available to Admin and Subadmin.</p>
      </div>
    )
  }

  const total = leads.length
  const won = leads.filter((l) => l.status === 'won_order').length
  const lost = leads.filter((l) => l.status === 'lost_order').length
  const conversion = total ? Math.round((won / total) * 100) : 0
  const totalSalesValue = ordersWithProduct.reduce((sum, o) => sum + (Number(o.order_value) || 0), 0)

  const sourceWise = SOURCE_OPTIONS
    .map((s) => {
      const matching = leads.filter((l) => l.source === s.value)
      const count = matching.length
      return { label: s.label, value: s.value, count, pct: total ? Math.round((count / total) * 100) : 0, items: matching }
    })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)

  const bdeWise = users
    .map((u) => {
      const theirs = leads.filter((l) => l.assigned_to === u.id)
      const theirWonItems = theirs.filter((l) => l.status === 'won_order')
      const theirLostItems = theirs.filter((l) => l.status === 'lost_order')
      const conv = theirs.length ? Math.round((theirWonItems.length / theirs.length) * 100) : 0
      return { ...u, total: theirs.length, won: theirWonItems.length, lost: theirLostItems.length, conv, totalItems: theirs, wonItems: theirWonItems, lostItems: theirLostItems }
    })
    .filter((u) => u.total > 0)
    .sort((a, b) => b.total - a.total)

  const totalPendingPayment = pendingOrders.reduce(
    (sum, o) => sum + Math.max(0, Number(o.order_value || 0) - Number(o.paid_amount || 0)), 0
  )

  const productWise = [
    ...products.map((p) => {
      const productLeads = leads.filter((l) => l.product_id === p.id)
      const won = productLeads.filter((l) => l.status === 'won_order').length
      const conv = productLeads.length ? Math.round((won / productLeads.length) * 100) : 0
      const salesValue = ordersWithProduct
        .filter((o) => o.lead?.product_id === p.id)
        .reduce((sum, o) => sum + (Number(o.order_value) || 0), 0)
      return { name: p.product_name, total: productLeads.length, won, conv, salesValue }
    }),
    (() => {
      const unassigned = leads.filter((l) => !l.product_id)
      const won = unassigned.filter((l) => l.status === 'won_order').length
      const conv = unassigned.length ? Math.round((won / unassigned.length) * 100) : 0
      const salesValue = ordersWithProduct
        .filter((o) => !o.lead?.product_id)
        .reduce((sum, o) => sum + (Number(o.order_value) || 0), 0)
      return { name: 'No Product Assigned', total: unassigned.length, won, conv, salesValue }
    })()
  ].filter((p) => p.total > 0 || p.salesValue > 0)
    .sort((a, b) => b.total - a.total)

  function handleExport() {
    const wb = XLSX.utils.book_new()

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Report Period', `${fromDate} to ${toDate}`],
      [],
      ['Metric', 'Value'],
      ['Total Leads', total],
      ['Won Orders', won],
      ['Lost Orders', lost],
      ['Conversion Rate', `${conversion}%`],
      ['Total Sales Value (₹)', totalSalesValue]
    ])
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    const sourceSheet = XLSX.utils.aoa_to_sheet([
      ['Source', 'Leads', 'Percent'],
      ...sourceWise.map((s) => [s.label, s.count, `${s.pct}%`])
    ])
    XLSX.utils.book_append_sheet(wb, sourceSheet, 'Source-wise')

    const bdeSheet = XLSX.utils.aoa_to_sheet([
      ['Name', 'Role', 'Total Leads', 'Won', 'Lost', 'Conversion'],
      ...bdeWise.map((u) => [u.full_name, ROLE_LABELS[u.role], u.total, u.won, u.lost, `${u.conv}%`])
    ])
    XLSX.utils.book_append_sheet(wb, bdeSheet, 'BDE-wise')

    const pendingSheet = XLSX.utils.aoa_to_sheet([
      ['Order No.', 'Company', 'Order Value', 'Paid', 'Remaining', 'Status'],
      ...pendingOrders.map((o) => [
        o.order_number, o.company || '—', o.order_value || 0, o.paid_amount || 0,
        Math.max(0, Number(o.order_value || 0) - Number(o.paid_amount || 0)), o.payment_status
      ])
    ])
    XLSX.utils.book_append_sheet(wb, pendingSheet, 'Pending Payments')

    const productSheet = XLSX.utils.aoa_to_sheet([
      ['Product', 'Total Leads', 'Won', 'Conversion', 'Sales Value'],
      ...productWise.map((p) => [p.name, p.total, p.won, `${p.conv}%`, p.salesValue])
    ])
    XLSX.utils.book_append_sheet(wb, productSheet, 'Product-wise')

    XLSX.writeFile(wb, `sales_report_${fromDate}_to_${toDate}.xlsx`)
  }

  return (
    <div>
      <div className="reports-header">
        <div>
          <h1>Reports & MIS</h1>
          <p className="reports-subtitle">Sales performance for the selected period</p>
        </div>
        <button className="btn-primary" onClick={handleExport} disabled={loading || total === 0}>Export to Excel</button>
      </div>

      <div className="reports-filters">
        <div className="field">
          <label>From</label>
          <input className="text-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="field">
          <label>To</label>
          <input className="text-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <p className="reports-note">Loading report…</p>
      ) : (
        <>
          <div className="stat-grid">
            <button className="stat-card" onClick={() => setStatModal({ title: 'Total Leads', kind: 'leads', items: leads })}>
              <span className="stat-value">{total}</span>
              <span className="stat-label">Total Leads</span>
            </button>
            <button className="stat-card good" onClick={() => setStatModal({ title: 'Won Orders', kind: 'leads', items: leads.filter((l) => l.status === 'won_order') })}>
              <span className="stat-value">{won}</span>
              <span className="stat-label">Won Orders</span>
            </button>
            <button className="stat-card warn" onClick={() => setStatModal({ title: 'Lost Orders', kind: 'leads', items: leads.filter((l) => l.status === 'lost_order') })}>
              <span className="stat-value">{lost}</span>
              <span className="stat-label">Lost Orders</span>
            </button>
            <button className="stat-card" onClick={() => setStatModal({ title: 'Won Leads (Conversion)', kind: 'leads', items: leads.filter((l) => l.status === 'won_order') })}>
              <span className="stat-value">{conversion}%</span>
              <span className="stat-label">Conversion Rate</span>
            </button>
            <button className="stat-card good" onClick={() => setStatModal({ title: 'Orders (Sales Value)', kind: 'orders', items: ordersWithProduct })}>
              <span className="stat-value">₹{totalSalesValue.toLocaleString('en-IN')}</span>
              <span className="stat-label">Total Sales Value</span>
            </button>
            <button className="stat-card warn" onClick={() => setStatModal({ title: 'Pending Payments', kind: 'pending', items: pendingOrders })}>
              <span className="stat-value">₹{totalPendingPayment.toLocaleString('en-IN')}</span>
              <span className="stat-label">Pending Payment</span>
            </button>
          </div>

          <div className="reports-panels">
            <div className="panel-card">
              <h3>Monthly Lead Trend</h3>
              {trendLoading ? (
                <p className="reports-note">Loading trend…</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--text-secondary)" allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="leads" name="Leads" stroke="#5B8DEF" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="panel-card">
              <h3>Sales Trend</h3>
              {trendLoading ? (
                <p className="reports-note">Loading trend…</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--text-secondary)" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} />
                    <Line type="monotone" dataKey="sales" name="Sales (₹)" stroke="#2DBE7E" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="reports-panels">
            <div className="panel-card">
              <h3>Source-wise Leads</h3>
              {sourceWise.length === 0 ? (
                <p className="reports-note">No leads in this period.</p>
              ) : (
                <table className="reports-table">
                  <thead><tr><th>Source</th><th>Leads</th><th>%</th></tr></thead>
                  <tbody>
                    {sourceWise.map((s) => (
                      <tr key={s.label}>
                        <td>{s.label}</td>
                        <td>
                          <button
                            className="reports-count-link"
                            onClick={() => setStatModal({ title: `${s.label} Leads`, kind: 'leads', items: s.items })}
                          >
                            {s.count}
                          </button>
                        </td>
                        <td>{s.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="panel-card">
              <h3>BDE-wise Performance</h3>
              {bdeWise.length === 0 ? (
                <p className="reports-note">No assigned leads in this period.</p>
              ) : (
                <table className="reports-table">
                  <thead><tr><th>Name</th><th>Total</th><th>Won</th><th>Lost</th><th>Conv.</th></tr></thead>
                  <tbody>
                    {bdeWise.map((u) => (
                      <tr key={u.id}>
                        <td>{u.full_name}</td>
                        <td>
                          <button className="reports-count-link" onClick={() => setStatModal({ title: `${u.full_name} — All Leads`, kind: 'leads', items: u.totalItems })}>
                            {u.total}
                          </button>
                        </td>
                        <td>
                          <button className="reports-count-link" onClick={() => setStatModal({ title: `${u.full_name} — Won Leads`, kind: 'leads', items: u.wonItems })}>
                            {u.won}
                          </button>
                        </td>
                        <td>
                          <button className="reports-count-link" onClick={() => setStatModal({ title: `${u.full_name} — Lost Leads`, kind: 'leads', items: u.lostItems })}>
                            {u.lost}
                          </button>
                        </td>
                        <td>{u.conv}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="panel-card">
              <h3>Product-wise Performance</h3>
              {productWise.length === 0 ? (
                <p className="reports-note">No product-linked leads in this period.</p>
              ) : (
                <table className="reports-table">
                  <thead><tr><th>Product</th><th>Leads</th><th>Won</th><th>Conv.</th><th>Sales Value</th></tr></thead>
                  <tbody>
                    {productWise.map((p) => (
                      <tr key={p.name}>
                        <td>{p.name}</td>
                        <td>{p.total}</td>
                        <td>{p.won}</td>
                        <td>{p.conv}%</td>
                        <td>₹{p.salesValue.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="panel-card">
            <h3>Pending Payments (All Orders)</h3>
            {pendingOrders.length === 0 ? (
              <p className="reports-note">No pending payments. 🎉</p>
            ) : (
              <table className="reports-table">
                <thead><tr><th>Order No.</th><th>Company</th><th>Order Value</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
                <tbody>
                  {pendingOrders.map((o) => (
                    <tr key={o.order_number}>
                      <td>{o.order_number}</td>
                      <td>{o.company || '—'}</td>
                      <td>₹{Number(o.order_value || 0).toLocaleString('en-IN')}</td>
                      <td>₹{Number(o.paid_amount || 0).toLocaleString('en-IN')}</td>
                      <td>₹{Math.max(0, Number(o.order_value || 0) - Number(o.paid_amount || 0)).toLocaleString('en-IN')}</td>
                      <td>{o.payment_status === 'partial' ? 'Partial' : 'Pending'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {statModal && (
        <StatDetailModal
          title={statModal.title}
          kind={statModal.kind}
          items={statModal.items}
          onClose={() => setStatModal(null)}
        />
      )}
    </div>
  )
}
