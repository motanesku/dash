import { useMemo, useState } from 'react'
import useStore from '../lib/store.js'
import { fmtC, fmtPct, pnlClass } from '../lib/portfolio.js'

const CAPS = ['Large Cap','Mid Cap','Small Cap','Micro Cap']
const SECTORS = ['Tech','Finance','Health','Energy','Consumer','Industrial','Materials','Utilities','Real Estate','Telecom','Other']
const SECTOR_ICONS = {'Tech':'💻','Finance':'🏦','Health':'🏥','Energy':'⚡','Consumer':'🛍','Industrial':'🏭','Materials':'⛏','Utilities':'💡','Real Estate':'🏢','Telecom':'📡','Other':'·'}
const SORT_OPTIONS = ['pondere','profit','roi','symbol']

// ── Add/Edit FOX position modal ──────────────────────────────
function FoxModal({ item, prices, totalCost, onSave, onClose }) {
  const [form, setForm] = useState(item ? {...item} : {
    id: Date.now(),
    symbol:'', name:'', sector:'Tech', cap:'Large Cap', domain:'',
    shares:0, avgPrice:0,
    buyMin:'', buyMax:'', sellTarget:'',
    notes:''
  })
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const setN = k => e => setForm(f=>({...f,[k]:+e.target.value||0}))
  const [err, setErr] = useState('')

  const submit = () => {
    if (!form.symbol.trim()) { setErr('Symbol obligatoriu'); return }
    if (!form.shares || form.shares<=0) { setErr('Nr. acțiuni obligatoriu'); return }
    if (!form.avgPrice || form.avgPrice<=0) { setErr('Preț mediu obligatoriu'); return }
    onSave({...form, symbol: form.symbol.toUpperCase().trim(), id: form.id||Date.now()})
    onClose()
  }

  const cur = prices[form.symbol.toUpperCase()]?.price
  const cost = form.shares * form.avgPrice
  const profit = cur ? (cur - form.avgPrice) * form.shares : null
  const roi = form.avgPrice>0&&cur ? ((cur-form.avgPrice)/form.avgPrice)*100 : null

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520,width:'95vw'}}>
        <div className="modal-title">{item?'✏ Editează Poziție FOX':'+ Poziție FOX Nouă'}</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>

          {/* Companie */}
          <div style={{background:'var(--surface2)',borderRadius:8,padding:12}}>
            <div className="label" style={{marginBottom:10,color:'var(--blue)'}}>INFORMAȚII COMPANIE</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <div className="label" style={{marginBottom:4}}>Symbol *</div>
                <input className="input" placeholder="AAPL" value={form.symbol} onChange={e=>setForm(f=>({...f,symbol:e.target.value.toUpperCase()}))}/>
              </div>
              <div>
                <div className="label" style={{marginBottom:4}}>Nume companie</div>
                <input className="input" placeholder="Apple Inc." value={form.name} onChange={set('name')}/>
              </div>
              <div>
                <div className="label" style={{marginBottom:4}}>Sector</div>
                <select className="select" value={form.sector} onChange={set('sector')}>
                  {SECTORS.map(s=><option key={s} value={s}>{SECTOR_ICONS[s]} {s}</option>)}
                </select>
              </div>
              <div>
                <div className="label" style={{marginBottom:4}}>Cap</div>
                <select className="select" value={form.cap} onChange={set('cap')}>
                  {CAPS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <div className="label" style={{marginBottom:4}}>Domeniu / Industrie</div>
                <input className="input" placeholder="ex: Cloud Computing, EV, Semiconductori..." value={form.domain} onChange={set('domain')}/>
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
              Cost total: <span style={{color:'var(--text)',fontWeight:600}}>{fmtC(cost)}</span>
              {cur&&<> · Profit: <span className={pnlClass(profit)} style={{fontWeight:600}}>{fmtC(profit)}</span> · ROI: <span className={pnlClass(roi)} style={{fontWeight:600}}>{fmtPct(roi)}</span></>}
            </div>}
          </div>

          {/* Obiectiv */}
          <div style={{background:'var(--surface2)',borderRadius:8,padding:12}}>
            <div className="label" style={{marginBottom:10,color:'var(--gold)'}}>OBIECTIV</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
              <div>
                <div className="label" style={{marginBottom:4}}>Buy Min</div>
                <input className="input mono" type="number" min="0" step="any" placeholder="sub..." value={form.buyMin||''} onChange={setN('buyMin')}/>
              </div>
              <div>
                <div className="label" style={{marginBottom:4}}>Buy Max</div>
                <input className="input mono" type="number" min="0" step="any" placeholder="până la..." value={form.buyMax||''} onChange={setN('buyMax')}/>
              </div>
              <div>
                <div className="label" style={{marginBottom:4}}>Sell Target</div>
                <input className="input mono" type="number" min="0" step="any" placeholder="target..." value={form.sellTarget||''} onChange={setN('sellTarget')}/>
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <div className="label" style={{marginBottom:4}}>Note</div>
            <input className="input" placeholder="observații, teză investiție..." value={form.notes||''} onChange={set('notes')}/>
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

