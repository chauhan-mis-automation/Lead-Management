import { useNavigate } from 'react-router-dom'
import { statusMeta, orderStatusMeta } from '../lib/constants'
import '../components/LeadFormModal.css'
import './StatDetailModal.css'

export default function StatDetailModal({ title, kind, items, onClose }) {
  const navigate = useNavigate()

  function goTo(item) {
    onClose()
    if (kind === 'orders') {
      navigate('/orders')
    } else {
      navigate(`/leads/${item.id}`)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card stat-detail-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {items.length === 0 ? (
          <p className="stat-detail-empty">Nothing here yet.</p>
        ) : (
          <div className="stat-detail-list">
            {items.map((item) => {
              if (kind === 'orders') {
                const meta = orderStatusMeta(item.status)
                return (
                  <button key={item.id} className="stat-detail-row" onClick={() => goTo(item)}>
                    <div>
                      <div className="stat-detail-name">{item.order_number}</div>
                      <div className="stat-detail-sub">{item.company || item.lead?.lead_name || '—'}</div>
                    </div>
                    <div className="stat-detail-right">
                      <span className="stat-detail-value">{item.order_value ? `₹${Number(item.order_value).toLocaleString('en-IN')}` : '—'}</span>
                      <span className="status-badge" style={{ '--badge-color': meta.color }}>{meta.label}</span>
                    </div>
                  </button>
                )
              }

              const meta = statusMeta(item.status)
              return (
                <button key={item.id} className="stat-detail-row" onClick={() => goTo(item)}>
                  <div>
                    <div className="stat-detail-name">{item.lead_name}</div>
                    <div className="stat-detail-sub">{item.company || '—'}</div>
                  </div>
                  <div className="stat-detail-right">
                    {item.next_followup_date && (
                      <span className="stat-detail-date">
                        {new Date(item.next_followup_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                    <span className="status-badge" style={{ '--badge-color': meta.color }}>{meta.label}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
