import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { QUOTATION_STATUS_OPTIONS } from '../lib/constants'
import './LeadFormModal.css'

export default function QuotationFormModal({ quotation, presetLeadId, currentUserId, onClose, onSaved }) {
  const isEdit = !!quotation

  const [leads, setLeads] = useState([])
  const [form, setForm] = useState({
    lead_id: quotation?.lead_id || presetLeadId || '',
    company: quotation?.company || '',
    description: quotation?.description || '',
    amount: quotation?.amount || '',
    valid_until: quotation?.valid_until || '',
    status: quotation?.status || 'draft',
    terms: quotation?.terms || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadLeads() {
      const { data } = await supabase
        .from('leads')
        .select('id, lead_name, company')
        .order('created_at', { ascending: false })
        .limit(200)
      setLeads(data || [])
      if (presetLeadId) {
        const match = data?.find((l) => l.id === presetLeadId)
        if (match?.company) setForm((f) => (f.company ? f : { ...f, company: match.company }))
      }
    }
    loadLeads()
  }, [presetLeadId])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleLeadSelect(leadId) {
    update('lead_id', leadId)
    const lead = leads.find((l) => l.id === leadId)
    if (lead?.company) update('company', lead.company)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.company.trim() && !form.lead_id) {
      setError('Select a lead or enter a company name.')
      return
    }
    if (!form.amount) {
      setError('Amount is required.')
      return
    }
    setError('')
    setSaving(true)

    const payload = {
      lead_id: form.lead_id || null,
      company: form.company.trim() || null,
      description: form.description.trim() || null,
      amount: Number(form.amount),
      valid_until: form.valid_until || null,
      status: form.status,
      terms: form.terms.trim() || null
    }

    let dbError
    if (isEdit) {
      const { error: updateError } = await supabase.from('quotations').update(payload).eq('id', quotation.id)
      dbError = updateError
    } else {
      const { error: insertError } = await supabase
        .from('quotations')
        .insert({ ...payload, created_by: currentUserId })
      dbError = insertError
    }

    setSaving(false)

    if (dbError) {
      setError(dbError.message)
      return
    }

    onSaved()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Quotation' : 'New Quotation'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-grid">
            <div className="field">
              <label>Link to Lead (optional)</label>
              <select className="text-input" value={form.lead_id} onChange={(e) => handleLeadSelect(e.target.value)} disabled={!!presetLeadId}>
                <option value="">-- No linked lead --</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>{l.lead_name}{l.company ? ` (${l.company})` : ''}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Company *</label>
              <input className="text-input" value={form.company} onChange={(e) => update('company', e.target.value)} placeholder="Company name" />
            </div>

            <div className="field">
              <label>Amount (₹) *</label>
              <input className="text-input" type="number" value={form.amount} onChange={(e) => update('amount', e.target.value)} />
            </div>

            <div className="field">
              <label>Valid Until</label>
              <input className="text-input" type="date" value={form.valid_until} onChange={(e) => update('valid_until', e.target.value)} />
            </div>

            <div className="field">
              <label>Status</label>
              <select className="text-input" value={form.status} onChange={(e) => update('status', e.target.value)}>
                {QUOTATION_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="field wide">
              <label>Description</label>
              <textarea className="text-input" rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="What is being quoted…" />
            </div>

            <div className="field wide">
              <label>Terms & Notes</label>
              <textarea className="text-input" rows={2} value={form.terms} onChange={(e) => update('terms', e.target.value)} placeholder="Payment terms, delivery conditions…" />
            </div>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Quotation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
