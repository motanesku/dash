import { useState } from 'react'
import useStore from '../lib/store.js'
import { SECTORS, CAPS, INDUSTRIES_BY_SECTOR, SECTOR_ICONS, CAP_COLORS } from './CompanyInfoSection.jsx'

export default function CompanyEditModal({ symbol, onClose }) {
  const companyInfo    = useStore(s => s.companyInfo)
  const setCompanyInfo = useStore(s => s.setCompanyInfo)

  const existing = companyInfo[symbol] || {}
  const [form, setForm] = useState({
    name:     existing.name     || '',
    sector:   existing.sector   || '',
    industry: existing.industry || '',
    cap:      existing.cap      || '',
  })

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const industries = INDUSTRIES_BY_SECTOR[form.sector] || []

  const save = () => {
    setCompanyInfo(symbol, form)
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, width: '95vw' }}>
        <div className="modal-title">
          ✏ <span style={{ fontFamily:'var(--mono)', color:'var(--blue)' }}>{symbol}</span> — Info Companie
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Nume */}
          <div>
            <div className="label" style={{ marginBottom:4 }}>Nume Companie</div>
            <input className="input" placeholder="ex: Apple Inc." value={form.name} onChange={set('name')} />
          </div>

          {/* Sector + Cap */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <div className="label" style={{ marginBottom:4 }}>Sector</div>
              <select className="select" value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value, industry: '' }))}>
                <option value="">—</option>
                {SECTORS.map(s => (
                  <option key={s} value={s}>{(SECTOR_ICONS[s]||'')} {s}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="label" style={{ marginBottom:4 }}>Capitalizare</div>
              <select className="select" value={form.cap} onChange={set('cap')}>
                <option value="">—</option>
                {CAPS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Industry */}
          <div>
            <div className="label" style={{ marginBottom:4 }}>Industrie</div>
            {industries.length > 0 ? (
              <select className="select" value={form.industry} onChange={set('industry')}>
                <option value="">—</option>
                {industries.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            ) : (
              <input className="input" placeholder="ex: Semiconductors" value={form.industry} onChange={set('industry')} />
            )}
          </div>

          {/* Preview */}
          {(form.sector || form.cap) && (
            <div style={{
              padding:'8px 12px', background:'var(--surface2)', borderRadius:8,
              border:'1px solid var(--border)', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'
            }}>
              <span style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:13 }}>{symbol}</span>
              {form.name && <span style={{ fontSize:11, color:'var(--text3)' }}>{form.name}</span>}
              {form.sector && <span style={{ fontSize:10, color:'var(--blue)' }}>{SECTOR_ICONS[form.sector]||''} {form.sector}</span>}
              {form.industry && <span style={{ fontSize:10, color:'var(--text3)' }}>· {form.industry}</span>}
              {form.cap && (
                <span style={{
                  fontSize:10, padding:'1px 6px', borderRadius:4,
                  background:'var(--surface)', color: CAP_COLORS[form.cap]||'var(--text3)',
                  border:`1px solid ${CAP_COLORS[form.cap]||'var(--border)'}50`, fontWeight:700
                }}>{form.cap}</span>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Anulează</button>
          <button className="btn btn-primary" style={{ flex:1 }} onClick={save}>Salvează</button>
        </div>
      </div>
    </div>
  )
}
