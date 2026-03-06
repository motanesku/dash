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

export default function MarketStatus() {
  const [st, setSt] = useState(getMarketStatus)
  const fearGreed   = useStore(s => s.fearGreed)

  useEffect(() => {
    const id = setInterval(() => setSt(getMarketStatus()), 30000)
    return () => clearInterval(id)
  }, [])

  const fgColor = fearGreed
    ? fearGreed.value<=25?'var(--red)':fearGreed.value<=45?'var(--gold)':fearGreed.value<=55?'var(--text3)':fearGreed.value<=75?'var(--green)':'#00d4aa'
    : null

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
      {/* Market status pill */}
      <div style={{
        display:'flex', alignItems:'center', gap:8,
        padding:'7px 14px', borderRadius:8,
        background:'var(--surface2)', border:'1px solid var(--border)',
        fontSize:11, fontFamily:'var(--mono)', fontWeight:600,
        color: st.color, letterSpacing:.5,
      }}>
        {st.dot ? (
          <span style={{width:7,height:7,borderRadius:'50%',background:'var(--green)',boxShadow:'0 0 8px var(--green)',animation:'pulse 2s infinite',flexShrink:0}}/>
        ) : (
          <span style={{fontSize:12}}>🌙</span>
        )}
        {st.label}
      </div>

      {/* Fear & Greed — right next to market status */}
      {fearGreed && (
        <div style={{
          display:'flex', alignItems:'center', gap:8,
          padding:'7px 14px', borderRadius:8,
          background:'var(--surface2)', border:`1px solid ${fgColor}40`,
          fontSize:11, fontFamily:'var(--mono)', fontWeight:600,
        }}>
          <span style={{fontSize:13}}>🧠</span>
          <span style={{color:'var(--text3)'}}>Fear & Greed</span>
          <span style={{
            color:fgColor, fontSize:15, fontWeight:800,
            fontFamily:'var(--mono)', lineHeight:1,
          }}>{fearGreed.value}</span>
          <span style={{color:fgColor, fontSize:9, letterSpacing:.5}}>{fearGreed.label}</span>
        </div>
      )}
    </div>
  )
}
