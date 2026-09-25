import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './SearchableSelect.css'

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  emptyLabel = '-- None --',
  disabled = false
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const wrapRef = useRef(null)
  const dropdownRef = useRef(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    setQuery(selected ? selected.label : '')
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateRect = useCallback(() => {
    if (wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect()
      setRect({ top: r.bottom + 4, left: r.left, width: r.width })
    }
  }, [])

  useEffect(() => {
    if (!open) return
    updateRect()
    // capture:true so this fires even when a nested container (e.g. a table wrapper) scrolls
    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)
    return () => {
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
    }
  }, [open, updateRect])

  useEffect(() => {
    function onClickOutside(e) {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false)
        setQuery(selected ? selected.label : '')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [selected])

  const filtered = options.filter((o) => {
    const q = query.toLowerCase()
    return (
      o.label.toLowerCase().includes(q) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(q))
    )
  })

  function handleSelect(opt) {
    onChange(opt ? opt.value : '')
    setQuery(opt ? opt.label : '')
    setOpen(false)
  }

  function handleOpen() {
    updateRect()
    setOpen(true)
  }

  return (
    <div className="searchable-select" ref={wrapRef}>
      <input
        type="text"
        className="text-input"
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={handleOpen}
        onChange={(e) => {
          setQuery(e.target.value)
          if (!open) handleOpen()
        }}
      />
      {value && !disabled && (
        <button
          type="button"
          className="searchable-select-clear"
          onMouseDown={(e) => { e.preventDefault(); handleSelect(null) }}
          aria-label="Clear selection"
        >
          ✕
        </button>
      )}

      {open && !disabled && rect && createPortal(
        <div
          ref={dropdownRef}
          className="searchable-select-dropdown"
          style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
        >
          <button
            type="button"
            className="searchable-select-option muted"
            onMouseDown={(e) => { e.preventDefault(); handleSelect(null) }}
          >
            {emptyLabel}
          </button>
          {filtered.length === 0 ? (
            <div className="searchable-select-empty">No matches</div>
          ) : (
            filtered.map((opt) => (
              <button
                type="button"
                key={opt.value}
                className={'searchable-select-option' + (opt.value === value ? ' active' : '')}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt) }}
              >
                <span>{opt.label}</span>
                {opt.sublabel && <span className="searchable-select-sublabel">{opt.sublabel}</span>}
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
