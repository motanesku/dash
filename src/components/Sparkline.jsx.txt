import { useEffect, useState } from 'react'
import { fetchHistory } from '../lib/prices.js'

// Cache in-memory pentru sesiune — evita re-fetch la fiecare render
const _cache = {}

export function useSparkline(symbol, days = 30) {
  const [points, setPoints] = useState(_cache[symbol] || null)

  useEffect(() => {
    if (_cache[symbol]) { setPoints(_cache[symbol]); return }
    let cancelled = false
    fetchHistory(symbol, days <= 7 ? '5d' : days <= 14 ? '1mo' : '1mo')
      .then(data => {
        if (cancelled || !data?.length) return
        // Ia ultimele `days` zile
        const sliced = data.slice(-days).map(p => p.close).filter(v => v != null)
        _cache[symbol] = sliced
        setPoints(sliced)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [symbol])

  return points
}

export default function Sparkline({ symbol, width = 80, height = 32, days = 30 }) {
  const points = useSparkline(symbol, days)

  if (!points || points.length < 2) {
    return <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: width * 0.6, height: 1, background: 'var(--border)' }} />
    </div>
  }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  const isUp = points[points.length - 1] >= points[0]
  const color = isUp ? '#34d399' : '#ff5572'
  const gradId = `sg-${symbol.replace(/[^a-z0-9]/gi, '')}`

  // Calculeaza coordonate SVG
  const w = width
  const h = height
  const pad = 2
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (w - pad * 2))
  const ys = points.map(v => h - pad - ((v - min) / range) * (h - pad * 2))

  // Path linie
  const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')

  // Path gradient (area sub linie)
  const areaPath = linePath +
    ` L${xs[xs.length - 1].toFixed(1)},${h} L${xs[0].toFixed(1)},${h} Z`

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Gradient area */}
      <path d={areaPath} fill={`url(#${gradId})`} />
      {/* Linie */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Punct final */}
      <circle
        cx={xs[xs.length - 1].toFixed(1)}
        cy={ys[ys.length - 1].toFixed(1)}
        r="2"
        fill={color}
      />
    </svg>
  )
}
