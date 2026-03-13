import { useEffect, useRef, useState } from 'react'
import { fetchHistory } from '../lib/prices.js'

export default function PriceChart({ symbol, height = 200, showVolume = false, avgPrice = null }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [range, setRange] = useState('3mo')

  useEffect(() => {
    if (!containerRef.current || !symbol) return
    let chart

    const init = async () => {
      try {
        const { createChart } = await import('lightweight-charts')
        if (chartRef.current) {
          chartRef.current.remove()
          chartRef.current = null
        }
        chart = createChart(containerRef.current, {
          width: containerRef.current.clientWidth,
          height,
          layout: {
            background: { type: 'solid', color: 'transparent' },
            textColor: '#4a5578',
            fontFamily: 'Space Mono, monospace',
            fontSize: 10,
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
          rightPriceScale: {
            borderColor: 'rgba(255,255,255,0.06)',
            textColor: '#4a5578',
          },
          timeScale: {
            borderColor: 'rgba(255,255,255,0.06)',
            timeVisible: true,
            secondsVisible: false,
          },
          handleScroll: true,
          handleScale: true,
        })
        chartRef.current = chart

        const series = chart.addAreaSeries({
          lineColor: '#4d9fff',
          topColor: 'rgba(77,159,255,0.2)',
          bottomColor: 'rgba(77,159,255,0.0)',
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          crosshairMarkerBorderColor: '#4d9fff',
          crosshairMarkerBackgroundColor: '#0a0e1a',
          lastValueVisible: true,
          priceLineVisible: true,
        })

        setLoading(true)
        const points = await fetchHistory(symbol, range)
        if (!points.length) { setError('Date indisponibile'); setLoading(false); return }

        const data = points.map(p => ({ time: p.date, value: p.close }))
        series.setData(data)

        // Linie avg price — portocalie punctată cu etichetă în stânga
        if (avgPrice != null && points.length >= 2) {
          // Linia punctată
          const avgSeries = chart.addLineSeries({
            color: '#f0b429',
            lineWidth: 1,
            lineStyle: 2, // dashed
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          })
          avgSeries.setData([
            { time: points[0].date,                 value: avgPrice },
            { time: points[points.length - 1].date, value: avgPrice },
          ])


        }

        chart.timeScale().fitContent()
        setLoading(false)
        setError(null)

        const ro = new ResizeObserver(() => {
          if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
        })
        ro.observe(containerRef.current)
        return () => ro.disconnect()
      } catch (e) {
        setError(e.message)
        setLoading(false)
      }
    }

    init()
    return () => { if (chartRef.current) { chartRef.current.remove(); chartRef.current = null } }
  }, [symbol, range, height, avgPrice])

  const RANGES = [
    { v:'1mo', l:'1L' },
    { v:'3mo', l:'3L' },
    { v:'6mo', l:'6L' },
    { v:'1y',  l:'1A' },
    { v:'2y',  l:'2A' },
  ]

  return (
    <div>
      <div style={{display:'flex',gap:6,marginBottom:8,justifyContent:'flex-end',alignItems:'center'}}>
        {/* Legendă AVG */}
        {avgPrice != null && (
          <span style={{
            fontSize:10, fontFamily:'var(--mono)', color:'#f0b429',
            marginRight:'auto', display:'flex', alignItems:'center', gap:5,
          }}>
            <span style={{display:'inline-block',width:16,height:1,borderTop:'2px dashed #f0b429',verticalAlign:'middle'}}/>
            AVG {avgPrice.toFixed(2)}
          </span>
        )}
        {RANGES.map(r=>(
          <button key={r.v} onClick={()=>setRange(r.v)} style={{
            padding:'3px 8px',borderRadius:4,border:'none',cursor:'pointer',
            background:range===r.v?'var(--blue)':'var(--surface2)',
            color:range===r.v?'#fff':'var(--text3)',
            fontSize:10,fontFamily:'var(--mono)',fontWeight:600,
            transition:'all .15s',
          }}>{r.l}</button>
        ))}
      </div>
      <div style={{position:'relative'}}>
        <div ref={containerRef} style={{width:'100%',height}}/>
        {loading&&(
          <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(10,14,26,0.7)',borderRadius:8}}>
            <div style={{color:'var(--text3)',fontSize:12,fontFamily:'var(--mono)'}}>se încarcă...</div>
          </div>
        )}
        {error&&!loading&&(
          <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{color:'var(--text3)',fontSize:12}}>{error}</div>
          </div>
        )}
      </div>
    </div>
  )
}

