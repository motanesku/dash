import { useMemo, useState, useEffect } from 'react'
import useStore from '../lib/store.js'
import { fmtC, fmtPct, pnlClass } from '../lib/portfolio.js'
import { calcPortfolio } from '../lib/portfolio.js'

const CLUB_COLORS = ['#4d9fff','#00d4aa','#a78bfa','#f0b429','#ff4d6a','#34d399','#fb923c','#60a5fa','#f472b6','#a3e635']

function BusinessIcon({ color, size=36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="11" r="6" fill={color} opacity=".9"/>
      <rect x="9" y="19" width="18" height="2" rx="1" fill={color} opacity=".5"/>
      <rect x="7" y="21" width="22" height="11" rx="4" fill={color} opacity=".85"/>
      <rect x="15" y="17" width="6" height="5" rx="1" fill={color} opacity=".4"/>
    </svg>
  )
}

function fmtRON(n) {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat('ro-RO', { style:'currency', currency:'RON', minimumFractionDigits:0, maximumFractionDigits:0 }).format(n)
}

function InvestorCard({ inv, displayValue, isAdmin, onEdit, onDelete }) {
  const profitColor = inv.profit >= 0 ? 'var(--green)' : 'var(--red)'
  const roiColor    = inv.roi   >= 0 ? 'var(--green)' : 'var(--red)'

  return (
    <div style={{
      background:'var(--surface)',border:'1px solid var(--border)',
      borderRadius:14,padding:'16px',
      borderTop:`3px solid ${inv.color}`,
      position:'relative',
    }}>
      {/* Header — avatar + nume + stake bar */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
        <BusinessIcon color={inv.color} size={40}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:15,color:'var(--text)',marginBottom:4}}>{inv.name}</div>
          {/* Stake bar */}
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{flex:1,height:6,borderRadius:3,background:'var(--border)',overflow:'hidden'}}>
              <div style={{
                width:`${inv.stake}%`,height:'100%',
                background:inv.color,borderRadius:3,transition:'width .4s',
              }}/>
            </div>
            <span style={{fontSize:11,fontFamily:'var(--mono)',fontWeight:700,color:inv.color,flexShrink:0}}>
              {inv.stake.toFixed(1)}%
            </span>
          </div>
        </div>
        {isAdmin && (
          <div style={{display:'flex',gap:4}}>
            <button className="btn btn-ghost btn-sm" onClick={onEdit} style={{padding:'4px 8px',fontSize:11}}>✏</button>
            <button className="btn btn-danger btn-sm" onClick={onDelete} style={{padding:'4px 8px',fontSize:11}}>✕</button>
          </div>
        )}
      </div>

      {/* Cifre — 3 coloane */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
        <div style={{background:'var(--surface2)',borderRadius:8,padding:'10px 8px',textAlign:'center'}}>
          <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,marginBottom:4,letterSpacing:.4}}>INVESTIT</div>
          <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:700,color:'var(--text)'}}>{fmtRON(inv.invested)}</div>
        </div>
        <div style={{background:'var(--surface2)',borderRadius:8,padding:'10px 8px',textAlign:'center'}}>
          <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,marginBottom:4,letterSpacing:.4}}>VALOARE</div>
          <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:700,color:inv.color}}>{fmtRON(inv.curVal)}</div>
        </div>
        <div style={{background:'var(--surface2)',borderRadius:8,padding:'10px 8px',textAlign:'center'}}>
          <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,marginBottom:4,letterSpacing:.4}}>PROFIT</div>
          <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:700,color:profitColor}}>{fmtRON(inv.profit)}</div>
          <div style={{fontFamily:'var(--mono)',fontSize:10,color:roiColor,marginTop:2}}>{fmtPct(inv.roi)}</div>
        </div>
      </div>
    </div>
  )
}

