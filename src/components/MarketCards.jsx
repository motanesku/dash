import { useState, useEffect, useRef } from 'react'

const WORKER_URL = 'https://worker.danut-fagadau.workers.dev'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'stocks',   label: 'Stocks'   },
  { id: 'futures',  label: 'Futures'  },
  { id: 'crypto',   label: 'Crypto'   },
  { id: 'forex',    label: 'Forex'    },
]

const SYMBOLS = {
  overview: [
    { sym: '^GSPC',    label: 'S&P 500',       decimals: 2 },
    { sym: '^IXIC',    label: 'Nasdaq',         decimals: 2 },
    { sym: '^DJI',     label: 'Dow 30',         decimals: 2 },
    { sym: 'DX-Y.NYB', label: 'USD Index',      decimals: 3 },
  ],
  stocks: [
    { sym: 'AAPL',  label: 'Apple'     },
    { sym: 'NVDA',  label: 'NVIDIA'    },
    { sym: 'MSFT',  label: 'Microsoft' },
    { sym: 'AMZN',  label: 'Amazon'    },
    { sym: 'GOOGL', label: 'Alphabet'  },
    { sym: 'META',  label: 'Meta'      },
    { sym: 'TSLA',  label: 'Tesla'     },
  ],
  futures: [
    { sym: 'GC=F', label: 'Gold',          decimals: 2 },
    { sym: 'SI=F', label: 'Silver',        decimals: 3 },
    { sym: 'CL=F', label: 'Crude Oil',     decimals: 2 },
    { sym: 'NG=F', label: 'Natural Gas',   decimals: 3 },
    { sym: 'HG=F', label: 'Copper',        decimals: 3 },
    { sym: 'PL=F', label: 'Platinum',      decimals: 2 },
  ],
  crypto: [
    { sym: 'BTC-USD', label: 'Bitcoin',  decimals: 0 },
    { sym: 'ETH-USD', label: 'Ethereum', decimals: 2 },
  ],
  forex: [
    { sym: 'EURUSD=X', label: 'EUR/USD', decimals: 4 },
    { sym: 'USDJPY=X', label: 'USD/JPY', decimals: 3 },
    { sym: 'EURRON=X', label: 'EUR/RON', decimals: 4 },
    { sym: 'RON=X',    label: 'USD/RON', decimals: 4 },
  ],
}

// Cache simplu în memorie
const histCache = {}

async function fetchHistory(sym) {
  if (histCache[sym]) return histCache[sym]
  try {
    const r = await fetch(`${WORKER_URL}/api/history?symbol=${encodeURIComponent(sym)}&range=5d&interval=15m`)
    const d = await r.json()
    if (d.ok && d.points?.length) {
      histCache[sym] = d.points
      return d.points
    }
  } catch {}
  return []
}

// Sparkline SVG pur
function Sparkline({ points, positive, width = 200, height = 50 }) {
  if (!points?.length) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', height: 1, background: 'var(--border)' }}/>
    </div>
  )

  const vals = points.map(p => p.close)
  const min  = Math.min(...vals)
  const max  = Math.max(...vals)
  const range = max - min || 1

  const W = width, H = height
  const pad = 4

  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - pad * 2)
    const y = H - pad - ((v - min) / range) * (H - pad * 2)
    return `${x},${y}`
  })

  const color  = positive ? '#26a69a' : '#ef5350'
  const lastX  = parseFloat(pts[pts.length - 1].split(',')[0])
  const lastY  = parseFloat(pts[pts.length - 1].split(',')[1])
  const fillId = `fill-${positive ? 'g' : 'r'}-${Math.random().toString(36).slice(2,6)}`

  // Area path: line + chiudere în jos
  const linePath = `M ${pts.join(' L ')}`
  const areaPath = `${linePath} L ${W - pad},${H} L ${pad},${H} Z`

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaPath} fill={`url(#${fillId})`}/>
      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
      {/* Dot final */}
      <circle cx={lastX} cy={lastY} r="3" fill={color}/>
      <circle cx={lastX} cy={lastY} r="5" fill={color} opacity="0.25"/>
    </svg>
  )
}

function fmt(v, decimals = 2) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v)
}

async function fetchQuote(sym) {
  try {
    const r = await fetch(`${WORKER_URL}/api/prices?symbols=${encodeURIComponent(sym)}`)
    const d = await r.json()
    return d?.[sym] || null
  } catch { return null }
}

function Card({ sym, label, decimals = 2, prices }) {
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [quote, setQuote] = useState(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    setLoading(true)
    setQuote(null)
    Promise.all([
      fetchHistory(sym),
      fetchQuote(sym),
    ]).then(([pts, q]) => {
      if (mounted.current) {
        setPoints(pts)
        setQuote(q)
        setLoading(false)
      }
    })
    return () => { mounted.current = false }
  }, [sym])

  // Preferă quote direct, fallback la prices din store
  const pd       = quote || prices?.[sym]
  const price    = pd?.price
  const change   = pd?.change
  const changePct= pd?.changePct
  // Culoare bazată pe sparkline (primul vs ultimul punct) sau pe changePct
  const sparkPositive = points.length >= 2
    ? points[points.length - 1].close >= points[0].close
    : (changePct ?? 0) >= 0
  const positive = sparkPositive

  const color  = positive ? '#26a69a' : '#ef5350'
  const pctStr = changePct != null
    ? `${positive ? '+' : ''}${changePct.toFixed(2)}%`
    : '—'

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      minWidth: 160,
      width: 160,
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px 4px' }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'clamp(16px,4vw,20px)', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>
          {fmt(price, decimals)}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 2 }}>
          {pctStr}
          {change != null && (
            <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 6, fontWeight: 400 }}>
              {positive ? '+' : ''}{fmt(change, decimals)}
            </span>
          )}
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ height: 56, marginTop: 4 }}>
        {loading
          ? <div style={{ height: '100%', background: 'var(--border)', opacity: 0.3, animation: 'pulse 1.5s infinite' }}/>
          : <Sparkline points={points} positive={positive}/>
        }
      </div>
    </div>
  )
}

export default function MarketCards({ prices }) {
  const [tab, setTab] = useState('overview')

  const syms = SYMBOLS[tab] || []

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 10,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        borderBottom: '1px solid var(--border)',
        paddingBottom: 8,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, flexShrink: 0, transition: 'all .15s',
            background: tab === t.id ? 'var(--blue)' : 'transparent',
            color: tab === t.id ? '#fff' : 'var(--text3)',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Scroll orizontal — carduri fixe */}
      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        paddingBottom: 4,
      }}>
        {syms.map(({ sym, label, decimals }) => (
          <Card key={sym} sym={sym} label={label} decimals={decimals} prices={prices}/>
        ))}
      </div>
    </div>
  )
}

