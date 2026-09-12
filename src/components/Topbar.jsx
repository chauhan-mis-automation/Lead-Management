import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import NotificationBell from './NotificationBell'
import './Topbar.css'

const ROLE_LABELS = { admin: 'Admin', subadmin: 'Subadmin', sales: 'Sales', bde: 'BDE', calling: 'Calling' }

export default function Topbar() {
  const { profile, session } = useAuth()
  const fullName = profile?.full_name || session?.user?.email || ''
  const [visibleCount, setVisibleCount] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!fullName) return
    setVisibleCount(0)
    setDone(false)
    let i = 0
    const interval = setInterval(() => {
      i += 1
      setVisibleCount(i)
      if (i >= fullName.length) {
        clearInterval(interval)
        setDone(true)
      }
    }, 45)
    return () => clearInterval(interval)
  }, [fullName])

  return (
    <header className="topbar">
      <div className="topbar-greeting">
        <span className="topbar-eyebrow">Welcome back</span>
        <h2 className="topbar-name">
          {fullName.slice(0, visibleCount)}
          <span className={'topbar-cursor' + (done ? ' done' : '')} />
        </h2>
        {profile?.role && <span className="topbar-role">{ROLE_LABELS[profile.role] || profile.role}</span>}
      </div>

      <NotificationBell />
    </header>
  )
}
