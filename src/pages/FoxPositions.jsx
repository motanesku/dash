import { useMemo, useState, useEffect } from 'react'
import useStore from '../lib/store.js'
import { fmtC, fmtPct, pnlClass, fmtDate } from '../lib/portfolio.js'
import CompanyInfoSection, { SECTOR_ICONS as S_ICON, CAP_COLORS, SECTORS, CAPS } from '../components/CompanyInfoSection.jsx'

const STICKY   = { position:'sticky', left:0, zIndex:2, background:'var(--surface)' }
const STICKY_H = { position:'sticky', left:0, zIndex:3, background:'var(--bg2)' }


// ── Modal: Poziție Deschisă ───────────────────────────────
function OpenFoxModal({ item, prices, companyInfo, fetchCompanyInfo, onSave, onClose }) {
  const [form, setForm] = useState(item ? {...item} : {
    id:Date.now(), symbol:'', name:'', sector:'', cap:'', domain:'',
    shares:0, avgPrice:0, buyMin:'', sellMin:'', sellMax:'', notes:'',
    status:'open',
  })
  const [err, setErr] = useState('')
  const setN = k => e => setForm(f=>({...f,[k]:+e.target.value||0}))
  const set  = k => e => setForm(f=>({...f,[k]:e.target.value}))

  const cur    = prices[form.symbol?.toUpperCase()]?.price
  const cost   = (form.shares||0) * (form.avgPrice||0)
  const profit = cur!=null ? (cur - (form.avgPrice||0)) * (form.shares||0) : null
  const roi    = form.avgPrice>0&&cur!=null ? ((cur-form.avgPrice)/form.avgPrice)*100 : null

  const submit = () => {
    if (!form.symbol?.trim())              { setErr('Symbol obligatoriu'); return }
    if (!form.shares || form.shares<=0)    { setErr('Nr. acțiuni obligatoriu'); return }
    if (!form.avgPrice || form.avgPrice<=0){ setErr('Preț mediu obligatoriu'); return }
    onSave({...form, symbol:form.symbol.toUpperCase().trim(), id:form.id||Date.now(), status:'open'})
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520,width:'95vw'}}>
        <div className="modal-title">{item?'✏ Editează FOX':'🦊 Poziție FOX — Deschisă'}</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <CompanyInfoSection form={form} setForm={setForm} prices={prices} companyInfo={companyInfo} fetchCompanyInfo={fetchCompanyInfo}/>

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
              {profit!=null&&<> · Profit: <span className={pnlClass(profit)} style={{fontWeight:600}}>{fmtC(profit)}</span> · ROI: <span className={pnlClass(roi)} style={{fontWeight:600}}>{fmtPct(roi)}</span></>}
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

