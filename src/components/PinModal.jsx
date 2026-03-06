import { useState } from 'react'
import useStore from '../lib/store.js'
import { ADMIN_PIN } from '../config.js'

export default function PinModal({ onClose }) {
  const { setAdmin } = useStore()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)

  const submit = () => {
    if (pin === ADMIN_PIN) { setAdmin(true); onClose() }
    else { setErr(true); setPin('') }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:340}}>
        <div className="modal-title">🔐 Autentificare Admin</div>
        <div style={{marginBottom:16}}>
          <div className="label" style={{marginBottom:6}}>PIN</div>
          <input
            className="input mono" type="password" placeholder="••••"
            value={pin} onChange={e=>{setPin(e.target.value);setErr(false)}}
            onKeyDown={e=>e.key==='Enter'&&submit()}
            autoFocus
            style={{borderColor:err?'var(--red)':undefined,textAlign:'center',fontSize:20,letterSpacing:8}}
          />
          {err&&<div style={{color:'var(--red)',fontSize:11,marginTop:6}}>PIN incorect</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Anulează</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={submit}>Intră</button>
        </div>
      </div>
    </div>
  )
}
