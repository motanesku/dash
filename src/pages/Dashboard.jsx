import { useMemo, useState, useEffect } from 'react'
import useStore from '../lib/store.js'
import { calcPortfolio, aggregatePositions, fmtC, fmtPct, pnlClass } from '../lib/portfolio.js'
import { MARKET_SYMBOLS, fetchHistory } from '../lib/prices.js'
import MarketStatus from '../components/MarketStatus.jsx'

const COLORS = ['#58a6ff','#00d4aa','#a78bfa','#f0b429','#ff5572','#34d399','#fb923c','#60a5fa']

// ── Sparkline SVG ────────────────────────────────────────────
function Sparkline({ values, color, width=60, height=28 }) {
  if(!values||values.length<2) return <div style={{width,height}}/>
  const min=Math.min(...values), max=Math.max(...values)
  const range=max-min||1
  const pts=values.map((v,i)=>{
    const x=i/(values.length-1)*width
    const y=height-(v-min)/range*height
    return`${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return(
    <svg width={width} height={height} style={{overflow:'visible'}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={values.length-1>0?(values.length-1)/(values.length-1)*width:0} cy={height-(values[values.length-1]-min)/range*height} r={2} fill={color}/>
    </svg>
  )
}

// ── Market Card with sparkline ────────────────────────────────
function MarketCard({ sym, label, d, history }) {
  const chg = d?.prev ? ((d.price-d.prev)/d.prev)*100 : null
  const isPos = chg==null||chg>=0
  const color = isPos?'var(--green)':'var(--red)'
  // Use history closes for sparkline, or fallback prev+price
  const sparkVals = history?.length>1 ? history.map(p=>p.close) : (d&&d.prev?[d.prev,d.price]:null)

  return(
    <div className="card" style={{
      padding:'10px 14px',minWidth:110,flexShrink:0,
      transition:'transform .15s, box-shadow .15s',
      borderLeft:`2px solid ${color}`,
    }}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow)'}}
      onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
        <div className="label">{label}</div>
        {sparkVals&&<Sparkline values={sparkVals} color={color}/>}
      </div>
      <div className="mono" style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>
        {d?(()=>{try{const dg=(sym==='^VIX'||sym==='EURUSD=X'||sym==='RON=X')?4:2;return new Intl.NumberFormat('ro-RO',{minimumFractionDigits:dg,maximumFractionDigits:dg}).format(d.price)}catch{return d.price?.toFixed(2)??'—'}})():'—'}
      </div>
      {chg!=null&&<div className="mono" style={{fontSize:10,color,marginTop:2,fontWeight:600}}>
        {chg>=0?'+':''}{chg.toFixed(2)}%
      </div>}
    </div>
  )
}

// ── Market Ticker ─────────────────────────────────────────────
function MarketTicker() {
  const marketData = useStore(s=>s.marketData)
  const [histories, setHistories] = useState({})

  useEffect(()=>{
    // Fetch 5d history for sparklines for key indices
    const key = ['^GSPC','^IXIC','^DJI']
    key.forEach(sym=>{
      fetchHistory(sym,'5d').then(pts=>{
        if(pts?.length) setHistories(h=>({...h,[sym]:pts}))
      }).catch(()=>{})
    })
  },[])

  return(
    <div style={{display:'flex',gap:8,overflowX:'auto',WebkitOverflowScrolling:'touch',paddingBottom:4,marginBottom:16}}>
      {MARKET_SYMBOLS.map(({sym,label})=>(
        <MarketCard key={sym} sym={sym} label={label} d={marketData[sym]} history={histories[sym]}/>
      ))}

    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────
function StatCard({label,value,sub,subClass,accent,delay=0}) {
  return(
    <div className={`card fade-up delay-${delay}`} style={{padding:'18px 20px',borderLeft:`3px solid ${accent||'var(--border)'}`,position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:0,right:0,width:60,height:60,borderRadius:'50%',background:`${accent||'transparent'}18`,transform:'translate(20px,-20px)'}}/>
      <div className="label" style={{marginBottom:8}}>{label}</div>
      <div className="mono" style={{fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:4}}>{value}</div>
      {sub&&<div className={`mono ${subClass||''}`} style={{fontSize:12}}>{sub}</div>}
    </div>
  )
}

// ── Sector Pie Chart ──────────────────────────────────────────
const SECTOR_COLORS = {
  'Tech':'#58a6ff','Finance':'#00d4aa','Health':'#a78bfa','Energy':'#f0b429',
  'Consumer':'#ff5572','Industrial':'#34d399','Materials':'#fb923c',
  'Utilities':'#60a5fa','Real Estate':'#f472b6','Telecom':'#a3e635','Other':'#6b7280','—':'#374151'
}
const S_ICON = {'Tech':'💻','Finance':'🏦','Health':'🏥','Energy':'⚡','Consumer':'🛍','Industrial':'🏭','Materials':'⛏','Utilities':'💡','Real Estate':'🏢','Telecom':'📡','Other':'·','—':'·'}

function SectorPieChart({ positions, companyInfo }) {
  const [hovered, setHovered] = useState(null)

  const sectorData = useMemo(() => {
    const map = {}
    positions.forEach(p => {
      const info   = companyInfo[p.symbol] || {}
      const sector = info.sector || p.sector || '—'
      const val    = p.curValue || 0
      if (!map[sector]) map[sector] = { sector, value: 0, symbols: [] }
      map[sector].value    += val
      map[sector].symbols.push(p.symbol)
    })
    const total = Object.values(map).reduce((s, v) => s + v.value, 0)
    return Object.values(map)
      .filter(d => d.value > 0)
      .map(d => ({ ...d, pct: total > 0 ? (d.value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value)
  }, [positions, companyInfo])

  if (!sectorData.length) return (
    <div style={{padding:'30px 20px',textAlign:'center',color:'var(--text3)',fontSize:13}}>
      Informații sector nu sunt disponibile încă. Adaugă tranzacții și așteaptă încărcarea datelor.
    </div>
  )

  const total = sectorData.reduce((s, d) => s + d.value, 0)
  const size = 180, cx = size/2, cy = size/2, r = 72, innerR = 38
  let angle = -Math.PI / 2

  const slices = sectorData.map(d => {
    const pct  = d.value / total
    const a    = pct * 2 * Math.PI
    const x1   = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle)
    const x2   = cx + r * Math.cos(angle + a), y2 = cy + r * Math.sin(angle + a)
    const xi1  = cx + innerR * Math.cos(angle), yi1 = cy + innerR * Math.sin(angle)
    const xi2  = cx + innerR * Math.cos(angle + a), yi2 = cy + innerR * Math.sin(angle + a)
    const large = a > Math.PI ? 1 : 0
    const path  = `M${xi1},${yi1} L${x1},${y1} A${r},${r},0,${large},1,${x2},${y2} L${xi2},${yi2} A${innerR},${innerR},0,${large},0,${xi1},${yi1} Z`
    const midAngle = angle + a / 2
    const lx = cx + (r + 10) * Math.cos(midAngle)
    const ly = cy + (r + 10) * Math.sin(midAngle)
    angle += a
    return { ...d, path, color: SECTOR_COLORS[d.sector] || '#6b7280', lx, ly, pct: pct * 100 }
  })

  const hov = hovered ? slices.find(s => s.sector === hovered) : null

  return (
    <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:24,alignItems:'center'}}>
      <div style={{position:'relative',flexShrink:0}}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map((s, i) => (
            <path key={i} d={s.path}
              fill={s.color}
              opacity={hovered && hovered !== s.sector ? 0.4 : 0.92}
              style={{cursor:'pointer',transition:'opacity .2s'}}
              onMouseEnter={() => setHovered(s.sector)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          {/* Center label */}
          <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--text)" fontSize="13" fontWeight="700" fontFamily="var(--mono)">
            {hov ? `${hov.pct.toFixed(1)}%` : `${sectorData.length}`}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text3)" fontSize="10" fontFamily="var(--mono)">
            {hov ? hov.sector : 'sectoare'}
          </text>
          <text x={cx} y={cy + 24} textAnchor="middle" fill="var(--text3)" fontSize="10" fontFamily="var(--mono)">
            {hov ? fmtC(hov.value) : ''}
          </text>
        </svg>
      </div>
      {/* Legend */}
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {slices.map((s, i) => (
          <div key={i} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',
            opacity: hovered && hovered !== s.sector ? 0.4 : 1, transition:'opacity .2s'}}
            onMouseEnter={() => setHovered(s.sector)}
            onMouseLeave={() => setHovered(null)}>
            <span style={{width:10,height:10,borderRadius:3,background:s.color,flexShrink:0}}/>
            <span style={{fontSize:11,color:'var(--text2)',flex:1,fontWeight:500}}>
              {S_ICON[s.sector]||''} {s.sector}
            </span>
            <span className="mono" style={{fontSize:10,color:'var(--text3)',minWidth:36,textAlign:'right'}}>
              {s.pct.toFixed(1)}%
            </span>
            <span className="mono" style={{fontSize:10,color:'var(--text3)',minWidth:70,textAlign:'right'}}>
              {fmtC(s.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Alloc Chart ───────────────────────────────────────────────
function AllocChart({positions}) {
  const total=positions.reduce((s,p)=>s+(p.curValue||0),0)
  const max=positions[0]?.curValue||1
  return(
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {positions.map((p,i)=>{
        const pct=total>0&&p.curValue?(p.curValue/total)*100:0
        const barW=max>0?(p.curValue||0)/max*100:0
        return(
          <div key={p.broker+p.symbol} style={{display:'grid',gridTemplateColumns:'64px 1fr 44px',alignItems:'center',gap:10}}>
            <span className="mono" style={{fontSize:11,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.symbol}</span>
            <div style={{height:6,background:'var(--surface2)',borderRadius:3,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${barW}%`,background:COLORS[i%COLORS.length],borderRadius:3,transition:'width 1.2s cubic-bezier(.4,0,.2,1)'}}/>
            </div>
            <span className="mono" style={{fontSize:10,color:'var(--text3)',textAlign:'right'}}>{pct.toFixed(1)}%</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Monthly Chart ─────────────────────────────────────────────
function MonthlyChart({txs,prices}) {
  const data=useMemo(()=>{
    if(!txs.length) return []
    const first=new Date(txs.map(t=>t.date).sort()[0])
    const now=new Date()
    const months=[]
    let cur=new Date(first.getFullYear(),first.getMonth(),1)
    while(cur<=now){months.push(new Date(cur));cur=new Date(cur.getFullYear(),cur.getMonth()+1,1)}
    return months.map(month=>{
      const end=new Date(month.getFullYear(),month.getMonth()+1,0)
      const snap=txs.filter(t=>new Date(t.date)<=end&&t.type!=='DEPOSIT')
      const pos={}
      snap.forEach(t=>{
        if(!pos[t.symbol])pos[t.symbol]={shares:0,cost:0}
        if(t.type==='BUY'){pos[t.symbol].shares+=t.shares;pos[t.symbol].cost+=t.shares*t.price}
        else if(t.type==='SELL'){const a=pos[t.symbol].shares>0?pos[t.symbol].cost/pos[t.symbol].shares:t.price;pos[t.symbol].shares-=t.shares;pos[t.symbol].cost-=a*t.shares}
      })
      const val=Object.entries(pos).reduce((s,[sym,p])=>s+p.shares*(prices[sym]?.price||0),0)
      const cost=Object.values(pos).reduce((s,p)=>s+p.cost,0)
      return{label:`${month.toLocaleString('ro-RO',{month:'short'})} ${month.getFullYear().toString().slice(2)}`,val,cost}
    })
  },[txs,prices])
  if(!data.length) return <div style={{color:'var(--text3)',fontSize:12,textAlign:'center',padding:40}}>Date insuficiente</div>
  const W=500,H=160,PL=8,PR=8,PT=10,PB=24,cW=W-PL-PR,cH=H-PT-PB
  const maxVal=Math.max(...data.map(d=>d.val),1)
  const barW=Math.min(cW/data.length-3,28)
  return(
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:'visible'}}>
      {data.map((d,i)=>{
        const x=PL+i*(cW/data.length)+(cW/data.length-barW)/2
        const bH=Math.max(d.val/maxVal*cH,2)
        const y=PT+cH-bH
        return(
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bH} fill={d.val>=d.cost?'var(--green)':'var(--red)'} rx={3} opacity={.85}/>
            {i%Math.ceil(data.length/6)===0&&<text x={x+barW/2} y={H-4} textAnchor="middle" fontSize={8} fill="var(--text3)" fontFamily="var(--mono)">{d.label}</text>}
          </g>
        )
      })}
    </svg>
  )
}

