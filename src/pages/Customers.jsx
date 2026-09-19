import { useEffect, useState, useCallback, Fragment } from 'react'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { orderStatusMeta } from '../lib/constants'
import './Customers.css'

export default function Customers() {
  const { profile, session } = useAuth()
  const role = profile?.role
  const isManager = ['admin', 'subadmin'].includes(role)
  const canView = ['admin', 'subadmin', 'sales'].includes(role)

  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)

    let customersQuery
    if (isManager) {
      customersQuery = supabase.from('customers').select('*').order('created_at', { ascending: false })
    } else {
      customersQuery = supabase
        .from('customers')
        .select('*, lead:leads!inner(assigned_to)')
        .eq('lead.assigned_to', session?.user?.id)
        .order('created_at', { ascending: false })
    }

    const [customersRes, ordersRes] = await Promise.all([
      customersQuery,
      supabase.from('orders').select('id, lead_id, order_number, order_value, status, order_date')
    ])

    setCustomers(customersRes.data || [])
    setOrders(ordersRes.data || [])
    setLoading(false)
  }, [isManager, session])

  useEffect(() => {
    if (canView) loadData()
  }, [canView, loadData])

  if (!canView) {
    return (
      <div>
        <h1>Customers</h1>
        <p className="customers-subtitle">This page is only available to Admin, Subadmin, and Sales.</p>
      </div>
    )
  }

  function ordersFor(customer) {
    return orders.filter((o) => o.lead_id === customer.lead_id)
  }

  const rows = customers
    .map((c) => {
      const theirOrders = ordersFor(c)
      const totalValue = theirOrders
        .filter((o) => o.status !== 'cancelled')
        .reduce((sum, o) => sum + (Number(o.order_value) || 0), 0)
      const lastOrderDate = theirOrders.length
        ? theirOrders.reduce((latest, o) => (o.order_date > latest ? o.order_date : latest), theirOrders[0].order_date)
        : null
      return { ...c, orderCount: theirOrders.length, totalValue, lastOrderDate, ordersList: theirOrders }
    })
    .filter((c) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return c.company_name?.toLowerCase().includes(q) || c.contact_name?.toLowerCase().includes(q)
    })

  return (
    <div>
      <div className="customers-header">
        <div>
          <h1>Customers</h1>
          <p className="customers-subtitle">Companies that have converted from a lead</p>
        </div>
      </div>

      <input
        className="text-input search-input"
        placeholder="Search by company or contact name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p className="customers-empty">Loading customers…</p>
      ) : rows.length === 0 ? (
        <div className="customers-empty-state">
          <p>No customers yet.</p>
          <span>A customer is created automatically when a lead is marked "Won Order".</span>
        </div>
      ) : (
        <div className="customers-table-wrap">
          <table className="customers-table">
            <thead>
              <tr>
                <th></th>
                <th>Company</th>
                <th>Contact</th>
                <th>Total Orders</th>
                <th>Total Value</th>
                <th>Last Order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <Fragment key={c.id}>
                  <tr
                    className="customer-row"
                    onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  >
                    <td className="expand-cell">
                      <span className={'expand-arrow' + (expandedId === c.id ? ' open' : '')}>›</span>
                    </td>
                    <td className="customer-name-cell">{c.company_name || '—'}</td>
                    <td>
                      <div>{c.contact_name || '—'}</div>
                      {(c.mobile || c.email) && (
                        <div className="customer-contact-sub">{c.mobile || c.email}</div>
                      )}
                    </td>
                    <td>{c.orderCount}</td>
                    <td>₹{c.totalValue.toLocaleString('en-IN')}</td>
                    <td>{c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  </tr>
                  {expandedId === c.id && (
                    <tr className="expand-row">
                      <td colSpan={6}>
                        {c.ordersList.length === 0 ? (
                          <p className="customers-empty" style={{ padding: '8px 0' }}>No orders yet for this customer.</p>
                        ) : (
                          <div className="mini-orders-list">
                            {c.ordersList.map((o) => {
                              const meta = orderStatusMeta(o.status)
                              return (
                                <div key={o.id} className="mini-order-item">
                                  <span className="mini-order-number">{o.order_number}</span>
                                  <span className="mini-order-value">
                                    {o.order_value ? `₹${Number(o.order_value).toLocaleString('en-IN')}` : '—'}
                                  </span>
                                  <span className="status-badge" style={{ '--badge-color': meta.color }}>{meta.label}</span>
                                  <span className="mini-order-date">
                                    {o.order_date ? new Date(o.order_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
