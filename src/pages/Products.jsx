import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { formatPriceRange } from '../lib/constants'
import ProductFormModal from '../components/ProductFormModal'
import './Products.css'

export default function Products() {
  const { profile } = useAuth()
  const isAdmin = ['admin', 'subadmin'].includes(profile?.role)

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('products').select('*').order('created_at', { ascending: false })
    if (!showInactive) query = query.eq('is_active', true)
    const { data } = await query
    setProducts(data || [])
    setLoading(false)
  }, [showInactive])

  useEffect(() => { loadProducts() }, [loadProducts])

  async function toggleActive(product) {
    await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id)
    loadProducts()
  }

  const filtered = products.filter((p) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return p.product_name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q) || p.product_code?.toLowerCase().includes(q)
  })

  return (
    <div>
      <div className="products-header">
        <div>
          <h1>Products & Services</h1>
          <p className="products-subtitle">Catalog used in Leads and Quotations</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ New Product</button>
        )}
      </div>

      <div className="products-filters">
        <input
          className="text-input search-input"
          placeholder="Search by name, category, code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="products-toggle">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {loading ? (
        <p className="products-empty">Loading products…</p>
      ) : filtered.length === 0 ? (
        <div className="products-empty-state">
          <p>No products yet.</p>
          <span>Add your company's products or services so they can be selected in Leads and Quotations.</span>
        </div>
      ) : (
        <div className="products-table-wrap mobile-card-table">
          <table className="products-table">
            <thead>
              <tr>
                <th>Product / Service</th>
                <th>Category</th>
                <th>Code</th>
                <th>Price</th>
                <th>Tax</th>
                <th>Status</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td data-label="Product / Service">
                    <div className="product-name-cell">{p.product_name}</div>
                    {p.description && <div className="product-desc-cell">{p.description}</div>}
                  </td>
                  <td data-label="Category">{p.category || '—'}</td>
                  <td data-label="Code">{p.product_code || '—'}</td>
                  <td data-label="Price">{formatPriceRange(p.price, p.price_max)}</td>
                  <td data-label="Tax">{p.tax_percent != null ? `${p.tax_percent}%` : '—'}</td>
                  <td data-label="Status">
                    <span className={'status-dot' + (p.is_active ? ' active' : ' inactive')}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <div className="product-row-actions">
                        <button className="icon-btn" title="Edit" onClick={() => setEditingProduct(p)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 15.5V20Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
                        </button>
                        <button className="btn-ghost small" onClick={() => toggleActive(p)}>
                          {p.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ProductFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadProducts() }}
        />
      )}

      {editingProduct && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => { setEditingProduct(null); loadProducts() }}
        />
      )}
    </div>
  )
}
