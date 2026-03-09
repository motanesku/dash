const ZONES = [
  { min:0,  max:25,  label:'Extreme Fear', color:'#ff2d55' },
  { min:25, max:45,  label:'Fear',         color:'#ff6b35' },
  { min:45, max:55,  label:'Neutral',      color:'#f0b429' },
  { min:55, max:75,  label:'Greed',        color:'#34d399' },
  { min:75, max:100, label:'Extreme Greed',color:'#00d4aa' },
]

function getFGColor(v) {
  if (v == null) return 'var(--text3)'
  return ZONES.find(z => v >= z.min && v <= z.max)?.color || 'var(--text3)'
}
function getFGLabel(v) {
  if (v == null) return null
  return ZONES.find(z => v >= z.min && v <= z.max)?.label || null
}
function getVixColor(v) {
  if (v == null) return 'var(--text3)'
  if (v <= 15) return '#00d4aa'
  if (v <= 20) return '#34d399'
  if (v <= 25) return '#f0b429'
  if (v <= 30) return '#ff6b35'
  return '#ff2d55'
}
function getVixLabel(v) {
  if (v == null) return null
  if (v <= 15) return 'Calm'
  if (v <= 20) return 'Low Volatility'
  if (v <= 25) return 'Elevated'
  if (v <= 30) return 'High Fear'
  return 'Extreme Fear'
}

function Bar({ pct, gradient, color }) {
  if (pct == null) return (
    <div style={{height:5,borderRadius:3,background:'var(--border)',width:'100%'}}/>
  )
  return (
    <div style={{position:'relative',height:5,borderRadius:3,background:gradient,width:'100%'}}>
      <div style={{position:'absolute',left:`${pct}%`,right:0,top:0,bottom:0,
        background:'var(--surface2)',opacity:0.72,borderRadius:'0 3px 3px 0'}}/>
      <div style={{position:'absolute',left:`calc(${pct}% - 5px)`,top:-3,
        width:10,height:10,borderRadius:'50%',
        background:color,border:'2px solid var(--surface2)',
        boxShadow:`0 0 6px ${color}`,zIndex:2}}/>
    </div>
  )
}

function Card({ icon, title, number, label, color, barPct, barGradient }) {
  return (
    <div style={{
      flex:'1 1 0', minWidth:0,
      background:'var(--surface2)',
      border:`1px solid ${color}30`,
      borderRadius:10,
      padding:'8px 10px',
      display:'flex', flexDirection:'column', gap:4,
    }}>
      {/* Titlu card */}
      <div style={{display:'flex',alignItems:'center',gap:4}}>
        <span style={{fontSize:13}}>{icon}</span>
        <span style={{fontSize:10,color:'var(--text3)',fontWeight:700,letterSpacing:.3}}>
          {title}
        </span>
      </div>

      {/* Număr mare */}
      <div style={{display:'flex',alignItems:'baseline',gap:3}}>
        <span style={{
          fontFamily:'var(--mono)', fontWeight:800, lineHeight:1,
          fontSize:'clamp(22px,5vw,30px)',
          color,
        }}>
          {number ?? '—'}
        </span>
      </div>

      {/* Bară */}
      <Bar pct={barPct} gradient={barGradient} color={color}/>

      {/* Label sub bară */}
      <div style={{fontSize:9,fontWeight:700,color,letterSpacing:.3,marginTop:1}}>
        {label ?? '—'}
      </div>
    </div>
  )
}

export default function FearGreedBanner({ fearGreed, vix }) {
  const cryptoVal = fearGreed?.crypto?.value ?? fearGreed?.value ?? null
  const stockVal  = fearGreed?.stock?.value ?? null

  const fgGradient = 'linear-gradient(to right,#ff2d55 0%,#ff6b35 25%,#f0b429 45%,#34d399 55%,#00d4aa 100%)'
  const vixGradient = 'linear-gradient(to right,#00d4aa 0%,#34d399 30%,#f0b429 50%,#ff6b35 70%,#ff2d55 100%)'

  return (
    <div style={{marginBottom:16}}>
      {/* Titlu general */}
      <div style={{
        fontSize:9,fontWeight:700,color:'var(--text3)',
        letterSpacing:1.2,marginBottom:6,paddingLeft:2,
      }}>
        FEAR &amp; GREED
      </div>

      {/* 3 carduri */}
      <div style={{display:'flex',gap:8,flexWrap:'nowrap'}}>
        <Card
          icon="📈" title="Stocks (CNN)"
          number={stockVal}
          color={getFGColor(stockVal)}
          label={getFGLabel(stockVal)}
          barPct={stockVal}
          barGradient={fgGradient}
        />
        <Card
          icon="₿" title="Crypto"
          number={cryptoVal}
          color={getFGColor(cryptoVal)}
          label={getFGLabel(cryptoVal)}
          barPct={cryptoVal}
          barGradient={fgGradient}
        />
        <Card
          icon="📊" title="VIX"
          number={vix != null ? vix.toFixed(1) : null}
          color={getVixColor(vix)}
          label={getVixLabel(vix)}
          barPct={vix != null ? Math.min((vix/50)*100, 100) : null}
          barGradient={vixGradient}
        />
      </div>
    </div>
  )
}