// ── Modal: Poziție Închisă ────────────────────────────────
function ClosedFoxModal({ item, prices, companyInfo, fetchCompanyInfo, onSave, onClose }) {
  const [form, setForm] = useState(item ? {...item} : {
    id:Date.now(), symbol:'', name:'', sector:'', cap:'', domain:'',
    buyShares:0, buyPrice:0, buyDate:'', buyTotal:0,
    sellShares:0, sellPrice:0, sellDate:'', sellTotal:0,
    profit:0, roi:0, notes:'',
    status:'closed',
  })
  const [err, setErr] = useState('')
  const setN = k => e => {
    const v = +e.target.value||0
    setForm(f=>{
      const next = {...f,[k]:v}
      // Auto-calc totals and profit
      const buyTotal  = (k==='buyShares'?v:next.buyShares)  * (k==='buyPrice'?v:next.buyPrice)
      const sellTotal = (k==='sellShares'?v:next.sellShares) * (k==='sellPrice'?v:next.sellPrice)
      const profit    = sellTotal - buyTotal
      const roi       = buyTotal>0 ? (profit/buyTotal)*100 : 0
      return {...next, buyTotal, sellTotal, profit, roi}
    })
  }
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  const submit = () => {
    if (!form.symbol?.trim())           { setErr('Symbol obligatoriu'); return }
    if (!form.buyShares||!form.buyPrice){ setErr('Datele de cumpărare sunt obligatorii'); return }
    if (!form.sellShares||!form.sellPrice){ setErr('Datele de vânzare sunt obligatorii'); return }
    onSave({...form, symbol:form.symbol.toUpperCase().trim(), id:form.id||Date.now(), status:'closed'})
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:560,width:'95vw'}}>
        <div className="modal-title">{item?'✏ Editează FOX Închisă':'✓ Poziție FOX — Închisă'}</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <CompanyInfoSection form={form} setForm={setForm} prices={prices} companyInfo={companyInfo} fetchCompanyInfo={fetchCompanyInfo}/>

          {/* Buy */}
          <div style={{background:'var(--green-bg)',borderRadius:8,padding:12,border:'1px solid var(--green-b)'}}>
            <div className="label" style={{marginBottom:10,color:'var(--green)'}}>▲ CUMPĂRARE</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
              <div>
                <div className="label" style={{marginBottom:4}}>Nr. Acțiuni</div>
                <input className="input mono" type="number" min="0" step="any" value={form.buyShares||''} onChange={setN('buyShares')}/>
              </div>
              <div>
                <div className="label" style={{marginBottom:4}}>Preț Mediu</div>
                <input className="input mono" type="number" min="0" step="any" value={form.buyPrice||''} onChange={setN('buyPrice')}/>
              </div>
              <div>
                <div className="label" style={{marginBottom:4}}>Data</div>
                <input className="input" type="date" value={form.buyDate||''} onChange={set('buyDate')}/>
              </div>
            </div>
            {form.buyTotal>0&&<div style={{marginTop:6,fontSize:11,fontFamily:'var(--mono)',color:'var(--text3)'}}>
              Total cost: <span style={{color:'var(--text)',fontWeight:600}}>{fmtC(form.buyTotal)}</span>
            </div>}
          </div>

          {/* Sell */}
          <div style={{background:'var(--red-bg)',borderRadius:8,padding:12,border:'1px solid var(--red-b)'}}>
            <div className="label" style={{marginBottom:10,color:'var(--red)'}}>▼ VÂNZARE</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
              <div>
                <div className="label" style={{marginBottom:4}}>Nr. Acțiuni</div>
                <input className="input mono" type="number" min="0" step="any" value={form.sellShares||''} onChange={setN('sellShares')}/>
              </div>
              <div>
                <div className="label" style={{marginBottom:4}}>Preț Vânzare</div>
                <input className="input mono" type="number" min="0" step="any" value={form.sellPrice||''} onChange={setN('sellPrice')}/>
              </div>
              <div>
                <div className="label" style={{marginBottom:4}}>Data</div>
                <input className="input" type="date" value={form.sellDate||''} onChange={set('sellDate')}/>
              </div>
            </div>
            {form.sellTotal>0&&<div style={{marginTop:6,fontSize:11,fontFamily:'var(--mono)',color:'var(--text3)'}}>
              Total vânzare: <span style={{color:'var(--text)',fontWeight:600}}>{fmtC(form.sellTotal)}</span>
            </div>}
          </div>

          {/* Result */}
          {(form.profit!==0||form.roi!==0)&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'10px 14px',background:'var(--surface2)',borderRadius:8}}>
              <div>
                <div className="label" style={{marginBottom:4}}>Profit</div>
                <div className={`mono ${pnlClass(form.profit)}`} style={{fontSize:16,fontWeight:700}}>{fmtC(form.profit)}</div>
              </div>
              <div>
                <div className="label" style={{marginBottom:4}}>ROI</div>
                <div className={`mono ${pnlClass(form.roi)}`} style={{fontSize:16,fontWeight:700}}>{fmtPct(form.roi)}</div>
              </div>
            </div>
          )}

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
  const [sortBy,        setSortBy]        = useState('pondere')
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showClosedModal,setShowClosedModal] = useState(false)
  const [editItem,      setEditItem]      = useState(null)
  const [view,          setView]          = useState('open')

  // Company info introdusă manual — nu mai facem auto-fetch Yahoo

  // Separate open vs closed
  const openFox   = useMemo(() => foxData.filter(f => f.status!=='closed'), [foxData])
  const closedFox = useMemo(() => foxData.filter(f => f.status==='closed'), [foxData])

  // Enrich open positions
  const enrichedOpen = useMemo(() => {
    const totalCost = openFox.reduce((s,f)=>s+((f.shares||0)*(f.avgPrice||0)),0)
    return openFox.map(f=>{
      const cur    = prices[f.symbol]?.price ?? null
      const prev   = prices[f.symbol]?.prev  ?? null
      const info   = companyInfo[f.symbol]   || {}
      const cost   = (f.shares||0) * (f.avgPrice||0)
      const curVal = cur!=null ? cur*(f.shares||0) : null
      const profit = curVal!=null ? curVal-cost : null
      const roi    = f.avgPrice>0&&cur!=null ? ((cur-f.avgPrice)/f.avgPrice)*100 : null
      const dayChg = cur&&prev ? ((cur-prev)/prev)*100 : null
      const pondere = totalCost>0 ? (cost/totalCost)*100 : 0
      const inBuyZone  = cur!=null&&f.buyMin  ? cur<=f.buyMin  : false
      const inSellZone = cur!=null&&f.sellMin ? cur>=f.sellMin : false
      return {...f,
        sector:   f.sector   || info.sector   || '',
        cap:      f.cap      || info.cap      || '',
        industry: f.industry || info.industry || '',
        domain:   f.domain   || info.domain   || '',
        name:   f.name||prices[f.symbol]?.name||f.symbol,
        cur, cost, curVal, profit, roi, dayChg, pondere, inBuyZone, inSellZone,
      }
    })
  }, [openFox, prices, companyInfo])

  const totalOpenCost   = enrichedOpen.reduce((s,f)=>s+f.cost,0)
  const totalOpenVal    = enrichedOpen.reduce((s,f)=>s+(f.curVal||0),0)
  const totalOpenProfit = enrichedOpen.reduce((s,f)=>s+(f.profit||0),0)
  const totalOpenRoi    = totalOpenCost>0 ? (totalOpenProfit/totalOpenCost)*100 : 0

  const totalClosedProfit = closedFox.reduce((s,f)=>s+(f.profit||0),0)
  const totalClosedCost   = closedFox.reduce((s,f)=>s+(f.buyTotal||0),0)
  const totalClosedRoi    = totalClosedCost>0 ? (totalClosedProfit/totalClosedCost)*100 : 0

  const filteredOpen = useMemo(()=>{
    return [...enrichedOpen].sort((a,b)=>{
      if(sortBy==='pondere') return b.pondere-a.pondere
      if(sortBy==='profit')  return (b.profit||0)-(a.profit||0)
      if(sortBy==='roi')     return (b.roi||0)-(a.roi||0)
      if(sortBy==='symbol')  return a.symbol.localeCompare(b.symbol)
      return 0
    })
  },[enrichedOpen, sortBy])

  const filteredClosed = useMemo(()=>{
    return [...closedFox].sort((a,b)=>(b.profit||0)-(a.profit||0))
  },[closedFox])

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

  const modalProps = { prices, companyInfo, fetchCompanyInfo, onClose:()=>{setShowOpenModal(false);setShowClosedModal(false);setEditItem(null)} }

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14,flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontSize:16,fontWeight:700,color:'var(--text)',marginBottom:4}}>
            🦊 Poziții FOX
            <span style={{fontSize:11,fontWeight:400,color:'var(--text3)',marginLeft:8}}>watchlist independent · cloud sync</span>
          </h2>
          <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>
            {openFox.length} deschise · {closedFox.length} închise
          </div>
        </div>
        {isAdmin&&(
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>{setEditItem(null);setShowClosedModal(true)}}>✓ Adaugă Închisă</button>
            <button className="btn btn-primary btn-sm" onClick={()=>{setEditItem(null);setShowOpenModal(true)}}>+ Deschisă</button>
          </div>
        )}
      </div>

      {/* Bannere profit nerealizat + realizat - mereu vizibile */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
        <div className="card" style={{padding:'12px 16px',borderLeft:`3px solid ${totalOpenProfit>=0?'var(--green)':'var(--red)'}`}}>
          <div className="label" style={{marginBottom:4,fontSize:9}}>PROFIT NEREALIZAT · FOX</div>
          <div className={`mono ${pnlClass(totalOpenProfit)}`} style={{fontSize:'clamp(12px,3vw,18px)',fontWeight:700,whiteSpace:'nowrap'}}>{fmtC(totalOpenProfit)}</div>
          <div className={`mono ${pnlClass(totalOpenRoi)}`} style={{fontSize:11}}>{fmtPct(totalOpenRoi)} · {openFox.length} poz.</div>
        </div>
        <div className="card" style={{padding:'12px 16px',borderLeft:`3px solid ${totalClosedProfit>=0?'var(--purple)':'var(--red)'}`}}>
          <div className="label" style={{marginBottom:4,fontSize:9}}>PROFIT REALIZAT · FOX</div>
          <div className={`mono ${pnlClass(totalClosedProfit)}`} style={{fontSize:'clamp(12px,3vw,18px)',fontWeight:700,whiteSpace:'nowrap'}}>{fmtC(totalClosedProfit)}</div>
          <div className={`mono ${pnlClass(totalClosedRoi)}`} style={{fontSize:11}}>{fmtPct(totalClosedRoi)} · {closedFox.length} poz.</div>
        </div>
      </div>

      {/* Summary cards detaliu */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8,marginBottom:16}}>
        {(view==='open'?[
          {label:'Cost Total',val:fmtC(totalOpenCost),accent:'var(--text3)',v:null},
          {label:'Valoare',val:fmtC(totalOpenVal),accent:'var(--blue)',v:null},
        ]:[
          {label:'Cost Cumpărare',val:fmtC(totalClosedCost),accent:'var(--text3)',v:null},
          {label:'Poziții Închise',val:closedFox.length,accent:'var(--purple)',v:null},
        ]).map(c=>(
          <div key={c.label} className="card" style={{padding:'10px 14px',borderLeft:`2px solid ${c.accent}`}}>
            <div className="label" style={{marginBottom:4,fontSize:9}}>{c.label}</div>
            <div className={`mono ${c.v!=null?pnlClass(c.v):''}`} style={{fontSize:'clamp(11px,2.5vw,15px)',fontWeight:700}}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Toggle + sort */}
      <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        {[{id:'open',label:`▶ Deschise (${openFox.length})`},{id:'closed',label:`✓ Închise (${closedFox.length})`}].map(t=>(
          <button key={t.id} onClick={()=>setView(t.id)} style={{
            padding:'5px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,fontWeight:600,
            background:view===t.id?'var(--blue)':'var(--surface2)',
            color:view===t.id?'#fff':'var(--text3)',transition:'all .15s',
          }}>{t.label}</button>
        ))}
        {view==='open'&&<div style={{marginLeft:'auto',display:'flex',gap:5,alignItems:'center'}}>
          <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>SORT:</span>
          <SortBtn val="pondere" label="PONDERE"/>
          <SortBtn val="profit"  label="PROFIT"/>
          <SortBtn val="roi"     label="ROI"/>
          <SortBtn val="symbol"  label="A-Z"/>
        </div>}
      </div>

      {foxData.length===0&&(
        <div className="card" style={{padding:'60px 20px',textAlign:'center'}}>
          <div style={{fontSize:40,marginBottom:12}}>🦊</div>
          <div style={{fontWeight:600,fontSize:16,marginBottom:6}}>Nicio poziție FOX</div>
          <div style={{color:'var(--text3)',fontSize:13}}>Adaugă poziții deschise sau închise independent de portofoliul principal.</div>
        </div>
      )}

      {/* ── OPEN TABLE ── */}
      {view==='open'&&filteredOpen.length>0&&(
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
                  <th style={{borderRight:'1px solid var(--border2)'}}>Domeniu · Cap</th>
                  <th>Acțiuni</th>
                  <th>Preț Mediu</th>
                  <th style={{borderRight:'1px solid var(--border2)'}}>Pondere</th>
                  <th>Buy Min</th>
                  <th style={{borderRight:'1px solid var(--border2)'}}>Sell Min–Max</th>
                  <th>Preț</th>
                  <th style={{textAlign:'right'}}>Profit</th>
                  <th style={{textAlign:'right'}}>ROI</th>
                  {isAdmin&&<th/>}
                </tr>
              </thead>
              <tbody>
                {filteredOpen.map(f=>(
                  <tr key={f.id} style={{background:f.inBuyZone?'rgba(0,212,170,0.04)':f.inSellZone?'rgba(240,180,41,0.04)':''}}>
                    <td style={{...STICKY,borderRight:'1px solid var(--border)'}}>
                      <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13}}>{f.symbol}</div>
                      <div style={{fontSize:10,color:'var(--text3)',whiteSpace:'normal',lineHeight:1.3}}>{f.name}</div>
                    </td>
                    <td style={{borderRight:'1px solid var(--border)'}}>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
                        {f.sector&&<span style={{fontSize:10,color:'var(--blue)',fontWeight:500}}>{S_ICON[f.sector]||''} {f.sector}</span>}
                        {f.industry&&<span style={{fontSize:9,color:'var(--text3)'}}>· {f.industry}</span>}
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
                      {f.inBuyZone&&<span style={{fontSize:9,color:'var(--green)',fontWeight:700,marginRight:4}}>🟢</span>}
                      <span className="mono" style={{fontSize:11,color:'var(--gold)'}}>{f.buyMin?`≤${f.buyMin}`:'—'}</span>
                    </td>
                    <td style={{borderRight:'1px solid var(--border)'}}>
                      {f.inSellZone&&<span style={{fontSize:9,color:'var(--gold)',fontWeight:700,marginRight:4}}>⚡</span>}
                      <span className="mono" style={{fontSize:11,color:'var(--purple)'}}>
                        {f.sellMin&&f.sellMax?`${f.sellMin}–${f.sellMax}`:f.sellMin?`≥${f.sellMin}`:f.sellMax?`≤${f.sellMax}`:'—'}
                      </span>
                    </td>
                    <td>
                      <div className="mono" style={{fontSize:12,fontWeight:600}}>{f.cur!=null?fmtC(f.cur):'—'}</div>
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
                        <button className="btn btn-ghost btn-sm" style={{padding:'3px 7px'}} onClick={()=>{setEditItem(f);setShowOpenModal(true)}}>✏</button>
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

      {/* ── CLOSED TABLE ── */}
      {view==='closed'&&(
        filteredClosed.length===0 ? (
          <div className="card" style={{padding:'40px 20px',textAlign:'center',color:'var(--text3)',fontSize:13}}>
            Nicio poziție FOX închisă. Adaugă cu butonul "✓ Adaugă Închisă".
          </div>
        ) : (
          <div className="card" style={{overflow:'hidden'}}>
            <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
              <table className="data-table" style={{minWidth:780}}>
                <thead>
                  <tr>
                    <th colSpan={2} style={{background:'var(--surface3)',color:'var(--text3)',borderRight:'1px solid var(--border2)'}}>COMPANIE</th>
                    <th colSpan={3} style={{background:'var(--green-bg)',color:'var(--green)',borderRight:'1px solid var(--border2)'}}>▲ CUMPĂRARE</th>
                    <th colSpan={3} style={{background:'var(--red-bg)',color:'var(--red)',borderRight:'1px solid var(--border2)'}}>▼ VÂNZARE</th>
                    <th colSpan={2} style={{background:'var(--surface2)',color:'var(--blue)'}}>REZULTAT</th>
                    {isAdmin&&<th style={{background:'var(--surface2)'}}/>}
                  </tr>
                  <tr>
                    <th style={STICKY_H}>Symbol</th>
                    <th style={{borderRight:'1px solid var(--border2)'}}>Domeniu · Cap</th>
                    <th>Nr. Acțiuni</th>
                    <th>Preț Mediu</th>
                    <th style={{borderRight:'1px solid var(--border2)'}}>Total Cost</th>
                    <th>Nr. Acțiuni</th>
                    <th>Preț</th>
                    <th style={{borderRight:'1px solid var(--border2)'}}>Total</th>
                    <th style={{textAlign:'right'}}>Profit</th>
                    <th style={{textAlign:'right'}}>ROI</th>
                    {isAdmin&&<th/>}
                  </tr>
                </thead>
                <tbody>
                  {filteredClosed.map(f=>(
                    <tr key={f.id}>
                      <td style={{...STICKY,borderRight:'1px solid var(--border)'}}>
                        <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13}}>{f.symbol}</div>
                        <div style={{fontSize:10,color:'var(--text3)',whiteSpace:'normal',lineHeight:1.3}}>{f.name}</div>
                        {f.sellDate&&<div style={{fontSize:9,color:'var(--text3)',marginTop:2}}>{fmtDate(f.sellDate)}</div>}
                      </td>
                      <td style={{borderRight:'1px solid var(--border)'}}>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
                          {f.sector&&<span style={{fontSize:10,color:'var(--blue)',fontWeight:500}}>{S_ICON[f.sector]||''} {f.sector}</span>}
                          {f.industry&&<span style={{fontSize:9,color:'var(--text3)'}}>· {f.industry}</span>}
                          {f.cap&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:'var(--surface2)',color:CAP_COLORS[f.cap]||'var(--text3)',border:`1px solid ${CAP_COLORS[f.cap]||'var(--border)'}40`}}>{f.cap}</span>}
                        </div>
                      </td>
                      <td><span className="mono" style={{fontSize:12}}>{f.buyShares||'—'}</span></td>
                      <td><span className="mono" style={{fontSize:12}}>{f.buyPrice?fmtC(f.buyPrice):'—'}</span></td>
                      <td style={{borderRight:'1px solid var(--border)'}}><span className="mono" style={{fontSize:12,fontWeight:600}}>{f.buyTotal?fmtC(f.buyTotal):'—'}</span></td>
                      <td><span className="mono" style={{fontSize:12}}>{f.sellShares||'—'}</span></td>
                      <td><span className="mono" style={{fontSize:12}}>{f.sellPrice?fmtC(f.sellPrice):'—'}</span></td>
                      <td style={{borderRight:'1px solid var(--border)'}}><span className="mono" style={{fontSize:12,fontWeight:600}}>{f.sellTotal?fmtC(f.sellTotal):'—'}</span></td>
                      <td style={{textAlign:'right'}}><span className={`mono ${pnlClass(f.profit)}`} style={{fontSize:13,fontWeight:700}}>{f.profit!=null?fmtC(f.profit):'—'}</span></td>
                      <td style={{textAlign:'right'}}><span className={`mono ${pnlClass(f.roi)}`} style={{fontSize:13,fontWeight:700}}>{f.roi!=null?fmtPct(f.roi):'—'}</span></td>
                      {isAdmin&&<td>
                        <div style={{display:'flex',gap:4}}>
                          <button className="btn btn-ghost btn-sm" style={{padding:'3px 7px'}} onClick={()=>{setEditItem(f);setShowClosedModal(true)}}>✏</button>
                          <button className="btn btn-danger btn-sm" style={{padding:'3px 7px'}} onClick={()=>deleteFox(f.id)}>✕</button>
                        </div>
                      </td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td colSpan={4} style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>TOTAL ÎNCHISE</td>
                    <td><span className="mono" style={{fontWeight:700}}>{fmtC(totalClosedCost)}</span></td>
                    <td colSpan={2}/>
                    <td style={{borderRight:'1px solid var(--border)'}}/>
                    <td style={{textAlign:'right'}}><span className={`mono ${pnlClass(totalClosedProfit)}`} style={{fontWeight:700}}>{fmtC(totalClosedProfit)}</span></td>
                    <td style={{textAlign:'right'}}><span className={`mono ${pnlClass(totalClosedRoi)}`} style={{fontWeight:700}}>{fmtPct(totalClosedRoi)}</span></td>
                    {isAdmin&&<td/>}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      )}

      {/* Modals */}
      {showOpenModal&&isAdmin&&<OpenFoxModal {...modalProps} item={editItem?.status!=='closed'?editItem:null} onSave={saveFox}/>}
      {showClosedModal&&isAdmin&&<ClosedFoxModal {...modalProps} item={editItem?.status==='closed'?editItem:null} onSave={saveFox}/>}
    </div>
  )
}
