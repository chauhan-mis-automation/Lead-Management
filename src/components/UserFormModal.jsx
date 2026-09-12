import { useState } from 'react'
import { supabase } from '../supabaseClient'
import '../components/LeadFormModal.css'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'subadmin', label: 'Subadmin' },
  { value: 'sales', label: 'Sales' },
  { value: 'bde', label: 'BDE' },
  { value: 'calling', label: 'Calling' }
]

export default function UserFormModal({ accessToken, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'bde'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.full_name.trim() || !form.email.trim() || !form.password) {
      setError('Name, email and password are required.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setSaving(true)

    const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`

    try {
      const res = await fetch(functionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          role: form.role
        })
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Something went wrong while creating the user.')
        setSaving(false)
        return
      }

      setSaving(false)
      onSaved()
    } catch (err) {
      setError('Could not reach the server. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New User</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-grid">
            <div className="field">
              <label>Full Name *</label>
              <input
                className="text-input"
                value={form.full_name}
                onChange={(e) => update('full_name', e.target.value)}
                placeholder="e.g. Rahul Sharma"
              />
            </div>

            <div className="field">
              <label>Email *</label>
              <input
                className="text-input"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="user@company.com"
              />
            </div>

            <div className="field">
              <label>Temporary Password *</label>
              <input
                className="text-input"
                type="text"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>

            <div className="field">
              <label>Role *</label>
              <select className="text-input" value={form.role} onChange={(e) => update('role', e.target.value)}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}

          <p className="modal-hint">
            Share this email and password with the user — they'll sign in with these.
          </p>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
