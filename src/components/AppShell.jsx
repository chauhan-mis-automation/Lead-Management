import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import logo from '../assets/logo.jpeg'
import NotificationBell from './NotificationBell'
import Topbar from './Topbar'
import './AppShell.css'

const ROLE_LABELS = {
  admin: 'Admin',
  subadmin: 'Subadmin',
  sales: 'Sales',
  bde: 'BDE',
  calling: 'Calling'
}

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '◧', roles: ['admin', 'subadmin', 'sales', 'bde', 'calling'] },
  { to: '/leads', label: 'Leads', icon: '☰', roles: ['admin', 'subadmin', 'sales', 'bde', 'calling'] },
  { to: '/calendar', label: 'Calendar', icon: '▦', roles: ['admin', 'subadmin', 'sales', 'bde', 'calling'] },
  { to: '/users', label: 'Users', icon: '◐', roles: ['admin'] },
  { to: '/reports', label: 'Reports & MIS', icon: '◓', roles: ['admin', 'subadmin'] }
]

export default function AppShell() {
  const { profile, session, signOut } = useAuth()
  const role = profile?.role
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))
  const activeLabel = visibleItems.find((item) => item.to === location.pathname)?.label || 'Menu'

  // close the drawer automatically whenever the route changes
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // lock page scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  return (
    <div className="shell">
      {/* Mobile top bar */}
      <div className="shell-topbar">
        <button
          className="hamburger-btn"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="shell-topbar-title">{activeLabel}</div>
        <div className="shell-topbar-right">
          <NotificationBell />
          <div className="shell-topbar-avatar">
            {(profile?.full_name || session?.user?.email || '?').charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Overlay behind the drawer */}
      <div
        className={'shell-overlay' + (menuOpen ? ' open' : '')}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <aside className={'shell-sidebar' + (menuOpen ? ' open' : '')}>
        <div className="shell-brand">
          <img className="shell-logo" src={logo} alt="Chauhan MIS Automation Services" />
          <span className="shell-brand-name">Chauhan MIS Automation Services</span>
          <button className="drawer-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button>
        </div>

        <nav className="shell-nav">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => 'shell-nav-item' + (isActive ? ' active' : '')}
            >
              <span className="shell-nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="shell-user">
          <div className="shell-user-avatar">
            {(profile?.full_name || session?.user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="shell-user-info">
            <span className="shell-user-name">{profile?.full_name || session?.user?.email}</span>
            <span className="shell-user-role">{ROLE_LABELS[role] || role}</span>
          </div>
          <button className="shell-logout" onClick={signOut}>Logout</button>
        </div>
      </aside>

      <main className="shell-main">
        <Topbar />
        <div className="shell-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
