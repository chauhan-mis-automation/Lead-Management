import { useEffect, useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { SOURCE_OPTIONS, STATUS_OPTIONS, statusMeta } from '../lib/constants'
import StatDetailModal from '../components/StatDetailModal'
import './ReportsHub.css'

const ROLE_LABELS = { admin: 'Admin', subadmin: 'Subadmin', sales: 'Sales', bde: 'BDE', calling: 'Calling' }
const WON = 'won_order'
const LOST = 'lost_order'

function pad(n) { return String(n).padStart(2, '0') }
function toDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function firstDayOfMonth() { const d = new Date(); return toDateStr(new Date(d.getFullYear(), d.getMonth(), 1)) }
function todayStr() { return toDateStr(new Date()) }
function startOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}
function money(v) { return `₹${Number(v || 0).toLocaleString('en-IN')}` }

const TABS = [
  { key: 'date_wise', label: 'Date Wise' },
  { key: 'user_activity', label: 'User Wise Activity' },
  { key: 'lead_assignment', label: 'Lead Assignment' },
  { key: 'monthly_sales', label: 'Monthly Sales' },
  { key: 'yearly_sales', label: 'Yearly Sales' },
  { key: 'product_sales', label: 'Product Wise Sales' },
  { key: 'customer_sales', label: 'Customer Wise Sales' },
  { key: 'salesman_sales', label: 'Salesman Wise Sales' },
  { key: 'sales_funnel', label: 'Sales Funnel' },
  { key: 'industry_sales', label: 'Industry Wise Sales' },
  { key: 'city_sales', label: 'City Wise Sales' }
]

const FUNNEL_COLORS = ['#5B8DEF', '#8B93A7', '#F5A623', '#FF6B6B', '#F5A623', '#9B7FE0', '#9B7FE0', '#2DD9C4', '#6B7280', '#6B7280']

export default function ReportsHub() {
  const { profile } = useAuth()
  const canView = ['admin', 'subadmin'].includes(profile?.role)
  const [tab, setTab] = useState('date_wise')
  const [users, setUsers] = useState([])

  useEffect(() => {
    if (!canView) return
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['sales', 'bde', 'calling'])
      .order('full_name')
      .then(({ data }) => setUsers(data || []))
  }, [canView])

  if (!canView) {
    return (
      <div>
        <h1>Reports Hub</h1>
        <p className="reports-subtitle">This page is only available to Admin and Subadmin.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="reports-header">
        <div>
          <h1>Reports Hub</h1>
          <p className="reports-subtitle">Detailed date-wise, user-wise and sales reports</p>
        </div>
      </div>

      <div className="rh-tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={'rh-tab' + (tab === t.key ? ' active' : '')}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'date_wise' && <DateWiseReport />}
      {tab === 'user_activity' && <UserActivityReport users={users} />}
      {tab === 'lead_assignment' && <LeadAssignmentReport users={users} />}
      {tab === 'monthly_sales' && <MonthlySalesReport />}
      {tab === 'yearly_sales' && <YearlySalesReport />}
      {tab === 'product_sales' && <ProductSalesReport />}
      {tab === 'customer_sales' && <CustomerSalesReport />}
      {tab === 'salesman_sales' && <SalesmanSalesReport users={users} />}
      {tab === 'sales_funnel' && <SalesFunnelReport />}
      {tab === 'industry_sales' && <IndustrySalesReport />}
      {tab === 'city_sales' && <CitySalesReport />}
    </div>
  )
}

