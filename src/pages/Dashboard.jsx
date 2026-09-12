import { useEffect, useState, useCallback } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { SOURCE_OPTIONS } from '../lib/constants'
import './Dashboard.css'

const ROLE_LABELS = {
  admin: 'Admin', subadmin: 'Subadmin', sales: 'Sales', bde: 'BDE', calling: 'Calling'
}

const SOURCE_COLORS = ['#5B8DEF', '#E5484D', '#0EA99A', '#9B7FE0', '#F5A623', '#6C7390', '#3AA0FF']

const FUNNEL_STAGES = [
  { key: 'total', label: 'Total Leads', color: '#5B8DEF' },
  { key: 'contacted', label: 'Contacted', color: '#0EA99A' },
  { key: 'followup', label: 'Follow-up', color: '#F5A623' },
  { key: 'proposal', label: 'Proposal Sent', color: '#9B7FE0' },
  { key: 'won', label: 'Won Orders', color: '#2DBE7E' }
]

const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M16 11a4 4 0 1 0-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M2 21c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8"/></svg>
)
const IconPhone = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 5c0 8.3 6.7 15 15 15l2-4-5-2-2 2c-2.5-1.2-4.8-3.5-6-6l2-2-2-5-4 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
)
const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
)
const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
)
const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
)

export default function Dashboard() {
  const { profile, session } = useAuth()
  const role = profile?.role
  const isManager = ['admin', 'subadmin'].includes(role)

  const [leads, setLeads] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('leads').select('status, source, assigned_to, next_followup_date')

    if (!isManager && session?.user?.id) {
      query = query.eq('assigned_to', session.user.id)
    }

    const { data } = await query
    setLeads(data || [])

    if (isManager) {
      const { data: userData } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['sales', 'bde', 'calling'])
        .order('full_name')
      setUsers(userData || [])
    }

    setLoading(false)
  }, [isManager, session])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return <p className="dash-note">Loading dashboard…</p>

  const total = leads.length
  const won = leads.filter((l) => l.status === 'won_order').length
  const lost = leads.filter((l) => l.status === 'lost_order').length
  const today = new Date().toISOString().slice(0, 10)
  const pending = leads.filter((l) => l.next_followup_date && !['won_order', 'lost_order'].includes(l.status)).length
  const overdue = leads.filter(
    (l) => l.next_followup_date && l.next_followup_date.slice(0, 10) < today && !['won_order', 'lost_order'].includes(l.status)
  ).length
  const contacted = leads.filter((l) => l.status !== 'new_lead').length

  const statCards = [
    { label: 'Total Leads', value: total, icon: <IconUsers />, color: '#5B8DEF' },
    { label: 'Contacted', value: contacted, icon: <IconPhone />, color: '#0EA99A' },
    { label: 'Follow-up Pending', value: pending, sub: overdue > 0 ? `${overdue} overdue` : null, icon: <IconClock />, color: '#F5A623' },
    { label: 'Won Orders', value: won, icon: <IconCheck />, color: '#2DBE7E' },
    { label: 'Lost Orders', value: lost, icon: <IconX />, color: '#E5484D' }
  ]

  const sourceData = SOURCE_OPTIONS
    .map((s) => ({ name: s.label, value: leads.filter((l) => l.source === s.value).length }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)

  const funnelCounts = {
    total,
    contacted,
    followup: leads.filter((l) => ['followup_required', 'hot_lead', 'warm_lead'].includes(l.status)).length,
    proposal: leads.filter((l) => ['proposal_sent', 'negotiation'].includes(l.status)).length,
    won
  }

  const bdePerf = isManager
    ? users.map((u) => {
        const theirs = leads.filter((l) => l.assigned_to === u.id)
        const theirWon = theirs.filter((l) => l.status === 'won_order').length
        const conv = theirs.length ? Math.round((theirWon / theirs.length) * 100) : 0
        return { ...u, total: theirs.length, won: theirWon, conv }
      }).sort((a, b) => b.total - a.total)
    : []

  return (
    <div>
      <h1>Dashboard</h1>
      <p className="dash-note" style={{ marginTop: 0 }}>
        {isManager ? "Here's your team's lead & sales overview." : "Here's your lead overview."}
      </p>

      <div className="stat-grid">
        {statCards.map((c) => (
          <div className="stat-card" key={c.label}>
            <div className="stat-icon" style={{ '--icon-color': c.color }}>{c.icon}</div>
            <div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
              {c.sub && <div className="stat-sub">{c.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="dash-panels">
        <div className="panel-card">
          <h3>Leads by Source</h3>
          {sourceData.length === 0 ? (
            <p className="dash-note">No leads yet.</p>
          ) : (
            <div className="donut-wrap">
              <div className="donut-chart">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {sourceData.map((_, i) => (
                        <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                      ))}
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
          <h3>Lead Conversion Funnel</h3>
          <div className="funnel">
            {FUNNEL_STAGES.map((stage) => {
              const count = funnelCounts[stage.key]
              const pct = total ? Math.round((count / total) * 100) : 0
              return (
                <div className="funnel-row" key={stage.key}>
                  <span className="funnel-label">{stage.label}</span>
                  <div className="funnel-bar-track">
                    <div className="funnel-bar" style={{ width: `${pct}%`, background: stage.color }} />
                  </div>
                  <span className="funnel-count">{count}</span>
                  <span className="funnel-pct">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {isManager && (
        <div className="panel-card">
          <h3>BDE / Sales Performance</h3>
          {bdePerf.length === 0 ? (
            <p className="dash-note">No team members assigned yet.</p>
          ) : (
            <div className="perf-table-wrap">
              <table className="perf-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Total Leads</th>
                    <th>Won Orders</th>
                    <th>Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {bdePerf.map((u) => (
                    <tr key={u.id}>
                      <td>{u.full_name}</td>
                      <td>{ROLE_LABELS[u.role]}</td>
                      <td>{u.total}</td>
                      <td>{u.won}</td>
                      <td>
                        <div className="conv-bar-track">
                          <div className="conv-bar" style={{ width: `${u.conv}%` }} />
                        </div>
                        <span className="conv-pct">{u.conv}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
