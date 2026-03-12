import { fetchHistory, fetchHistoryMulti } from './prices.js';

const BETA_CACHE_KEY = 'ptf_v6_betas';
const BETA_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 ore

function readBetaCache() {
  try {
    const s = localStorage.getItem(BETA_CACHE_KEY);
    if (!s) return null;
    const { ts, data } = JSON.parse(s);
    if (Date.now() - ts > BETA_CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function writeBetaCache(data) {
  try { localStorage.setItem(BETA_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

// Calculează beta dintre un simbol și S&P 500
// returns: { beta, label, emoji }
export function calcBeta(symReturns, spReturns) {
  if (!symReturns?.length || !spReturns?.length) return null;

  // Aliniază datele după dată
  const spMap = {};
  spReturns.forEach(p => { spMap[p.date] = p.ret; });

  const pairs = symReturns
    .filter(p => spMap[p.date] != null)
    .map(p => ({ sym: p.ret, sp: spMap[p.date] }));

  if (pairs.length < 10) return null;

  const n = pairs.length;
  const meanSym = pairs.reduce((s, p) => s + p.sym, 0) / n;
  const meanSp  = pairs.reduce((s, p) => s + p.sp, 0) / n;

  let cov = 0, varSp = 0;
  pairs.forEach(p => {
    cov   += (p.sym - meanSym) * (p.sp - meanSp);
    varSp += (p.sp - meanSp) ** 2;
  });

  if (varSp === 0) return null;
  const beta = cov / varSp;
  return beta;
}

// Transformă istoric în returnuri zilnice
function toReturns(points) {
  if (!points?.length) return [];
  return points.slice(1).map((p, i) => ({
    date: p.date,
    ret: points[i].close > 0 ? (p.close - points[i].close) / points[i].close : 0,
  }));
}

// Etichetă beta
export function betaLabel(beta) {
  if (beta == null) return null;
  if (beta < 0)    return { text: 'Invers piață', emoji: '🔄', color: 'var(--purple)' };
  if (beta < 0.5)  return { text: 'Foarte defensiv', emoji: '🛡️', color: '#34d399' };
  if (beta < 0.8)  return { text: 'Defensiv', emoji: '🛡️', color: '#34d399' };
  if (beta < 1.2)  return { text: '≈ Piață', emoji: '📊', color: 'var(--text3)' };
  if (beta < 1.8)  return { text: 'Volatil', emoji: '⚡', color: '#f0b429' };
  return             { text: 'Foarte volatil', emoji: '🔥', color: 'var(--red)' };
}

// Fetch și calculează beta pentru o listă de simboluri
export async function fetchBetas(symbols) {
  const cached = readBetaCache();
  if (cached) {
    const missing = symbols.filter(s => cached[s] == null);
    if (!missing.length) return cached;
  }

  try {
    const [spHistory, symHistories] = await Promise.all([
      fetchHistory('^GSPC', '3mo'),
      fetchHistoryMulti(symbols, '3mo'),
    ]);

    const spReturns = toReturns(spHistory);
    const betas = { ...(cached || {}) };

    symbols.forEach(sym => {
      const hist = symHistories[sym];
      if (!hist?.length) return;
      const symReturns = toReturns(hist);
      const b = calcBeta(symReturns, spReturns);
      if (b != null) betas[sym] = parseFloat(b.toFixed(2));
    });

    writeBetaCache(betas);
    return betas;
  } catch (e) {
    console.warn('fetchBetas failed:', e.message);
    return cached || {};
  }
}

// Beta portofoliu ponderat după valoare
export function calcPortfolioBeta(positions, betas) {
  const total = positions.reduce((s, p) => s + (p.curValue || 0), 0);
  if (!total) return null;
  let weighted = 0;
  positions.forEach(p => {
    const b = betas[p.symbol];
    if (b != null) weighted += b * ((p.curValue || 0) / total);
  });
  return parseFloat(weighted.toFixed(2));
}
