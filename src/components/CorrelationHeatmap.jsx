import { useState, useEffect } from 'react'
import { fetchHistory } from '../lib/prices.js'

function calcCorrelation(a, b) {
  const aMap = {}
  a.forEach(p => { aMap[p.date] = p.close })
  const pairs = []
  b.forEach(p => { if (aMap[p.date] && p.close) pairs.push({ a: aMap[p.date], b: p.close }) })
  if (pairs.length < 20) return null
  const rets = []
  for (let i = 1; i < pairs.length; i++) {
    if (pairs[i-1].a > 0 && pairs[i-1].b > 0) {
      rets.push({
        a: (pairs[i].a - pairs[i-1].a) / pairs[i-1].a,
        b: (pairs[i].b - pairs[i-1].b) / pairs[i-1].b,
      })
    }
  }
  if (rets.length < 15) return null
  const n = rets.length
  const ma = rets.reduce((s,r) => s+r.a, 0) / n
  const mb = rets.reduce((s,r) => s+r.b, 0) / n
  let cov = 0, va = 0, vb = 0
  rets.forEach(r => {
    cov += (r.a - ma) * (r.b - mb)
    va  += (r.a - ma) ** 2
    vb  += (r.b - mb) ** 2
  })
  if (va === 0 || vb === 0) return null
  return Math.max(-1, Math.min(1, cov / Math.sqrt(va * vb)))
}

function corrCategory(c) {
  if (c === null) return null
  if (c >= 0.7)  return { label: 'Foarte ridicată', color: '#ff5572', bg: 'rgba(255,85,114,0.15)' }
  if (c >= 0.4)  return { label: 'Ridicată',        color: '#f0b429', bg: 'rgba(240,180,41,0.15)' }
  if (c >= 0.1)  return { label: 'Moderată',        color: '#4d9fff', bg: 'rgba(77,159,255,0.15)' }
  if (c >= -0.1) return { label: 'Neutră',          color: '#6b7280', bg: 'rgba(107,114,128,0.15)' }
  return               { label: 'Negativă',         color: '#00d4aa', bg: 'rgba(0,212,170,0.15)' }
}

function generateConclusion(pct, topPairs) {
  const high = (pct['Foarte ridicată'] || 0) + (pct['Ridicată'] || 0)
  const neg  = pct['Negativă'] || 0
  const top2 = topPairs.slice(0, 2).map(p => `${p.a}↔${p.b}`).join(', ')

  if (high >= 60) return `⚠️ Portofoliu concentrat — ${high}% din perechi sunt corelate ridicat. Într-o corecție de piață, majoritatea pozițiilor vor scădea simultan.`
  if (high >= 40) return `📊 Diversificare parțială — ${high}% corelații ridicate. Perechile ${top2} prezintă cel mai mare risc de concentrare.`
  if (neg >= 20)  return `✅ Diversificare bună — ${neg}% corelații negative oferă protecție în scăderi. Portofoliu echilibrat.`
  return `✅ Diversificare bună — doar ${high}% corelații ridicate. Pozițiile se mișcă relativ independent.`
}

