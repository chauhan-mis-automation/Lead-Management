import { useState } from 'react'
import { supabase } from '../supabaseClient'
import './LeadFormModal.css'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'subadmin', label: 'Subadmin' },
  { value: 'sales', label: 'Sales' },
  { value: 'bde', label: 'BDE' },
  { value: 'calling', label: 'Calling' }
]

export default function EditUserModal({ user, onClose, onSaved }) {
  const [fullName, setFullName] = useState(user.full_name || '')
  const [role, setRole] = useState(user.role)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fullName.trim()) {
      setError('Full name is required.')
      return
    }
    setError('')
    setSaving(true)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), role })
      .eq('id', user.id)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    onSaved({ ...user, full_name: fullName.trim(), role })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit User</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-grid">
            <div className="field">
              <label>Full Name *</label>
              <input
                className="text-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Email</label>
              <input className="text-input" value={user.email} disabled />
            </div>

            <div className="field">
              <label>Role *</label>
              <select className="text-input" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}

          <p className="modal-hint">
            Email can't be changed here. To change a user's login email, deactivate this account and create a new one.
          </p>

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
