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

// Transformă istoric în returnuri zilnice
function toReturns(points) {
  if (!points?.length) return [];
  return points.slice(1).map((p, i) => ({
    date: p.date,
    ret: points[i].close > 0 ? (p.close - points[i].close) / points[i].close : 0,
  }));
}

// Calculează beta și alpha dintr-o regresie liniară
// Returnuri_simbol = alpha + beta × Returnuri_SP500
export function calcBetaAlpha(symReturns, spReturns) {
  if (!symReturns?.length || !spReturns?.length) return null;

  const spMap = {};
  spReturns.forEach(p => { spMap[p.date] = p.ret; });

  const pairs = symReturns
    .filter(p => spMap[p.date] != null)
    .map(p => ({ sym: p.ret, sp: spMap[p.date] }));

  if (pairs.length < 10) return null;

  const n = pairs.length;
  const meanSym = pairs.reduce((s, p) => s + p.sym, 0) / n;
  const meanSp  = pairs.reduce((s, p) => s + p.sp,  0) / n;

  let cov = 0, varSp = 0;
  pairs.forEach(p => {
    cov   += (p.sym - meanSym) * (p.sp - meanSp);
    varSp += (p.sp  - meanSp) ** 2;
  });

  if (varSp === 0) return null;

  const beta  = cov / varSp;
  const alpha = meanSym - beta * meanSp; // intersecția — return zilnic mediu ajustat
  // Anualizăm alpha: ~252 zile trading/an
  const alphaAnnualized = alpha * 252;

  return {
    beta:  parseFloat(beta.toFixed(2)),
    alpha: parseFloat((alphaAnnualized * 100).toFixed(2)), // în procente anuale
  };
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

// Etichetă alpha
export function alphaLabel(alpha) {
  if (alpha == null) return null;
  if (alpha >  15) return { text: 'Alpha ridicat',  color: '#4d9fff' };
  if (alpha >   5) return { text: 'Alpha pozitiv',  color: '#60a5fa' };
  if (alpha >  -5) return { text: 'Neutru',          color: 'var(--text3)' };
  if (alpha > -15) return { text: 'Alpha negativ',  color: '#a78bfa' };
  return             { text: 'Alpha slab',           color: '#c084fc' };
}

// Fetch beta + alpha pentru 3L și 1A
export async function fetchBetas(symbols) {
  const cached = readBetaCache();
  if (cached) {
    const missing = symbols.filter(s =>
      cached[s]?.beta3m == null || cached[s]?.beta1y == null
    );
    if (!missing.length) return cached;
  }

  try {
    const [sp3m, sp1y, sym3m, sym1y] = await Promise.all([
      fetchHistory('^GSPC', '3mo'),
      fetchHistory('^GSPC', '1y'),
      fetchHistoryMulti(symbols, '3mo'),
      fetchHistoryMulti(symbols, '1y'),
    ]);

    const spRet3m = toReturns(sp3m);
    const spRet1y = toReturns(sp1y);
    const result  = { ...(cached || {}) };

    symbols.forEach(sym => {
      const r3m = toReturns(sym3m[sym]);
      const r1y = toReturns(sym1y[sym]);
      const calc3m = calcBetaAlpha(r3m, spRet3m);
      const calc1y = calcBetaAlpha(r1y, spRet1y);
      result[sym] = {
        beta3m:  calc3m?.beta  ?? null,
        alpha3m: calc3m?.alpha ?? null,
        beta1y:  calc1y?.beta  ?? null,
        alpha1y: calc1y?.alpha ?? null,
      };
    });

    writeBetaCache(result);
    return result;
  } catch (e) {
    console.warn('fetchBetas failed:', e.message);
    return cached || {};
  }
}

// Beta portofoliu ponderat după valoare (folosește beta 1y)
export function calcPortfolioBeta(positions, betas) {
  const total = positions.reduce((s, p) => s + (p.curValue || 0), 0);
  if (!total) return null;
  let weighted = 0;
  positions.forEach(p => {
    const b = betas[p.symbol]?.beta1y ?? betas[p.symbol]?.beta3m ?? null;
    if (b != null) weighted += b * ((p.curValue || 0) / total);
  });
  return parseFloat(weighted.toFixed(2));
}

