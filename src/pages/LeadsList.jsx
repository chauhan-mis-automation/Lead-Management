import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { STATUS_OPTIONS, SOURCE_OPTIONS, statusMeta, sourceLabel } from '../lib/constants'
import LeadFormModal from '../components/LeadFormModal'
import EditLeadModal from '../components/EditLeadModal'
import './LeadsList.css'

export default function LeadsList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { profile, session } = useAuth()
  const role = profile?.role
  const isManager = ['admin', 'subadmin'].includes(role)

  const [leads, setLeads] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingLead, setEditingLead] = useState(null)

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [sourceFilter, setSourceFilter] = useState('')
  const [taskFilter, setTaskFilter] = useState(searchParams.get('task') || '')

  useEffect(() => {
    const q = searchParams.get('search')
    if (q !== null) setSearch(q)
    const s = searchParams.get('status')
    if (s !== null) setStatusFilter(s)
    const t = searchParams.get('task')
    setTaskFilter(t || '')
  }, [searchParams])

  const loadLeads = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('leads')
      .select('*, assigned_profile:profiles!leads_assigned_to_fkey(full_name)')
      .order('created_at', { ascending: false })

    if (!isManager && session?.user?.id) {
      query = query.eq('assigned_to', session.user.id)
    }
    if (statusFilter) query = query.eq('status', statusFilter)
    if (sourceFilter) query = query.eq('source', sourceFilter)

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setError('')
      setLeads(data || [])
    }
    setLoading(false)
  }, [isManager, session, statusFilter, sourceFilter])

  useEffect(() => {
    if (role) loadLeads()
  }, [role, loadLeads])

  useEffect(() => {
    async function loadUsers() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['sales', 'bde', 'calling'])
        .order('full_name')
      setUsers(data || [])
    }
    if (isManager) loadUsers()
  }, [isManager])

  async function handleDelete(lead) {
    const confirmed = window.confirm(
      `Delete lead "${lead.lead_name}"? This will also remove its call/follow-up history. This cannot be undone.`
    )
    if (!confirmed) return

    const { error: deleteError } = await supabase.from('leads').delete().eq('id', lead.id)
    if (!deleteError) {
      setLeads((prev) => prev.filter((l) => l.id !== lead.id))
    } else {
      alert('Could not delete lead: ' + deleteError.message)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  const filteredLeads = leads
    .filter((l) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        l.lead_name?.toLowerCase().includes(q) ||
        l.mobile?.toLowerCase().includes(q) ||
        l.company?.toLowerCase().includes(q)
      )
    })
    .filter((l) => {
      if (!taskFilter) return true
      const isOpen = !['won_order', 'lost_order'].includes(l.status)
      if (!l.next_followup_date || !isOpen) return false
      const followDate = l.next_followup_date.slice(0, 10)
      if (taskFilter === 'due_today') return followDate === today
      if (taskFilter === 'overdue') return followDate < today
      return true
    })

  const taskFilterLabel = taskFilter === 'due_today'
    ? 'Follow-ups Due Today'
    : taskFilter === 'overdue'
    ? 'Overdue Follow-ups'
    : ''

  function clearTaskFilter() {
    setTaskFilter('')
    navigate('/leads', { replace: true })
  }

  return (
    <div>
      <div className="leads-header">
        <div>
          <h1>Leads</h1>
          <p className="leads-subtitle">
            {isManager ? 'All leads' : 'Leads assigned to you'}
          </p>
        </div>
        {(isManager || role === 'sales') && (
          <div className="leads-header-actions">
            <button className="btn-ghost" onClick={() => navigate('/leads/bulk-upload')}>Bulk Upload</button>
            <button className="btn-primary" onClick={() => setShowForm(true)}>+ New Lead</button>
          </div>
        )}
      </div>

      {taskFilterLabel && (
        <div className="task-filter-banner">
          <span>Showing: <strong>{taskFilterLabel}</strong></span>
          <button onClick={clearTaskFilter}>Clear filter ✕</button>
        </div>
      )}

      <div className="leads-filters">
        <input
          className="text-input search-input"
          placeholder="Search by name, mobile, or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="text-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select className="text-input" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="">All Sources</option>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <p className="leads-empty">Loading leads…</p>
      ) : filteredLeads.length === 0 ? (
        <div className="leads-empty-state">
          <p>No leads found.</p>
          <span>Try adjusting the filters, or add a new lead.</span>
        </div>
      ) : (
        <div className="leads-table-wrap">
          <table className="leads-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Contact</th>
                <th>Source</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Next Follow-up</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => {
                const meta = statusMeta(lead.status)
                return (
                  <tr key={lead.id} className="clickable-row" onClick={() => navigate(`/leads/${lead.id}`)}>
                    <td>
                      <div className="lead-name-cell">{lead.lead_name}</div>
                      {lead.company && <div className="lead-company-cell">{lead.company}</div>}
                    </td>
                    <td>
                      <div>
                        {lead.mobile ? (
                          <a href={`tel:${lead.mobile}`} className="tel-link" onClick={(e) => e.stopPropagation()}>
                            📞 {lead.mobile}
                          </a>
                        ) : '—'}
                      </div>
                      {lead.email && <div className="lead-email-cell">{lead.email}</div>}
                    </td>
                    <td>{sourceLabel(lead.source)}</td>
                    <td>
                      <span className="status-badge" style={{ '--badge-color': meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td>{lead.assigned_profile?.full_name || '—'}</td>
                    <td>
                      {lead.next_followup_date
                        ? new Date(lead.next_followup_date).toLocaleString('en-IN', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                          })
                        : '—'}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-btn"
                          title="View lead"
                          onClick={(e) => { e.stopPropagation(); navigate(`/leads/${lead.id}`) }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M2 12C2 12 5.5 5.5 12 5.5C18.5 5.5 22 12 22 12C22 12 18.5 18.5 12 18.5C5.5 18.5 2 12 2 12Z" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7"/></svg>
                        </button>
                        {(isManager || role === 'sales') && (
                          <button
                            className="icon-btn"
                            title="Edit lead"
                            onClick={(e) => { e.stopPropagation(); setEditingLead(lead) }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 15.5V20Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
                          </button>
                        )}
                        {role === 'admin' && (
                          <button
                            className="icon-btn danger"
                            title="Delete lead"
                            onClick={(e) => { e.stopPropagation(); handleDelete(lead) }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <LeadFormModal
          users={users}
          currentUserId={session?.user?.id}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            loadLeads()
          }}
        />
      )}

      {editingLead && (
        <EditLeadModal
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onSaved={() => {
            setEditingLead(null)
            loadLeads()
          }}
        />
      )}
    </div>
  )
}
