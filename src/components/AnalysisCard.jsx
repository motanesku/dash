import { useState, useEffect } from 'react'
import { fetchHistory } from '../lib/prices.js'
import { betaLabel, alphaLabel } from '../lib/beta.js'

// ── Calcule tehnice ──────────────────────────────────────────

function calcRSI(points, period = 14) {
  if (!points || points.length < period + 1) return null
  const changes = []
  for (let i = 1; i < points.length; i++) {
    changes.push(points[i].close - points[i-1].close)
  }
  const recent = changes.slice(-period * 3)
  let gains = 0, losses = 0
  recent.slice(0, period).forEach(c => { if (c > 0) gains += c; else losses -= c })
  let avgGain = gains / period
  let avgLoss = losses / period
  for (let i = period; i < recent.length; i++) {
    const c = recent[i]
    avgGain = (avgGain * (period - 1) + (c > 0 ? c : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (c < 0 ? -c : 0)) / period
  }
  if (avgLoss === 0) return 100
  return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(1))
}

function calcSMA(points, period) {
  if (!points || points.length < period) return null
  const slice = points.slice(-period)
  return slice.reduce((s, p) => s + p.close, 0) / period
}

function calcHV(points, period = 20) {
  if (!points || points.length < period + 1) return null
  const rets = []
  for (let i = points.length - period; i < points.length; i++) {
    if (points[i-1].close > 0) rets.push(Math.log(points[i].close / points[i-1].close))
  }
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length
  return parseFloat((Math.sqrt(variance * 252) * 100).toFixed(1)) // anualizat %
}

// ── Generează concluzie și semnal ───────────────────────────

function generateAnalysis({ beta3m, beta1y, alpha3m, alpha1y, rsi, hv, sma50, sma200, curPrice, avgPrice }) {
  const lines = []
  let signal = 'NEUTRU'
  let signalColor = 'var(--text3)'
  let bullScore = 0, bearScore = 0

  // Beta trend
  if (beta3m != null && beta1y != null) {
    if (beta3m > beta1y + 0.3) {
      lines.push(`Volatilitate în creștere recent (β3L ${beta3m} > β1A ${beta1y}) — acțiunea amplifică mai puternic mișcările pieței față de istoric.`)
      bearScore++
    } else if (beta3m < beta1y - 0.3) {
      lines.push(`Volatilitate în scădere recent (β3L ${beta3m} < β1A ${beta1y}) — acțiunea se stabilizează față de piață.`)
      bullScore++
    } else {
      lines.push(`Volatilitate consistentă față de piață (β3L ${beta3m} ≈ β1A ${beta1y}).`)
    }
  }

  // Alpha
  if (alpha3m != null && alpha1y != null) {
    if (alpha3m > 5 && alpha1y > 5) {
      lines.push(`Alpha pozitiv pe ambele perioade (α3L +${alpha3m.toFixed(1)}%, α1A +${alpha1y.toFixed(1)}%) — acțiunea generează randament propriu consistent, independent de piață.`)
      bullScore += 2
    } else if (alpha3m > 10 && alpha1y < 0) {
      lines.push(`Alpha recent puternic (α3L +${alpha3m.toFixed(1)}%) dar slab pe 1 an (α1A ${alpha1y.toFixed(1)}%) — momentum recent pozitiv pe un fond istoric mai slab.`)
      bullScore++
    } else if (alpha3m < -5 && alpha1y > 5) {
      lines.push(`Perioadă recentă slabă (α3L ${alpha3m.toFixed(1)}%) față de un istoric bun (α1A +${alpha1y.toFixed(1)}%) — posibil pullback temporar.`)
      bullScore++
    } else if (alpha3m < 0 && alpha1y < 0) {
      lines.push(`Alpha negativ pe ambele perioade (α3L ${alpha3m.toFixed(1)}%, α1A ${alpha1y.toFixed(1)}%) — acțiunea subperformează piața consistent.`)
      bearScore += 2
    }
  }

  // RSI
  if (rsi != null) {
    if (rsi > 70) {
      lines.push(`RSI ${rsi} — zonă de supracumpărare. Risc de corecție pe termen scurt.`)
      bearScore++
    } else if (rsi < 30) {
      lines.push(`RSI ${rsi} — zonă de supravânzare. Potențial punct de intrare.`)
      bullScore++
    } else if (rsi >= 50 && rsi <= 65) {
      lines.push(`RSI ${rsi} — momentum pozitiv, fără supraîncălzire.`)
      bullScore++
    } else {
      lines.push(`RSI ${rsi} — zonă neutră.`)
    }
  }

  // SMA
  if (sma50 != null && curPrice != null) {
    const distSMA50 = ((curPrice - sma50) / sma50 * 100).toFixed(1)
    if (curPrice > sma50) {
      lines.push(`Prețul e cu ${distSMA50}% peste SMA50 — trend pe termen mediu bullish.`)
      bullScore++
    } else {
      lines.push(`Prețul e cu ${Math.abs(distSMA50)}% sub SMA50 — trend pe termen mediu bearish.`)
      bearScore++
    }
  }

  // Semnal final
  if (bullScore >= 3) { signal = 'BULLISH'; signalColor = '#00d4aa' }
  else if (bearScore >= 3) { signal = 'BEARISH'; signalColor = '#ff5572' }
  else if (bullScore > bearScore) { signal = 'MODERAT BULLISH'; signalColor = '#4d9fff' }
  else if (bearScore > bullScore) { signal = 'MODERAT BEARISH'; signalColor = '#f0b429' }

  return { lines, signal, signalColor, bullScore, bearScore }
}

