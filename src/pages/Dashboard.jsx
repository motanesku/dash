import { useMemo } from 'react'
import useStore from '../lib/store.js'
import { aggregatePositions, fmtC, fmtPct, pnlClass } from '../lib/portfolio.js'
import { MARKET_SYMBOLS } from '../lib/prices.js'
import PriceChart from '../components/PriceChart.jsx'

const COLORS = ['#4d9fff','#00d4aa','#a78bfa','#f0b429','#ff4d6a','#34d399','#fb923c','#60a5fa']

function StatCard({ label, value, sub, subClass, accent, delay=0 }) {
  return (
    <div className={`card fade-up delay-${delay}`} style={{padding:'18px 20px',borderLeft:`3px solid ${accent||'var(--border)'}`, position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:0,right:0,width:60,height:60,borderRadius:'50%',background:`${accent||'transparent'}10`,transform:'translate(20px,-20px)'}}/>
      <div className="label" style={{marginBottom:8}}>{label}</div>
      <div className="mono" style={{fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:4}}>{value}</div>
      {sub&&<div className={`mono ${subClass||''}`} style={{fontSize:12}}>{sub}</div>}
    </div>
  )
}

function MarketTicker() {
  const { marketData, fearGreed } = useStore()

  return (
    <div style={{display:'flex',gap:8,overflowX:'auto',WebkitOverflowScrolling:'touch',paddingBottom:4,marginBottom:20}}>
      {MARKET_SYMBOLS.map(({sym,label})=>{
        const d = marketData[sym]
        const chg = d?.prev ? ((d.price-d.prev)/d.prev)*100 : null
        const isPos = chg >= 0
        return (
          <div key={sym} className="card" style={{padding:'10px 14px',minWidth:100,flexShrink:0,transition:'transform .15s'}}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
            onMouseLeave={e=>e.currentTarget.style.transform=''}>
            <div className="label" style={{marginBottom:4}}>{label}</div>
            <div className="mono" style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>
              {d ? new Intl.NumberFormat('ro-RO',{minimumFractionDigits:sym==='^VIX'||sym==='EURUSD=X'||sym==='RON=X'?4:0,maximumFractionDigits:2}).format(d.price) : '—'}
            </div>
            {chg!=null&&<div className="mono" style={{fontSize:10,color:isPos?'var(--green)':'var(--red)',marginTop:2}}>
              {isPos?'+':''}{chg.toFixed(2)}%
            </div>}
          </div>
        )
      })}
      {fearGreed&&(()=>{
        const v = fearGreed.value
        const color = v<=25?'var(--red)':v<=45?'var(--gold)':v<=55?'var(--text3)':v<=75?'var(--green)':'#00ff88'
        return (
          <div className="card" style={{padding:'10px 14px',minWidth:100,flexShrink:0,borderLeft:`3px solid ${color}`}}>
            <div className="label" style={{marginBottom:4}}>Fear & Greed</div>
            <div className="mono" style={{fontSize:16,fontWeight:700,color}}>{v}</div>
            <div style={{fontSize:9,color,fontWeight:600,marginTop:2,whiteSpace:'nowrap'}}>{fearGreed.label}</div>
          </div>
        )
      })()}
    </div>
  )
}

function AllocBar({ positions }) {
  const total = positions.reduce((s,p)=>s+(p.curValue||0),0)
  const max = positions.length ? (positions[0].curValue||0) : 1
  return (
    <div className="card" style={{padding:'16px 18px'}}>
      <div className="label" style={{marginBottom:14}}>Alocare Portofoliu</div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {positions.map((p,i)=>{
          const pct = total>0&&p.curValue?(p.curValue/total)*100:0
          const barW = max>0?(p.curValue||0)/max*100:0
          return (
            <div key={p.broker+p.symbol} style={{display:'grid',gridTemplateColumns:'60px 1fr 40px',alignItems:'center',gap:10}}>
              <span className="mono" style={{fontSize:11,fontWeight:600,color:'var(--text)'}}>{p.symbol}</span>
              <div style={{height:5,background:'var(--surface2)',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${barW}%`,background:COLORS[i%COLORS.length],borderRadius:3,transition:'width 1s ease'}}/>
              </div>
              <span className="mono" style={{fontSize:10,color:'var(--text3)',textAlign:'right'}}>{pct.toFixed(1)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { getPortfolio, marketData, txs } = useStore()
  const { positions, cashByBroker } = useMemo(getPortfolio, [getPortfolio])
  const agg = useMemo(() => aggregatePositions(positions), [positions])
  const cashTotal = Object.values(cashByBroker).reduce((s,v)=>s+v,0)
  const totalWithCash = agg.totalCurValue + cashTotal
  const cashPct = totalWithCash > 0 ? (cashTotal/totalWithCash)*100 : 0

  const spData = marketData['^GSPC']
  const spChgToday = spData?.prev ? ((spData.price-spData.prev)/spData.prev)*100 : null

  return (
    <div className="fade-up">
      <MarketTicker />

      {/* Stat cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:20}}>
        <StatCard delay={1} label="Valoare Totală" value={fmtC(agg.totalCurValue)} sub={`${positions.length} poziții`} accent="var(--blue)"/>
        <StatCard delay={2} label="Cost Investit" value={fmtC(agg.totalCostBasis)} sub={`${txs.filter(t=>t.type!=='DEPOSIT').length} tranzacții`} accent="var(--text3)"/>
        <StatCard delay={3} label="Profit Nerealizat" value={fmtC(agg.totalUnrealized)}
          sub={fmtPct(agg.uPct)} subClass={pnlClass(agg.totalUnrealized)+'mono'}
          accent={agg.totalUnrealized>=0?'var(--green)':'var(--red)'}/>
        <StatCard delay={4} label="Profit Realizat" value={fmtC(agg.totalRealized)}
          sub={fmtPct(agg.rPct)} subClass={pnlClass(agg.totalRealized)+'mono'}
          accent="var(--purple)"/>
        <StatCard delay={5} label="💵 Cash Total" value={fmtC(cashTotal)} sub={fmtPct(cashPct,false)+' din port.'} accent="var(--gold)"/>
      </div>

      {/* Charts + Alloc row */}
      {positions.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:20}}>
          <AllocBar positions={positions}/>

          {/* SP500 vs Portfolio comparison */}
          <div className="card" style={{padding:'16px 18px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div className="label">S&P 500 vs Portofoliu</div>
              <div style={{display:'flex',gap:12}}>
                {spChgToday!=null&&<span className="mono" style={{fontSize:11,color:spChgToday>=0?'var(--green)':'var(--red)',fontWeight:600}}>
                  SP {spChgToday>=0?'+':''}{spChgToday.toFixed(2)}%
                </span>}
                <span className="mono" style={{fontSize:11,color:agg.uPct>=0?'var(--green)':'var(--red)',fontWeight:600}}>
                  PTF {fmtPct(agg.uPct)}
                </span>
              </div>
            </div>
            <PriceChart symbol="^GSPC" height={180}/>
          </div>
        </div>
      )}

      {positions.length === 0 && (
        <div className="card" style={{padding:'60px 20px',textAlign:'center'}}>
          <div style={{fontSize:40,marginBottom:12}}>📊</div>
          <div style={{fontWeight:600,fontSize:16,marginBottom:6}}>Nicio poziție încă</div>
          <div style={{color:'var(--text3)',fontSize:13}}>Adaugă tranzacții sau importă din Excel.</div>
        </div>
      )}
    </div>
  )
}
