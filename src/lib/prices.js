import { WORKER_URL, USE_WORKER } from '../config.js';

const FALLBACK_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
];

async function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return r;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

// ── Via Cloudflare Worker (no CORS, fast) ──────────────────
async function fetchPricesWorker(symbols) {
  const url = `${WORKER_URL}/api/prices?symbols=${encodeURIComponent(symbols.join(','))}`;
  const r = await fetchWithTimeout(url, 10000);
  const j = await r.json();
  if (j.ok) return j.prices;
  throw new Error(j.error || 'Worker error');
}

async function fetchHistoryWorker(symbol, range = '3mo', interval = '1d') {
  const url = `${WORKER_URL}/api/history?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`;
  const r = await fetchWithTimeout(url, 12000);
  const j = await r.json();
  if (j.ok) return j.points;
  throw new Error(j.error || 'Worker error');
}

async function fetchFearGreedWorker() {
  const url = `${WORKER_URL}/api/feargreed`;
  const r = await fetchWithTimeout(url, 6000);
  const j = await r.json();
  if (j.ok) return { value: j.value, label: j.label };
  throw new Error(j.error);
}

// ── Fallback: direct Yahoo via CORS proxy ──────────────────
async function fetchPriceFallback(symbol) {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
  for (const proxy of FALLBACK_PROXIES) {
    try {
      const r = await fetchWithTimeout(proxy + encodeURIComponent(yahooUrl), 8000);
      let text = await r.text();
      // codetabs returns raw, corsproxy wraps differently
      let data;
      try { data = JSON.parse(text); } catch { continue; }
      // corsproxy.io returns raw JSON
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice) {
        return {
          price: meta.regularMarketPrice,
          prev: meta.previousClose || meta.chartPreviousClose,
          currency: meta.currency || 'USD',
          name: meta.shortName || symbol,
          exchange: meta.exchangeName || '',
          marketState: meta.marketState || 'CLOSED',
        };
      }
    } catch { continue; }
  }
  return null;
}

// ── Public API ─────────────────────────────────────────────
export async function fetchPrices(symbols) {
  if (!symbols.length) return {};
  if (USE_WORKER) {
    try { return await fetchPricesWorker(symbols); } catch (e) {
      console.warn('Worker failed, falling back:', e.message);
    }
  }
  // Fallback: parallel per-symbol
  const results = await Promise.allSettled(symbols.map(fetchPriceFallback));
  const prices = {};
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) prices[symbols[i]] = r.value;
  });
  return prices;
}

export async function fetchHistory(symbol, range = '3mo') {
  if (USE_WORKER) {
    try { return await fetchHistoryWorker(symbol, range); } catch (e) {
      console.warn('Worker history failed:', e.message);
    }
  }
  // Fallback via corsproxy
  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
    const r = await fetchWithTimeout('https://corsproxy.io/?' + encodeURIComponent(yahooUrl), 12000);
    const data = await r.json();
    const result = data?.chart?.result?.[0];
    if (!result) return [];
    const ts = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    return ts.map((t, i) => ({
      time: t,
      date: new Date(t * 1000).toISOString().split('T')[0],
      close: closes[i],
    })).filter(p => p.close != null);
  } catch { return []; }
}

export async function fetchFearGreed() {
  if (USE_WORKER) {
    try { return await fetchFearGreedWorker(); } catch {}
  }
  try {
    const r = await fetchWithTimeout('https://api.alternative.me/fng/', 5000);
    const j = await r.json();
    const d = j?.data?.[0];
    if (d) return { value: +d.value, label: d.value_classification };
  } catch {}
  return null;
}

export const MARKET_SYMBOLS = [
  { sym: '^GSPC', label: 'S&P 500' },
  { sym: '^DJI', label: 'Dow Jones' },
  { sym: '^IXIC', label: 'Nasdaq' },
  { sym: '^VIX', label: 'VIX' },
  { sym: 'GC=F', label: 'Gold' },
  { sym: 'CL=F', label: 'Oil' },
  { sym: 'BTC-USD', label: 'Bitcoin' },
  { sym: 'EURUSD=X', label: 'EUR/USD' },
  { sym: 'RON=X', label: 'USD/RON' },
];

// ── Company Info (sector, cap, domain) ─────────────────────
export async function fetchCompanyInfo(symbols) {
  if (!symbols.length) return {};
  try {
    const { WORKER_URL, USE_WORKER } = await import('../config.js');
    if (!USE_WORKER) return {};
    const url = `${WORKER_URL}/api/info?symbols=${encodeURIComponent(symbols.join(','))}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    if (j.ok) return j.info;
  } catch {}
  return {};
}
