import { useEffect, useRef, useState } from 'react'

export const MINT = {
  emerald: '#10B981', emeraldDark: '#059669', amber: '#F59E0B', rose: '#F43F5E',
  indigo: '#6366F1', sky: '#0EA5E9', teal: '#14B8A6', slate: '#64748B'
}

// Soft pastel colour per lead status (badge text colour; background is a tint of it)
const STATUS_TONE = {
  new_lead: MINT.sky, contacted: MINT.teal, followup_required: MINT.amber, warm_lead: '#FB923C',
  hot_lead: MINT.rose, proposal_sent: MINT.indigo, negotiation: MINT.indigo,
  won_order: MINT.emeraldDark, lost_order: MINT.slate, not_interested: MINT.slate
}
export const statusTone = (status) => STATUS_TONE[status] || MINT.slate

export const SOURCE_COLORS = ['#10B981', '#6366F1', '#F59E0B', '#0EA5E9', '#F43F5E', '#14B8A6', '#8B5CF6', '#64748B']

export function dateKey(d) { return d.toISOString().slice(0, 10) }

export function localDateKey(value) {
  const d = value instanceof Date ? value : new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

// Eased count-up so numbers feel alive on load
export function useCountUp(target, duration = 900) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (typeof target !== 'number' || Number.isNaN(target)) return
    let raf
    const startTime = performance.now()
    function tick(now) {
      const p = Math.min((now - startTime) / duration, 1)
      setDisplay(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return display
}

export function AnimatedStat({ value, format }) {
  const isNumber = typeof value === 'number'
  const animated = useCountUp(isNumber ? value : 0)
  if (!isNumber) return <>{value}</>
  return <>{format ? format(animated) : animated.toLocaleString('en-IN')}</>
}

export function Badge({ color = MINT.slate, children, dot = false }) {
  return (
    <span className="dx-badge" style={{ '--c': color }}>
      {dot && <i className="dx-badge-dot" />}
      {children}
    </span>
  )
}

export function Panel({ title, subtitle, action, children, className = '' }) {
  const [ref, seen] = useInView()
  return (
    <section ref={ref} className={'dx-panel dx-reveal ' + (seen ? 'dx-in ' : '') + className}>
      {(title || action) && (
        <header className="dx-panel-head">
          <div>
            <h3 className="dx-panel-title">{title}</h3>
            {subtitle && <p className="dx-panel-sub">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {/* remounted once when first visible so charts, rings and counters animate on scroll */}
      <div key={seen ? 'seen' : 'idle'} className="dx-panel-body">{children}</div>
    </section>
  )
}

export function Empty({ icon: Icon, text }) {
  return (
    <div className="dx-empty">
      <span className="dx-empty-icon">{Icon && <Icon size={20} />}</span>
      <span>{text}</span>
    </div>
  )
}

// Animated progress ring (draws itself on load)
export function Ring({ pct = 0, size = 92, stroke = 9, color = MINT.emerald, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, pct))
  return (
    <div className="dx-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2F6" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - clamped)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ '--len': c }} className="dx-ring-arc"
        />
      </svg>
      <div className="dx-ring-center">{children}</div>
    </div>
  )
}

// Tiny self-drawing sparkline
export function Sparkline({ data, color = MINT.emerald, width = 96, height = 34 }) {
  const max = Math.max(...data, 1)
  const step = width / Math.max(data.length - 1, 1)
  const pts = data.map((v, i) => [i * step, height - 4 - (v / max) * (height - 8)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${width} ${height} L0 ${height} Z`
  const id = 'sp' + color.replace('#', '') + data.length
  return (
    <svg className="dx-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".35" /><stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} className="dx-spark-area" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="dx-spark-line" />
    </svg>
  )
}

// Fires once when the element scrolls into view (drives scroll-triggered animations)
export function useInView(threshold = 0.12) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect() }
    }, { threshold, rootMargin: '0px 0px -6% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [seen, threshold])
  return [ref, seen]
}
