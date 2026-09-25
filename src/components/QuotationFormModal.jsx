import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { QUOTATION_STATUS_OPTIONS } from '../lib/constants'
import SearchableSelect from './SearchableSelect'
import './LeadFormModal.css'
import './QuotationFormModal.css'

function blankItem() {
  return {
    tempId: Math.random().toString(36).slice(2),
    product_id: '',
    item_name: '',
    quantity: 1,
    rate: '',
    discount_percent: 0,
    tax_percent: 18
  }
}

function lineCalc(item) {
  const base = (Number(item.quantity) || 0) * (Number(item.rate) || 0)
  const discountAmt = base * ((Number(item.discount_percent) || 0) / 100)
  const taxable = base - discountAmt
  const taxAmt = taxable * ((Number(item.tax_percent) || 0) / 100)
  return { base, discountAmt, taxAmt, total: taxable + taxAmt }
}

export default function QuotationFormModal({ quotation, presetLeadId, currentUserId, onClose, onSaved }) {
  const isEdit = !!quotation

  const [leads, setLeads] = useState([])
  const [products, setProducts] = useState([])
  const [items, setItems] = useState([blankItem()])
  const [form, setForm] = useState({
    lead_id: quotation?.lead_id || presetLeadId || '',
    company: quotation?.company || '',
    description: quotation?.description || '',
    valid_until: quotation?.valid_until || '',
    status: quotation?.status || 'draft',
    terms: quotation?.terms || ''
  })
  const [quoteFiles, setQuoteFiles] = useState([])
  const [existingAttachments, setExistingAttachments] = useState(quotation?.attachments || [])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      const [leadsRes, productsRes, itemsRes] = await Promise.all([
        supabase.from('leads').select('id, lead_name, company').order('created_at', { ascending: false }).limit(200),
        supabase.from('products').select('id, product_name, category, price, tax_percent, discount_percent').eq('is_active', true).order('product_name'),
        isEdit
          ? supabase.from('quotation_items').select('*').eq('quotation_id', quotation.id).order('created_at')
          : Promise.resolve({ data: null })
      ])
      setLeads(leadsRes.data || [])
      setProducts(productsRes.data || [])

      if (isEdit && itemsRes.data && itemsRes.data.length > 0) {
        setItems(itemsRes.data.map((it) => ({
          tempId: it.id,
          product_id: it.product_id || '',
          item_name: it.item_name,
          quantity: it.quantity,
          rate: it.rate,
          discount_percent: it.discount_percent,
          tax_percent: it.tax_percent
        })))
      }

      if (presetLeadId) {
        const match = leadsRes.data?.find((l) => l.id === presetLeadId)
        if (match?.company) setForm((f) => (f.company ? f : { ...f, company: match.company }))
      }
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetLeadId])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleLeadSelect(leadId) {
    update('lead_id', leadId)
    const lead = leads.find((l) => l.id === leadId)
    if (lead?.company) update('company', lead.company)
  }

  function updateItem(tempId, field, value) {
    setItems((prev) => prev.map((it) => (it.tempId === tempId ? { ...it, [field]: value } : it)))
  }

  function selectProductForItem(tempId, productId) {
    const product = products.find((p) => p.id === productId)
    setItems((prev) => prev.map((it) => {
      if (it.tempId !== tempId) return it
      if (!product) return { ...it, product_id: '' }
      return {
        ...it,
        product_id: productId,
        item_name: product.product_name,
        rate: product.price ?? it.rate,
        tax_percent: product.tax_percent ?? it.tax_percent,
        discount_percent: product.discount_percent ?? it.discount_percent
      }
    }))
  }

  function addItem() {
    setItems((prev) => [...prev, blankItem()])
  }

  function removeItem(tempId) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.tempId !== tempId) : prev))
  }

  const totals = items.reduce((acc, it) => {
    const c = lineCalc(it)
    acc.subtotal += c.base
    acc.discountTotal += c.discountAmt
    acc.taxTotal += c.taxAmt
    acc.grandTotal += c.total
    return acc
  }, { subtotal: 0, discountTotal: 0, taxTotal: 0, grandTotal: 0 })

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.company.trim() && !form.lead_id) {
      setError('Select a lead or enter a company name.')
      return
    }
    const validItems = items.filter((it) => it.item_name.trim() && Number(it.rate) >= 0)
    if (validItems.length === 0) {
      setError('Add at least one item with a name and rate.')
      return
    }
    setError('')
    setSaving(true)

    let attachments = [...existingAttachments]
    let uploadErrors = []
    if (quoteFiles.length > 0) {
      setUploadingFiles(true)
      for (const file of quoteFiles) {
        const path = `${form.lead_id || 'general'}/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('quotation-files').upload(path, file)
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('quotation-files').getPublicUrl(path)
          attachments.push({ name: file.name, url: urlData.publicUrl })
        } else {
          uploadErrors.push(`${file.name}: ${uploadError.message}`)
        }
      }
      setUploadingFiles(false)
    }

    if (uploadErrors.length > 0) {
      setSaving(false)
      setError('Could not upload file(s) — ' + uploadErrors.join(' | ') + '. (Check that the "quotation-files" Storage bucket exists in Supabase.) The rest of the quotation was not saved yet — fix this and submit again, or remove the file and continue.')
      return
    }

    const quotationPayload = {
      lead_id: form.lead_id || null,
      company: form.company.trim() || null,
      description: form.description.trim() || null,
      valid_until: form.valid_until || null,
      status: form.status,
      terms: form.terms.trim() || null,
      amount: Math.round(totals.grandTotal * 100) / 100,
      subtotal: Math.round(totals.subtotal * 100) / 100,
      discount_total: Math.round(totals.discountTotal * 100) / 100,
      tax_total: Math.round(totals.taxTotal * 100) / 100,
      attachments
    }

    let quotationId = quotation?.id
    let dbError

    if (isEdit) {
      const { error: updateError } = await supabase.from('quotations').update(quotationPayload).eq('id', quotationId)
      dbError = updateError
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('quotations')
        .insert({ ...quotationPayload, created_by: currentUserId })
        .select()
        .single()
      dbError = insertError
      quotationId = inserted?.id
    }

    if (dbError || !quotationId) {
      setSaving(false)
      setError(dbError?.message || 'Could not save quotation.')
      return
    }

    // Replace line items: delete existing, insert current set
    await supabase.from('quotation_items').delete().eq('quotation_id', quotationId)

    const itemRows = validItems.map((it) => {
      const c = lineCalc(it)
      return {
        quotation_id: quotationId,
        product_id: it.product_id || null,
        item_name: it.item_name.trim(),
        quantity: Number(it.quantity) || 1,
        rate: Number(it.rate) || 0,
        discount_percent: Number(it.discount_percent) || 0,
        tax_percent: Number(it.tax_percent) || 0,
        line_total: Math.round(c.total * 100) / 100
      }
    })

    const { error: itemsError } = await supabase.from('quotation_items').insert(itemRows)

    setSaving(false)

    if (itemsError) {
      setError('Quotation saved, but items failed: ' + itemsError.message)
      return
    }

    onSaved()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card quotation-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Quotation' : 'New Quotation'}</h2>
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
                disabled={!!presetLeadId}
              />
            </div>

            <div className="field">
              <label>Company *</label>
              <input className="text-input" value={form.company} onChange={(e) => update('company', e.target.value)} placeholder="Company name" />
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
              <label>Description / Note (optional)</label>
              <input className="text-input" value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="e.g. Quotation for website project" />
            </div>
          </div>

          <div className="quote-items-section">
            <div className="quote-items-head">
              <span>Items</span>
              <button type="button" className="btn-ghost small" onClick={addItem}>+ Add Item</button>
            </div>

            <div className="quote-items-table-wrap">
              <table className="quote-items-table">
                <thead>
                  <tr>
                    <th>Product / Item</th>
                    <th>Qty</th>
                    <th>Rate (₹)</th>
                    <th>Disc %</th>
                    <th>Tax %</th>
                    <th>Line Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const c = lineCalc(it)
                    return (
                      <tr key={it.tempId}>
                        <td className="quote-item-name-cell">
                          <SearchableSelect
                            options={products.map((p) => ({ value: p.id, label: p.product_name, sublabel: p.category }))}
                            value={it.product_id}
                            onChange={(v) => selectProductForItem(it.tempId, v)}
                            placeholder="Search product, or type custom item"
                            emptyLabel="-- Custom item --"
                          />
                          <input
                            className="text-input quote-item-name-input"
                            value={it.item_name}
                            onChange={(e) => updateItem(it.tempId, 'item_name', e.target.value)}
                            placeholder="Item name"
                          />
                        </td>
                        <td>
                          <input className="text-input qty-input" type="number" min="0" value={it.quantity} onChange={(e) => updateItem(it.tempId, 'quantity', e.target.value)} />
                        </td>
                        <td>
                          <input className="text-input qty-input" type="number" min="0" value={it.rate} onChange={(e) => updateItem(it.tempId, 'rate', e.target.value)} />
                        </td>
                        <td>
                          <input className="text-input qty-input" type="number" min="0" value={it.discount_percent} onChange={(e) => updateItem(it.tempId, 'discount_percent', e.target.value)} />
                        </td>
                        <td>
                          <input className="text-input qty-input" type="number" min="0" value={it.tax_percent} onChange={(e) => updateItem(it.tempId, 'tax_percent', e.target.value)} />
                        </td>
                        <td className="line-total-cell">₹{c.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        <td>
                          <button type="button" className="remove-item-btn" onClick={() => removeItem(it.tempId)} disabled={items.length === 1} aria-label="Remove item">✕</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="quote-totals">
              <div><span>Subtotal</span><strong>₹{totals.subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></div>
              <div><span>Discount</span><strong>- ₹{totals.discountTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></div>
              <div><span>Tax</span><strong>+ ₹{totals.taxTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></div>
              <div className="grand-total-row"><span>Grand Total</span><strong>₹{totals.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></div>
            </div>
          </div>

          <div className="modal-grid" style={{ marginTop: 16 }}>
            <div className="field wide">
              <label>Terms & Notes</label>
              <textarea className="text-input" rows={2} value={form.terms} onChange={(e) => update('terms', e.target.value)} placeholder="Payment terms, delivery conditions…" />
            </div>

            <div className="field wide">
              <label>Attach Files (optional)</label>
              <input
                type="file"
                multiple
                className="file-input"
                onChange={(e) => setQuoteFiles(Array.from(e.target.files))}
              />
              {existingAttachments.length > 0 && (
                <div className="file-chip-list">
                  {existingAttachments.map((a, i) => (
                    <span key={'existing-' + i} className="file-chip">
                      <a href={a.url} target="_blank" rel="noreferrer">📎 {a.name}</a>
                      <button type="button" onClick={() => setExistingAttachments((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
                    </span>
                  ))}
                </div>
              )}
              {quoteFiles.length > 0 && (
                <div className="file-chip-list">
                  {quoteFiles.map((f, i) => (
                    <span key={i} className="file-chip">
                      {f.name}
                      <button type="button" onClick={() => setQuoteFiles((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {uploadingFiles ? 'Uploading files…' : saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Quotation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
