import { useState } from 'react'
import useStore from '../lib/store.js'

export default function AlertsPanel({ onClose }) {
  const { alerts, addAlert, deleteAlert, prices } = useStore()
  const [form, setForm] = useState({ symbol:'', target:'', direction:'above' })
  const [err, setErr] = useState('')

  const submit = () => {
    if (!form.symbol||!form.target||isNaN(+form.target)){setErr('Completează symbol și preț țintă');return}
    addAlert({ symbol:form.symbol.toUpperCase(), target:+form.target, direction:form.direction })
    setForm({symbol:'',target:'',direction:'above'})
    setErr('')
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:420}}>
        <div className="modal-title">🔔 Alerte Prețuri</div>

        {/* Add alert */}
        <div style={{background:'var(--surface2)',borderRadius:10,padding:14,marginBottom:16,border:'1px solid var(--border)'}}>
          <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',marginBottom:12,letterSpacing:.6}}>ALERTĂ NOUĂ</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:8}}>
            <div>
              <div className="label" style={{marginBottom:4}}>Symbol</div>
              <input className="input" placeholder="AAPL" value={form.symbol} onChange={e=>setForm(f=>({...f,symbol:e.target.value.toUpperCase()}))}/>
            </div>
            <div>
              <div className="label" style={{marginBottom:4}}>Direcție</div>
              <select className="select" value={form.direction} onChange={e=>setForm(f=>({...f,direction:e.target.value}))}>
                <option value="above">▲ Peste</option>
                <option value="below">▼ Sub</option>
              </select>
            </div>
            <div>
              <div className="label" style={{marginBottom:4}}>Preț Țintă</div>
              <input className="input mono" type="number" placeholder="200.00" value={form.target} onChange={e=>setForm(f=>({...f,target:e.target.value}))}/>
            </div>
          </div>
          {err&&<div style={{color:'var(--red)',fontSize:11,marginBottom:8}}>{err}</div>}
          <button className="btn btn-primary" style={{width:'100%'}} onClick={submit}>+ Adaugă Alertă</button>
        </div>

        {/* Alerts list */}
        <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:'50vh',overflowY:'auto'}}>
          {alerts.length===0&&<div style={{textAlign:'center',color:'var(--text3)',padding:'20px',fontSize:13}}>Nicio alertă</div>}
          {alerts.map(a=>{
            const cur = prices[a.symbol]?.price
            return (
              <div key={a.id} style={{
                display:'flex',alignItems:'center',justifyContent:'space-between',
                padding:'10px 12px',borderRadius:8,
                background:a.triggered?'var(--green-bg)':'var(--surface2)',
                border:`1px solid ${a.triggered?'var(--green-b)':'var(--border)'}`,
              }}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                    <span style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--text)'}}>{a.symbol}</span>
                    <span style={{fontSize:10,color:a.direction==='above'?'var(--green)':'var(--red)',fontWeight:600}}>
                      {a.direction==='above'?'▲ peste':'▼ sub'} {a.target}
                    </span>
                    {a.triggered&&<span className="badge badge-green" style={{fontSize:9}}>✓ atins</span>}
                  </div>
                  {cur&&<div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>
                    curent: {cur.toFixed(2)} · dist: {Math.abs(((cur-a.target)/a.target)*100).toFixed(2)}%
                  </div>}
                </div>
                <button className="btn btn-danger btn-sm" onClick={()=>deleteAlert(a.id)}>✕</button>
              </div>
            )
          })}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Închide</button>
        </div>
      </div>
    </div>
  )
}
