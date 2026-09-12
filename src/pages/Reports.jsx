import { useEffect, useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { SOURCE_OPTIONS } from '../lib/constants'
import './Reports.css'

const ROLE_LABELS = { admin: 'Admin', subadmin: 'Subadmin', sales: 'Sales', bde: 'BDE', calling: 'Calling' }

function firstDayOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function Reports() {
  const { profile } = useAuth()
  const canView = ['admin', 'subadmin'].includes(profile?.role)

  const [fromDate, setFromDate] = useState(firstDayOfMonth())
  const [toDate, setToDate] = useState(today())
  const [leads, setLeads] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const rangeStart = new Date(fromDate + 'T00:00:00').toISOString()
    const rangeEnd = new Date(toDate + 'T23:59:59').toISOString()

    const [leadsRes, usersRes] = await Promise.all([
      supabase
        .from('leads')
        .select('status, source, assigned_to, order_value, created_at')
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd),
      supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['sales', 'bde', 'calling'])
        .order('full_name')
    ])

    setLeads(leadsRes.data || [])
    setUsers(usersRes.data || [])
    setLoading(false)
  }, [fromDate, toDate])

  useEffect(() => {
    if (canView) loadData()
  }, [canView, loadData])

  if (!canView) {
    return (
      <div>
        <h1>Reports & MIS</h1>
        <p className="reports-subtitle">This page is only available to Admin and Subadmin.</p>
      </div>
    )
  }

  const total = leads.length
  const won = leads.filter((l) => l.status === 'won_order').length
  const lost = leads.filter((l) => l.status === 'lost_order').length
  const conversion = total ? Math.round((won / total) * 100) : 0
  const totalSalesValue = leads
    .filter((l) => l.status === 'won_order' && l.order_value)
    .reduce((sum, l) => sum + Number(l.order_value), 0)

  const sourceWise = SOURCE_OPTIONS
    .map((s) => {
      const count = leads.filter((l) => l.source === s.value).length
      return { label: s.label, count, pct: total ? Math.round((count / total) * 100) : 0 }
    })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)

  const bdeWise = users
    .map((u) => {
      const theirs = leads.filter((l) => l.assigned_to === u.id)
      const theirWon = theirs.filter((l) => l.status === 'won_order').length
      const theirLost = theirs.filter((l) => l.status === 'lost_order').length
      const conv = theirs.length ? Math.round((theirWon / theirs.length) * 100) : 0
      return { ...u, total: theirs.length, won: theirWon, lost: theirLost, conv }
    })
    .filter((u) => u.total > 0)
    .sort((a, b) => b.total - a.total)

  function handleExport() {
    const wb = XLSX.utils.book_new()

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Report Period', `${fromDate} to ${toDate}`],
      [],
      ['Metric', 'Value'],
      ['Total Leads', total],
      ['Won Orders', won],
      ['Lost Orders', lost],
      ['Conversion Rate', `${conversion}%`],
      ['Total Sales Value (₹)', totalSalesValue]
    ])
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    const sourceSheet = XLSX.utils.aoa_to_sheet([
      ['Source', 'Leads', 'Percent'],
      ...sourceWise.map((s) => [s.label, s.count, `${s.pct}%`])
    ])
    XLSX.utils.book_append_sheet(wb, sourceSheet, 'Source-wise')

    const bdeSheet = XLSX.utils.aoa_to_sheet([
      ['Name', 'Role', 'Total Leads', 'Won', 'Lost', 'Conversion'],
      ...bdeWise.map((u) => [u.full_name, ROLE_LABELS[u.role], u.total, u.won, u.lost, `${u.conv}%`])
    ])
    XLSX.utils.book_append_sheet(wb, bdeSheet, 'BDE-wise')

    XLSX.writeFile(wb, `sales_report_${fromDate}_to_${toDate}.xlsx`)
  }

  return (
    <div>
      <div className="reports-header">
        <div>
          <h1>Reports & MIS</h1>
          <p className="reports-subtitle">Sales performance for the selected period</p>
        </div>
        <button className="btn-primary" onClick={handleExport} disabled={loading || total === 0}>Export to Excel</button>
      </div>

      <div className="reports-filters">
        <div className="field">
          <label>From</label>
          <input className="text-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="field">
          <label>To</label>
          <input className="text-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <p className="reports-note">Loading report…</p>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-value">{total}</span>
              <span className="stat-label">Total Leads</span>
            </div>
            <div className="stat-card good">
              <span className="stat-value">{won}</span>
              <span className="stat-label">Won Orders</span>
            </div>
            <div className="stat-card warn">
              <span className="stat-value">{lost}</span>
              <span className="stat-label">Lost Orders</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{conversion}%</span>
              <span className="stat-label">Conversion Rate</span>
            </div>
            <div className="stat-card good">
              <span className="stat-value">₹{totalSalesValue.toLocaleString('en-IN')}</span>
              <span className="stat-label">Total Sales Value</span>
            </div>
          </div>

          <div className="reports-panels">
            <div className="panel-card">
              <h3>Source-wise Leads</h3>
              {sourceWise.length === 0 ? (
                <p className="reports-note">No leads in this period.</p>
              ) : (
                <table className="reports-table">
                  <thead><tr><th>Source</th><th>Leads</th><th>%</th></tr></thead>
                  <tbody>
                    {sourceWise.map((s) => (
                      <tr key={s.label}><td>{s.label}</td><td>{s.count}</td><td>{s.pct}%</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="panel-card">
              <h3>BDE-wise Performance</h3>
              {bdeWise.length === 0 ? (
                <p className="reports-note">No assigned leads in this period.</p>
              ) : (
                <table className="reports-table">
                  <thead><tr><th>Name</th><th>Total</th><th>Won</th><th>Lost</th><th>Conv.</th></tr></thead>
                  <tbody>
                    {bdeWise.map((u) => (
                      <tr key={u.id}>
                        <td>{u.full_name}</td>
                        <td>{u.total}</td>
                        <td>{u.won}</td>
                        <td>{u.lost}</td>
                        <td>{u.conv}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
