import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { PAYMENT_MODE_OPTIONS } from '../lib/constants'
import './LeadFormModal.css'

export default function PaymentFormModal({ order, currentUserId, onClose, onSaved }) {
  const remaining = Math.max(0, Number(order.order_value || 0) - Number(order.paid_amount || 0))

  const [form, setForm] = useState({
    amount: remaining > 0 ? remaining : '',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_mode: 'cash',
    notes: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) {
      setError('Enter a valid payment amount.')
      return
    }
    setError('')
    setSaving(true)

    const { error: insertError } = await supabase.from('payments').insert({
      order_id: order.id,
      amount: Number(form.amount),
      payment_date: form.payment_date,
      payment_mode: form.payment_mode,
      notes: form.notes.trim() || null,
      created_by: currentUserId
    })

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
          <h2>Add Payment</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <p className="modal-hint" style={{ marginTop: 0, marginBottom: 14 }}>
          {order.order_number} — Order Value ₹{Number(order.order_value || 0).toLocaleString('en-IN')},
          Already Paid ₹{Number(order.paid_amount || 0).toLocaleString('en-IN')},
          Remaining ₹{remaining.toLocaleString('en-IN')}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="modal-grid">
            <div className="field">
              <label>Amount (₹) *</label>
              <input className="text-input" type="number" value={form.amount} onChange={(e) => update('amount', e.target.value)} />
            </div>

            <div className="field">
              <label>Payment Date</label>
              <input className="text-input" type="date" value={form.payment_date} onChange={(e) => update('payment_date', e.target.value)} />
            </div>

            <div className="field">
              <label>Payment Mode</label>
              <select className="text-input" value={form.payment_mode} onChange={(e) => update('payment_mode', e.target.value)}>
                {PAYMENT_MODE_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="field wide">
              <label>Notes</label>
              <input className="text-input" value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Reference no., cheque no., etc." />
            </div>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
