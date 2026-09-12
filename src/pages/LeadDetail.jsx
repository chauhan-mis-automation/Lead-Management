import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { STATUS_OPTIONS, sourceLabel, statusMeta } from '../lib/constants'
import './LeadDetail.css'

const WON = 'won_order'
const LOST = 'lost_order'

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, session } = useAuth()
  const isManager = ['admin', 'subadmin'].includes(profile?.role)

  const [lead, setLead] = useState(null)
  const [users, setUsers] = useState([])
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // quick-action form state
  const [callRemark, setCallRemark] = useState('')
  const [callDuration, setCallDuration] = useState('')
  const [followRemark, setFollowRemark] = useState('')
  const [followDate, setFollowDate] = useState('')
  const [followStatus, setFollowStatus] = useState('')
  const [saving, setSaving] = useState(false)

  // order closure fields
  const [orderValue, setOrderValue] = useState('')
  const [closingDate, setClosingDate] = useState('')
  const [projectDetails, setProjectDetails] = useState('')
  const [lossReason, setLossReason] = useState('')
  const [competitorName, setCompetitorName] = useState('')

  const loadLead = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('leads')
      .select('*, assigned_profile:profiles!leads_assigned_to_fkey(id, full_name)')
      .eq('id', id)
      .single()

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setLead(data)
      setOrderValue(data.order_value || '')
      setClosingDate(data.closing_date || '')
      setProjectDetails(data.project_details || '')
      setLossReason(data.loss_reason || '')
      setCompetitorName(data.competitor_name || '')
    }
  }, [id])

  const loadTimeline = useCallback(async () => {
    const [callsRes, followsRes] = await Promise.all([
      supabase
        .from('call_history')
        .select('*, created_by_profile:profiles!call_history_created_by_fkey(full_name)')
        .eq('lead_id', id)
        .order('call_date', { ascending: false }),
      supabase
        .from('followup_history')
        .select('*, created_by_profile:profiles!followup_history_created_by_fkey(full_name)')
        .eq('lead_id', id)
        .order('followup_date', { ascending: false })
    ])

    const calls = (callsRes.data || []).map((c) => ({
      type: 'call',
      date: c.call_date,
      remarks: c.remarks,
      duration: c.duration_seconds,
      by: c.created_by_profile?.full_name
    }))
    const follows = (followsRes.data || []).map((f) => ({
      type: 'followup',
      date: f.followup_date,
      remarks: f.remarks,
      status: f.status,
      by: f.created_by_profile?.full_name
    }))

    const merged = [...calls, ...follows].sort((a, b) => new Date(b.date) - new Date(a.date))
    setTimeline(merged)
  }, [id])

  const loadUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['sales', 'bde', 'calling'])
      .order('full_name')
    setUsers(data || [])
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([loadLead(), loadTimeline(), isManager ? loadUsers() : Promise.resolve()])
      setLoading(false)
    }
    init()
  }, [loadLead, loadTimeline, loadUsers, isManager])

  async function handleAssign(newAssigneeId) {
    const { error: updateError } = await supabase
      .from('leads')
      .update({ assigned_to: newAssigneeId || null })
      .eq('id', id)
    if (!updateError) loadLead()
  }

  async function handleStatusChange(newStatus) {
    setSaving(true)
    const { error: updateError } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', id)

    if (!updateError) {
      await supabase.from('followup_history').insert({
        lead_id: id,
        status: newStatus,
        remarks: 'Status updated',
        created_by: session?.user?.id
      })
      await loadLead()
      await loadTimeline()
    }
    setSaving(false)
  }

  async function handleLogCall(e) {
    e.preventDefault()
    if (!callRemark.trim()) return
    setSaving(true)
    await supabase.from('call_history').insert({
      lead_id: id,
      remarks: callRemark.trim(),
      duration_seconds: callDuration ? Number(callDuration) * 60 : null,
      created_by: session?.user?.id
    })
    setCallRemark('')
    setCallDuration('')
    await loadTimeline()
    setSaving(false)
  }

  async function handleAddFollowup(e) {
    e.preventDefault()
    if (!followRemark.trim()) return
    setSaving(true)

    await supabase.from('followup_history').insert({
      lead_id: id,
      remarks: followRemark.trim(),
      status: followStatus || lead.status,
      created_by: session?.user?.id
    })

    const leadUpdate = {}
    if (followDate) leadUpdate.next_followup_date = new Date(followDate).toISOString()
    if (followStatus) leadUpdate.status = followStatus

    if (Object.keys(leadUpdate).length > 0) {
      await supabase.from('leads').update(leadUpdate).eq('id', id)
    }

    setFollowRemark('')
    setFollowDate('')
    setFollowStatus('')
    await loadLead()
    await loadTimeline()
    setSaving(false)
  }

  async function handleSaveClosure(e) {
    e.preventDefault()
    setSaving(true)

    const payload = lead.status === WON
      ? { order_value: orderValue || null, closing_date: closingDate || null, project_details: projectDetails || null }
      : { loss_reason: lossReason || null, competitor_name: competitorName || null }

    await supabase.from('leads').update(payload).eq('id', id)
    await loadLead()
    setSaving(false)
  }

  if (loading) return <p className="lead-detail-loading">Loading lead…</p>
  if (error) return <div className="form-error">{error}</div>
  if (!lead) return null

  const meta = statusMeta(lead.status)

  return (
    <div className="lead-detail">
      <button className="back-link" onClick={() => navigate('/leads')}>← Back to Leads</button>

      <div className="lead-detail-header">
        <div>
          <h1>{lead.lead_name}</h1>
          {lead.company && <p className="lead-detail-company">{lead.company}</p>}
        </div>
        <span className="status-badge large" style={{ '--badge-color': meta.color }}>{meta.label}</span>
      </div>

      <div className="lead-detail-grid">
        <div className="info-card">
          <h3>Lead Info</h3>
          <dl>
            <dt>Mobile</dt><dd>{lead.mobile || '—'}</dd>
            <dt>Email</dt><dd>{lead.email || '—'}</dd>
            <dt>Source</dt><dd>{sourceLabel(lead.source)}</dd>
            <dt>Created</dt><dd>{new Date(lead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</dd>
            <dt>Next Follow-up</dt>
            <dd>
              {lead.next_followup_date
                ? new Date(lead.next_followup_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : '—'}
            </dd>
          </dl>
        </div>

        <div className="info-card">
          <h3>Status & Assignment</h3>
          <div className="field">
            <label>Status</label>
            <select className="text-input" value={lead.status} onChange={(e) => handleStatusChange(e.target.value)} disabled={saving}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Assigned To</label>
            {isManager ? (
              <select
                className="text-input"
                value={lead.assigned_to || ''}
                onChange={(e) => handleAssign(e.target.value)}
              >
                <option value="">-- Unassigned --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                ))}
              </select>
            ) : (
              <p className="static-value">{lead.assigned_profile?.full_name || 'Unassigned'}</p>
            )}
          </div>
        </div>
      </div>

      {(lead.status === WON || lead.status === LOST) && (
        <div className="info-card closure-card">
          <h3>{lead.status === WON ? 'Order Details (Won)' : 'Loss Details'}</h3>
          <form onSubmit={handleSaveClosure} className="closure-form">
            {lead.status === WON ? (
              <>
                <div className="field">
                  <label>Order Value (₹)</label>
                  <input className="text-input" type="number" value={orderValue} onChange={(e) => setOrderValue(e.target.value)} />
                </div>
                <div className="field">
                  <label>Closing Date</label>
                  <input className="text-input" type="date" value={closingDate || ''} onChange={(e) => setClosingDate(e.target.value)} />
                </div>
                <div className="field wide">
                  <label>Project Details</label>
                  <textarea className="text-input" rows={2} value={projectDetails} onChange={(e) => setProjectDetails(e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label>Loss Reason</label>
                  <input className="text-input" value={lossReason} onChange={(e) => setLossReason(e.target.value)} placeholder="e.g. Budget, timing…" />
                </div>
                <div className="field">
                  <label>Competitor Name</label>
                  <input className="text-input" value={competitorName} onChange={(e) => setCompetitorName(e.target.value)} />
                </div>
              </>
            )}
            <button type="submit" className="btn-primary" disabled={saving}>Save Details</button>
          </form>
        </div>
      )}

      <div className="lead-detail-grid">
        <form className="info-card action-form" onSubmit={handleLogCall}>
          <h3>Log a Call</h3>
          <div className="field">
            <label>Remarks</label>
            <textarea className="text-input" rows={3} value={callRemark} onChange={(e) => setCallRemark(e.target.value)} placeholder="What was discussed?" required />
          </div>
          <div className="field">
            <label>Duration (minutes)</label>
            <input className="text-input" type="number" value={callDuration} onChange={(e) => setCallDuration(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>Save Call Log</button>
        </form>

        <form className="info-card action-form" onSubmit={handleAddFollowup}>
          <h3>Add Follow-up</h3>
          <div className="field">
            <label>Remarks</label>
            <textarea className="text-input" rows={3} value={followRemark} onChange={(e) => setFollowRemark(e.target.value)} placeholder="Follow-up notes…" required />
          </div>
          <div className="field">
            <label>Next Follow-up Date</label>
            <input className="text-input" type="datetime-local" value={followDate} onChange={(e) => setFollowDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Update Status (optional)</label>
            <select className="text-input" value={followStatus} onChange={(e) => setFollowStatus(e.target.value)}>
              <option value="">Keep current status</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>Save Follow-up</button>
        </form>
      </div>

      <div className="info-card">
        <h3>Timeline</h3>
        {timeline.length === 0 ? (
          <p className="static-value">No activity logged yet.</p>
        ) : (
          <ul className="timeline-list">
            {timeline.map((item, i) => (
              <li key={i} className={'timeline-item ' + item.type}>
                <div className="timeline-dot" />
                <div className="timeline-body">
                  <div className="timeline-top">
                    <span className="timeline-type">{item.type === 'call' ? 'Call' : 'Follow-up'}</span>
                    <span className="timeline-date">
                      {new Date(item.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="timeline-remark">{item.remarks}</p>
                  <div className="timeline-meta">
                    {item.duration ? <span>{Math.round(item.duration / 60)} min</span> : null}
                    {item.status ? <span>Status: {statusMeta(item.status).label}</span> : null}
                    {item.by ? <span>by {item.by}</span> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
