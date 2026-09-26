import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { SOURCE_OPTIONS, statusMeta, orderStatusMeta, actionTypeMeta } from '../lib/constants'
import LeadFormModal from '../components/LeadFormModal'
import OrderFormModal from '../components/OrderFormModal'
import StatDetailModal from '../components/StatDetailModal'
import './Dashboard.css'

const SOURCE_COLORS = ['#5B8DEF', '#E5484D', '#0EA99A', '#9B7FE0', '#F5A623', '#6C7390', '#3AA0FF']

const PIPELINE_COLUMNS = [
  { key: 'new', label: 'New Lead', color: '#5B8DEF', statuses: ['new_lead'] },
  { key: 'contacted', label: 'Contacted', color: '#F5A623', statuses: ['contacted'] },
  { key: 'followup', label: 'Follow Up', color: '#9B7FE0', statuses: ['followup_required', 'hot_lead', 'warm_lead'] },
  { key: 'proposal', label: 'Proposal Sent', color: '#3AA0FF', statuses: ['proposal_sent', 'negotiation'] },
  { key: 'won', label: 'Closed Won', color: '#2DBE7E', statuses: ['won_order'] }
]

const IconUsers = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M16 11a4 4 0 1 0-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M2 21c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8"/></svg>)
const IconPhone = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 5c0 8.3 6.7 15 15 15l2-4-5-2-2 2c-2.5-1.2-4.8-3.5-6-6l2-2-2-5-4 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>)
const IconWarn = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 8v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>)
const IconCheck = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>)
const IconRupee = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7 4h10M7 8h10M7 4c4 0 6 1.5 6 4s-2 4-6 4h9M7 12l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>)
const IconCalendar = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M8.5 14l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>)

function dateKey(d) { return d.toISOString().slice(0, 10) }

