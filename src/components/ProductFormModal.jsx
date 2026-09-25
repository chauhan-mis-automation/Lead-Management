import { useState } from 'react'
import { supabase } from '../supabaseClient'
import './LeadFormModal.css'

export default function ProductFormModal({ product, onClose, onSaved }) {
  const isEdit = !!product

  const [form, setForm] = useState({
    product_name: product?.product_name || '',
    category: product?.category || '',
    product_code: product?.product_code || '',
    description: product?.description || '',
    price: product?.price ?? '',
    price_max: product?.price_max ?? '',
    tax_percent: product?.tax_percent ?? 18,
    discount_percent: product?.discount_percent ?? 0,
    is_active: product?.is_active ?? true
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.product_name.trim()) {
      setError('Product name is required.')
      return
    }
    setError('')
    setSaving(true)

    const payload = {
      product_name: form.product_name.trim(),
      category: form.category.trim() || null,
      product_code: form.product_code.trim() || null,
      description: form.description.trim() || null,
      price: form.price === '' ? null : Number(form.price),
      price_max: form.price_max === '' ? null : Number(form.price_max),
      tax_percent: form.tax_percent === '' ? 0 : Number(form.tax_percent),
      discount_percent: form.discount_percent === '' ? 0 : Number(form.discount_percent),
      is_active: form.is_active
    }

    let dbError
    if (isEdit) {
      const { error: updateError } = await supabase.from('products').update(payload).eq('id', product.id)
      dbError = updateError
    } else {
      const { error: insertError } = await supabase.from('products').insert(payload)
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
          <h2>{isEdit ? 'Edit Product' : 'New Product / Service'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-grid">
            <div className="field">
              <label>Product / Service Name *</label>
              <input className="text-input" value={form.product_name} onChange={(e) => update('product_name', e.target.value)} placeholder="e.g. Website Development" />
            </div>

            <div className="field">
              <label>Category</label>
              <input className="text-input" value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="e.g. Web Services" />
            </div>

            <div className="field">
              <label>Product Code</label>
              <input className="text-input" value={form.product_code} onChange={(e) => update('product_code', e.target.value)} placeholder="Optional SKU/code" />
            </div>

            <div className="field">
              <label>Price (₹)</label>
              <input className="text-input" type="number" value={form.price} onChange={(e) => update('price', e.target.value)} placeholder="e.g. 5000" />
            </div>

            <div className="field">
              <label>Price To (₹) — optional, for a range</label>
              <input className="text-input" type="number" value={form.price_max} onChange={(e) => update('price_max', e.target.value)} placeholder="e.g. 8000" />
              <span className="field-hint">Leave blank for a fixed price. Fill both to show a range like ₹5,000 – ₹8,000.</span>
            </div>

            <div className="field">
              <label>Tax (%)</label>
              <input className="text-input" type="number" value={form.tax_percent} onChange={(e) => update('tax_percent', e.target.value)} />
            </div>

            <div className="field">
              <label>Discount (%)</label>
              <input className="text-input" type="number" value={form.discount_percent} onChange={(e) => update('discount_percent', e.target.value)} />
            </div>

            <div className="field wide">
              <label>Description</label>
              <textarea className="text-input" rows={2} value={form.description} onChange={(e) => update('description', e.target.value)} />
            </div>

            <div className="field">
              <label>Status</label>
              <select className="text-input" value={form.is_active ? 'active' : 'inactive'} onChange={(e) => update('is_active', e.target.value === 'active')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
