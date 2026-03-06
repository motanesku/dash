/**
 * Cloudflare Worker — Portfolio Tracker Price Proxy
 * Deploy: https://dash.cloudflare.com → Workers → Create Worker → paste this
 * 
 * Endpoints:
 *   GET /api/prices?symbols=AAPL,TLV.RO,^GSPC
 *   GET /api/history?symbol=^GSPC&range=3mo&interval=1d
 *   GET /api/feargreed
 */

const CACHE_TTL = 60; // seconds
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/api/prices') {
        return await handlePrices(url, env);
      }
      if (path === '/api/history') {
        return await handleHistory(url, env);
      }
      if (path === '/api/feargreed') {
        return await handleFearGreed(env);
      }
      return json({ ok: false, error: 'Not found' }, 404);
    } catch (e) {
      return json({ ok: false, error: e.message });
    }
  }
};

// ── /api/prices?symbols=AAPL,BTC-USD,^GSPC ────────────────
async function handlePrices(url, env) {
  const raw = url.searchParams.get('symbols') || '';
  const symbols = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (!symbols.length) return json({ ok: true, prices: {} });

  const cacheKey = 'prices:' + symbols.sort().join(',');
  
  // Try KV cache first
  if (env.CACHE) {
    const cached = await env.CACHE.get(cacheKey);
    if (cached) return json({ ok: true, prices: JSON.parse(cached), cached: true });
  }

  // Fetch from Yahoo Finance
  const prices = {};
  const chunks = chunkArray(symbols, 8); // Yahoo handles ~8 at a time reliably
  
  for (const chunk of chunks) {
    const symsStr = chunk.join(',');
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(chunk[0])}?interval=1d&range=1d`;
    
    // Fetch each symbol (Yahoo v8 is per-symbol, v7 does multi)
    const results = await Promise.allSettled(
      chunk.map(sym => fetchYahooSymbol(sym))
    );
    
    results.forEach((res, i) => {
      if (res.status === 'fulfilled' && res.value) {
        prices[chunk[i]] = res.value;
      }
    });
  }

  // Cache result
  if (env.CACHE) {
    await env.CACHE.put(cacheKey, JSON.stringify(prices), { expirationTtl: CACHE_TTL });
  }

  return json({ ok: true, prices });
}

async function fetchYahooSymbol(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      cf: { cacheTtl: 30, cacheEverything: false }
    });
    if (!r.ok) return null;
    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    return {
      price: meta.regularMarketPrice,
      prev: meta.previousClose || meta.chartPreviousClose,
      currency: meta.currency || 'USD',
      name: meta.shortName || meta.longName || symbol,
      exchange: meta.exchangeName || '',
      marketState: meta.marketState || 'CLOSED',
    };
  } catch { return null; }
}

// ── /api/history?symbol=^GSPC&range=3mo&interval=1d ───────
async function handleHistory(url, env) {
  const symbol = url.searchParams.get('symbol') || '^GSPC';
  const range = url.searchParams.get('range') || '3mo';
  const interval = url.searchParams.get('interval') || '1d';

  const cacheKey = `history:${symbol}:${range}:${interval}`;

  if (env.CACHE) {
    const cached = await env.CACHE.get(cacheKey);
    if (cached) return json({ ok: true, ...JSON.parse(cached), cached: true });
  }

  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    const r = await fetch(yahooUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const data = await r.json();
    const result = data?.chart?.result?.[0];
    if (!result) return json({ ok: false, error: 'No data' });

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const opens = result.indicators?.quote?.[0]?.open || [];
    const highs = result.indicators?.quote?.[0]?.high || [];
    const lows = result.indicators?.quote?.[0]?.low || [];
    const volumes = result.indicators?.quote?.[0]?.volume || [];

    const points = timestamps
      .map((t, i) => ({
        time: t,
        date: new Date(t * 1000).toISOString().split('T')[0],
        open: opens[i],
        high: highs[i],
        low: lows[i],
        close: closes[i],
        volume: volumes[i],
      }))
      .filter(p => p.close != null);

    const payload = { points, symbol, range, interval };

    if (env.CACHE) {
      const ttl = interval === '1d' ? 3600 : 300;
      await env.CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: ttl });
    }

    return json({ ok: true, ...payload });
  } catch (e) {
    return json({ ok: false, error: e.message });
  }
}

// ── /api/feargreed ─────────────────────────────────────────
async function handleFearGreed(env) {
  const cacheKey = 'feargreed';
  if (env.CACHE) {
    const cached = await env.CACHE.get(cacheKey);
    if (cached) return json({ ok: true, ...JSON.parse(cached), cached: true });
  }
  try {
    const r = await fetch('https://api.alternative.me/fng/');
    const data = await r.json();
    const d = data?.data?.[0];
    if (!d) return json({ ok: false, error: 'No data' });
    const payload = { value: +d.value, label: d.value_classification };
    if (env.CACHE) {
      await env.CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: 3600 });
    }
    return json({ ok: true, ...payload });
  } catch (e) {
    return json({ ok: false, error: e.message });
  }
}

// ── helpers ────────────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
