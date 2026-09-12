import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import './NotificationBell.css'

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function NotificationBell() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const userId = session?.user?.id

  const [open, setOpen] = useState(false)
  const [assignments, setAssignments] = useState([])
  const [followups, setFollowups] = useState([])
  const wrapRef = useRef(null)
  const instanceId = useRef(Math.random().toString(36).slice(2)).current

  const loadAssignments = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
    setAssignments(data || [])
  }, [userId])

  const loadFollowups = useCallback(async () => {
    if (!userId) return
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)

    const { data } = await supabase
      .from('leads')
      .select('id, lead_name, company, next_followup_date, status')
      .eq('assigned_to', userId)
      .not('next_followup_date', 'is', null)
      .lte('next_followup_date', endOfToday.toISOString())

    const relevant = (data || []).filter((l) => !['won_order', 'lost_order'].includes(l.status))
    setFollowups(relevant)
  }, [userId])

  useEffect(() => {
    loadAssignments()
    loadFollowups()
  }, [loadAssignments, loadFollowups])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('notifications-' + userId + '-' + instanceId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => setAssignments((prev) => [payload.new, ...prev])
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const overdue = followups.filter((f) => f.next_followup_date.slice(0, 10) < today)
  const dueToday = followups.filter((f) => f.next_followup_date.slice(0, 10) === today)
  const unreadCount = assignments.filter((a) => !a.is_read).length + overdue.length + dueToday.length

  async function markAllRead() {
    const unreadIds = assignments.filter((a) => !a.is_read).map((a) => a.id)
    if (unreadIds.length > 0) {
      await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
      setAssignments((prev) => prev.map((a) => ({ ...a, is_read: true })))
    }
  }

  async function handleAssignmentClick(item) {
    if (!item.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', item.id)
      setAssignments((prev) => prev.map((a) => (a.id === item.id ? { ...a, is_read: true } : a)))
    }
    setOpen(false)
    if (item.lead_id) navigate(`/leads/${item.lead_id}`)
  }

  function handleFollowupClick(lead) {
    setOpen(false)
    navigate(`/leads/${lead.id}`)
  }

  const hasAny = overdue.length + dueToday.length + assignments.length > 0

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button className="notif-bell" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
          <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9.5 17a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span>Notifications</span>
            {assignments.some((a) => !a.is_read) && (
              <button className="notif-mark-read" onClick={markAllRead}>Mark all read</button>
            )}
          </div>

          <div className="notif-list">
            {!hasAny && <p className="notif-empty">You're all caught up.</p>}

            {overdue.map((lead) => (
              <button key={'ov-' + lead.id} className="notif-item overdue" onClick={() => handleFollowupClick(lead)}>
                <span className="notif-dot" />
                <div>
                  <p className="notif-msg">Follow-up overdue: <strong>{lead.lead_name}</strong>{lead.company ? ` (${lead.company})` : ''}</p>
                  <span className="notif-time">Was due {new Date(lead.next_followup_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                </div>
              </button>
            ))}

            {dueToday.map((lead) => (
              <button key={'due-' + lead.id} className="notif-item due" onClick={() => handleFollowupClick(lead)}>
                <span className="notif-dot" />
                <div>
                  <p className="notif-msg">Follow-up due today: <strong>{lead.lead_name}</strong>{lead.company ? ` (${lead.company})` : ''}</p>
                  <span className="notif-time">
                    {new Date(lead.next_followup_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </button>
            ))}

            {assignments.map((item) => (
              <button
                key={item.id}
                className={'notif-item' + (item.is_read ? '' : ' unread')}
                onClick={() => handleAssignmentClick(item)}
              >
                <span className="notif-dot assignment" />
                <div>
                  <p className="notif-msg">{item.message}</p>
                  <span className="notif-time">{timeAgo(item.created_at)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
