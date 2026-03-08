import { useMemo, useState, useEffect } from 'react'
import useStore from '../lib/store.js'
import { calcPortfolio, fmtC, fmtPct, pnlClass, fmtDate } from '../lib/portfolio.js'
import PriceChart from '../components/PriceChart.jsx'
import CompanyEditModal from '../components/CompanyEditModal.jsx'
import { CompanyInfoCard, SECTOR_ICONS, CAP_COLORS as CAP_COLORS_NEW, CAPS, SECTORS } from '../components/CompanyInfoSection.jsx'

const BROKER_COLORS = ['#58a6ff','#f0b429','#00d4aa','#a78bfa','#ff5572','#fb923c']
const CAP_COLORS    = { 'Large Cap':'var(--blue)', 'Mid Cap':'var(--green)', 'Small Cap':'var(--gold)', 'Micro Cap':'var(--red)' }
const STICKY   = { position:'sticky', left:0, zIndex:2, background:'var(--surface)' }
const STICKY_H = { position:'sticky', left:0, zIndex:3, background:'var(--bg2)' }

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
        dayChange:     p.dayChange, // use latest
        brokers:       [...e.brokers, p.broker],
      }
    }
  })
  return Object.values(map).sort((a,b) => (b.curValue||0) - (a.curValue||0))
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

  // Auto-fetch company info for all symbols not yet cached
  useEffect(() => {
    const allSyms = [...new Set(txs.filter(t => t.type !== 'DEPOSIT').map(t => t.symbol || t.sym).filter(Boolean))]
    const missing = allSyms.filter(s => !companyInfo[s]?.sector)
    if (missing.length) fetchCompanyInfo(missing)
  }, [txs.length])

  const { positions, closedPositions, cashByBroker } = useMemo(() => calcPortfolio(txs, prices), [txs, prices])
  const [selectedPos, setSelectedPos] = useState(null)
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

      {/* Cash banner */}
      <div style={{display:'flex',gap:8,marginBottom:14,overflowX:'auto',paddingBottom:2}}>
        <div style={{
          display:'flex',alignItems:'center',gap:10,padding:'8px 16px',
          background:'var(--gold-bg)',border:'1px solid rgba(240,180,41,0.25)',
          borderRadius:8,flexShrink:0,
        }}>
          <span style={{fontSize:14}}>💵</span>
          <div>
            <div className="label" style={{marginBottom:1}}>Cash Total</div>
            <div className="mono" style={{fontWeight:700,color:'var(--gold)',fontSize:14}}>{fmtC(totalCash)}</div>
          </div>
        </div>
        {brokers.map((b,i) => {
          const cash = cashByBroker[b] || 0
          if (cash === 0) return null
          return (
            <div key={b} style={{
              display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
              background:'var(--surface)',border:`1px solid ${BROKER_COLORS[i%BROKER_COLORS.length]}40`,
              borderRadius:8,flexShrink:0,
            }}>
              <span style={{width:7,height:7,borderRadius:'50%',background:BROKER_COLORS[i%BROKER_COLORS.length],flexShrink:0}}/>
              <div>
                <div className="label" style={{marginBottom:1}}>{b}</div>
                <div className="mono" style={{fontWeight:600,fontSize:13,color:BROKER_COLORS[i%BROKER_COLORS.length]}}>{fmtC(cash)}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Broker tabs */}
      <div style={{display:'flex',gap:6,marginBottom:14,overflowX:'auto',WebkitOverflowScrolling:'touch',paddingBottom:4}}>
        <button onClick={()=>setBrokerTab(null)} style={{
          display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:8,
          border:`2px solid ${!brokerTab?'var(--blue)':'var(--border2)'}`,
          background:!brokerTab?'var(--blue-bg)':'var(--surface)',
          color:!brokerTab?'var(--blue)':'var(--text3)',
          fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap',
        }}>
          TOTAL
          {totalCost>0 && <span className="mono" style={{fontSize:10,fontWeight:700,color:!brokerTab?'inherit':totalUnrealized>=0?'var(--green)':'var(--red)'}}>
            {totalUnrealized>=0?'+':''}{(totalUnrealized/totalCost*100).toFixed(1)}%
          </span>}
          <span className="mono" style={{fontSize:10,color:!brokerTab?'inherit':'var(--text3)'}}>{[...new Set(positions.map(p=>p.symbol))].length}</span>
        </button>
        {brokers.map((b,i) => {
          const st = brokerStats[b]
          const active = brokerTab === b
          const c = BROKER_COLORS[i%BROKER_COLORS.length]
          return (
            <button key={b} onClick={()=>setBrokerTab(b)} style={{
              display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:8,
              border:`2px solid ${active?c:'var(--border2)'}`,
              background:active?`${c}15`:'var(--surface)',
              color:active?c:'var(--text3)',
              fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap',
            }}>
              <span style={{width:7,height:7,borderRadius:'50%',background:c,flexShrink:0}}/>
              {b}
              {st?.roi!=null && <span className="mono" style={{fontSize:10,fontWeight:700,color:active?'inherit':st.roi>=0?'var(--green)':'var(--red)'}}>
                {st.roi>=0?'+':''}{st.roi.toFixed(1)}%
              </span>}
              <span className="mono" style={{fontSize:10,color:active?'inherit':'var(--text3)'}}>{st?.count||0}</span>
            </button>
          )
        })}
      </div>

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
        <div className="card" style={{overflow:'hidden',marginBottom:16}}>
          <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
            <table className="data-table" style={{minWidth:620}}>
              <thead><tr>
                <th style={STICKY_H}>Symbol</th>
                <th style={{borderRight:'1px solid var(--border2)'}}>Sector · Cap</th>
                <th>Acțiuni · Avg</th>
                <th>Preț · Δ azi</th>
                <th style={{textAlign:'right'}}>Nerealizat · %</th>
                <th style={{textAlign:'right'}}>Valoare</th>
              </tr></thead>
              <tbody>
                {filteredOpen.map(p => {
                  const info = companyInfo[p.symbol] || {}
                  const brokerList = p.brokers || [p.broker]
                  return (
                    <tr key={p.symbol+(p.broker||'')} style={{cursor:'pointer'}}
                      onClick={()=>setSelectedPos(selectedPos?.symbol===p.symbol?null:p)}>
                      <td style={{...STICKY, borderRight:'1px solid var(--border)', minWidth:110, maxWidth:140}}>
                        <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13,color:'var(--text)',cursor:isAdmin?'pointer':'default',display:'inline-flex',alignItems:'center',gap:4}}
                          onClick={e=>{if(!isAdmin)return;e.stopPropagation();setEditInfoSym(p.symbol)}}>
                          {p.symbol}
                          {isAdmin&&<span style={{fontSize:9,color:'var(--text3)',opacity:0.5}}>✏</span>}
                        </div>
                        <div style={{fontSize:10,color:'var(--text3)',marginTop:2,lineHeight:1.3,whiteSpace:'normal'}}>
                          {p.name}
                        </div>
                        <div style={{display:'flex',gap:3,marginTop:3,flexWrap:'wrap'}}>
                          {brokerList.map((b,i)=>(
                            <span key={b} style={{fontSize:9,padding:'1px 4px',borderRadius:3,background:'var(--surface2)',color:BROKER_COLORS[brokers.indexOf(b)%BROKER_COLORS.length],border:'1px solid var(--border)'}}>{b}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{borderRight:'1px solid var(--border2)', minWidth:120}}>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
                          {info.sector&&<span style={{fontSize:10,color:'var(--blue)',fontWeight:500}}>{SECTOR_ICONS[info.sector]||''} {info.sector}</span>}
                          {info.industry&&<span style={{fontSize:10,color:'var(--text3)'}}>· {info.industry}</span>}
                        </div>
                        {info.cap&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:3,marginTop:4,display:'inline-block',background:'var(--surface2)',color:(CAP_COLORS_NEW[info.cap]||CAP_COLORS[info.cap]||'var(--text3)'),border:`1px solid ${CAP_COLORS_NEW[info.cap]||CAP_COLORS[info.cap]||'var(--border)'}40`,fontWeight:600}}>{info.cap}</span>}
                      </td>
                      <td>
                        <div className="mono" style={{fontSize:12}}>{p.shares.toFixed(4)}</div>
                        <div className="mono" style={{fontSize:10,color:'var(--text3)'}}>avg {fmtC(p.avgPrice,p.currency)}</div>
                      </td>
                      <td>
                        <div className="mono" style={{fontSize:12}}>{p.curPrice?fmtC(p.curPrice,p.currency):'—'}</div>
                        <div className={`mono ${pnlClass(p.dayChange)}`} style={{fontSize:10}}>{p.dayChange!=null?fmtPct(p.dayChange):'—'}</div>
                      </td>
                      <td style={{textAlign:'right'}}>
                        <div className={`mono ${pnlClass(p.unrealizedPnl)}`} style={{fontSize:12,fontWeight:600}}>{p.unrealizedPnl!=null?fmtC(p.unrealizedPnl,p.currency):'—'}</div>
                        <div className={`mono ${pnlClass(p.unrealizedPct)}`} style={{fontSize:10}}>{p.unrealizedPct!=null?fmtPct(p.unrealizedPct):'—'}</div>
                      </td>
                      <td style={{textAlign:'right'}}>
                        <div className="mono" style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{p.curValue?fmtC(p.curValue,p.currency):'—'}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={3} style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>TOTAL {brokerTab||'PORTOFOLIU'}</td>
                  <td style={{textAlign:'right'}}>
                    <div className={`mono ${pnlClass(totalUnrealized)}`} style={{fontWeight:700}}>{fmtC(totalUnrealized)}</div>
                    <div className={`mono ${pnlClass(totalUnrealized)}`} style={{fontSize:10}}>{totalCost>0?fmtPct(totalUnrealized/totalCost*100):''}</div>
                  </td>
                  <td style={{textAlign:'right'}}>
                    <div className="mono" style={{fontWeight:700,color:'var(--text)',fontSize:14}}>{fmtC(totalVal)}</div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── CLOSED POSITIONS ── */}
      {view === 'closed' && (
        <div className="card" style={{overflow:'hidden',marginBottom:16}}>
          {filteredClosed.length === 0 ? (
            <div style={{padding:'40px 20px',textAlign:'center',color:'var(--text3)',fontSize:13}}>
              Nicio poziție închisă{brokerTab ? ` pentru ${brokerTab}` : ''}.
            </div>
          ) : (
            <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
              <table className="data-table" style={{minWidth:580}}>
                <thead><tr>
                  <th style={STICKY_H}>Symbol</th>
                  <th style={{borderRight:'1px solid var(--border2)'}}>Sector · Cap</th>
                  <th>Broker</th>
                  <th style={{textAlign:'right'}}>Profit Realizat</th>
                  <th style={{textAlign:'right'}}>ROI</th>
                  <th style={{textAlign:'right'}} className="hide-mobile">Ultima vânzare</th>
                </tr></thead>
                <tbody>
                  {filteredClosed.map((p,i) => {
                    const info = companyInfo[p.symbol] || {}
                    return (
                      <tr key={i}>
                        <td style={{...STICKY, borderRight:'1px solid var(--border)', minWidth:110, maxWidth:140}}>
                          <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13,color:'var(--text)',cursor:isAdmin?'pointer':'default',display:'inline-flex',alignItems:'center',gap:4}}
                            onClick={e=>{if(!isAdmin)return;e.stopPropagation();setEditInfoSym(p.symbol)}}>
                            {p.symbol}{isAdmin&&<span style={{fontSize:9,color:'var(--text3)',opacity:0.5}}>✏</span>}
                          </div>
                        </td>
                        <td style={{borderRight:'1px solid var(--border2)', minWidth:120}}>
                          <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
                            {info.sector&&<span style={{fontSize:10,color:'var(--blue)',fontWeight:500}}>{SECTOR_ICONS[info.sector]||''} {info.sector}</span>}
                            {info.industry&&<span style={{fontSize:10,color:'var(--text3)'}}>· {info.industry}</span>}
                          </div>
                          {info.cap&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:3,marginTop:4,display:'inline-block',background:'var(--surface2)',color:(CAP_COLORS_NEW[info.cap]||CAP_COLORS[info.cap]||'var(--text3)'),border:`1px solid ${CAP_COLORS_NEW[info.cap]||CAP_COLORS[info.cap]||'var(--border)'}40`,fontWeight:600}}>{info.cap}</span>}
                        </td>
                        <td><span style={{fontSize:11,color:'var(--text3)'}}>{p.broker}</span></td>
                        <td style={{textAlign:'right'}}><span className="mono" style={{fontSize:12}}>{p.totalShares?.toFixed(4)||'—'}</span></td>
                        <td style={{textAlign:'right'}}>
                          <span className={`mono ${pnlClass(p.totalProfit)}`} style={{fontSize:13,fontWeight:700}}>{fmtC(p.totalProfit)}</span>
                        </td>
                        <td style={{textAlign:'right'}}>
                          <span className={`mono ${pnlClass(p.roi)}`} style={{fontSize:13,fontWeight:700}}>{fmtPct(p.roi)}</span>
                        </td>
                        <td style={{textAlign:'right'}} className="hide-mobile">
                          <span style={{fontSize:11,color:'var(--text3)'}}>{fmtDate(p.lastDate)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td colSpan={4} style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>TOTAL ÎNCHISE</td>
                    <td style={{textAlign:'right'}}>
                      <span className={`mono ${pnlClass(filteredClosed.reduce((s,p)=>s+p.totalProfit,0))}`} style={{fontWeight:700}}>
                        {fmtC(filteredClosed.reduce((s,p)=>s+p.totalProfit,0))}
                      </span>
                    </td>
                    <td colSpan={2}/>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedPos && view==='open' && (
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
  )
}