// Buckets a timestamp by the viewer's LOCAL calendar day (not UTC), so a lead
// created late at night IST still lands on the correct day in the trend chart.
function localDateKey(value) {
  const d = value instanceof Date ? value : new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

// Smoothly animates a numeric stat from 0 up to its target value using an
// eased requestAnimationFrame loop, so the KPI cards feel alive on load
// instead of popping straight to a static number.
function useCountUp(target, duration = 800) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (typeof target !== 'number' || Number.isNaN(target)) return
    let raf
    const startTime = performance.now()
    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(target * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return display
}

function AnimatedStat({ value, format }) {
  const isNumber = typeof value === 'number'
  const animated = useCountUp(isNumber ? value : 0)
  if (!isNumber) return <>{value}</>
  return <>{format ? format(animated) : animated.toLocaleString('en-IN')}</>
}

function EmptyState({ icon, text }) {
  return (
    <div className="dash-empty">
      <span className="dash-empty-icon">{icon}</span>
      <span className="dash-empty-text">{text}</span>
    </div>
  )
}

export default function Dashboard() {
  const { profile, session } = useAuth()
  const navigate = useNavigate()
  const role = profile?.role
  const isManager = ['admin', 'subadmin'].includes(role)
  const canCreate = ['admin', 'subadmin', 'sales'].includes(role)

  const [leads, setLeads] = useState([])
  const [orders, setOrders] = useState([])
  const [activity, setActivity] = useState([])
  const [users, setUsers] = useState([])
  const [products, setProducts] = useState([])
  const [customerCount, setCustomerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [statModal, setStatModal] = useState(null)
  const [followupFilter, setFollowupFilter] = useState('all')
  const [markingDoneId, setMarkingDoneId] = useState(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)

    let leadsQuery = supabase.from('leads').select('id, lead_name, company, mobile, status, source, city, assigned_to, product_id, next_followup_date, next_action_type, next_action_location, created_at')
    if (!isManager && session?.user?.id) leadsQuery = leadsQuery.eq('assigned_to', session.user.id)

    let ordersQuery = supabase
      .from('orders')
      .select('*, lead:leads!orders_lead_id_fkey(lead_name)')
      .order('created_at', { ascending: false })
    if (!isManager && session?.user?.id) ordersQuery = ordersQuery.eq('created_by', session.user.id)

    const [leadsRes, ordersRes, callsRes, followsRes, usersRes, productsRes, customersRes] = await Promise.all([
      leadsQuery,
      ordersQuery,
      supabase
        .from('call_history')
        .select('id, remarks, call_date, lead:leads(lead_name), created_by_profile:profiles(full_name)')
        .order('call_date', { ascending: false })
        .limit(6),
      supabase
        .from('followup_history')
        .select('id, remarks, followup_date, status, lead:leads(lead_name), created_by_profile:profiles(full_name)')
        .order('followup_date', { ascending: false })
        .limit(6),
      isManager
        ? supabase.from('profiles').select('id, full_name, role').in('role', ['sales', 'bde', 'calling']).order('full_name')
        : Promise.resolve({ data: [] }),
      supabase.from('products').select('id, product_name').eq('is_active', true),
      supabase.from('customers').select('id', { count: 'exact', head: true })
    ])

    setLeads(leadsRes.data || [])
    setOrders(ordersRes.data || [])
    setUsers(usersRes.data || [])
    setProducts(productsRes.data || [])
    setCustomerCount(customersRes.count || 0)

    const callItems = (callsRes.data || []).map((c) => ({
      date: c.call_date,
      text: `Call logged with ${c.lead?.lead_name || 'a lead'}${c.created_by_profile?.full_name ? ' by ' + c.created_by_profile.full_name : ''}`
    }))
    const followItems = (followsRes.data || []).map((f) => ({
      date: f.followup_date,
      text: `Follow-up updated for ${f.lead?.lead_name || 'a lead'}${f.created_by_profile?.full_name ? ' by ' + f.created_by_profile.full_name : ''}`
    }))
    const merged = [...callItems, ...followItems].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8)
    setActivity(merged)

    setLoading(false)
  }, [isManager, session])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  if (loading) return <p className="dash-note">Loading dashboard…</p>

  const today = new Date()
  const todayKey = dateKey(today)

  const total = leads.length
  const pending = leads.filter((l) => l.next_followup_date && !['won_order', 'lost_order'].includes(l.status)).length
  const overdue = leads.filter((l) => l.next_followup_date && l.next_followup_date.slice(0, 10) < todayKey && !['won_order', 'lost_order'].includes(l.status)).length
  const won = leads.filter((l) => l.status === 'won_order').length
  const meetingsScheduled = leads.filter(
    (l) => ['meeting', 'visit'].includes(l.next_action_type) && l.next_followup_date && !['won_order', 'lost_order'].includes(l.status)
  ).length
  const totalOrdersValue = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + (Number(o.order_value) || 0), 0)

  const statCards = [
    { label: 'Total Leads', value: total, icon: <IconUsers />, color: '#5B8DEF' },
    { label: 'Follow-ups Pending', value: pending, icon: <IconPhone />, color: '#F5A623' },
    { label: 'Overdue Follow-ups', value: overdue, icon: <IconWarn />, color: '#E5484D' },
    { label: 'Meetings Scheduled', value: meetingsScheduled, icon: <IconCalendar />, color: '#9B7FE0' },
    { label: 'Converted to Order', value: won, icon: <IconCheck />, color: '#2DBE7E' },
    { label: 'Total Orders Value', value: totalOrdersValue, format: (n) => `₹${n.toLocaleString('en-IN')}`, icon: <IconRupee />, color: '#3AA0FF' }
  ]

  // Funnel stages collapsed into 5 clean tapering stages (most CRMs group
  // "Contacted/Follow-up/Hot/Warm" together) so the funnel actually tapers
  // visually instead of showing 10 thin slivers.
  const FUNNEL_STAGES = [
    { key: 'new', label: 'New Lead', color: '#5B8DEF', statuses: ['new_lead'] },
    { key: 'contacted', label: 'Contacted', color: '#3AA0FF', statuses: ['contacted', 'followup_required', 'hot_lead', 'warm_lead'] },
    { key: 'proposal', label: 'Proposal / Negotiation', color: '#9B7FE0', statuses: ['proposal_sent', 'negotiation'] },
    { key: 'won', label: 'Won Order', color: '#2DD9C4', statuses: ['won_order'] }
  ]
  const funnelData = FUNNEL_STAGES
    .map((s) => ({ name: s.label, value: leads.filter((l) => s.statuses.includes(l.status)).length, fill: s.color }))
    .filter((s) => s.value > 0)

  const cityWise = Object.entries(
    leads.reduce((acc, l) => {
      const city = l.city?.trim() || 'Not Specified'
      acc[city] = (acc[city] || 0) + 1
      return acc
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7)

  const recentLeads = [...leads].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6)

  const sourceData = SOURCE_OPTIONS
    .map((s) => ({ name: s.label, value: leads.filter((l) => l.source === s.value).length }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)

  const dueTodayLeads = leads.filter((l) => l.next_followup_date?.slice(0, 10) === todayKey && !['won_order', 'lost_order'].includes(l.status))

  const upcoming = leads
    .filter((l) => l.next_followup_date && !['won_order', 'lost_order'].includes(l.status))
    .sort((a, b) => new Date(a.next_followup_date) - new Date(b.next_followup_date))
    .slice(0, 8)

  const monthDays = buildMonthGrid(today.getFullYear(), today.getMonth())
  const leadsByDay = {}
  leads.filter((l) => l.next_followup_date && !['won_order', 'lost_order'].includes(l.status)).forEach((l) => {
    const key = l.next_followup_date.slice(0, 10)
    if (!leadsByDay[key]) leadsByDay[key] = []
    leadsByDay[key].push(l)
  })

  const trendDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return d
  })
  const trendData = trendDays.map((d) => {
    const key = localDateKey(d)
    const count = leads.filter((l) => l.created_at && localDateKey(l.created_at) === key).length
    return { day: d.toLocaleDateString('en-IN', { weekday: 'short' }), count }
  })
  const trendTotal = trendData.reduce((s, t) => s + t.count, 0)

  const recentOrders = orders.slice(0, 6)

  const topProducts = products
    .map((p) => ({ name: p.product_name, leads: leads.filter((l) => l.product_id === p.id).length }))
    .filter((p) => p.leads > 0)
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5)

  const wonLeads = leads.filter((l) => l.status === 'won_order')
  const pendingLeads = leads.filter((l) => l.next_followup_date && !['won_order', 'lost_order'].includes(l.status))
  const overdueLeads = leads.filter((l) => l.next_followup_date && l.next_followup_date.slice(0, 10) < todayKey && !['won_order', 'lost_order'].includes(l.status))
  const meetingLeads = leads.filter(
    (l) => ['meeting', 'visit'].includes(l.next_action_type) && l.next_followup_date && !['won_order', 'lost_order'].includes(l.status)
  )

  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const followupRows = pendingLeads
    .filter((l) => {
      const d = new Date(l.next_followup_date)
      const key = dateKey(d)
      if (followupFilter === 'today') return key === todayKey
      if (followupFilter === 'overdue') return key < todayKey
      if (followupFilter === 'week') return d >= today && d <= weekEnd
      if (followupFilter === 'month') return d >= today && d <= monthEnd
      return true
    })
    .sort((a, b) => new Date(a.next_followup_date) - new Date(b.next_followup_date))

  async function handleMarkFollowupDone(lead, e) {
    e.stopPropagation()
    setMarkingDoneId(lead.id)
    await supabase.from('followup_history').insert({
      lead_id: lead.id,
      remarks: 'Marked as done from Dashboard',
      status: lead.status,
      created_by: session?.user?.id
    })
    await supabase.from('leads').update({ next_followup_date: null }).eq('id', lead.id)
    await loadDashboard()
    setMarkingDoneId(null)
  }

  function openStatModal(label) {
    if (label === 'Total Leads') setStatModal({ title: 'Total Leads', kind: 'leads', items: leads })
    if (label === 'Follow-ups Pending') setStatModal({ title: 'Follow-ups Pending', kind: 'leads', items: pendingLeads })
    if (label === 'Overdue Follow-ups') setStatModal({ title: 'Overdue Follow-ups', kind: 'leads', items: overdueLeads })
    if (label === 'Meetings Scheduled') setStatModal({ title: 'Meetings & Site Visits', kind: 'leads', items: meetingLeads })
    if (label === 'Converted to Order') setStatModal({ title: 'Converted to Order', kind: 'leads', items: wonLeads })
    if (label === 'Total Orders Value') setStatModal({ title: 'All Orders', kind: 'orders', items: orders })
  }

  return (
    <div>
      <div className="dash-top">
        <div>
          <h1>Dashboard</h1>
          <p className="dash-note">{isManager ? "Here's your team's lead & sales overview." : "Here's your lead overview."}</p>
        </div>
      </div>

      <div className="stat-grid">
        {statCards.map((c) => (
          <button className="stat-card" key={c.label} style={{ '--icon-color': c.color }} onClick={() => openStatModal(c.label)}>
            <div className="stat-icon">{c.icon}</div>
            <div className="stat-card-body">
              <div className="stat-value"><AnimatedStat value={c.value} format={c.format} /></div>
              <div className="stat-label">{c.label}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="panel-card trend-panel">
        <div className="panel-head">
          <h3>Leads Added — Last 7 Days</h3>
          <span className="trend-total-chip">{trendTotal} this week</span>
        </div>
        {trendTotal === 0 ? (
          <EmptyState icon="📈" text="No leads added in the last 7 days yet." />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={trendData} margin={{ left: 0, right: 10, top: 6, bottom: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5B8DEF" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#5B8DEF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--text-secondary)" axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--text-secondary)" axisLine={false} tickLine={false} width={28} />
              <Tooltip />
              <Area type="monotone" dataKey="count" name="Leads" stroke="#5B8DEF" strokeWidth={2.5} fill="url(#trendFill)" animationDuration={900} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="panel-card followups-panel">
        <div className="panel-head">
          <h3>My Follow-ups</h3>
          <select className="text-input followups-filter" value={followupFilter} onChange={(e) => setFollowupFilter(e.target.value)}>
            <option value="all">All Upcoming</option>
            <option value="today">Due Today</option>
            <option value="overdue">Overdue</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
        {followupRows.length === 0 ? (
          <EmptyState icon="✅" text="No follow-ups in this range. You're all caught up!" />
        ) : (
          <div className="upcoming-table-wrap">
            <table className="upcoming-table followups-table">
              <thead>
                <tr><th></th><th>Lead / Company</th><th>Type</th><th>Date & Time</th><th>Status</th></tr>
              </thead>
              <tbody>
                {followupRows.map((l) => {
                  const rowKey = dateKey(new Date(l.next_followup_date))
                  const isOverdue = rowKey < todayKey
                  const isToday = rowKey === todayKey
                  const meta = statusMeta(l.status)
                  const aMeta = actionTypeMeta(l.next_action_type)
                  return (
                    <tr
                      key={l.id}
                      className={'clickable-row' + (isOverdue ? ' row-overdue' : '') + (isToday ? ' row-today' : '')}
                      onClick={() => navigate(`/leads/${l.id}`)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="followup-check"
                          disabled={markingDoneId === l.id}
                          onChange={(e) => handleMarkFollowupDone(l, e)}
                          title="Mark as done"
                        />
                      </td>
                      <td>
                        <div className="upcoming-name">{l.lead_name}</div>
                        {l.company && <div className="upcoming-company">{l.company}</div>}
                      </td>
                      <td><span className="action-type-chip-mini">{aMeta.icon} {aMeta.label}</span></td>
                      <td>
                        {isToday && <span className="today-blink-dot" />}
                        {new Date(l.next_followup_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {isOverdue && <span className="overdue-tag">Overdue</span>}
                      </td>
                      <td><span className="status-badge" style={{ '--badge-color': meta.color }}>{meta.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel-card pipeline-panel">
          <div className="panel-head">
            <h3>Lead Pipeline</h3>
            <button className="link-btn" onClick={() => navigate('/leads')}>View All</button>
          </div>
          <div className="pipeline-board">
            {PIPELINE_COLUMNS.map((col) => {
              const colLeads = leads.filter((l) => col.statuses.includes(l.status))
              const visible = colLeads.slice(0, 4)
              const extra = colLeads.length - visible.length
              return (
                <div className="pipeline-column" key={col.key}>
                  <div className="pipeline-col-header" style={{ '--col-color': col.color }}>
                    <span>{col.label}</span>
                    <span className="pipeline-col-count">{colLeads.length}</span>
                  </div>
                  <div className="pipeline-col-body">
                    {visible.map((l) => (
                      <button key={l.id} className="pipeline-card" onClick={() => navigate(`/leads/${l.id}`)}>
                        <span className="pipeline-card-dot" style={{ background: col.color }} />
                        <div>
                          <div className="pipeline-card-name">{l.lead_name}</div>
                          <div className="pipeline-card-sub">{l.company || '—'}</div>
                          <div className="pipeline-card-date">
                            {new Date(l.next_followup_date || l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </button>
                    ))}
                    {extra > 0 && <div className="pipeline-more">+ {extra} more</div>}
                    {colLeads.length === 0 && (
                      <div className="pipeline-empty">
                        <span className="pipeline-empty-icon">○</span>
                        <span>No leads</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      <div className="dash-row-2col dash-row-2col-even">
          <div className="panel-card">
            <div className="panel-head">
              <h3>Call Calendar</h3>
              <button className="link-btn" onClick={() => navigate('/calendar')}>View All</button>
            </div>
            <div className="mini-cal-weekdays">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div className="mini-cal-grid">
              {monthDays.map((d) => {
                const key = dateKey(d)
                const inMonth = d.getMonth() === today.getMonth()
                const isToday = key === todayKey
                const dayLeads = leadsByDay[key] || []
                return (
                  <div
                    key={key}
                    className={'mini-cal-cell' + (inMonth ? '' : ' outside') + (isToday ? ' today' : '') + (dayLeads.length ? ' has-events' : '')}
                  >
                    {d.getDate()}
                    {dayLeads.length > 0 && <span className="mini-cal-dot" />}
                    {dayLeads.length > 0 && (
                      <div className="mini-cal-tooltip">
                        <div className="mini-cal-tooltip-date">
                          {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </div>
                        {dayLeads.slice(0, 4).map((l) => (
                          <div key={l.id} className="mini-cal-tooltip-row">
                            <span className="mini-cal-tooltip-time">
                              {new Date(l.next_followup_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="mini-cal-tooltip-name">
                              {actionTypeMeta(l.next_action_type).icon} {l.lead_name}{l.company ? ` · ${l.company}` : ''}
                            </span>
                          </div>
                        ))}
                        {dayLeads.length > 4 && <div className="mini-cal-tooltip-more">+{dayLeads.length - 4} more</div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-head">
              <h3>Today's Activities ({dueTodayLeads.length})</h3>
            </div>
            {dueTodayLeads.length === 0 ? (
              <EmptyState icon="☀️" text="Nothing scheduled for today." />
            ) : (
              <ul className="today-calls-list">
                {dueTodayLeads.slice(0, 5).map((l) => {
                  const aMeta = actionTypeMeta(l.next_action_type)
                  return (
                    <li key={l.id} className="today-call-item">
                      <div>
                        <div className="today-call-name">{aMeta.icon} {l.company || l.lead_name}</div>
                        <div className="today-call-time">
                          {new Date(l.next_followup_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {aMeta.value === 'call' && l.mobile ? (
                        <a href={`tel:${l.mobile}`} className="call-btn">📞 Call</a>
                      ) : (
                        <button className="call-btn" onClick={() => navigate(`/leads/${l.id}`)}>{aMeta.label}</button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

      <div className="dash-row-2col">
        <div className="panel-card">
          <div className="panel-head">
            <h3>Upcoming Follow-ups</h3>
            <button className="link-btn" onClick={() => navigate('/leads')}>View All</button>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState icon="🗓️" text="No upcoming follow-ups." />
          ) : (
            <div className="upcoming-table-wrap">
              <table className="upcoming-table">
                <thead>
                  <tr><th>Date & Time</th><th>Lead / Company</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {upcoming.map((l) => {
                    const meta = statusMeta(l.status)
                    return (
                      <tr key={l.id} className="clickable-row" onClick={() => navigate(`/leads/${l.id}`)}>
                        <td>{new Date(l.next_followup_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                        <td>
                          <div className="upcoming-name">
                            <span className="action-emoji">{actionTypeMeta(l.next_action_type).icon}</span> {l.lead_name}
                          </div>
                          {l.company && <div className="upcoming-company">{l.company}</div>}
                        </td>
                        <td><span className="status-badge" style={{ '--badge-color': meta.color }}>{meta.label}</span></td>
                        <td className="upcoming-arrow">›</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel-card">
          <div className="panel-head"><h3>Quick Actions</h3></div>
          <div className="quick-actions-grid">
            {canCreate && (
              <button className="quick-action" onClick={() => setShowLeadForm(true)}>
                <span className="quick-action-icon">＋</span>Add Lead
              </button>
            )}
            {canCreate && (
              <button className="quick-action" onClick={() => setShowOrderForm(true)}>
                <span className="quick-action-icon">◈</span>Create Order
              </button>
            )}
            {canCreate && (
              <button className="quick-action" onClick={() => navigate('/leads/bulk-upload')}>
                <span className="quick-action-icon">⇪</span>Bulk Upload
              </button>
            )}
            <button className="quick-action" onClick={() => navigate('/calendar')}>
              <span className="quick-action-icon">▦</span>View Calendar
            </button>
            <button className="quick-action" onClick={() => navigate('/orders')}>
              <span className="quick-action-icon">◒</span>View Orders
            </button>
            {isManager && (
              <button className="quick-action" onClick={() => navigate('/reports')}>
                <span className="quick-action-icon">◓</span>View Reports
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="dash-row-2col">
        <div className="panel-card">
          <div className="panel-head"><h3>Leads by Source</h3></div>
          {sourceData.length === 0 ? (
            <EmptyState icon="📊" text="No leads yet." />
          ) : (
            <div className="donut-wrap">
              <div className="donut-chart">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={sourceData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={76}
                      paddingAngle={3}
                      cornerRadius={6}
                      animationDuration={800}
                      animationEasing="ease-out"
                    >
                      {sourceData.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} stroke="var(--surface)" strokeWidth={2} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <span className="donut-total"><AnimatedStat value={total} /></span>
                  <span className="donut-total-label">Total Leads</span>
                </div>
              </div>
              <ul className="donut-legend">
                {sourceData.map((s, i) => (
                  <li key={s.name}>
                    <span className="legend-dot" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                    <span className="legend-name">{s.name}</span>
                    <span className="legend-value">{s.value} ({Math.round((s.value / total) * 100)}%)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="panel-card">
          <div className="panel-head">
            <h3>Recent Orders</h3>
            <button className="link-btn" onClick={() => navigate('/orders')}>View All</button>
          </div>
          {recentOrders.length === 0 ? (
            <EmptyState icon="🧾" text="No orders yet." />
          ) : (
            <div className="recent-orders-list">
              {recentOrders.map((o) => {
                const meta = orderStatusMeta(o.status)
                return (
                  <div key={o.id} className="recent-order-item">
                    <div>
                      <div className="recent-order-number">{o.order_number}</div>
                      <div className="recent-order-company">{o.company || o.lead?.lead_name || '—'}</div>
                    </div>
                    <div className="recent-order-value">{o.order_value ? `₹${Number(o.order_value).toLocaleString('en-IN')}` : '—'}</div>
                    <span className="status-badge" style={{ '--badge-color': meta.color }}>{meta.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-head"><h3>Sales Funnel</h3></div>
        {funnelData.length === 0 ? (
          <EmptyState icon="🔻" text="No leads in the pipeline yet." />
        ) : (
          <div className="funnel-stack">
            {funnelData.map((f, i) => {
              const maxValue = funnelData[0].value
              const widthPct = maxValue ? Math.max(30, Math.round((f.value / maxValue) * 100)) : 100
              const pctOfTotal = total ? Math.round((f.value / total) * 100) : 0
              return (
                <div className="funnel-row" key={f.name}>
                  <div className="funnel-track">
                    <div
                      className="funnel-bar"
                      style={{ width: `${widthPct}%`, background: f.fill, animationDelay: `${i * 0.08}s` }}
                    >
                      <span className="funnel-bar-value">{f.value}</span>
                    </div>
                  </div>
                  <div className="funnel-row-meta">
                    <span className="funnel-row-label">{f.name}</span>
                    <span className="funnel-row-pct">{pctOfTotal}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="dash-row-2col">
        <div className="panel-card">
          <div className="panel-head">
            <h3>Recent Leads</h3>
            <button className="link-btn" onClick={() => navigate('/leads')}>View All</button>
          </div>
          {recentLeads.length === 0 ? (
            <EmptyState icon="🧲" text="No leads yet." />
          ) : (
            <div className="recent-orders-list">
              {recentLeads.map((l) => {
                const meta = statusMeta(l.status)
                return (
                  <div key={l.id} className="recent-order-item" onClick={() => navigate(`/leads/${l.id}`)} style={{ cursor: 'pointer' }}>
                    <div>
                      <div className="recent-order-number">{l.lead_name}</div>
                      <div className="recent-order-company">{l.company || '—'}</div>
                    </div>
                    <div className="recent-order-value">{new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                    <span className="status-badge" style={{ '--badge-color': meta.color }}>{meta.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="panel-card">
          <div className="panel-head"><h3>City-wise Leads</h3></div>
          {cityWise.length === 0 ? (
            <EmptyState icon="🏙️" text="No city data yet." />
          ) : (
            <div className="mobile-card-table">
              <table className="upcoming-table">
                <thead><tr><th>City</th><th>Leads</th></tr></thead>
                <tbody>
                  {cityWise.map((c) => (
                    <tr key={c.name}>
                      <td data-label="City">{c.name}</td>
                      <td data-label="Leads">{c.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="dash-row-2col">
        <div className="panel-card">
          <div className="panel-head"><h3>Business Snapshot</h3></div>
          <div className="snapshot-grid">
            <button className="snapshot-tile" onClick={() => navigate('/products')}>
              <span className="snapshot-value"><AnimatedStat value={products.length} /></span>
              <span className="snapshot-label">Active Products</span>
            </button>
            <button className="snapshot-tile" onClick={() => navigate('/customers')}>
              <span className="snapshot-value"><AnimatedStat value={customerCount} /></span>
              <span className="snapshot-label">Customers</span>
            </button>
            <button className="snapshot-tile" onClick={() => navigate('/orders')}>
              <span className="snapshot-value"><AnimatedStat value={orders.length} /></span>
              <span className="snapshot-label">Total Orders</span>
            </button>
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-head">
            <h3>Top Products by Leads</h3>
            <button className="link-btn" onClick={() => navigate('/products')}>View All</button>
          </div>
          {topProducts.length === 0 ? (
            <EmptyState icon="📦" text="No product-linked leads yet." />
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 10, right: 16 }}>
                <defs>
                  <linearGradient id="topProductsFill" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#5B8DEF" />
                    <stop offset="100%" stopColor="#3AA0FF" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--text-secondary)" />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} stroke="var(--text-secondary)" />
                <Tooltip cursor={{ fill: 'var(--surface-muted)' }} />
                <Bar dataKey="leads" name="Leads" fill="url(#topProductsFill)" radius={[0, 6, 6, 0]} barSize={16} animationDuration={800} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="panel-card">
        <div className="panel-head"><h3>Recent Activity</h3></div>
        {activity.length === 0 ? (
          <EmptyState icon="🕓" text="No recent activity." />
        ) : (
          <ul className="activity-list">
            {activity.map((a, i) => (
              <li key={i} className="activity-item">
                <span className="activity-dot" />
                <span className="activity-text">{a.text}</span>
                <span className="activity-time">
                  {new Date(a.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showLeadForm && (
        <LeadFormModal
          users={users}
          currentUserId={session?.user?.id}
          onClose={() => setShowLeadForm(false)}
          onSaved={() => { setShowLeadForm(false); loadDashboard() }}
        />
      )}

      {showOrderForm && (
        <OrderFormModal
          currentUserId={session?.user?.id}
          onClose={() => setShowOrderForm(false)}
          onSaved={() => { setShowOrderForm(false); loadDashboard() }}
        />
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
