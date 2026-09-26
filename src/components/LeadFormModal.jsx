import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { STATUS_OPTIONS, SOURCE_OPTIONS, PRIORITY_OPTIONS, LEAD_TEMPERATURE_OPTIONS, CLOSING_TAT_OPTIONS } from '../lib/constants'
import SearchableSelect from './SearchableSelect'
import './LeadFormModal.css'

export default function LeadFormModal({ users, currentUserId, onClose, onSaved }) {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({
    lead_name: '',
    client_name: '',
    mobile: '',
    email: '',
    company: '',
    industry_type: '',
    city: '',
    state: '',
    source: 'manual_entry',
    product_id: '',
    requirement: '',
    status: 'new_lead',
    lead_temperature: '',
    priority: 'medium',
    assigned_to: '',
    budget: '',
    expected_deal_value: '',
    closing_tat: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadProducts() {
      const { data } = await supabase.from('products').select('id, product_name, category').eq('is_active', true).order('product_name')
      setProducts(data || [])
    }
    loadProducts()
  }, [])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.lead_name.trim()) {
      setError('Customer name is required.')
      return
    }
    if (!form.mobile.trim()) {
      setError('Mobile no. is required.')
      return
    }
    setError('')
    setSaving(true)

    const payload = {
      lead_name: form.lead_name.trim(),
      client_name: form.client_name.trim() || null,
      mobile: form.mobile.trim() || null,
      email: form.email.trim() || null,
      company: form.company.trim() || null,
      industry_type: form.industry_type.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      source: form.source,
      product_id: form.product_id || null,
      requirement: form.requirement.trim() || null,
      status: form.status,
      lead_temperature: form.lead_temperature || null,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      budget: form.budget ? Number(form.budget) : null,
      expected_deal_value: form.expected_deal_value ? Number(form.expected_deal_value) : null,
      closing_tat: form.closing_tat || null,
      created_by: currentUserId
    }

    const { error: insertError } = await supabase.from('leads').insert(payload)

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    onSaved()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card lead-form-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Lead</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <h3 className="form-section-title">Basic Lead Details</h3>
          <div className="modal-grid">
            <div className="field">
              <label>Customer Name *</label>
              <input
                className="text-input"
                value={form.lead_name}
                onChange={(e) => update('lead_name', e.target.value)}
                placeholder="Customer's name"
              />
            </div>

            <div className="field">
              <label>Client Name</label>
              <input
                className="text-input"
                value={form.client_name}
                onChange={(e) => update('client_name', e.target.value)}
                placeholder="Contact / decision maker name"
              />
            </div>

            <div className="field">
              <label>Mobile No. *</label>
              <input
                className="text-input"
                value={form.mobile}
                onChange={(e) => update('mobile', e.target.value)}
                placeholder="10-digit number"
              />
            </div>

            <div className="field">
              <label>Email</label>
              <input
                className="text-input"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="email@example.com"
              />
            </div>

            <div className="field">
              <label>Company</label>
              <input
                className="text-input"
                value={form.company}
                onChange={(e) => update('company', e.target.value)}
                placeholder="Company name"
              />
            </div>

            <div className="field">
              <label>Type of Industry</label>
              <input
                className="text-input"
                value={form.industry_type}
                onChange={(e) => update('industry_type', e.target.value)}
                placeholder="e.g. Real Estate, Retail, IT"
              />
            </div>

            <div className="field">
              <label>City</label>
              <input
                className="text-input"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                placeholder="City"
              />
            </div>

            <div className="field">
              <label>State</label>
              <input
                className="text-input"
                value={form.state}
                onChange={(e) => update('state', e.target.value)}
                placeholder="State"
              />
            </div>

            <div className="field">
              <label>Source</label>
              <select className="text-input" value={form.source} onChange={(e) => update('source', e.target.value)}>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Product / Service</label>
              <SearchableSelect
                options={products.map((p) => ({ value: p.id, label: p.product_name, sublabel: p.category }))}
                value={form.product_id}
                onChange={(v) => update('product_id', v)}
                placeholder="Search product/service…"
                emptyLabel="-- None --"
              />
            </div>

            <div className="field wide">
              <label>Requirement</label>
              <textarea
                className="text-input"
                rows={2}
                value={form.requirement}
                onChange={(e) => update('requirement', e.target.value)}
                placeholder="What does the customer need?"
              />
            </div>
          </div>

          <h3 className="form-section-title">Sales Details</h3>
          <div className="modal-grid">
            <div className="field">
              <label>Status</label>
              <select className="text-input" value={form.status} onChange={(e) => update('status', e.target.value)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Lead Temperature</label>
              <select className="text-input" value={form.lead_temperature} onChange={(e) => update('lead_temperature', e.target.value)}>
                <option value="">-- Select --</option>
                {LEAD_TEMPERATURE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Priority</label>
              <select className="text-input" value={form.priority} onChange={(e) => update('priority', e.target.value)}>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Assign To (BDE/Sales)</label>
              <select className="text-input" value={form.assigned_to} onChange={(e) => update('assigned_to', e.target.value)}>
                <option value="">-- Unassigned --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Budget (₹)</label>
              <input
                className="text-input"
                type="number"
                value={form.budget}
                onChange={(e) => update('budget', e.target.value)}
                placeholder="Customer's budget"
              />
            </div>

            <div className="field">
              <label>Expected Deal Value (₹)</label>
              <input
                className="text-input"
                type="number"
                value={form.expected_deal_value}
                onChange={(e) => update('expected_deal_value', e.target.value)}
                placeholder="Expected value if won"
              />
            </div>

            <div className="field">
              <label>Closing TAT</label>
              <select className="text-input" value={form.closing_tat} onChange={(e) => update('closing_tat', e.target.value)}>
                <option value="">-- Select --</option>
                {CLOSING_TAT_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
