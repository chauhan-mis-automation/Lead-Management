import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import LeadsList from './pages/LeadsList'
import LeadDetail from './pages/LeadDetail'
import CalendarPage from './pages/Calendar'
import BulkUpload from './pages/BulkUpload'
import Reports from './pages/Reports'
import Orders from './pages/Orders'
import Customers from './pages/Customers'
import Quotations from './pages/Quotations'
import Products from './pages/Products'
import Users from './pages/Users'
import AppShell from './components/AppShell'

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  return children
}

function FullScreenLoader() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      color: 'var(--text-secondary)',
      fontFamily: 'Inter, sans-serif'
    }}>
      Loading…
    </div>
  )
}

function AppRoutes() {
  const { session, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <FullScreenLoader /> : session ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/leads" element={<LeadsList />} />
        <Route path="/leads/bulk-upload" element={<BulkUpload />} />
        <Route path="/leads/:id" element={<LeadDetail />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/users" element={<Users />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/quotations" element={<Quotations />} />
        <Route path="/products" element={<Products />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
