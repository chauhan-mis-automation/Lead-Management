import { Filter } from 'lucide-react'
import { Panel, Empty } from './shared'

// stages: [{ key,label,color,reached,current }]  (reached = leads that got to this stage or beyond)
export default function FunnelPyramid({ stages, lost, delay }) {
  const max = Math.max(...stages.map((s) => s.reached), 0)
  const W = 300, H = 270, gap = 5
  const rowH = (H - gap * (stages.length - 1)) / stages.length
  const frac = (n) => 0.2 + 0.8 * (max ? n / max : 0)
  return (
    <Panel title="Sales Funnel" subtitle="Leads that reached each stage (cumulative)" delay={delay}>
      {max === 0 ? (
        <Empty icon={Filter} text="No leads in the pipeline yet." />
      ) : (
        <div className="dx-pyr">
          <svg viewBox={`0 0 ${W} ${H}`} className="dx-pyr-svg" role="img" aria-label="Sales funnel">
            <defs>
              {stages.map((s) => (
                <linearGradient key={s.key} id={`fg-${s.key}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={s.color} stopOpacity=".78" /><stop offset="50%" stopColor={s.color} /><stop offset="100%" stopColor={s.color} stopOpacity=".78" />
                </linearGradient>
              ))}
            </defs>
            {stages.map((s, i) => {
              const top = frac(s.reached) * W
              const next = stages[i + 1] ? frac(stages[i + 1].reached) * W : top * 0.78
              const y = i * (rowH + gap)
              const x1 = (W - top) / 2, x2 = (W + top) / 2, x3 = (W + next) / 2, x4 = (W - next) / 2
              return (
                <g key={s.key} className="dx-pyr-seg" style={{ '--d': i * 0.12 + 's' }}>
                  <polygon points={`${x1},${y} ${x2},${y} ${x3},${y + rowH} ${x4},${y + rowH}`} fill={`url(#fg-${s.key})`} />
                  <text x={W / 2} y={y + rowH / 2 + 5} textAnchor="middle" className="dx-pyr-num">{s.reached}</text>
                </g>
              )
            })}
          </svg>
          <ul className="dx-pyr-list">
            {stages.map((s, i) => {
              const prev = i > 0 ? stages[i - 1].reached : null
              const conv = prev ? Math.round((s.reached / prev) * 100) : 100
              return (
                <li key={s.key} style={{ '--c': s.color, '--i': i }}>
                  <span className="dx-pyr-dot" />
                  <div className="dx-pyr-name">{s.label}<small>{s.current} currently here</small></div>
                  <div className="dx-pyr-conv">
                    <b>{conv}%</b><small>{i === 0 ? 'of active' : 'from prev'}</small>
                  </div>
                </li>
              )
            })}
            <li className="dx-pyr-lost"><span className="dx-pyr-dot" style={{ background: '#94A3B8' }} /><div className="dx-pyr-name">Lost / Not interested<small>excluded from funnel</small></div><div className="dx-pyr-conv"><b>{lost}</b></div></li>
          </ul>
        </div>
      )}
    </Panel>
  )
}
