import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { STATUS_OPTIONS, statusMeta } from '../lib/constants'
import './Calendar.css'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = firstOfMonth.getDay()
  const gridStart = new Date(year, month, 1 - startOffset)

  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    days.push(d)
  }
  return days
}

export default function CalendarPage() {
  const { profile, session } = useAuth()
  const isManager = ['admin', 'subadmin'].includes(profile?.role)

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(dateKey(today))

  const [leads, setLeads] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')

  const monthDays = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const loadLeads = useCallback(async () => {
    setLoading(true)
    const rangeStart = new Date(viewYear, viewMonth, 1 - 7).toISOString()
    const rangeEnd = new Date(viewYear, viewMonth + 1, 7).toISOString()

    let query = supabase
      .from('leads')
      .select('id, lead_name, company, status, next_followup_date, assigned_to, assigned_profile:profiles!leads_assigned_to_fkey(full_name)')
      .not('next_followup_date', 'is', null)
      .gte('next_followup_date', rangeStart)
      .lte('next_followup_date', rangeEnd)

    if (!isManager && session?.user?.id) {
      query = query.eq('assigned_to', session.user.id)
    }
    if (statusFilter) query = query.eq('status', statusFilter)
    if (isManager && assigneeFilter) query = query.eq('assigned_to', assigneeFilter)

    const { data } = await query
    setLeads(data || [])
    setLoading(false)
  }, [viewYear, viewMonth, isManager, session, statusFilter, assigneeFilter])

  useEffect(() => { loadLeads() }, [loadLeads])

  useEffect(() => {
    async function loadUsers() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['sales', 'bde', 'calling'])
        .order('full_name')
      setUsers(data || [])
    }
    if (isManager) loadUsers()
  }, [isManager])

  const leadsByDay = useMemo(() => {
    const map = {}
    for (const lead of leads) {
      const key = dateKey(new Date(lead.next_followup_date))
      if (!map[key]) map[key] = []
      map[key].push(lead)
    }
    return map
  }, [leads])

  function goToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelectedDate(dateKey(today))
  }

  function shiftMonth(delta) {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    setViewMonth(m)
    setViewYear(y)
  }

  const selectedDayLeads = (leadsByDay[selectedDate] || []).sort(
    (a, b) => new Date(a.next_followup_date) - new Date(b.next_followup_date)
  )

  return (
    <div>
      <div className="cal-header">
        <div>
          <h1>Calendar</h1>
          <p className="cal-subtitle">
            {isManager ? "Everyone's upcoming follow-ups" : 'Your upcoming follow-ups'}
          </p>
        </div>
      </div>

      <div className="cal-toolbar">
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
          <span className="cal-month-label">{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button className="cal-nav-btn" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
          <button className="btn-ghost small" onClick={goToday}>Today</button>
        </div>

        <div className="cal-filters">
          <select className="text-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {isManager && (
            <select className="text-input" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value="">All Users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="cal-grid-wrap">
        <div className="cal-weekdays">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={'cal-weekday' + (i === 0 || i === 6 ? ' weekend' : '')}>{w}</div>
          ))}
        </div>

        <div className="cal-grid">
          {monthDays.map((d, i) => {
            const key = dateKey(d)
            const isCurrentMonth = d.getMonth() === viewMonth
            const isToday = key === dateKey(today)
            const isSelected = key === selectedDate
            const dayLeads = leadsByDay[key] || []
            const visible = dayLeads.slice(0, 2)
            const extra = dayLeads.length - visible.length

            return (
              <button
                key={key}
                style={{ animationDelay: `${Math.min(i, 20) * 12}ms` }}
                className={
                  'cal-cell' +
                  (isCurrentMonth ? '' : ' outside') +
                  (isToday ? ' today' : '') +
                  (isSelected ? ' selected' : '')
                }
                onClick={() => setSelectedDate(key)}
              >
                <span className="cal-date-num">{d.getDate()}</span>
                <div className="cal-chips">
                  {visible.map((lead) => {
                    const meta = statusMeta(lead.status)
                    return (
                      <span key={lead.id} className="cal-chip" style={{ '--chip-color': meta.color }}>
                        {lead.company || lead.lead_name}
                      </span>
                    )
                  })}
                  {extra > 0 && <span className="cal-chip-more">+{extra} more</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="cal-day-detail" key={selectedDate}>
        <h3>
          {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </h3>

        {loading ? (
          <p className="cal-empty">Loading…</p>
        ) : selectedDayLeads.length === 0 ? (
          <p className="cal-empty">No follow-ups scheduled for this day.</p>
        ) : (
          <ul className="cal-day-list">
            {selectedDayLeads.map((lead) => {
              const meta = statusMeta(lead.status)
              return (
                <li key={lead.id} className="cal-day-item">
                  <div className="cal-day-time">
                    {new Date(lead.next_followup_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="cal-day-info">
                    <div className="cal-day-name">{lead.lead_name}</div>
                    {lead.company && <div className="cal-day-company">{lead.company}</div>}
                  </div>
                  <span className="status-badge" style={{ '--badge-color': meta.color }}>{meta.label}</span>
                  {isManager && (
                    <span className="cal-day-assignee">{lead.assigned_profile?.full_name || 'Unassigned'}</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
