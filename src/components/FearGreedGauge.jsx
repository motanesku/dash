import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const ZONES = [
  { min:0,  max:25,  label:'Extreme Fear', color:'#ff2d55' },
  { min:25, max:45,  label:'Fear',         color:'#ff6b35' },
  { min:45, max:55,  label:'Neutral',      color:'#f0b429' },
  { min:55, max:75,  label:'Greed',        color:'#34d399' },
  { min:75, max:100, label:'Extreme Greed',color:'#00d4aa' },
]

function getColor(v) {
  if (v == null) return '#6b7280'
  const z = ZONES.find(z => v >= z.min && v <= z.max)
  return z?.color || '#6b7280'
}

function getLabel(v) {
  if (v == null) return '—'
  const z = ZONES.find(z => v >= z.min && v <= z.max)
  return z?.label || '—'
}

// SVG semicircle gauge
function Gauge({ value, size = 160 }) {
  const r = size * 0.38
  const cx = size / 2
  const cy = size * 0.58
  const color = getColor(value)

  // Arc path helper
  const arc = (startDeg, endDeg, radius) => {
    const toRad = d => ((d - 180) * Math.PI) / 180
    const x1 = cx + radius * Math.cos(toRad(startDeg))
    const y1 = cy + radius * Math.sin(toRad(startDeg))
    const x2 = cx + radius * Math.cos(toRad(endDeg))
    const y2 = cy + radius * Math.sin(toRad(endDeg))
    const large = endDeg - startDeg > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`
  }

  // Needle angle: 0 = left (-90deg), 100 = right (+90deg)
  const needleAngle = value != null ? -90 + (value / 100) * 180 : -90
  const needleRad = ((needleAngle) * Math.PI) / 180
  const needleLen = r * 0.85
  const nx = cx + needleLen * Math.cos(needleRad)
  const ny = cy + needleLen * Math.sin(needleRad)

  const trackW = size * 0.1

  return (
    <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
      {/* Background arc zones */}
      {ZONES.map((z, i) => {
        const startDeg = (z.min / 100) * 180
        const endDeg   = (z.max / 100) * 180
        return (
          <path key={i}
            d={arc(startDeg, endDeg, r)}
            fill="none" stroke={z.color} strokeWidth={trackW}
            opacity={0.25} strokeLinecap="butt"
          />
        )
      })}
      {/* Filled arc up to value */}
      {value != null && (
        <path
          d={arc(0, (value / 100) * 180, r)}
          fill="none" stroke={color} strokeWidth={trackW}
          opacity={0.9} strokeLinecap="round"
        />
      )}
      {/* Needle */}
      {value != null && (
        <>
          <line x1={cx} y1={cy} x2={nx} y2={ny}
            stroke={color} strokeWidth={2.5} strokeLinecap="round"/>
          <circle cx={cx} cy={cy} r={size*0.04} fill={color}/>
        </>
      )}
      {/* Value text */}
      <text x={cx} y={cy - r * 0.15} textAnchor="middle"
        fill={color} fontSize={size * 0.2} fontWeight="700" fontFamily="monospace">
        {value ?? '—'}
      </text>
    </svg>
  )
}

function MiniTimeline({ data, color }) {
  if (!data?.length) return null
  return (
    <ResponsiveContainer width="100%" height={60}>
      <LineChart data={data} margin={{top:4,right:4,bottom:0,left:0}}>
        <XAxis dataKey="date" hide />
        <YAxis domain={[0,100]} hide />
        <Tooltip
          contentStyle={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,fontSize:11}}
          formatter={(v) => [`${v} — ${getLabel(v)}`, '']}
          labelFormatter={l => l}
        />
        <ReferenceLine y={25} stroke="#ff2d55" strokeDasharray="3 3" strokeOpacity={0.3}/>
        <ReferenceLine y={75} stroke="#00d4aa" strokeDasharray="3 3" strokeOpacity={0.3}/>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2}
          dot={false} activeDot={{r:3}}/>
      </LineChart>
    </ResponsiveContainer>
  )
}

function PrevDot({ label, value }) {
  if (value == null) return null
  const color = getColor(value)
  return (
    <div style={{textAlign:'center'}}>
      <div style={{fontSize:9,color:'var(--text3)',marginBottom:2}}>{label}</div>
      <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:700,color}}>{value}</div>
    </div>
  )
}

export default function FearGreedGauge({ fearGreed }) {
  const [tab, setTab] = useState('stock')

  const crypto = fearGreed?.crypto || {}
  const stock  = fearGreed?.stock  || {}

  // Fallback: dacă e format vechi (value direct pe fearGreed)
  const cryptoVal = crypto.value ?? fearGreed?.value ?? null
  const stockVal  = stock.value ?? null

  const active = tab === 'stock' ? stock : crypto
  const activeVal = tab === 'stock' ? stockVal : cryptoVal
  const color = getColor(activeVal)

  return (
    <div style={{padding:'12px 16px'}}>
      {/* Tabs */}
      <div style={{display:'flex',gap:6,marginBottom:12,justifyContent:'center'}}>
        {[
          {id:'stock',  label:'📈 Acțiuni (CNN)'},
          {id:'crypto', label:'₿ Crypto'},
        ].map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'4px 12px',borderRadius:6,border:'none',cursor:'pointer',
            fontSize:11,fontWeight:600,transition:'all .15s',
            background:tab===t.id?color:'var(--surface2)',
            color:tab===t.id?'#fff':'var(--text3)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Gauge */}
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
        <Gauge value={activeVal} size={180}/>
        <div style={{fontWeight:700,fontSize:14,color,marginTop:-4}}>
          {getLabel(activeVal)}
        </div>
      </div>

      {/* CNN prev values */}
      {tab === 'stock' && stock.value != null && (
        <div style={{display:'flex',justifyContent:'space-around',marginTop:12,padding:'8px 0',borderTop:'1px solid var(--border)'}}>
          <PrevDot label="Ieri"    value={stock.prev_close}/>
          <PrevDot label="1 săpt." value={stock.prev_week}/>
          <PrevDot label="1 lună"  value={stock.prev_month}/>
          <PrevDot label="1 an"    value={stock.prev_year}/>
        </div>
      )}

      {/* Crypto timeline */}
      {tab === 'crypto' && crypto.history?.length > 0 && (
        <div style={{marginTop:12,borderTop:'1px solid var(--border)',paddingTop:8}}>
          <div style={{fontSize:10,color:'var(--text3)',marginBottom:4,textAlign:'center'}}>
            ISTORIC 30 ZILE
          </div>
          <MiniTimeline data={crypto.history} color={color}/>
        </div>
      )}

      {/* Zone legend */}
      <div style={{display:'flex',gap:4,justifyContent:'center',marginTop:10,flexWrap:'wrap'}}>
        {ZONES.map(z => (
          <span key={z.label} style={{fontSize:9,color:z.color,fontWeight:600}}>
            {z.min}–{z.max} {z.label.split(' ').pop()}
          </span>
        ))}
      </div>
    </div>
  )
}
