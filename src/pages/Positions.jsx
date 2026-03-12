import { useMemo, useState, useEffect } from 'react'
import useStore from '../lib/store.js'
import { calcPortfolio, fmtC, fmtPct, pnlClass, fmtDate } from '../lib/portfolio.js'
import PriceChart from '../components/PriceChart.jsx'
import CompanyEditModal from '../components/CompanyEditModal.jsx'
import { CompanyInfoCard, SECTOR_ICONS, CAP_COLORS as CAP_COLORS_NEW, CAPS, SECTORS } from '../components/CompanyInfoSection.jsx'
import Sparkline from '../components/Sparkline.jsx'
import AlertModal from '../components/AlertModal.jsx'
import { loadAlerts } from '../lib/alerts.js'

const BROKER_COLORS = ['#58a6ff','#f0b429','#00d4aa','#a78bfa','#ff5572','#fb923c']
const CAP_COLORS    = { 'Large Cap':'var(--blue)', 'Mid Cap':'var(--green)', 'Small Cap':'var(--gold)', 'Micro Cap':'var(--red)' }
const STICKY   = { position:'sticky', left:0, zIndex:2, background:'var(--surface)' }
const STICKY_H = { position:'sticky', left:0, zIndex:3, background:'var(--bg2)' }

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

// Aggregate positions with same symbol across brokers
function aggregateBySymbol(positions) {
  const map = {}
  positions.forEach(p => {
    if (!map[p.symbol]) {
      map[p.symbol] = { ...p, brokers: [p.broker] }
    } else {
      const e = map[p.symbol]
      const newShares   = e.shares + p.shares
      const newCost     = e.costBasis + p.costBasis
      const newCurValue = (e.curValue||0) + (p.curValue||0)
      const newUnr      = (e.unrealizedPnl||0) + (p.unrealizedPnl||0)
      const newReal     = e.realizedPnl + p.realizedPnl
      map[p.symbol] = {
        ...e,
        shares:        newShares,
        costBasis:     newCost,
        curValue:      newCurValue,
        unrealizedPnl: newUnr,
        unrealizedPct: newCost > 0 ? (newUnr / newCost) * 100 : null,
        realizedPnl:   newReal,
        avgPrice:      newShares > 0 ? newCost / newShares : 0,
        dayChange:     p.dayChange,
        brokers:       [...e.brokers, p.broker],
      }
    }
  })
  return Object.values(map).sort((a,b) => (b.curValue||0) - (a.curValue||0))
}

