import { useMemo, useState } from 'react'
import useStore from '../lib/store.js'
import { fmtC, fmtPct, pnlClass } from '../lib/portfolio.js'
import PriceChart from '../components/PriceChart.jsx'

export default function Positions({ onEditTx }) {
  const { getPortfolio, brokerTab, setBrokerTab, brokers, setShowBrokerMgr, isAdmin, cashByBroker, prices } = useStore()
  const { positions, cashByBroker: cash } = useMemo(getPortfolio, [getPortfolio])
  const [selectedPos, setSelectedPos] = useState(null)
  const [sortBy, setSortBy] = useState('value') // value | unrealized | daychange
  const activeBroker = brokerTab

  const filteredPos = useMemo(() => {
    const arr = activeBroker ? positions.filter(p=>p.broker===activeBroker) : positions
    return [...arr].sort((a,b) => {
      if (sortBy==='value') return (b.curValue||0)-(a.curValue||0)
      if (sortBy==='unrealized') return (b.unrealizedPct||0)-(a.unrealizedPct||0)
      if (sortBy==='daychange') return (b.dayChange||0)-(a.dayChange||0)
      return 0
    })
  }, [positions, activeBroker, sortBy])

  const cashTotal = activeBroker ? (cash[activeBroker]||0) : Object.values(cash).reduce((s,v)=>s+v,0)
  const totalVal = filteredPos.reduce((s,p)=>s+(p.curValue||0),0)
  const totalCost = filteredPos.reduce((s,p)=>s+p.costBasis,0)
  const totalUnrealized = filteredPos.reduce((s,p)=>s+(p.unrealizedPnl||0),0)
  const totalRealized = filteredPos.reduce((s,p)=>s+p.realizedPnl,0)

  const BROKER_COLORS = ['#4d9fff','#f0b429','#00d4aa','#a78bfa','#ff4d6a','#fb923c']

  const SortBtn = ({val,label}) => (
    <button onClick={()=>setSortBy(val)} style={{
      padding:'3px 8px',borderRadius:4,border:'none',cursor:'pointer',fontSize:10,fontFamily:'var(--mono)',fontWeight:600,
      background:sortBy===val?'var(--blue)':'var(--surface2)',
      color:sortBy===val?'#fff':'var(--text3)',transition:'all .15s',
    }}>{label}</button>
  )

  return (
    <div className="fade-up">
      {/* Broker tabs */}
      <div style={{display:'flex',gap:6,marginBottom:16,overflowX:'auto',WebkitOverflowScrolling:'touch',paddingBottom:4}}>
        <button onClick={()=>setBrokerTab(null)} style={{
          padding:'8px 16px',borderRadius:8,border:`2px solid ${!activeBroker?'var(--blue)':'var(--border2)'}`,
          background:!activeBroker?'var(--blue-bg)':'var(--surface)',
          color:!activeBroker?'var(--blue)':'var(--text3)',
          fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap',
        }}>
          TOTAL · {positions.length} poz.
        </button>
        {brokers.map((b,i)=>{
          const bPos = positions.filter(p=>p.broker===b)
          const bVal = bPos.reduce((s,p)=>s+(p.curValue||0),0)
          const bCost = bPos.reduce((s,p)=>s+p.costBasis,0)
          const bRoi = bCost>0?((bVal-bCost)/bCost)*100:null
          const active = activeBroker===b
          return (
            <button key={b} onClick={()=>setBrokerTab(b)} style={{
              display:'flex',alignItems:'center',gap:6,
              padding:'8px 16px',borderRadius:8,
              border:`2px solid ${active?BROKER_COLORS[i%BROKER_COLORS.length]:'var(--border2)'}`,
              background:active?`${BROKER_COLORS[i%BROKER_COLORS.length]}15`:'var(--surface)',
              color:active?BROKER_COLORS[i%BROKER_COLORS.length]:'var(--text3)',
              fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap',
            }}>
              <span style={{width:8,height:8,borderRadius:'50%',background:BROKER_COLORS[i%BROKER_COLORS.length],flexShrink:0}}/>
              {b}
              {bRoi!=null&&<span className="mono" style={{fontSize:10,fontWeight:700,color:active?'inherit':bRoi>=0?'var(--green)':'var(--red)'}}>
                {bRoi>=0?'+':''}{bRoi.toFixed(1)}%
              </span>}
            </button>
          )
        })}
        {isAdmin&&<button onClick={()=>useStore.getState().setShowBrokerMgr?.(true)} className="btn btn-ghost btn-sm" style={{whiteSpace:'nowrap'}}>⚙ Brokeri</button>}
      </div>

      {/* Sort controls */}
      <div style={{display:'flex',gap:6,marginBottom:12,alignItems:'center'}}>
        <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',marginRight:4}}>SORT:</span>
        <SortBtn val="value" label="VALOARE"/>
        <SortBtn val="unrealized" label="P&L%"/>
        <SortBtn val="daychange" label="ZI%"/>
      </div>

      {/* Table */}
      <div className="card" style={{overflow:'hidden',marginBottom:16}}>
        <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
          <table className="data-table" style={{minWidth:620}}>
            <thead><tr>
              <th>Symbol / Broker</th>
              <th>Acțiuni · Avg</th>
              <th>Preț · Δ azi</th>
              <th style={{textAlign:'right'}}>Nerealizat</th>
              <th style={{textAlign:'right'}} className="hide-mobile">Realizat</th>
              <th style={{textAlign:'right'}}>Valoare</th>
            </tr></thead>
            <tbody>
              {filteredPos.map(p=>(
                <tr key={p.broker+p.symbol} style={{cursor:'pointer'}} onClick={()=>setSelectedPos(selectedPos?.symbol===p.symbol?null:p)}>
                  <td>
                    <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13,color:'var(--text)'}}>{p.symbol}</div>
                    <div style={{fontSize:10,color:'var(--text3)',marginTop:2,display:'flex',alignItems:'center',gap:4}}>
                      <span>{p.name}</span>
                      <span style={{background:'var(--surface2)',padding:'1px 5px',borderRadius:3,border:'1px solid var(--border)',fontSize:9}}>{p.broker}</span>
                      {p.marketState==='PRE'&&<span className="badge badge-gold" style={{fontSize:8}}>PRE</span>}
                      {p.marketState==='POST'&&<span className="badge" style={{fontSize:8,background:'var(--surface2)',color:'var(--text3)',border:'1px solid var(--border)'}}>POST</span>}
                    </div>
                  </td>
                  <td>
                    <div className="mono" style={{fontSize:12}}>{p.shares.toFixed(4)}</div>
                    <div className="mono" style={{fontSize:10,color:'var(--text3)'}}>avg {fmtC(p.avgPrice,p.currency)}</div>
                  </td>
                  <td>
                    <div className="mono" style={{fontSize:12,color:'var(--text)'}}>{p.curPrice?fmtC(p.curPrice,p.currency):'—'}</div>
                    <div className={`mono ${pnlClass(p.dayChange)}`} style={{fontSize:10}}>{p.dayChange!=null?fmtPct(p.dayChange):'—'}</div>
                  </td>
                  <td style={{textAlign:'right'}}>
                    <div className={`mono ${pnlClass(p.unrealizedPnl)}`} style={{fontSize:12,fontWeight:600}}>{p.unrealizedPnl!=null?fmtC(p.unrealizedPnl,p.currency):'—'}</div>
                    <div className={`mono ${pnlClass(p.unrealizedPct)}`} style={{fontSize:10}}>{p.unrealizedPct!=null?fmtPct(p.unrealizedPct):'—'}</div>
                  </td>
                  <td style={{textAlign:'right'}} className="hide-mobile">
                    <div className="mono" style={{fontSize:12,color:p.realizedPnl!==0?(p.realizedPnl>0?'var(--purple)':'var(--red)'):'var(--text3)'}}>{p.realizedPnl!==0?fmtC(p.realizedPnl,p.currency):'—'}</div>
                    <div className="mono" style={{fontSize:10,color:p.realizedPnl!==0?'var(--purple)':'var(--text3)'}}>{p.realizedPnl!==0?fmtPct(p.realizedPct):'—'}</div>
                  </td>
                  <td style={{textAlign:'right'}}>
                    <div className="mono" style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{p.curValue?fmtC(p.curValue,p.currency):'—'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>TOTAL {activeBroker||'PORTOFOLIU'}</td>
                <td/>
                <td/>
                <td style={{textAlign:'right'}}>
                  <div className={`mono ${pnlClass(totalUnrealized)}`} style={{fontWeight:700}}>{fmtC(totalUnrealized)}</div>
                  <div className={`mono ${pnlClass(totalUnrealized)}`} style={{fontSize:10}}>{totalCost>0?fmtPct(totalUnrealized/totalCost*100):''}</div>
                </td>
                <td style={{textAlign:'right'}} className="hide-mobile">
                  <div className="mono" style={{color:'var(--purple)',fontWeight:700}}>{fmtC(totalRealized)}</div>
                </td>
                <td style={{textAlign:'right'}}>
                  <div className="mono" style={{fontWeight:700,color:'var(--text)',fontSize:14}}>{fmtC(totalVal)}</div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Expanded chart for selected position */}
      {selectedPos&&(
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
    </div>
  )
}
