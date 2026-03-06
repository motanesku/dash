import { CONFIG, USE_WORKER, USE_CLOUD } from '../store/useStore'

// ── Price fetching ─────────────────────────────────────────────
export async function fetchPrices(symbols) {
  if (!symbols.length) return {}

  // Use Cloudflare Worker if configured (no CORS, cached)
  if (USE_WORKER) {
    try {
      const url = `${CONFIG.WORKER_URL}/prices?symbols=${encodeURIComponent(symbols.join(','))}`
      const r = await withTimeout(fetch(url), 10000)
      const j = await r.json()
      if (j.ok && j.prices) return j.prices
    } catch (e) {
      console.warn('Worker price fetch failed, trying direct:', e.message)
    }
  }

  // Use Google Apps Script if configured (via GOOGLEFINANCE)
  if (USE_CLOUD) {
    try {
      const url = `${CONFIG.SCRIPT_URL}?action=getPrices&symbols=${encodeURIComponent(symbols.join(','))}`
      const r = await withTimeout(fetch(url), 12000)
      const j = await r.json()
      if (j.ok && j.prices) return j.prices
    } catch (e) {
      console.warn('Apps Script price fetch failed:', e.message)
    }
  }

  // Last resort: direct Yahoo (may fail due to CORS in browsers)
  const results = await Promise.allSettled(symbols.map(fetchYahooDirect))
  const prices = {}
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) prices[symbols[i]] = r.value
  })
  return prices
}

async function fetchYahooDirect(symbol) {
  for (const host of ['query1', 'query2']) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
      const r = await withTimeout(fetch(url, { headers: { Accept: 'application/json' } }), 4000)
      if (!r.ok) continue
      const j = await r.json()
      const meta = j?.chart?.result?.[0]?.meta
      if (!meta?.regularMarketPrice) continue
      return {
        price: meta.regularMarketPrice,
        prev: meta.previousClose || meta.chartPreviousClose,
        currency: meta.currency || 'USD',
        name: meta.shortName || symbol,
        marketState: meta.marketState,
      }
    } catch { continue }
  }
  return null
}

// ── Price history ──────────────────────────────────────────────
export async function fetchHistory(symbol, range = '3mo', interval = '1d') {
  if (USE_WORKER) {
    try {
      const url = `${CONFIG.WORKER_URL}/history?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`
      const r = await withTimeout(fetch(url), 10000)
      const j = await r.json()
      if (j.ok && j.data) return j.data
    } catch (e) {
      console.warn('Worker history failed:', e.message)
    }
  }
  // Direct fallback
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`
    const r = await withTimeout(fetch(url, { headers: { Accept: 'application/json' } }), 8000)
    const j = await r.json()
    const result = j?.chart?.result?.[0]
    if (!result) return null
    const ts = result.timestamps || []
    const q = result.indicators?.quote?.[0] || {}
    return ts.map((t, i) => ({
      time: t,
      open: q.open?.[i],
      high: q.high?.[i],
      low: q.low?.[i],
      close: q.close?.[i],
      volume: q.volume?.[i],
    })).filter(p => p.close != null)
  } catch { return null }
}

// ── Market data (indices, fear&greed, usd/ron) ─────────────────
export const MARKET_SYMBOLS = ['^GSPC', '^DJI', '^IXIC', '^VIX', 'GC=F', 'CL=F', 'BTC-USD', 'EURUSD=X']
export const MARKET_LABELS = {
  '^GSPC': 'S&P 500', '^DJI': 'Dow Jones', '^IXIC': 'Nasdaq',
  '^VIX': 'VIX', 'GC=F': 'Gold', 'CL=F': 'Oil',
  'BTC-USD': 'Bitcoin', 'EURUSD=X': 'EUR/USD',
}

export async function fetchMarketData() {
  return fetchPrices(MARKET_SYMBOLS)
}

export async function fetchFearGreed() {
  if (USE_WORKER) {
    try {
      const r = await withTimeout(fetch(`${CONFIG.WORKER_URL}/feargreed`), 5000)
      const j = await r.json()
      if (j.ok) return { value: j.value, label: j.label }
    } catch {}
  }
  try {
    const r = await withTimeout(fetch('https://api.alternative.me/fng/?limit=1'), 5000)
    const j = await r.json()
    return { value: +j.data[0].value, label: j.data[0].value_classification }
  } catch { return null }
}

export async function fetchUsdRon() {
  if (USE_WORKER) {
    try {
      const r = await withTimeout(fetch(`${CONFIG.WORKER_URL}/usdron`), 5000)
      const j = await r.json()
      if (j.ok && j.rate) return j.rate
    } catch {}
  }
  const d = await fetchYahooDirect('RON=X')
  return d?.price || null
}

// ── Google Sheets CRUD ─────────────────────────────────────────
const sheetFetch = (body) =>
  fetch(CONFIG.SCRIPT_URL, { method: 'POST', body: JSON.stringify(body) })

export async function sheetLoadTxs() {
  const r = await fetch(CONFIG.SCRIPT_URL)
  const j = await r.json()
  if (!j.ok) throw new Error(j.error)
  return j.data.map(row => ({
    ...row,
    id: Number(row.id) || row.id,
    shares: Number(row.shares),
    price: Number(row.price),
  }))
}

export const sheetAddTx = (tx) => sheetFetch({ action: 'add', tx })
export const sheetAddBulk = (txs) => sheetFetch({ action: 'addBulk', txs })
export const sheetDeleteTx = (id) => sheetFetch({ action: 'delete', id })

export async function sheetLoadClub() {
  const r = await fetch(`${CONFIG.SCRIPT_URL}?action=getClub`)
  const j = await r.json()
  return j.ok ? j.club : null
}
export const sheetSaveClub = (club) => sheetFetch({ action: 'saveClub', club })

// ── Helpers ────────────────────────────────────────────────────
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ])
}

export function excelDate(v) {
  if (!v) return ''
  if (typeof v === 'string' && /\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  if (typeof v === 'string') {
    const m = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000)).toISOString().split('T')[0]
  if (v instanceof Date) return v.toISOString().split('T')[0]
  return String(v).slice(0, 10)
}
