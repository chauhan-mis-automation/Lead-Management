import { UserPlus, Sparkles } from 'lucide-react'
import { AnimatedStat } from './shared'

export default function Hero({ greeting, name, note, canCreate, onAdd, chips }) {
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <section className="dx-hero dx-rise" style={{ '--i': 0 }}>
      <i className="dx-orb o1" /><i className="dx-orb o2" /><i className="dx-orb o3" />
      <div className="dx-hero-main">
        <span className="dx-hero-date"><Sparkles size={13} /> {dateStr}</span>
        <h1>{greeting}{name ? `, ${name}` : ''} 👋</h1>
        <p>{note}</p>
        {canCreate && (
          <button className="dx-hero-btn" onClick={onAdd}><UserPlus size={16} /> Add Lead</button>
        )}
      </div>
      <div className="dx-hero-chips">
        {chips.map((c) => (
          <div className="dx-hero-chip" key={c.label}>
            <b><AnimatedStat value={c.value} format={c.format} /></b>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
