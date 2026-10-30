import { Target } from 'lucide-react'
import { Panel, Empty } from './shared'

// rows: [{ name, color, leads, won }]
export default function SourcePerformance({ rows }) {
  const max = Math.max(...rows.map((r) => r.leads), 1)
  return (
    <Panel title="Source Performance" subtitle="Which channel brings leads that actually convert">
      {rows.length === 0 ? <Empty icon={Target} text="No source data yet." /> : (
        <ul className="dx-perf">
          {rows.slice(0, 7).map((r, i) => {
            const rate = r.leads ? Math.round((r.won / r.leads) * 100) : 0
            return (
              <li key={r.name}>
                <div className="dx-perf-top">
                  <span className="dx-source-name"><i style={{ background: r.color }} />{r.name}</span>
                  <span className="dx-perf-stats">{r.leads} leads <em className={r.won ? 'win' : ''}>{r.won} won · {rate}%</em></span>
                </div>
                <div className="dx-source-track"><div style={{ '--w': (r.leads / max) * 100 + '%', '--c': r.color, '--d': i * 0.07 + 's' }} /></div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
