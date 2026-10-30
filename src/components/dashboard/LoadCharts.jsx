import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import { CalendarClock, AlarmClock } from 'lucide-react'
import { Panel, Empty } from './shared'

const axis = { fontSize: 11, fill: '#64748B' }

export function FollowupLoad({ data, delay }) {
  const has = data.some((d) => d.count > 0)
  return (
    <Panel title="Follow-up Workload" subtitle="Late + next 14 days (day of month)" delay={delay}>
      {!has ? <Empty icon={CalendarClock} text="No follow-ups scheduled." /> : (
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={data} margin={{ left: -18, right: 6, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} interval={0} />
            <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: '#F1F5F9' }} />
            <Bar dataKey="count" name="Follow-ups" radius={[7, 7, 0, 0]} animationDuration={900}>
              {data.map((d, i) => <Cell key={i} fill={d.overdue ? '#F43F5E' : d.today ? '#059669' : '#10B981'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Panel>
  )
}

export function OverdueAging({ data, delay }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  const colors = ['#FBBF24', '#FB923C', '#F43F5E', '#BE123C']
  return (
    <Panel title="Overdue Aging" subtitle={`${total} overdue follow-ups by age`} delay={delay}>
      {total === 0 ? <Empty icon={AlarmClock} text="Nothing overdue. Great job!" /> : (
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={data} margin={{ left: -18, right: 6, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: '#F1F5F9' }} />
            <Bar dataKey="count" name="Overdue" radius={[7, 7, 0, 0]} animationDuration={900}>
              {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Panel>
  )
}
