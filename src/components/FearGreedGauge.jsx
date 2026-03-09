import { useState } from 'react'

const ZONES = [
  { min:0,  max:25,  label:'Extreme Fear', color:'#ff2d55' },
  { min:25, max:45,  label:'Fear',         color:'#ff6b35' },
  { min:45, max:55,  label:'Neutral',      color:'#f0b429' },
  { min:55, max:75,  label:'Greed',        color:'#34d399' },
  { min:75, max:100, label:'Extreme Greed',color:'#00d4aa' },
]

function getColor(v) {
  if (v == null) return '#6b7280'
  return ZONES.find(z => v >= z.min && v <= z.max)?.color || '#6b7280'
}

function getLabel(v) {
  if (v == null) return '—'
  return ZONES.find(z => v >= z.min && v <= z.max)?.label || '—'
}

function Gauge({ value, size = 180 }) {
  const r  = size * 0.38
  const cx = size / 2
  const cy = size * 0.58
  const color = getColor(value)

  const toRad = d => ((d - 180) * Math.PI) / 180
  const arc = (startDeg, endDeg, radius) => {
    const x1 = cx + radius * Math.cos(toRad(startDeg))
    const y1 = cy + radius * Math.sin(toRad(startDeg))
    const x2 = cx + radius * Math.cos(toRad(endDeg))
    const y2 = cy + radius * Math.sin(toRad(endDeg))
    const large = endDeg - startDeg > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`
  }

  const trackW = size * 0.1
  const needleAngle = value != null ? -90 + (value / 100) * 180 : -90
  const needleRad = (needleAngle * Math.PI) / 180
  const nx = cx + r * 0.85 * Math.cos(needleRad)
  const ny = cy + r * 0.85 * Math.sin(needleRad)

  return (
    <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
      {ZONES.map((z, i) => (
        <path key={i} d={arc((z.min/100)*180, (z.max/100)*180, r)}
          fill="none" stroke={z.color} strokeWidth={trackW} opacity={0.2} strokeLinecap="butt"/>
      ))}
      {value != null && (
        <path d={arc(0, (value/100)*180, r)}
          fill="none" stroke={color} strokeWidth={trackW} opacity={0.9} strokeLinecap="round"/>
      )}
      {value != null && <>
        <line x1={cx} y1={cy} x2={nx} y2={ny}
          stroke={color} strokeWidth={2.5} strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={size*0.04} fill={color}/>
      </>}
      <text x={cx} y={cy - r*0.15} textAnchor="middle"
        fill={color} fontSize={size*0.2} fontWeight="700" fontFamily="monospace">
        {value ?? '—'}
      </text>
    </svg>
  )
}

// SVG sparkline — no external deps
function Sparkline({ data, color, width=320, height=60 }) {
  if (!data?.length) return null
  const vals = data.map(d => d.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((d.value - min) / range) * (height - 8) - 4
    return `${x},${y}`
  }).join(' ')

  // Tooltip state
  const [tip, setTip] = useState(null)

  return (
    <div style={{ position:'relative' }}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow:'visible' }}
        onMouseLeave={() => setTip(null)}>
        {/* Reference lines at 25 and 75 */}
        {[25, 75].map(ref => {
          const y = height - ((ref - min) / range) * (height - 8) - 4
          if (y < 0 || y > height) return null
          return <line key={ref} x1={0} y1={y} x2={width} y2={y}
            stroke={getColor(ref)} strokeDasharray="3 3" strokeOpacity={0.3} strokeWidth={1}/>
        })}
        {/* Line */}
        <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round"/>
        {/* Hover dots */}
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * width
          const y = height - ((d.value - min) / range) * (height - 8) - 4
          return (
            <circle key={i} cx={x} cy={y} r={4} fill={color} opacity={0}
              style={{ cursor:'pointer' }}
              onMouseEnter={() => setTip({ x, y, ...d })}/>
          )
        })}
        {/* Tooltip */}
        {tip && <>
          <circle cx={tip.x} cy={tip.y} r={4} fill={getColor(tip.value)}/>
          <rect x={Math.min(tip.x+6, width-90)} y={tip.y-24} width={85} height={20}
            fill="var(--surface2)" rx={4} stroke="var(--border)"/>
          <text x={Math.min(tip.x+13, width-83)} y={tip.y-10} fontSize={9}
            fill={getColor(tip.value)} fontFamily="monospace" fontWeight="700">
            {tip.date} · {tip.value}
          </text>
        </>}
      </svg>
    </div>
  )
}

function PrevDot({ label, value }) {
  if (value == null) return null
  const color = getColor(value)
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:9, color:'var(--text3)', marginBottom:2 }}>{label}</div>
      <div style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:700, color }}>{value}</div>
      <div style={{ fontSize:8, color, marginTop:1 }}>{getLabel(value)}</div>
    </div>
  )
}

export default function FearGreedGauge({ fearGreed }) {
  const [tab, setTab] = useState('stock')

  const crypto    = fearGreed?.crypto || {}
  const stock     = fearGreed?.stock  || {}
  const cryptoVal = crypto.value ?? fearGreed?.value ?? null
  const stockVal  = stock.value ?? null
  const activeVal = tab === 'stock' ? stockVal : cryptoVal
  const color     = getColor(activeVal)

  return (
    <div style={{ padding:'12px 16px' }}>
      {/* Tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:12, justifyContent:'center' }}>
        {[
          { id:'stock',  label:'📈 Acțiuni (CNN)' },
          { id:'crypto', label:'₿ Crypto' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'4px 14px', borderRadius:6, border:'none', cursor:'pointer',
            fontSize:11, fontWeight:600, transition:'all .15s',
            background: tab===t.id ? color : 'var(--surface2)',
            color: tab===t.id ? '#fff' : 'var(--text3)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Gauge */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
        <Gauge value={activeVal} size={180}/>
        <div style={{ fontWeight:700, fontSize:15, color, marginTop:-4 }}>
          {getLabel(activeVal)}
        </div>
        {activeVal == null && (
          <div style={{ fontSize:11, color:'var(--text3)' }}>Date indisponibile</div>
        )}
      </div>

      {/* CNN prev values */}
      {tab === 'stock' && stock.value != null && (
        <div style={{ display:'flex', justifyContent:'space-around', marginTop:14,
          padding:'10px 0', borderTop:'1px solid var(--border)' }}>
          <PrevDot label="Ieri"    value={stock.prev_close}/>
          <PrevDot label="1 săpt." value={stock.prev_week}/>
          <PrevDot label="1 lună"  value={stock.prev_month}/>
          <PrevDot label="1 an"    value={stock.prev_year}/>
        </div>
      )}

      {/* Crypto timeline */}
      {tab === 'crypto' && crypto.history?.length > 0 && (
        <div style={{ marginTop:12, borderTop:'1px solid var(--border)', paddingTop:8 }}>
          <div style={{ fontSize:10, color:'var(--text3)', marginBottom:6, textAlign:'center' }}>
            ISTORIC 30 ZILE
          </div>
          <Sparkline data={crypto.history} color={color}/>
        </div>
      )}

      {/* Zone legend */}
      <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:12, flexWrap:'wrap' }}>
        {ZONES.map(z => (
          <span key={z.label} style={{ fontSize:9, color:z.color, fontWeight:600 }}>
            {z.min}–{z.max} {z.label}
          </span>
        ))}
      </div>
    </div>
  )
}
