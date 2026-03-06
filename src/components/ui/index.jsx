import React from 'react'

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, style, className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────
export function StatCard({ label, value, sub, accent, style }) {
  const accents = {
    green: { border: '1px solid rgba(16,185,129,.3)', background: 'rgba(16,185,129,.05)' },
    red: { border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.05)' },
    blue: { border: '1px solid rgba(59,130,246,.3)', background: 'rgba(59,130,246,.05)' },
    purple: { border: '1px solid rgba(168,85,247,.3)', background: 'rgba(168,85,247,.05)' },
  }
  return (
    <Card style={{ padding: '16px 20px', ...(accents[accent] || {}), ...style }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.5px', marginBottom: 2 }}>
        {value}
      </div>
      {sub && (
        <div className="mono" style={{ fontSize: 12, color: 'var(--text3)' }}>
          {sub}
        </div>
      )}
    </Card>
  )
}

// ── Badge ─────────────────────────────────────────────────────
export function Badge({ children, color = 'var(--text3)', bg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 7px', borderRadius: 5, fontSize: 11, fontWeight: 600,
      fontFamily: 'JetBrains Mono, monospace',
      color, background: bg || 'rgba(255,255,255,.06)',
    }}>
      {children}
    </span>
  )
}

// ── Button ────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'ghost', size = 'md', style, disabled }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    borderRadius: 8, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none', fontFamily: 'Inter, sans-serif', transition: 'all .15s',
    opacity: disabled ? .5 : 1,
  }
  const sizes = { sm: { padding: '5px 10px', fontSize: 12 }, md: { padding: '7px 14px', fontSize: 13 }, lg: { padding: '10px 20px', fontSize: 14 } }
  const variants = {
    ghost: { background: 'rgba(255,255,255,.07)', color: 'var(--text2)', border: '1px solid var(--border)' },
    dark: { background: 'var(--text)', color: '#000', border: '1px solid transparent' },
    danger: { background: 'rgba(239,68,68,.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,.3)' },
    primary: { background: 'var(--blue)', color: '#fff', border: '1px solid transparent' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

// ── Input ─────────────────────────────────────────────────────
export function Input({ value, onChange, placeholder, type = 'text', style, onKeyDown, autoFocus }) {
  return (
    <input
      type={type} value={value} onChange={onChange}
      placeholder={placeholder} onKeyDown={onKeyDown} autoFocus={autoFocus}
      style={{
        width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
        background: 'var(--surface2)', border: '1px solid var(--border)',
        color: 'var(--text)', outline: 'none', fontFamily: 'Inter, sans-serif',
        transition: 'border-color .15s',
        ...style,
      }}
    />
  )
}

// ── Select ────────────────────────────────────────────────────
export function Select({ value, onChange, children, style }) {
  return (
    <select
      value={value} onChange={onChange}
      style={{
        width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
        background: 'var(--surface2)', border: '1px solid var(--border)',
        color: 'var(--text)', outline: 'none', fontFamily: 'Inter, sans-serif',
        ...style,
      }}
    >
      {children}
    </select>
  )
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, maxWidth = 440 }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)',
      }}
    >
      <Card
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>{title}</div>
        {children}
      </Card>
    </div>
  )
}

// ── Ticker badge ──────────────────────────────────────────────
export function TickerBadge({ symbol, price, change, loading, currency = 'USD' }) {
  const up = change >= 0
  return (
    <div style={{
      padding: '8px 14px', borderRadius: 10, minWidth: 110,
      background: 'var(--surface)', border: '1px solid var(--border)',
      flexShrink: 0, cursor: 'default',
    }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 4 }}>
        {symbol}
      </div>
      {loading ? (
        <div style={{ height: 16, width: 60, background: 'var(--surface2)', borderRadius: 4 }} />
      ) : price ? (
        <>
          <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {price >= 1000 ? price.toLocaleString('ro-RO', { maximumFractionDigits: 0 }) : price.toFixed(2)}
          </div>
          {change != null && (
            <div className="mono" style={{ fontSize: 10, marginTop: 1, color: up ? 'var(--green)' : 'var(--red)' }}>
              {up ? '+' : ''}{change.toFixed(2)}%
            </div>
          )}
        </>
      ) : (
        <div className="mono" style={{ fontSize: 13, color: 'var(--text3)' }}>—</div>
      )}
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 16 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid var(--border)`, borderTopColor: 'var(--text)',
      animation: 'spin .7s linear infinite',
    }} />
  )
}

// ── Section header ────────────────────────────────────────────
export function SectionHdr({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.8px' }}>
        {children}
      </div>
      {action}
    </div>
  )
}
