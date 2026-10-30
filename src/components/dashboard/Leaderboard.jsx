import { Trophy } from 'lucide-react'
import { Panel, Empty } from './shared'

// rows: [{ id, name, total, won }]
export default function Leaderboard({ rows, delay }) {
  const max = Math.max(...rows.map((r) => r.total), 1)
  return (
    <Panel title="Team Leaderboard" subtitle="Leads handled & won per person" delay={delay}>
      {rows.length === 0 ? <Empty icon={Trophy} text="No assigned leads yet." /> : (
        <ul className="dx-board-list">
          {rows.slice(0, 6).map((r, i) => (
            <li key={r.id}>
              <span className={'dx-rank r' + (i + 1)}>{i + 1}</span>
              <div className="dx-board-main">
                <div className="dx-board-top"><b>{r.name}</b><span>{r.total} leads · <em>{r.won} won</em></span></div>
                <div className="dx-source-track"><div style={{ '--w': (r.total / max) * 100 + '%', '--c': i === 0 ? '#10B981' : '#6EE7B7', '--d': i * 0.08 + 's' }} /></div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