function calcTPSL(avgPrice, hv, beta3m, alpha3m, rsi, sma50, curPrice) {
  if (!avgPrice || !hv) return null

  const hvDaily = hv / Math.sqrt(252) // volatilitate zilnică %
  
  // SL: 1.5x volatilitate zilnică × 10 zile (2 săptămâni trading)
  const slPct = Math.min(hvDaily * 1.5 * Math.sqrt(10), 15) // max 15%
  const sl = parseFloat((avgPrice * (1 - slPct / 100)).toFixed(2))

  // TP: bazat pe alpha + beta + RSI
  let tpMultiplier = 2.5 // R/R minim 1:2.5
  if (alpha3m != null && alpha3m > 10) tpMultiplier += 0.5
  if (beta3m != null && beta3m > 2) tpMultiplier += 0.3
  if (rsi != null && rsi < 45) tpMultiplier += 0.4 // mai mult upside dacă RSI scăzut
  if (sma50 != null && curPrice != null && curPrice < sma50) tpMultiplier += 0.3

  const tpPct = slPct * tpMultiplier
  const tp = parseFloat((avgPrice * (1 + tpPct / 100)).toFixed(2))
  const rr = parseFloat(tpMultiplier.toFixed(1))

  return { sl, tp, slPct: slPct.toFixed(1), tpPct: tpPct.toFixed(1), rr }
}

// ── Componenta principală ───────────────────────────────────

