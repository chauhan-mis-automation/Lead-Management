import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { QUOTATION_STATUS_OPTIONS, quotationStatusMeta } from '../lib/constants'
import { generateQuotationPDF } from '../lib/quotationPdf'
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
        <div className="quotes-table-wrap">
          <table className="quotes-table">
            <thead>
              <tr>
                <th>Quotation No.</th>
                <th>Company</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Valid Until</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotations.map((q) => {
                const meta = quotationStatusMeta(q.status)
                return (
                  <tr key={q.id}>
                    <td className="quote-number-cell">{q.quotation_number}</td>
                    <td>{q.company || q.lead?.lead_name || '—'}</td>
                    <td>{q.amount ? `₹${Number(q.amount).toLocaleString('en-IN')}` : '—'}</td>
                    <td><span className="status-badge" style={{ '--badge-color': meta.color }}>{meta.label}</span></td>
                    <td>{q.valid_until ? new Date(q.valid_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td>
                      <div className="quote-row-actions">
                        <button className="icon-btn" title="Download PDF" onClick={() => generateQuotationPDF(q)}>
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
