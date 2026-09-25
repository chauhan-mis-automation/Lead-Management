import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { ORDER_STATUS_OPTIONS } from '../lib/constants'
import SearchableSelect from './SearchableSelect'
import './LeadFormModal.css'

export default function OrderFormModal({ order, currentUserId, onClose, onSaved }) {
  const isEdit = !!order

  const [leads, setLeads] = useState([])
  const [form, setForm] = useState({
    lead_id: order?.lead_id || '',
    company: order?.company || '',
    order_value: order?.order_value || '',
    status: order?.status || 'pending',
    order_date: order?.order_date || new Date().toISOString().slice(0, 10),
    delivery_date: order?.delivery_date || '',
    project_details: order?.project_details || ''
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
    }
    loadLeads()
  }, [])

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
    setError('')
    setSaving(true)

    const payload = {
      lead_id: form.lead_id || null,
      company: form.company.trim() || null,
      order_value: form.order_value ? Number(form.order_value) : null,
      status: form.status,
      order_date: form.order_date || null,
      delivery_date: form.delivery_date || null,
      project_details: form.project_details.trim() || null
    }

    let dbError
    if (isEdit) {
      const { error: updateError } = await supabase.from('orders').update(payload).eq('id', order.id)
      dbError = updateError
    } else {
      const { error: insertError } = await supabase
        .from('orders')
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
          <h2>{isEdit ? 'Edit Order' : 'New Order'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-grid">
            <div className="field">
              <label>Link to Lead (optional)</label>
              <SearchableSelect
                options={leads.map((l) => ({ value: l.id, label: l.lead_name, sublabel: l.company }))}
                value={form.lead_id}
                onChange={handleLeadSelect}
                placeholder="Search lead…"
                emptyLabel="-- No linked lead --"
              />
            </div>

            <div className="field">
              <label>Company *</label>
              <input className="text-input" value={form.company} onChange={(e) => update('company', e.target.value)} placeholder="Company name" />
            </div>

            <div className="field">
              <label>Order Value (₹)</label>
              <input className="text-input" type="number" value={form.order_value} onChange={(e) => update('order_value', e.target.value)} />
            </div>

            <div className="field">
              <label>Status</label>
              <select className="text-input" value={form.status} onChange={(e) => update('status', e.target.value)}>
                {ORDER_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Order Date</label>
              <input className="text-input" type="date" value={form.order_date} onChange={(e) => update('order_date', e.target.value)} />
            </div>

            <div className="field">
              <label>Delivery Date</label>
              <input className="text-input" type="date" value={form.delivery_date} onChange={(e) => update('delivery_date', e.target.value)} />
            </div>

            <div className="field wide">
              <label>Project / Order Details</label>
              <textarea className="text-input" rows={3} value={form.project_details} onChange={(e) => update('project_details', e.target.value)} />
            </div>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