export default function AnalysisCard({ p, betas }) {
  const [hist, setHist] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchHistory(p.symbol, '3mo')
      .then(pts => { setHist(pts || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [p.symbol])

  const entry = betas?.[p.symbol] || {}
  const { beta3m, beta1y, alpha3m, alpha1y } = entry

  const rsi    = hist ? calcRSI(hist) : null
  const hv     = hist ? calcHV(hist)  : null
  const sma50  = hist ? calcSMA(hist, 50)  : null
  const sma200 = hist ? calcSMA(hist, 200) : null
  const curPrice = p.curPrice
  const avgPrice = p.avgPrice

  const { lines, signal, signalColor, bullScore, bearScore } = generateAnalysis({
    beta3m, beta1y, alpha3m, alpha1y, rsi, hv, sma50, sma200, curPrice, avgPrice
  })

  const tpsl = (!loading && hv != null) ? calcTPSL(avgPrice, hv, beta3m, alpha3m, rsi, sma50, curPrice) : null

  const CARD = { background:'var(--surface2)', borderRadius:8, padding:'10px 12px' }
  const LBL  = { fontSize:9, color:'var(--text3)', fontWeight:600, marginBottom:4, letterSpacing:.4 }
  const VAL  = { fontFamily:'var(--mono)', fontSize:13, fontWeight:700 }

  return (
    <div style={{
      background:'var(--surface)', border:'1px solid #a78bfa40',
      borderTop:'none', borderRadius:'0 0 12px 12px', padding:'14px 16px',
    }}>
      {loading ? (
        <div style={{textAlign:'center',padding:'20px 0',color:'var(--text3)',fontSize:11,fontFamily:'var(--mono)'}}>
          ⟳ se calculează analiza...
        </div>
      ) : (
        <>
          {/* Semnal */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            marginBottom:14, padding:'10px 12px',
            background:`${signalColor}15`, borderRadius:8,
            border:`1px solid ${signalColor}40`,
          }}>
            <div>
              <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,marginBottom:2}}>SEMNAL</div>
              <div style={{fontFamily:'var(--mono)',fontWeight:800,fontSize:14,color:signalColor}}>{signal}</div>
            </div>
            <div style={{display:'flex',gap:6}}>
              <div style={{textAlign:'center',background:'rgba(0,212,170,0.1)',borderRadius:6,padding:'4px 8px'}}>
                <div style={{fontSize:8,color:'var(--text3)'}}>BULL</div>
                <div style={{fontFamily:'var(--mono)',fontWeight:700,color:'#00d4aa'}}>{bullScore}</div>
              </div>
              <div style={{textAlign:'center',background:'rgba(255,85,114,0.1)',borderRadius:6,padding:'4px 8px'}}>
                <div style={{fontSize:8,color:'var(--text3)'}}>BEAR</div>
                <div style={{fontFamily:'var(--mono)',fontWeight:700,color:'#ff5572'}}>{bearScore}</div>
              </div>
            </div>
          </div>

          {/* Grid metrici */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
            {/* Beta */}
            <div style={CARD}>
              <div style={LBL}>BETA</div>
              <div style={{display:'flex',gap:8,alignItems:'baseline'}}>
                {beta3m!=null && <span style={{...VAL,color:'#f0b429'}}>β3L {beta3m}</span>}
                {beta1y!=null && <span style={{...VAL,fontSize:11,color:'#60a5fa'}}>β1A {beta1y}</span>}
              </div>
              <div style={{fontSize:9,color:'var(--text3)',marginTop:3}}>{betaLabel(beta3m)?.text}</div>
            </div>

            {/* Alpha */}
            <div style={CARD}>
              <div style={LBL}>ALPHA ANUAL</div>
              <div style={{display:'flex',gap:8,alignItems:'baseline'}}>
                {alpha3m!=null && <span style={{...VAL,color:'#a78bfa',fontSize:11}}>{alpha3m>0?'+':''}{alpha3m?.toFixed(1)}%</span>}
                {alpha1y!=null && <span style={{...VAL,color:'#34d399',fontSize:11}}>{alpha1y>0?'+':''}{alpha1y?.toFixed(1)}%</span>}
              </div>
              <div style={{fontSize:9,color:'var(--text3)',marginTop:3}}>3L · 1A</div>
            </div>

            {/* RSI */}
            <div style={CARD}>
              <div style={LBL}>RSI (14)</div>
              <div style={{...VAL, color: rsi==null?'var(--text3)': rsi>70?'#ff5572':rsi<30?'#00d4aa':'var(--text)'}}>
                {rsi ?? '—'}
              </div>
              <div style={{fontSize:9,color:'var(--text3)',marginTop:3}}>
                {rsi==null?'—':rsi>70?'Supracumpărat':rsi<30?'Supravândut':rsi>=50?'Momentum pozitiv':'Neutru/Slab'}
              </div>
            </div>

            {/* HV */}
            <div style={CARD}>
              <div style={LBL}>VOLATILITATE (HV)</div>
              <div style={{...VAL, color: hv==null?'var(--text3)':hv>60?'#ff5572':hv>35?'#f0b429':'#00d4aa'}}>
                {hv != null ? `${hv}%` : '—'}
              </div>
              <div style={{fontSize:9,color:'var(--text3)',marginTop:3}}>anualizat 20 zile</div>
            </div>

            {/* SMA50 */}
            <div style={CARD}>
              <div style={LBL}>vs SMA 50</div>
              {sma50 != null && curPrice != null ? (() => {
                const d = ((curPrice - sma50) / sma50 * 100)
                return <>
                  <div style={{...VAL, color: d>=0?'#00d4aa':'#ff5572'}}>{d>=0?'+':''}{d.toFixed(1)}%</div>
                  <div style={{fontSize:9,color:'var(--text3)',marginTop:3}}>{d>=0?'Peste SMA50':'Sub SMA50'}</div>
                </>
              })() : <div style={{...VAL}}>—</div>}
            </div>

            {/* SMA200 */}
            <div style={CARD}>
              <div style={LBL}>vs SMA 200</div>
              {sma200 != null && curPrice != null ? (() => {
                const d = ((curPrice - sma200) / sma200 * 100)
                return <>
                  <div style={{...VAL, color: d>=0?'#00d4aa':'#ff5572'}}>{d>=0?'+':''}{d.toFixed(1)}%</div>
                  <div style={{fontSize:9,color:'var(--text3)',marginTop:3}}>{d>=0?'Peste SMA200':'Sub SMA200'}</div>
                </>
              })() : <div style={{...VAL}}>—</div>}
            </div>
          </div>

          {/* TP / SL */}
          {tpsl && (
            <div style={{marginBottom:14,padding:'12px',background:'var(--surface2)',borderRadius:8,border:'1px solid var(--border)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{fontSize:10,color:'var(--text3)',fontWeight:600,letterSpacing:.4}}>TP / SL ESTIMAT</div>
                <div style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--text3)'}}>
                  R/R 1:<span style={{color:'#4d9fff',fontWeight:700}}>{tpsl.rr}</span>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:9,color:'var(--text3)',marginBottom:3}}>INTRARE</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:700}}>${avgPrice?.toFixed(2)}</div>
                </div>
                <div style={{textAlign:'center',background:'rgba(255,85,114,0.08)',borderRadius:6,padding:'4px'}}>
                  <div style={{fontSize:9,color:'#ff5572',marginBottom:3,fontWeight:600}}>STOP LOSS</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:700,color:'#ff5572'}}>${tpsl.sl}</div>
                  <div style={{fontSize:9,color:'#ff5572'}}>-{tpsl.slPct}%</div>
                </div>
                <div style={{textAlign:'center',background:'rgba(0,212,170,0.08)',borderRadius:6,padding:'4px'}}>
                  <div style={{fontSize:9,color:'#00d4aa',marginBottom:3,fontWeight:600}}>TAKE PROFIT</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:12,fontWeight:700,color:'#00d4aa'}}>${tpsl.tp}</div>
                  <div style={{fontSize:9,color:'#00d4aa'}}>+{tpsl.tpPct}%</div>
                </div>
              </div>
              {/* Bara vizuală SL—Entry—TP */}
              {(() => {
                const min = tpsl.sl * 0.99
                const max = tpsl.tp * 1.01
                const range = max - min
                const entryPct = ((avgPrice - min) / range * 100).toFixed(1)
                const curPct   = curPrice ? ((curPrice - min) / range * 100).toFixed(1) : null
                return (
                  <div style={{marginTop:10,position:'relative',height:6,borderRadius:3,background:'var(--border)',overflow:'visible'}}>
                    <div style={{position:'absolute',left:0,width:'100%',height:'100%',borderRadius:3,
                      background:'linear-gradient(to right, #ff557240, #f0b42940, #00d4aa40)'}}/>
                    {/* Entry marker */}
                    <div style={{position:'absolute',left:`${entryPct}%`,top:-3,width:2,height:12,
                      background:'white',borderRadius:1,transform:'translateX(-50%)'}}/>
                    {/* Cur price marker */}
                    {curPct && (
                      <div style={{position:'absolute',left:`${curPct}%`,top:-4,width:8,height:8,
                        borderRadius:'50%',background:'#4d9fff',border:'2px solid white',
                        transform:'translate(-50%,-25%)'}}/>
                    )}
                  </div>
                )
              })()}
              <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontSize:8,color:'var(--text3)'}}>
                <span>SL ${tpsl.sl}</span>
                <span style={{color:'white'}}>▲ Intrare</span>
                <span>TP ${tpsl.tp}</span>
              </div>
            </div>
          )}

          {/* Concluzii */}
          <div style={{borderTop:'1px solid var(--border)',paddingTop:12}}>
            <div style={{fontSize:9,color:'var(--text3)',fontWeight:600,marginBottom:8,letterSpacing:.4}}>ANALIZĂ</div>
            {lines.map((line, i) => (
              <div key={i} style={{
                fontSize:11,color:'var(--text2)',lineHeight:1.6,marginBottom:6,
                paddingLeft:8,borderLeft:`2px solid ${signalColor}60`,
              }}>{line}</div>
            ))}
          </div>

          {/* Disclaimer */}
          <div style={{marginTop:10,fontSize:9,color:'var(--text3)',fontStyle:'italic',lineHeight:1.5}}>
            ⚠️ Estimări statistice bazate pe date istorice. Nu constituie recomandare de investiție. TP/SL calculat din volatilitate istorică.
          </div>
        </>
      )}
    </div>
  )
}
