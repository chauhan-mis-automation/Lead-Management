export const STATUS_OPTIONS = [
  { value: 'new_lead', label: 'New Lead', color: '#5B8DEF' },
  { value: 'contacted', label: 'Contacted', color: '#8B93A7' },
  { value: 'followup_required', label: 'Follow-up Required', color: '#F5A623' },
  { value: 'hot_lead', label: 'Hot Lead', color: '#FF6B6B' },
  { value: 'warm_lead', label: 'Warm Lead', color: '#F5A623' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: '#9B7FE0' },
  { value: 'negotiation', label: 'Negotiation', color: '#9B7FE0' },
  { value: 'won_order', label: 'Won Order', color: '#2DD9C4' },
  { value: 'lost_order', label: 'Lost Order', color: '#6B7280' },
  { value: 'not_interested', label: 'Not Interested', color: '#6B7280' }
]

export const SOURCE_OPTIONS = [
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'website_form', label: 'Website Form' },
  { value: 'manual_entry', label: 'Manual Entry' },
  { value: 'bulk_upload', label: 'Bulk Upload' },
  { value: 'indiamart', label: 'IndiaMART' },
  { value: 'other', label: 'Other' }
]

export function statusMeta(value) {
  return STATUS_OPTIONS.find((s) => s.value === value) || { label: value, color: '#8B93A7' }
}

export function sourceLabel(value) {
  return SOURCE_OPTIONS.find((s) => s.value === value)?.label || value
}

export const ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: '#F5A623' },
  { value: 'in_progress', label: 'In Progress', color: '#5B8DEF' },
  { value: 'completed', label: 'Completed', color: '#2DBE7E' },
  { value: 'cancelled', label: 'Cancelled', color: '#6B7280' }
]

export function orderStatusMeta(value) {
  return ORDER_STATUS_OPTIONS.find((s) => s.value === value) || { label: value, color: '#8B93A7' }
}

export const ACTION_TYPE_OPTIONS = [
  { value: 'call', label: 'Call', icon: '📞', color: '#5B8DEF' },
  { value: 'meeting', label: 'Meeting', icon: '🤝', color: '#9B7FE0' },
  { value: 'visit', label: 'Site Visit', icon: '🏢', color: '#F5A623' }
]

export function actionTypeMeta(value) {
  return ACTION_TYPE_OPTIONS.find((a) => a.value === value) || ACTION_TYPE_OPTIONS[0]
}

export const QUOTATION_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: '#6C7390' },
  { value: 'sent', label: 'Sent', color: '#5B8DEF' },
  { value: 'accepted', label: 'Accepted', color: '#2DBE7E' },
  { value: 'rejected', label: 'Rejected', color: '#E5484D' },
  { value: 'expired', label: 'Expired', color: '#F5A623' }
]

export function quotationStatusMeta(value) {
  return QUOTATION_STATUS_OPTIONS.find((s) => s.value === value) || { label: value, color: '#8B93A7' }
}

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#6C7390' },
  { value: 'medium', label: 'Medium', color: '#F5A623' },
  { value: 'high', label: 'High', color: '#E5484D' }
]

export function priorityMeta(value) {
  return PRIORITY_OPTIONS.find((p) => p.value === value) || PRIORITY_OPTIONS[1]
}

export const LEAD_TEMPERATURE_OPTIONS = [
  { value: 'hot', label: 'Hot', icon: '🔥', color: '#E5484D' },
  { value: 'warm', label: 'Warm', icon: '🌤', color: '#F5A623' },
  { value: 'cold', label: 'Cold', icon: '❄️', color: '#5B8DEF' }
]

export function temperatureMeta(value) {
  return LEAD_TEMPERATURE_OPTIONS.find((t) => t.value === value) || null
}

export const CLOSING_TAT_OPTIONS = [
  { value: '7_days', label: '7 Days' },
  { value: '15_days', label: '15 Days' },
  { value: '30_days', label: '30 Days' },
  { value: '60_days', label: '60 Days' }
]

export function closingTatLabel(value) {
  return CLOSING_TAT_OPTIONS.find((t) => t.value === value)?.label || value || '—'
}

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: '#E5484D' },
  { value: 'partial', label: 'Partial', color: '#F5A623' },
  { value: 'paid', label: 'Paid', color: '#2DBE7E' }
]

export function paymentStatusMeta(value) {
  return PAYMENT_STATUS_OPTIONS.find((s) => s.value === value) || PAYMENT_STATUS_OPTIONS[0]
}

export const PAYMENT_MODE_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' }
]

export function paymentModeLabel(value) {
  return PAYMENT_MODE_OPTIONS.find((m) => m.value === value)?.label || value
}

export function formatPriceRange(price, priceMax) {
  if (price == null && priceMax == null) return '—'
  if (priceMax != null && Number(priceMax) > 0 && Number(priceMax) !== Number(price)) {
    return `₹${Number(price || 0).toLocaleString('en-IN')} – ₹${Number(priceMax).toLocaleString('en-IN')}`
  }
  return price != null ? `₹${Number(price).toLocaleString('en-IN')}` : '—'
}
