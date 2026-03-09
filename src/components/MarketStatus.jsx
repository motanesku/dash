import { useState, useEffect } from 'react'
import useStore from '../lib/store.js'

function getMarketStatus() {
  const etNow = new Date(new Date().toLocaleString('en-US', { timeZone:'America/New_York' }))
  const day   = etNow.getDay()
  const total = etNow.getHours()*60 + etNow.getMinutes()
  const isWknd = day===0||day===6

  if (!isWknd && total>=570 && total<960)
    return { status:'OPEN',   label:'U.S. MARKETS OPEN',          color:'var(--green)',  dot:true  }
  if (!isWknd && total>=240 && total<570) {
    const m=570-total; return { status:'PRE', label:`U.S. MARKETS OPEN IN ${Math.floor(m/60)}H ${m%60}M`, color:'var(--gold)', dot:false }
  }
  if (!isWknd && total>=960 && total<1200)
    return { status:'POST',   label:'U.S. AFTER HOURS',           color:'var(--purple)', dot:false }

  let next = new Date(etNow)
  next.setHours(9,30,0,0)
  if (total>=570||isWknd) { next.setDate(next.getDate()+1); while([0,6].includes(next.getDay())) next.setDate(next.getDate()+1) }
  const dm = Math.round((next-etNow)/60000)
  return { status:'CLOSED', label:`U.S. MARKETS OPEN IN ${Math.floor(dm/60)}H ${dm%60}M`, color:'var(--text3)', dot:false }
}

function vixLabel(v) {
  if (v == null) return ''
  if (v < 15) return 'Low Fear'
  if (v < 20) return 'Normal'
  if (v < 30) return 'Elevated'
  if (v < 40) return 'High Fear'
  return 'Extreme Fear'
}

function vixColor(v) {
  if (v == null) return 'var(--text3)'
  if (v < 15) return 'var(--green)'
  if (v < 20) return 'var(--text3)'
  if (v < 30) return 'var(--gold)'
  if (v < 40) return 'var(--red)'
  return '#ff0055'
}

export default function MarketStatus() {
  const [st, setSt] = useState(getMarketStatus)
  const fearGreed = useStore(s => s.fearGreed)
  const marketData = useStore(s => s.marketData)

  useEffect(() => {
    const id = setInterval(() => setSt(getMarketStatus()), 30000)
    return () => clearInterval(id)
  }, [])

  const fgCryptoVal = fearGreed?.crypto?.value ?? fearGreed?.value ?? null
  const fgStockVal  = fearGreed?.stock?.value ?? null
  const fgColor = v => v==null?'var(--text3)':v<=25?'var(--red)':v<=45?'var(--gold)':v<=55?'var(--text3)':v<=75?'var(--green)':'#00d4aa'

  const vix = marketData?.['^VIX']?.price ?? null
  const vc  = vixColor(vix)

  const pillStyle = {
    display:'flex', alignItems:'center', gap:8,
    padding:'7px 14px', borderRadius:8,
    background:'var(--surface2)', border:'1px solid var(--border)',
    fontSize:11, fontFamily:'var(--mono)', fontWeight:600,
    whiteSpace:'nowrap',
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, flexWrap:'wrap' }}>
      {/* Market status pill */}
      <div style={{...pillStyle, color: st.color, border:`1px solid var(--border)`}}>
        {st.dot ? (
          <span style={{width:7,height:7,borderRadius:'50%',background:'var(--green)',boxShadow:'0 0 8px var(--green)',animation:'pulse 2s infinite',flexShrink:0}}/>
        ) : (
          <span style={{fontSize:12}}>🌙</span>
        )}
        {st.label}
      </div>

      {/* Crypto Fear & Greed */}
      {(fgCryptoVal!=null||fgStockVal!=null) && (
        <div style={{...pillStyle, border:`1px solid ${fgColor(fgStockVal??fgCryptoVal)}40`}}>
          <span style={{fontSize:12}}>🧠</span>
          <span style={{color:'var(--text3)'}}>Crypto F&G</span>
          {fgStockVal!=null&&<>
            <span style={{color:fgColor(fgStockVal), fontSize:13, fontWeight:800, lineHeight:1}}>{fgStockVal}</span>
            <span style={{color:fgColor(fgStockVal), fontSize:8, letterSpacing:.5}}>STOCKS</span>
          </>}
          {fgStockVal!=null&&fgCryptoVal!=null&&<span style={{color:'var(--border2)',fontSize:10}}>·</span>}
          {fgCryptoVal!=null&&<>
            <span style={{color:fgColor(fgCryptoVal), fontSize:13, fontWeight:800, lineHeight:1}}>{fgCryptoVal}</span>
            <span style={{color:fgColor(fgCryptoVal), fontSize:8, letterSpacing:.5}}>CRYPTO</span>
          </>}
        </div>
      )}

      {/* VIX — Stock Fear */}
      {vix != null && (
        <div style={{...pillStyle, border:`1px solid ${vc}40`}}>
          <span style={{fontSize:12}}>📊</span>
          <span style={{color:'var(--text3)'}}>VIX</span>
          <span style={{color:vc, fontSize:15, fontWeight:800, lineHeight:1}}>{vix.toFixed(1)}</span>
          <span style={{color:vc, fontSize:9, letterSpacing:.5}}>{vixLabel(vix).toUpperCase()}</span>
        </div>
      )}
    </div>
  )
}
