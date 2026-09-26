import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { quotationStatusMeta, orderStatusMeta, paymentStatusMeta } from '../lib/constants'
import { printRecord, moneyFmt, dateFmt } from '../lib/printUtils'
import './QuotationDetailModal.css'

export default function QuotationDetailModal({ quotationId, onClose }) {
  const navigate = useNavigate()
  const [quotation, setQuotation] = useState(null)
  const [items, setItems] = useState([])
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: q } = await supabase
        .from('quotations')
        .select('*, lead:leads(lead_name, company)')
        .eq('id', quotationId)
        .single()

      setQuotation(q)

      const [itemsRes, orderRes] = await Promise.all([
        supabase.from('quotation_items').select('*').eq('quotation_id', quotationId).order('created_at'),
        q?.lead_id
          ? supabase.from('orders').select('*').eq('lead_id', q.lead_id).maybeSingle()
          : Promise.resolve({ data: null })
      ])

      setItems(itemsRes.data || [])
      setOrder(orderRes.data || null)
      setLoading(false)
    }
    if (quotationId) load()
  }, [quotationId])

  if (!quotationId) return null

  const qMeta = quotation ? quotationStatusMeta(quotation.status) : null
  const oMeta = order ? orderStatusMeta(order.status) : null
  const pMeta = order ? paymentStatusMeta(order.payment_status) : null

  function handlePrint() {
    if (!quotation) return
    const itemsRows = items.length
      ? items.map((it) => `
          <tr>
            <td>${it.item_name}</td>
            <td class="num">${it.quantity}</td>
            <td class="num">${moneyFmt(it.rate)}</td>
            <td class="num">${it.discount_percent || 0}%</td>
            <td class="num">${it.tax_percent || 0}%</td>
            <td class="num">${moneyFmt(it.line_total)}</td>
          </tr>`).join('')
      : ''

    const body = `
      <div class="print-meta-grid">
        <div><span>Company</span><strong>${quotation.company || quotation.lead?.company || '—'}</strong></div>
        <div><span>Lead</span><strong>${quotation.lead?.lead_name || '—'}</strong></div>
        <div><span>Date</span><strong>${dateFmt(quotation.created_at)}</strong></div>
        <div><span>Valid Until</span><strong>${quotation.valid_until ? dateFmt(quotation.valid_until) : '—'}</strong></div>
        <div><span>Status</span><span class="print-badge">${qMeta.label}</span></div>
      </div>

      ${quotation.description ? `<h2>Description</h2><p class="print-notes">${quotation.description}</p>` : ''}

      ${itemsRows ? `
        <h2>Items</h2>
        <table>
          <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Disc %</th><th class="num">Tax %</th><th class="num">Line Total</th></tr></thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <div class="print-totals">
          <div><span>Subtotal</span><span>${moneyFmt(quotation.subtotal)}</span></div>
          <div><span>Discount</span><span>- ${moneyFmt(quotation.discount_total)}</span></div>
          <div><span>Tax</span><span>+ ${moneyFmt(quotation.tax_total)}</span></div>
          <div class="print-grand"><span>Grand Total</span><span>${moneyFmt(quotation.amount)}</span></div>
        </div>
      ` : `
        <h2>Amount</h2>
        <div class="print-totals"><div class="print-grand"><span>Grand Total</span><span>${moneyFmt(quotation.amount)}</span></div></div>
      `}

      ${quotation.terms ? `<h2>Terms & Notes</h2><p class="print-notes">${quotation.terms}</p>` : ''}
    `

    printRecord(`Quotation ${quotation.quotation_number || ''}`, body, { docName: 'Quotation', docNumber: quotation.quotation_number || '' })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card quote-detail-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{quotation?.quotation_number || 'Quotation Details'}</h2>
          <div className="modal-header-actions">
            {quotation && (
              <button type="button" className="print-btn" onClick={handlePrint}>🖨 Print</button>
            )}
            <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {loading || !quotation ? (
          <p className="quotes-empty">Loading…</p>
        ) : (
          <div className="quote-detail-body">
            <div className="quote-detail-top">
              <div>
                <div className="quote-detail-company">{quotation.company || quotation.lead?.company || '—'}</div>
                {quotation.lead?.lead_name && <div className="quote-detail-lead">{quotation.lead.lead_name}</div>}
              </div>
              <span className="status-badge" style={{ '--badge-color': qMeta.color }}>{qMeta.label}</span>
            </div>

            <div className="quote-detail-meta-grid">
              <div><span>Date</span><strong>{new Date(quotation.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
              <div><span>Valid Until</span><strong>{quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</strong></div>
              <div><span>Grand Total</span><strong>₹{Number(quotation.amount || 0).toLocaleString('en-IN')}</strong></div>
            </div>

            {quotation.description && (
              <p className="quote-detail-desc">{quotation.description}</p>
            )}

            {items.length > 0 && (
              <div className="quote-detail-section">
                <h4>Items</h4>
                <div className="quote-items-table-wrap">
                  <table className="quote-items-table">
                    <thead>
                      <tr><th>Item</th><th>Qty</th><th>Rate</th><th>Disc %</th><th>Tax %</th><th>Line Total</th></tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id}>
                          <td>{it.item_name}</td>
                          <td>{it.quantity}</td>
                          <td>₹{Number(it.rate).toLocaleString('en-IN')}</td>
                          <td>{it.discount_percent}%</td>
                          <td>{it.tax_percent}%</td>
                          <td className="line-total-cell">₹{Number(it.line_total).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="quote-totals">
                  <div><span>Subtotal</span><strong>₹{Number(quotation.subtotal || 0).toLocaleString('en-IN')}</strong></div>
                  <div><span>Discount</span><strong>- ₹{Number(quotation.discount_total || 0).toLocaleString('en-IN')}</strong></div>
                  <div><span>Tax</span><strong>+ ₹{Number(quotation.tax_total || 0).toLocaleString('en-IN')}</strong></div>
                  <div className="grand-total-row"><span>Grand Total</span><strong>₹{Number(quotation.amount || 0).toLocaleString('en-IN')}</strong></div>
                </div>
              </div>
            )}

            {quotation.terms && (
              <div className="quote-detail-section">
                <h4>Terms & Notes</h4>
                <p className="quote-detail-desc">{quotation.terms}</p>
              </div>
            )}

            {quotation.attachments && quotation.attachments.length > 0 && (
              <div className="quote-detail-section">
                <h4>Attachments</h4>
                <div className="quote-attachments-row">
                  {quotation.attachments.map((a, ai) => (
                    <a key={ai} href={a.url} target="_blank" rel="noreferrer" className="timeline-attachment-link">📎 {a.name}</a>
                  ))}
                </div>
              </div>
            )}

            <div className="quote-detail-section">
              <h4>Order Details</h4>
              {order ? (
                <button className="quote-order-card" onClick={() => { onClose(); navigate('/orders') }}>
                  <div className="quote-order-top">
                    <span className="quote-order-number">{order.order_number}</span>
                    <span className="status-badge" style={{ '--badge-color': oMeta.color }}>{oMeta.label}</span>
                  </div>
                  <div className="quote-order-grid">
                    <div><span>Order Value</span><strong>{order.order_value ? `₹${Number(order.order_value).toLocaleString('en-IN')}` : '—'}</strong></div>
                    <div><span>Paid</span><strong>₹{Number(order.paid_amount || 0).toLocaleString('en-IN')}</strong></div>
                    <div><span>Payment Status</span><span className="status-badge" style={{ '--badge-color': pMeta.color }}>{pMeta.label}</span></div>
                    <div><span>Order Date</span><strong>{order.order_date ? new Date(order.order_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</strong></div>
                  </div>
                  {order.project_details && <div className="quote-order-project">{order.project_details}</div>}
                  <span className="quote-order-arrow">View in Orders →</span>
                </button>
              ) : (
                <p className="quotes-empty" style={{ padding: '6px 0' }}>
                  No order yet for this lead. An order is created automatically once the lead is marked "Won Order".
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
