import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts'
import { Users, PhoneCall, AlertCircle, CalendarCheck, CheckCircle2, IndianRupee, TrendingUp, Package, UserPlus } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { SOURCE_OPTIONS, STATUS_OPTIONS, statusMeta } from '../lib/constants'
import LeadFormModal from '../components/LeadFormModal'
import OrderFormModal from '../components/OrderFormModal'
import StatDetailModal from '../components/StatDetailModal'
import KpiCard from '../components/dashboard/KpiCard'
import FunnelPyramid from '../components/dashboard/FunnelPyramid'
import Hero from '../components/dashboard/Hero'
import DonutCard from '../components/dashboard/DonutCard'
import HealthPanel from '../components/dashboard/HealthPanel'
import SourcePerformance from '../components/dashboard/SourcePerformance'
import OrdersOverview from '../components/dashboard/OrdersOverview'
import Leaderboard from '../components/dashboard/Leaderboard'
import { FollowupLoad, OverdueAging } from '../components/dashboard/LoadCharts'
import PipelineBoard from '../components/dashboard/PipelineBoard'
import FollowupsTable from '../components/dashboard/FollowupsTable'
import QuickActions from '../components/dashboard/QuickActions'
import MiniCalendar from '../components/dashboard/MiniCalendar'
import { TodayList, FeedPanel } from '../components/dashboard/ActivityFeed'
import { Panel, Badge, Empty, AnimatedStat, MINT, SOURCE_COLORS, dateKey, localDateKey, statusTone } from '../components/dashboard/shared'
// NOTE: legacy Dashboard.css is kept only because a few shared class names
// (.status-badge, .panel-card ...) are reused by other pages. The redesigned
// dashboard itself is styled by DashboardMint.css (all classes prefixed dx-).
import './Dashboard.css'
import './DashboardMint.css'

const PIPELINE_COLUMNS = [
  { key: 'new', label: 'New Lead', color: MINT.sky, statuses: ['new_lead'] },
  { key: 'contacted', label: 'Contacted', color: MINT.teal, statuses: ['contacted'] },
  { key: 'followup', label: 'Follow Up', color: MINT.amber, statuses: ['followup_required', 'hot_lead', 'warm_lead'] },
  { key: 'proposal', label: 'Proposal Sent', color: MINT.indigo, statuses: ['proposal_sent', 'negotiation'] },
  { key: 'won', label: 'Won Order', color: MINT.emerald, statuses: ['won_order'] }
]

const OPEN = (l) => !['won_order', 'lost_order'].includes(l.status)

