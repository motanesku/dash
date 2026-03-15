import { useMemo, useState, useEffect } from 'react'
import useStore from '../lib/store.js'
import { requestNotificationPermission } from '../lib/notifications.js'
import { loadAlerts, checkAndNotify } from '../lib/alerts.js'
import FearGreedBanner from '../components/FearGreedBanner.jsx'
import MarketCards from '../components/MarketCards.jsx'
import MarketStatus from '../components/MarketStatus.jsx'
import PerformanceChart from '../components/PerformanceChart.jsx'
import SectorPieChart from '../components/SectorPieChart.jsx'
import { calcPortfolio, aggregatePositions, fmtC, fmtPct, pnlClass } from '../lib/portfolio.js'
import { fetchBetas, betaLabel, alphaLabel, calcPortfolioBeta } from '../lib/beta.js'
import { MARKET_SYMBOLS, fetchHistory } from '../lib/prices.js'
import CorrelationHeatmap from '../components/CorrelationHeatmap.jsx'

const COLORS = ['#58a6ff','#00d4aa','#a78bfa','#f0b429','#ff5572','#34d399','#fb923c','#60a5fa']

function Sparkline({ values, color, width=60, height=28 }) {
  if (!values || values.length < 2) return <div style={{ width, height }} />
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = i / (values.length - 1) * width
    const y = height - (v - min) / range * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(values.length-1)/(values.length-1)*width} cy={height-(values[values.length-1]-min)/range*height} r={2} fill={color} />
    </svg>
  )
}

function MarketCard({ sym, label, d, history }) {
  const chg = d?.prev ? ((d.price - d.prev) / d.prev) * 100 : null
  const isPos = chg == null || chg >= 0
  const color = isPos ? 'var(--green)' : 'var(--red)'
  const sparkVals = history?.length > 1 ? history.map(p => p.close) : (d && d.prev ? [d.prev, d.price] : null)
  return (
    <div className="card" style={{ padding:'10px 14px',minWidth:110,flexShrink:0,transition:'transform .15s, box-shadow .15s',borderLeft:`2px solid ${color}` }}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow)'}}
      onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4 }}>
        <div className="label">{label}</div>
        {sparkVals && <Sparkline values={sparkVals} color={color} />}
      </div>
      <div className="mono" style={{ fontSize:13,fontWeight:700,color:'var(--text)' }}>
        {d?(()=>{try{const dg=(sym==='^VIX'||sym==='EURUSD=X'||sym==='RON=X')?4:2;return new Intl.NumberFormat('ro-RO',{minimumFractionDigits:dg,maximumFractionDigits:dg}).format(d.price)}catch{return d.price?.toFixed(2)??'—'}})():'—'}
      </div>
      {chg!=null&&<div className="mono" style={{fontSize:10,color,marginTop:2,fontWeight:600}}>{chg>=0?'+':''}{chg.toFixed(2)}%</div>}
    </div>
  )
}

function MarketTicker() {
  const marketData = useStore(s => s.marketData)
  const [histories, setHistories] = useState({})
  useEffect(() => {
    ['^GSPC','^IXIC','^DJI'].forEach(sym => {
      fetchHistory(sym, '5d').then(pts => { if (pts?.length) setHistories(h => ({...h,[sym]:pts})) }).catch(()=>{})
    })
  }, [])
  return (
    <div style={{ display:'flex',gap:8,overflowX:'auto',WebkitOverflowScrolling:'touch',paddingBottom:4,marginBottom:16 }}>
      {MARKET_SYMBOLS.map(({sym,label}) => <MarketCard key={sym} sym={sym} label={label} d={marketData[sym]} history={histories[sym]} />)}
    </div>
  )
}

function StatCard({ label, value, sub, subClass, accent, delay=0 }) {
  return (
    <div className={`card fade-up delay-${delay}`} style={{ padding:'18px 20px',borderLeft:`3px solid ${accent||'var(--border)'}`,position:'relative',overflow:'hidden' }}>
      <div style={{ position:'absolute',top:0,right:0,width:60,height:60,borderRadius:'50%',background:`${accent||'transparent'}18`,transform:'translate(20px,-20px)' }}/>
      <div className="label" style={{ marginBottom:8 }}>{label}</div>
      <div className="mono" style={{ fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:4 }}>{value}</div>
      {sub && <div className={`mono ${subClass||''}`} style={{ fontSize:12 }}>{sub}</div>}
    </div>
  )
}

