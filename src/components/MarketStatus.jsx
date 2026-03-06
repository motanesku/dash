import { useState, useEffect } from 'react'

function getMarketStatus() {
  const now = new Date()
  // Convert to ET
  const etOffset = now.toLocaleString('en-US',{timeZone:'America/New_York',hour:'numeric',hour12:false})
  const etNow = new Date(now.toLocaleString('en-US',{timeZone:'America/New_York'}))
  const day = etNow.getDay() // 0=Sun,6=Sat
  const h = etNow.getHours()
  const m = etNow.getMinutes()
  const totalMin = h*60+m

  const isWeekend = day===0||day===6
  const preOpen  = !isWeekend && totalMin>=240 && totalMin<570  // 4:00-9:30 ET
  const open     = !isWeekend && totalMin>=570 && totalMin<960  // 9:30-16:00 ET
  const postOpen = !isWeekend && totalMin>=960 && totalMin<1200 // 16:00-20:00 ET

  if (open) return { status:'OPEN', label:'U.S. MARKETS OPEN', color:'var(--green)', dot:true }
  if (preOpen) {
    const mins = 570-totalMin
    const hh=Math.floor(mins/60), mm=mins%60
    return { status:'PRE', label:`U.S. MARKETS OPEN IN ${hh}H ${mm}M`, color:'var(--gold)', dot:false }
  }
  if (postOpen) return { status:'POST', label:'U.S. AFTER HOURS', color:'var(--purple)', dot:false }

  // Next open
  let nextOpen = new Date(etNow)
  if (totalMin>=1200||isWeekend) {
    nextOpen.setDate(nextOpen.getDate()+1)
    while([0,6].includes(nextOpen.getDay())) nextOpen.setDate(nextOpen.getDate()+1)
    nextOpen.setHours(9,30,0,0)
  } else {
    nextOpen.setHours(9,30,0,0)
  }
  const diffMs = nextOpen-etNow
  const diffH = Math.floor(diffMs/3600000)
  const diffM = Math.floor((diffMs%3600000)/60000)
  return { status:'CLOSED', label:`U.S. MARKETS OPEN IN ${diffH}H ${diffM}M`, color:'var(--text3)', dot:false }
}

export default function MarketStatus() {
  const [status, setStatus] = useState(getMarketStatus())

  useEffect(()=>{
    const id = setInterval(()=>setStatus(getMarketStatus()), 30000)
    return ()=>clearInterval(id)
  },[])

  return (
    <div style={{
      display:'flex',alignItems:'center',gap:8,
      padding:'7px 14px',borderRadius:8,marginBottom:14,
      background:'var(--surface2)',border:'1px solid var(--border)',
      fontSize:11,fontFamily:'var(--mono)',fontWeight:600,
      color:status.color,letterSpacing:.5,
      width:'fit-content',
    }}>
      {status.dot ? (
        <span style={{
          width:7,height:7,borderRadius:'50%',
          background:'var(--green)',
          boxShadow:'0 0 8px var(--green)',
          animation:'pulse 2s infinite',
          flexShrink:0,
        }}/>
      ) : (
        <span style={{fontSize:13}}>🌙</span>
      )}
      {status.label}
    </div>
  )
}
