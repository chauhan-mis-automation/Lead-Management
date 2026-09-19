import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import logo from '../assets/logo.jpeg'
import NotificationBell from './NotificationBell'
import './TopHeader.css'

const ROLE_LABELS = { admin: 'Admin', subadmin: 'Subadmin', sales: 'Sales', bde: 'BDE', calling: 'Calling' }

export default function TopHeader() {
  const { profile, session, signOut } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function handleSearchSubmit(e) {
    e.preventDefault()
    if (search.trim()) {
      navigate(`/leads?search=${encodeURIComponent(search.trim())}`)
    }
  }

  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const dayLabel = today.toLocaleDateString('en-IN', { weekday: 'long' })

  return (
    <header className="top-header">
      <button className="top-header-back" onClick={() => navigate(-1)} aria-label="Go back" title="Go back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>

      <div className="top-header-brand">
        <img src={logo} alt="Chauhan MIS Automation Services" className="top-header-logo" />
        <div>
          <div className="top-header-title">Chauhan MIS <span>Automation Service</span></div>
          <div className="top-header-tagline">Lead to Order · Track · Follow Up · Convert</div>
        </div>
      </div>

      <div className="top-header-date">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
        <div>
          <div className="top-header-date-main">{dateLabel}</div>
          <div className="top-header-date-sub">{dayLabel}</div>
        </div>
      </div>

      <form className="top-header-search" onSubmit={handleSearchSubmit}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/><path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        <input
          placeholder="Search lead, company, contact…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>

      <div className="top-header-actions">
        <NotificationBell />

        <div className="top-header-profile" ref={menuRef}>
          <button className="top-header-profile-btn" onClick={() => setMenuOpen((o) => !o)}>
            <span className="top-header-avatar">
              {(profile?.full_name || session?.user?.email || '?').charAt(0).toUpperCase()}
            </span>
            <span className="top-header-profile-info">
              <span className="top-header-name">{profile?.full_name || session?.user?.email}</span>
              <span className="top-header-role">{ROLE_LABELS[profile?.role] || profile?.role}</span>
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>

          {menuOpen && (
            <div className="top-header-dropdown">
              <button onClick={signOut}>Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