// ============================================================
// 1. Date Wise Report (Daily / Weekly / Monthly / Custom Range)
// ============================================================
function DateWiseReport() {
  const [granularity, setGranularity] = useState('daily')
  const [fromDate, setFromDate] = useState(firstDayOfMonth())
  const [toDate, setToDate] = useState(todayStr())
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [statModal, setStatModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const rangeStart = new Date(fromDate + 'T00:00:00').toISOString()
    const rangeEnd = new Date(toDate + 'T23:59:59').toISOString()

    const [leadsRes, callsRes, followsRes, ordersRes] = await Promise.all([
      supabase.from('leads').select('id, lead_name, company, status, created_at').gte('created_at', rangeStart).lte('created_at', rangeEnd),
      supabase.from('call_history').select('id, call_date').gte('call_date', rangeStart).lte('call_date', rangeEnd),
      supabase.from('followup_history').select('id, followup_date').gte('followup_date', rangeStart).lte('followup_date', rangeEnd),
      supabase.from('orders').select('id, order_value, order_date').neq('status', 'cancelled').gte('order_date', fromDate).lte('order_date', toDate)
    ])

    const leads = leadsRes.data || []
    const calls = callsRes.data || []
    const follows = followsRes.data || []
    const orders = ordersRes.data || []

    function bucketKey(dateVal) {
      const d = new Date(dateVal)
      if (granularity === 'monthly') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
      if (granularity === 'weekly') return toDateStr(startOfWeek(d))
      return toDateStr(d)
    }
    function bucketLabel(key) {
      if (granularity === 'monthly') {
        const [y, m] = key.split('-')
        return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
      }
      if (granularity === 'weekly') {
        const start = new Date(key)
        const end = new Date(start)
        end.setDate(end.getDate() + 6)
        return `${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
      }
      return new Date(key).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    const map = new Map()
    function ensure(key) {
      if (!map.has(key)) map.set(key, { key, label: bucketLabel(key), leads: 0, calls: 0, follows: 0, won: 0, sales: 0, leadItems: [] })
      return map.get(key)
    }

    leads.forEach((l) => {
      const b = ensure(bucketKey(l.created_at))
      b.leads += 1
      b.leadItems.push(l)
      if (l.status === WON) b.won += 1
    })
    calls.forEach((c) => { ensure(bucketKey(c.call_date)).calls += 1 })
    follows.forEach((f) => { ensure(bucketKey(f.followup_date)).follows += 1 })
    orders.forEach((o) => { ensure(bucketKey(o.order_date)).sales += Number(o.order_value) || 0 })

    setRows([...map.values()].sort((a, b) => a.key.localeCompare(b.key)))
    setLoading(false)
  }, [granularity, fromDate, toDate])

  useEffect(() => { load() }, [load])

  function handleExport() {
    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Period', 'Leads Added', 'Calls Done', 'Follow-ups Done', 'Won Deals', 'Sales Value'],
      ...rows.map((r) => [r.label, r.leads, r.calls, r.follows, r.won, r.sales])
    ])
    XLSX.utils.book_append_sheet(wb, sheet, 'Date Wise')
    XLSX.writeFile(wb, `date_wise_report_${fromDate}_to_${toDate}.xlsx`)
  }

  return (
    <div>
      <div className="reports-filters">
        <div className="field">
          <label>Granularity</label>
          <select className="text-input" value={granularity} onChange={(e) => setGranularity(e.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="field"><label>From</label><input className="text-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
        <div className="field"><label>To</label><input className="text-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
        <div className="field">
          <label>Quick Range</label>
          <div className="rh-preset-btns">
            <button type="button" className="btn-ghost" onClick={() => { setFromDate(todayStr()); setToDate(todayStr()) }}>Today</button>
            <button type="button" className="btn-ghost" onClick={() => { setFromDate(toDateStr(startOfWeek(new Date()))); setToDate(todayStr()) }}>This Week</button>
            <button type="button" className="btn-ghost" onClick={() => { setFromDate(firstDayOfMonth()); setToDate(todayStr()) }}>This Month</button>
          </div>
        </div>
        <div className="field rh-export-field">
          <label>&nbsp;</label>
          <button className="btn-primary" onClick={handleExport} disabled={loading || rows.length === 0}>Export to Excel</button>
        </div>
      </div>

      {loading ? (
        <p className="reports-note">Loading report…</p>
      ) : rows.length === 0 ? (
        <p className="reports-note">No activity in this period.</p>
      ) : (
        <>
          <div className="panel-card rh-mb">
            <h3>Leads Added &amp; Sales Value Trend</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--text-secondary)" />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v, name) => (name === 'Sales (₹)' ? money(v) : v)} />
                <Legend />
                <Bar yAxisId="left" dataKey="leads" name="Leads Added" fill="#5B8DEF" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="sales" name="Sales (₹)" fill="#2DBE7E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel-card">
            <h3>Period-wise Breakdown</h3>
            <div className="rh-scroll-table mobile-card-table">
              <table className="reports-table">
                <thead><tr><th>Period</th><th>Leads Added</th><th>Calls Done</th><th>Follow-ups Done</th><th>Won Deals</th><th>Sales Value</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td data-label="Period">{r.label}</td>
                      <td data-label="Leads Added"><button className="reports-count-link" onClick={() => setStatModal({ title: `Leads — ${r.label}`, kind: 'leads', items: r.leadItems })}>{r.leads}</button></td>
                      <td data-label="Calls Done">{r.calls}</td>
                      <td data-label="Follow-ups Done">{r.follows}</td>
                      <td data-label="Won Deals">{r.won}</td>
                      <td data-label="Sales Value">{money(r.sales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {statModal && <StatDetailModal title={statModal.title} kind={statModal.kind} items={statModal.items} onClose={() => setStatModal(null)} />}
    </div>
  )
}

// ============================================================
// 2. User Wise Activity Report
// ============================================================
function UserActivityReport({ users }) {
  const [fromDate, setFromDate] = useState(firstDayOfMonth())
  const [toDate, setToDate] = useState(todayStr())
  const [userFilter, setUserFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [statModal, setStatModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const rangeStart = new Date(fromDate + 'T00:00:00').toISOString()
    const rangeEnd = new Date(toDate + 'T23:59:59').toISOString()

    const [leadsRes, callsRes, followsRes, quotesRes] = await Promise.all([
      supabase.from('leads').select('id, lead_name, company, status, created_by, assigned_to, created_at').gte('created_at', rangeStart).lte('created_at', rangeEnd),
      supabase.from('call_history').select('id, created_by, call_date').gte('call_date', rangeStart).lte('call_date', rangeEnd),
      supabase.from('followup_history').select('id, created_by, followup_date, action_type').gte('followup_date', rangeStart).lte('followup_date', rangeEnd),
      supabase.from('quotations').select('id, created_by, created_at').gte('created_at', rangeStart).lte('created_at', rangeEnd)
    ])

    const leads = leadsRes.data || []
    const calls = callsRes.data || []
    const follows = followsRes.data || []
    const quotes = quotesRes.data || []
    const activeUsers = userFilter ? users.filter((u) => u.id === userFilter) : users

    const computed = activeUsers.map((u) => {
      const leadsAdded = leads.filter((l) => l.created_by === u.id)
      const wonAssigned = leads.filter((l) => l.assigned_to === u.id && l.status === WON)
      const lostAssigned = leads.filter((l) => l.assigned_to === u.id && l.status === LOST)
      const callsDone = calls.filter((c) => c.created_by === u.id)
      const followsDone = follows.filter((f) => f.created_by === u.id)
      const meetings = followsDone.filter((f) => f.action_type === 'meeting')
      const quotationsMade = quotes.filter((q) => q.created_by === u.id)
      return {
        ...u,
        leadsAdded: leadsAdded.length, leadsAddedItems: leadsAdded,
        calls: callsDone.length,
        follows: followsDone.length,
        meetings: meetings.length,
        quotations: quotationsMade.length,
        won: wonAssigned.length, wonItems: wonAssigned,
        lost: lostAssigned.length, lostItems: lostAssigned
      }
    })

    setRows(computed)
    setLoading(false)
  }, [fromDate, toDate, userFilter, users])

  useEffect(() => { load() }, [load])

  const totalLeadsAdded = rows.reduce((s, r) => s + r.leadsAdded, 0)
  const totalCalls = rows.reduce((s, r) => s + r.calls, 0)
  const totalFollows = rows.reduce((s, r) => s + r.follows, 0)
  const totalWon = rows.reduce((s, r) => s + r.won, 0)
  const conversion = totalLeadsAdded ? Math.round((totalWon / totalLeadsAdded) * 100) : 0

  function handleExport() {
    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['User', 'Role', 'Leads Added', 'Calls Done', 'Follow-ups Done', 'Meetings', 'Quotations', 'Won Deals', 'Lost Deals'],
      ...rows.map((r) => [r.full_name, ROLE_LABELS[r.role], r.leadsAdded, r.calls, r.follows, r.meetings, r.quotations, r.won, r.lost])
    ])
    XLSX.utils.book_append_sheet(wb, sheet, 'User Activity')
    XLSX.writeFile(wb, `user_activity_report_${fromDate}_to_${toDate}.xlsx`)
  }

  return (
    <div>
      <div className="reports-filters">
        <div className="field"><label>From</label><input className="text-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
        <div className="field"><label>To</label><input className="text-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
        <div className="field">
          <label>User</label>
          <select className="text-input" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="">All Users</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>
        <div className="field rh-export-field">
          <label>&nbsp;</label>
          <button className="btn-primary" onClick={handleExport} disabled={loading || rows.length === 0}>Export to Excel</button>
        </div>
      </div>

      {loading ? <p className="reports-note">Loading report…</p> : (
        <>
          <div className="stat-grid">
            <div className="stat-card"><span className="stat-value">{totalLeadsAdded}</span><span className="stat-label">Total Leads Added</span></div>
            <div className="stat-card"><span className="stat-value">{totalCalls}</span><span className="stat-label">Total Calls</span></div>
            <div className="stat-card"><span className="stat-value">{totalFollows}</span><span className="stat-label">Total Follow-ups</span></div>
            <div className="stat-card good"><span className="stat-value">{totalWon}</span><span className="stat-label">Total Won Deals</span></div>
            <div className="stat-card"><span className="stat-value">{conversion}%</span><span className="stat-label">Conversion Rate</span></div>
          </div>

          <div className="panel-card">
            <h3>User-wise Activity</h3>
            {rows.length === 0 ? <p className="reports-note">No activity in this period.</p> : (
              <div className="rh-scroll-table mobile-card-table">
                <table className="reports-table">
                  <thead><tr><th>User</th><th>Role</th><th>Leads Added</th><th>Calls Done</th><th>Follow-ups</th><th>Meetings</th><th>Quotations</th><th>Won</th><th>Lost</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td data-label="User">{r.full_name}</td>
                        <td data-label="Role">{ROLE_LABELS[r.role]}</td>
                        <td data-label="Leads Added"><button className="reports-count-link" onClick={() => setStatModal({ title: `${r.full_name} — Leads Added`, kind: 'leads', items: r.leadsAddedItems })}>{r.leadsAdded}</button></td>
                        <td data-label="Calls Done">{r.calls}</td>
                        <td data-label="Follow-ups">{r.follows}</td>
                        <td data-label="Meetings">{r.meetings}</td>
                        <td data-label="Quotations">{r.quotations}</td>
                        <td data-label="Won"><button className="reports-count-link" onClick={() => setStatModal({ title: `${r.full_name} — Won Deals`, kind: 'leads', items: r.wonItems })}>{r.won}</button></td>
                        <td data-label="Lost"><button className="reports-count-link" onClick={() => setStatModal({ title: `${r.full_name} — Lost Deals`, kind: 'leads', items: r.lostItems })}>{r.lost}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {statModal && <StatDetailModal title={statModal.title} kind={statModal.kind} items={statModal.items} onClose={() => setStatModal(null)} />}
    </div>
  )
}

// ============================================================
// 3. Lead Assignment Report
// ============================================================
function LeadAssignmentReport({ users }) {
  const [fromDate, setFromDate] = useState(firstDayOfMonth())
  const [toDate, setToDate] = useState(todayStr())
  const [userFilter, setUserFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState([])
  const [statModal, setStatModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const rangeStart = new Date(fromDate + 'T00:00:00').toISOString()
    const rangeEnd = new Date(toDate + 'T23:59:59').toISOString()

    let query = supabase
      .from('leads')
      .select('id, lead_name, company, status, source, assigned_to, assigned_at, created_at, assigned_profile:profiles!leads_assigned_to_fkey(id, full_name)')
      .not('assigned_to', 'is', null)
      .gte('assigned_at', rangeStart)
      .lte('assigned_at', rangeEnd)
      .order('assigned_at', { ascending: false })

    if (userFilter) query = query.eq('assigned_to', userFilter)

    const { data } = await query
    setLeads(data || [])
    setLoading(false)
  }, [fromDate, toDate, userFilter])

  useEffect(() => { load() }, [load])

  const total = leads.length
  const won = leads.filter((l) => l.status === WON).length
  const lost = leads.filter((l) => l.status === LOST).length
  const conversion = total ? Math.round((won / total) * 100) : 0

  const byUser = users
    .map((u) => {
      const theirs = leads.filter((l) => l.assigned_to === u.id)
      const w = theirs.filter((l) => l.status === WON)
      const l2 = theirs.filter((l) => l.status === LOST)
      return { ...u, total: theirs.length, won: w.length, lost: l2.length, conv: theirs.length ? Math.round((w.length / theirs.length) * 100) : 0, items: theirs, wonItems: w }
    })
    .filter((u) => u.total > 0)
    .sort((a, b) => b.total - a.total)

  const bySource = SOURCE_OPTIONS
    .map((s) => {
      const matching = leads.filter((l) => l.source === s.value)
      const w = matching.filter((l) => l.status === WON)
      return { label: s.label, assigned: matching.length, won: w.length, conv: matching.length ? Math.round((w.length / matching.length) * 100) : 0, items: matching }
    })
    .filter((s) => s.assigned > 0)
    .sort((a, b) => b.assigned - a.assigned)

  function handleExport() {
    const wb = XLSX.utils.book_new()
    const mainSheet = XLSX.utils.aoa_to_sheet([
      ['Lead', 'Company', 'Assigned To', 'Assigned Date', 'Status'],
      ...leads.map((l) => [l.lead_name, l.company || '—', l.assigned_profile?.full_name || '—', l.assigned_at ? new Date(l.assigned_at).toLocaleDateString('en-IN') : '—', statusMeta(l.status).label])
    ])
    XLSX.utils.book_append_sheet(wb, mainSheet, 'Assignments')

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['User', 'Total Assigned', 'Won', 'Lost', 'Conversion'],
      ...byUser.map((u) => [u.full_name, u.total, u.won, u.lost, `${u.conv}%`])
    ])
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary by User')

    const sourceSheet = XLSX.utils.aoa_to_sheet([
      ['Source', 'Assigned', 'Won', 'Conversion'],
      ...bySource.map((s) => [s.label, s.assigned, s.won, `${s.conv}%`])
    ])
    XLSX.utils.book_append_sheet(wb, sourceSheet, 'Advanced (Source-wise)')

    XLSX.writeFile(wb, `lead_assignment_report_${fromDate}_to_${toDate}.xlsx`)
  }

  return (
    <div>
      <div className="reports-filters">
        <div className="field"><label>From</label><input className="text-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
        <div className="field"><label>To</label><input className="text-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
        <div className="field">
          <label>Assigned To</label>
          <select className="text-input" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="">All Users</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>
        <div className="field rh-export-field">
          <label>&nbsp;</label>
          <button className="btn-primary" onClick={handleExport} disabled={loading || leads.length === 0}>Export to Excel</button>
        </div>
      </div>

      {loading ? <p className="reports-note">Loading report…</p> : (
        <>
          <div className="stat-grid">
            <div className="stat-card"><span className="stat-value">{total}</span><span className="stat-label">Total Assigned</span></div>
            <div className="stat-card good"><span className="stat-value">{won}</span><span className="stat-label">Won</span></div>
            <div className="stat-card warn"><span className="stat-value">{lost}</span><span className="stat-label">Lost</span></div>
            <div className="stat-card"><span className="stat-value">{conversion}%</span><span className="stat-label">Conversion Rate</span></div>
          </div>

          <div className="panel-card rh-mb">
            <h3>Assignment Detail</h3>
            {leads.length === 0 ? <p className="reports-note">No leads assigned in this period.</p> : (
              <div className="rh-scroll-table mobile-card-table">
                <table className="reports-table">
                  <thead><tr><th>Lead</th><th>Company</th><th>Assigned To</th><th>Assigned Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {leads.map((l) => {
                      const meta = statusMeta(l.status)
                      return (
                        <tr key={l.id}>
                          <td data-label="Lead">{l.lead_name}</td>
                          <td data-label="Company">{l.company || '—'}</td>
                          <td data-label="Assigned To">{l.assigned_profile?.full_name || '—'}</td>
                          <td data-label="Assigned Date">{l.assigned_at ? new Date(l.assigned_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                          <td data-label="Status"><span className="status-badge" style={{ '--badge-color': meta.color }}>{meta.label}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="reports-panels">
            <div className="panel-card">
              <h3>Summary by User</h3>
              {byUser.length === 0 ? <p className="reports-note">No data.</p> : (
                <div className="mobile-card-table">
                <table className="reports-table">
                  <thead><tr><th>User</th><th>Assigned</th><th>Won</th><th>Lost</th><th>Conv.</th></tr></thead>
                  <tbody>
                    {byUser.map((u) => (
                      <tr key={u.id}>
                        <td data-label="User">{u.full_name}</td>
                        <td data-label="Assigned"><button className="reports-count-link" onClick={() => setStatModal({ title: `${u.full_name} — Assigned`, kind: 'leads', items: u.items })}>{u.total}</button></td>
                        <td data-label="Won"><button className="reports-count-link" onClick={() => setStatModal({ title: `${u.full_name} — Won`, kind: 'leads', items: u.wonItems })}>{u.won}</button></td>
                        <td data-label="Lost">{u.lost}</td>
                        <td data-label="Conv.">{u.conv}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>

            <div className="panel-card">
              <h3>Advanced Report — Source-wise</h3>
              {bySource.length === 0 ? <p className="reports-note">No data.</p> : (
                <div className="mobile-card-table">
                <table className="reports-table">
                  <thead><tr><th>Source</th><th>Assigned</th><th>Won</th><th>Conv.</th></tr></thead>
                  <tbody>
                    {bySource.map((s) => (
                      <tr key={s.label}>
                        <td data-label="Source">{s.label}</td>
                        <td data-label="Assigned"><button className="reports-count-link" onClick={() => setStatModal({ title: `${s.label} — Assigned`, kind: 'leads', items: s.items })}>{s.assigned}</button></td>
                        <td data-label="Won">{s.won}</td>
                        <td data-label="Conv.">{s.conv}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {statModal && <StatDetailModal title={statModal.title} kind={statModal.kind} items={statModal.items} onClose={() => setStatModal(null)} />}
    </div>
  )
}

// ============================================================
// 4. Monthly Sales Report
// ============================================================
function MonthlySalesReport() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [statModal, setStatModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, company, order_value, status, order_date, lead:leads(lead_name)')
      .neq('status', 'cancelled')
      .gte('order_date', `${year}-01-01`)
      .lte('order_date', `${year}-12-31`)
    setOrders(data || [])
    setLoading(false)
  }, [year])

  useEffect(() => { load() }, [load])

  const rows = Array.from({ length: 12 }, (_, m) => {
    const items = orders.filter((o) => new Date(o.order_date).getMonth() === m)
    const sales = items.reduce((s, o) => s + (Number(o.order_value) || 0), 0)
    return { key: m, label: new Date(year, m, 1).toLocaleDateString('en-IN', { month: 'short' }), count: items.length, sales, avg: items.length ? sales / items.length : 0, items }
  })

  const totalSales = rows.reduce((s, r) => s + r.sales, 0)
  const totalOrders = rows.reduce((s, r) => s + r.count, 0)

  function handleExport() {
    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Month', 'Orders', 'Sales Value', 'Avg Order Value'],
      ...rows.map((r) => [`${r.label} ${year}`, r.count, r.sales, Math.round(r.avg)])
    ])
    XLSX.utils.book_append_sheet(wb, sheet, 'Monthly Sales')
    XLSX.writeFile(wb, `monthly_sales_report_${year}.xlsx`)
  }

  const curY = new Date().getFullYear()
  const yearOptions = []
  for (let y = curY; y >= curY - 4; y--) yearOptions.push(y)

  return (
    <div>
      <div className="reports-filters">
        <div className="field">
          <label>Year</label>
          <select className="text-input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="field rh-export-field">
          <label>&nbsp;</label>
          <button className="btn-primary" onClick={handleExport} disabled={loading || totalOrders === 0}>Export to Excel</button>
        </div>
      </div>

      {loading ? <p className="reports-note">Loading report…</p> : (
        <>
          <div className="stat-grid">
            <div className="stat-card"><span className="stat-value">{totalOrders}</span><span className="stat-label">Total Orders</span></div>
            <div className="stat-card good"><span className="stat-value">{money(totalSales)}</span><span className="stat-label">Total Sales Value</span></div>
            <div className="stat-card"><span className="stat-value">{money(totalOrders ? totalSales / totalOrders : 0)}</span><span className="stat-label">Avg Order Value</span></div>
          </div>

          <div className="panel-card rh-mb">
            <h3>Monthly Sales — {year}</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--text-secondary)" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="sales" name="Sales (₹)" fill="#5B8DEF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel-card">
            <h3>Month-wise Breakdown</h3>
            <div className="mobile-card-table">
            <table className="reports-table">
              <thead><tr><th>Month</th><th>Orders</th><th>Sales Value</th><th>Avg Order Value</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td data-label="Month">{r.label} {year}</td>
                    <td data-label="Orders"><button className="reports-count-link" onClick={() => setStatModal({ title: `Orders — ${r.label} ${year}`, kind: 'orders', items: r.items })}>{r.count}</button></td>
                    <td data-label="Sales Value">{money(r.sales)}</td>
                    <td data-label="Avg Order Value">{money(r.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}

      {statModal && <StatDetailModal title={statModal.title} kind={statModal.kind} items={statModal.items} onClose={() => setStatModal(null)} />}
    </div>
  )
}

// ============================================================
// 5. Yearly Sales Report (with Growth %)
// ============================================================
function YearlySalesReport() {
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [statModal, setStatModal] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, company, order_value, status, order_date')
        .neq('status', 'cancelled')
      setOrders(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const years = [...new Set(orders.map((o) => new Date(o.order_date).getFullYear()))].sort((a, b) => a - b)

  const rows = years.map((y, idx) => {
    const items = orders.filter((o) => new Date(o.order_date).getFullYear() === y)
    const sales = items.reduce((s, o) => s + (Number(o.order_value) || 0), 0)
    let growth = null
    if (idx > 0) {
      const prevItems = orders.filter((o) => new Date(o.order_date).getFullYear() === years[idx - 1])
      const prevTotal = prevItems.reduce((s, o) => s + (Number(o.order_value) || 0), 0)
      growth = prevTotal > 0 ? Math.round(((sales - prevTotal) / prevTotal) * 100) : null
    }
    return { year: y, count: items.length, sales, growth, items }
  })

  function handleExport() {
    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Year', 'Orders', 'Sales Value', 'Growth %'],
      ...rows.map((r) => [r.year, r.count, r.sales, r.growth === null ? '—' : `${r.growth}%`])
    ])
    XLSX.utils.book_append_sheet(wb, sheet, 'Yearly Sales')
    XLSX.writeFile(wb, 'yearly_sales_report.xlsx')
  }

  return (
    <div>
      <div className="reports-filters">
        <div className="field rh-export-field">
          <label>&nbsp;</label>
          <button className="btn-primary" onClick={handleExport} disabled={loading || rows.length === 0}>Export to Excel</button>
        </div>
      </div>

      {loading ? <p className="reports-note">Loading report…</p> : rows.length === 0 ? (
        <p className="reports-note">No order data yet.</p>
      ) : (
        <>
          <div className="panel-card rh-mb">
            <h3>Yearly Sales Trend</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--text-secondary)" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="sales" name="Sales (₹)" fill="#9B7FE0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel-card">
            <h3>Year-wise Breakdown</h3>
            <div className="mobile-card-table">
            <table className="reports-table">
              <thead><tr><th>Year</th><th>Orders</th><th>Sales Value</th><th>Growth %</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year}>
                    <td data-label="Year">{r.year}</td>
                    <td data-label="Orders"><button className="reports-count-link" onClick={() => setStatModal({ title: `Orders — ${r.year}`, kind: 'orders', items: r.items })}>{r.count}</button></td>
                    <td data-label="Sales Value">{money(r.sales)}</td>
                    <td data-label="Growth %">
                      {r.growth === null ? '—' : (
                        <span className={'rh-growth' + (r.growth >= 0 ? ' up' : ' down')}>
                          {r.growth >= 0 ? '▲' : '▼'} {Math.abs(r.growth)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}

      {statModal && <StatDetailModal title={statModal.title} kind={statModal.kind} items={statModal.items} onClose={() => setStatModal(null)} />}
    </div>
  )
}

// ============================================================
// 6. Product Wise Sales Report (with Contribution %)
// ============================================================
function ProductSalesReport() {
  const [fromDate, setFromDate] = useState(firstDayOfMonth())
  const [toDate, setToDate] = useState(todayStr())
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [statModal, setStatModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [productsRes, ordersRes] = await Promise.all([
      supabase.from('products').select('id, product_name').order('product_name'),
      supabase
        .from('orders')
        .select('id, order_number, company, order_value, status, order_date, lead:leads(lead_name, product_id)')
        .neq('status', 'cancelled')
        .gte('order_date', fromDate)
        .lte('order_date', toDate)
    ])
    setProducts(productsRes.data || [])
    setOrders(ordersRes.data || [])
    setLoading(false)
  }, [fromDate, toDate])

  useEffect(() => { load() }, [load])

  const totalSales = orders.reduce((s, o) => s + (Number(o.order_value) || 0), 0)

  const rows = [
    ...products.map((p) => {
      const items = orders.filter((o) => o.lead?.product_id === p.id)
      const sales = items.reduce((s, o) => s + (Number(o.order_value) || 0), 0)
      return { name: p.product_name, count: items.length, sales, contribution: totalSales ? Math.round((sales / totalSales) * 100) : 0, items }
    }),
    (() => {
      const items = orders.filter((o) => !o.lead?.product_id)
      const sales = items.reduce((s, o) => s + (Number(o.order_value) || 0), 0)
      return { name: 'No Product Assigned', count: items.length, sales, contribution: totalSales ? Math.round((sales / totalSales) * 100) : 0, items }
    })()
  ].filter((r) => r.count > 0).sort((a, b) => b.sales - a.sales)

  function handleExport() {
    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Product', 'Orders', 'Sales Value', 'Contribution %'],
      ...rows.map((r) => [r.name, r.count, r.sales, `${r.contribution}%`])
    ])
    XLSX.utils.book_append_sheet(wb, sheet, 'Product Sales')
    XLSX.writeFile(wb, `product_sales_report_${fromDate}_to_${toDate}.xlsx`)
  }

  return (
    <div>
      <div className="reports-filters">
        <div className="field"><label>From</label><input className="text-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
        <div className="field"><label>To</label><input className="text-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
        <div className="field rh-export-field">
          <label>&nbsp;</label>
          <button className="btn-primary" onClick={handleExport} disabled={loading || rows.length === 0}>Export to Excel</button>
        </div>
      </div>

      {loading ? <p className="reports-note">Loading report…</p> : rows.length === 0 ? (
        <p className="reports-note">No sales in this period.</p>
      ) : (
        <>
          <div className="panel-card rh-mb">
            <h3>Sales by Product</h3>
            <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 42)}>
              <BarChart data={rows} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="var(--text-secondary)" width={150} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="sales" name="Sales (₹)" fill="#F5A623" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel-card">
            <h3>Product-wise Breakdown</h3>
            <div className="mobile-card-table">
            <table className="reports-table">
              <thead><tr><th>Product</th><th>Orders</th><th>Sales Value</th><th>Contribution</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td data-label="Product">{r.name}</td>
                    <td data-label="Orders"><button className="reports-count-link" onClick={() => setStatModal({ title: `Orders — ${r.name}`, kind: 'orders', items: r.items })}>{r.count}</button></td>
                    <td data-label="Sales Value">{money(r.sales)}</td>
                    <td data-label="Contribution">{r.contribution}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}

      {statModal && <StatDetailModal title={statModal.title} kind={statModal.kind} items={statModal.items} onClose={() => setStatModal(null)} />}
    </div>
  )
}

// ============================================================
// 7. Customer Wise Sales Report (with Outstanding)
// ============================================================
function CustomerSalesReport() {
  const [fromDate, setFromDate] = useState(firstDayOfMonth())
  const [toDate, setToDate] = useState(todayStr())
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [statModal, setStatModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, company, order_value, paid_amount, payment_status, status, order_date, lead:leads(lead_name, company)')
      .neq('status', 'cancelled')
      .gte('order_date', fromDate)
      .lte('order_date', toDate)
    setOrders(data || [])
    setLoading(false)
  }, [fromDate, toDate])

  useEffect(() => { load() }, [load])

  const byCustomer = new Map()
  orders.forEach((o) => {
    const name = o.company || o.lead?.company || o.lead?.lead_name || 'Unknown Customer'
    if (!byCustomer.has(name)) byCustomer.set(name, { name, count: 0, sales: 0, outstanding: 0, items: [] })
    const c = byCustomer.get(name)
    c.count += 1
    c.sales += Number(o.order_value) || 0
    c.outstanding += Math.max(0, Number(o.order_value || 0) - Number(o.paid_amount || 0))
    c.items.push(o)
  })
  const rows = [...byCustomer.values()].sort((a, b) => b.sales - a.sales)

  const totalSales = rows.reduce((s, r) => s + r.sales, 0)
  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0)

  function handleExport() {
    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Customer', 'Orders', 'Sales Value', 'Outstanding'],
      ...rows.map((r) => [r.name, r.count, r.sales, r.outstanding])
    ])
    XLSX.utils.book_append_sheet(wb, sheet, 'Customer Sales')
    XLSX.writeFile(wb, `customer_sales_report_${fromDate}_to_${toDate}.xlsx`)
  }

  return (
    <div>
      <div className="reports-filters">
        <div className="field"><label>From</label><input className="text-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
        <div className="field"><label>To</label><input className="text-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
        <div className="field rh-export-field">
          <label>&nbsp;</label>
          <button className="btn-primary" onClick={handleExport} disabled={loading || rows.length === 0}>Export to Excel</button>
        </div>
      </div>

      {loading ? <p className="reports-note">Loading report…</p> : rows.length === 0 ? (
        <p className="reports-note">No orders in this period.</p>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card"><span className="stat-value">{rows.length}</span><span className="stat-label">Customers</span></div>
            <div className="stat-card good"><span className="stat-value">{money(totalSales)}</span><span className="stat-label">Total Sales Value</span></div>
            <div className="stat-card warn"><span className="stat-value">{money(totalOutstanding)}</span><span className="stat-label">Total Outstanding</span></div>
          </div>

          <div className="panel-card">
            <h3>Customer-wise Breakdown</h3>
            <div className="rh-scroll-table mobile-card-table">
              <table className="reports-table">
                <thead><tr><th>Customer</th><th>Orders</th><th>Sales Value</th><th>Outstanding</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name}>
                      <td data-label="Customer">{r.name}</td>
                      <td data-label="Orders"><button className="reports-count-link" onClick={() => setStatModal({ title: `Orders — ${r.name}`, kind: 'orders', items: r.items })}>{r.count}</button></td>
                      <td data-label="Sales Value">{money(r.sales)}</td>
                      <td data-label="Outstanding">{r.outstanding > 0 ? <span className="rh-growth down">{money(r.outstanding)}</span> : money(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {statModal && <StatDetailModal title={statModal.title} kind={statModal.kind} items={statModal.items} onClose={() => setStatModal(null)} />}
    </div>
  )
}

// ============================================================
// 8. Salesman Wise Sales Report
// ============================================================
function SalesmanSalesReport({ users }) {
  const [fromDate, setFromDate] = useState(firstDayOfMonth())
  const [toDate, setToDate] = useState(todayStr())
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [statModal, setStatModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, company, order_value, status, order_date, lead:leads(lead_name, assigned_to)')
      .neq('status', 'cancelled')
      .gte('order_date', fromDate)
      .lte('order_date', toDate)
    setOrders(data || [])
    setLoading(false)
  }, [fromDate, toDate])

  useEffect(() => { load() }, [load])

  const rows = users
    .map((u) => {
      const items = orders.filter((o) => o.lead?.assigned_to === u.id)
      const sales = items.reduce((s, o) => s + (Number(o.order_value) || 0), 0)
      return { ...u, count: items.length, sales, avg: items.length ? sales / items.length : 0, items }
    })
    .filter((u) => u.count > 0)
    .sort((a, b) => b.sales - a.sales)

  const unassignedItems = orders.filter((o) => !o.lead?.assigned_to)
  if (unassignedItems.length > 0) {
    rows.push({
      id: 'unassigned', full_name: 'Unassigned', role: '',
      count: unassignedItems.length,
      sales: unassignedItems.reduce((s, o) => s + (Number(o.order_value) || 0), 0),
      avg: 0, items: unassignedItems
    })
  }

  const totalSales = rows.reduce((s, r) => s + r.sales, 0)
  const totalOrders = rows.reduce((s, r) => s + r.count, 0)

  function handleExport() {
    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Salesman', 'Orders', 'Sales Value', 'Avg Deal Size'],
      ...rows.map((r) => [r.full_name, r.count, r.sales, Math.round(r.avg)])
    ])
    XLSX.utils.book_append_sheet(wb, sheet, 'Salesman Sales')
    XLSX.writeFile(wb, `salesman_sales_report_${fromDate}_to_${toDate}.xlsx`)
  }

  return (
    <div>
      <div className="reports-filters">
        <div className="field"><label>From</label><input className="text-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
        <div className="field"><label>To</label><input className="text-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
        <div className="field rh-export-field">
          <label>&nbsp;</label>
          <button className="btn-primary" onClick={handleExport} disabled={loading || rows.length === 0}>Export to Excel</button>
        </div>
      </div>

      {loading ? <p className="reports-note">Loading report…</p> : rows.length === 0 ? (
        <p className="reports-note">No orders in this period.</p>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card"><span className="stat-value">{totalOrders}</span><span className="stat-label">Total Orders</span></div>
            <div className="stat-card good"><span className="stat-value">{money(totalSales)}</span><span className="stat-label">Total Sales Value</span></div>
          </div>

          <div className="panel-card rh-mb">
            <h3>Sales by Salesman</h3>
            <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 42)}>
              <BarChart data={rows} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="full_name" tick={{ fontSize: 11 }} stroke="var(--text-secondary)" width={130} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="sales" name="Sales (₹)" fill="#2DBE7E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel-card">
            <h3>Salesman-wise Breakdown</h3>
            <div className="mobile-card-table">
            <table className="reports-table">
              <thead><tr><th>Salesman</th><th>Orders</th><th>Sales Value</th><th>Avg Deal Size</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Salesman">{r.full_name}</td>
                    <td data-label="Orders"><button className="reports-count-link" onClick={() => setStatModal({ title: `Orders — ${r.full_name}`, kind: 'orders', items: r.items })}>{r.count}</button></td>
                    <td data-label="Sales Value">{money(r.sales)}</td>
                    <td data-label="Avg Deal Size">{money(r.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}

      {statModal && <StatDetailModal title={statModal.title} kind={statModal.kind} items={statModal.items} onClose={() => setStatModal(null)} />}
    </div>
  )
}

// ============================================================
// 9. Sales Funnel Report (Pipeline Stage Counts)
// ============================================================
function SalesFunnelReport() {
  const [fromDate, setFromDate] = useState(firstDayOfMonth())
  const [toDate, setToDate] = useState(todayStr())
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState([])
  const [statModal, setStatModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const rangeStart = new Date(fromDate + 'T00:00:00').toISOString()
    const rangeEnd = new Date(toDate + 'T23:59:59').toISOString()
    const { data } = await supabase
      .from('leads')
      .select('id, lead_name, company, status, created_at')
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd)
    setLeads(data || [])
    setLoading(false)
  }, [fromDate, toDate])

  useEffect(() => { load() }, [load])

  const total = leads.length
  const rows = STATUS_OPTIONS.map((s) => {
    const items = leads.filter((l) => l.status === s.value)
    return { name: s.label, value: items.length, pct: total ? Math.round((items.length / total) * 100) : 0, items, color: s.color }
  }).filter((r) => r.value > 0)

  function handleExport() {
    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Stage', 'Leads', '% of Total'],
      ...rows.map((r) => [r.name, r.value, `${r.pct}%`])
    ])
    XLSX.utils.book_append_sheet(wb, sheet, 'Sales Funnel')
    XLSX.writeFile(wb, `sales_funnel_report_${fromDate}_to_${toDate}.xlsx`)
  }

  return (
    <div>
      <div className="reports-filters">
        <div className="field"><label>From</label><input className="text-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
        <div className="field"><label>To</label><input className="text-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
        <div className="field rh-export-field">
          <label>&nbsp;</label>
          <button className="btn-primary" onClick={handleExport} disabled={loading || rows.length === 0}>Export to Excel</button>
        </div>
      </div>

      {loading ? <p className="reports-note">Loading report…</p> : rows.length === 0 ? (
        <p className="reports-note">No leads in this period.</p>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card"><span className="stat-value">{total}</span><span className="stat-label">Total Leads in Pipeline</span></div>
          </div>

          <div className="panel-card rh-mb">
            <h3>Pipeline Funnel</h3>
            <ResponsiveContainer width="100%" height={Math.max(260, rows.length * 46)}>
              <BarChart data={rows} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="var(--text-secondary)" width={140} />
                <Tooltip />
                <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]}>
                  {rows.map((r, i) => <Cell key={r.name} fill={r.color || FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel-card">
            <h3>Stage-wise Breakdown</h3>
            <div className="mobile-card-table">
            <table className="reports-table">
              <thead><tr><th>Stage</th><th>Leads</th><th>% of Total</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td data-label="Stage"><span className="status-badge" style={{ '--badge-color': r.color }}>{r.name}</span></td>
                    <td data-label="Leads"><button className="reports-count-link" onClick={() => setStatModal({ title: r.name, kind: 'leads', items: r.items })}>{r.value}</button></td>
                    <td data-label="% of Total">{r.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}

      {statModal && <StatDetailModal title={statModal.title} kind={statModal.kind} items={statModal.items} onClose={() => setStatModal(null)} />}
    </div>
  )
}

// ============================================================
// 10. Industry Wise Sales Report
// ============================================================
function IndustrySalesReport() {
  const [fromDate, setFromDate] = useState(firstDayOfMonth())
  const [toDate, setToDate] = useState(todayStr())
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [statModal, setStatModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, company, order_value, status, order_date, lead:leads(lead_name, industry_type)')
      .neq('status', 'cancelled')
      .gte('order_date', fromDate)
      .lte('order_date', toDate)
    setOrders(data || [])
    setLoading(false)
  }, [fromDate, toDate])

  useEffect(() => { load() }, [load])

  const byIndustry = new Map()
  orders.forEach((o) => {
    const name = o.lead?.industry_type?.trim() || 'Not Specified'
    if (!byIndustry.has(name)) byIndustry.set(name, { name, count: 0, sales: 0, items: [] })
    const c = byIndustry.get(name)
    c.count += 1
    c.sales += Number(o.order_value) || 0
    c.items.push(o)
  })
  const totalSales = orders.reduce((s, o) => s + (Number(o.order_value) || 0), 0)
  const rows = [...byIndustry.values()]
    .map((r) => ({ ...r, contribution: totalSales ? Math.round((r.sales / totalSales) * 100) : 0 }))
    .sort((a, b) => b.sales - a.sales)

  function handleExport() {
    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Industry', 'Orders', 'Sales Value', 'Contribution %'],
      ...rows.map((r) => [r.name, r.count, r.sales, `${r.contribution}%`])
    ])
    XLSX.utils.book_append_sheet(wb, sheet, 'Industry Sales')
    XLSX.writeFile(wb, `industry_wise_sales_report_${fromDate}_to_${toDate}.xlsx`)
  }

  return (
    <div>
      <div className="reports-filters">
        <div className="field"><label>From</label><input className="text-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
        <div className="field"><label>To</label><input className="text-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
        <div className="field rh-export-field">
          <label>&nbsp;</label>
          <button className="btn-primary" onClick={handleExport} disabled={loading || rows.length === 0}>Export to Excel</button>
        </div>
      </div>

      {loading ? <p className="reports-note">Loading report…</p> : rows.length === 0 ? (
        <p className="reports-note">No sales in this period.</p>
      ) : (
        <>
          <div className="panel-card rh-mb">
            <h3>Sales by Industry</h3>
            <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 42)}>
              <BarChart data={rows} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="var(--text-secondary)" width={140} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="sales" name="Sales (₹)" fill="#5B8DEF" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel-card">
            <h3>Industry-wise Breakdown</h3>
            <div className="mobile-card-table">
            <table className="reports-table">
              <thead><tr><th>Industry</th><th>Orders</th><th>Sales Value</th><th>Contribution</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td data-label="Industry">{r.name}</td>
                    <td data-label="Orders"><button className="reports-count-link" onClick={() => setStatModal({ title: `Orders — ${r.name}`, kind: 'orders', items: r.items })}>{r.count}</button></td>
                    <td data-label="Sales Value">{money(r.sales)}</td>
                    <td data-label="Contribution">{r.contribution}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}

      {statModal && <StatDetailModal title={statModal.title} kind={statModal.kind} items={statModal.items} onClose={() => setStatModal(null)} />}
    </div>
  )
}

// ============================================================
// 11. City Wise Sales Report
// ============================================================
function CitySalesReport() {
  const [fromDate, setFromDate] = useState(firstDayOfMonth())
  const [toDate, setToDate] = useState(todayStr())
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [statModal, setStatModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, company, order_value, status, order_date, lead:leads(lead_name, city)')
      .neq('status', 'cancelled')
      .gte('order_date', fromDate)
      .lte('order_date', toDate)
    setOrders(data || [])
    setLoading(false)
  }, [fromDate, toDate])

  useEffect(() => { load() }, [load])

  const byCity = new Map()
  orders.forEach((o) => {
    const name = o.lead?.city?.trim() || 'Not Specified'
    if (!byCity.has(name)) byCity.set(name, { name, count: 0, sales: 0, items: [] })
    const c = byCity.get(name)
    c.count += 1
    c.sales += Number(o.order_value) || 0
    c.items.push(o)
  })
  const totalSales = orders.reduce((s, o) => s + (Number(o.order_value) || 0), 0)
  const rows = [...byCity.values()]
    .map((r) => ({ ...r, contribution: totalSales ? Math.round((r.sales / totalSales) * 100) : 0 }))
    .sort((a, b) => b.sales - a.sales)

  function handleExport() {
    const wb = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['City', 'Orders', 'Sales Value', 'Contribution %'],
      ...rows.map((r) => [r.name, r.count, r.sales, `${r.contribution}%`])
    ])
    XLSX.utils.book_append_sheet(wb, sheet, 'City Sales')
    XLSX.writeFile(wb, `city_wise_sales_report_${fromDate}_to_${toDate}.xlsx`)
  }

  return (
    <div>
      <div className="reports-filters">
        <div className="field"><label>From</label><input className="text-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
        <div className="field"><label>To</label><input className="text-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
        <div className="field rh-export-field">
          <label>&nbsp;</label>
          <button className="btn-primary" onClick={handleExport} disabled={loading || rows.length === 0}>Export to Excel</button>
        </div>
      </div>

      {loading ? <p className="reports-note">Loading report…</p> : rows.length === 0 ? (
        <p className="reports-note">No sales in this period.</p>
      ) : (
        <>
          <div className="panel-card rh-mb">
            <h3>Sales by City</h3>
            <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 42)}>
              <BarChart data={rows} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="var(--text-secondary)" width={120} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="sales" name="Sales (₹)" fill="#2DD9C4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel-card">
            <h3>City-wise Breakdown</h3>
            <div className="mobile-card-table">
            <table className="reports-table">
              <thead><tr><th>City</th><th>Orders</th><th>Sales Value</th><th>Contribution</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td data-label="City">{r.name}</td>
                    <td data-label="Orders"><button className="reports-count-link" onClick={() => setStatModal({ title: `Orders — ${r.name}`, kind: 'orders', items: r.items })}>{r.count}</button></td>
                    <td data-label="Sales Value">{money(r.sales)}</td>
                    <td data-label="Contribution">{r.contribution}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}

      {statModal && <StatDetailModal title={statModal.title} kind={statModal.kind} items={statModal.items} onClose={() => setStatModal(null)} />}
    </div>
  )
}
