import { useEffect, useState, useCallback, Fragment } from 'react'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { QUOTATION_STATUS_OPTIONS, quotationStatusMeta } from '../lib/constants'
import { generateQuotationPDF } from '../lib/quotationPdf'
import { printRecord, moneyFmt, dateFmt } from '../lib/printUtils'
import QuotationFormModal from '../components/QuotationFormModal'
import './Quotations.css'

export default function Quotations() {
  const { profile, session } = useAuth()
  const role = profile?.role
  const isManager = ['admin', 'subadmin'].includes(role)
  const canCreate = ['admin', 'subadmin', 'sales', 'bde'].includes(role)

  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingQuote, setEditingQuote] = useState(null)
  const [converting, setConverting] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [expandedItems, setExpandedItems] = useState({})

  const loadQuotations = useCallback(async () => {
    setLoading(true)
    setError('')

    if (isManager) {
      let query = supabase
        .from('quotations')
        .select('*, lead:leads(lead_name)')
        .order('created_at', { ascending: false })
      if (statusFilter) query = query.eq('status', statusFilter)
      const { data, error: fetchError } = await query
      if (fetchError) setError(fetchError.message)
      setQuotations(data || [])
    } else {
      const [mineRes, assignedRes] = await Promise.all([
        supabase.from('quotations').select('*, lead:leads(lead_name)').eq('created_by', session?.user?.id).order('created_at', { ascending: false }),
        supabase.from('quotations').select('*, lead:leads!inner(lead_name, assigned_to)').eq('lead.assigned_to', session?.user?.id).order('created_at', { ascending: false })
      ])
      const combined = [...(mineRes.data || []), ...(assignedRes.data || [])]
      const deduped = Array.from(new Map(combined.map((q) => [q.id, q])).values())
      const filtered = statusFilter ? deduped.filter((q) => q.status === statusFilter) : deduped
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      if (mineRes.error) setError(mineRes.error.message)
      setQuotations(filtered)
    }
    setLoading(false)
  }, [isManager, session, statusFilter])

  useEffect(() => {
    if (role) loadQuotations()
  }, [role, loadQuotations])

  async function toggleExpand(q) {
    if (expandedId === q.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(q.id)
    if (!expandedItems[q.id]) {
      const { data } = await supabase.from('quotation_items').select('*').eq('quotation_id', q.id).order('created_at')
      setExpandedItems((prev) => ({ ...prev, [q.id]: data || [] }))
    }
  }

  async function handleDownloadPDF(q) {
    let items = expandedItems[q.id]
    if (!items) {
      const { data } = await supabase.from('quotation_items').select('*').eq('quotation_id', q.id).order('created_at')
      items = data || []
      setExpandedItems((prev) => ({ ...prev, [q.id]: items }))
    }
    generateQuotationPDF(q, items)
  }

  async function handlePrint(q) {
    let items = expandedItems[q.id]
    if (!items) {
      const { data } = await supabase.from('quotation_items').select('*').eq('quotation_id', q.id).order('created_at')
      items = data || []
      setExpandedItems((prev) => ({ ...prev, [q.id]: items }))
    }
    const meta = quotationStatusMeta(q.status)

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
        <div><span>Company</span><strong>${q.company || q.lead?.lead_name || '—'}</strong></div>
        <div><span>Lead</span><strong>${q.lead?.lead_name || '—'}</strong></div>
        <div><span>Date</span><strong>${dateFmt(q.created_at)}</strong></div>
        <div><span>Valid Until</span><strong>${q.valid_until ? dateFmt(q.valid_until) : '—'}</strong></div>
        <div><span>Status</span><span class="print-badge">${meta.label}</span></div>
      </div>

      ${q.description ? `<h2>Description</h2><p class="print-notes">${q.description}</p>` : ''}

      ${itemsRows ? `
        <h2>Items</h2>
        <table>
          <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Disc %</th><th class="num">Tax %</th><th class="num">Line Total</th></tr></thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <div class="print-totals">
          <div><span>Subtotal</span><span>${moneyFmt(q.subtotal)}</span></div>
          <div><span>Discount</span><span>- ${moneyFmt(q.discount_total)}</span></div>
          <div><span>Tax</span><span>+ ${moneyFmt(q.tax_total)}</span></div>
          <div class="print-grand"><span>Grand Total</span><span>${moneyFmt(q.amount)}</span></div>
        </div>
      ` : `
        <h2>Amount</h2>
        <div class="print-totals"><div class="print-grand"><span>Grand Total</span><span>${moneyFmt(q.amount)}</span></div></div>
      `}

      ${q.terms ? `<h2>Terms & Notes</h2><p class="print-notes">${q.terms}</p>` : ''}
    `

    printRecord(`Quotation ${q.quotation_number || ''}`, body, { docName: 'Quotation', docNumber: q.quotation_number || '' })
  }

  async function handleConvertToOrder(q) {
    if (q.order_id) return
    setConverting(q.id)

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        lead_id: q.lead_id,
        company: q.company,
        order_value: q.amount,
        status: 'pending',
        project_details: q.description,
        created_by: session?.user?.id
      })
      .select()
      .single()

    if (!orderError && newOrder) {
      await supabase.from('quotations').update({ order_id: newOrder.id }).eq('id', q.id)
      await loadQuotations()
    } else if (orderError) {
      setError(orderError.message)
    }
    setConverting(null)
  }

  const filteredQuotations = quotations.filter((q) => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    return q.quotation_number?.toLowerCase().includes(s) || q.company?.toLowerCase().includes(s)
  })

  return (
    <div>
      <div className="quotes-header">
        <div>
          <h1>Quotations</h1>
          <p className="quotes-subtitle">{isManager ? 'All quotations' : 'Your quotations'}</p>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ New Quotation</button>
        )}
      </div>

      <div className="quotes-filters">
        <input
          className="text-input search-input"
          placeholder="Search by quotation no., company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="text-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {QUOTATION_STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <p className="quotes-empty">Loading quotations…</p>
      ) : filteredQuotations.length === 0 ? (
        <div className="quotes-empty-state">
          <p>No quotations found.</p>
          <span>Create one manually here, or from a lead's detail page.</span>
        </div>
      ) : (
        <div className="quotes-table-wrap mobile-card-table">
          <table className="quotes-table">
            <thead>
              <tr>
                <th></th>
                <th>Quotation No.</th>
                <th>Company</th>
                <th>Grand Total</th>
                <th>Status</th>
                <th>Valid Until</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotations.map((q) => {
                const meta = quotationStatusMeta(q.status)
                const isOpen = expandedId === q.id
                return (
                  <Fragment key={q.id}>
                    <tr className="quote-row" onClick={() => toggleExpand(q)}>
                      <td className="expand-cell">
                        <span className={'expand-arrow' + (isOpen ? ' open' : '')}>›</span>
                      </td>
                      <td className="quote-number-cell" data-label="Quotation No.">{q.quotation_number}</td>
                      <td data-label="Company">{q.company || q.lead?.lead_name || '—'}</td>
                      <td data-label="Grand Total">{q.amount ? `₹${Number(q.amount).toLocaleString('en-IN')}` : '—'}</td>
                      <td data-label="Status"><span className="status-badge" style={{ '--badge-color': meta.color }}>{meta.label}</span></td>
                      <td data-label="Valid Until">{q.valid_until ? new Date(q.valid_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="quote-row-actions">
                          <button className="icon-btn" title="Print" onClick={() => handlePrint(q)}>🖨</button>
                          <button className="icon-btn" title="Download PDF" onClick={() => handleDownloadPDF(q)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                          {(isManager || q.created_by === session?.user?.id) && (
                            <button className="icon-btn" title="Edit" onClick={() => setEditingQuote(q)}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 15.5V20Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
                            </button>
                          )}
                          {q.status === 'accepted' && !q.order_id && (
                            <button className="btn-ghost small" disabled={converting === q.id} onClick={() => handleConvertToOrder(q)}>
                              {converting === q.id ? 'Converting…' : 'Convert to Order'}
                            </button>
                          )}
                          {q.order_id && <span className="quote-converted-tag">Order Created</span>}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="quote-expand-row">
                        <td colSpan={7}>
                          {!expandedItems[q.id] ? (
                            <p className="quotes-empty" style={{ padding: '8px 0' }}>Loading items…</p>
                          ) : expandedItems[q.id].length === 0 ? (
                            <p className="quotes-empty" style={{ padding: '8px 0' }}>No items on this quotation.</p>
                          ) : (
                            <div className="mini-items-list">
                              {expandedItems[q.id].map((it) => (
                                <div key={it.id} className="mini-item-row">
                                  <span className="mini-item-name">{it.item_name}</span>
                                  <span>Qty: {it.quantity}</span>
                                  <span>Rate: ₹{Number(it.rate).toLocaleString('en-IN')}</span>
                                  <span>Disc: {it.discount_percent}%</span>
                                  <span>Tax: {it.tax_percent}%</span>
                                  <span className="mini-item-total">₹{Number(it.line_total).toLocaleString('en-IN')}</span>
                                </div>
                              ))}
                              <div className="mini-item-summary">
                                <span>Subtotal: ₹{Number(q.subtotal || 0).toLocaleString('en-IN')}</span>
                                <span>Discount: -₹{Number(q.discount_total || 0).toLocaleString('en-IN')}</span>
                                <span>Tax: +₹{Number(q.tax_total || 0).toLocaleString('en-IN')}</span>
                                <strong>Grand Total: ₹{Number(q.amount || 0).toLocaleString('en-IN')}</strong>
                              </div>
                              {q.attachments && q.attachments.length > 0 && (
                                <div className="quote-attachments-row">
                                  <span className="quote-attachments-label">Attachments:</span>
                                  {q.attachments.map((a, ai) => (
                                    <a key={ai} href={a.url} target="_blank" rel="noreferrer" className="timeline-attachment-link">
                                      📎 {a.name}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
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
        <QuotationFormModal
          currentUserId={session?.user?.id}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadQuotations() }}
        />
      )}

      {editingQuote && (
        <QuotationFormModal
          quotation={editingQuote}
          currentUserId={session?.user?.id}
          onClose={() => setEditingQuote(null)}
          onSaved={() => { setEditingQuote(null); loadQuotations() }}
        />
      )}
    </div>
  )
}
