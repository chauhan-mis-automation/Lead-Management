import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Panel, Empty, AnimatedStat } from './shared'

// data: [{ name, value, color }]
export default function DonutCard({ title, subtitle, data, total, centerLabel = 'Total', delay }) {
  return (
    <Panel title={title} subtitle={subtitle} delay={delay}>
      {data.length === 0 ? (
        <Empty icon={BarChart3} text="No data yet." />
      ) : (
        <div className="dx-donut">
          <div className="dx-donut-chart">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="98%" paddingAngle={3}
                  cornerRadius={7} stroke="none" startAngle={90} endAngle={-270} animationDuration={1000} animationEasing="ease-out">
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="dx-donut-center"><b><AnimatedStat value={total} /></b><span>{centerLabel}</span></div>
          </div>
          <ul className="dx-legend">
            {data.slice(0, 7).map((d) => (
              <li key={d.name}>
                <span className="dx-legend-name"><i style={{ background: d.color }} />{d.name}</span>
                <span className="dx-legend-val">{d.value} <small>{total ? Math.round((d.value / total) * 100) : 0}%</small></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}
