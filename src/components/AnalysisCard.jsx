import { useState, useEffect } from 'react'
import { fetchHistory } from '../lib/prices.js'
import { betaLabel, alphaLabel } from '../lib/beta.js'

// ── Calcule tehnice ──────────────────────────────────────────

function calcRSI(points, period = 14) {
  if (!points || points.length < period + 1) return null
  const changes = []
  for (let i = 1; i < points.length; i++) changes.push(points[i].close - points[i-1].close)
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

// EMA — pune mai mult accent pe prețurile recente vs SMA
function calcEMA(points, period) {
  if (!points || points.length < period) return null
  const k = 2 / (period + 1)
  let ema = points.slice(0, period).reduce((s, p) => s + p.close, 0) / period
  for (let i = period; i < points.length; i++) {
    ema = points[i].close * k + ema * (1 - k)
  }
  return parseFloat(ema.toFixed(2))
}

function calcHV(points, period = 20) {
  if (!points || points.length < period + 1) return null
  const rets = []
  for (let i = points.length - period; i < points.length; i++) {
    if (points[i-1].close > 0) rets.push(Math.log(points[i].close / points[i-1].close))
  }
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length
  return parseFloat((Math.sqrt(variance * 252) * 100).toFixed(1))
}

// ── Generează concluzie și semnal ───────────────────────────

function generateAnalysis({ beta3m, beta1y, alpha3m, alpha1y, rsi, hv, ema50, ema200, curPrice, avgPrice }) {
  const lines = []
  let bullScore = 0, bearScore = 0

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

  if (alpha3m != null && alpha1y != null) {
    if (alpha3m > 5 && alpha1y > 5) {
      lines.push(`Alpha pozitiv pe ambele perioade (α3L +${alpha3m.toFixed(1)}%, α1A +${alpha1y.toFixed(1)}%) — acțiunea generează randament propriu consistent.`)
      bullScore += 2
    } else if (alpha3m > 10 && alpha1y < 0) {
      lines.push(`Momentum recent pozitiv (α3L +${alpha3m.toFixed(1)}%) pe un fond de 1 an slab (α1A ${alpha1y.toFixed(1)}%) — perioadă de revenire posibilă.`)
      bullScore++
    } else if (alpha3m < -5 && alpha1y > 5) {
      lines.push(`Pullback recent (α3L ${alpha3m.toFixed(1)}%) față de un fond bun pe 1 an (α1A +${alpha1y.toFixed(1)}%) — posibilă oportunitate.`)
      bullScore++
    } else if (alpha3m < 0 && alpha1y < 0) {
      lines.push(`Alpha negativ pe ambele perioade (α3L ${alpha3m.toFixed(1)}%, α1A ${alpha1y.toFixed(1)}%) — subperformanță față de piață.`)
      bearScore += 2
    }
  }

  if (rsi != null) {
    if (rsi > 70) { lines.push(`RSI ${rsi} — supracumpărat. Risc de corecție pe termen scurt.`); bearScore++ }
    else if (rsi < 30) { lines.push(`RSI ${rsi} — supravândut. Potențial punct de intrare.`); bullScore++ }
    else if (rsi >= 50 && rsi <= 65) { lines.push(`RSI ${rsi} — momentum pozitiv, fără supraîncălzire.`); bullScore++ }
    else { lines.push(`RSI ${rsi} — zonă neutră.`) }
  }

  if (ema50 != null && curPrice != null) {
    const d = ((curPrice - ema50) / ema50 * 100)
    if (curPrice > ema50) { lines.push(`Prețul e cu ${d.toFixed(1)}% peste EMA50 — trend pe termen mediu bullish.`); bullScore++ }
    else { lines.push(`Prețul e cu ${Math.abs(d).toFixed(1)}% sub EMA50 — trend pe termen mediu bearish.`); bearScore++ }
  }

  if (ema200 != null && curPrice != null) {
    const d = ((curPrice - ema200) / ema200 * 100)
    if (curPrice > ema200) { lines.push(`Prețul e cu ${d.toFixed(1)}% peste EMA200 — trend pe termen lung bullish.`); bullScore++ }
    else { lines.push(`Prețul e cu ${Math.abs(d).toFixed(1)}% sub EMA200 — trend pe termen lung bearish.`); bearScore++ }
  }

  let signal = 'NEUTRU', signalColor = 'var(--text3)'
  if (bullScore >= 4) { signal = 'BULLISH'; signalColor = '#00d4aa' }
  else if (bearScore >= 4) { signal = 'BEARISH'; signalColor = '#ff5572' }
  else if (bullScore > bearScore + 1) { signal = 'MODERAT BULLISH'; signalColor = '#4d9fff' }
  else if (bearScore > bullScore + 1) { signal = 'MODERAT BEARISH'; signalColor = '#f0b429' }

  return { lines, signal, signalColor, bullScore, bearScore }
}

function calcTPSL(avgPrice, hv, beta3m, alpha3m, rsi, ema50, curPrice) {
  if (!avgPrice || !hv) return null
  const hvDaily = hv / Math.sqrt(252)
  const slPct = Math.min(hvDaily * 1.5 * Math.sqrt(10), 15)
  const sl = parseFloat((avgPrice * (1 - slPct / 100)).toFixed(2))

  // TP1 — conservator R/R 1:1.5
  const tp1Pct = slPct * 1.5
  const tp1 = parseFloat((avgPrice * (1 + tp1Pct / 100)).toFixed(2))

  // TP2 — optimist R/R dinamic
  let rr2 = 2.5
  if (alpha3m != null && alpha3m > 10) rr2 += 0.5
  if (beta3m != null && beta3m > 2) rr2 += 0.3
  if (rsi != null && rsi < 45) rr2 += 0.4
  if (ema50 != null && curPrice != null && curPrice < ema50) rr2 += 0.3
  const tp2Pct = slPct * rr2
  const tp2 = parseFloat((avgPrice * (1 + tp2Pct / 100)).toFixed(2))

  return {
    sl, tp1, tp2,
    slPct: slPct.toFixed(1),
    tp1Pct: tp1Pct.toFixed(1),
    tp2Pct: tp2Pct.toFixed(1),
    rr1: 1.5, rr2: parseFloat(rr2.toFixed(1)),
  }
}

// ── Componenta principală ───────────────────────────────────

export default function AnalysisCard({ p, betas }) {
  const [hist3m, setHist3m] = useState(null)
  const [hist1y, setHist1y] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showRRInfo, setShowRRInfo] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchHistory(p.symbol, '3mo'),
      fetchHistory(p.symbol, '1y'),
    ]).then(([h3m, h1y]) => {
      setHist3m(h3m || [])
      setHist1y(h1y || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [p.symbol])

  const entry = betas?.[p.symbol] || {}
  const { beta3m, beta1y, alpha3m, alpha1y } = entry

  const rsi    = hist3m ? calcRSI(hist3m)       : null
  const hv     = hist3m ? calcHV(hist3m)         : null
  const ema50  = hist3m ? calcEMA(hist3m, 50)    : null
  const ema200 = hist1y ? calcEMA(hist1y, 200)   : null
  const curPrice = p.curPrice
  const avgPrice = p.avgPrice

  const { lines, signal, signalColor, bullScore, bearScore } = generateAnalysis({
    beta3m, beta1y, alpha3m, alpha1y, rsi, hv, ema50, ema200, curPrice, avgPrice
  })

  const tpsl = (!loading && hv != null) ? calcTPSL(avgPrice, hv, beta3m, alpha3m, rsi, ema50, curPrice) : null

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
              <div style={{textAlign:'center',background:'rgba(0,212,170,0.1)',borderRadius:6,padding:'4px 10px'}}>
                <div style={{fontSize:8,color:'var(--text3)'}}>BULL</div>
                <div style={{fontFamily:'var(--mono)',fontWeight:700,color:'#00d4aa'}}>{bullScore}</div>
              </div>
              <div style={{textAlign:'center',background:'rgba(255,85,114,0.1)',borderRadius:6,padding:'4px 10px'}}>
                <div style={{fontSize:8,color:'var(--text3)'}}>BEAR</div>
                <div style={{fontFamily:'var(--mono)',fontWeight:700,color:'#ff5572'}}>{bearScore}</div>
              </div>
            </div>
          </div>

          {/* Grid metrici */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
            <div style={CARD}>
              <div style={LBL}>BETA</div>
              <div style={{display:'flex',gap:8,alignItems:'baseline'}}>
                {beta3m!=null && <span style={{...VAL,color:'#f0b429'}}>β3L {beta3m}</span>}
                {beta1y!=null && <span style={{...VAL,fontSize:11,color:'#60a5fa'}}>β1A {beta1y}</span>}
              </div>
              <div style={{fontSize:9,color:'var(--text3)',marginTop:3}}>{betaLabel(beta3m)?.text}</div>
            </div>

            <div style={CARD}>
              <div style={LBL}>ALPHA ANUAL</div>
              <div style={{display:'flex',gap:8,alignItems:'baseline',flexWrap:'wrap'}}>
                {alpha3m!=null && <span style={{...VAL,color:'#a78bfa',fontSize:11}}>{alpha3m>0?'+':''}{alpha3m?.toFixed(1)}%</span>}
                {alpha1y!=null && <span style={{...VAL,color:'#34d399',fontSize:11}}>{alpha1y>0?'+':''}{alpha1y?.toFixed(1)}%</span>}
              </div>
              <div style={{fontSize:9,color:'var(--text3)',marginTop:3}}>3L · 1A</div>
            </div>

            <div style={CARD}>
              <div style={LBL}>RSI (14)</div>
              <div style={{...VAL, color: rsi==null?'var(--text3)':rsi>70?'#ff5572':rsi<30?'#00d4aa':'var(--text)'}}>
                {rsi ?? '—'}
              </div>
              <div style={{fontSize:9,color:'var(--text3)',marginTop:3}}>
                {rsi==null?'—':rsi>70?'Supracumpărat':rsi<30?'Supravândut':rsi>=50?'Momentum pozitiv':'Neutru/Slab'}
              </div>
            </div>

            <div style={CARD}>
              <div style={LBL}>VOLATILITATE (HV)</div>
              <div style={{...VAL, color: hv==null?'var(--text3)':hv>60?'#ff5572':hv>35?'#f0b429':'#00d4aa'}}>
                {hv != null ? `${hv}%` : '—'}
              </div>
              <div style={{fontSize:9,color:'var(--text3)',marginTop:3}}>anualizat 20 zile</div>
            </div>

            <div style={CARD}>
              <div style={LBL}>vs EMA 50</div>
              {ema50 != null && curPrice != null ? (() => {
                const d = ((curPrice - ema50) / ema50 * 100)
                return <>
                  <div style={{...VAL, color: d>=0?'#00d4aa':'#ff5572'}}>{d>=0?'+':''}{d.toFixed(1)}%</div>
                  <div style={{fontSize:9,color:'var(--text3)',marginTop:3}}>{d>=0?'Peste EMA50':'Sub EMA50'}</div>
                </>
              })() : <div style={{...VAL,color:'var(--text3)'}}>—</div>}
            </div>

            <div style={CARD}>
              <div style={LBL}>vs EMA 200</div>
              {ema200 != null && curPrice != null ? (() => {
                const d = ((curPrice - ema200) / ema200 * 100)
                return <>
                  <div style={{...VAL, color: d>=0?'#00d4aa':'#ff5572'}}>{d>=0?'+':''}{d.toFixed(1)}%</div>
                  <div style={{fontSize:9,color:'var(--text3)',marginTop:3}}>{d>=0?'Peste EMA200':'Sub EMA200'}</div>
                </>
              })() : <div style={{...VAL,color:'var(--text3)'}}>—</div>}
            </div>
          </div>

          {/* TP / SL */}
          {tpsl && (
            <div style={{marginBottom:14,padding:'12px',background:'var(--surface2)',borderRadius:8,border:'1px solid var(--border)'}}>
              {/* Header */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontSize:10,color:'var(--text3)',fontWeight:600,letterSpacing:.4}}>TP / SL ESTIMAT</div>
                <div
                  style={{cursor:'pointer',fontFamily:'var(--mono)',fontSize:10,color:'#4d9fff',
                    background:'rgba(77,159,255,0.1)',borderRadius:4,padding:'2px 8px',border:'1px solid rgba(77,159,255,0.3)'}}
                  onClick={()=>setShowRRInfo(v=>!v)}
                >
                  R/R 1:<span style={{fontWeight:700}}>{tpsl.rr2}</span> ℹ
                </div>
              </div>

              {/* R/R explicatie */}
              {showRRInfo && (
                <div style={{marginBottom:12,padding:'8px 10px',background:'rgba(77,159,255,0.08)',
                  borderRadius:6,border:'1px solid rgba(77,159,255,0.2)',fontSize:10,color:'var(--text2)',lineHeight:1.6}}>
                  <strong style={{color:'#4d9fff'}}>Risk/Reward Ratio</strong> arată câți dolari câștigați pentru fiecare dolar riscat.<br/>
                  <strong>R/R 1:{tpsl.rr2}</strong> = riști ${(avgPrice - tpsl.sl).toFixed(2)} pentru a câștiga ${(tpsl.tp2 - avgPrice).toFixed(2)}.<br/>
                  <span style={{color:'var(--text3)'}}>Minim recomandat: 1:2. Cu cât mai mare, cu atât mai favorabil.</span>
                </div>
              )}

              {/* Bara vizuală — DEASUPRA cifrelor */}
              {(() => {
                const min = tpsl.sl * 0.995
                const max = tpsl.tp2 * 1.005
                const range = max - min
                const pct = v => ((v - min) / range * 100).toFixed(2)
                const entryPct = pct(avgPrice)
                const curPct   = curPrice ? pct(Math.min(Math.max(curPrice, min), max)) : null
                const slPct    = pct(tpsl.sl)
                const tp1Pct   = pct(tpsl.tp1)
                const tp2Pct   = pct(tpsl.tp2)

                return (
                  <div style={{marginBottom:14}}>
                    {/* Labels deasupra */}
                    <div style={{position:'relative',height:28,marginBottom:4}}>
                      {/* SL label */}
                      <div style={{position:'absolute',left:`${slPct}%`,transform:'translateX(-50%)',
                        fontSize:8,color:'#ff5572',fontFamily:'var(--mono)',fontWeight:600,textAlign:'center',whiteSpace:'nowrap'}}>
                        SL<br/>${tpsl.sl}
                      </div>
                      {/* Entry label */}
                      <div style={{position:'absolute',left:`${entryPct}%`,transform:'translateX(-50%)',
                        fontSize:8,color:'white',fontFamily:'var(--mono)',fontWeight:600,textAlign:'center',whiteSpace:'nowrap'}}>
                        IN<br/>${avgPrice?.toFixed(2)}
                      </div>
                      {/* TP1 label */}
                      <div style={{position:'absolute',left:`${tp1Pct}%`,transform:'translateX(-50%)',
                        fontSize:8,color:'#4d9fff',fontFamily:'var(--mono)',fontWeight:600,textAlign:'center',whiteSpace:'nowrap'}}>
                        TP1<br/>${tpsl.tp1}
                      </div>
                      {/* TP2 label */}
                      <div style={{position:'absolute',left:`${tp2Pct}%`,transform:'translateX(-50%)',
                        fontSize:8,color:'#00d4aa',fontFamily:'var(--mono)',fontWeight:600,textAlign:'center',whiteSpace:'nowrap'}}>
                        TP2<br/>${tpsl.tp2}
                      </div>
                    </div>

                    {/* Bara */}
                    <div style={{position:'relative',height:10,borderRadius:5,
                      background:'linear-gradient(to right, #ff557250, #f0b42930, #4d9fff40, #00d4aa50)',
                      overflow:'visible'}}>
                      {/* SL marker */}
                      <div style={{position:'absolute',left:`${slPct}%`,top:-2,width:2,height:14,
                        background:'#ff5572',borderRadius:1,transform:'translateX(-50%)'}}/>
                      {/* Entry marker */}
                      <div style={{position:'absolute',left:`${entryPct}%`,top:-3,width:3,height:16,
                        background:'white',borderRadius:1,transform:'translateX(-50%)'}}/>
                      {/* TP1 marker */}
                      <div style={{position:'absolute',left:`${tp1Pct}%`,top:-2,width:2,height:14,
                        background:'#4d9fff',borderRadius:1,transform:'translateX(-50%)'}}/>
                      {/* TP2 marker */}
                      <div style={{position:'absolute',left:`${tp2Pct}%`,top:-2,width:2,height:14,
                        background:'#00d4aa',borderRadius:1,transform:'translateX(-50%)'}}/>
                      {/* Cur price dot */}
                      {curPct && (
                        <div style={{position:'absolute',left:`${curPct}%`,top:'50%',width:10,height:10,
                          borderRadius:'50%',background:'#f0b429',border:'2px solid white',
                          transform:'translate(-50%,-50%)',zIndex:2}}/>
                      )}
                    </div>

                    {/* Labels sub bara */}
                    <div style={{position:'relative',height:16,marginTop:4}}>
                      <div style={{position:'absolute',left:`${slPct}%`,transform:'translateX(-50%)',
                        fontSize:7,color:'var(--text3)',fontFamily:'var(--mono)',whiteSpace:'nowrap'}}>
                        -{tpsl.slPct}%
                      </div>
                      <div style={{position:'absolute',left:`${tp1Pct}%`,transform:'translateX(-50%)',
                        fontSize:7,color:'var(--text3)',fontFamily:'var(--mono)',whiteSpace:'nowrap'}}>
                        +{tpsl.tp1Pct}%
                      </div>
                      <div style={{position:'absolute',left:`${tp2Pct}%`,transform:'translateX(-50%)',
                        fontSize:7,color:'var(--text3)',fontFamily:'var(--mono)',whiteSpace:'nowrap'}}>
                        +{tpsl.tp2Pct}%
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Cifre */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:6}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:8,color:'var(--text3)',marginBottom:2}}>INTRARE</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:11,fontWeight:700}}>${avgPrice?.toFixed(2)}</div>
                </div>
                <div style={{textAlign:'center',background:'rgba(255,85,114,0.08)',borderRadius:6,padding:'4px 2px'}}>
                  <div style={{fontSize:8,color:'#ff5572',marginBottom:2,fontWeight:600}}>STOP LOSS</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:11,fontWeight:700,color:'#ff5572'}}>${tpsl.sl}</div>
                </div>
                <div style={{textAlign:'center',background:'rgba(77,159,255,0.08)',borderRadius:6,padding:'4px 2px'}}>
                  <div style={{fontSize:8,color:'#4d9fff',marginBottom:2,fontWeight:600}}>TP 1</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:11,fontWeight:700,color:'#4d9fff'}}>${tpsl.tp1}</div>
                </div>
                <div style={{textAlign:'center',background:'rgba(0,212,170,0.08)',borderRadius:6,padding:'4px 2px'}}>
                  <div style={{fontSize:8,color:'#00d4aa',marginBottom:2,fontWeight:600}}>TP 2</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:11,fontWeight:700,color:'#00d4aa'}}>${tpsl.tp2}</div>
                </div>
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

          <div style={{marginTop:10,fontSize:9,color:'var(--text3)',fontStyle:'italic',lineHeight:1.5}}>
            ⚠️ Estimări statistice bazate pe date istorice.
          </div>
        </>
      )}
    </div>
  )
}

