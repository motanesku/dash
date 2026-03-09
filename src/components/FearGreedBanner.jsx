// Banner cu Fear & Greed (Stocks CNN + Crypto) + VIX sub MarketStatus

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
  if (v == null) return '—'
  return ZONES.find(z => v >= z.min && v <= z.max)?.label || '—'
}

// Bara colorată orizontală cu indicator
function FGBar({ value }) {
  if (value == null) return <div style={{height:4,borderRadius:2,background:'var(--border)',width:'100%'}}/>
  const color = getColor(value)
  return (
    <div style={{position:'relative',height:4,borderRadius:2,
      background:'linear-gradient(to right, #ff2d55 0%, #ff6b35 25%, #f0b429 45%, #34d399 55%, #00d4aa 100%)',
      width:'100%', opacity:0.35}}>
      {/* Overlay gri peste zona neatingată */}
      <div style={{position:'absolute',left:`${value}%`,right:0,top:0,bottom:0,
        background:'var(--surface)',borderRadius:'0 2px 2px 0'}}/>
      {/* Indicator */}
      <div style={{position:'absolute',left:`calc(${value}% - 4px)`,top:-3,
        width:8,height:8,borderRadius:'50%',background:color,
        boxShadow:`0 0 4px ${color}`,opacity:1,zIndex:1,
        border:'1.5px solid var(--surface)'}}/>
    </div>
  )
}

function FGCard({ icon, title, value, label, bar=true }) {
  const color = getColor(value)
  return (
    <div style={{
      flex:1, minWidth:0,
      background:'var(--surface2)',
      border:'1px solid var(--border)',
      borderRadius:10,
      padding:'10px 14px',
      display:'flex', flexDirection:'column', gap:6,
    }}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:10,color:'var(--text3)',fontWeight:600,letterSpacing:.5}}>
          {icon} {title}
        </span>
        {value != null &&
          <span style={{fontSize:9,color:color,fontWeight:700,
            background:`${color}18`,padding:'1px 6px',borderRadius:4}}>
            {label || getLabel(value)}
          </span>
        }
      </div>
      {/* Număr mare */}
      <div style={{display:'flex',alignItems:'baseline',gap:6}}>
        <span style={{
          fontFamily:'var(--mono)', fontSize:28, fontWeight:800,
          color: value != null ? color : 'var(--text3)',
          lineHeight:1,
        }}>
          {value ?? '—'}
        </span>
        {value != null &&
          <span style={{fontSize:10,color:'var(--text3)'}}>/ 100</span>
        }
      </div>
      {/* Bara */}
      {bar && <FGBar value={value}/>}
      {/* Zone hint */}
      {value == null &&
        <span style={{fontSize:9,color:'var(--text3)'}}>Date indisponibile</span>
      }
    </div>
  )
}

function VixCard({ vix, vixLabel, vixColor }) {
  const zones = [
    {max:15, label:'Calm',        color:'#00d4aa'},
    {max:20, label:'Low Vol',     color:'#34d399'},
    {max:25, label:'Elevated',    color:'#f0b429'},
    {max:30, label:'High Fear',   color:'#ff6b35'},
    {max:999,label:'Extreme Fear',color:'#ff2d55'},
  ]
  const zone = zones.find(z => (vix??0) <= z.max) || zones[zones.length-1]
  const color = vix != null ? zone.color : 'var(--text3)'
  // VIX bar: 0-50 range
  const pct = vix != null ? Math.min((vix / 50) * 100, 100) : null

  return (
    <div style={{
      flex:1, minWidth:0,
      background:'var(--surface2)',
      border:'1px solid var(--border)',
      borderRadius:10,
      padding:'10px 14px',
      display:'flex', flexDirection:'column', gap:6,
    }}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:10,color:'var(--text3)',fontWeight:600,letterSpacing:.5}}>
          📊 VIX
        </span>
        {vix != null &&
          <span style={{fontSize:9,color,fontWeight:700,
            background:`${color}18`,padding:'1px 6px',borderRadius:4}}>
            {zone.label}
          </span>
        }
      </div>
      <div style={{display:'flex',alignItems:'baseline',gap:6}}>
        <span style={{fontFamily:'var(--mono)',fontSize:28,fontWeight:800,color,lineHeight:1}}>
          {vix != null ? vix.toFixed(1) : '—'}
        </span>
      </div>
      {/* Bara VIX — verde la stânga, roșu la dreapta */}
      {pct != null ? (
        <div style={{position:'relative',height:4,borderRadius:2,
          background:'linear-gradient(to right, #00d4aa 0%, #34d399 30%, #f0b429 50%, #ff6b35 70%, #ff2d55 100%)',
          width:'100%', opacity:0.35}}>
          <div style={{position:'absolute',left:`${pct}%`,right:0,top:0,bottom:0,
            background:'var(--surface)',borderRadius:'0 2px 2px 0'}}/>
          <div style={{position:'absolute',left:`calc(${pct}% - 4px)`,top:-3,
            width:8,height:8,borderRadius:'50%',background:color,
            boxShadow:`0 0 4px ${color}`,opacity:1,zIndex:1,
            border:'1.5px solid var(--surface)'}}/>
        </div>
      ) : (
        <div style={{height:4,borderRadius:2,background:'var(--border)',width:'100%'}}/>
      )}
    </div>
  )
}

export default function FearGreedBanner({ fearGreed, vix }) {
  const cryptoVal = fearGreed?.crypto?.value ?? fearGreed?.value ?? null
  const cryptoLabel = fearGreed?.crypto?.label ?? fearGreed?.label ?? null
  const stockVal  = fearGreed?.stock?.value ?? null
  const stockLabel = fearGreed?.stock?.label ?? null

  return (
    <div style={{
      display:'flex', gap:10,
      marginBottom:16,
      flexWrap:'wrap',
    }}>
      <FGCard
        icon="📈" title="STOCKS F&G (CNN)"
        value={stockVal} label={stockLabel}
      />
      <FGCard
        icon="₿" title="CRYPTO F&G"
        value={cryptoVal} label={cryptoLabel}
      />
      <VixCard vix={vix}/>
    </div>
  )
}
