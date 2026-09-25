import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './GlobalSearch.css'

export default function GlobalSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    function onClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const term = query.trim()
    if (term.length < 2) {
      setResults(null)
      return
    }
    debounceRef.current = setTimeout(() => runSearch(term), 350)
    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  async function runSearch(term) {
    setLoading(true)
    setOpen(true)
    const pattern = `%${term}%`

    const [leadsRes, ordersRes, customersRes, quotesRes] = await Promise.all([
      supabase
        .from('leads')
        .select('id, lead_name, company, mobile, email, status')
        .or(`lead_name.ilike.${pattern},company.ilike.${pattern},mobile.ilike.${pattern},email.ilike.${pattern}`)
        .limit(5),
      supabase
        .from('orders')
        .select('id, order_number, company, order_value, status')
        .or(`order_number.ilike.${pattern},company.ilike.${pattern}`)
        .limit(5),
      supabase
        .from('customers')
        .select('id, company_name, contact_name, mobile, email')
        .or(`company_name.ilike.${pattern},contact_name.ilike.${pattern},mobile.ilike.${pattern},email.ilike.${pattern}`)
        .limit(5),
      supabase
        .from('quotations')
        .select('id, quotation_number, company, amount, status')
        .or(`quotation_number.ilike.${pattern},company.ilike.${pattern}`)
        .limit(5)
    ])

    setResults({
      leads: leadsRes.data || [],
      orders: ordersRes.data || [],
      customers: customersRes.data || [],
      quotations: quotesRes.data || []
    })
    setLoading(false)
  }

  function goTo(path) {
    setOpen(false)
    setQuery('')
    setResults(null)
    navigate(path)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (query.trim()) {
      setOpen(false)
      navigate(`/leads?search=${encodeURIComponent(query.trim())}`)
    }
  }

  const totalCount = results
    ? results.leads.length + results.orders.length + results.customers.length + results.quotations.length
    : 0

  return (
    <div className="global-search" ref={wrapRef}>
      <form className="top-header-search" onSubmit={handleSubmit}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/><path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        <input
          placeholder="Search leads, orders, customers, quotations…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results) setOpen(true) }}
        />
      </form>

      {open && query.trim().length >= 2 && (
        <div className="global-search-dropdown">
          {loading ? (
            <p className="global-search-note">Searching…</p>
          ) : totalCount === 0 ? (
            <p className="global-search-note">No matches for "{query.trim()}".</p>
          ) : (
            <>
              {results.leads.length > 0 && (
                <div className="gs-group">
                  <div className="gs-group-title">Leads</div>
                  {results.leads.map((l) => (
                    <button key={l.id} className="gs-row" onClick={() => goTo(`/leads/${l.id}`)}>
                      <span className="gs-row-name">{l.lead_name}</span>
                      <span className="gs-row-sub">{l.company || l.mobile || '—'}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.orders.length > 0 && (
                <div className="gs-group">
                  <div className="gs-group-title">Orders</div>
                  {results.orders.map((o) => (
                    <button key={o.id} className="gs-row" onClick={() => goTo('/orders')}>
                      <span className="gs-row-name">{o.order_number}</span>
                      <span className="gs-row-sub">{o.company || '—'}{o.order_value ? ` · ₹${Number(o.order_value).toLocaleString('en-IN')}` : ''}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.customers.length > 0 && (
                <div className="gs-group">
                  <div className="gs-group-title">Customers</div>
                  {results.customers.map((c) => (
                    <button key={c.id} className="gs-row" onClick={() => goTo('/customers')}>
                      <span className="gs-row-name">{c.company_name || c.contact_name}</span>
                      <span className="gs-row-sub">{c.contact_name && c.company_name ? c.contact_name : c.mobile || c.email || '—'}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.quotations.length > 0 && (
                <div className="gs-group">
                  <div className="gs-group-title">Quotations</div>
                  {results.quotations.map((q) => (
                    <button key={q.id} className="gs-row" onClick={() => goTo('/quotations')}>
                      <span className="gs-row-name">{q.quotation_number}</span>
                      <span className="gs-row-sub">{q.company || '—'}{q.amount ? ` · ₹${Number(q.amount).toLocaleString('en-IN')}` : ''}</span>
                    </button>
                  ))}
                </div>
              )}
              <button className="gs-view-all" onClick={handleSubmit}>See all results for "{query.trim()}" →</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
