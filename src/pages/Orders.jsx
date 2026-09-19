import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { ORDER_STATUS_OPTIONS, orderStatusMeta } from '../lib/constants'
import OrderFormModal from '../components/OrderFormModal'
import './Orders.css'

export default function Orders() {
  const { profile, session } = useAuth()
  const role = profile?.role
  const isManager = ['admin', 'subadmin'].includes(role)
  const canCreate = ['admin', 'subadmin', 'sales'].includes(role)

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError('')

    if (isManager) {
      let query = supabase
        .from('orders')
        .select('*, lead:leads!orders_lead_id_fkey(lead_name, assigned_to)')
        .order('created_at', { ascending: false })
      if (statusFilter) query = query.eq('status', statusFilter)

      const { data, error: fetchError } = await query
      if (fetchError) setError(fetchError.message)
      setOrders(data || [])
    } else {
      const [mineRes, assignedRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*, lead:leads!orders_lead_id_fkey(lead_name, assigned_to)')
          .eq('created_by', session?.user?.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select('*, lead:leads!inner(lead_name, assigned_to)')
          .eq('lead.assigned_to', session?.user?.id)
          .order('created_at', { ascending: false })
      ])

      const combined = [...(mineRes.data || []), ...(assignedRes.data || [])]
      const deduped = Array.from(new Map(combined.map((o) => [o.id, o])).values())
      const filtered = statusFilter ? deduped.filter((o) => o.status === statusFilter) : deduped
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      if (mineRes.error) setError(mineRes.error.message)
      setOrders(filtered)
    }

    setLoading(false)
  }, [isManager, session, statusFilter])

  useEffect(() => {
    if (role) loadOrders()
  }, [role, loadOrders])

  const filteredOrders = orders.filter((o) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      o.order_number?.toLowerCase().includes(q) ||
      o.company?.toLowerCase().includes(q) ||
      o.lead?.lead_name?.toLowerCase().includes(q)
    )
  })

  const totalValue = filteredOrders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (Number(o.order_value) || 0), 0)

  return (
    <div>
      <div className="orders-header">
        <div>
          <h1>Orders</h1>
          <p className="orders-subtitle">{isManager ? 'All orders' : 'Your orders'}</p>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ New Order</button>
        )}
      </div>

      <div className="orders-summary">
        <div className="orders-summary-item">
          <span className="orders-summary-value">{filteredOrders.length}</span>
          <span className="orders-summary-label">Orders</span>
        </div>
        <div className="orders-summary-item">
          <span className="orders-summary-value">₹{totalValue.toLocaleString('en-IN')}</span>
          <span className="orders-summary-label">Total Value</span>
        </div>
      </div>

      <div className="orders-filters">
        <input
          className="text-input search-input"
          placeholder="Search by order no., company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="text-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {ORDER_STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <p className="orders-empty">Loading orders…</p>
      ) : filteredOrders.length === 0 ? (
        <div className="orders-empty-state">
          <p>No orders found.</p>
          <span>Orders are created automatically when a lead is marked "Won", or manually here.</span>
        </div>
      ) : (
        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order No.</th>
                <th>Company</th>
                <th>Value</th>
                <th>Status</th>
                <th>Order Date</th>
                <th>Delivery</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => {
                const meta = orderStatusMeta(o.status)
                return (
                  <tr key={o.id}>
                    <td className="order-number-cell">{o.order_number}</td>
                    <td>{o.company || o.lead?.lead_name || '—'}</td>
                    <td>{o.order_value ? `₹${Number(o.order_value).toLocaleString('en-IN')}` : '—'}</td>
                    <td>
                      <span className="status-badge" style={{ '--badge-color': meta.color }}>{meta.label}</span>
                    </td>
                    <td>{o.order_date ? new Date(o.order_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td>{o.delivery_date ? new Date(o.delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
                    <td>
                      {(isManager || o.created_by === session?.user?.id) && (
                        <button className="icon-btn" title="Edit order" onClick={() => setEditingOrder(o)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 15.5V20Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <OrderFormModal
          currentUserId={session?.user?.id}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadOrders() }}
        />
      )}

      {editingOrder && (
        <OrderFormModal
          order={editingOrder}
          currentUserId={session?.user?.id}
          onClose={() => setEditingOrder(null)}
          onSaved={() => { setEditingOrder(null); loadOrders() }}
        />
      )}
    </div>
  )
}
