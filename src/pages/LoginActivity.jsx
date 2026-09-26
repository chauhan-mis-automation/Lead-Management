import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { printRecord } from '../lib/printUtils'
import './LoginActivity.css'

const ROLE_LABELS = { admin: 'Admin', subadmin: 'Subadmin', sales: 'Sales', bde: 'BDE', calling: 'Calling' }

function pad(n) { return String(n).padStart(2, '0') }
function toDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function todayStr() { return toDateStr(new Date()) }

function formatDuration(startIso, endIso) {
  if (!endIso) return null
  const ms = new Date(endIso) - new Date(startIso)
  if (ms < 0) return '—'
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

const DetailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M2 12C2 12 5.5 5.5 12 5.5C18.5 5.5 22 12 22 12C22 12 18.5 18.5 12 18.5C5.5 18.5 2 12 2 12Z" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
  </svg>
)

export default function LoginActivity() {
  const { profile } = useAuth()
  const canView = ['admin', 'subadmin'].includes(profile?.role)

  const [fromDate, setFromDate] = useState(todayStr())
  const [toDate, setToDate] = useState(todayStr())
  const [userFilter, setUserFilter] = useState('')
  const [users, setUsers] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailFor, setDetailFor] = useState(null)

  useEffect(() => {
    if (!canView) return
    supabase.from('profiles').select('id, full_name, role').order('full_name').then(({ data }) => setUsers(data || []))
  }, [canView])

  const load = useCallback(async () => {
    setLoading(true)
    const rangeStart = new Date(fromDate + 'T00:00:00').toISOString()
    const rangeEnd = new Date(toDate + 'T23:59:59').toISOString()

    let query = supabase
      .from('login_history')
      .select('id, user_id, login_at, logout_at, profile:profiles(full_name, role)')
      .gte('login_at', rangeStart)
      .lte('login_at', rangeEnd)
      .order('login_at', { ascending: false })

    if (userFilter) query = query.eq('user_id', userFilter)

    const { data } = await query
    setRows(data || [])
    setLoading(false)
  }, [fromDate, toDate, userFilter])

  useEffect(() => { if (canView) load() }, [canView, load])

  function handleExportCSV() {
    const header = ['User', 'Role', 'Date', 'Login Time', 'Logout Time', 'Duration']
    const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = rows.map((r) => {
      const duration = formatDuration(r.login_at, r.logout_at)
      return [
        r.profile?.full_name || '—',
        ROLE_LABELS[r.profile?.role] || r.profile?.role || '—',
        new Date(r.login_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        new Date(r.login_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        r.logout_at ? new Date(r.logout_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Active now',
        duration || '—'
      ].map(csvCell).join(',')
    })
    const csv = [header.map(csvCell).join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `login_activity_${fromDate}_to_${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handlePrintList() {
    const rowsHtml = rows.map((r) => {
      const duration = formatDuration(r.login_at, r.logout_at)
      return `
        <tr>
          <td>${r.profile?.full_name || '—'}</td>
          <td>${ROLE_LABELS[r.profile?.role] || r.profile?.role || '—'}</td>
          <td>${new Date(r.login_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
          <td>${new Date(r.login_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${r.logout_at ? new Date(r.logout_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Active now'}</td>
          <td>${duration || '—'}</td>
        </tr>`
    }).join('')

    const body = `
      <div class="print-meta-grid">
        <div><span>Period</span><strong>${fromDate} to ${toDate}</strong></div>
        <div><span>Total Records</span><strong>${rows.length}</strong></div>
      </div>
      <h2>Login / Logout Records</h2>
      <table>
        <thead><tr><th>User</th><th>Role</th><th>Date</th><th>Login Time</th><th>Logout Time</th><th>Duration</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `
    printRecord('Login Activity Report', body, { docName: 'Login Activity', docNumber: `${fromDate} to ${toDate}` })
  }

  if (!canView) {
    return (
      <div>
        <h1>Login Activity</h1>
        <p className="reports-subtitle">This page is only available to Admin and Subadmin.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="reports-header">
        <div>
          <h1>Login Activity</h1>
          <p className="reports-subtitle">Daily login / logout record for every user, with a full activity trail</p>
        </div>
      </div>

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
        <div className="field">
          <label>Quick Range</label>
          <div className="rh-preset-btns">
            <button type="button" className="btn-ghost" onClick={() => { setFromDate(todayStr()); setToDate(todayStr()) }}>Today</button>
            <button type="button" className="btn-ghost" onClick={() => {
              const d = new Date(); d.setDate(d.getDate() - 1)
              setFromDate(toDateStr(d)); setToDate(toDateStr(d))
            }}>Yesterday</button>
            <button type="button" className="btn-ghost" onClick={() => {
              const d = new Date(); d.setDate(d.getDate() - 6)
              setFromDate(toDateStr(d)); setToDate(todayStr())
            }}>Last 7 Days</button>
          </div>
        </div>
        <div className="field rh-export-field">
          <label>&nbsp;</label>
          <div className="rh-preset-btns">
            <button type="button" className="btn-ghost" onClick={handleExportCSV} disabled={rows.length === 0}>⬇ Export CSV</button>
            <button type="button" className="btn-primary" onClick={handlePrintList} disabled={rows.length === 0}>🖨 Print</button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="reports-note">Loading login activity…</p>
      ) : rows.length === 0 ? (
        <p className="reports-note">No login activity in this period.</p>
      ) : (
        <div className="panel-card">
          <div className="mobile-card-table">
            <table className="reports-table">
              <thead>
                <tr><th>User</th><th>Role</th><th>Date</th><th>Login Time</th><th>Logout Time</th><th>Duration</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const duration = formatDuration(r.login_at, r.logout_at)
                  return (
                    <tr key={r.id}>
                      <td data-label="User">{r.profile?.full_name || '—'}</td>
                      <td data-label="Role">{ROLE_LABELS[r.profile?.role] || r.profile?.role || '—'}</td>
                      <td data-label="Date">{new Date(r.login_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td data-label="Login Time">{new Date(r.login_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td data-label="Logout Time">
                        {r.logout_at
                          ? new Date(r.logout_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                          : <span className="login-active-badge">● Active now</span>}
                      </td>
                      <td data-label="Duration">{duration || '—'}</td>
                      <td>
                        <button className="icon-btn" title="View this day's activity" onClick={() => setDetailFor(r)}>
                          <DetailIcon />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailFor && <UserActivityDetailModal row={detailFor} onClose={() => setDetailFor(null)} />}
    </div>
  )
}

const TIMELINE_ICONS = { call: '📞', followup: '📅', lead: '➕', quotation: '📄' }

function UserActivityDetailModal({ row, onClose }) {
  const [loading, setLoading] = useState(true)
  const [timeline, setTimeline] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const dayStart = new Date(row.login_at)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const [callsRes, followsRes, leadsRes, quotesRes] = await Promise.all([
        supabase
          .from('call_history')
          .select('id, remarks, call_date, lead:leads(lead_name)')
          .eq('created_by', row.user_id)
          .gte('call_date', dayStart.toISOString())
          .lt('call_date', dayEnd.toISOString()),
        supabase
          .from('followup_history')
          .select('id, remarks, followup_date, status, action_type, lead:leads(lead_name)')
          .eq('created_by', row.user_id)
          .gte('followup_date', dayStart.toISOString())
          .lt('followup_date', dayEnd.toISOString()),
        supabase
          .from('leads')
          .select('id, lead_name, company, created_at')
          .eq('created_by', row.user_id)
          .gte('created_at', dayStart.toISOString())
          .lt('created_at', dayEnd.toISOString()),
        supabase
          .from('quotations')
          .select('id, quotation_number, amount, created_at')
          .eq('created_by', row.user_id)
          .gte('created_at', dayStart.toISOString())
          .lt('created_at', dayEnd.toISOString())
      ])

      const calls = (callsRes.data || []).map((c) => ({
        type: 'call', date: c.call_date,
        text: `Called ${c.lead?.lead_name || 'a lead'}${c.remarks ? ' — ' + c.remarks : ''}`
      }))
      const follows = (followsRes.data || []).map((f) => ({
        type: 'followup', date: f.followup_date,
        text: `Follow-up on ${f.lead?.lead_name || 'a lead'}${f.remarks ? ' — ' + f.remarks : ''}`
      }))
      const leadsAdded = (leadsRes.data || []).map((l) => ({
        type: 'lead', date: l.created_at,
        text: `Added new lead — ${l.lead_name}${l.company ? ' (' + l.company + ')' : ''}`
      }))
      const quotes = (quotesRes.data || []).map((q) => ({
        type: 'quotation', date: q.created_at,
        text: `Created quotation ${q.quotation_number} — ₹${Number(q.amount || 0).toLocaleString('en-IN')}`
      }))

      setTimeline([...calls, ...follows, ...leadsAdded, ...quotes].sort((a, b) => new Date(b.date) - new Date(a.date)))
      setLoading(false)
    }
    load()
  }, [row])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card stat-detail-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{row.profile?.full_name}'s Activity</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="login-activity-date">
          {new Date(row.login_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>

        {loading ? (
          <p className="reports-note">Loading activity…</p>
        ) : timeline.length === 0 ? (
          <p className="stat-detail-empty">No activity logged for this day.</p>
        ) : (
          <div className="login-activity-timeline">
            {timeline.map((t, i) => (
              <div key={i} className="login-activity-item">
                <span className="login-activity-icon">{TIMELINE_ICONS[t.type]}</span>
                <div className="login-activity-body">
                  <div className="login-activity-text">{t.text}</div>
                  <div className="login-activity-time">
                    {new Date(t.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
