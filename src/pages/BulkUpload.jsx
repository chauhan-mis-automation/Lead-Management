import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { STATUS_OPTIONS, SOURCE_OPTIONS, PRIORITY_OPTIONS } from '../lib/constants'
import './BulkUpload.css'

const HEADER_ALIASES = {
  'lead name': 'lead_name', 'name': 'lead_name', 'leadname': 'lead_name',
  'mobile': 'mobile', 'phone': 'mobile', 'mobile number': 'mobile', 'contact': 'mobile', 'whatsapp': 'mobile',
  'email': 'email', 'email address': 'email',
  'company': 'company', 'company name': 'company',
  'source': 'source', 'lead source': 'source',
  'status': 'status', 'lead status': 'status',
  'priority': 'priority', 'lead priority': 'priority',
  'budget': 'budget',
  'requirement': 'requirement', 'need': 'requirement', 'notes': 'requirement',
  'product': 'product', 'product/service': 'product', 'product name': 'product', 'service': 'product',
  'assigned to': 'assigned_to', 'assigned user': 'assigned_to', 'assignee': 'assigned_to',
  'next follow-up': 'next_followup_date', 'next followup date': 'next_followup_date',
  'follow up date': 'next_followup_date', 'next follow up': 'next_followup_date', 'follow-up date & time': 'next_followup_date'
}

const VALID_STATUS_VALUES = STATUS_OPTIONS.map((s) => s.value)
const STATUS_LABEL_TO_VALUE = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.label.toLowerCase(), s.value]))
const VALID_SOURCE_VALUES = SOURCE_OPTIONS.map((s) => s.value)
const SOURCE_LABEL_TO_VALUE = Object.fromEntries(SOURCE_OPTIONS.map((s) => [s.label.toLowerCase(), s.value]))
const VALID_PRIORITY_VALUES = PRIORITY_OPTIONS.map((p) => p.value)
const PRIORITY_LABEL_TO_VALUE = Object.fromEntries(PRIORITY_OPTIONS.map((p) => [p.label.toLowerCase(), p.value]))

function normalizeRow(rawRow) {
  const row = {}
  for (const key of Object.keys(rawRow)) {
    const normalizedKey = HEADER_ALIASES[key.trim().toLowerCase()]
    if (!normalizedKey) continue
    const raw = rawRow[key]
    // Keep the raw value (Date object / Excel serial number) for the date column —
    // stringifying it here would lose the type info needed to parse it correctly.
    row[normalizedKey] = normalizedKey === 'next_followup_date' ? raw : String(raw ?? '').trim()
  }
  return row
}

