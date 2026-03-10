import { useState, useEffect, useRef } from 'react'

// ── Standard GICS Sectors + Industries ──────────────────────
export const SECTORS = [
  'Technology','Healthcare','Financials','Energy',
  'Consumer Discretionary','Consumer Staples','Industrials',
  'Materials','Utilities','Real Estate','Communication Services',
]

export const SECTOR_ICONS = {
  'Technology':'💻','Healthcare':'🏥','Financials':'🏦','Energy':'⚡',
  'Consumer Discretionary':'🛍','Consumer Staples':'🛒','Industrials':'🏭',
  'Materials':'⛏','Utilities':'💡','Real Estate':'🏢',
  'Communication Services':'📡',
  // FOX legacy sectors
  'Tech':'💻','Finance':'🏦','Health':'🏥','Consumer':'🛍',
  'Industrial':'🏭','Telecom':'📡','Other':'·',
}

export const INDUSTRIES_BY_SECTOR = {
  'Technology': ['Semiconductors','Software','Hardware','Cloud Computing','Cybersecurity','AI & Machine Learning','Fintech','IT Services','Electronics','Networking'],
  'Healthcare': ['Biotechnology','Pharmaceuticals','Medical Devices','Health Services','Diagnostics','Genomics'],
  'Financials': ['Banking','Insurance','Asset Management','Payments','Capital Markets','REITs'],
  'Energy': ['Oil & Gas','Renewables','Utilities','Mining','Nuclear'],
  'Consumer Discretionary': ['Retail','Automotive','E-Commerce','Entertainment','Restaurants','Luxury'],
  'Consumer Staples': ['Food & Beverage','Tobacco','Household Products','Personal Care'],
  'Industrials': ['Aerospace & Defense','Machinery','Transportation','Construction','Logistics'],
  'Materials': ['Chemicals','Metals & Mining','Paper','Plastics'],
  'Utilities': ['Electric','Water','Gas','Multi-Utility'],
  'Real Estate': ['Commercial','Residential','Industrial REITs','Data Centers'],
  'Communication Services': ['Telecom','Media','Social Media','Gaming','Streaming'],
}

export const CAPS = ['Large Cap','Mid Cap','Small Cap']

export const CAP_COLORS = {
  'Large Cap':'var(--blue)','Mid Cap':'var(--green)','Small Cap':'var(--gold)',
}

// ── CompanyInfoSection ────────────────────────────────────────
export default function CompanyInfoSection({ form, setForm, prices, companyInfo, fetchCompanyInfo }) {
  const [loading, setLoading] = useState(false)
  const debounce = useRef(null)

  const setField = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const applyInfo = (sym) => {
    const info  = companyInfo?.[sym]
    const pData = prices?.[sym]
    if (!info && !pData) return
    setForm(f => ({
      ...f,
      name:     f.name     || pData?.name || '',
      sector:   f.sector   || info?.sector   || '',
      cap:      f.cap      || info?.cap      || '',
      industry: f.industry || info?.industry || info?.domain || '',
    }))
  }

  useEffect(() => {
    const sym = form.symbol?.toUpperCase().trim()
    if (!sym) return
    applyInfo(sym)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      if (!companyInfo?.[sym]?.sector) {
        setLoading(true)
        try { await fetchCompanyInfo([sym]) } catch {}
        setLoading(false)
      }
    }, 700)
  }, [form.symbol])

  useEffect(() => {
    const sym = form.symbol?.toUpperCase().trim()
    if (sym) applyInfo(sym)
  }, [companyInfo])

  const industries = INDUSTRIES_BY_SECTOR[form.sector] || []

  return (
    <div style={{ background:'var(--surface2)', borderRadius:8, padding:12 }}>
      <div className="label" style={{ marginBottom:10, color:'var(--blue)' }}>COMPANIE</div>

      {/* Symbol row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, marginBottom:10 }}>
        <input
          className="input mono"
          placeholder="Symbol (ex: AAPL)"
          value={form.symbol || ''}
          onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
        />
        <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', alignSelf:'center', minWidth:40 }}>
          {loading ? '⟳ ...' : form.symbol && prices?.[form.symbol?.toUpperCase()]?.price
            ? `$${prices[form.symbol.toUpperCase()].price.toFixed(2)}`
            : ''}
        </span>
      </div>

      {/* Name */}
      <div style={{ marginBottom:10 }}>
        <div className="label" style={{ marginBottom:4 }}>Nume Companie</div>
        <input className="input" placeholder="Apple Inc." value={form.name || ''} onChange={setField('name')} />
      </div>

      {/* Sector + Cap */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
        <div>
          <div className="label" style={{ marginBottom:4 }}>Sector</div>
          <select className="select" value={form.sector || ''} onChange={setField('sector')}>
            <option value="">—</option>
            {SECTORS.map(s => (
              <option key={s} value={s}>{(SECTOR_ICONS[s]||'') + ' ' + s}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="label" style={{ marginBottom:4 }}>Capitalizare</div>
          <select className="select" value={form.cap || ''} onChange={setField('cap')}>
            <option value="">—</option>
            {CAPS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Industry */}
      <div>
        <div className="label" style={{ marginBottom:4 }}>Industrie</div>
        {industries.length > 0 ? (
          <select className="select" value={form.industry || ''} onChange={setField('industry')}>
            <option value="">—</option>
            {industries.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        ) : (
          <input className="input" placeholder="ex: Semiconductors" value={form.industry || ''} onChange={setField('industry')} />
        )}
      </div>
    </div>
  )
}

// ── CompanyInfoCard — display only (like FOX card) ───────────
export function CompanyInfoCard({ symbol, name, sector, cap, industry, price, currency }) {
  return (
    <div style={{
      background:'var(--surface2)', borderRadius:8, padding:'10px 14px',
      border:'1px solid var(--border)', marginBottom:8,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:15, color:'var(--text)' }}>{symbol}</span>
            {cap && (
              <span style={{
                fontSize:9, padding:'2px 6px', borderRadius:4,
                background:'var(--surface)', border:`1px solid ${CAP_COLORS[cap]||'var(--border)'}50`,
                color: CAP_COLORS[cap] || 'var(--text3)', fontWeight:700,
              }}>{cap}</span>
            )}
          </div>
          {name && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2, lineHeight:1.3 }}>{name}</div>}
          <div style={{ display:'flex', gap:6, marginTop:4, flexWrap:'wrap' }}>
            {sector && (
              <span style={{ fontSize:10, color:'var(--blue)' }}>
                {SECTOR_ICONS[sector] || ''} {sector}
              </span>
            )}
            {industry && (
              <span style={{ fontSize:10, color:'var(--text3)' }}>· {industry}</span>
            )}
          </div>
        </div>
        {price != null && (
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:14, color:'var(--text)' }}>
              ${price.toFixed(2)}
            </div>
            {currency && currency !== 'USD' && (
              <div style={{ fontSize:9, color:'var(--text3)' }}>{currency}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