function DashSkeleton() {
  return (
    <div className="dx">
      <div className="dx-kpis">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="dx-skel" style={{ height: 118 }} />)}</div>
      <div className="dx-grid">
        <div className="dx-stack"><div className="dx-skel" style={{ height: 240 }} /><div className="dx-skel" style={{ height: 300 }} /></div>
        <div className="dx-stack"><div className="dx-skel" style={{ height: 200 }} /><div className="dx-skel" style={{ height: 300 }} /></div>
      </div>
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

    const [leadsRes, ordersRes, callsRes, followsRes, leadLogRes, usersRes, productsRes, customersRes] = await Promise.all([
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
      supabase
        .from('lead_activity_log')
        .select('id, lead_name, company, action, performed_by_name, created_at')
        .order('created_at', { ascending: false })
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
    const leadLogItems = (leadLogRes.data || []).map((l) => ({
      date: l.created_at,
      text: `Lead ${l.action === 'created' ? 'added' : 'deleted'}: ${l.lead_name || 'Unnamed lead'}${l.company ? ' (' + l.company + ')' : ''}${l.performed_by_name ? ' by ' + l.performed_by_name : ''}`
    }))
    const merged = [...callItems, ...followItems, ...leadLogItems].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8)
    setActivity(merged)

    setLoading(false)
  }, [isManager, session])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  if (loading) return <DashSkeleton />

  const today = new Date()
  const todayKey = dateKey(today)

  const openLeads = leads.filter(OPEN)
  const pendingLeads = openLeads.filter((l) => l.next_followup_date)
  const overdueLeads = pendingLeads.filter((l) => l.next_followup_date.slice(0, 10) < todayKey)
  const dueTodayLeads = pendingLeads.filter((l) => l.next_followup_date.slice(0, 10) === todayKey)
  const meetingLeads = pendingLeads.filter((l) => ['meeting', 'visit'].includes(l.next_action_type))
  const wonLeads = leads.filter((l) => l.status === 'won_order')
  const total = leads.length
  const totalOrdersValue = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + (Number(o.order_value) || 0), 0)

  const dayMs = 86400000
  const daysAgo = (v) => Math.floor((new Date(todayKey) - new Date(String(v).slice(0, 10))) / dayMs)
  const addedLast7 = leads.filter((l) => l.created_at && today - new Date(l.created_at) < 7 * dayMs).length
  const convRate = total ? Math.round((wonLeads.length / total) * 100) : 0

  // per-day series for sparklines / charts
  const createdByDay = {}
  leads.forEach((l) => { if (l.created_at) { const k = localDateKey(l.created_at); createdByDay[k] = (createdByDay[k] || 0) + 1 } })
  const orderValueByDay = {}
  orders.filter((o) => o.status !== 'cancelled').forEach((o) => { if (o.created_at) { const k = localDateKey(o.created_at); orderValueByDay[k] = (orderValueByDay[k] || 0) + (Number(o.order_value) || 0) } })
  const lastDays = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - (n - 1 - i)); return d })
  const next14 = Array.from({ length: 14 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i); return d })
  const dueByDay = {}
  pendingLeads.forEach((l) => { const k = l.next_followup_date.slice(0, 10); dueByDay[k] = (dueByDay[k] || 0) + 1 })

  const spark30 = lastDays(30).map((d) => createdByDay[localDateKey(d)] || 0)
  const sparkOrders = lastDays(30).map((d) => orderValueByDay[localDateKey(d)] || 0)
  const sparkDue = next14.map((d) => dueByDay[dateKey(d)] || 0)

  const agingBuckets = [
    { label: '1-3 days', count: 0 }, { label: '4-7 days', count: 0 }, { label: '8-14 days', count: 0 }, { label: '15+ days', count: 0 }
  ]
  overdueLeads.forEach((l) => {
    const age = daysAgo(l.next_followup_date)
    agingBuckets[age <= 3 ? 0 : age <= 7 ? 1 : age <= 14 ? 2 : 3].count++
  })

  const loadData = [
    { label: 'Late', count: overdueLeads.length, overdue: true },
    ...next14.map((d, i) => ({ label: d.toLocaleDateString('en-IN', { day: 'numeric' }), count: dueByDay[dateKey(d)] || 0, today: i === 0 }))
  ]

  const kpis = [
    { label: 'Total Leads', value: total, icon: Users, tone: MINT.emerald, pill: `+${addedLast7} this wk`, visual: { type: 'spark', data: spark30 } },
    { label: 'Follow-ups Pending', value: pendingLeads.length, icon: PhoneCall, tone: MINT.amber, pill: `${dueTodayLeads.length} due today`, visual: { type: 'spark', data: sparkDue } },
    { label: 'Overdue Follow-ups', value: overdueLeads.length, icon: AlertCircle, tone: MINT.rose, pill: overdueLeads.length ? 'Needs action' : 'All clear', visual: { type: 'spark', data: agingBuckets.map((b) => b.count) } },
    { label: 'Meetings Scheduled', value: meetingLeads.length, icon: CalendarCheck, tone: MINT.indigo, pill: 'Upcoming', visual: { type: 'ring', pct: pendingLeads.length ? meetingLeads.length / pendingLeads.length : 0 } },
    { label: 'Converted to Order', value: wonLeads.length, icon: CheckCircle2, tone: MINT.emerald, pill: `${convRate}% win rate`, visual: { type: 'ring', pct: total ? wonLeads.length / total : 0 } },
    { label: 'Total Orders Value', value: totalOrdersValue, format: (n) => `₹${n.toLocaleString('en-IN')}`, icon: IndianRupee, tone: MINT.sky, pill: `${orders.length} orders`, visual: { type: 'spark', data: sparkOrders } }
  ]

  // Cumulative funnel: a lead in "Proposal" also passed New/Contacted/Follow-up
  const stageIndex = {}
  PIPELINE_COLUMNS.forEach((c, i) => c.statuses.forEach((st) => { stageIndex[st] = i }))
  const funnelLeads = leads.filter((l) => stageIndex[l.status] !== undefined)
  const funnelStages = PIPELINE_COLUMNS.map((c, i) => ({
    key: c.key, label: c.label, color: c.color,
    reached: funnelLeads.filter((l) => stageIndex[l.status] >= i).length,
    current: funnelLeads.filter((l) => stageIndex[l.status] === i).length
  }))
  const lostCount = leads.filter((l) => ['lost_order', 'not_interested'].includes(l.status)).length

  const recentLeads = [...leads].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6)

  const sourceData = SOURCE_OPTIONS
    .map((s) => ({ name: s.label, value: leads.filter((l) => l.source === s.value).length }))
    .filter((s) => s.value > 0).sort((a, b) => b.value - a.value)
    .map((s, i) => ({ ...s, color: SOURCE_COLORS[i % SOURCE_COLORS.length] }))

  const sourcePerf = sourceData.map((d) => {
    const val = SOURCE_OPTIONS.find((o) => o.label === d.name)?.value
    return { name: d.name, color: d.color, leads: d.value, won: leads.filter((l) => l.source === val && l.status === 'won_order').length }
  })

  const statusData = STATUS_OPTIONS
    .map((st) => ({ name: st.label, value: leads.filter((l) => l.status === st.value).length, color: statusTone(st.value) }))
    .filter((s) => s.value > 0).sort((a, b) => b.value - a.value)

  const assignedCount = leads.filter((l) => l.assigned_to).length
  const healthItems = [
    { label: 'Win Rate', pct: total ? wonLeads.length / total : 0, color: MINT.emerald, sub: `${wonLeads.length} of ${total} leads` },
    { label: 'On-time Follow-ups', pct: pendingLeads.length ? 1 - overdueLeads.length / pendingLeads.length : 1, color: overdueLeads.length > pendingLeads.length / 2 ? MINT.rose : MINT.amber, sub: `${overdueLeads.length} overdue` },
    { label: 'Proposal Reach', pct: total ? funnelStages[3].reached / total : 0, color: MINT.indigo, sub: `${funnelStages[3].reached} reached proposal` },
    { label: 'Assigned Leads', pct: total ? assignedCount / total : 0, color: MINT.sky, sub: `${assignedCount} assigned` }
  ]

  const leaderboard = isManager
    ? [...users.map((u) => ({ id: u.id, name: u.full_name || 'User' })), { id: 'none', name: 'Unassigned' }]
        .map((u) => {
          const mine = leads.filter((l) => (u.id === 'none' ? !l.assigned_to : l.assigned_to === u.id))
          return { ...u, total: mine.length, won: mine.filter((l) => l.status === 'won_order').length }
        })
        .filter((u) => u.total > 0).sort((a, b) => b.total - a.total)
    : []

  const leadsByDay = {}
  pendingLeads.forEach((l) => {
    const key = l.next_followup_date.slice(0, 10)
    if (!leadsByDay[key]) leadsByDay[key] = []
    leadsByDay[key].push(l)
  })

  const trendData = lastDays(30).map((d) => ({ day: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), count: createdByDay[localDateKey(d)] || 0 }))
  const trendTotal = trendData.reduce((x, t) => x + t.count, 0)

  const topProducts = products
    .map((p) => ({ name: p.product_name, leads: leads.filter((l) => l.product_id === p.id).length }))
    .filter((p) => p.leads > 0).sort((a, b) => b.leads - a.leads).slice(0, 5)

  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7)
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
    const map = {
      'Total Leads': { title: 'Total Leads', kind: 'leads', items: leads },
      'Follow-ups Pending': { title: 'Follow-ups Pending', kind: 'leads', items: pendingLeads },
      'Overdue Follow-ups': { title: 'Overdue Follow-ups', kind: 'leads', items: overdueLeads },
      'Meetings Scheduled': { title: 'Meetings & Site Visits', kind: 'leads', items: meetingLeads },
      'Converted to Order': { title: 'Converted to Order', kind: 'leads', items: wonLeads },
      'Total Orders Value': { title: 'All Orders', kind: 'orders', items: orders }
    }
    if (map[label]) setStatModal(map[label])
  }

  const openLead = (id) => navigate(`/leads/${id}`)
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = (profile?.full_name || '').split(' ')[0]

  return (
    <div className="dx">
      <Hero
        greeting={greeting} name={firstName} canCreate={canCreate} onAdd={() => setShowLeadForm(true)}
        note={overdueLeads.length ? `${overdueLeads.length} follow-ups are overdue — let's clear them today.` : "You're all caught up. Time to find new leads!"}
        chips={[
          { label: 'Due today', value: dueTodayLeads.length },
          { label: 'Overdue', value: overdueLeads.length },
          { label: 'New this week', value: addedLast7 },
          { label: 'Orders value', value: totalOrdersValue, format: (n) => `₹${n.toLocaleString('en-IN')}` }
        ]}
      />

      <div className="dx-kpis">
        {kpis.map((k, i) => (
          <KpiCard key={k.label} {...k} delay={i + 1} onClick={() => openStatModal(k.label)} />
        ))}
      </div>

      <div className="dx-grid">
        <div className="dx-stack">
          <FunnelPyramid stages={funnelStages} lost={lostCount} />
          <div className="dx-grid-even">
            <DonutCard title="Leads by Source" subtitle="Where your leads come from" data={sourceData} total={total} centerLabel="Leads" />
            <DonutCard title="Lead Status Mix" subtitle="Current status of every lead" data={statusData} total={total} centerLabel="Leads" />
          </div>
          <PipelineBoard columns={PIPELINE_COLUMNS} leads={leads} onOpenLead={openLead} onViewAll={() => navigate('/leads')} />
          <div className="dx-grid-even">
            <FollowupLoad data={loadData} />
            <OverdueAging data={agingBuckets} />
          </div>
          <FollowupsTable
            rows={followupRows} filter={followupFilter} onFilter={setFollowupFilter} todayKey={todayKey}
            markingId={markingDoneId} onMarkDone={handleMarkFollowupDone} onOpenLead={openLead}
          />
            <Panel title="Leads Added — Last 30 Days" subtitle={`${trendTotal} new leads`}>
              {trendTotal === 0 ? <Empty icon={TrendingUp} text="No leads added in the last 30 days." /> : (
                <ResponsiveContainer width="100%" height={190}>
                  <AreaChart data={trendData} margin={{ left: 0, right: 10, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dxTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} interval={4} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" name="Leads" stroke="#059669" strokeWidth={2.5} fill="url(#dxTrend)" animationDuration={1000} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Panel>
          <SourcePerformance rows={sourcePerf} />
          <OrdersOverview orders={orders} onViewAll={() => navigate('/orders')} />
        </div>

        <aside className="dx-stack">
          <QuickActions
            canCreate={canCreate} isManager={isManager}
            handlers={{
              addLead: () => setShowLeadForm(true), addOrder: () => setShowOrderForm(true),
              bulk: () => navigate('/leads/bulk-upload'), calendar: () => navigate('/calendar'),
              orders: () => navigate('/orders'), reports: () => navigate('/reports')
            }}
          />
          <HealthPanel items={healthItems} />
          <MiniCalendar today={today} leadsByDay={leadsByDay} onViewAll={() => navigate('/calendar')} />
          <TodayList leads={dueTodayLeads} onOpenLead={openLead} />
          {isManager && <Leaderboard rows={leaderboard} />}
          <FeedPanel activity={activity} orders={orders.slice(0, 6)} onViewOrders={() => navigate('/orders')} />
          <Panel title="Recent Leads" action={<button className="dx-link" onClick={() => navigate('/leads')}>View all</button>}>
            {recentLeads.length === 0 ? <Empty icon={UserPlus} text="No leads yet." /> : (
              <ul className="dx-orders">
                {recentLeads.map((l) => (
                  <li key={l.id} className="dx-clickable" onClick={() => openLead(l.id)}>
                    <div>
                      <div className="dx-cell-name">{l.lead_name}</div>
                      <div className="dx-cell-sub">{l.company || '—'}</div>
                    </div>
                    <b>{new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</b>
                    <Badge color={statusTone(l.status)}>{statusMeta(l.status).label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Top Products by Leads" action={<button className="dx-link" onClick={() => navigate('/products')}>View all</button>}>
            {topProducts.length === 0 ? <Empty icon={Package} text="No product-linked leads yet." /> : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={topProducts} layout="vertical" margin={{ left: 6, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#F1F5F9' }} />
                  <Bar dataKey="leads" name="Leads" fill="#10B981" radius={[0, 8, 8, 0]} barSize={16} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title="Business Snapshot">
            <div className="dx-snap">
              {[['Active Products', products.length, '/products'], ['Customers', customerCount, '/customers'], ['Total Orders', orders.length, '/orders']].map(([label, v, to]) => (
                <button key={label} className="dx-snap-tile" onClick={() => navigate(to)}>
                  <b><AnimatedStat value={v} /></b><span>{label}</span>
                </button>
              ))}
            </div>
          </Panel>
        </aside>
      </div>

      {showLeadForm && (
        <LeadFormModal users={users} currentUserId={session?.user?.id}
          onClose={() => setShowLeadForm(false)} onSaved={() => { setShowLeadForm(false); loadDashboard() }} />
      )}
      {showOrderForm && (
        <OrderFormModal currentUserId={session?.user?.id}
          onClose={() => setShowOrderForm(false)} onSaved={() => { setShowOrderForm(false); loadDashboard() }} />
      )}
      {statModal && (
        <StatDetailModal title={statModal.title} kind={statModal.kind} items={statModal.items} onClose={() => setStatModal(null)} />
      )}
    </div>
  )
}
