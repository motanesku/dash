// ── Portfolio calculations ─────────────────────────────────

export function calcPortfolio(txs, prices) {
  // Group buys/sells by symbol+broker
  const map = {};

  txs
    .filter(t => t.type !== 'DEPOSIT')
    .forEach(t => {
      const key = `${t.broker}::${t.symbol}`;
      if (!map[key]) map[key] = { symbol: t.symbol, broker: t.broker, shares: 0, costBasis: 0, realizedPnl: 0, txs: [] };
      const p = map[key];
      if (t.type === 'BUY') {
        p.costBasis += t.shares * t.price;
        p.shares += t.shares;
      } else if (t.type === 'SELL') {
        const avgPrice = p.shares > 0 ? p.costBasis / p.shares : t.price;
        p.realizedPnl += (t.price - avgPrice) * t.shares;
        p.costBasis -= avgPrice * t.shares;
        p.shares -= t.shares;
      }
      p.txs.push(t);
    });

  // Build positions array with current prices
  const positions = Object.values(map)
    .filter(p => p.shares > 0.0001)
    .map(p => {
      const pd = prices[p.symbol];
      const avgPrice = p.shares > 0 ? p.costBasis / p.shares : 0;
      const curPrice = pd?.price ?? null;
      const currency = pd?.currency ?? 'USD';
      const name = pd?.name ?? p.symbol;
      const curValue = curPrice != null ? curPrice * p.shares : null;
      const unrealizedPnl = curValue != null ? curValue - p.costBasis : null;
      const unrealizedPct = p.costBasis > 0 && unrealizedPnl != null ? (unrealizedPnl / p.costBasis) * 100 : null;
      const dayChange = pd?.prev && curPrice ? ((curPrice - pd.prev) / pd.prev) * 100 : null;
      const realizedPct = p.costBasis > 0 ? (p.realizedPnl / p.costBasis) * 100 : 0;
      return {
        ...p, avgPrice, curPrice, currency, name,
        curValue, unrealizedPnl, unrealizedPct,
        dayChange, realizedPct,
        marketState: pd?.marketState ?? 'CLOSED',
      };
    })
    .sort((a, b) => (b.curValue ?? 0) - (a.curValue ?? 0));

  // Cash by broker
  const cashByBroker = {};
  txs.forEach(t => {
    if (!cashByBroker[t.broker]) cashByBroker[t.broker] = 0;
    if (t.type === 'DEPOSIT') cashByBroker[t.broker] += t.price;
    else if (t.type === 'BUY') cashByBroker[t.broker] -= t.shares * t.price;
    else if (t.type === 'SELL') cashByBroker[t.broker] += t.shares * t.price;
  });

  return { positions, cashByBroker };
}

export function aggregatePositions(positions) {
  const totalCostBasis = positions.reduce((s, p) => s + p.costBasis, 0);
  const totalCurValue = positions.reduce((s, p) => s + (p.curValue ?? 0), 0);
  const totalUnrealized = positions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0);
  const totalRealized = positions.reduce((s, p) => s + p.realizedPnl, 0);
  const uPct = totalCostBasis > 0 ? (totalUnrealized / totalCostBasis) * 100 : 0;
  const rPct = totalCostBasis > 0 ? (totalRealized / totalCostBasis) * 100 : 0;
  return { totalCostBasis, totalCurValue, totalUnrealized, totalRealized, uPct, rPct };
}

// ── Formatting ─────────────────────────────────────────────
const VALID_CURRENCIES = new Set(['USD','EUR','RON','GBP','CHF','JPY','CAD','AUD','HUF','CZK','PLN','SEK','NOK','DKK','BTC','ETH']);

export function fmtC(n, currency = 'USD') {
  if (n == null || isNaN(n)) return '—';
  const cur = VALID_CURRENCIES.has(String(currency).toUpperCase()) ? String(currency).toUpperCase() : 'USD';
  try {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency', currency: cur,
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(n);
  } catch { return `${n.toFixed(2)} ${cur}`; }
}

export function fmtPct(n, showSign = true) {
  if (n == null || isNaN(n)) return '—';
  return (showSign && n > 0 ? '+' : '') + n.toFixed(2) + '%';
}

export function fmtN(n, d = 4) {
  if (n == null || isNaN(n)) return '—';
  return n.toFixed(d);
}

export function pnlClass(n) {
  if (n == null || isNaN(n)) return 'muted';
  return n >= 0 ? 'pos' : 'neg';
}

export function excelDate(v) {
  if (!v) return '';
  if (typeof v === 'string' && /\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  if (typeof v === 'string') {
    const m = v.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().split('T')[0];
  }
  if (v instanceof Date) return v.toISOString().split('T')[0];
  return String(v).slice(0, 10);
}