export default function Club() {
  const { club, updateClub, isAdmin, txs, prices, marketData } = useStore()
  const { positions, cashByBroker } = useMemo(() => calcPortfolio(txs, prices), [txs, prices])

  const [showInvModal,     setShowInvModal]     = useState(false)
  const [showContribModal, setShowContribModal] = useState(false)
  const [editInv,          setEditInv]          = useState(null)
  const [editContrib,      setEditContrib]      = useState(null)
  const [invForm,          setInvForm]          = useState({name:'', color:CLUB_COLORS[0]})
  const [contribForm,      setContribForm]      = useState({investorId:'', month:new Date().toISOString().slice(0,7), amount:''})

  const [usdRon, setUsdRon] = useState(() => {
    return marketData['RON=X']?.price
      || prices['RON=X']?.price
      || (() => { try { return JSON.parse(localStorage.getItem('ptf_v6_market')||'{}')['RON=X']?.price || JSON.parse(localStorage.getItem('ptf_v6_prices')||'{}')['RON=X']?.price || null } catch { return null } })()
  })

  useEffect(() => {
    if (usdRon) return
    fetch('https://worker.danut-fagadau.workers.dev/api/prices?symbols=RON=X')
      .then(r => r.json())
      .then(j => { const rate = j?.prices?.['RON=X']?.price; if (rate) setUsdRon(rate) })
      .catch(() => {})
  }, [])

  const totalStocks    = positions.reduce((s,p) => s+(p.curValue||0), 0)
  const totalCash      = Object.values(cashByBroker).reduce((s,v) => s+v, 0)
  const totalPortfolio = totalStocks + totalCash
  const displayValue   = usdRon ? totalPortfolio * usdRon : 0

  const stats = useMemo(() => {
    const total = club.investors.reduce((s,inv) =>
      s + club.contributions.filter(c=>c.investorId===inv.id).reduce((ss,c)=>ss+Number(c.amount||0),0), 0)
    return club.investors.map(inv => {
      const invested = club.contributions.filter(c=>c.investorId===inv.id).reduce((s,c)=>s+Number(c.amount||0),0)
      const stake    = total > 0 ? (invested/total)*100 : 0
      const curVal   = displayValue > 0 ? (stake/100)*displayValue : invested
      const profit   = curVal - invested
      const roi      = invested > 0 ? (profit/invested)*100 : 0
      return {...inv, invested, stake, curVal, profit, roi}
    }).sort((a,b) => b.invested - a.invested)
  }, [club, displayValue])

  const totalInvested = stats.reduce((s,i) => s+i.invested, 0)
  const months = useMemo(() => [...new Set(club.contributions.map(c=>c.month))].sort().reverse(), [club.contributions])

  const saveInv = () => {
    if (!invForm.name.trim()) return
    const inv = {id: editInv?.id||Date.now(), name:invForm.name.trim(), color:invForm.color}
    const investors = editInv
      ? club.investors.map(i=>i.id===editInv.id?inv:i)
      : [...club.investors, inv]
    updateClub({...club, investors})
    setShowInvModal(false); setEditInv(null)
    setInvForm({name:'', color:CLUB_COLORS[investors.length%CLUB_COLORS.length]})
  }

  const delInv = (id) => {
    if (!confirm('Ștergi investitorul și toate contribuțiile lui?')) return
    updateClub({...club,
      investors: club.investors.filter(i=>i.id!==id),
      contributions: club.contributions.filter(c=>c.investorId!==id)
    })
  }

  const saveContrib = () => {
    if (!contribForm.investorId||!contribForm.amount||isNaN(+contribForm.amount)) return
    const c = {id:editContrib?.id||Date.now(), investorId:+contribForm.investorId, month:contribForm.month, amount:+contribForm.amount}
    const contributions = editContrib
      ? club.contributions.map(x=>x.id===editContrib.id?c:x)
      : [...club.contributions, c]
    updateClub({...club, contributions})
    setShowContribModal(false); setEditContrib(null)
  }

  const openContrib = (inv, month, existing) => {
    setEditContrib(existing||null)
    setContribForm({investorId:String(inv.id), month:month||new Date().toISOString().slice(0,7), amount:existing?String(existing.amount):''})
    setShowContribModal(true)
  }

  const STICKY_H = { position:'sticky', left:0, zIndex:3, background:'var(--bg2)' }
  const STICKY   = { position:'sticky', left:0, zIndex:2, background:'var(--surface)' }

  return (
    <div className="fade-up">

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:700,marginBottom:2}}>{club.name}</h2>
          <div style={{fontSize:12,color:'var(--text3)'}}>{club.investors.length} investitori · {months.length} luni de contribuții</div>
        </div>
        {isAdmin && (
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>{setEditInv(null);setInvForm({name:'',color:CLUB_COLORS[club.investors.length%CLUB_COLORS.length]});setShowInvModal(true)}}>+ Investitor</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>{setEditContrib(null);setContribForm({investorId:String(club.investors[0]?.id||''),month:new Date().toISOString().slice(0,7),amount:''});setShowContribModal(true)}}>+ Contribuție</button>
          </div>
        )}
      </div>

      {/* Card valoare totală */}
      <div className="card" style={{padding:'18px 20px',marginBottom:20,background:'linear-gradient(135deg,rgba(77,159,255,0.08),rgba(167,139,250,0.08))',borderColor:'var(--blue-b)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:8}}>
          <div>
            <div className="label" style={{marginBottom:6,color:'var(--blue)'}}>Valoare Actuală Club (RON)</div>
            <div className="mono" style={{fontSize:26,fontWeight:700,color:'var(--blue)'}}>{fmtRON(displayValue)}</div>
            {displayValue>0&&totalInvested>0&&(
              <div className={`mono ${pnlClass(displayValue-totalInvested)}`} style={{fontSize:13,marginTop:4}}>
                {fmtRON(displayValue-totalInvested)} · {fmtPct((displayValue-totalInvested)/totalInvested*100)}
              </div>
            )}
          </div>
          <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)',textAlign:'right'}}>
            {usdRon
              ? <>{Math.round(totalStocks)} stocuri + {Math.round(totalCash)} cash<br/>{Math.round(totalPortfolio)} USD × {usdRon.toFixed(2)}</>
              : <span style={{color:'var(--gold)'}}>⏳ se încarcă cursul...</span>
            }
          </div>
        </div>
      </div>

      {/* Total card — sub valoare actuală */}
      {club.investors.length > 0 && (
        <div style={{
          background:'var(--surface)',border:'1px solid var(--border)',
          borderRadius:14,padding:'16px',marginBottom:20,
          borderTop:'3px solid var(--text3)',
        }}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
            <div style={{
              width:40,height:40,borderRadius:'50%',background:'var(--surface2)',
              border:'2px solid var(--border)',display:'flex',alignItems:'center',
              justifyContent:'center',fontSize:18,flexShrink:0,
            }}>👥</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:15,color:'var(--text)',marginBottom:4}}>Total {stats.length} investitori</div>
              <div style={{height:6,borderRadius:3,background:'var(--blue)',width:'100%'}}/>
            </div>
            <span style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--text3)',fontSize:12}}>100%</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            <div style={{background:'var(--surface2)',borderRadius:8,padding:'10px 8px',textAlign:'center'}}>
              <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,marginBottom:4,letterSpacing:.4}}>INVESTIT</div>
              <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:700,color:'var(--text)'}}>{fmtRON(totalInvested)}</div>
            </div>
            <div style={{background:'var(--surface2)',borderRadius:8,padding:'10px 8px',textAlign:'center'}}>
              <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,marginBottom:4,letterSpacing:.4}}>VALOARE</div>
              <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:700,color:'var(--blue)'}}>{fmtRON(displayValue)}</div>
            </div>
            <div style={{background:'var(--surface2)',borderRadius:8,padding:'10px 8px',textAlign:'center'}}>
              <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,marginBottom:4,letterSpacing:.4}}>PROFIT</div>
              <div className={`mono ${pnlClass(displayValue-totalInvested)}`} style={{fontSize:12,fontWeight:700}}>{fmtRON(displayValue-totalInvested)}</div>
              <div className={`mono ${pnlClass(displayValue-totalInvested)}`} style={{fontSize:10,marginTop:2}}>{totalInvested>0?fmtPct((displayValue-totalInvested)/totalInvested*100):'—'}</div>
            </div>
          </div>
        </div>
      )}

      {club.investors.length === 0 ? (
        <div className="card" style={{padding:'60px 20px',textAlign:'center'}}>
          <div style={{fontSize:40,marginBottom:12}}>🤝</div>
          <div style={{fontWeight:600,marginBottom:6}}>Niciun investitor</div>
          <div style={{color:'var(--text3)',fontSize:13}}>Adaugă investitori pentru a urmări contribuțiile clubului.</div>
        </div>
      ) : (
        <>
          {/* Grid carduri investitori */}
          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))',
            gap:12,marginBottom:20,
          }}>
            {stats.map(inv => (
              <InvestorCard
                key={inv.id}
                inv={inv}
                displayValue={displayValue}
                isAdmin={isAdmin}
                onEdit={()=>{setEditInv(inv);setInvForm({name:inv.name,color:inv.color});setShowInvModal(true)}}
                onDelete={()=>delInv(inv.id)}
              />
            ))}
          </div>



          {/* Contribuții lunare */}
          {months.length > 0 && (
            <div className="card" style={{overflow:'hidden'}}>
              <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div className="label">Contribuții Lunare</div>
              </div>
              <div style={{overflowX:'auto'}}>
                <table className="data-table" style={{minWidth:400}}>
                  <thead><tr>
                    <th style={{...STICKY_H, minWidth:80}}>Lună</th>
                    {stats.map(inv => (
                      <th key={inv.id} style={{textAlign:'right',color:inv.color}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4}}>
                          <div style={{width:8,height:8,borderRadius:'50%',background:inv.color}}/>
                          {inv.name}
                        </div>
                      </th>
                    ))}
                    <th style={{textAlign:'right'}}>Total</th>
                    {isAdmin && <th/>}
                  </tr></thead>
                  <tbody>
                    {months.map(month => {
                      const monthTotal = club.contributions.filter(c=>c.month===month).reduce((s,c)=>s+Number(c.amount||0),0)
                      return (
                        <tr key={month}>
                          <td style={{...STICKY, fontFamily:'var(--mono)',fontSize:12,fontWeight:600,borderRight:'1px solid var(--border)'}}>{month}</td>
                          {stats.map(inv => {
                            const c = club.contributions.find(x=>x.investorId===inv.id&&x.month===month)
                            return (
                              <td key={inv.id} style={{textAlign:'right'}}>
                                {c
                                  ? <span style={{fontFamily:'var(--mono)',fontSize:12,color:inv.color,fontWeight:600}}>{fmtRON(c.amount)}</span>
                                  : <span style={{color:'var(--text3)'}}>—</span>
                                }
                              </td>
                            )
                          })}
                          <td style={{textAlign:'right',fontFamily:'var(--mono)',fontSize:12,fontWeight:700}}>{fmtRON(monthTotal)}</td>
                          {isAdmin && (
                            <td>
                              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                                {stats.map(inv => {
                                  const c = club.contributions.find(x=>x.investorId===inv.id&&x.month===month)
                                  return c ? (
                                    <button key={inv.id} className="btn btn-ghost btn-sm"
                                      style={{fontSize:9,padding:'2px 5px',color:inv.color,borderColor:inv.color}}
                                      onClick={()=>openContrib(inv,month,c)}>✏{inv.name}</button>
                                  ) : null
                                })}
                                <button className="btn btn-ghost btn-sm" style={{fontSize:9,padding:'2px 5px'}}
                                  onClick={()=>{setEditContrib(null);setContribForm({investorId:String(stats[0]?.id||''),month,amount:''});setShowContribModal(true)}}>+ Add</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal investitor */}
      {showInvModal && isAdmin && (
        <div className="overlay" onClick={()=>setShowInvModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:360}}>
            <div className="modal-title">{editInv?'✏ Editează Investitor':'+ Investitor Nou'}</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <div className="label" style={{marginBottom:5}}>Nume</div>
                <input className="input" placeholder="Ion Popescu" value={invForm.name}
                  onChange={e=>setInvForm(f=>({...f,name:e.target.value}))} autoFocus/>
              </div>
              <div>
                <div className="label" style={{marginBottom:8}}>Culoare</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {CLUB_COLORS.map(c=>(
                    <div key={c} onClick={()=>setInvForm(f=>({...f,color:c}))} style={{
                      width:28,height:28,borderRadius:'50%',background:c,cursor:'pointer',
                      border:`3px solid ${invForm.color===c?'white':'transparent'}`,transition:'transform .15s',
                    }}/>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setShowInvModal(false)}>Anulează</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={saveInv}>Salvează</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal contribuție */}
      {showContribModal && isAdmin && (
        <div className="overlay" onClick={()=>setShowContribModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:360}}>
            <div className="modal-title">{editContrib?'✏ Editează Contribuție':'+ Contribuție'}</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <div className="label" style={{marginBottom:5}}>Investitor</div>
                <select className="select" value={contribForm.investorId}
                  onChange={e=>setContribForm(f=>({...f,investorId:e.target.value}))}>
                  {club.investors.map(inv=><option key={inv.id} value={inv.id}>{inv.name}</option>)}
                </select>
              </div>
              <div>
                <div className="label" style={{marginBottom:5}}>Lună</div>
                <input className="input" type="month" value={contribForm.month}
                  onChange={e=>setContribForm(f=>({...f,month:e.target.value}))}/>
              </div>
              <div>
                <div className="label" style={{marginBottom:5}}>Sumă (RON)</div>
                <input className="input mono" type="number" placeholder="500" min="0" step="1"
                  value={contribForm.amount} onChange={e=>setContribForm(f=>({...f,amount:e.target.value}))}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setShowContribModal(false)}>Anulează</button>
              <button className="btn btn-primary" style={{flex:1}} onClick={saveContrib}>Salvează</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
