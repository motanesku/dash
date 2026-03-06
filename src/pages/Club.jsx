import { useMemo, useState } from 'react'
import useStore from '../lib/store.js'
import { fmtC, fmtPct, pnlClass } from '../lib/portfolio.js'

const CLUB_COLORS = ['#4d9fff','#00d4aa','#a78bfa','#f0b429','#ff4d6a','#34d399','#fb923c','#60a5fa','#f472b6','#a3e635']

function PieChart({ stats }) {
  if (!stats.length) return null
  const total = stats.reduce((s,i)=>s+i.invested,0)
  if (!total) return null
  const size = 120, cx = size/2, cy = size/2, r = 48, innerR = 28
  let angle = -Math.PI/2
  const slices = stats.map(inv => {
    const pct = inv.invested/total
    const a = pct*2*Math.PI
    const x1 = cx+r*Math.cos(angle), y1 = cy+r*Math.sin(angle)
    const x2 = cx+r*Math.cos(angle+a), y2 = cy+r*Math.sin(angle+a)
    const xi1 = cx+innerR*Math.cos(angle), yi1 = cy+innerR*Math.sin(angle)
    const xi2 = cx+innerR*Math.cos(angle+a), yi2 = cy+innerR*Math.sin(angle+a)
    const large = a>Math.PI?1:0
    const path = `M${xi1},${yi1} L${x1},${y1} A${r},${r},0,${large},1,${x2},${y2} L${xi2},${yi2} A${innerR},${innerR},0,${large},0,${xi1},${yi1} Z`
    angle += a
    return { path, color: inv.color, name: inv.name, pct: pct*100 }
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s,i)=><path key={i} d={s.path} fill={s.color} opacity={.9}/>)}
    </svg>
  )
}

