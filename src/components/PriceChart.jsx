import { useEffect, useRef, useState } from 'react'
import { fetchHistory } from '../lib/prices.js'

export default function PriceChart({ symbol, height = 200, showVolume = false, avgPrice = null }) {
  const containerRef  = useRef(null)
  const chartRef      = useRef(null)
  const priceSerRef   = useRef(null)
  const avgSerRef     = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [range,   setRange]   = useState('3mo')
  const [chartReady, setChartReady] = useState(0)

  // ── Creează chart-ul O SINGURĂ DATĂ (când se schimbă symbol sau height) ─
  useEffect(() => {
    if (!containerRef.current) return
    let ro

    const setup = async () => {
      const { createChart } = await import('lightweight-charts')

      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current    = null
        priceSerRef.current = null
        avgSerRef.current   = null
      }

      const chart = createChart(containerRef.current, {
        width:  containerRef.current.clientWidth,
        height,
        layout: {
          background: { type: 'solid', color: 'transparent' },
          textColor:  '#4a5578',
          fontFamily: 'Space Mono, monospace',
          fontSize:   10,
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.04)' },
          horzLines: { color: 'rgba(255,255,255,0.04)' },
        },
        crosshair: {
          mode: 1,
          vertLine: { color: 'rgba(77,159,255,0.5)', style: 2, width: 1 },
          horzLine: { color: 'rgba(77,159,255,0.5)', style: 2, width: 1 },
        },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)', textColor: '#4a5578' },
        timeScale:       { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true, secondsVisible: false },
        handleScroll: true,
        handleScale:  true,
      })
      chartRef.current = chart

      // Serie preț — CREATĂ O SINGURĂ DATĂ
      priceSerRef.current = chart.addAreaSeries({
        lineColor:                      '#4d9fff',
        topColor:                       'rgba(77,159,255,0.15)',
        bottomColor:                    'rgba(77,159,255,0.0)',
        lineWidth:                      1,
        lineStyle:                      0,
        crosshairMarkerVisible:         true,
        crosshairMarkerRadius:          4,
        crosshairMarkerBorderColor:     '#4d9fff',
        crosshairMarkerBackgroundColor: '#0a0e1a',
        lastValueVisible:               false,
        priceLineVisible:               false,
      })

      // Serie AVG — CREATĂ O SINGURĂ DATĂ (doar dacă avem avgPrice)
      if (avgPrice != null) {
        avgSerRef.current = chart.addLineSeries({
          color:                  '#f0b429',
          lineWidth:              1,
          lineStyle:              2,
          crosshairMarkerVisible: false,
          lastValueVisible:       true,
          priceLineVisible:       false,
          title:                  '',
        })
      }

      ro = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current)
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
      })
      ro.observe(containerRef.current)
    }

    setup().then(() => setChartReady(r => r + 1)).catch(console.error)

    return () => {
      ro?.disconnect()
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current    = null
        priceSerRef.current = null
        avgSerRef.current   = null
      }
    }
  }, [symbol, height]) // ← DOAR symbol și height recreează chart-ul

  // ── Actualizează DATELE când se schimbă range-ul ─────────────
  useEffect(() => {
    if (!priceSerRef.current) return
    let cancelled = false

    setLoading(true)
    setError(null)

    fetchHistory(symbol, range)
      .then(points => {
        if (cancelled) return
        if (!points || !points.length) {
          setError('Date indisponibile')
          setLoading(false)
          return
        }

        // Deduplicare + sortare (fix 1L)
        const seen  = new Set()
        const clean = points
          .filter(p => {
            if (!p.date || seen.has(p.date)) return false
            seen.add(p.date)
            return true
          })
          .sort((a, b) => (a.date < b.date ? -1 : 1))

        if (!clean.length) {
          setError('Date indisponibile')
          setLoading(false)
          return
        }

        priceSerRef.current?.setData(
          clean.map(p => ({ time: p.date, value: p.close }))
        )

        if (avgSerRef.current) {
          if (avgPrice != null) {
            avgSerRef.current.setData([
              { time: clean[0].date,                value: avgPrice },
              { time: clean[clean.length - 1].date, value: avgPrice },
            ])
          } else {
            avgSerRef.current.setData([])
          }
        }

        chartRef.current?.timeScale().fitContent()
        setLoading(false)
      })
      .catch(e => {
        if (!cancelled) { setError(e.message); setLoading(false) }
      })

    return () => { cancelled = true }
  }, [symbol, range, avgPrice, chartReady])

  const RANGES = [
    { v: '1mo', l: '1L' },
    { v: '3mo', l: '3L' },
    { v: '6mo', l: '6L' },
    { v: '1y',  l: '1A' },
    { v: '2y',  l: '2A' },
  ]

  return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:8, justifyContent:'flex-end', alignItems:'center' }}>
        {avgPrice != null && (
          <span style={{ fontSize:11, fontFamily:'var(--mono)', color:'#f0b429',
            marginRight:'auto', display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ display:'inline-block', width:16, height:0,
              borderTop:'2px dashed #f0b429', verticalAlign:'middle' }}/>
            AVG {avgPrice.toFixed(2)}
          </span>
        )}
        {RANGES.map(r => (
          <button key={r.v} onClick={() => setRange(r.v)} style={{
            padding:'3px 8px', borderRadius:4, border:'none', cursor:'pointer',
            background: range === r.v ? 'var(--blue)' : 'var(--surface2)',
            color:      range === r.v ? '#fff'        : 'var(--text3)',
            fontSize:10, fontFamily:'var(--mono)', fontWeight:600, transition:'all .15s',
          }}>{r.l}</button>
        ))}
      </div>
      <div style={{ position:'relative' }}>
        <div ref={containerRef} style={{ width:'100%', height }}/>
        {loading && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
            justifyContent:'center', background:'rgba(10,14,26,0.7)', borderRadius:8 }}>
            <div style={{ color:'var(--text3)', fontSize:12, fontFamily:'var(--mono)' }}>se încarcă...</div>
          </div>
        )}
        {error && !loading && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ color:'var(--text3)', fontSize:12 }}>{error}</div>
          </div>
        )}
      </div>
    </div>
  )
}

