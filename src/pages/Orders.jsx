import { useEffect, useState, useCallback, Fragment } from 'react'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { ORDER_STATUS_OPTIONS, orderStatusMeta, PAYMENT_STATUS_OPTIONS, paymentStatusMeta, paymentModeLabel } from '../lib/constants'
import OrderFormModal from '../components/OrderFormModal'
import PaymentFormModal from '../components/PaymentFormModal'
import { printRecord, moneyFmt, dateFmt } from '../lib/printUtils'
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
  const [paymentFilter, setPaymentFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [payingOrder, setPayingOrder] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [expandedPayments, setExpandedPayments] = useState({})

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError('')

    if (isManager) {
      let query = supabase
        .from('orders')
        .select('*, lead:leads!orders_lead_id_fkey(lead_name, assigned_to)')
        .order('created_at', { ascending: false })
      if (statusFilter) query = query.eq('status', statusFilter)
      if (paymentFilter) query = query.eq('payment_status', paymentFilter)

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
      let deduped = Array.from(new Map(combined.map((o) => [o.id, o])).values())
      if (statusFilter) deduped = deduped.filter((o) => o.status === statusFilter)
      if (paymentFilter) deduped = deduped.filter((o) => o.payment_status === paymentFilter)
      deduped.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      if (mineRes.error) setError(mineRes.error.message)
      setOrders(deduped)
    }

    setLoading(false)
  }, [isManager, session, statusFilter, paymentFilter])

  useEffect(() => {
    if (role) loadOrders()
  }, [role, loadOrders])

  async function toggleExpand(o) {
    if (expandedId === o.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(o.id)
    if (!expandedPayments[o.id]) {
      const { data } = await supabase.from('payments').select('*').eq('order_id', o.id).order('payment_date', { ascending: false })
      setExpandedPayments((prev) => ({ ...prev, [o.id]: data || [] }))
    }
  }

  async function refreshOrderRow(orderId) {
    const { data } = await supabase
      .from('orders')
      .select('*, lead:leads!orders_lead_id_fkey(lead_name, assigned_to)')
      .eq('id', orderId)
      .single()
    if (data) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? data : o)))
    }
    const { data: paymentsData } = await supabase.from('payments').select('*').eq('order_id', orderId).order('payment_date', { ascending: false })
    setExpandedPayments((prev) => ({ ...prev, [orderId]: paymentsData || [] }))
  }

  async function handlePrintOrder(o) {
    let payments = expandedPayments[o.id]
    if (!payments) {
      const { data } = await supabase.from('payments').select('*').eq('order_id', o.id).order('payment_date', { ascending: false })
      payments = data || []
      setExpandedPayments((prev) => ({ ...prev, [o.id]: payments }))
    }

    const meta = orderStatusMeta(o.status)
    const payMeta = paymentStatusMeta(o.payment_status)
    const remaining = Math.max(0, Number(o.order_value || 0) - Number(o.paid_amount || 0))

    const paymentRows = payments.length
      ? payments.map((p) => `
          <tr>
            <td>${dateFmt(p.payment_date)}</td>
            <td>${paymentModeLabel(p.payment_mode)}</td>
            <td class="num">${moneyFmt(p.amount)}</td>
            <td>${p.notes || '—'}</td>
          </tr>`).join('')
      : ''

    const body = `
      <div class="print-meta-grid">
        <div><span>Company</span><strong>${o.company || o.lead?.lead_name || '—'}</strong></div>
        <div><span>Order Date</span><strong>${dateFmt(o.order_date)}</strong></div>
        <div><span>Status</span><span class="print-badge">${meta.label}</span></div>
        <div><span>Payment Status</span><span class="print-badge">${payMeta.label}</span></div>
      </div>

      ${o.project_details ? `<h2>Project Details</h2><p class="print-notes">${o.project_details}</p>` : ''}

      <h2>Payment Summary</h2>
      <div class="print-totals" style="margin-left:0; width:100%; max-width:320px;">
        <div><span>Order Value</span><span>${moneyFmt(o.order_value)}</span></div>
        <div><span>Paid</span><span>${moneyFmt(o.paid_amount)}</span></div>
        <div class="print-grand"><span>Remaining</span><span>${moneyFmt(remaining)}</span></div>
      </div>

      ${paymentRows ? `
        <h2>Payment History</h2>
        <table>
          <thead><tr><th>Date</th><th>Mode</th><th class="num">Amount</th><th>Notes</th></tr></thead>
          <tbody>${paymentRows}</tbody>
        </table>
      ` : ''}
    `

    printRecord(`Order ${o.order_number}`, body, { docName: 'Order', docNumber: o.order_number })
  }

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

  const totalPending = filteredOrders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Math.max(0, Number(o.order_value || 0) - Number(o.paid_amount || 0)), 0)

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
        <div className="orders-summary-item warn">
          <span className="orders-summary-value">₹{totalPending.toLocaleString('en-IN')}</span>
          <span className="orders-summary-label">Pending Payment</span>
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
        <select className="text-input" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
          <option value="">All Payment Status</option>
          {PAYMENT_STATUS_OPTIONS.map((s) => (
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
        <div className="orders-table-wrap mobile-card-table">
          <table className="orders-table">
            <thead>
              <tr>
                <th></th>
                <th>Order No.</th>
                <th>Company</th>
                <th>Value</th>
                <th>Paid</th>
                <th>Remaining</th>
                <th>Status</th>
                <th>Payment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => {
                const meta = orderStatusMeta(o.status)
                const payMeta = paymentStatusMeta(o.payment_status)
                const remaining = Math.max(0, Number(o.order_value || 0) - Number(o.paid_amount || 0))
                const isOpen = expandedId === o.id
                return (
                  <Fragment key={o.id}>
                    <tr className="order-row" onClick={() => toggleExpand(o)}>
                      <td className="expand-cell">
                        <span className={'expand-arrow' + (isOpen ? ' open' : '')}>›</span>
                      </td>
                      <td className="order-number-cell" data-label="Order No.">{o.order_number}</td>
                      <td data-label="Company">{o.company || o.lead?.lead_name || '—'}</td>
                      <td data-label="Value">{o.order_value ? `₹${Number(o.order_value).toLocaleString('en-IN')}` : '—'}</td>
                      <td data-label="Paid">₹{Number(o.paid_amount || 0).toLocaleString('en-IN')}</td>
                      <td className={remaining > 0 ? 'remaining-due' : ''} data-label="Remaining">₹{remaining.toLocaleString('en-IN')}</td>
                      <td data-label="Status"><span className="status-badge" style={{ '--badge-color': meta.color }}>{meta.label}</span></td>
                      <td data-label="Payment"><span className="status-badge" style={{ '--badge-color': payMeta.color }}>{payMeta.label}</span></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="order-row-actions">
                          <button className="icon-btn" title="Print order" onClick={() => handlePrintOrder(o)}>🖨</button>
                          {remaining > 0 && (isManager || o.created_by === session?.user?.id) && (
                            <button className="btn-ghost small" onClick={() => setPayingOrder(o)}>+ Payment</button>
                          )}
                          {(isManager || o.created_by === session?.user?.id) && (
                            <button className="icon-btn" title="Edit order" onClick={() => setEditingOrder(o)}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 15.5V20Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="order-expand-row">
                        <td colSpan={9}>
                          <div className="payments-panel">
                            <div className="payments-panel-head">
                              <span>Payment History</span>
                              {remaining > 0 && (isManager || o.created_by === session?.user?.id) && (
                                <button className="btn-ghost small" onClick={() => setPayingOrder(o)}>+ Add Payment</button>
                              )}
                            </div>
                            {!expandedPayments[o.id] ? (
                              <p className="orders-empty" style={{ padding: '8px 0' }}>Loading…</p>
                            ) : expandedPayments[o.id].length === 0 ? (
                              <p className="orders-empty" style={{ padding: '8px 0' }}>No payments recorded yet.</p>
                            ) : (
                              <div className="mini-payments-list">
                                {expandedPayments[o.id].map((p) => (
                                  <div key={p.id} className="mini-payment-row">
                                    <span className="mini-payment-amount">₹{Number(p.amount).toLocaleString('en-IN')}</span>
                                    <span>{paymentModeLabel(p.payment_mode)}</span>
                                    <span>{new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                    {p.notes && <span className="mini-payment-notes">{p.notes}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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

      {payingOrder && (
        <PaymentFormModal
          order={payingOrder}
          currentUserId={session?.user?.id}
          onClose={() => setPayingOrder(null)}
          onSaved={async () => {
            const orderId = payingOrder.id
            setPayingOrder(null)
            await refreshOrderRow(orderId)
          }}
        />
      )}
    </div>
  )
}