// ── Mobile Position Card ─────────────────────────────────────
function MobilePositionCard({ p, companyInfo, brokers, isAdmin, onEditInfo, onSelect, selected, children }) {
  const info = companyInfo[p.symbol] || {}
  const brokerList = p.brokers || [p.broker]
  const unrColor = (p.unrealizedPnl||0) >= 0 ? 'var(--green)' : 'var(--red)'
  const dayColor = (p.dayChange||0) >= 0 ? 'var(--green)' : 'var(--red)'

  return (
    <div style={{marginBottom:10}}>
      <div style={{
        background:'var(--surface)',border:`1px solid ${selected?'var(--blue)':'var(--border)'}`,
        borderRadius:selected?'12px 12px 0 0':12,padding:'14px 16px',
        borderLeft:`3px solid ${unrColor}`,transition:'all .15s',
      }}>
        {/* Rând 1 — Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:16,color:'var(--text)'}}>{p.symbol}</span>
              {p.dayChange!=null && (
                <span style={{fontSize:11,fontWeight:600,color:dayColor,fontFamily:'var(--mono)'}}>
                  {p.dayChange>=0?'+':''}{p.dayChange.toFixed(2)}% azi
                </span>
              )}
            </div>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{p.name}</div>
            <div style={{display:'flex',gap:4,marginTop:4,flexWrap:'wrap'}}>
              {brokerList.map(b => (
                <span key={b} style={{fontSize:9,padding:'1px 5px',borderRadius:4,background:'var(--surface2)',
                  color:BROKER_COLORS[brokers.indexOf(b)%BROKER_COLORS.length],border:'1px solid var(--border)',fontWeight:600}}>
                  {b}
                </span>
              ))}
            </div>
          </div>
          {/* Valoare + unrealized */}
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:16,color:'var(--text)'}}>
              {p.curValue ? fmtC(p.curValue, p.currency) : '—'}
            </div>
            <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,color:unrColor}}>
              {p.unrealizedPnl!=null ? fmtC(p.unrealizedPnl,p.currency) : '—'}
            </div>
            <div style={{fontFamily:'var(--mono)',fontSize:11,color:unrColor}}>
              {p.unrealizedPct!=null ? fmtPct(p.unrealizedPct) : ''}
            </div>
          </div>
        </div>

        {/* Rând 2 — CAP | — | Current Price */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,padding:'8px 0',borderTop:'1px solid var(--border)',marginBottom:6}}>
          <div>
            <div style={{fontSize:9,color:'var(--text3)',marginBottom:2,fontWeight:600}}>CAP</div>
            <div style={{fontSize:11,color:CAP_COLORS_NEW[info.cap]||'var(--text3)',fontWeight:600}}>{info.cap||'—'}</div>
          </div>
          <div/>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:9,color:'var(--text3)',marginBottom:2,fontWeight:600}}>CUR PRICE</div>
            <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,color:'var(--text)'}}>{p.curPrice ? fmtC(p.curPrice,p.currency) : '—'}</div>
          </div>
        </div>

        {/* Rând 3 — Shares | Avg Price | Cost */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,padding:'8px 0',borderTop:'1px solid var(--border)',marginBottom:10}}>
          <div>
            <div style={{fontSize:9,color:'var(--text3)',marginBottom:2,fontWeight:600}}>SHARES</div>
            <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600}}>{p.shares.toFixed(4)}</div>
          </div>
          <div>
            <div style={{fontSize:9,color:'var(--text3)',marginBottom:2,fontWeight:600}}>AVG PRICE</div>
            <div style={{fontFamily:'var(--mono)',fontSize:12}}>{fmtC(p.avgPrice,p.currency)}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:9,color:'var(--text3)',marginBottom:2,fontWeight:600}}>COST</div>
            <div style={{fontFamily:'var(--mono)',fontSize:12}}>{fmtC(p.costBasis,p.currency)}</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>onSelect(p)} style={{
            flex:1,padding:'6px',borderRadius:6,border:'1px solid var(--border)',
            background:selected?'var(--blue-bg)':'var(--surface2)',
            color:selected?'var(--blue)':'var(--text3)',cursor:'pointer',fontSize:11,fontWeight:600,
          }}>
            {selected ? '▲ Ascunde chart' : '📈 Chart'}
          </button>
          {isAdmin && (
            <button onClick={()=>onEditInfo(p.symbol)} style={{
              padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',
              background:'var(--surface2)',color:'var(--text3)',cursor:'pointer',fontSize:11,
            }}>✏</button>
          )}
        </div>
      </div>

      {/* Chart apare direct sub card, nu la finalul paginii */}
      {selected && (
        <div style={{
          background:'var(--surface)',border:'1px solid var(--blue)',borderTop:'none',
          borderRadius:'0 0 12px 12px',padding:'14px 16px',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Mobile Closed Position Card ───────────────────────────────
function MobileClosedCard({ p, companyInfo, isAdmin, onEditInfo }) {
  const info = companyInfo[p.symbol] || {}
  const profitColor = p.totalProfit >= 0 ? 'var(--green)' : 'var(--red)'

  return (
    <div style={{
      background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,
      padding:'14px 16px',marginBottom:10,
      borderLeft:`3px solid ${profitColor}`,
    }}>
      {/* Rând 1 — Header: Symbol + Profit + ROI */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
        <div>
          <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:16,color:'var(--text)'}}>{p.symbol}</div>
          <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{p.name}</div>
          <div style={{display:'flex',gap:4,marginTop:4,flexWrap:'wrap'}}>
            <span style={{fontSize:9,padding:'1px 5px',borderRadius:4,background:'var(--surface2)',color:'var(--text3)',border:'1px solid var(--border)',fontWeight:600}}>{p.broker}</span>
            {info.sector && <span style={{fontSize:9,padding:'1px 5px',borderRadius:4,background:'var(--surface2)',color:'var(--blue)',border:'1px solid var(--border)'}}>
              {SECTOR_ICONS[info.sector]||''} {info.sector}
            </span>}
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:16,color:profitColor}}>
            {fmtC(p.totalProfit)}
          </div>
          <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,color:profitColor}}>
            {fmtPct(p.roi)}
          </div>
          <div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>{p.lastDate ? `închis ${fmtDate(p.lastDate)}` : ''}</div>
        </div>
      </div>

      {/* Rând BUY */}
      <div style={{padding:'8px 10px',borderRadius:6,background:'rgba(88,166,255,0.06)',border:'1px solid rgba(88,166,255,0.15)',marginBottom:6}}>
        <div style={{fontSize:9,color:'var(--blue)',fontWeight:700,marginBottom:6,letterSpacing:.5}}>BUY</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
          <div>
            <div style={{fontSize:9,color:'var(--text3)',marginBottom:2,fontWeight:600}}>SHARES</div>
            <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600}}>{p.totalShares.toFixed(4)}</div>
          </div>
          <div>
            <div style={{fontSize:9,color:'var(--text3)',marginBottom:2,fontWeight:600}}>AVG BUY</div>
            <div style={{fontFamily:'var(--mono)',fontSize:12}}>{fmtC(p.avgBuyPrice)}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:9,color:'var(--text3)',marginBottom:2,fontWeight:600}}>COST</div>
            <div style={{fontFamily:'var(--mono)',fontSize:12}}>{fmtC(p.totalCost)}</div>
          </div>
        </div>
      </div>

      {/* Rând SELL */}
      <div style={{padding:'8px 10px',borderRadius:6,background:p.totalProfit>=0?'rgba(0,212,170,0.06)':'rgba(255,85,114,0.06)',border:`1px solid ${p.totalProfit>=0?'rgba(0,212,170,0.15)':'rgba(255,85,114,0.15)'}`}}>
        <div style={{fontSize:9,color:profitColor,fontWeight:700,marginBottom:6,letterSpacing:.5}}>SELL</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
          <div>
            <div style={{fontSize:9,color:'var(--text3)',marginBottom:2,fontWeight:600}}>SHARES</div>
            <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600}}>{p.totalShares.toFixed(4)}</div>
          </div>
          <div>
            <div style={{fontSize:9,color:'var(--text3)',marginBottom:2,fontWeight:600}}>AVG SELL</div>
            <div style={{fontFamily:'var(--mono)',fontSize:12,color:profitColor,fontWeight:600}}>{fmtC(p.avgSellPrice)}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:9,color:'var(--text3)',marginBottom:2,fontWeight:600}}>ÎNCASAT</div>
            <div style={{fontFamily:'var(--mono)',fontSize:12,color:profitColor,fontWeight:600}}>{fmtC(p.totalRevenue)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Positions({ onEditTx }) {
  const txs          = useStore(s => s.txs)
  const prices       = useStore(s => s.prices)
  const brokerTab    = useStore(s => s.brokerTab)
  const setBrokerTab = useStore(s => s.setBrokerTab)
  const brokers      = useStore(s => s.brokers)
  const isAdmin      = useStore(s => s.isAdmin)
  const companyInfo       = useStore(s => s.companyInfo)
  const fetchCompanyInfo  = useStore(s => s.fetchCompanyInfo)
  const isMobile = useIsMobile()

  const { positions, closedPositions, cashByBroker } = useMemo(() => calcPortfolio(txs, prices), [txs, prices])
  const [selectedPos, setSelectedPos] = useState(null)
  const [alertSym, setAlertSym] = useState(null)
  const alerts = loadAlerts()
  const [alertSym, setAlertSym] = useState(null)
  const alerts = loadAlerts()
  const [editInfoSym, setEditInfoSym]   = useState(null)
  const [sortBy, setSortBy]           = useState('value')
  const [view, setView]               = useState('open')

  // Per-broker stats
  const brokerStats = useMemo(() => {
    const stats = {}
    brokers.forEach(b => {
      const bPos  = positions.filter(p => p.broker === b)
      const bVal  = bPos.reduce((s,p) => s + (p.curValue||0), 0)
      const bCost = bPos.reduce((s,p) => s + p.costBasis, 0)
      const bUnr  = bPos.reduce((s,p) => s + (p.unrealizedPnl||0), 0)
      stats[b] = {
        val: bVal, cost: bCost, unrealized: bUnr,
        cash: cashByBroker[b] || 0,
        roi: bCost > 0 ? (bUnr / bCost) * 100 : null,
        count: bPos.length,
      }
    })
    return stats
  }, [brokers, positions, cashByBroker])

  const totalCash = Object.values(cashByBroker).reduce((s,v) => s+v, 0)

  // Filter by broker then aggregate same symbols
  const filteredOpen = useMemo(() => {
    const arr = brokerTab ? positions.filter(p => p.broker === brokerTab) : positions
    const agg = brokerTab ? arr : aggregateBySymbol(arr)
    return [...agg].sort((a,b) => {
      if (sortBy==='value')      return (b.curValue||0) - (a.curValue||0)
      if (sortBy==='unrealized') return (b.unrealizedPct||0) - (a.unrealizedPct||0)
      if (sortBy==='daychange')  return (b.dayChange||0) - (a.dayChange||0)
      return 0
    })
  }, [positions, brokerTab, sortBy])

  const filteredClosed = useMemo(() => {
    const arr = brokerTab ? closedPositions.filter(p => p.broker === brokerTab) : closedPositions
    return [...arr].sort((a,b) => b.totalProfit - a.totalProfit)
  }, [closedPositions, brokerTab])

  const totalVal        = filteredOpen.reduce((s,p) => s + (p.curValue||0), 0)
  const totalCost       = filteredOpen.reduce((s,p) => s + p.costBasis, 0)
  const totalUnrealized = filteredOpen.reduce((s,p) => s + (p.unrealizedPnl||0), 0)

  const SortBtn = ({val,label}) => (
    <button onClick={()=>setSortBy(val)} style={{
      padding:'3px 8px',borderRadius:4,border:'none',cursor:'pointer',fontSize:10,fontFamily:'var(--mono)',fontWeight:600,
      background:sortBy===val?'var(--blue)':'var(--surface2)',
      color:sortBy===val?'#fff':'var(--text3)',transition:'all .15s',
    }}>{label}</button>
  )

  return (
    <div className="fade-up">

      {/* Rând 1: Broker tabs + cash (desktop inline, mobile doar tabs) */}
      <div style={{display:'flex',gap:6,marginBottom:isMobile?6:14,overflowX:'auto',WebkitOverflowScrolling:'touch',paddingBottom:4,alignItems:'stretch'}}>

        {/* TOTAL tab */}
        <button onClick={()=>setBrokerTab(null)} style={{
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
          padding:isMobile?'6px 12px':'10px 18px',borderRadius:8,
          border:`2px solid ${!brokerTab?'var(--blue)':'var(--border2)'}`,
          background:!brokerTab?'var(--blue-bg)':'var(--surface)',
          color:!brokerTab?'var(--blue)':'var(--text3)',
          cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap',
          minWidth:isMobile?0:90,flexShrink:isMobile?1:0,flex:isMobile?1:undefined,
        }}>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{fontSize:isMobile?11:13,fontWeight:700}}>TOTAL</span>
            {totalCost>0 && <span className="mono" style={{fontSize:isMobile?10:12,fontWeight:700,color:!brokerTab?'inherit':totalUnrealized>=0?'var(--green)':'var(--red)'}}>
              {totalUnrealized>=0?'+':''}{(totalUnrealized/totalCost*100).toFixed(1)}%
            </span>}
          </div>
          <span style={{fontSize:isMobile?9:10,color:!brokerTab?'inherit':'var(--text3)',fontWeight:500,marginTop:1}}>
            {[...new Set(positions.map(p=>p.symbol))].length} tickere
          </span>
        </button>

        {/* Broker tabs */}
        {brokers.map((b,i) => {
          const st = brokerStats[b]
          const active = brokerTab === b
          const c = BROKER_COLORS[i%BROKER_COLORS.length]
          return (
            <button key={b} onClick={()=>setBrokerTab(b)} style={{
              display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
              padding:isMobile?'6px 12px':'10px 18px',borderRadius:8,
              border:`2px solid ${active?c:'var(--border2)'}`,
              background:active?`${c}15`:'var(--surface)',
              color:active?c:'var(--text3)',
              cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap',
              minWidth:isMobile?0:90,flexShrink:isMobile?1:0,flex:isMobile?1:undefined,
            }}>
              <div style={{display:'flex',alignItems:'center',gap:4}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:c,flexShrink:0}}/>
                <span style={{fontSize:isMobile?11:13,fontWeight:700}}>{b}</span>
                {st?.roi!=null && <span className="mono" style={{fontSize:isMobile?10:12,fontWeight:700,color:active?'inherit':st.roi>=0?'var(--green)':'var(--red)'}}>
                  {st.roi>=0?'+':''}{st.roi.toFixed(1)}%
                </span>}
              </div>
              <span style={{fontSize:isMobile?9:10,color:active?'inherit':'var(--text3)',fontWeight:500,marginTop:1}}>
                {st?.count||0} tickere
              </span>
            </button>
          )
        })}

        {/* Desktop: separator + cash inline */}
        {!isMobile && <>
          <div style={{width:1,background:'var(--border2)',margin:'4px 6px',flexShrink:0}}/>
          <div style={{
            display:'flex',flexDirection:'column',justifyContent:'center',padding:'10px 18px',
            background:'var(--gold-bg)',border:'1px solid rgba(240,180,41,0.25)',
            borderRadius:8,flexShrink:0,minWidth:90,
          }}>
            <div style={{fontSize:10,color:'rgba(240,180,41,0.7)',fontWeight:600,marginBottom:2}}>💵 CASH TOTAL</div>
            <div className="mono" style={{fontWeight:700,color:'var(--gold)',fontSize:14}}>{fmtC(totalCash)}</div>
          </div>
          {brokers.map((b,i) => {
            const cash = cashByBroker[b] || 0
            if (cash === 0) return null
            const c = BROKER_COLORS[i%BROKER_COLORS.length]
            return (
              <div key={b} style={{
                display:'flex',flexDirection:'column',justifyContent:'center',padding:'10px 18px',
                background:'var(--surface)',border:`1px solid ${c}40`,
                borderRadius:8,flexShrink:0,minWidth:90,
              }}>
                <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                  <span style={{width:6,height:6,borderRadius:'50%',background:c,flexShrink:0}}/>
                  <span style={{fontSize:10,color:'var(--text3)',fontWeight:600}}>{b} · CASH</span>
                </div>
                <div className="mono" style={{fontWeight:600,fontSize:14,color:c}}>{fmtC(cash)}</div>
              </div>
            )
          })}
        </>}
      </div>

      {/* Rând 2: Cash cards — doar pe mobile */}
      {isMobile && (
        <div style={{display:'flex',gap:6,marginBottom:14}}>
          <div style={{
            flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'6px 10px',
            background:'var(--gold-bg)',border:'1px solid rgba(240,180,41,0.25)',borderRadius:8,
          }}>
            <div style={{fontSize:9,color:'rgba(240,180,41,0.7)',fontWeight:600,marginBottom:1}}>💵 CASH TOTAL</div>
            <div className="mono" style={{fontWeight:700,color:'var(--gold)',fontSize:12}}>{fmtC(totalCash)}</div>
          </div>
          {brokers.map((b,i) => {
            const cash = cashByBroker[b] || 0
            if (cash === 0) return null
            const c = BROKER_COLORS[i%BROKER_COLORS.length]
            return (
              <div key={b} style={{
                flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'6px 10px',
                background:'var(--surface)',border:`1px solid ${c}40`,borderRadius:8,
              }}>
                <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:1}}>
                  <span style={{width:5,height:5,borderRadius:'50%',background:c,flexShrink:0}}/>
                  <span style={{fontSize:9,color:'var(--text3)',fontWeight:600}}>{b} · CASH</span>
                </div>
                <div className="mono" style={{fontWeight:600,fontSize:12,color:c}}>{fmtC(cash)}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Open / Closed toggle + sort */}
      <div style={{display:'flex',gap:6,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
        {[
          {id:'open',   label:`▶ Deschise (${brokerTab ? filteredOpen.length : [...new Set(positions.map(p=>p.symbol))].length})`},
          {id:'closed', label:`✓ Închise (${filteredClosed.length})`},
        ].map(t => (
          <button key={t.id} onClick={()=>setView(t.id)} style={{
            padding:'5px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,
            background:view===t.id?'var(--blue)':'var(--surface2)',
            color:view===t.id?'#fff':'var(--text3)',transition:'all .15s',
          }}>{t.label}</button>
        ))}
        {view==='open' && (
          <div style={{marginLeft:'auto',display:'flex',gap:5,alignItems:'center'}}>
            <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>SORT:</span>
            <SortBtn val="value"      label="VALOARE"/>
            <SortBtn val="unrealized" label="P&L%"/>
            <SortBtn val="daychange"  label="ZI%"/>
          </div>
        )}
      </div>

      {/* ── OPEN POSITIONS ── */}
      {view === 'open' && (
        isMobile ? (
          <div style={{marginBottom:16}}>
            {/* Total summary card pe mobile */}
            <div style={{
              background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,
              padding:'14px 16px',marginBottom:12,
            }}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:9,color:'var(--text3)',marginBottom:4,fontWeight:600,letterSpacing:.5}}>VALOARE</div>
                  <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13,color:'var(--text)'}}>{fmtC(totalVal)}</div>
                </div>
                <div style={{textAlign:'center',borderLeft:'1px solid var(--border)',borderRight:'1px solid var(--border)',paddingLeft:8,paddingRight:8}}>
                  <div style={{fontSize:9,color:'var(--text3)',marginBottom:4,fontWeight:600,letterSpacing:.5}}>NEREALIZAT</div>
                  <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13,color:totalUnrealized>=0?'var(--green)':'var(--red)'}}>
                    {fmtC(totalUnrealized)}
                  </div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:9,color:'var(--text3)',marginBottom:4,fontWeight:600,letterSpacing:.5}}>ROI</div>
                  <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13,color:totalUnrealized>=0?'var(--green)':'var(--red)'}}>
                    {totalCost>0?fmtPct(totalUnrealized/totalCost*100):'—'}
                  </div>
                </div>
              </div>
            </div>
            {filteredOpen.map(p => (
              <MobilePositionCard
                key={p.symbol+(p.broker||'')}
                p={p}
                companyInfo={companyInfo}
                brokers={brokers}
                isAdmin={isAdmin}
                onEditInfo={sym=>setEditInfoSym(sym)}
                onSelect={pos=>setSelectedPos(selectedPos?.symbol===pos.symbol?null:pos)}
                selected={selectedPos?.symbol===p.symbol}
              >
                <PriceChart symbol={p.symbol} height={200}/>
              </MobilePositionCard>
            ))}
          </div>
        ) : (
        <div className="card" style={{overflow:'hidden',marginBottom:16}}>
          <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
            <table className="data-table" style={{minWidth:720, tableLayout:'fixed', width:'100%'}}>
              <colgroup>
                <col style={{width:'20%'}}/>
                <col style={{width:'13%'}}/>
                <col style={{width:'10%'}}/>
                <col style={{width:'12%'}}/>
                <col style={{width:'12%'}}/>
                <col style={{width:'11%'}}/>
                <col style={{width:'11%'}}/>
                <col style={{width:'11%'}}/>
              </colgroup>
              <thead><tr>
                <th style={STICKY_H}>Symbol</th>
                <th style={{borderRight:'1px solid var(--border2)'}}>Sector · Cap</th>
                <th style={{textAlign:'right'}}>Shares</th>
                <th style={{textAlign:'right'}}>Avg Buy</th>
                <th style={{textAlign:'right', borderRight:'3px solid var(--border2)'}}>Cost Total</th>
                <th style={{textAlign:'right'}}>Preț azi</th>
                <th style={{textAlign:'right'}}>Nerealizat</th>
                <th style={{textAlign:'center',color:'var(--text3)',fontSize:10}}>30z</th>
              </tr></thead>
              <tbody>
                {filteredOpen.map(p => {
                  const info = companyInfo[p.symbol] || {}
                  const brokerList = p.brokers || [p.broker]
                  return (
                    <tr key={p.symbol+(p.broker||'')} style={{cursor:'pointer'}}
                      onClick={()=>setSelectedPos(selectedPos?.symbol===p.symbol?null:p)}>
                      <td style={{...STICKY, borderRight:'1px solid var(--border)'}}>
                        <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13,color:'var(--text)',display:'inline-flex',alignItems:'center',gap:4}}
                          onClick={e=>{if(!isAdmin)return;e.stopPropagation();setEditInfoSym(p.symbol)}}>
                          {p.symbol}{isAdmin&&<span style={{fontSize:9,color:'var(--text3)',opacity:0.5,cursor:'pointer'}}>✏</span>}
                        </div>
                        <div style={{fontSize:10,color:'var(--text3)',marginTop:1,lineHeight:1.3}}>{p.name}</div>
                        <div style={{display:'flex',gap:3,marginTop:3,flexWrap:'wrap'}}>
                          {brokerList.map(b=>(
                            <span key={b} style={{fontSize:9,padding:'1px 4px',borderRadius:3,background:'var(--surface2)',color:BROKER_COLORS[brokers.indexOf(b)%BROKER_COLORS.length],border:'1px solid var(--border)'}}>{b}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{borderRight:'1px solid var(--border2)'}}>
                        {info.sector&&<div style={{fontSize:10,color:'var(--blue)',fontWeight:500}}>{SECTOR_ICONS[info.sector]||''} {info.sector}</div>}
                        {info.cap&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:3,marginTop:3,display:'inline-block',background:'var(--surface2)',color:(CAP_COLORS_NEW[info.cap]||CAP_COLORS[info.cap]||'var(--text3)'),border:`1px solid ${CAP_COLORS_NEW[info.cap]||CAP_COLORS[info.cap]||'var(--border)'}40`,fontWeight:600}}>{info.cap}</span>}
                      </td>
                      <td style={{textAlign:'right'}}>
                        <div className="mono" style={{fontSize:12,fontWeight:600}}>{p.shares.toFixed(4)}</div>
                      </td>
                      <td style={{textAlign:'right'}}>
                        <div className="mono" style={{fontSize:12}}>{fmtC(p.avgPrice,p.currency)}</div>
                      </td>
                      <td style={{textAlign:'right', borderRight:'3px solid var(--border2)'}}>
                        <div className="mono" style={{fontSize:12,fontWeight:600}}>{fmtC(p.costBasis,p.currency)}</div>
                      </td>
                      <td style={{textAlign:'right'}}>
                        <div className="mono" style={{fontSize:12,fontWeight:600}}>{p.curPrice?fmtC(p.curPrice,p.currency):'—'}</div>
                        <div className={`mono ${pnlClass(p.dayChange)}`} style={{fontSize:10,marginTop:2}}>{p.dayChange!=null?fmtPct(p.dayChange):'—'}</div>
                      </td>
                      <td style={{textAlign:'right'}}>
                        <div className={`mono ${pnlClass(p.unrealizedPnl)}`} style={{fontSize:12,fontWeight:700}}>{p.unrealizedPnl!=null?fmtC(p.unrealizedPnl,p.currency):'—'}</div>
                        <div className={`mono ${pnlClass(p.unrealizedPct)}`} style={{fontSize:10,marginTop:2}}>{p.unrealizedPct!=null?fmtPct(p.unrealizedPct):'—'}</div>
                      </td>
                      <td style={{textAlign:'center',padding:'4px 6px'}}>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                          <Sparkline symbol={p.symbol} width={72} height={28} days={30} />
                          <button
                            onClick={e=>{e.stopPropagation();setAlertSym(p.symbol)}}
                            style={{
                              background:'none',border:'none',cursor:'pointer',
                              fontSize:12,padding:'1px 4px',borderRadius:4,
                              color: alerts[p.symbol]?.targetPrice||alerts[p.symbol]?.stopLoss||alerts[p.symbol]?.dayChangePct||alerts[p.symbol]?.vixPrag ? '#f0b429' : 'var(--text3)',
                              opacity:0.8,
                            }}
                            title="Configurează alerte"
                          >🔔</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={2} style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>TOTAL {brokerTab||'PORTOFOLIU'}</td>
                  <td/>
                  <td/>
                  <td style={{textAlign:'right', borderRight:'3px solid var(--border2)'}}>
                    <div className="mono" style={{fontSize:12,fontWeight:700,color:'var(--text)'}}>{fmtC(totalCost)}</div>
                  </td>
                  <td/>
                  <td style={{textAlign:'right'}}>
                    <div className={`mono ${pnlClass(totalUnrealized)}`} style={{fontWeight:700}}>{fmtC(totalUnrealized)}</div>
                    <div className={`mono ${pnlClass(totalUnrealized)}`} style={{fontSize:10}}>{totalCost>0?fmtPct(totalUnrealized/totalCost*100):''}</div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        )
      )}

      {/* ── CLOSED POSITIONS ── */}
      {view === 'closed' && (
        filteredClosed.length === 0 ? (
          <div className="card" style={{padding:'40px 20px',textAlign:'center',color:'var(--text3)',fontSize:13}}>
            Nicio poziție închisă{brokerTab ? ` pentru ${brokerTab}` : ''}.
          </div>
        ) : isMobile ? (
          <div style={{marginBottom:16}}>
            {/* Total closed summary */}
            {(()=>{
              const totalProfit = filteredClosed.reduce((s,p)=>s+p.totalProfit,0)
              const totalCostClosed = filteredClosed.reduce((s,p)=>s+p.totalCost,0)
              const roiClosed = totalCostClosed>0 ? totalProfit/totalCostClosed*100 : 0
              const profitColor = totalProfit>=0?'var(--green)':'var(--red)'
              return (
                <div style={{
                  background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,
                  padding:'14px 16px',marginBottom:12,
                }}>
                  <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,letterSpacing:.5,marginBottom:8}}>
                    TOTAL ÎNCHISE ({filteredClosed.length})
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:9,color:'var(--text3)',marginBottom:4,fontWeight:600,letterSpacing:.5}}>COST</div>
                      <div style={{fontFamily:'var(--mono)',fontWeight:600,fontSize:12,color:'var(--text)'}}>{fmtC(totalCostClosed)}</div>
                    </div>
                    <div style={{textAlign:'center',borderLeft:'1px solid var(--border)',borderRight:'1px solid var(--border)',paddingLeft:8,paddingRight:8}}>
                      <div style={{fontSize:9,color:'var(--text3)',marginBottom:4,fontWeight:600,letterSpacing:.5}}>PROFIT</div>
                      <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13,color:profitColor}}>{fmtC(totalProfit)}</div>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:9,color:'var(--text3)',marginBottom:4,fontWeight:600,letterSpacing:.5}}>ROI</div>
                      <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13,color:profitColor}}>{fmtPct(roiClosed)}</div>
                    </div>
                  </div>
                </div>
              )
            })()}
            {filteredClosed.map((p,i) => (
              <MobileClosedCard key={i} p={p} companyInfo={companyInfo} isAdmin={isAdmin} onEditInfo={sym=>setEditInfoSym(sym)}/>
            ))}
          </div>
        ) : (
        <div className="card" style={{overflow:'hidden',marginBottom:16}}>
            <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
              <table className="data-table" style={{minWidth:780, tableLayout:'fixed', width:'100%'}}>
                <colgroup>
                  <col style={{width:'18%'}}/>
                  <col style={{width:'13%'}}/>
                  <col style={{width:'11%'}}/>
                  <col style={{width:'13%'}}/>
                  <col style={{width:'13%'}}/>
                  <col style={{width:'13%'}}/>
                  <col style={{width:'13%'}}/>
                  <col style={{width:'6%'}}/>
                </colgroup>
                <thead><tr>
                  <th style={STICKY_H}>Symbol</th>
                  <th style={{borderRight:'1px solid var(--border2)'}}>Sector · Cap</th>
                  <th style={{textAlign:'right',color:'var(--blue)',fontWeight:700,fontSize:10}}>Shares</th>
                  <th style={{textAlign:'right',color:'var(--blue)',fontWeight:700,fontSize:10}}>Avg Buy</th>
                  <th style={{textAlign:'right',color:'var(--blue)',fontWeight:700,fontSize:10,borderRight:'3px solid var(--border2)'}}>Cost</th>
                  <th style={{textAlign:'right',color:'var(--green)',fontWeight:700,fontSize:10}}>Avg Sell</th>
                  <th style={{textAlign:'right',color:'var(--green)',fontWeight:700,fontSize:10}}>Încasat</th>
                  <th style={{textAlign:'right'}}>ROI</th>
                </tr></thead>
                <tbody>
                  {filteredClosed.map((p,i) => {
                    const info = companyInfo[p.symbol] || {}
                    return (
                      <tr key={i}>
                        <td style={{...STICKY, borderRight:'1px solid var(--border)'}}>
                          <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13,color:'var(--text)',display:'inline-flex',alignItems:'center',gap:4,cursor:isAdmin?'pointer':'default'}}
                            onClick={e=>{if(!isAdmin)return;e.stopPropagation();setEditInfoSym(p.symbol)}}>
                            {p.symbol}{isAdmin&&<span style={{fontSize:9,color:'var(--text3)',opacity:0.5}}>✏</span>}
                          </div>
                          <div style={{fontSize:10,color:'var(--text3)',marginTop:1,lineHeight:1.3}}>{p.name||''}</div>
                          <span style={{fontSize:9,padding:'1px 4px',borderRadius:3,background:'var(--surface2)',color:'var(--text3)',border:'1px solid var(--border)'}}>{p.broker}</span>
                        </td>
                        <td style={{borderRight:'1px solid var(--border2)'}}>
                          {info.sector&&<div style={{fontSize:10,color:'var(--blue)',fontWeight:500}}>{SECTOR_ICONS[info.sector]||''} {info.sector}</div>}
                          {info.cap&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:3,marginTop:3,display:'inline-block',background:'var(--surface2)',color:(CAP_COLORS_NEW[info.cap]||CAP_COLORS[info.cap]||'var(--text3)'),border:`1px solid ${CAP_COLORS_NEW[info.cap]||CAP_COLORS[info.cap]||'var(--border)'}40`,fontWeight:600}}>{info.cap}</span>}
                        </td>
                        <td style={{textAlign:'right'}}>
                          <div className="mono" style={{fontSize:12,fontWeight:600}}>{p.totalShares.toFixed(4)}</div>
                        </td>
                        <td style={{textAlign:'right'}}>
                          <div className="mono" style={{fontSize:12}}>{fmtC(p.avgBuyPrice)}</div>
                        </td>
                        <td style={{textAlign:'right', borderRight:'3px solid var(--border2)'}}>
                          <div className="mono" style={{fontSize:12,fontWeight:600}}>{fmtC(p.totalCost)}</div>
                        </td>
                        <td style={{textAlign:'right'}}>
                          <div className={`mono ${pnlClass(p.totalProfit)}`} style={{fontSize:12,fontWeight:600}}>{fmtC(p.avgSellPrice)}</div>
                        </td>
                        <td style={{textAlign:'right'}}>
                          <div className={`mono ${pnlClass(p.totalProfit)}`} style={{fontSize:12,fontWeight:600}}>{fmtC(p.totalRevenue)}</div>
                          <div className={`mono ${pnlClass(p.totalProfit)}`} style={{fontSize:10,marginTop:2}}>{fmtC(p.totalProfit)}</div>
                        </td>
                        <td style={{textAlign:'right'}}>
                          <span className={`mono ${pnlClass(p.roi)}`} style={{fontSize:14,fontWeight:700}}>{fmtPct(p.roi)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  {(()=>{
                    const totCost   = filteredClosed.reduce((s,p)=>s+p.totalCost,0)
                    const totRev    = filteredClosed.reduce((s,p)=>s+p.totalRevenue,0)
                    const totProfit = filteredClosed.reduce((s,p)=>s+p.totalProfit,0)
                    return (
                      <tr className="total-row">
                        <td colSpan={2} style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>TOTAL ÎNCHISE ({filteredClosed.length})</td>
                        <td/>
                        <td/>
                        <td style={{textAlign:'right', borderRight:'3px solid var(--border2)'}}>
                          <div className="mono" style={{fontSize:12,fontWeight:700,color:'var(--text)'}}>{fmtC(totCost)}</div>
                        </td>
                        <td/>
                        <td style={{textAlign:'right'}}>
                          <div className="mono" style={{fontSize:11,color:'var(--text3)'}}>{fmtC(totRev)}</div>
                          <div className={`mono ${pnlClass(totProfit)}`} style={{fontWeight:700}}>{fmtC(totProfit)}</div>
                        </td>
                        <td style={{textAlign:'right'}}>
                          <span className={`mono ${pnlClass(totProfit)}`} style={{fontWeight:700,fontSize:13}}>
                            {totCost>0?fmtPct(totProfit/totCost*100):'—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })()}
                </tfoot>
              </table>
            </div>
        </div>
        )
      )}

      {selectedPos && view==='open' && !isMobile && (
        <div className="card fade-up" style={{padding:'16px 18px',marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div>
              <span className="mono" style={{fontWeight:700,fontSize:16}}>{selectedPos.symbol}</span>
              <span style={{color:'var(--text3)',fontSize:12,marginLeft:8}}>{selectedPos.name}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={()=>setSelectedPos(null)}>✕</button>
          </div>
          <PriceChart symbol={selectedPos.symbol} height={220}/>
        </div>
      )}
      {editInfoSym && <CompanyEditModal symbol={editInfoSym} onClose={()=>setEditInfoSym(null)}/>}
    </div>
  {alertSym && (
    <AlertModal
      sym={alertSym}
      currentPrice={prices[alertSym]?.price ?? null}
      onClose={() => setAlertSym(null)}
    />
  )}
  )
}