function normalizeName(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

function resolveStatus(value) {
  if (!value) return 'new_lead'
  const v = value.toLowerCase()
  if (VALID_STATUS_VALUES.includes(v.replace(/\s+/g, '_'))) return v.replace(/\s+/g, '_')
  if (STATUS_LABEL_TO_VALUE[v]) return STATUS_LABEL_TO_VALUE[v]
  return 'new_lead'
}

function resolveSource(value) {
  if (!value) return 'bulk_upload'
  const v = value.toLowerCase()
  if (VALID_SOURCE_VALUES.includes(v.replace(/\s+/g, '_'))) return v.replace(/\s+/g, '_')
  if (SOURCE_LABEL_TO_VALUE[v]) return SOURCE_LABEL_TO_VALUE[v]
  return 'other'
}

function resolvePriority(value) {
  if (!value) return 'medium'
  const v = value.toLowerCase()
  if (VALID_PRIORITY_VALUES.includes(v)) return v
  if (PRIORITY_LABEL_TO_VALUE[v]) return PRIORITY_LABEL_TO_VALUE[v]
  return 'medium'
}

// Excel stores dates as a serial day-count from 1899-12-30. When a cell isn't
// read with cellDates, sheet_to_json hands back this raw number instead of a Date.
function excelSerialToDate(serial) {
  const utcDays = Math.floor(serial - 25569)
  const dateInfo = new Date(utcDays * 86400 * 1000)
  const fractionalDay = serial - Math.floor(serial)
  const totalSeconds = Math.round(86400 * fractionalDay)
  dateInfo.setSeconds(dateInfo.getSeconds() + totalSeconds)
  return dateInfo
}

function parseDate(value) {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString()
  }

  if (typeof value === 'number') {
    const d = excelSerialToDate(value)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  const str = String(value).trim()
  if (!str) return null

  // Explicit DD/MM/YYYY or DD-MM-YYYY (Indian format), optionally with a time.
  const dmy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/)
  if (dmy) {
    let [, a, b, y, hh, mm] = dmy
    if (y.length === 2) y = (Number(y) < 70 ? '20' : '19') + y
    let day = Number(a)
    let month = Number(b)
    if (month > 12 && day <= 12) { const t = day; day = month; month = t } // handle MM/DD/YYYY fallback
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const dt = new Date(Number(y), month - 1, day, hh ? Number(hh) : 0, mm ? Number(mm) : 0)
      if (!isNaN(dt.getTime())) return dt.toISOString()
    }
  }

  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export default function BulkUpload() {
  const navigate = useNavigate()
  const { session } = useAuth()

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])

  useEffect(() => {
    async function loadLookups() {
      const [productsRes, usersRes] = await Promise.all([
        supabase.from('products').select('id, product_name').eq('is_active', true),
        supabase.from('profiles').select('id, full_name').in('role', ['sales', 'bde', 'calling'])
      ])
      setProducts(productsRes.data || [])
      setUsers(usersRes.data || [])
    }
    loadLookups()
  }, [])

  function resolveProductId(name) {
    if (!name) return null
    const target = normalizeName(name)
    const match = products.find((p) => normalizeName(p.product_name) === target)
    return match?.id || null
  }

  function resolveAssignedTo(name) {
    if (!name) return null
    const target = normalizeName(name)
    const match = users.find((u) => normalizeName(u.full_name) === target)
    return match?.id || null
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setResult(null)
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        const processed = rawRows.map((r, i) => {
          const norm = normalizeRow(r)
          const issues = []
          if (!norm.lead_name) issues.push('Missing lead name')

          const followupRawProvided = norm.next_followup_date !== undefined && norm.next_followup_date !== null && String(norm.next_followup_date).trim() !== ''
          const next_followup_date = parseDate(norm.next_followup_date)
          const followup_invalid = followupRawProvided && !next_followup_date

          const product_name = norm.product || ''
          const assigned_name = norm.assigned_to || ''
          const product_unmatched = !!product_name && !resolveProductId(product_name)
          const assigned_unmatched = !!assigned_name && !resolveAssignedTo(assigned_name)

          return {
            _row: i + 2,
            lead_name: norm.lead_name || '',
            mobile: norm.mobile || '',
            email: norm.email || '',
            company: norm.company || '',
            source: resolveSource(norm.source),
            status: resolveStatus(norm.status),
            priority: resolvePriority(norm.priority),
            budget: norm.budget ? Number(norm.budget.replace(/[^0-9.]/g, '')) || null : null,
            requirement: norm.requirement || '',
            product_name,
            assigned_name,
            product_unmatched,
            assigned_unmatched,
            next_followup_date,
            followup_invalid,
            valid: issues.length === 0,
            issues
          }
        })

        if (processed.length === 0) {
          setError('No rows found in this file. Please check the format.')
          setRows([])
        } else {
          setRows(processed)
        }
      } catch (err) {
        setError('Could not read this file. Please make sure it is a valid .xlsx, .xls, or .csv file.')
        setRows([])
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleUpload() {
    const validRows = rows.filter((r) => r.valid)
    if (validRows.length === 0) return

    setUploading(true)
    const payload = validRows.map((r) => ({
      lead_name: r.lead_name,
      mobile: r.mobile || null,
      email: r.email || null,
      company: r.company || null,
      source: r.source,
      status: r.status,
      priority: r.priority,
      budget: r.budget,
      requirement: r.requirement || null,
      product_id: resolveProductId(r.product_name),
      assigned_to: resolveAssignedTo(r.assigned_name),
      next_followup_date: r.next_followup_date,
      created_by: session?.user?.id
    }))

    const { error: insertError } = await supabase.from('leads').insert(payload)

    setUploading(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setResult({ inserted: validRows.length, skipped: rows.length - validRows.length })
    setRows([])
  }

  function downloadTemplate() {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ['Lead Name', 'Mobile', 'Email', 'Company', 'Source', 'Status', 'Priority', 'Budget', 'Requirement', 'Product', 'Assigned To', 'Next Follow-up Date'],
      ['Rahul Sharma', '9876543210', 'rahul@example.com', 'ABC Traders', 'Website Form', 'New Lead', 'High', '30000', 'Needs a new website', 'Website Development', 'Priya Singh', '2026-09-20']
    ])
    XLSX.utils.book_append_sheet(wb, ws, 'Leads')
    XLSX.writeFile(wb, 'lead_upload_template.xlsx')
  }

  const validCount = rows.filter((r) => r.valid).length
  const invalidCount = rows.length - validCount

  return (
    <div>
      <button className="back-link" onClick={() => navigate('/leads')}>← Back to Leads</button>

      <div className="bulk-header">
        <div>
          <h1>Bulk Upload Leads</h1>
          <p className="bulk-subtitle">Upload an Excel (.xlsx) or CSV file to add multiple leads at once.</p>
        </div>
        <button className="btn-ghost" onClick={downloadTemplate}>Download Sample Template</button>
      </div>

      {result ? (
        <div className="info-card result-card">
          <h3>Upload Complete</h3>
          <p><strong>{result.inserted}</strong> leads were added successfully.</p>
          {result.skipped > 0 && <p>{result.skipped} row(s) were skipped due to missing data.</p>}
          <div className="bulk-actions">
            <button className="btn-primary" onClick={() => navigate('/leads')}>Go to Leads</button>
            <button className="btn-ghost" onClick={() => { setResult(null); setFileName('') }}>Upload Another File</button>
          </div>
        </div>
      ) : (
        <>
          <div className="info-card">
            <h3>1. Choose File</h3>
            <p className="bulk-hint">
              Expected columns: <strong>Lead Name</strong> (required), Mobile, Email, Company, Source, Status, Priority, Budget, Requirement, Product, Assigned To, Next Follow-up Date.
              Column names are matched flexibly — "Name", "Phone", "Service" etc. also work. Product and Assigned To must match an existing Product/User name exactly (spelling can differ in case) — the preview below will flag any that don't match.
              Next Follow-up Date accepts a real Excel date cell, or text like <strong>25/09/2026</strong> or <strong>2026-09-25 14:30</strong>.
            </p>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="file-input" />
            {fileName && <p className="bulk-filename">Selected: {fileName}</p>}
            {error && <div className="form-error">{error}</div>}
          </div>

          {rows.length > 0 && (
            <div className="info-card">
              <div className="preview-header">
                <h3>2. Preview ({rows.length} rows)</h3>
                <div className="preview-counts">
                  <span className="count-good">{validCount} valid</span>
                  {invalidCount > 0 && <span className="count-bad">{invalidCount} will be skipped</span>}
                </div>
              </div>

              <div className="preview-table-wrap">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Lead Name</th>
                      <th>Mobile</th>
                      <th>Company</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Budget</th>
                      <th>Product</th>
                      <th>Assigned To</th>
                      <th>Next Follow-up</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r) => (
                      <tr key={r._row} className={r.valid ? '' : 'row-invalid'}>
                        <td>{r._row}</td>
                        <td>{r.lead_name || '—'}</td>
                        <td>{r.mobile || '—'}</td>
                        <td>{r.company || '—'}</td>
                        <td>{r.source}</td>
                        <td>{r.status}</td>
                        <td>{r.priority}</td>
                        <td>{r.budget ? `₹${r.budget.toLocaleString('en-IN')}` : '—'}</td>
                        <td>
                          {r.product_name || '—'}
                          {r.product_unmatched && <div className="tag-warn">Not found in Products — will save without product</div>}
                        </td>
                        <td>
                          {r.assigned_name || '—'}
                          {r.assigned_unmatched && <div className="tag-warn">Not found in Users — will stay unassigned</div>}
                        </td>
                        <td>
                          {r.next_followup_date
                            ? new Date(r.next_followup_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                          {r.followup_invalid && <div className="tag-warn">Could not read this date — check format</div>}
                        </td>
                        <td>{r.valid ? <span className="tag-ok">Valid</span> : <span className="tag-bad">{r.issues.join(', ')}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && <p className="bulk-hint">Showing first 50 of {rows.length} rows.</p>}
              </div>

              <div className="bulk-actions">
                <button className="btn-primary" onClick={handleUpload} disabled={uploading || validCount === 0}>
                  {uploading ? 'Uploading…' : `Upload ${validCount} Lead${validCount === 1 ? '' : 's'}`}
                </button>
                <button className="btn-ghost" onClick={() => { setRows([]); setFileName('') }}>Cancel</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
