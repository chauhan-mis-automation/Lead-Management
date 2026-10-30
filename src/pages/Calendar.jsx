import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { STATUS_OPTIONS, statusMeta, actionTypeMeta } from '../lib/constants'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, ArrowUpRight, Filter, BellRing } from 'lucide-react'
import { statusTone, AnimatedStat } from '../components/dashboard/shared'
import './Calendar.css'
import './CalendarMint.css'

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
  const navigate = useNavigate()
  const { profile, session } = useAuth()
  const isManager = ['admin', 'subadmin'].includes(profile?.role)

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(dateKey(today))
  const [view, setView] = useState('month')

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
      .select('id, lead_name, company, status, next_followup_date, next_action_type, next_action_location, assigned_to, assigned_profile:profiles!leads_assigned_to_fkey(full_name)')
      .not('next_followup_date', 'is', null)
      .not('status', 'in', '(won_order,lost_order)')
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

  function selectDay(key) {
    setSelectedDate(key)
    const [y, m] = key.split('-').map(Number)
    if (y !== viewYear || m - 1 !== viewMonth) { setViewYear(y); setViewMonth(m - 1) }
  }

  function shiftWeek(delta) {
    const [y, m, d] = selectedDate.split('-').map(Number)
    const next = new Date(y, m - 1, d + delta * 7)
    selectDay(dateKey(next))
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

  const [sy, sm, sd] = selectedDate.split('-').map(Number)
  const selectedObj = new Date(sy, sm - 1, sd)
  const weekStart = new Date(sy, sm - 1, sd - selectedObj.getDay())
  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i))
  const todayKey = dateKey(today)

  const inMonth = leads.filter((l) => { const d = new Date(l.next_followup_date); return d.getMonth() === viewMonth && d.getFullYear() === viewYear })
  const todayCount = (leadsByDay[todayKey] || []).length
  const overdueCount = leads.filter((l) => dateKey(new Date(l.next_followup_date)) < todayKey).length
  const nextUp = [...leads].filter((l) => new Date(l.next_followup_date) >= today)
    .sort((a, b) => new Date(a.next_followup_date) - new Date(b.next_followup_date))[0]
  const fmtTime = (v) => new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const label = view === 'month'
    ? `${MONTH_NAMES[viewMonth]} ${viewYear}`
    : `${weekDays[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const onPrev = () => (view === 'month' ? shiftMonth(-1) : shiftWeek(-1))
  const onNext = () => (view === 'month' ? shiftMonth(1) : shiftWeek(1))

  const eventStyle = (lead) => ({ '--c': statusTone(lead.status) })

  return (
    <div className="cx">
      <div className="cx-head cx-pop">
        <div>
          <h1><span className="cx-head-icon"><CalendarDays size={20} /></span> Call Calendar</h1>
          <p>{isManager ? "Everyone's upcoming follow-ups" : 'Your upcoming follow-ups'}</p>
        </div>
        <div className="cx-stats">
          <div className="cx-stat s1"><b><AnimatedStat value={inMonth.length} /></b><span>In {MONTH_NAMES[viewMonth].slice(0, 3)}</span></div>
          <div className="cx-stat s2"><b><AnimatedStat value={todayCount} /></b><span>Today</span></div>
          <div className="cx-stat s3"><b><AnimatedStat value={overdueCount} /></b><span>Overdue</span></div>
        </div>
      </div>

      <div className="cx-layout">
        <aside className="cx-side">
          <div className="cx-card cx-pop" style={{ '--i': 1 }}>
            <div className="cx-mini-head">
              <b>{MONTH_NAMES[viewMonth].slice(0, 3)} {viewYear}</b>
              <div>
                <button onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={14} /></button>
                <button onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight size={14} /></button>
              </div>
            </div>
            <div className="cx-mini-week">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <span key={i}>{w}</span>)}</div>
            <div className="cx-mini-grid">
              {monthDays.map((d) => {
                const key = dateKey(d)
                const has = (leadsByDay[key] || []).length > 0
                return (
                  <button key={key} onClick={() => selectDay(key)}
                    className={'cx-mini-day' + (d.getMonth() !== viewMonth ? ' out' : '') + (key === todayKey ? ' today' : '') + (key === selectedDate ? ' sel' : '') + (has ? ' has' : '')}>
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="cx-next cx-pop" style={{ '--i': 2 }}>
            <i className="cx-next-orb" />
            <span className="cx-next-tag"><BellRing size={13} /> Next follow-up</span>
            {nextUp ? (
              <>
                <h4>{nextUp.company || nextUp.lead_name}</h4>
                <p className="cx-next-time"><Clock size={13} /> {new Date(nextUp.next_followup_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {fmtTime(nextUp.next_followup_date)}</p>
                <p className="cx-next-sub">{actionTypeMeta(nextUp.next_action_type).icon} {actionTypeMeta(nextUp.next_action_type).label} · {nextUp.lead_name}</p>
                <button onClick={() => navigate(`/leads/${nextUp.id}`)}>Open lead <ArrowUpRight size={14} /></button>
              </>
            ) : (
              <>
                <h4>All clear</h4>
                <p className="cx-next-sub">No upcoming follow-ups in this range.</p>
              </>
            )}
          </div>

          <div className="cx-card cx-pop" style={{ '--i': 3 }}>
            <div className="cx-card-title"><Filter size={14} /> Filters</div>
            <label className="cx-label">Status</label>
            <select className="cx-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              {STATUS_OPTIONS.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
            </select>
            {isManager && (
              <>
                <label className="cx-label">Assigned to</label>
                <select className="cx-select" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
                  <option value="">All Users</option>
                  {users.map((u) => (<option key={u.id} value={u.id}>{u.full_name}</option>))}
                </select>
              </>
            )}
            <div className="cx-legend">
              {STATUS_OPTIONS.filter((s) => !['lost_order', 'won_order', 'not_interested'].includes(s.value)).map((s) => (
                <span key={s.value} style={{ '--c': statusTone(s.value) }}><i />{s.label}</span>
              ))}
            </div>
          </div>
        </aside>

        <section className="cx-main">
          <div className="cx-toolbar cx-pop" style={{ '--i': 1 }}>
            <div className="cx-nav">
              <button className="cx-nav-btn" onClick={onPrev} aria-label="Previous"><ChevronLeft size={16} /></button>
              <span className="cx-label-main" key={label}>{label}</span>
              <button className="cx-nav-btn" onClick={onNext} aria-label="Next"><ChevronRight size={16} /></button>
              <button className="cx-today-btn" onClick={goToday}>Today</button>
            </div>
            <div className="cx-toggle">
              <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Month</button>
              <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>Week</button>
            </div>
          </div>

          {view === 'month' ? (
            <div className="cx-grid-wrap cx-pop" style={{ '--i': 2 }}>
              <div className="cx-weekdays">
                {WEEKDAYS.map((w, i) => (<div key={w} className={i === 0 || i === 6 ? 'weekend' : ''}>{w}</div>))}
              </div>
              <div className="cx-grid">
                {monthDays.map((d, i) => {
                  const key = dateKey(d)
                  const dayLeads = leadsByDay[key] || []
                  const visible = dayLeads.slice(0, 2)
                  const extra = dayLeads.length - visible.length
                  return (
                    <button key={key} style={{ animationDelay: `${Math.min(i, 24) * 14}ms` }}
                      className={'cx-cell' + (d.getMonth() === viewMonth ? '' : ' outside') + (key === todayKey ? ' today' : '') + (key === selectedDate ? ' selected' : '') + (dayLeads.length ? ' busy' : '')}
                      onClick={() => selectDay(key)}>
                      <span className="cx-date-top">
                        <span className="cx-date-num">{d.getDate()}</span>
                        {dayLeads.length > 0 && <span className="cx-count">{dayLeads.length}</span>}
                      </span>
                      <span className="cx-chips">
                        {visible.map((lead) => (
                          <span key={lead.id} className="cx-chip" style={eventStyle(lead)}>
                            <span>{actionTypeMeta(lead.next_action_type).icon}</span>{lead.company || lead.lead_name}
                          </span>
                        ))}
                        {extra > 0 && <span className="cx-more">+{extra} more</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="cx-week cx-pop" style={{ '--i': 2 }}>
              {weekDays.map((d, i) => {
                const key = dateKey(d)
                const dayLeads = [...(leadsByDay[key] || [])].sort((a, b) => new Date(a.next_followup_date) - new Date(b.next_followup_date))
                return (
                  <div key={key} className={'cx-wcol' + (key === todayKey ? ' today' : '') + (key === selectedDate ? ' sel' : '')} style={{ '--i': i }}>
                    <button className="cx-whead" onClick={() => selectDay(key)}>
                      <small>{WEEKDAYS[d.getDay()]}</small>
                      <b>{d.getDate()}</b>
                    </button>
                    <div className="cx-wbody">
                      {dayLeads.length === 0 && <span className="cx-wempty">No follow-ups</span>}
                      {dayLeads.map((lead) => (
                        <button key={lead.id} className="cx-wevent" style={eventStyle(lead)} onClick={() => navigate(`/leads/${lead.id}`)}>
                          <strong>{lead.company || lead.lead_name}</strong>
                          <span><Clock size={11} /> {fmtTime(lead.next_followup_date)}</span>
                          <em>{actionTypeMeta(lead.next_action_type).icon} {actionTypeMeta(lead.next_action_type).label}</em>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="cx-detail cx-pop" key={selectedDate} style={{ '--i': 0 }}>
            <div className="cx-detail-head">
              <h3>{new Date(sy, sm - 1, sd).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</h3>
              <span className="cx-detail-count">{selectedDayLeads.length} follow-up{selectedDayLeads.length === 1 ? '' : 's'}</span>
            </div>
            {loading ? (
              <p className="cx-empty">Loading…</p>
            ) : selectedDayLeads.length === 0 ? (
              <p className="cx-empty">No follow-ups scheduled for this day.</p>
            ) : (
              <ul className="cx-list">
                {selectedDayLeads.map((lead, i) => {
                  const meta = statusMeta(lead.status)
                  const aMeta = actionTypeMeta(lead.next_action_type)
                  return (
                    <li key={lead.id} className="cx-item" style={{ ...eventStyle(lead), '--i': i }} onClick={() => navigate(`/leads/${lead.id}`)}>
                      <div className="cx-item-time"><Clock size={13} />{fmtTime(lead.next_followup_date)}</div>
                      <div className="cx-item-main">
                        <div className="cx-item-name">{lead.lead_name}<span className="cx-item-type">{aMeta.icon} {aMeta.label}</span></div>
                        {lead.company && <div className="cx-item-sub">{lead.company}</div>}
                        {lead.next_action_location && <div className="cx-item-sub"><MapPin size={12} /> {lead.next_action_location}</div>}
                      </div>
                      <span className="cx-pill">{meta.label}</span>
                      {isManager && <span className="cx-assignee">{lead.assigned_profile?.full_name || 'Unassigned'}</span>}
                      <ArrowUpRight size={16} className="cx-arrow" />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
