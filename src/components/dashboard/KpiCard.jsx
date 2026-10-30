import { AnimatedStat, Ring, Sparkline, useInView } from './shared'

// visual: { type: 'spark', data } | { type: 'ring', pct }
export default function KpiCard({ label, value, format, icon: Icon, tone, pill, visual, delay, onClick }) {
  const [ref, seen] = useInView(0.2)
  return (
    <button ref={ref} className={'dx-kpi dx-reveal' + (seen ? ' dx-in' : '')} style={{ '--i': delay, '--tone': tone }} onClick={onClick}>
      <div key={seen ? 's' : 'i'} className="dx-kpi-inner">
      <div className="dx-kpi-top">
        <span className="dx-kpi-icon"><Icon size={18} strokeWidth={2.2} /></span>
        {pill && <span className="dx-kpi-pill">{pill}</span>}
      </div>
      <div className="dx-kpi-bottom">
        <div>
          <div className="dx-kpi-value"><AnimatedStat value={value} format={format} /></div>
          <div className="dx-kpi-label">{label}</div>
        </div>
        {visual?.type === 'spark' && <Sparkline data={visual.data} color={tone} />}
        {visual?.type === 'ring' && (
          <Ring pct={visual.pct} size={52} stroke={6} color={tone}><b className="dx-ring-mini">{Math.round(visual.pct * 100)}%</b></Ring>
        )}
      </div>
      </div>
      <span className="dx-kpi-glow" />
    </button>
  )
}
