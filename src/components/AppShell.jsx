import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import logo from '../assets/logo.jpeg'
import NotificationBell from './NotificationBell'
import TopHeader from './TopHeader'
import TodaysTasks from './TodaysTasks'
import './AppShell.css'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '◧', roles: ['admin', 'subadmin', 'sales', 'bde', 'calling'] },
  { to: '/leads', label: 'Leads', icon: '☰', roles: ['admin', 'subadmin', 'sales', 'bde', 'calling'] },
  { to: '/calendar', label: 'Call Calendar', icon: '▦', roles: ['admin', 'subadmin', 'sales', 'bde', 'calling'] },
  { to: '/orders', label: 'Orders', icon: '◈', roles: ['admin', 'subadmin', 'sales', 'bde', 'calling'] },
  { to: '/customers', label: 'Customers', icon: '◎', roles: ['admin', 'subadmin', 'sales'] },
  { to: '/quotations', label: 'Quotations', icon: '▤', roles: ['admin', 'subadmin', 'sales', 'bde'] },
  { to: '/products', label: 'Products & Services', icon: '▧', roles: ['admin', 'subadmin', 'sales', 'bde', 'calling'] },
  { to: '/users', label: 'Users', icon: '◐', roles: ['admin'] },
  { to: '/reports', label: 'Reports & MIS', icon: '◓', roles: ['admin', 'subadmin'] }
]

export default function AppShell() {
  const { profile, session, signOut } = useAuth()
  const role = profile?.role
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))
  const activeLabel = visibleItems.find((item) => item.to === location.pathname)?.label || 'Menu'

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  return (
    <div className="shell">
      <TopHeader />

      {/* Mobile top bar */}
      <div className="shell-topbar">
        <button className="mobile-back-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
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

      <div
        className={'shell-overlay' + (menuOpen ? ' open' : '')}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <div className="shell-body">
        <aside className={'shell-sidebar' + (menuOpen ? ' open' : '')}>
          <div className="shell-brand">
            <img className="shell-logo" src={logo} alt="Wavexa Lead Generation" />
            <span className="shell-brand-name">Wavexa Lead Generation</span>
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

          <TodaysTasks />

          <div className="shell-help-box">
            <div className="shell-help-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="M9.5 9.2a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><circle cx="12" cy="17" r="0.9" fill="currentColor"/></svg>
            </div>
            <div>
              <div className="shell-help-title">Need Help?</div>
              <div className="shell-help-sub">Our team is always here.</div>
            </div>
          </div>

          <div className="shell-mobile-account">
            <div className="shell-mobile-account-info">
              <span className="shell-mobile-avatar">
                {(profile?.full_name || session?.user?.email || '?').charAt(0).toUpperCase()}
              </span>
              <div>
                <div className="shell-mobile-name">{profile?.full_name || session?.user?.email}</div>
                <div className="shell-mobile-role">{profile?.role}</div>
              </div>
            </div>
            <button className="shell-mobile-logout" onClick={signOut}>Logout</button>
          </div>
        </aside>

        <main className="shell-main">
          <div className="shell-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
