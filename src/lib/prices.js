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
  if (!j.ok) throw new Error(j.error);
  // Workerul returnează { ok, crypto, stock, vix }
  return { crypto: j.crypto || null, stock: j.stock || null, vix: j.vix || null };
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

// ── Fetch history for multiple symbols in one Worker call ──
export async function fetchHistoryMulti(symbols, range = '6mo') {
  if (!symbols.length) return {};
  if (USE_WORKER) {
    try {
      const url = `${WORKER_URL}/api/history-multi?symbols=${encodeURIComponent(symbols.join(','))}&range=${range}`;
      const r = await fetchWithTimeout(url, 20000);
      const j = await r.json();
      if (j.ok && j.histories) {
        // Normalize: add date string to each point
        const out = {};
        for (const [sym, pts] of Object.entries(j.histories)) {
          out[sym] = pts.map(p => ({
            ...p,
            date: new Date((p.time || p.date) * (typeof p.time === 'number' && p.time > 1e10 ? 1 : 1000))
              .toISOString().split('T')[0],
            close: p.close,
          })).filter(p => p.close != null);
        }
        return out;
      }
    } catch (e) {
      console.warn('fetchHistoryMulti worker failed:', e.message);
    }
  }
  // Fallback: fetch one by one via fetchHistory
  const entries = await Promise.allSettled(symbols.map(s => fetchHistory(s, range)));
  const out = {};
  entries.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value?.length) out[symbols[i]] = r.value;
  });
  return out;
}

export async function fetchFearGreed() {
  // Worker: crypto + vix
  // Browser direct: CNN stock (Cloudflare IP-urile sunt blocate de CNN)
  const [workerResult, cnnResult] = await Promise.allSettled([
    USE_WORKER ? fetchFearGreedWorker() : Promise.reject('no worker'),
    (async () => {
      const r = await fetchWithTimeout('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', 6000);
      const d = await r.json();
      const fg = d?.fear_and_greed;
      if (!fg?.score) return null;
      const ratingMap = {'extreme_fear':'Extreme Fear','fear':'Fear','neutral':'Neutral','greed':'Greed','extreme_greed':'Extreme Greed'};
      return {
        value: Math.round(fg.score),
        label: ratingMap[fg.rating] || fg.rating || '',
        prev_close: fg.previous_close ? Math.round(fg.previous_close) : null,
      };
    })(),
  ]);

  const worker = workerResult.status === 'fulfilled' ? workerResult.value : {};
  const stock  = cnnResult.status === 'fulfilled' ? cnnResult.value : null;

  if (!worker.crypto && !stock && !worker.vix) return null;
  return {
    crypto: worker.crypto || null,
    stock,
    vix: worker.vix || null,
  };
}

// Symbols shown as market cards (VIX excluded - shown in status bar instead)
export const MARKET_SYMBOLS = [
  // Overview
  { sym: '^GSPC',    label: 'S&P 500'     },
  { sym: '^IXIC',    label: 'Nasdaq'      },
  { sym: '^DJI',     label: 'Dow 30'      },
  { sym: 'DX-Y.NYB', label: 'USD Index'   },
  // Stocks top7
  { sym: 'AAPL',  label: 'Apple'      },
  { sym: 'NVDA',  label: 'NVIDIA'     },
  { sym: 'MSFT',  label: 'Microsoft'  },
  { sym: 'AMZN',  label: 'Amazon'     },
  { sym: 'GOOGL', label: 'Alphabet'   },
  { sym: 'META',  label: 'Meta'       },
  { sym: 'TSLA',  label: 'Tesla'      },
  // Futures
  { sym: 'GC=F', label: 'Gold'        },
  { sym: 'SI=F', label: 'Silver'      },
  { sym: 'CL=F', label: 'Crude Oil'   },
  { sym: 'NG=F', label: 'Natural Gas' },
  { sym: 'HG=F', label: 'Copper'      },
  { sym: 'PL=F', label: 'Platinum'    },
  // Crypto
  { sym: 'BTC-USD', label: 'Bitcoin'  },
  { sym: 'ETH-USD', label: 'Ethereum' },
  // Forex
  { sym: 'EURUSD=X', label: 'EUR/USD' },
  { sym: 'USDJPY=X', label: 'USD/JPY' },
  { sym: 'EURRON=X', label: 'EUR/RON' },
  { sym: 'RON=X',    label: 'USD/RON' },
];

// All symbols to fetch (includes VIX for status bar)
export const ALL_MARKET_SYMBOLS = [
  ...MARKET_SYMBOLS,
  { sym: '^VIX', label: 'VIX' },
];

// ── Company Info (sector, cap, domain) ─────────────────────
// Fetch direct din browser (Yahoo blochează din Cloudflare Workers)
function capFromMarketCap(mktCap) {
  if (!mktCap) return '';
  if (mktCap > 200e9) return 'Mega Cap';
  if (mktCap > 10e9)  return 'Large Cap';
  if (mktCap > 2e9)   return 'Mid Cap';
  if (mktCap > 300e6) return 'Small Cap';
  return 'Micro Cap';
}

export async function fetchCompanyInfo(symbols) {
  if (!symbols.length) return {};
  const info = {};

  // Prin Worker — evită CORS block de la browser direct la Yahoo
  try {
    const symsStr = symbols.map(s => encodeURIComponent(s)).join(',');
    const url = `${WORKER_URL}/api/info?symbols=${symsStr}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    if (j?.ok && j.info) {
      Object.assign(info, j.info);
    }
  } catch {}

  // Fill missing
  symbols.forEach(sym => {
    if (!info[sym]) info[sym] = { sector: '', industry: '', domain: '', cap: '', name: '' };
  });

  return info;
}