export default function CorrelationHeatmap({ positions }) {
  const [pairs, setPairs]   = useState([])
  const [loading, setLoading] = useState(false)
  const [range, setRange]   = useState('6mo')

  const symbols = [...new Set(positions.map(p => p.symbol))].slice(0, 15)

  useEffect(() => {
    if (!symbols.length) return
    setLoading(true)
    setPairs([])

    Promise.all(symbols.map(s => fetchHistory(s, range).then(pts => ({ sym: s, pts: pts || [] }))))
      .then(results => {
        const histMap = {}
        results.forEach(r => { histMap[r.sym] = r.pts })

        const allPairs = []
        for (let i = 0; i < symbols.length; i++) {
          for (let j = i+1; j < symbols.length; j++) {
            const c = calcCorrelation(histMap[symbols[i]], histMap[symbols[j]])
            if (c !== null) allPairs.push({ a: symbols[i], b: symbols[j], c })
          }
        }
        allPairs.sort((x, y) => Math.abs(y.c) - Math.abs(x.c))
        setPairs(allPairs)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [symbols.join(','), range])

  const RANGES = [
    { v:'1mo', l:'1L' }, { v:'3mo', l:'3L' },
    { v:'6mo', l:'6L' }, { v:'1y',  l:'1A' },
  ]

  // Calculează distribuția pe categorii
  const catCounts = {}
  pairs.forEach(p => {
    const cat = corrCategory(p.c)
    if (cat) catCounts[cat.label] = (catCounts[cat.label] || 0) + 1
  })
  const total = pairs.length || 1
  const catPct = {}
  Object.entries(catCounts).forEach(([k, v]) => { catPct[k] = Math.round(v / total * 100) })

  const CATS = [
    { label: 'Foarte ridicată', color: '#ff5572', desc: 'mișcare sincronizată — risc concentrare' },
    { label: 'Ridicată',        color: '#f0b429', desc: 'corelație semnificativă' },
    { label: 'Moderată',        color: '#4d9fff', desc: 'parțial independente' },
    { label: 'Neutră',          color: '#6b7280', desc: 'mișcare independentă' },
    { label: 'Negativă',        color: '#00d4aa', desc: 'mișcare inversă — diversificare' },
  ]

  const conclusion = pairs.length > 0 ? generateConclusion(catPct, pairs) : null

  return (
    <div>
      {/* Range selector */}
      <div style={{display:'flex',gap:6,marginBottom:16,alignItems:'center'}}>
        <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>PERIOADĂ:</span>
        {RANGES.map(r => (
          <button key={r.v} onClick={() => setRange(r.v)} style={{
            padding:'3px 8px',borderRadius:4,border:'none',cursor:'pointer',
            background:range===r.v?'var(--blue)':'var(--surface2)',
            color:range===r.v?'#fff':'var(--text3)',
            fontSize:10,fontFamily:'var(--mono)',fontWeight:600,
          }}>{r.l}</button>
        ))}
      </div>

      {loading && (
        <div style={{textAlign:'center',padding:'40px 0',color:'var(--text3)',fontSize:12,fontFamily:'var(--mono)'}}>
          ⟳ se calculează corelațiile pentru {symbols.length} simboluri...
        </div>
      )}

      {!loading && pairs.length > 0 && (
        <>
          {/* Concluzie */}
          <div style={{
            background:'var(--surface2)',borderRadius:10,padding:'12px 14px',
            marginBottom:16,fontSize:12,color:'var(--text2)',lineHeight:1.5,
            border:'1px solid var(--border)',
          }}>
            {conclusion}
          </div>

          {/* Distribuție categorii */}
          <div style={{marginBottom:20}}>
            <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',fontWeight:600,marginBottom:10,letterSpacing:.5}}>
              DISTRIBUȚIE CORELAȚII ({pairs.length} perechi)
            </div>

            {/* Bara stacked */}
            <div style={{display:'flex',borderRadius:6,overflow:'hidden',height:12,marginBottom:12}}>
              {CATS.map(cat => {
                const pct = catPct[cat.label] || 0
                if (!pct) return null
                return (
                  <div key={cat.label} style={{
                    width:`${pct}%`,background:cat.color,
                    transition:'width .4s',
                  }}/>
                )
              })}
            </div>

            {/* Legendă cu % */}
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {CATS.map(cat => {
                const pct = catPct[cat.label] || 0
                const count = catCounts[cat.label] || 0
                if (!count) return null
                return (
                  <div key={cat.label} style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:10,height:10,borderRadius:2,background:cat.color,flexShrink:0}}/>
                    <div style={{flex:1,fontSize:11,color:'var(--text2)'}}>
                      <span style={{fontFamily:'var(--mono)',fontWeight:700,color:cat.color}}>{pct}%</span>
                      {' '}
                      <span style={{fontWeight:600}}>{cat.label}</span>
                      <span style={{color:'var(--text3)',fontSize:10}}> — {cat.desc}</span>
                    </div>
                    <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>{count} perechi</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top corelații */}
          <div>
            <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',fontWeight:600,marginBottom:10,letterSpacing:.5}}>
              TOP CORELAȚII
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {pairs.slice(0, 8).map(({a, b, c}) => {
                const cat = corrCategory(c)
                return (
                  <div key={`${a}${b}`} style={{
                    display:'flex',alignItems:'center',gap:10,
                    background:'var(--surface2)',borderRadius:8,padding:'10px 12px',
                    border:`1px solid ${cat.color}40`,
                  }}>
                    {/* Simboluri */}
                    <div style={{flex:1,display:'flex',alignItems:'center',gap:6}}>
                      <span style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:12,color:'var(--text)'}}>{a}</span>
                      <span style={{color:'var(--text3)',fontSize:10}}>↔</span>
                      <span style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:12,color:'var(--text)'}}>{b}</span>
                    </div>
                    {/* Bara vizuală */}
                    <div style={{width:80,height:6,borderRadius:3,background:'var(--border)',overflow:'hidden'}}>
                      <div style={{
                        width:`${Math.abs(c)*100}%`,height:'100%',
                        background:cat.color,borderRadius:3,transition:'width .3s',
                      }}/>
                    </div>
                    {/* Valoare + categorie */}
                    <div style={{textAlign:'right',minWidth:90}}>
                      <span style={{fontFamily:'var(--mono)',fontWeight:700,fontSize:13,color:cat.color}}>
                        {c >= 0 ? '+' : ''}{c.toFixed(2)}
                      </span>
                      <div style={{fontSize:9,color:'var(--text3)',marginTop:1}}>{cat.label}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

