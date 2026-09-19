import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import './TodaysTasks.css'

export default function TodaysTasks() {
  const { profile, session } = useAuth()
  const isManager = ['admin', 'subadmin'].includes(profile?.role)
  const [counts, setCounts] = useState({ dueToday: 0, overdue: 0, proposals: 0 })

  useEffect(() => {
    async function load() {
      let query = supabase.from('leads').select('status, next_followup_date')
      if (!isManager && session?.user?.id) {
        query = query.eq('assigned_to', session.user.id)
      }
      const { data } = await query
      if (!data) return

      const today = new Date().toISOString().slice(0, 10)
      const dueToday = data.filter(
        (l) => l.next_followup_date?.slice(0, 10) === today && !['won_order', 'lost_order'].includes(l.status)
      ).length
      const overdue = data.filter(
        (l) => l.next_followup_date?.slice(0, 10) < today && !['won_order', 'lost_order'].includes(l.status)
      ).length
      const proposals = data.filter((l) => l.status === 'proposal_sent').length

      setCounts({ dueToday, overdue, proposals })
    }
    if (session?.user?.id) load()
  }, [isManager, session])

  const items = [
    { label: 'Follow-ups Due Today', value: counts.dueToday, color: '#5B8DEF' },
    { label: 'Overdue Follow-ups', value: counts.overdue, color: '#E5484D' },
    { label: 'Proposals to Send', value: counts.proposals, color: '#9B7FE0' }
  ]

  return (
    <div className="tasks-widget">
      <div className="tasks-widget-title">Today's Tasks</div>
      {items.map((item) => (
        <Link to="/leads" key={item.label} className="tasks-widget-item">
          <span className="tasks-widget-dot" style={{ background: item.color }} />
          <span className="tasks-widget-value">{item.value}</span>
          <span className="tasks-widget-label">{item.label}</span>
        </Link>
      ))}
    </div>
  )
}
