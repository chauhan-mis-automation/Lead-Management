import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
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

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
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
  const [loading, setLoading] = useState(true)
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [statModal, setStatModal] = useState(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)

    let leadsQuery = supabase.from('leads').select('id, lead_name, company, status, source, assigned_to, next_followup_date, created_at')
    if (!isManager && session?.user?.id) leadsQuery = leadsQuery.eq('assigned_to', session.user.id)

    let ordersQuery = supabase
      .from('orders')
      .select('*, lead:leads!orders_lead_id_fkey(lead_name)')
      .order('created_at', { ascending: false })
    if (!isManager && session?.user?.id) ordersQuery = ordersQuery.eq('created_by', session.user.id)

    const [leadsRes, ordersRes, callsRes, followsRes, usersRes] = await Promise.all([
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
        : Promise.resolve({ data: [] })
    ])

    setLeads(leadsRes.data || [])
    setOrders(ordersRes.data || [])
    setUsers(usersRes.data || [])

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
    { label: 'Total Orders Value', value: `₹${totalOrdersValue.toLocaleString('en-IN')}`, icon: <IconRupee />, color: '#3AA0FF' }
  ]

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
  leads.filter((l) => l.next_followup_date).forEach((l) => {
    const key = l.next_followup_date.slice(0, 10)
    if (!leadsByDay[key]) leadsByDay[key] = []
    leadsByDay[key].push(l)
  })

  const recentOrders = orders.slice(0, 6)

  const wonLeads = leads.filter((l) => l.status === 'won_order')
  const pendingLeads = leads.filter((l) => l.next_followup_date && !['won_order', 'lost_order'].includes(l.status))
  const overdueLeads = leads.filter((l) => l.next_followup_date && l.next_followup_date.slice(0, 10) < todayKey && !['won_order', 'lost_order'].includes(l.status))
  const meetingLeads = leads.filter(
    (l) => ['meeting', 'visit'].includes(l.next_action_type) && l.next_followup_date && !['won_order', 'lost_order'].includes(l.status)
  )

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
          <button className="stat-card" key={c.label} onClick={() => openStatModal(c.label)}>
            <div className="stat-icon" style={{ '--icon-color': c.color }}>{c.icon}</div>
            <div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="dash-row-2col">
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
                  <div className="pipeline-col-header" style={{ background: col.color }}>
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
                    {colLeads.length === 0 && <div className="pipeline-empty">No leads</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="dash-side-col">
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
                            <span className="mini-cal-tooltip-name">{l.lead_name}{l.company ? ` · ${l.company}` : ''}</span>
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
              <p className="dash-note">Nothing scheduled for today.</p>
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
                      <button className="call-btn" onClick={() => navigate(`/leads/${l.id}`)}>{aMeta.label}</button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="dash-row-2col">
        <div className="panel-card">
          <div className="panel-head">
            <h3>Upcoming Follow-ups</h3>
            <button className="link-btn" onClick={() => navigate('/leads')}>View All</button>
          </div>
          {upcoming.length === 0 ? (
            <p className="dash-note">No upcoming follow-ups.</p>
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
            <p className="dash-note">No leads yet.</p>
          ) : (
            <div className="donut-wrap">
              <div className="donut-chart">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={2}>
                      {sourceData.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <span className="donut-total">{total}</span>
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
            <p className="dash-note">No orders yet.</p>
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
        <div className="panel-head"><h3>Recent Activity</h3></div>
        {activity.length === 0 ? (
          <p className="dash-note">No recent activity.</p>
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
