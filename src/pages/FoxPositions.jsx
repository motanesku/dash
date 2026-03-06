import { useMemo, useState, useEffect } from 'react'
import useStore from '../lib/store.js'
import { fmtC, fmtPct, pnlClass, fmtDate } from '../lib/portfolio.js'


const STICKY   = { position:'sticky', left:0, zIndex:2, background:'var(--surface)' }
const STICKY_H = { position:'sticky', left:0, zIndex:3, background:'var(--bg2)' }

const CAPS    = ['Large Cap','Mid Cap','Small Cap','Micro Cap']
const SECTORS = ['Tech','Finance','Health','Energy','Consumer','Industrial','Materials','Utilities','Real Estate','Telecom','Other']
const S_ICON  = {'Tech':'💻','Finance':'🏦','Health':'🏥','Energy':'⚡','Consumer':'🛍','Industrial':'🏭','Materials':'⛏','Utilities':'💡','Real Estate':'🏢','Telecom':'📡','Other':'·'}
const CAP_COLORS = { 'Large Cap':'var(--blue)','Mid Cap':'var(--green)','Small Cap':'var(--gold)','Micro Cap':'var(--red)' }

// ── Modal ─────────────────────────────────────────────────
function FoxModal({ item, prices, companyInfo, onSave, onClose }) {
  const [form, setForm] = useState(item ? {...item} : {
    id: Date.now(), symbol:'', name:'', sector:'', cap:'', domain:'',
    shares:0, avgPrice:0, buyMin:'', sellMin:'', sellMax:'', notes:''
  })
  const [autoLoading, setAutoLoading] = useState(false)
  const [err, setErr] = useState('')

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const setN = k => e => setForm(f=>({...f,[k]:+e.target.value||0}))

  // Auto-fetch company info when symbol changes
  useEffect(() => {
    if (!form.symbol || form.symbol.length < 1) return
    const sym = form.symbol.toUpperCase().trim()
    // Use cached info
    const cached = companyInfo[sym]
    if (cached?.sector) {
      setForm(f=>({...f,
        sector: f.sector||cached.sector,
        cap: f.cap||cached.cap,
        domain: f.domain||cached.domain||cached.industry,
        name: f.name||''
      }))
    }
    // Also get name from prices
    const pData = prices[sym]
    if (pData?.name) setForm(f=>({...f, name: f.name||pData.name}))
  }, [form.symbol, companyInfo, prices])

  const fetchInfo = async () => {
    const sym = form.symbol.toUpperCase().trim()
    if (!sym) return
    setAutoLoading(true)
    try {
      const { fetchCompanyInfo } = await import('../lib/prices.js')
      const info = await fetchCompanyInfo([sym])
      if (info[sym]) {
        const i = info[sym]
        setForm(f=>({...f,
          sector: i.sector||f.sector,
          cap: i.cap||f.cap,
          domain: i.domain||i.industry||f.domain,
        }))
      }
    } catch {}
    setAutoLoading(false)
  }

  const cur = prices[form.symbol?.toUpperCase()]?.price
  const cost = form.shares * form.avgPrice
  const profit = cur ? (cur - form.avgPrice) * form.shares : null
  const roi = form.avgPrice>0&&cur ? ((cur-form.avgPrice)/form.avgPrice)*100 : null

  const submit = () => {
    if (!form.symbol.trim()) { setErr('Symbol obligatoriu'); return }
    if (!form.shares || form.shares<=0) { setErr('Nr. acțiuni obligatoriu'); return }
    if (!form.avgPrice || form.avgPrice<=0) { setErr('Preț mediu obligatoriu'); return }
    onSave({...form, symbol: form.symbol.toUpperCase().trim(), id: form.id||Date.now()})
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520,width:'95vw'}}>
        <div className="modal-title">{item?'✏ Editează FOX':'🦊 Poziție FOX Nouă'}</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>

          {/* Companie */}
          <div style={{background:'var(--surface2)',borderRadius:8,padding:12}}>
            <div className="label" style={{marginBottom:10,color:'var(--blue)'}}>INFORMAȚII COMPANIE</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,marginBottom:10}}>
              <input className="input mono" placeholder="Symbol (ex: AAPL)" value={form.symbol}
                onChange={e=>setForm(f=>({...f,symbol:e.target.value.toUpperCase()}))}
                onBlur={fetchInfo}/>
              <button className="btn btn-ghost btn-sm" onClick={fetchInfo} disabled={autoLoading} style={{whiteSpace:'nowrap'}}>
                {autoLoading?'...':'⟳ Auto'}
              </button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <div className="label" style={{marginBottom:4}}>Nume</div>
                <input className="input" placeholder="Apple Inc." value={form.name} onChange={set('name')}/>
              </div>
              <div>
                <div className="label" style={{marginBottom:4}}>Domeniu / Industrie</div>
                <input className="input" placeholder="ex: Cloud Computing" value={form.domain} onChange={set('domain')}/>
              </div>
              <div>
                <div className="label" style={{marginBottom:4}}>Sector</div>
                <select className="select" value={form.sector} onChange={set('sector')}>
                  <option value="">—</option>
                  {SECTORS.map(s=><option key={s} value={s}>{S_ICON[s]} {s}</option>)}
                </select>
              </div>
              <div>
                <div className="label" style={{marginBottom:4}}>Capitalizare</div>
                <select className="select" value={form.cap} onChange={set('cap')}>
                  <option value="">—</option>
                  {CAPS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Dețiteri */}
          <div style={{background:'var(--surface2)',borderRadius:8,padding:12}}>
            <div className="label" style={{marginBottom:10,color:'var(--green)'}}>DEȚITERI</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <div className="label" style={{marginBottom:4}}>Nr. Acțiuni *</div>
                <input className="input mono" type="number" min="0" step="any" placeholder="10" value={form.shares||''} onChange={setN('shares')}/>
              </div>
              <div>
                <div className="label" style={{marginBottom:4}}>Preț Mediu *</div>
                <input className="input mono" type="number" min="0" step="any" placeholder="150.00" value={form.avgPrice||''} onChange={setN('avgPrice')}/>
              </div>
            </div>
            {cost>0&&<div style={{marginTop:8,fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>
              Cost: <span style={{color:'var(--text)',fontWeight:600}}>{fmtC(cost)}</span>
              {cur!=null&&<> · Profit: <span className={pnlClass(profit)} style={{fontWeight:600}}>{fmtC(profit)}</span> · ROI: <span className={pnlClass(roi)} style={{fontWeight:600}}>{fmtPct(roi)}</span></>}
            </div>}
          </div>

          {/* Obiectiv */}
          <div style={{background:'var(--surface2)',borderRadius:8,padding:12}}>
            <div className="label" style={{marginBottom:10,color:'var(--gold)'}}>OBIECTIV</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
              <div>
                <div className="label" style={{marginBottom:4}}>Buy Min (≤)</div>
                <input className="input mono" type="number" min="0" step="any" placeholder="sub..." value={form.buyMin||''} onChange={setN('buyMin')}/>
              </div>
              <div>
                <div className="label" style={{marginBottom:4}}>Sell Min</div>
                <input className="input mono" type="number" min="0" step="any" placeholder="de la..." value={form.sellMin||''} onChange={setN('sellMin')}/>
              </div>
              <div>
                <div className="label" style={{marginBottom:4}}>Sell Max</div>
                <input className="input mono" type="number" min="0" step="any" placeholder="până la..." value={form.sellMax||''} onChange={setN('sellMax')}/>
              </div>
            </div>
          </div>

          {err&&<div style={{color:'var(--red)',fontSize:12,padding:'8px 12px',background:'var(--red-bg)',borderRadius:6,border:'1px solid var(--red-b)'}}>{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Anulează</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={submit}>Salvează</button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────
export default function FoxPositions() {
  const { foxData, setFoxData, prices, companyInfo, fetchCompanyInfo, isAdmin } = useStore()
  const [sortBy,       setSortBy]       = useState('pondere')
  const [showModal,    setShowModal]    = useState(false)
  const [editItem,     setEditItem]     = useState(null)
  const [filterSector, setFilterSector] = useState('ALL')
  const [view,         setView]         = useState('open')

  // Fetch company info for new symbols
  useEffect(() => {
    const syms = foxData.map(f=>f.symbol).filter(s=>!companyInfo[s]||!companyInfo[s].sector)
    if (syms.length) fetchCompanyInfo(syms)
  }, [foxData.map(f=>f.symbol).join(',')])

  // Enrich with live prices + companyInfo
  const enriched = useMemo(() => foxData.map(f => {
    const cur    = prices[f.symbol]?.price ?? null
    const prev   = prices[f.symbol]?.prev  ?? null
    const info   = companyInfo[f.symbol]   || {}
    const cost   = f.shares * f.avgPrice
    const curVal = cur != null ? cur * f.shares : null
    const profit = curVal != null ? curVal - cost : null
    const roi    = f.avgPrice>0&&cur!=null ? ((cur-f.avgPrice)/f.avgPrice)*100 : null
    const dayChg = cur&&prev ? ((cur-prev)/prev)*100 : null
    const inBuyZone = cur!=null && f.buyMin && cur <= f.buyMin
    const inSellZone = cur!=null && f.sellMin && cur >= f.sellMin
    return {
      ...f,
      // Auto-fill from companyInfo if not set manually
      sector: f.sector || info.sector || '',
      cap:    f.cap    || info.cap    || '',
      domain: f.domain || info.domain || info.industry || '',
      name:   f.name   || prices[f.symbol]?.name || f.symbol,
      cur, cost, curVal, profit, roi, dayChg, inBuyZone, inSellZone,
      pondere: 0, // computed below
    }
  }), [foxData, prices, companyInfo])

  const totalCost = enriched.reduce((s,f)=>s+f.cost,0)
  const withPondere = enriched.map(f=>({...f, pondere: totalCost>0?(f.cost/totalCost)*100:0}))

  // Split open / closed  — treat shares>0 as open
  const openFox   = withPondere.filter(f => f.shares > 0)
  const closedFox = withPondere.filter(f => f.shares <= 0)

  const filtered = useMemo(() => {
    const arr = (view==='open'?openFox:closedFox).filter(f => filterSector==='ALL'||f.sector===filterSector)
    return [...arr].sort((a,b) => {
      if(sortBy==='pondere') return b.pondere - a.pondere
      if(sortBy==='profit')  return (b.profit||0) - (a.profit||0)
      if(sortBy==='roi')     return (b.roi||0) - (a.roi||0)
      if(sortBy==='symbol')  return a.symbol.localeCompare(b.symbol)
      return 0
    })
  }, [openFox, closedFox, view, filterSector, sortBy])

  const totalProfit = openFox.reduce((s,f)=>s+(f.profit||0),0)
  const totalVal    = openFox.reduce((s,f)=>s+(f.curVal||0),0)
  const totalRoi    = totalCost>0 ? (totalProfit/totalCost)*100 : 0
  const uniqueSectors = ['ALL',...new Set(foxData.map(f=>f.sector).filter(Boolean))]

  const saveFox = (item) => {
    const next = editItem ? foxData.map(f=>f.id===editItem.id?item:f) : [...foxData,item]
    setFoxData(next)
    setEditItem(null)
  }
  const deleteFox = (id) => { if(confirm('Ștergi?')) setFoxData(foxData.filter(f=>f.id!==id)) }

  const SortBtn = ({val,label}) => (
    <button onClick={()=>setSortBy(val)} style={{
      padding:'3px 8px',borderRadius:4,border:'none',cursor:'pointer',fontSize:10,fontFamily:'var(--mono)',fontWeight:600,
      background:sortBy===val?'var(--blue)':'var(--surface2)',
      color:sortBy===val?'#fff':'var(--text3)',transition:'all .15s',
    }}>{label}</button>
  )

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14,flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontSize:16,fontWeight:700,color:'var(--text)',marginBottom:4}}>
            🦊 Poziții FOX
            <span style={{fontSize:11,fontWeight:400,color:'var(--text3)',marginLeft:8}}>watchlist independent · sincronizat cloud</span>
          </h2>
          <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>
            {openFox.length} deschise · cost {fmtC(totalCost)} · val {fmtC(totalVal)} ·{' '}
            <span className={pnlClass(totalProfit)} style={{fontWeight:600}}>{fmtPct(totalRoi)}</span>
          </div>
        </div>
        {isAdmin&&(
          <button className="btn btn-primary btn-sm" onClick={()=>{setEditItem(null);setShowModal(true)}}>+ Adaugă</button>
        )}
      </div>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:16}}>
        {[
          {label:'Cost Total',    val:fmtC(totalCost),   accent:'var(--text3)',  v:null},
          {label:'Valoare',       val:fmtC(totalVal),    accent:'var(--blue)',   v:null},
          {label:'Profit',        val:fmtC(totalProfit), accent:totalProfit>=0?'var(--green)':'var(--red)', v:totalProfit},
          {label:'ROI',           val:fmtPct(totalRoi),  accent:totalRoi>=0?'var(--green)':'var(--red)',   v:totalRoi},
        ].map(c=>(
          <div key={c.label} className="card" style={{padding:'12px 16px',borderLeft:`3px solid ${c.accent}`}}>
            <div className="label" style={{marginBottom:6}}>{c.label}</div>
            <div className={`mono ${c.v!=null?pnlClass(c.v):''}`} style={{fontSize:16,fontWeight:700}}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        {[{id:'open',label:`▶ Deschise (${openFox.length})`},{id:'closed',label:`✓ Închise (${closedFox.length})`}].map(t=>(
          <button key={t.id} onClick={()=>setView(t.id)} style={{
            padding:'5px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,
            background:view===t.id?'var(--blue)':'var(--surface2)',
            color:view===t.id?'#fff':'var(--text3)',transition:'all .15s',
          }}>{t.label}</button>
        ))}
        {uniqueSectors.length>1&&uniqueSectors.map(s=>(
          <button key={s} onClick={()=>setFilterSector(s)} style={{
            padding:'3px 8px',borderRadius:4,border:'none',cursor:'pointer',fontSize:10,fontWeight:600,
            background:filterSector===s?'var(--purple)':'var(--surface2)',
            color:filterSector===s?'#fff':'var(--text3)',transition:'all .15s',
          }}>{s==='ALL'?'Toate':`${S_ICON[s]||''} ${s}`}</button>
        ))}
        <div style={{marginLeft:'auto',display:'flex',gap:5,alignItems:'center'}}>
          <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>SORT:</span>
          <SortBtn val="pondere" label="PONDERE"/>
          <SortBtn val="profit"  label="PROFIT"/>
          <SortBtn val="roi"     label="ROI"/>
          <SortBtn val="symbol"  label="A-Z"/>
        </div>
      </div>

      {foxData.length===0&&(
        <div className="card" style={{padding:'60px 20px',textAlign:'center'}}>
          <div style={{fontSize:40,marginBottom:12}}>🦊</div>
          <div style={{fontWeight:600,fontSize:16,marginBottom:6}}>Nicio poziție FOX</div>
          <div style={{color:'var(--text3)',fontSize:13}}>Adaugă poziții de urmărit independent.</div>
        </div>
      )}

      {filtered.length>0&&(
        <div className="card" style={{overflow:'hidden'}}>
          <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
            <table className="data-table" style={{minWidth:860}}>
              <thead>
                <tr>
                  <th colSpan={2} style={{background:'var(--surface3)',color:'var(--text3)',borderRight:'1px solid var(--border2)'}}>COMPANIE</th>
                  <th colSpan={3} style={{background:'var(--surface2)',color:'var(--green)',borderRight:'1px solid var(--border2)'}}>DEȚITERI</th>
                  <th colSpan={2} style={{background:'var(--surface3)',color:'var(--gold)',borderRight:'1px solid var(--border2)'}}>OBIECTIV</th>
                  <th colSpan={3} style={{background:'var(--surface2)',color:'var(--blue)'}}>ACTUAL</th>
                  {isAdmin&&<th style={{background:'var(--surface2)'}}/>}
                </tr>
                <tr>
                  <th style={STICKY_H}>Symbol</th>
                  <th style={{borderRight:'1px solid var(--border2)'}}>Domeniu · Sector · Cap</th>
                  <th>Acțiuni</th>
                  <th>Preț Mediu</th>
                  <th style={{borderRight:'1px solid var(--border2)'}}>Pondere</th>
                  <th>Buy Min</th>
                  <th style={{borderRight:'1px solid var(--border2)'}}>Sell Min–Max</th>
                  <th>Preț Actual</th>
                  <th style={{textAlign:'right'}}>Profit</th>
                  <th style={{textAlign:'right'}}>ROI</th>
                  {isAdmin&&<th/>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(f=>(
                  <tr key={f.id} style={{
                    background: f.inBuyZone?'rgba(0,212,170,0.04)':f.inSellZone?'rgba(240,180,41,0.04)':'',
                  }}>
                    <td style={{...STICKY, borderRight:'1px solid var(--border)'}}>
                      <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13,color:'var(--text)'}}>{f.symbol}</div>
                      <div style={{fontSize:10,color:'var(--text3)',marginTop:1}}>{f.name}</div>
                    </td>
                    <td style={{borderRight:'1px solid var(--border)'}}>
                      <div style={{fontSize:11,color:'var(--blue)',fontWeight:500}}>{f.domain||'—'}</div>
                      <div style={{display:'flex',gap:4,marginTop:3,flexWrap:'wrap'}}>
                        {f.sector&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:'var(--surface2)',color:'var(--text3)',border:'1px solid var(--border)'}}>{S_ICON[f.sector]||''} {f.sector}</span>}
                        {f.cap&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:'var(--surface2)',color:CAP_COLORS[f.cap]||'var(--text3)',border:`1px solid ${CAP_COLORS[f.cap]||'var(--border)'}40`}}>{f.cap}</span>}
                      </div>
                    </td>
                    <td><span className="mono" style={{fontSize:12}}>{f.shares}</span></td>
                    <td><span className="mono" style={{fontSize:12}}>{fmtC(f.avgPrice)}</span></td>
                    <td style={{borderRight:'1px solid var(--border)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <div style={{flex:1,height:4,background:'var(--surface2)',borderRadius:2,minWidth:36}}>
                          <div style={{height:'100%',width:`${Math.min(f.pondere,100)}%`,background:'var(--blue)',borderRadius:2}}/>
                        </div>
                        <span className="mono" style={{fontSize:11,fontWeight:600,color:'var(--blue)',minWidth:34,textAlign:'right'}}>{f.pondere.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td>
                      {f.inBuyZone&&<span className="badge badge-green" style={{fontSize:9,marginRight:4}}>🟢 BUY</span>}
                      <span className="mono" style={{fontSize:11,color:'var(--gold)'}}>{f.buyMin?`≤${f.buyMin}`:'—'}</span>
                    </td>
                    <td style={{borderRight:'1px solid var(--border)'}}>
                      {f.inSellZone&&<span className="badge badge-gold" style={{fontSize:9,marginRight:4}}>⚡ SELL</span>}
                      <span className="mono" style={{fontSize:11,color:'var(--purple)'}}>
                        {f.sellMin&&f.sellMax?`${f.sellMin}–${f.sellMax}`:f.sellMin?`≥${f.sellMin}`:f.sellMax?`≤${f.sellMax}`:'—'}
                      </span>
                    </td>
                    <td>
                      <div className="mono" style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{f.cur!=null?fmtC(f.cur):'—'}</div>
                      {f.dayChg!=null&&<div className={`mono ${pnlClass(f.dayChg)}`} style={{fontSize:10}}>{fmtPct(f.dayChg)}</div>}
                    </td>
                    <td style={{textAlign:'right'}}>
                      <span className={`mono ${pnlClass(f.profit)}`} style={{fontSize:12,fontWeight:600}}>{f.profit!=null?fmtC(f.profit):'—'}</span>
                    </td>
                    <td style={{textAlign:'right'}}>
                      <span className={`mono ${pnlClass(f.roi)}`} style={{fontSize:13,fontWeight:700}}>{f.roi!=null?fmtPct(f.roi):'—'}</span>
                    </td>
                    {isAdmin&&<td>
                      <div style={{display:'flex',gap:4}}>
                        <button className="btn btn-ghost btn-sm" style={{padding:'3px 7px'}} onClick={()=>{setEditItem(f);setShowModal(true)}}>✏</button>
                        <button className="btn btn-danger btn-sm" style={{padding:'3px 7px'}} onClick={()=>deleteFox(f.id)}>✕</button>
                      </div>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal&&isAdmin&&(
        <FoxModal
          item={editItem}
          prices={prices}
          companyInfo={companyInfo}
          onSave={saveFox}
          onClose={()=>{setShowModal(false);setEditItem(null)}}
        />
      )}
    </div>
  )
}