function AllocChart({ positions }) {
  const total = positions.reduce((s,p) => s+(p.curValue||0), 0)
  const max = positions[0]?.curValue || 1
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
      {positions.map((p,i) => {
        const pct = total>0&&p.curValue ? (p.curValue/total)*100 : 0
        const barW = max>0 ? (p.curValue||0)/max*100 : 0
        return (
          <div key={p.broker+p.symbol} style={{ display:'grid',gridTemplateColumns:'64px 1fr 44px',alignItems:'center',gap:10 }}>
            <span className="mono" style={{ fontSize:11,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{p.symbol}</span>
            <div style={{ height:6,background:'var(--surface2)',borderRadius:3,overflow:'hidden' }}>
              <div style={{ height:'100%',width:`${barW}%`,background:COLORS[i%COLORS.length],borderRadius:3,transition:'width 1.2s cubic-bezier(.4,0,.2,1)' }}/>
            </div>
            <span className="mono" style={{ fontSize:10,color:'var(--text3)',textAlign:'right' }}>{pct.toFixed(1)}%</span>
          </div>
        )
      })}
    </div>
  )
}

function MonthlyChart({ txs, prices }) {
  const data = useMemo(() => {
    if (!txs.length) return []
    const first = new Date(txs.map(t=>t.date).sort()[0])
    const now = new Date()
    const months = []
    let cur = new Date(first.getFullYear(), first.getMonth(), 1)
    while (cur<=now) { months.push(new Date(cur)); cur=new Date(cur.getFullYear(),cur.getMonth()+1,1) }
    return months.map(month => {
      const end = new Date(month.getFullYear(), month.getMonth()+1, 0)
      const snap = txs.filter(t => new Date(t.date)<=end && t.type!=='DEPOSIT')
      const pos = {}
      snap.forEach(t => {
        if (!pos[t.symbol]) pos[t.symbol]={shares:0,cost:0}
        if (t.type==='BUY') { pos[t.symbol].shares+=t.shares; pos[t.symbol].cost+=t.shares*t.price }
        else if (t.type==='SELL') { const a=pos[t.symbol].shares>0?pos[t.symbol].cost/pos[t.symbol].shares:t.price; pos[t.symbol].shares-=t.shares; pos[t.symbol].cost-=a*t.shares }
      })
      const val = Object.entries(pos).reduce((s,[sym,p])=>s+p.shares*(prices[sym]?.price||0),0)
      const cost = Object.values(pos).reduce((s,p)=>s+p.cost,0)
      return { label:`${month.toLocaleString('ro-RO',{month:'short'})} ${month.getFullYear().toString().slice(2)}`, val, cost }
    })
  }, [txs, prices])
  if (!data.length) return <div style={{ color:'var(--text3)',fontSize:12,textAlign:'center',padding:40 }}>Date insuficiente</div>
  const W=500,H=160,PL=8,PR=8,PT=10,PB=24,cW=W-PL-PR,cH=H-PT-PB
  const maxVal=Math.max(...data.map(d=>d.val),1)
  const barW=Math.min(cW/data.length-3,28)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:'visible' }}>
      {data.map((d,i) => {
        const x=PL+i*(cW/data.length)+(cW/data.length-barW)/2
        const bH=Math.max(d.val/maxVal*cH,2)
        const y=PT+cH-bH
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bH} fill={d.val>=d.cost?'var(--green)':'var(--red)'} rx={3} opacity={.85}/>
            {i%Math.ceil(data.length/6)===0&&<text x={x+barW/2} y={H-4} textAnchor="middle" fontSize={8} fill="var(--text3)" fontFamily="var(--mono)">{d.label}</text>}
          </g>
        )
      })}
    </svg>
  )
}

