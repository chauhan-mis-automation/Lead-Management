export default function ComingSoon({ title }) {
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, margin: '0 0 8px' }}>{title}</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
        This module will be built in the next phase.
      </p>
    </div>
  )
}