export default function Club() {
  const { club, updateClub, isAdmin, getPortfolio, marketData } = useStore()
  const { positions, cashByBroker } = useMemo(getPortfolio, [getPortfolio])

  const [showInvModal, setShowInvModal] = useState(false)
  const [showContribModal, setShowContribModal] = useState(false)
  const [editInv, setEditInv] = useState(null)
  const [editContrib, setEditContrib] = useState(null)
  const [invForm, setInvForm] = useState({name:'',color:CLUB_COLORS[0]})
  const [contribForm, setContribForm] = useState({investorId:'',month:new Date().toISOString().slice(0,7),amount:''})
  const [clubValOverride, setClubValOverride] = useState('')

  // Auto value: portfolio USD * USD/RON
  const usdRon = marketData['RON=X']?.price
  const totalPortfolio = positions.reduce((s,p)=>s+(p.curValue||0),0) + Object.values(cashByBroker).reduce((s,v)=>s+v,0)
  const autoValueRON = usdRon ? totalPortfolio * usdRon : null
  const displayValue = club.totalValue > 0 ? club.totalValue : (autoValueRON || 0)

  const stats = useMemo(() => {
    const total = club.investors.reduce((s,inv)=>{
      return s + club.contributions.filter(c=>c.investorId===inv.id).reduce((ss,c)=>ss+c.amount,0)
    },0)
    return club.investors.map(inv=>{
      const contribs = club.contributions.filter(c=>c.investorId===inv.id)
      const invested = contribs.reduce((s,c)=>s+c.amount,0)
      const stake = total>0?(invested/total)*100:0
      const curVal = displayValue>0?(stake/100)*displayValue:invested
      const profit = curVal-invested
      const roi = invested>0?(profit/invested)*100:0
      return {...inv,invested,stake,curVal,profit,roi,contribs}
    }).sort((a,b)=>b.invested-a.invested)
  },[club,displayValue])

  const totalInvested = stats.reduce((s,i)=>s+i.invested,0)
  const months = useMemo(()=>[...new Set(club.contributions.map(c=>c.month))].sort().reverse(),[club.contributions])

  const saveInv = () => {
    if (!invForm.name.trim()) return
    const inv = {id:editInv?.id||Date.now(),name:invForm.name.trim(),color:invForm.color}
    const investors = editInv
      ? club.investors.map(i=>i.id===editInv.id?inv:i)
      : [...club.investors,inv]
    updateClub({...club,investors})
    setShowInvModal(false); setEditInv(null); setInvForm({name:'',color:CLUB_COLORS[investors.length%CLUB_COLORS.length]})
  }

  const delInv = id => {
    if (!confirm('Ștergi investitorul și toate contribuțiile lui?')) return
    updateClub({...club,investors:club.investors.filter(i=>i.id!==id),contributions:club.contributions.filter(c=>c.investorId!==id)})
  }

  const saveContrib = () => {
    if (!contribForm.investorId||!contribForm.amount||isNaN(+contribForm.amount)) return
    const c = {id:editContrib?.id||Date.now(),investorId:+contribForm.investorId,month:contribForm.month,amount:+contribForm.amount}
    const contributions = editContrib
      ? club.contributions.map(x=>x.id===editContrib.id?c:x)
      : [...club.contributions,c]
    updateClub({...club,contributions})
    setShowContribModal(false); setEditContrib(null); setContribForm(f=>({...f,amount:''}))
  }

  const openContrib = (inv, month, existing) => {
    setEditContrib(existing||null)
    setContribForm({investorId:String(inv.id),month:month||new Date().toISOString().slice(0,7),amount:existing?String(existing.amount):''})
    setShowContribModal(true)
  }

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:700,marginBottom:2}}>{club.name}</h2>
          <div style={{fontSize:12,color:'var(--text3)'}}>{club.investors.length} investitori · {months.length} luni de contribuții</div>
        </div>
        {isAdmin&&<div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>{setEditInv(null);setInvForm({name:'',color:CLUB_COLORS[club.investors.length%CLUB_COLORS.length]});setShowInvModal(true)}}>+ Investitor</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>{setEditContrib(null);setContribForm({investorId:club.investors[0]?.id||'',month:new Date().toISOString().slice(0,7),amount:''});setShowContribModal(true)}}>+ Contribuție</button>
        </div>}
      </div>

      {/* Value banner */}
      <div className="card" style={{padding:'18px 20px',marginBottom:20,background:'linear-gradient(135deg,rgba(77,159,255,0.08),rgba(167,139,250,0.08))',borderColor:'var(--blue-b)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
          <div>
            <div className="label" style={{marginBottom:6,color:'var(--blue)'}}>Valoare Actuală Club (RON)</div>
            <div className="mono" style={{fontSize:26,fontWeight:700,color:'var(--blue)'}}>
              {fmtC(displayValue,'RON')}
            </div>
            {displayValue>0&&totalInvested>0&&<div className={`mono ${pnlClass(displayValue-totalInvested)}`} style={{fontSize:13,marginTop:4}}>
              {fmtC(displayValue-totalInvested,'RON')} · {fmtPct((displayValue-totalInvested)/totalInvested*100)}
            </div>}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8,alignItems:'flex-end'}}>
            {autoValueRON&&<div style={{fontSize:11,color:'var(--blue)',fontFamily:'var(--mono)',background:'var(--blue-bg)',padding:'4px 10px',borderRadius:5,border:'1px solid var(--blue-b)'}}>
              auto: {totalPortfolio.toFixed(0)} USD × {usdRon?.toFixed(4)} = {autoValueRON.toFixed(0)} RON
            </div>}
            {isAdmin&&<div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input className="input mono" type="number" placeholder="Override RON..." value={clubValOverride}
                onChange={e=>setClubValOverride(e.target.value)} style={{width:160,fontSize:12}}
                onKeyDown={e=>e.key==='Enter'&&(updateClub({...club,totalValue:+clubValOverride}),setClubValOverride(''))}/>
              <button className="btn btn-primary btn-sm" onClick={()=>{updateClub({...club,totalValue:+clubValOverride});setClubValOverride('')}}>Set</button>
              {club.totalValue>0&&<button className="btn btn-ghost btn-sm" onClick={()=>updateClub({...club,totalValue:0})}>Auto</button>}
            </div>}
          </div>
        </div>
      </div>

      {club.investors.length===0&&(
        <div className="card" style={{padding:'60px 20px',textAlign:'center'}}>
          <div style={{fontSize:40,marginBottom:12}}>🤝</div>
          <div style={{fontWeight:600,marginBottom:6}}>Niciun investitor</div>
          <div style={{color:'var(--text3)',fontSize:13}}>Adaugă investitori pentru a urmări contribuțiile clubului.</div>
        </div>
      )}

      {club.investors.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:16,marginBottom:20,alignItems:'start'}}>
          {/* Pie chart */}
          <div className="card" style={{padding:16,display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
            <PieChart stats={stats}/>
            <div style={{display:'flex',flexDirection:'column',gap:6,width:'100%'}}>
              {stats.map(inv=>(
                <div key={inv.id} style={{display:'flex',alignItems:'center',gap:6,fontSize:11}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:inv.color,flexShrink:0}}/>
                  <span style={{flex:1,color:'var(--text2)'}}>{inv.name}</span>
                  <span className="mono" style={{color:'var(--text3)'}}>{inv.stake.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Investor stats table */}
          <div className="card" style={{overflow:'hidden'}}>
            <div style={{overflowX:'auto'}}>
              <table className="data-table" style={{minWidth:500}}>
                <thead><tr>
                  <th>Investitor</th>
                  <th style={{textAlign:'right'}}>Investit</th>
                  <th style={{textAlign:'right'}}>Stake %</th>
                  <th style={{textAlign:'right'}}>Val. Actuală</th>
                  <th style={{textAlign:'right'}}>Profit</th>
                  <th style={{textAlign:'right'}}>ROI</th>
                  {isAdmin&&<th/>}
                </tr></thead>
                <tbody>
                  {stats.map(inv=>(
                    <tr key={inv.id}>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{width:10,height:10,borderRadius:'50%',background:inv.color,flexShrink:0}}/>
                          <span style={{fontWeight:600}}>{inv.name}</span>
                        </div>
                      </td>
                      <td style={{textAlign:'right',fontFamily:'var(--mono)',fontSize:12}}>{fmtC(inv.invested,'RON')}</td>
                      <td style={{textAlign:'right',fontFamily:'var(--mono)',fontSize:12}}>{inv.stake.toFixed(1)}%</td>
                      <td style={{textAlign:'right',fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',fontWeight:600}}>{fmtC(inv.curVal,'RON')}</td>
                      <td style={{textAlign:'right'}}>
                        <span className={`mono ${pnlClass(inv.profit)}`} style={{fontSize:12,fontWeight:600}}>{fmtC(inv.profit,'RON')}</span>
                      </td>
                      <td style={{textAlign:'right'}}>
                        <span className={`mono ${pnlClass(inv.roi)}`} style={{fontSize:12,fontWeight:600}}>{fmtPct(inv.roi)}</span>
                      </td>
                      {isAdmin&&<td>
                        <div style={{display:'flex',gap:4}}>
                          <button className="btn btn-ghost btn-sm" onClick={()=>{setEditInv(inv);setInvForm({name:inv.name,color:inv.color});setShowInvModal(true)}}>✏</button>
                          <button className="btn btn-danger btn-sm" onClick={()=>delInv(inv.id)}>✕</button>
                        </div>
                      </td>}
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td style={{fontFamily:'var(--mono)',fontSize:11}}>TOTAL</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:700}}>{fmtC(totalInvested,'RON')}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)'}}>100%</td>
                    <td style={{textAlign:'right',fontFamily:'var(--mono)',fontWeight:700,color:'var(--blue)'}}>{fmtC(displayValue,'RON')}</td>
                    <td style={{textAlign:'right'}}><span className={`mono ${pnlClass(displayValue-totalInvested)}`} style={{fontWeight:700}}>{fmtC(displayValue-totalInvested,'RON')}</span></td>
                    <td style={{textAlign:'right'}}><span className={`mono ${pnlClass(displayValue-totalInvested)}`} style={{fontWeight:700}}>{totalInvested>0?fmtPct((displayValue-totalInvested)/totalInvested*100):'—'}</span></td>
                    {isAdmin&&<td/>}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Contributions table */}
      {months.length>0&&(
        <div className="card" style={{overflow:'hidden'}}>
          <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div className="label">Contribuții Lunare</div>
          </div>
          <div style={{overflowX:'auto'}}>
            <table className="data-table" style={{minWidth:400}}>
              <thead><tr>
                <th>Lună</th>
                {stats.map(inv=><th key={inv.id} style={{textAlign:'right',color:inv.color}}>{inv.name}</th>)}
                <th style={{textAlign:'right'}}>Total</th>
                {isAdmin&&<th/>}
              </tr></thead>
              <tbody>
                {months.map(month=>{
                  const monthTotal = club.contributions.filter(c=>c.month===month).reduce((s,c)=>s+c.amount,0)
                  return (
                    <tr key={month}>
                      <td style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:600}}>{month}</td>
                      {stats.map(inv=>{
                        const c = club.contributions.find(x=>x.investorId===inv.id&&x.month===month)
                        return (
                          <td key={inv.id} style={{textAlign:'right'}}>
                            {c ? <span style={{fontFamily:'var(--mono)',fontSize:12,color:inv.color,fontWeight:600}}>{fmtC(c.amount,'RON')}</span>
                              : <span style={{color:'var(--text3)'}}>—</span>}
                          </td>
                        )
                      })}
                      <td style={{textAlign:'right',fontFamily:'var(--mono)',fontSize:12,fontWeight:700}}>{fmtC(monthTotal,'RON')}</td>
                      {isAdmin&&<td>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          {stats.map(inv=>{
                            const c = club.contributions.find(x=>x.investorId===inv.id&&x.month===month)
                            return c?(
                              <button key={inv.id} className="btn btn-ghost btn-sm" style={{fontSize:9,padding:'2px 5px',color:inv.color,borderColor:inv.color}} onClick={()=>openContrib(inv,month,c)}>
                                ✏{inv.name}
                              </button>
                            ):null
                          })}
                          <button className="btn btn-ghost btn-sm" style={{fontSize:9,padding:'2px 5px'}} onClick={()=>{setEditContrib(null);setContribForm({investorId:stats[0]?.id||'',month,amount:''});setShowContribModal(true)}}>+ Add</button>
                        </div>
                      </td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Investor Modal */}
      {showInvModal&&isAdmin&&(
        <div className="overlay" onClick={()=>setShowInvModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:360}}>
            <div className="modal-title">{editInv?'✏ Editează Investitor':'+ Investitor Nou'}</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <div className="label" style={{marginBottom:5}}>Nume</div>
                <input className="input" placeholder="Ion Popescu" value={invForm.name} onChange={e=>setInvForm(f=>({...f,name:e.target.value}))} autoFocus/>
              </div>
              <div>
                <div className="label" style={{marginBottom:8}}>Culoare</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {CLUB_COLORS.map(c=>(
                    <div key={c} onClick={()=>setInvForm(f=>({...f,color:c}))} style={{
                      width:28,height:28,borderRadius:'50%',background:c,cursor:'pointer',
                      border:`3px solid ${invForm.color===c?'white':'transparent'}`,transition:'transform .15s',
                    }} onMouseEnter={e=>e.target.style.transform='scale(1.2)'} onMouseLeave={e=>e.target.style.transform=''}/>
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

      {/* Add/Edit Contribution Modal */}
      {showContribModal&&isAdmin&&(
        <div className="overlay" onClick={()=>setShowContribModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:360}}>
            <div className="modal-title">{editContrib?'✏ Editează Contribuție':'+ Contribuție'}</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <div className="label" style={{marginBottom:5}}>Investitor</div>
                <select className="select" value={contribForm.investorId} onChange={e=>setContribForm(f=>({...f,investorId:e.target.value}))}>
                  {club.investors.map(inv=><option key={inv.id} value={inv.id}>{inv.name}</option>)}
                </select>
              </div>
              <div>
                <div className="label" style={{marginBottom:5}}>Lună</div>
                <input className="input" type="month" value={contribForm.month} onChange={e=>setContribForm(f=>({...f,month:e.target.value}))}/>
              </div>
              <div>
                <div className="label" style={{marginBottom:5}}>Sumă (RON)</div>
                <input className="input mono" type="number" placeholder="500" min="0" step="any" value={contribForm.amount} onChange={e=>setContribForm(f=>({...f,amount:e.target.value}))}/>
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
