import { useState } from 'react'
import { fmtC, fmtPct } from '../lib/portfolio.js'
import PriceChart from './PriceChart.jsx'
import AnalysisCard from './AnalysisCard.jsx'

export const BROKER_COLORS = ['#58a6ff','#f0b429','#00d4aa','#a78bfa','#ff5572','#fb923c']
export const CAP_COLORS_MOBILE = { 'Large Cap':'var(--blue)', 'Mid Cap':'var(--green)', 'Small Cap':'var(--gold)', 'Micro Cap':'var(--red)' }

function MobilePositionCard({ p, companyInfo, brokers, isAdmin, onEditInfo, onSelect, selected, children, onAlert, alerts, betas, betaTooltip, setBetaTooltip, showAnalysis, setShowAnalysis }) {
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
        {/* Rând 1 — Symbol | DayChange | Profit | ROI */}
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
          {/* Profit + ROI + alert */}
          <div style={{textAlign:'right'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:6}}>
              <button
                onClick={e=>{e.stopPropagation();onAlert&&onAlert(p.symbol)}}
                title="Alerte preț"
                style={{
                  background:'none',border:'none',cursor:'pointer',fontSize:13,
                  padding:'2px 3px',lineHeight:1,
                  color: (() => { const a=alerts?.[p.symbol]; return a&&(a.targetPrice||a.stopLoss||a.dayChangePct||a.vixPrag)?'#f0b429':'var(--text3)'; })(),
                  opacity: (() => { const a=alerts?.[p.symbol]; return a&&(a.targetPrice||a.stopLoss||a.dayChangePct||a.vixPrag)?1:0.4; })(),
                }}
              >🔔</button>
              <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:16,color:unrColor}}>
                {p.unrealizedPnl!=null ? fmtC(p.unrealizedPnl,p.currency) : '—'}
              </div>
            </div>
            <div style={{fontFamily:'var(--mono)',fontSize:11,fontWeight:600,color:unrColor}}>
              {p.unrealizedPct!=null ? fmtPct(p.unrealizedPct) : ''}
            </div>

          </div>
        </div>

        {/* Rând 2 — CAP | Cur Price | Cur Value */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,padding:'8px 0',borderTop:'1px solid var(--border)',marginBottom:6}}>
          <div>
            <div style={{fontSize:9,color:'var(--text3)',marginBottom:2,fontWeight:600}}>CAP</div>
            <div style={{fontSize:11,color:CAP_COLORS_NEW[info.cap]||'var(--text3)',fontWeight:600}}>{info.cap||'—'}</div>
          </div>
          <div>
            <div style={{fontSize:9,color:'var(--text3)',marginBottom:2,fontWeight:600}}>CUR PRICE</div>
            <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600,color:'var(--text)'}}>{p.curPrice ? fmtC(p.curPrice,p.currency) : '—'}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:9,color:'var(--text3)',marginBottom:2,fontWeight:600}}>VALOARE</div>
            <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:700,color:'var(--text)'}}>{p.curValue ? fmtC(p.curValue,p.currency) : '—'}</div>
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
          <button onClick={()=>{
            if (selected) {
              onSelect(null)
            } else {
              onSelect(p)
              setShowAnalysis(false) // închide analiza
            }
          }} style={{
            flex:1,padding:'6px',borderRadius:6,border:'1px solid var(--border)',
            background:selected?'var(--blue-bg)':'var(--surface2)',
            color:selected?'var(--blue)':'var(--text3)',cursor:'pointer',fontSize:11,fontWeight:600,
          }}>
            {selected ? '▲ Chart' : '📈 Chart'}
          </button>
          <button onClick={()=>{
            if (showAnalysis) {
              setShowAnalysis(false)
            } else {
              setShowAnalysis(true)
              onSelect(null) // închide chart-ul
            }
          }} style={{
            flex:1,padding:'6px',borderRadius:6,border:'1px solid var(--border)',
            background:showAnalysis?'rgba(167,139,250,0.15)':'var(--surface2)',
            color:showAnalysis?'#a78bfa':'var(--text3)',cursor:'pointer',fontSize:11,fontWeight:600,
          }}>
            {showAnalysis ? '▲ Analiză' : '🧠 Analiză'}
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

      {/* Card Analiză */}
      {showAnalysis && (
        <AnalysisCard p={p} betas={betas}/>
      )}
    </div>
  )
}


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