function SkeletonCard() {
  return (
    <div className="card" style={{ padding:'18px 20px' }}>
      <div className="skeleton" style={{ height:10,width:80,marginBottom:12 }}/>
      <div className="skeleton" style={{ height:22,width:120,marginBottom:8 }}/>
      <div className="skeleton" style={{ height:12,width:60 }}/>
    </div>
  )
}

// ── Sharpe Ratio (simplified, pe returnuri zilnice disponibile) ─
function calcSharpe(positions, betas) {
  // Folosim beta ca proxy pentru volatilitate dacă nu avem returnuri istorice
  // Sharpe simplificat: uPct_anualizat / (beta * stdev_SP500)
  // Returnam null dacă nu avem date suficiente
  return null // placeholder — override mai jos cu calcul real
}

// ── Portfolio Summary Component ─────────────────────────────
function PortfolioSummary({ agg, positions, closedPositions, cashTotal, cashPct, portfolioBeta, betas }) {
  const [sharpe, setSharpe] = useState(null)
  const [spHistory, setSpHistory] = useState(null)

  // Calculăm Sharpe din returnuri SP500 + portofoliu (aproximat pe costBasis)
  useEffect(() => {
    fetchHistory('^GSPC', '1y').then(pts => setSpHistory(pts)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!spHistory || !positions.length) return
    // Returnuri zilnice SP500
    const spRets = spHistory.slice(1).map((p, i) => (p.close - spHistory[i].close) / spHistory[i].close)
    if (spRets.length < 30) return
    const meanSp  = spRets.reduce((s, v) => s + v, 0) / spRets.length
    const stdSp   = Math.sqrt(spRets.reduce((s, v) => s + (v - meanSp) ** 2, 0) / spRets.length)
    // P&L% portofoliu anualizat
    const totalInv = agg.totalCostBasis + cashTotal
    const totalVal = agg.totalCurValue  + cashTotal
    const retAnn   = totalInv > 0 ? (totalVal - totalInv) / totalInv : 0
    // Risk-free rate ~4.5% anual (~0.018% zilnic)
    const rf = 0.045
    // Std portofoliu ≈ beta × std SP500 × sqrt(252)
    const beta  = portfolioBeta ?? 1
    const stdAnn = beta * stdSp * Math.sqrt(252)
    if (stdAnn === 0) return
    const s = (retAnn - rf) / stdAnn
    setSharpe(parseFloat(s.toFixed(2)))
  }, [spHistory, positions, agg, cashTotal, portfolioBeta])

  const totalInvested = agg.totalCostBasis + cashTotal
  const totalActual   = agg.totalCurValue  + cashTotal
  const pnlReal       = totalActual - totalInvested
  const pnlPct        = totalInvested > 0 ? (pnlReal / totalInvested) * 100 : 0
  const pnlPositive   = pnlReal >= 0
  const pnlColor      = pnlPositive ? 'var(--green)' : 'var(--red)'
  const pnlArrow      = pnlPositive ? '▲' : '▼'

  // Top 3 concentrare
  const totalStocuri = positions.reduce((s, p) => s + (p.curValue || 0), 0)
  const sortedByVal  = [...positions].sort((a, b) => (b.curValue || 0) - (a.curValue || 0))
  const top3         = sortedByVal.slice(0, 3)
  const top3Pct      = top3.reduce((s, p) => s + (p.curValue || 0), 0) / (totalActual || 1) * 100

  // Best & Worst (pe % nerealizat)
  const withPct = positions.filter(p => p.unrealizedPct != null)
  const best    = withPct.length ? withPct.reduce((a, b) => (b.unrealizedPct > a.unrealizedPct ? b : a)) : null
  const worst   = withPct.length ? withPct.reduce((a, b) => (b.unrealizedPct < a.unrealizedPct ? b : a)) : null

  // Sharpe label
  function sharpeLabel(s) {
    if (s == null) return { text: 'Se calculează...', color: 'var(--text3)' }
    if (s > 2)    return { text: 'Excelent',   color: 'var(--green)',  emoji: '🏆' }
    if (s > 1)    return { text: 'Bun',         color: '#34d399',       emoji: '✅' }
    if (s > 0)    return { text: 'Acceptabil',  color: '#f0b429',       emoji: '📊' }
    if (s > -1)   return { text: 'Slab',        color: '#fb923c',       emoji: '⚠️' }
    return               { text: 'Negativ',     color: 'var(--red)',    emoji: '🔻' }
  }

  const betaLbl   = portfolioBeta != null ? betaLabel(portfolioBeta) : null
  const sharpeLbl = sharpeLabel(sharpe)

  if (!positions.length && cashTotal === 0) return null

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Titlu */}
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          📋 Sumar Portofoliu
        </span>
        {positions.length > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            · {[...new Set(positions.map(p => p.symbol))].length} tickere deschise
          </span>
        )}
      </div>

      {/* ── Rând 1: Card principal ── */}
      <div className="card fade-up" style={{
        padding: '18px 20px', marginBottom: 10,
        borderLeft: `3px solid ${pnlColor}`,
        background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)',
              fontWeight: 600, letterSpacing: '.06em', marginBottom: 6 }}>TOTAL INVESTIT</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
              {fmtC(totalInvested)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--mono)' }}>
              {positions.length} stocuri · {fmtC(cashTotal)} cash
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)',
              fontWeight: 600, letterSpacing: '.06em', marginBottom: 6 }}>VALOARE ACTUALĂ</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
              {fmtC(totalActual)}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700,
              color: pnlColor, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              <span>{pnlArrow}</span>
              <span>{fmtC(Math.abs(pnlReal))}</span>
              <span style={{ fontSize: 11, opacity: .85 }}>({pnlPositive ? '+' : '-'}{Math.abs(pnlPct).toFixed(2)}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Rând 2: Nerealizat / Realizat / Cash ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        {/* Nerealizat */}
        <div className="card" style={{ padding: '12px 14px', borderLeft: `2px solid ${agg.totalUnrealized >= 0 ? 'var(--green)' : 'var(--red)'}` }}>
          <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', fontWeight: 600, letterSpacing: '.05em', marginBottom: 5 }}>NEREALIZAT</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700,
            color: agg.totalUnrealized >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {fmtC(agg.totalUnrealized)}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, marginTop: 3,
            color: agg.totalUnrealized >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {agg.uPct >= 0 ? '+' : ''}{agg.uPct.toFixed(2)}%
          </div>
        </div>

        {/* Realizat */}
        <div className="card" style={{ padding: '12px 14px', borderLeft: '2px solid var(--purple)' }}>
          <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', fontWeight: 600, letterSpacing: '.05em', marginBottom: 5 }}>
            REALIZAT <span style={{ fontSize: 8, opacity: .6 }}>(info)</span>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700,
            color: agg.totalRealized >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {fmtC(agg.totalRealized)}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, marginTop: 3,
            color: agg.totalRealized >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {agg.rPct >= 0 ? '+' : ''}{agg.rPct.toFixed(2)}%
          </div>
        </div>

        {/* Cash */}
        <div className="card" style={{ padding: '12px 14px', borderLeft: '2px solid var(--gold)' }}>
          <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', fontWeight: 600, letterSpacing: '.05em', marginBottom: 5 }}>💵 CASH</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>
            {fmtC(cashTotal)}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
            {cashPct.toFixed(1)}% port.
          </div>
        </div>
      </div>

      {/* ── Titlu Analiză ── */}
      {positions.length > 0 && (
        <>
          <div style={{ marginBottom: 8, marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              🔬 Metrici Risc
            </span>
          </div>

          {/* ── Rând 3: Beta + Sharpe (card mic x2) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            {/* Beta */}
            <div className="card" style={{ padding: '12px 14px', borderLeft: `2px solid ${betaLbl?.color || 'var(--border)'}` }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', fontWeight: 600, letterSpacing: '.05em', marginBottom: 5 }}>BETA PORTOFOLIU</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: betaLbl?.color || 'var(--text)' }}>
                β {portfolioBeta != null ? portfolioBeta.toFixed(2) : '—'}
              </div>
              <div style={{ fontSize: 10, color: betaLbl?.color || 'var(--text3)', marginTop: 3 }}>
                {betaLbl ? `${betaLbl.emoji} ${betaLbl.text}` : '—'}
              </div>
            </div>

            {/* Sharpe */}
            <div className="card" style={{ padding: '12px 14px', borderLeft: `2px solid ${sharpeLbl.color}` }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', fontWeight: 600, letterSpacing: '.05em', marginBottom: 5 }}>SHARPE RATIO</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: sharpeLbl.color }}>
                {sharpe != null ? sharpe.toFixed(2) : '—'}
              </div>
              <div style={{ fontSize: 10, color: sharpeLbl.color, marginTop: 3 }}>
                {sharpeLbl.emoji ? `${sharpeLbl.emoji} ${sharpeLbl.text}` : sharpeLbl.text}
              </div>
            </div>
          </div>

          {/* ── Rând 4: Best + Worst ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div className="card" style={{ padding: '12px 14px', borderLeft: '2px solid var(--green)' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', fontWeight: 600, letterSpacing: '.05em', marginBottom: 5 }}>🏆 BEST</div>
              {best ? <>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{best.symbol}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--green)', fontWeight: 600, marginTop: 3 }}>
                  +{best.unrealizedPct.toFixed(2)}% · {fmtC(best.unrealizedPnl)}
                </div>
              </> : <div style={{ color: 'var(--text3)', fontSize: 11 }}>—</div>}
            </div>

            <div className="card" style={{ padding: '12px 14px', borderLeft: '2px solid var(--red)' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', fontWeight: 600, letterSpacing: '.05em', marginBottom: 5 }}>📉 WORST</div>
              {worst ? <>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{worst.symbol}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--red)', fontWeight: 600, marginTop: 3 }}>
                  {worst.unrealizedPct.toFixed(2)}% · {fmtC(worst.unrealizedPnl)}
                </div>
              </> : <div style={{ color: 'var(--text3)', fontSize: 11 }}>—</div>}
            </div>
          </div>

          {/* ── Rând 5: Concentrare TOP 3 (card lat) ── */}
          <div className="card" style={{ padding: '12px 16px', borderLeft: '2px solid var(--blue)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', fontWeight: 600, letterSpacing: '.05em' }}>
                📊 CONCENTRARE TOP 3
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: top3Pct > 60 ? 'var(--red)' : top3Pct > 40 ? '#f0b429' : 'var(--green)',
                fontWeight: 600 }}>
                {top3Pct.toFixed(1)}% din port.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {top3.map((p, i) => {
                const pct = totalActual > 0 ? (p.curValue || 0) / totalActual * 100 : 0
                const barW = top3[0]?.curValue > 0 ? (p.curValue || 0) / top3[0].curValue * 100 : 0
                const colors = ['#58a6ff', '#00d4aa', '#a78bfa']
                return (
                  <div key={p.symbol} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 36px', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{p.symbol}</span>
                    <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barW}%`, background: colors[i], borderRadius: 3, transition: 'width 1s ease' }}/>
                    </div>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textAlign: 'right' }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function Dashboard() {
  const txs = useStore(s => s.txs)
  const prices = useStore(s => s.prices)
  const fearGreed = useStore(s => s.fearGreed)
  const marketData = useStore(s => s.marketData)
  const vix = marketData?.['^VIX']?.price ?? null
  const companyInfo = useStore(s => s.companyInfo)
  const cloudLoading = useStore(s => s.cloudLoading)
  const pricesLoading = useStore(s => s.pricesLoading)
  const hasCachedData = Object.keys(prices).length>0 || txs.length>0
  const isFirstLoad = cloudLoading && !hasCachedData
  const [chartTab, setChartTab] = useState('perf')
  const [notifPerm, setNotifPerm] = useState(typeof Notification!=='undefined' ? Notification.permission : 'unsupported')

  useEffect(() => {
    if (notifPerm !== 'granted') return
    const alerts = loadAlerts()
    if (!Object.keys(alerts).length) return
    checkAndNotify(prices, marketData, alerts)
  }, [prices])

  async function handleEnableNotif() {
    const perm = await requestNotificationPermission()
    setNotifPerm(perm)
  }

  const { positions, closedPositions, cashByBroker } = useMemo(() => calcPortfolio(txs, prices), [txs, prices])
  const agg = useMemo(() => aggregatePositions(positions, closedPositions), [positions, closedPositions])
  const cashTotal = Object.values(cashByBroker).reduce((s,v) => s+v, 0)
  const [betas, setBetas] = useState({})
  useEffect(() => {
    const syms = [...new Set(positions.map(p => p.symbol))]
    if (!syms.length) return
    fetchBetas(syms).then(b => setBetas(b)).catch(() => {})
  }, [positions.map(p=>p.symbol).join(',')])
  const portfolioBeta = useMemo(() => calcPortfolioBeta(positions, betas), [positions, betas])
  const totalWithCash = agg.totalCurValue + cashTotal
  const cashPct = totalWithCash>0 ? (cashTotal/totalWithCash)*100 : 0

  const CHART_TABS = [
    {id:'perf',label:'📈 Performanță'},
    {id:'alloc',label:'▦ Alocare'},
    {id:'monthly',label:'📊 Lunar'},
    {id:'sectors',label:'🥧 Sectoare'},
    {id:'corr',label:'🔗 Corelații'},
  ]

  return (
    <div className="fade-up">
      {notifPerm==='default' && 'Notification' in window && (
        <div onClick={handleEnableNotif} style={{
          display:'flex',alignItems:'center',gap:8,marginBottom:10,
          padding:'8px 14px',borderRadius:8,border:'1px solid var(--border2)',
          background:'var(--surface)',cursor:'pointer',
          fontSize:11,color:'var(--text2)',fontFamily:'var(--mono)',
        }}>🔔 Activează notificări</div>
      )}

      {pricesLoading && hasCachedData && (
        <div style={{
          position:'fixed',bottom:20,right:20,zIndex:99,background:'var(--surface)',border:'1px solid var(--border2)',
          borderRadius:8,padding:'8px 14px',display:'flex',alignItems:'center',gap:8,
          fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)',boxShadow:'var(--shadow)',
        }}>
          <span style={{animation:'pulse 1s infinite',display:'inline-block'}}>⟳</span> actualizare...
        </div>
      )}

      <MarketStatus />
      <FearGreedBanner fearGreed={fearGreed} vix={vix} />
      <MarketCards prices={{...prices,...marketData}} />

      {/* ── Sumar Portofoliu ── */}
      <PortfolioSummary
        agg={agg}
        positions={positions}
        closedPositions={closedPositions}
        cashTotal={cashTotal}
        cashPct={cashPct}
        portfolioBeta={portfolioBeta}
        betas={betas}
      />

      {positions.length>0 && (
        <div className="card fade-up delay-5" style={{ padding:'16px 18px',marginBottom:20 }}>
          <div style={{ display:'flex',gap:5,marginBottom:14,borderBottom:'1px solid var(--border)',paddingBottom:12,overflowX:'auto',WebkitOverflowScrolling:'touch' }}>
            {CHART_TABS.map(t => (
              <button key={t.id} onClick={()=>setChartTab(t.id)} style={{
                padding:'5px 10px',borderRadius:6,border:'none',cursor:'pointer',flexShrink:0,
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
          {chartTab==='corr'    && <CorrelationHeatmap positions={positions}/>}
        </div>
      )}

      {isFirstLoad && (
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12 }}>
          {[1,2,3,4,5].map(i => <SkeletonCard key={i}/>)}
        </div>
      )}
      {positions.length===0 && !isFirstLoad && (
        <div className="card" style={{ padding:'60px 20px',textAlign:'center' }}>
          <div style={{ fontSize:40,marginBottom:12 }}>📊</div>
          <div style={{ fontWeight:600,fontSize:16,marginBottom:6 }}>Nicio poziție încă</div>
          <div style={{ color:'var(--text3)',fontSize:13 }}>Adaugă tranzacții sau importă din Excel.</div>
        </div>
      )}
    </div>
  )
}

