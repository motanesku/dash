const ZONES = [
  { min:0,  max:25,  label:'Extreme Fear', color:'#ff2d55' },
  { min:25, max:45,  label:'Fear',         color:'#ff6b35' },
  { min:45, max:55,  label:'Neutral',      color:'#f0b429' },
  { min:55, max:75,  label:'Greed',        color:'#34d399' },
  { min:75, max:100, label:'Extreme Greed',color:'#00d4aa' },
]

function getColor(v) {
  if (v == null) return 'var(--text3)'
  return ZONES.find(z => v >= z.min && v <= z.max)?.color || 'var(--text3)'
}
function getLabel(v) {
  if (v == null) return null
  return ZONES.find(z => v >= z.min && v <= z.max)?.label || null
}

function FGBar({ value, maxVal=100 }) {
  const pct = value != null ? Math.min((value / maxVal) * 100, 100) : null
  const color = maxVal === 100 ? getColor(value) : (() => {
    // VIX color
    if (value == null) return 'var(--text3)'
    if (value <= 15) return '#00d4aa'
    if (value <= 20) return '#34d399'
    if (value <= 25) return '#f0b429'
    if (value <= 30) return '#ff6b35'
    return '#ff2d55'
  })()

  const gradient = maxVal === 100
    ? 'linear-gradient(to right, #ff2d55 0%, #ff6b35 25%, #f0b429 45%, #34d399 55%, #00d4aa 100%)'
    : 'linear-gradient(to right, #00d4aa 0%, #34d399 30%, #f0b429 50%, #ff6b35 70%, #ff2d55 100%)'

  if (pct == null) return (
    <div style={{height:5,borderRadius:3,background:'var(--border)',width:'100%',marginTop:6}}/>
  )

  return (
    <div style={{position:'relative',height:5,borderRadius:3,background:gradient,width:'100%',marginTop:6}}>
      {/* mask right part */}
      <div style={{position:'absolute',left:`${pct}%`,right:0,top:0,bottom:0,
        background:'var(--surface2)',opacity:0.75,borderRadius:'0 3px 3px 0'}}/>
      {/* dot */}
      <div style={{position:'absolute',left:`calc(${pct}% - 5px)`,top:-3,
        width:10,height:10,borderRadius:'50%',
        background:color,border:'2px solid var(--surface2)',
        boxShadow:`0 0 6px ${color}, 0 0 2px ${color}`,
        zIndex:2}}/>
    </div>
  )
}

function Card({ icon, title, value, label, barMax=100, isVix=false }) {
  const color = isVix
    ? (value==null?'var(--text3)':value<=15?'#00d4aa':value<=20?'#34d399':value<=25?'#f0b429':value<=30?'#ff6b35':'#ff2d55')
    : getColor(value)
  const displayLabel = label || (isVix
    ? (value==null?null:value<=15?'Calm':value<=20?'Low Vol':value<=25?'Elevated':value<=30?'High Fear':'Extreme Fear')
    : getLabel(value))

  return (
    <div style={{
      flex:'1 1 0', minWidth:0,
      background:'var(--surface2)',
      border:`1px solid ${color}30`,
      borderRadius:10,
      padding:'8px 10px',
      display:'flex', flexDirection:'column', gap:0,
    }}>
      {/* Header row */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:9,color:'var(--text3)',fontWeight:600,letterSpacing:.4,lineHeight:1.3}}>
          {icon} {title}
        </span>
        {displayLabel &&
          <span style={{fontSize:8,color:color,fontWeight:700,
            background:`${color}22`,padding:'1px 5px',borderRadius:4,whiteSpace:'nowrap',flexShrink:0}}>
            {displayLabel}
          </span>
        }
      </div>
      {/* Number */}
      <div style={{display:'flex',alignItems:'baseline',gap:4}}>
        <span style={{
          fontFamily:'var(--mono)', fontWeight:800, lineHeight:1,
          fontSize: 'clamp(20px, 5vw, 28px)',
          color: value != null ? color : 'var(--text3)',
        }}>
          {value != null ? (isVix ? value.toFixed(1) : value) : '—'}
        </span>
        {!isVix && value != null &&
          <span style={{fontSize:9,color:'var(--text3)'}}>/ 100</span>
        }
      </div>
      {/* Bar */}
      <FGBar value={value} maxVal={isVix ? 50 : 100}/>
    </div>
  )
}

export default function FearGreedBanner({ fearGreed, vix }) {
  const cryptoVal   = fearGreed?.crypto?.value ?? fearGreed?.value ?? null
  const cryptoLabel = fearGreed?.crypto?.label ?? fearGreed?.label ?? null
  const stockVal    = fearGreed?.stock?.value ?? null
  const stockLabel  = fearGreed?.stock?.label ?? null

  return (
    <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'nowrap'}}>
      <Card icon="📈" title="STOCKS F&G (CNN)" value={stockVal}  label={stockLabel}/>
      <Card icon="₿"  title="CRYPTO F&G"       value={cryptoVal} label={cryptoLabel}/>
      <Card icon="📊" title="VIX"              value={vix}       isVix={true}/>
    </div>
  )
}
