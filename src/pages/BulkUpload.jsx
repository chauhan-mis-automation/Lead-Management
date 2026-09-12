import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { STATUS_OPTIONS } from '../lib/constants'
import './BulkUpload.css'

const HEADER_ALIASES = {
  'lead name': 'lead_name', 'name': 'lead_name', 'leadname': 'lead_name',
  'mobile': 'mobile', 'phone': 'mobile', 'mobile number': 'mobile', 'contact': 'mobile',
  'email': 'email', 'email address': 'email',
  'company': 'company', 'company name': 'company',
  'source': 'source',
  'status': 'status',
  'next follow-up': 'next_followup_date', 'next followup date': 'next_followup_date',
  'follow up date': 'next_followup_date', 'next follow up': 'next_followup_date'
}

const VALID_STATUS_VALUES = STATUS_OPTIONS.map((s) => s.value)
const STATUS_LABEL_TO_VALUE = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.label.toLowerCase(), s.value]))

function normalizeRow(rawRow) {
  const row = {}
  for (const key of Object.keys(rawRow)) {
    const normalizedKey = HEADER_ALIASES[key.trim().toLowerCase()]
    if (normalizedKey) row[normalizedKey] = String(rawRow[key] ?? '').trim()
  }
  return row
}

function resolveStatus(value) {
  if (!value) return 'new_lead'
  const v = value.toLowerCase()
  if (VALID_STATUS_VALUES.includes(v.replace(/\s+/g, '_'))) return v.replace(/\s+/g, '_')
  if (STATUS_LABEL_TO_VALUE[v]) return STATUS_LABEL_TO_VALUE[v]
  return 'new_lead'
}

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
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
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        const processed = rawRows.map((r, i) => {
          const norm = normalizeRow(r)
          const issues = []
          if (!norm.lead_name) issues.push('Missing lead name')
          return {
            _row: i + 2,
            lead_name: norm.lead_name || '',
            mobile: norm.mobile || '',
            email: norm.email || '',
            company: norm.company || '',
            status: resolveStatus(norm.status),
            next_followup_date: parseDate(norm.next_followup_date),
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
      source: 'bulk_upload',
      status: r.status,
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
      ['Lead Name', 'Mobile', 'Email', 'Company', 'Status', 'Next Follow-up Date'],
      ['Rahul Sharma', '9876543210', 'rahul@example.com', 'ABC Traders', 'New Lead', '2026-09-20']
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
              Expected columns: <strong>Lead Name</strong> (required), Mobile, Email, Company, Status, Next Follow-up Date.
              Column names are matched flexibly — "Name", "Phone", "Contact" etc. also work.
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
                      <th>Email</th>
                      <th>Company</th>
                      <th>Status</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r) => (
                      <tr key={r._row} className={r.valid ? '' : 'row-invalid'}>
                        <td>{r._row}</td>
                        <td>{r.lead_name || '—'}</td>
                        <td>{r.mobile || '—'}</td>
                        <td>{r.email || '—'}</td>
                        <td>{r.company || '—'}</td>
                        <td>{r.status}</td>
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