// ── Performance Chart ─────────────────────────────────────────
function PerformanceChart({txs,prices}) {
  const [spPoints,setSpPoints]=useState([])
  const [loading,setLoading]=useState(false)
  useEffect(()=>{
    if(!txs.length) return
    setLoading(true)
    fetchHistory('^GSPC','6mo').then(pts=>{setSpPoints(pts||[]);setLoading(false)}).catch(()=>setLoading(false))
  },[])

  const pfPoints=useMemo(()=>{
    if(!txs.length||!spPoints.length) return []
    return spPoints.map(sp=>{
      const date=new Date(sp.date)
      const snap=txs.filter(t=>new Date(t.date)<=date&&t.type!=='DEPOSIT')
      const pos={}
      snap.forEach(t=>{
        if(!pos[t.symbol])pos[t.symbol]={shares:0,cost:0}
        if(t.type==='BUY'){pos[t.symbol].shares+=t.shares;pos[t.symbol].cost+=t.shares*t.price}
        else if(t.type==='SELL'){const a=pos[t.symbol].shares>0?pos[t.symbol].cost/pos[t.symbol].shares:t.price;pos[t.symbol].shares-=t.shares;pos[t.symbol].cost-=a*t.shares}
      })
      const val=Object.entries(pos).reduce((s,[sym,p])=>s+p.shares*(prices[sym]?.price||p.cost/Math.max(p.shares,.0001)),0)
      const cost=Object.values(pos).reduce((s,p)=>s+p.cost,0)
      return{date:sp.date,pct:cost>0?((val-cost)/cost)*100:0}
    })
  },[txs,spPoints,prices])

  if(loading) return <div style={{color:'var(--text3)',fontSize:12,textAlign:'center',padding:40,fontFamily:'var(--mono)'}}>se încarcă...</div>
  if(!spPoints.length) return <div style={{color:'var(--text3)',fontSize:12,textAlign:'center',padding:40}}>Date indisponibile</div>
  const spFirst=spPoints[0]?.close||1
  const spNorm=spPoints.map((p)=>({y:(p.close-spFirst)/spFirst*100}))
  const pfNorm=pfPoints.map(p=>({y:p.pct}))
  const allY=[...spNorm.map(p=>p.y),...pfNorm.map(p=>p.y)]
  const minY=Math.min(...allY,-2),maxY=Math.max(...allY,2),rangeY=maxY-minY||1
  const n=spNorm.length
  const W=500,H=160,PL=38,PR=8,PT=10,PB=24,cW=W-PL-PR,cH=H-PT-PB
  const toPath=pts=>pts.map((p,i)=>{const x=PL+i/Math.max(n-1,1)*cW;const y=PT+cH-(p.y-minY)/rangeY*cH;return`${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`}).join(' ')
  const gridVals=[...new Set([Math.round(minY/5)*5,0,Math.round(maxY/5)*5])].sort((a,b)=>a-b)
  const labelIdxs=[0,Math.floor(n/3),Math.floor(2*n/3),n-1].filter(i=>i<n)
  const fmtD=d=>new Date(d).toLocaleDateString('ro-RO',{day:'numeric',month:'short'})
  const spLast=spNorm[spNorm.length-1]?.y||0
  const pfLast=pfNorm[pfNorm.length-1]?.y||0
  return(
    <div>
      <div style={{display:'flex',gap:16,marginBottom:10,flexWrap:'wrap'}}>
        <span style={{display:'flex',alignItems:'center',gap:5,fontSize:11}}>
          <span style={{width:18,height:2,background:'#00d4aa',display:'inline-block',borderRadius:1}}/>
          <span style={{color:'var(--text3)'}}>S&P 500</span>
          <span className="mono" style={{fontWeight:700,color:spLast>=0?'var(--green)':'var(--red)'}}>{spLast>=0?'+':''}{spLast.toFixed(2)}%</span>
        </span>
        <span style={{display:'flex',alignItems:'center',gap:5,fontSize:11}}>
          <span style={{width:18,height:0,borderTop:'2px dashed #58a6ff',display:'inline-block'}}/>
          <span style={{color:'var(--text3)'}}>Portofoliu</span>
          <span className="mono" style={{fontWeight:700,color:pfLast>=0?'var(--green)':'var(--red)'}}>{pfLast>=0?'+':''}{pfLast.toFixed(2)}%</span>
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:'visible'}}>
        {gridVals.map(v=>{const y=PT+cH-(v-minY)/rangeY*cH;return<g key={v}><line x1={PL} y1={y} x2={W-PR} y2={y} stroke="var(--border)" strokeWidth={v===0?1.5:.5} strokeDasharray={v===0?'none':'3 3'}/><text x={PL-4} y={y+3} textAnchor="end" fontSize={8} fill="var(--text3)" fontFamily="var(--mono)">{v>0?'+':''}{v}%</text></g>})}
        <path d={toPath(spNorm)} fill="none" stroke="#00d4aa" strokeWidth={1.5} strokeLinejoin="round"/>
        <path d={toPath(pfNorm)} fill="none" stroke="#58a6ff" strokeWidth={2} strokeLinejoin="round" strokeDasharray="5 3"/>
        {labelIdxs.map(i=>{const x=PL+i/Math.max(n-1,1)*cW;return<text key={i} x={x} y={H-4} textAnchor="middle" fontSize={8} fill="var(--text3)" fontFamily="var(--mono)">{fmtD(spPoints[i]?.date)}</text>})}
      </svg>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────
