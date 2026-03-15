import { useState } from 'react'
import useStore from '../lib/store.js'
import { WORKER_URL } from '../config.js'

// PIN-ul NU mai e în bundle JS.
// Se trimite la Worker care îl verifică cu ENV variable ADMIN_PIN.
// Worker returnează un session token JWT (valid 8h).
// Token-ul se stochează în sessionStorage (dispare la închiderea browserului).

export default function PinModal({ onClose }) {
  const { setAdmin, setSessionToken } = useStore()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!pin) return
    setLoading(true)
    setErr(false)
    try {
      const r = await fetch(`${WORKER_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const j = await r.json()
      if (j.ok && j.token) {
        // Stochează token-ul în sessionStorage (nu localStorage — dispare la închidere tab)
        sessionStorage.setItem('ptf_session', j.token)
        setSessionToken(j.token)
        setAdmin(true)
        onClose()
      } else {
        setErr(true)
        setPin('')
      }
    } catch {
      setErr(true)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 340 }}>
        <div className="modal-title">🔐 Autentificare Admin</div>
        <div style={{ marginBottom: 16 }}>
          <div className="label" style={{ marginBottom: 6 }}>PIN</div>
          <input
            className="input mono" type="password" placeholder="••••"
            value={pin}
            onChange={e => { setPin(e.target.value); setErr(false) }}
            onKeyDown={e => e.key === 'Enter' && submit()}
            autoFocus
            style={{ borderColor: err ? 'var(--red)' : undefined, textAlign: 'center', fontSize: 20, letterSpacing: 8 }}
          />
          {err && <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 6 }}>PIN incorect</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Anulează</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={loading}>
            {loading ? '...' : 'Intră'}
          </button>
        </div>
      </div>
    </div>
  )
}
