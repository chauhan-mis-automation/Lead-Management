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

export default function EditUserModal({ user, accessToken, onClose, onSaved }) {
  const [fullName, setFullName] = useState(user.full_name || '')
  const [role, setRole] = useState(user.role)
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fullName.trim()) {
      setError('Full name is required.')
      return
    }
    if (newPassword && newPassword.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }

    setError('')
    setSaving(true)
    setPasswordSuccess(false)

    // 1. Update name + role (direct table update)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), role })
      .eq('id', user.id)

    if (updateError) {
      setSaving(false)
      setError(updateError.message)
      return
    }

    // 2. If a new password was entered, reset it via the secure Edge Function
    if (newPassword) {
      try {
        const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`
        const res = await fetch(functionsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ user_id: user.id, new_password: newPassword })
        })
        const result = await res.json()

        if (!res.ok) {
          setSaving(false)
          setError(result.error || 'Name/role saved, but password reset failed.')
          return
        }
        setPasswordSuccess(true)
      } catch (err) {
        setSaving(false)
        setError('Name/role saved, but could not reach the server to reset the password.')
        return
      }
    }

    setSaving(false)
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

            <div className="field">
              <label>New Password</label>
              <div className="password-field-wrap">
                <input
                  className="text-input"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}
          {passwordSuccess && !error && (
            <p className="password-success-note">Password updated successfully.</p>
          )}

          <p className="modal-hint">
            Leave "New Password" blank to keep the user's existing password unchanged.
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