function SkeletonCard() {
  return(<div className="card" style={{padding:'18px 20px'}}><div className="skeleton" style={{height:10,width:80,marginBottom:12}}/><div className="skeleton" style={{height:22,width:120,marginBottom:8}}/><div className="skeleton" style={{height:12,width:60}}/></div>)
}

// ── Dashboard ─────────────────────────────────────────────────
export default function Dashboard() {
  const txs=useStore(s=>s.txs)
  const prices=useStore(s=>s.prices)
  const companyInfo=useStore(s=>s.companyInfo)
  const cloudLoading=useStore(s=>s.cloudLoading)
  const pricesLoading=useStore(s=>s.pricesLoading)
  const hasCachedData=Object.keys(prices).length>0||txs.length>0
  const isFirstLoad=cloudLoading&&!hasCachedData
  const [chartTab,setChartTab]=useState('perf')

  const {positions,cashByBroker}=useMemo(()=>calcPortfolio(txs,prices),[txs,prices])
  const agg=useMemo(()=>aggregatePositions(positions),[positions])
  const cashTotal=Object.values(cashByBroker).reduce((s,v)=>s+v,0)
  const totalWithCash=agg.totalCurValue+cashTotal
  const cashPct=totalWithCash>0?(cashTotal/totalWithCash)*100:0

  const CHART_TABS=[
    {id:'perf',label:'📈 Performanță'},
    {id:'alloc',label:'▦ Alocare'},
    {id:'monthly',label:'📊 Lunar'},
    {id:'sectors',label:'🥧 Sectoare'},
  ]

  return(
    <div className="fade-up">
      {pricesLoading&&hasCachedData&&(
        <div style={{position:'fixed',bottom:20,right:20,zIndex:99,background:'var(--surface)',border:'1px solid var(--border2)',borderRadius:8,padding:'8px 14px',display:'flex',alignItems:'center',gap:8,fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)',boxShadow:'var(--shadow)'}}>
          <span style={{animation:'pulse 1s infinite',display:'inline-block'}}>⟳</span> actualizare...
        </div>
      )}

      <MarketStatus/>
      <MarketTicker/>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12,marginBottom:20}}>
        <StatCard delay={1} label="Valoare Totală" value={fmtC(agg.totalCurValue)} sub={`${positions.length} poziții`} accent="var(--blue)"/>
        <StatCard delay={2} label="Cost Investit" value={fmtC(agg.totalCostBasis)} sub={`${txs.filter(t=>t.type!=='DEPOSIT').length} tranzacții`} accent="var(--text3)"/>
        <StatCard delay={3} label="Profit Nerealizat" value={fmtC(agg.totalUnrealized)} sub={fmtPct(agg.uPct)} subClass={pnlClass(agg.totalUnrealized)} accent={agg.totalUnrealized>=0?'var(--green)':'var(--red)'}/>
        <StatCard delay={4} label="Profit Realizat" value={fmtC(agg.totalRealized)} sub={fmtPct(agg.rPct)} subClass={pnlClass(agg.totalRealized)} accent="var(--purple)"/>
        <StatCard delay={5} label="💵 Cash" value={fmtC(cashTotal)} sub={fmtPct(cashPct,false)+' din port.'} accent="var(--gold)"/>
      </div>

      {positions.length>0&&(
        <div className="card fade-up delay-5" style={{padding:'16px 18px',marginBottom:20}}>
          <div style={{display:'flex',gap:6,marginBottom:14,borderBottom:'1px solid var(--border)',paddingBottom:12}}>
            {CHART_TABS.map(t=>(
              <button key={t.id} onClick={()=>setChartTab(t.id)} style={{
                padding:'5px 12px',borderRadius:6,border:'none',cursor:'pointer',
                background:chartTab===t.id?'var(--blue)':'var(--surface2)',
                color:chartTab===t.id?'#fff':'var(--text3)',
                fontSize:11,fontWeight:600,transition:'all .15s',
              }}>{t.label}</button>
            ))}
          </div>
          {chartTab==='perf'    && <PerformanceChart txs={txs} prices={prices}/>}
          {chartTab==='alloc'   && <AllocChart positions={positions}/>}
          {chartTab==='monthly' && <MonthlyChart txs={txs} prices={prices}/>}
          {chartTab==='sectors' && <SectorPieChart positions={positions} companyInfo={companyInfo}/>}
        </div>
      )}

      {isFirstLoad&&(<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12}}>{[1,2,3,4,5].map(i=><SkeletonCard key={i}/>)}</div>)}
      {positions.length===0&&!isFirstLoad&&(
        <div className="card" style={{padding:'60px 20px',textAlign:'center'}}>
          <div style={{fontSize:40,marginBottom:12}}>📊</div>
          <div style={{fontWeight:600,fontSize:16,marginBottom:6}}>Nicio poziție încă</div>
          <div style={{color:'var(--text3)',fontSize:13}}>Adaugă tranzacții sau importă din Excel.</div>
        </div>
      )}
    </div>
  )
}
