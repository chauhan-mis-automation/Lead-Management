import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { SOURCE_OPTIONS } from '../lib/constants'
import './LeadFormModal.css'

export default function EditLeadModal({ lead, onClose, onSaved }) {
  const [form, setForm] = useState({
    lead_name: lead.lead_name || '',
    mobile: lead.mobile || '',
    email: lead.email || '',
    company: lead.company || '',
    source: lead.source || 'manual_entry'
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

    const { error: updateError } = await supabase
      .from('leads')
      .update({
        lead_name: form.lead_name.trim(),
        mobile: form.mobile.trim() || null,
        email: form.email.trim() || null,
        company: form.company.trim() || null,
        source: form.source
      })
      .eq('id', lead.id)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    onSaved()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Lead</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-grid">
            <div className="field">
              <label>Lead Name *</label>
              <input className="text-input" value={form.lead_name} onChange={(e) => update('lead_name', e.target.value)} />
            </div>
            <div className="field">
              <label>Mobile</label>
              <input className="text-input" value={form.mobile} onChange={(e) => update('mobile', e.target.value)} />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="text-input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </div>
            <div className="field">
              <label>Company</label>
              <input className="text-input" value={form.company} onChange={(e) => update('company', e.target.value)} />
            </div>
            <div className="field">
              <label>Source</label>
              <select className="text-input" value={form.source} onChange={(e) => update('source', e.target.value)}>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
