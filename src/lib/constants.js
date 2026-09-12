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