// ── Main FoxPositions ────────────────────────────────────────
export default function FoxPositions() {
  const { foxData, setFoxData, prices, isAdmin } = useStore()
  const [sortBy, setSortBy] = useState('pondere')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [filterSector, setFilterSector] = useState('ALL')

  const totalCost = useMemo(()=>foxData.reduce((s,f)=>s+f.shares*f.avgPrice,0),[foxData])

  const enriched = useMemo(()=>{
    return foxData.map(f=>{
      const cur = prices[f.symbol]?.price || null
      const prev = prices[f.symbol]?.prev || null
      const cost = f.shares * f.avgPrice
      const curVal = cur ? cur * f.shares : null
      const profit = curVal != null ? curVal - cost : null
      const roi = f.avgPrice>0&&cur ? ((cur-f.avgPrice)/f.avgPrice)*100 : null
      const dayChange = cur&&prev ? ((cur-prev)/prev)*100 : null
      const pondere = totalCost>0 ? (cost/totalCost)*100 : 0
      // Buy signal
      const inBuyZone = cur && (
        (f.buyMax && cur<=f.buyMax && (!f.buyMin||cur>=f.buyMin)) ||
        (f.buyMin && !f.buyMax && cur<=f.buyMin)
      )
      const nearSell = cur&&f.sellTarget ? cur>=f.sellTarget*0.95 : false
      return {...f, cur, cost, curVal, profit, roi, dayChange, pondere, inBuyZone, nearSell}
    })
  },[foxData, prices, totalCost])

  const filtered = useMemo(()=>{
    const arr = filterSector==='ALL' ? enriched : enriched.filter(f=>f.sector===filterSector)
    return [...arr].sort((a,b)=>{
      if(sortBy==='pondere') return b.pondere-a.pondere
      if(sortBy==='profit') return (b.profit||0)-(a.profit||0)
      if(sortBy==='roi') return (b.roi||0)-(a.roi||0)
      if(sortBy==='symbol') return a.symbol.localeCompare(b.symbol)
      return 0
    })
  },[enriched, sortBy, filterSector])

  const totalVal = enriched.reduce((s,f)=>s+(f.curVal||0),0)
  const totalProfit = enriched.reduce((s,f)=>s+(f.profit||0),0)
  const totalRoi = totalCost>0 ? (totalProfit/totalCost)*100 : 0

  const saveFox = (item) => {
    const next = editItem
      ? foxData.map(f=>f.id===editItem.id?item:f)
      : [...foxData, item]
    setFoxData(next)
    setEditItem(null)
  }

  const deleteFox = (id) => {
    if(!confirm('Ștergi poziția FOX?')) return
    setFoxData(foxData.filter(f=>f.id!==id))
  }

  const SortBtn = ({val,label}) => (
    <button onClick={()=>setSortBy(val)} style={{
      padding:'3px 8px',borderRadius:4,border:'none',cursor:'pointer',
      fontSize:10,fontFamily:'var(--mono)',fontWeight:600,
      background:sortBy===val?'var(--blue)':'var(--surface2)',
      color:sortBy===val?'#fff':'var(--text3)',transition:'all .15s',
    }}>{label}</button>
  )

  const uniqueSectors = ['ALL',...new Set(foxData.map(f=>f.sector))]

  return (
    <div className="fade-up">
      {/* Header row */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontSize:16,fontWeight:700,color:'var(--text)',marginBottom:2}}>
            🦊 Poziții FOX
            <span style={{fontSize:11,fontWeight:400,color:'var(--text3)',marginLeft:8}}>watchlist independent</span>
          </h2>
          <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>
            {foxData.length} poziții · cost {fmtC(totalCost)} · val {fmtC(totalVal)} ·{' '}
            <span className={pnlClass(totalProfit)} style={{fontWeight:600}}>{fmtPct(totalRoi)}</span>
          </div>
        </div>
        {isAdmin&&(
          <button className="btn btn-primary btn-sm" onClick={()=>{setEditItem(null);setShowModal(true)}}>+ Adaugă Poziție</button>
        )}
      </div>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:16}}>
        {[
          {label:'Cost Total',val:fmtC(totalCost),accent:'var(--text3)'},
          {label:'Valoare Actuală',val:fmtC(totalVal),accent:'var(--blue)'},
          {label:'Profit Total',val:fmtC(totalProfit),accent:totalProfit>=0?'var(--green)':'var(--red)'},
          {label:'ROI',val:fmtPct(totalRoi),accent:totalRoi>=0?'var(--green)':'var(--red)'},
        ].map(c=>(
          <div key={c.label} className="card" style={{padding:'12px 16px',borderLeft:`3px solid ${c.accent}`}}>
            <div className="label" style={{marginBottom:6}}>{c.label}</div>
            <div className="mono" style={{fontSize:16,fontWeight:700,color:c.accent==='var(--text3)'?'var(--text)':c.accent}}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Filters + Sort */}
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>SECTOR:</span>
        {uniqueSectors.map(s=>(
          <button key={s} onClick={()=>setFilterSector(s)} style={{
            padding:'3px 8px',borderRadius:4,border:'none',cursor:'pointer',fontSize:10,fontWeight:600,
            background:filterSector===s?'var(--blue)':'var(--surface2)',
            color:filterSector===s?'#fff':'var(--text3)',transition:'all .15s',
          }}>{s==='ALL'?'Toate':`${SECTOR_ICONS[s]||''} ${s}`}</button>
        ))}
        <div style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center'}}>
          <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>SORT:</span>
          <SortBtn val="pondere" label="PONDERE"/>
          <SortBtn val="profit" label="PROFIT"/>
          <SortBtn val="roi" label="ROI"/>
          <SortBtn val="symbol" label="A-Z"/>
        </div>
      </div>

      {foxData.length===0&&(
        <div className="card" style={{padding:'60px 20px',textAlign:'center'}}>
          <div style={{fontSize:40,marginBottom:12}}>🦊</div>
          <div style={{fontWeight:600,fontSize:16,marginBottom:6}}>Nicio poziție FOX</div>
          <div style={{color:'var(--text3)',fontSize:13}}>Adaugă poziții de urmărit independent de portofoliul principal.</div>
        </div>
      )}

      {filtered.length>0&&(
        <div className="card" style={{overflow:'hidden'}}>
          <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
            <table className="data-table" style={{minWidth:900}}>
              <thead>
                <tr>
                  <th colSpan={2} style={{background:'var(--surface3)',borderRight:'1px solid var(--border2)',color:'var(--text3)'}}>COMPANIE</th>
                  <th colSpan={4} style={{background:'var(--surface2)',borderRight:'1px solid var(--border2)',color:'var(--green)'}}>DEȚITERI</th>
                  <th colSpan={3} style={{background:'var(--surface3)',borderRight:'1px solid var(--border2)',color:'var(--gold)'}}>OBIECTIV</th>
                  <th colSpan={3} style={{background:'var(--surface2)',color:'var(--blue)'}}>ACTUAL</th>
                  {isAdmin&&<th style={{background:'var(--surface2)'}}/>}
                </tr>
                <tr>
                  {/* Companie */}
                  <th>Symbol</th>
                  <th style={{borderRight:'1px solid var(--border2)'}}>Domeniu / Cap</th>
                  {/* Detineri */}
                  <th>Acțiuni</th>
                  <th>Preț Mediu</th>
                  <th>Cost Total</th>
                  <th style={{borderRight:'1px solid var(--border2)'}}>Pondere %</th>
                  {/* Obiectiv */}
                  <th>Buy Zone</th>
                  <th>Sell Target</th>
                  <th style={{borderRight:'1px solid var(--border2)'}}>Signal</th>
                  {/* Actual */}
                  <th>Preț Actual</th>
                  <th style={{textAlign:'right'}}>Profit</th>
                  <th style={{textAlign:'right'}}>ROI</th>
                  {isAdmin&&<th/>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(f=>(
                  <tr key={f.id} style={{
                    background: f.inBuyZone?'rgba(0,212,170,0.04)':f.nearSell?'rgba(240,180,41,0.04)':'',
                  }}>
                    {/* Symbol */}
                    <td>
                      <div style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13,color:'var(--text)'}}>{f.symbol}</div>
                      <div style={{fontSize:10,color:'var(--text3)'}}>{f.name||'—'}</div>
                    </td>
                    {/* Domeniu / Cap */}
                    <td style={{borderRight:'1px solid var(--border)'}}>
                      <div style={{fontSize:11,color:'var(--blue)',fontWeight:500}}>{f.domain||'—'}</div>
                      <div style={{display:'flex',gap:4,marginTop:2,flexWrap:'wrap'}}>
                        {f.sector&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:'var(--surface2)',color:'var(--text3)',border:'1px solid var(--border)'}}>{SECTOR_ICONS[f.sector]||''} {f.sector}</span>}
                        {f.cap&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:3,background:'var(--blue-bg)',color:'var(--blue)',border:'1px solid var(--blue-b)'}}>{f.cap}</span>}
                      </div>
                    </td>
                    {/* Detineri */}
                    <td><span className="mono" style={{fontSize:12}}>{f.shares}</span></td>
                    <td><span className="mono" style={{fontSize:12}}>{fmtC(f.avgPrice)}</span></td>
                    <td><span className="mono" style={{fontSize:12,fontWeight:600}}>{fmtC(f.cost)}</span></td>
                    <td style={{borderRight:'1px solid var(--border)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <div style={{flex:1,height:4,background:'var(--surface2)',borderRadius:2,minWidth:40}}>
                          <div style={{height:'100%',width:`${Math.min(f.pondere,100)}%`,background:'var(--blue)',borderRadius:2}}/>
                        </div>
                        <span className="mono" style={{fontSize:11,fontWeight:600,color:'var(--blue)',minWidth:36,textAlign:'right'}}>{f.pondere.toFixed(1)}%</span>
                      </div>
                    </td>
                    {/* Obiectiv */}
                    <td>
                      <span className="mono" style={{fontSize:11,color:'var(--gold)'}}>
                        {f.buyMin&&f.buyMax ? `${f.buyMin}–${f.buyMax}` : f.buyMin ? `≤${f.buyMin}` : f.buyMax ? `≤${f.buyMax}` : '—'}
                      </span>
                    </td>
                    <td>
                      <span className="mono" style={{fontSize:11,color:'var(--purple)'}}>{f.sellTarget||'—'}</span>
                    </td>
                    <td style={{borderRight:'1px solid var(--border)'}}>
                      {f.inBuyZone&&<span className="badge badge-green" style={{fontSize:9}}>🟢 BUY</span>}
                      {f.nearSell&&!f.inBuyZone&&<span className="badge badge-gold" style={{fontSize:9}}>⚡ SELL</span>}
                      {!f.inBuyZone&&!f.nearSell&&<span style={{color:'var(--text3)',fontSize:10}}>—</span>}
                    </td>
                    {/* Actual */}
                    <td>
                      <div className="mono" style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{f.cur?fmtC(f.cur):'—'}</div>
                      {f.dayChange!=null&&<div className={`mono ${pnlClass(f.dayChange)}`} style={{fontSize:10}}>{fmtPct(f.dayChange)}</div>}
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
              <tfoot>
                <tr className="total-row">
                  <td colSpan={4} style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)'}}>TOTAL FOX</td>
                  <td><span className="mono" style={{fontWeight:700}}>{fmtC(totalCost)}</span></td>
                  <td style={{borderRight:'1px solid var(--border)'}}/>
                  <td colSpan={3} style={{borderRight:'1px solid var(--border)'}}/>
                  <td><span className="mono" style={{fontWeight:700,color:'var(--blue)'}}>{fmtC(totalVal)}</span></td>
                  <td style={{textAlign:'right'}}><span className={`mono ${pnlClass(totalProfit)}`} style={{fontWeight:700}}>{fmtC(totalProfit)}</span></td>
                  <td style={{textAlign:'right'}}><span className={`mono ${pnlClass(totalRoi)}`} style={{fontWeight:700}}>{fmtPct(totalRoi)}</span></td>
                  {isAdmin&&<td/>}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {showModal&&isAdmin&&(
        <FoxModal
          item={editItem}
          prices={prices}
          totalCost={totalCost}
          onSave={saveFox}
          onClose={()=>{setShowModal(false);setEditItem(null)}}
        />
      )}
    </div>
  )
}
