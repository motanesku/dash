import { useState, useEffect } from 'react'
import useStore from '../lib/store.js'

export default function AddTxModal({ tx: editTx, onClose }) {
  const { addTx, updateTx, brokers } = useStore()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    type:'BUY', symbol:'', shares:'', price:'', date:today,
    broker: brokers[0]||'XTB', notes:''
  })
  const [err, setErr] = useState('')

  useEffect(() => {
    if (editTx) setForm({
      type:editTx.type, symbol:editTx.symbol||'',
      shares: editTx.type==='DEPOSIT'?'':String(editTx.shares),
      price:String(editTx.price), date:editTx.date,
      broker:editTx.broker, notes:editTx.notes||''
    })
  }, [editTx])

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  const submit = async () => {
    let tx
    if (form.type === 'DEPOSIT') {
      if (!form.price||isNaN(+form.price)||+form.price<=0){setErr('Introdu suma depusă.');return}
      tx = {type:'DEPOSIT',symbol:'',shares:0,price:+form.price,date:form.date,broker:form.broker,notes:form.notes}
    } else {
      if (!form.symbol||!form.shares||!form.price){setErr('Completează symbol, acțiuni și preț.');return}
      tx = {type:form.type,symbol:form.symbol.toUpperCase().trim(),shares:+form.shares,price:+form.price,date:form.date,broker:form.broker,notes:form.notes}
    }
    if (editTx) await updateTx({...tx, id:editTx.id})
    else await addTx(tx)
    onClose()
  }

  const TYPE_CONFIG = {
    BUY:     {label:'▲ BUY',     color:'var(--green)'},
    SELL:    {label:'▼ SELL',    color:'var(--red)'},
    DEPOSIT: {label:'💵 DEPUNERE', color:'var(--blue)'},
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">
          {editTx?'✏ Editează Tranzacție':TYPE_CONFIG[form.type]?.label||'Tranzacție nouă'}
        </div>

        {/* Type selector */}
        <div style={{display:'flex',gap:8,marginBottom:18}}>
          {Object.entries(TYPE_CONFIG).map(([t,cfg])=>(
            <button key={t} onClick={()=>setForm(f=>({...f,type:t}))} style={{
              flex:1,padding:'9px',borderRadius:8,
              border:`2px solid ${form.type===t?cfg.color:'var(--border2)'}`,
              background:form.type===t?`rgba(${t==='BUY'?'0,212,170':t==='SELL'?'255,77,106':'77,159,255'},0.1)`:'var(--surface2)',
              color:form.type===t?cfg.color:'var(--text3)',
              fontSize:11,fontWeight:700,cursor:'pointer',transition:'all .15s',
            }}>{cfg.label}</button>
          ))}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <div className="label" style={{marginBottom:5}}>Broker</div>
              <select className="select" value={form.broker} onChange={set('broker')}>
                {brokers.map(b=><option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <div className="label" style={{marginBottom:5}}>Data</div>
              <input className="input" type="date" value={form.date} onChange={set('date')}/>
            </div>
          </div>

          {form.type==='DEPOSIT' ? (
            <div>
              <div className="label" style={{marginBottom:5}}>Sumă Depusă (USD)</div>
              <input className="input mono" type="number" placeholder="5000.00" min="0" step="any" value={form.price} onChange={set('price')}/>
            </div>
          ) : (
            <>
              <div>
                <div className="label" style={{marginBottom:5}}>Symbol</div>
                <input className="input" placeholder="AAPL, TLV.RO, BTC-USD..." value={form.symbol} onChange={e=>setForm(f=>({...f,symbol:e.target.value.toUpperCase()}))}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <div className="label" style={{marginBottom:5}}>Acțiuni</div>
                  <input className="input mono" type="number" placeholder="10" min="0" step="any" value={form.shares} onChange={set('shares')}/>
                </div>
                <div>
                  <div className="label" style={{marginBottom:5}}>Preț / Acțiune</div>
                  <input className="input mono" type="number" placeholder="150.00" min="0" step="any" value={form.price} onChange={set('price')}/>
                </div>
              </div>
            </>
          )}

          <div>
            <div className="label" style={{marginBottom:5}}>Note (opțional)</div>
            <input className="input" placeholder="..." value={form.notes} onChange={set('notes')}/>
          </div>

          {err&&<div style={{color:'var(--red)',fontSize:12,padding:'8px 12px',background:'var(--red-bg)',borderRadius:6,border:'1px solid var(--red-b)'}}>{err}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Anulează</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={submit}>
            {editTx?'Salvează':'Adaugă'}
          </button>
        </div>
      </div>
    </div>
  )
}
