import { Panel, Ring, MINT } from './shared'

export default function HealthPanel({ items, delay }) {
  return (
    <Panel title="Pipeline Health" subtitle="Quick pulse of your sales process" delay={delay}>
      <div className="dx-health">
        {items.map((h) => (
          <div className="dx-health-item" key={h.label}>
            <Ring pct={h.pct} size={84} stroke={9} color={h.color || MINT.emerald}>
              <b className="dx-ring-val">{Math.round(h.pct * 100)}<small>%</small></b>
            </Ring>
            <span className="dx-health-label">{h.label}</span>
            <small className="dx-health-sub">{h.sub}</small>
          </div>
        ))}
      </div>
    </Panel>
  )
}
