// ╔══════════════════════════════════════════════════════════╗
// ║  Portfolio Tracker — Cloudflare Worker                  ║
// ║  Deploy: wrangler deploy  OR  paste in CF dashboard     ║
// ║  Routes: api.yourdomain.com/*                           ║
// ╚══════════════════════════════════════════════════════════╝

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    // ── /prices?symbols=AAPL,^GSPC,BTC-USD ─────────────────
    if (url.pathname === '/prices') {
      const symsParam = url.searchParams.get('symbols') || ''
      const symbols = symsParam.split(',').map(s => s.trim()).filter(Boolean)
      if (!symbols.length) return json({ ok: false, error: 'no symbols' }, 400)

      // Check KV cache first (if KV binding available)
      const cacheKey = `prices:${symbols.sort().join(',')}`
      if (env.KV) {
        const cached = await env.KV.get(cacheKey)
        if (cached) return json({ ok: true, prices: JSON.parse(cached), cached: true })
      }

      // Fetch from Yahoo Finance
      const results = await Promise.allSettled(
        symbols.map(sym => fetchYahooPrice(sym))
      )

      const prices = {}
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) {
          prices[symbols[i]] = r.value
        }
      })

      // Store in KV cache for 60 seconds
      if (env.KV && Object.keys(prices).length > 0) {
        ctx.waitUntil(env.KV.put(cacheKey, JSON.stringify(prices), { expirationTtl: 60 }))
      }

      return json({ ok: true, prices })
    }

    // ── /history?symbol=^GSPC&range=3mo ─────────────────────
    if (url.pathname === '/history') {
      const symbol = url.searchParams.get('symbol') || '^GSPC'
      const range = url.searchParams.get('range') || '3mo'
      const interval = url.searchParams.get('interval') || '1d'

      const cacheKey = `history:${symbol}:${range}:${interval}`
      if (env.KV) {
        const cached = await env.KV.get(cacheKey)
        if (cached) return json({ ok: true, data: JSON.parse(cached), cached: true })
      }

      const data = await fetchYahooHistory(symbol, range, interval)
      if (!data) return json({ ok: false, error: 'fetch failed' }, 502)

      if (env.KV) {
        ctx.waitUntil(env.KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 }))
      }

      return json({ ok: true, data })
    }

    // ── /history-multi?symbols=AAPL,MSFT&range=6mo ───────────
    if (url.pathname === '/history-multi') {
      const symsParam = url.searchParams.get('symbols') || ''
      const range     = url.searchParams.get('range')   || '6mo'
      const interval  = url.searchParams.get('interval')|| '1d'
      const symbols   = symsParam.split(',').map(s => s.trim()).filter(Boolean)
      if (!symbols.length) return json({ ok: false, error: 'no symbols' }, 400)

      const cacheKey = `history-multi:${symbols.sort().join(',')}:${range}:${interval}`
      if (env.KV) {
        const cached = await env.KV.get(cacheKey)
        if (cached) return json({ ok: true, histories: JSON.parse(cached), cached: true })
      }

      const results = await Promise.allSettled(
        symbols.map(sym => fetchYahooHistory(sym, range, interval))
      )

      const histories = {}
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) {
          histories[symbols[i]] = r.value
        }
      })

      if (env.KV && Object.keys(histories).length > 0) {
        ctx.waitUntil(env.KV.put(cacheKey, JSON.stringify(histories), { expirationTtl: 300 }))
      }

      return json({ ok: true, histories })
    }

    // ── /feargreed ────────────────────────────────────────────
    if (url.pathname === '/feargreed') {
      if (env.KV) {
        const cached = await env.KV.get('feargreed')
        if (cached) return json({ ok: true, ...JSON.parse(cached), cached: true })
      }
      try {
        const r = await fetch('https://api.alternative.me/fng/?limit=1', {
          headers: { 'User-Agent': 'portfolio-tracker/2.0' }
        })
        const j = await r.json()
        const fg = { value: +j.data[0].value, label: j.data[0].value_classification }
        if (env.KV) ctx.waitUntil(env.KV.put('feargreed', JSON.stringify(fg), { expirationTtl: 3600 }))
        return json({ ok: true, ...fg })
      } catch {
        return json({ ok: false, error: 'unavailable' }, 502)
      }
    }

    // ── /usdron ───────────────────────────────────────────────
    if (url.pathname === '/usdron') {
      if (env.KV) {
        const cached = await env.KV.get('usdron')
        if (cached) return json({ ok: true, rate: JSON.parse(cached), cached: true })
      }
      const d = await fetchYahooPrice('RON=X')
      const rate = d?.price || null
      if (rate && env.KV) ctx.waitUntil(env.KV.put('usdron', JSON.stringify(rate), { expirationTtl: 300 }))
      return json({ ok: true, rate })
    }

    return json({ ok: false, error: 'not found' }, 404)
  }
}

// ── Yahoo Finance helpers ────────────────────────────────────
async function fetchYahooPrice(symbol) {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']
  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; portfolio-tracker/2.0)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      })
      if (!r.ok) continue
      const j = await r.json()
      const meta = j?.chart?.result?.[0]?.meta
      if (!meta?.regularMarketPrice) continue
      return {
        price: meta.regularMarketPrice,
        prev: meta.previousClose || meta.chartPreviousClose,
        open: meta.regularMarketOpen,
        high: meta.regularMarketDayHigh,
        low: meta.regularMarketDayLow,
        volume: meta.regularMarketVolume,
        currency: meta.currency || 'USD',
        name: meta.shortName || meta.longName || symbol,
        exchange: meta.exchangeName,
        marketState: meta.marketState, // REGULAR, PRE, POST, CLOSED
        timestamp: Date.now(),
      }
    } catch { continue }
  }
  return null
}

async function fetchYahooHistory(symbol, range, interval) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; portfolio-tracker/2.0)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    const j = await r.json()
    const result = j?.chart?.result?.[0]
    if (!result) return null
    const timestamps = result.timestamps || []
    const closes = result.indicators?.quote?.[0]?.close || []
    const opens = result.indicators?.quote?.[0]?.open || []
    const highs = result.indicators?.quote?.[0]?.high || []
    const lows = result.indicators?.quote?.[0]?.low || []
    const volumes = result.indicators?.quote?.[0]?.volume || []
    return timestamps
      .map((t, i) => ({
        time: t,
        open: opens[i],
        high: highs[i],
        low: lows[i],
        close: closes[i],
        volume: volumes[i],
      }))
      .filter(p => p.close != null)
  } catch {
    return null
  }
}
