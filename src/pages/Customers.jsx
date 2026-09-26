import { useEffect, useState, useCallback, Fragment } from 'react'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { orderStatusMeta, paymentStatusMeta } from '../lib/constants'
import { printRecord, moneyFmt, dateFmt } from '../lib/printUtils'
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
  const [paymentFilter, setPaymentFilter] = useState('')
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
      supabase.from('orders').select('id, lead_id, order_number, order_value, paid_amount, payment_status, status, order_date')
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

  function handlePrintCustomer(c) {
    const orderRows = c.ordersList.length
      ? c.ordersList.map((o) => {
          const meta = orderStatusMeta(o.status)
          const payMeta = paymentStatusMeta(o.payment_status)
          return `
            <tr>
              <td>${o.order_number}</td>
              <td class="num">${moneyFmt(o.order_value)}</td>
              <td>${meta.label}</td>
              <td>${payMeta.label}</td>
              <td>${dateFmt(o.order_date)}</td>
            </tr>`
        }).join('')
      : ''

    const body = `
      <div class="print-meta-grid">
        <div><span>Company</span><strong>${c.company_name || '—'}</strong></div>
        <div><span>Contact</span><strong>${c.contact_name || '—'}</strong></div>
        <div><span>Mobile</span><strong>${c.mobile || '—'}</strong></div>
        <div><span>Email</span><strong>${c.email || '—'}</strong></div>
      </div>

      <h2>Business Summary</h2>
      <div class="print-totals" style="margin-left:0; width:100%; max-width:360px;">
        <div><span>Total Orders</span><span>${c.orderCount}</span></div>
        <div><span>Total Value</span><span>${moneyFmt(c.totalValue)}</span></div>
        <div><span>Paid</span><span>${moneyFmt(c.paidValue)}</span></div>
        <div class="print-grand"><span>Pending</span><span>${moneyFmt(c.pendingValue)}</span></div>
      </div>

      ${orderRows ? `
        <h2>Order History</h2>
        <table>
          <thead><tr><th>Order No.</th><th class="num">Value</th><th>Status</th><th>Payment</th><th>Date</th></tr></thead>
          <tbody>${orderRows}</tbody>
        </table>
      ` : ''}
    `

    printRecord(`Customer ${c.company_name || ''}`, body, { docName: 'Customer Profile', docNumber: '' })
  }

  const allRows = customers.map((c) => {
    const theirOrders = ordersFor(c)
    const activeOrders = theirOrders.filter((o) => o.status !== 'cancelled')
    const totalValue = activeOrders.reduce((sum, o) => sum + (Number(o.order_value) || 0), 0)
    const paidValue = activeOrders.reduce((sum, o) => sum + (Number(o.paid_amount) || 0), 0)
    const pendingValue = Math.max(0, totalValue - paidValue)
    const lastOrderDate = theirOrders.length
      ? theirOrders.reduce((latest, o) => (o.order_date > latest ? o.order_date : latest), theirOrders[0].order_date)
      : null
    return {
      ...c,
      orderCount: theirOrders.length,
      totalValue,
      paidValue,
      pendingValue,
      lastOrderDate,
      ordersList: theirOrders
    }
  })

  const rows = allRows
    .filter((c) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return c.company_name?.toLowerCase().includes(q) || c.contact_name?.toLowerCase().includes(q)
    })
    .filter((c) => {
      if (!paymentFilter) return true
      if (paymentFilter === 'pending') return c.pendingValue > 0
      if (paymentFilter === 'paid') return c.orderCount > 0 && c.pendingValue === 0
      return true
    })

  const totalCustomers = allRows.length
  const totalOrders = allRows.reduce((sum, c) => sum + c.orderCount, 0)
  const totalBusinessValue = allRows.reduce((sum, c) => sum + c.totalValue, 0)
  const totalPending = allRows.reduce((sum, c) => sum + c.pendingValue, 0)

  return (
    <div>
      <div className="customers-header">
        <div>
          <h1>Customers</h1>
          <p className="customers-subtitle">Companies that have converted from a lead</p>
        </div>
      </div>

      <div className="customers-stat-grid">
        <div className="customers-stat-card">
          <span className="customers-stat-value">{totalCustomers}</span>
          <span className="customers-stat-label">Total Customers</span>
        </div>
        <div className="customers-stat-card">
          <span className="customers-stat-value">{totalOrders}</span>
          <span className="customers-stat-label">Total Orders</span>
        </div>
        <div className="customers-stat-card good">
          <span className="customers-stat-value">₹{totalBusinessValue.toLocaleString('en-IN')}</span>
          <span className="customers-stat-label">Total Business Value</span>
        </div>
        <div className="customers-stat-card warn">
          <span className="customers-stat-value">₹{totalPending.toLocaleString('en-IN')}</span>
          <span className="customers-stat-label">Total Pending Payment</span>
        </div>
      </div>

      <div className="customers-filters">
        <input
          className="text-input search-input"
          placeholder="Search by company or contact name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="text-input" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
          <option value="">All Customers</option>
          <option value="pending">Has Pending Payment</option>
          <option value="paid">Fully Paid</option>
        </select>
      </div>

      {loading ? (
        <p className="customers-empty">Loading customers…</p>
      ) : rows.length === 0 ? (
        <div className="customers-empty-state">
          <p>No customers found.</p>
          <span>A customer is created automatically when a lead is marked "Won Order".</span>
        </div>
      ) : (
        <div className="customers-table-wrap mobile-card-table">
          <table className="customers-table">
            <thead>
              <tr>
                <th></th>
                <th>Company</th>
                <th>Contact</th>
                <th>Orders</th>
                <th>Total Value</th>
                <th>Pending</th>
                <th>Last Order</th>
                <th></th>
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
                    <td className="customer-name-cell" data-label="Company">{c.company_name || '—'}</td>
                    <td data-label="Contact">
                      <div>{c.contact_name || '—'}</div>
                      {(c.mobile || c.email) && (
                        <div className="customer-contact-sub">{c.mobile || c.email}</div>
                      )}
                    </td>
                    <td data-label="Orders">{c.orderCount}</td>
                    <td data-label="Total Value">₹{c.totalValue.toLocaleString('en-IN')}</td>
                    <td className={c.pendingValue > 0 ? 'pending-due' : ''} data-label="Pending">₹{c.pendingValue.toLocaleString('en-IN')}</td>
                    <td data-label="Last Order">{c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="icon-btn" title="Print customer" onClick={() => handlePrintCustomer(c)}>🖨</button>
                    </td>
                  </tr>
                  {expandedId === c.id && (
                    <tr className="expand-row">
                      <td colSpan={8}>
                        {c.ordersList.length === 0 ? (
                          <p className="customers-empty" style={{ padding: '8px 0' }}>No orders yet for this customer.</p>
                        ) : (
                          <div className="mini-orders-list">
                            {c.ordersList.map((o) => {
                              const meta = orderStatusMeta(o.status)
                              const payMeta = paymentStatusMeta(o.payment_status)
                              return (
                                <div key={o.id} className="mini-order-item">
                                  <span className="mini-order-number">{o.order_number}</span>
                                  <span className="mini-order-value">
                                    {o.order_value ? `₹${Number(o.order_value).toLocaleString('en-IN')}` : '—'}
                                  </span>
                                  <span className="status-badge" style={{ '--badge-color': meta.color }}>{meta.label}</span>
                                  <span className="status-badge" style={{ '--badge-color': payMeta.color }}>{payMeta.label}</span>
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
