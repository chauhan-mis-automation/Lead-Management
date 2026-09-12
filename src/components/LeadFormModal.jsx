import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { STATUS_OPTIONS, SOURCE_OPTIONS } from '../lib/constants'
import './LeadFormModal.css'

export default function LeadFormModal({ users, currentUserId, onClose, onSaved }) {
  const [form, setForm] = useState({
    lead_name: '',
    mobile: '',
    email: '',
    company: '',
    source: 'manual_entry',
    assigned_to: '',
    status: 'new_lead',
    next_followup_date: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.lead_name.trim()) {
      setError('Lead name is required.')
      return
    }
    setError('')
    setSaving(true)

    const payload = {
      lead_name: form.lead_name.trim(),
      mobile: form.mobile.trim() || null,
      email: form.email.trim() || null,
      company: form.company.trim() || null,
      source: form.source,
      status: form.status,
      assigned_to: form.assigned_to || null,
      next_followup_date: form.next_followup_date ? new Date(form.next_followup_date).toISOString() : null,
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
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Lead</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-grid">
            <div className="field">
              <label>Lead Name *</label>
              <input
                className="text-input"
                value={form.lead_name}
                onChange={(e) => update('lead_name', e.target.value)}
                placeholder="Customer's name"
              />
            </div>

            <div className="field">
              <label>Mobile</label>
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
              <label>Source</label>
              <select className="text-input" value={form.source} onChange={(e) => update('source', e.target.value)}>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Status</label>
              <select className="text-input" value={form.status} onChange={(e) => update('status', e.target.value)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Assign to (BDE/Sales)</label>
              <select className="text-input" value={form.assigned_to} onChange={(e) => update('assigned_to', e.target.value)}>
                <option value="">-- Unassigned --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Next Follow-up</label>
              <input
                className="text-input"
                type="datetime-local"
                value={form.next_followup_date}
                onChange={(e) => update('next_followup_date', e.target.value)}
              />
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
