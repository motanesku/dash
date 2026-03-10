import { useState } from 'react'
import useStore from '../lib/store.js'

export default function AlertsPanel({ onClose }) {
  const { alerts, addAlert, deleteAlert, clearTriggeredAlerts, prices, notificationsEnabled, toggleNotifications } = useStore()
  const [form, setForm] = useState({ symbol:'', target:'', direction:'above' })
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'active' | 'triggered'

  const submit = () => {
    if (!form.symbol||!form.target||isNaN(+form.target)){setErr('Completează symbol și preț țintă');return}
    addAlert({ symbol:form.symbol.toUpperCase(), target:+form.target, direction:form.direction })
    setForm({symbol:'',target:'',direction:'above'})
    setErr('')
  }

  const requestNotifPermission = async () => {
    if (Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    toggleNotifications()
  }

  const triggeredCount = alerts.filter(a => a.triggered).length
  const filtered = alerts.filter(a => {
    if (filter === 'active')    return !a.triggered
    if (filter === 'triggered') return a.triggered
    return true
  })

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:440}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div className="modal-title" style={{margin:0}}>🔔 Alerte Prețuri</div>
          <button
            onClick={requestNotifPermission}
            title={notificationsEnabled ? 'Notificări active pe acest device' : 'Notificări dezactivate pe acest device'}
            style={{
              display:'flex',alignItems:'center',gap:6,padding:'5px 10px',
              borderRadius:20,border:'1px solid var(--border)',cursor:'pointer',
              background:notificationsEnabled?'var(--green-bg)':'var(--surface2)',
              color:notificationsEnabled?'var(--green)':'var(--text3)',
              fontSize:10,fontWeight:600,transition:'all .2s',
            }}>
            {notificationsEnabled ? '🔔 Notif. ON' : '🔕 Notif. OFF'}
          </button>
        </div>

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

        {alerts.length > 0 && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,gap:8}}>
            <div style={{display:'flex',gap:4}}>
              {[
                {id:'all',      label:`Toate (${alerts.length})`},
                {id:'active',   label:`Active (${alerts.length-triggeredCount})`},
                {id:'triggered',label:`Atinse (${triggeredCount})`},
              ].map(f=>(
                <button key={f.id} onClick={()=>setFilter(f.id)} style={{
                  padding:'3px 8px',borderRadius:4,border:'none',cursor:'pointer',
                  fontSize:10,fontWeight:600,
                  background:filter===f.id?'var(--blue)':'var(--surface2)',
                  color:filter===f.id?'#fff':'var(--text3)',transition:'all .15s',
                }}>{f.label}</button>
              ))}
            </div>
            {triggeredCount > 0 && (
              <button onClick={clearTriggeredAlerts} style={{
                padding:'3px 8px',borderRadius:4,border:'1px solid var(--border)',
                cursor:'pointer',fontSize:10,color:'var(--text3)',background:'transparent',
              }}>🗑 Șterge atinse</button>
            )}
          </div>
        )}

        <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:'45vh',overflowY:'auto'}}>
          {filtered.length===0 && (
            <div style={{textAlign:'center',color:'var(--text3)',padding:'20px',fontSize:13}}>
              {filter==='triggered'?'Nicio alertă atinsă':'Nicio alertă'}
            </div>
          )}
          {filtered.map(a=>{
            const cur = prices[a.symbol]?.price
            const distPct = cur ? Math.abs(((cur-a.target)/a.target)*100) : null
            const isClose = distPct != null && distPct < 2
            return (
              <div key={a.id} style={{
                display:'flex',alignItems:'center',justifyContent:'space-between',
                padding:'10px 12px',borderRadius:8,
                background:a.triggered?'var(--green-bg)':isClose?'rgba(240,180,41,0.08)':'var(--surface2)',
                border:`1px solid ${a.triggered?'var(--green-b)':isClose?'rgba(240,180,41,0.4)':'var(--border)'}`,
              }}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap'}}>
                    <span style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--text)'}}>{a.symbol}</span>
                    <span style={{fontSize:10,color:a.direction==='above'?'var(--green)':'var(--red)',fontWeight:600}}>
                      {a.direction==='above'?'▲ peste':'▼ sub'} {a.target}
                    </span>
                    {a.triggered && (
                      <span style={{
                        fontSize:9,padding:'1px 6px',borderRadius:10,fontWeight:700,
                        background:'var(--green-bg)',color:'var(--green)',border:'1px solid var(--green-b)',
                      }}>✓ ATINS</span>
                    )}
                    {isClose && !a.triggered && (
                      <span style={{fontSize:9,color:'var(--gold)',fontWeight:600}}>⚡ aproape</span>
                    )}
                  </div>
                  <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',display:'flex',gap:10,flexWrap:'wrap'}}>
                    {cur && <span>curent: <b style={{color:'var(--text)'}}>{cur.toFixed(2)}</b></span>}
                    {distPct != null && !a.triggered && <span>dist: {distPct.toFixed(2)}%</span>}
                    {a.triggered && a.triggeredAt && (
                      <span>atins: {new Date(a.triggeredAt).toLocaleDateString('ro-RO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                    )}
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" style={{marginLeft:8,flexShrink:0}} onClick={()=>deleteAlert(a.id)}>✕</button>
              </div>
            )
          })}
        </div>

        <div style={{fontSize:9,color:'var(--text3)',textAlign:'center',marginTop:10,fontFamily:'var(--mono)'}}>
          🔄 alerte sincronizate în cloud · notificările sunt setate per device
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Închide</button>
        </div>
      </div>
    </div>
  )
}
