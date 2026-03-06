// ── FIFO Portfolio Engine ──────────────────────────────────

export function calcPortfolio(txs, prices) {
  // Per broker+symbol: FIFO lots
  const openLots = {};   // key -> [{shares, price, date}]
  const closedPos = {};  // key -> [{symbol, broker, shares, buyPrice, sellPrice, buyDate, sellDate, profit, roi}]
  const realizedByKey = {};

  const sorted = [...txs].filter(t => t.type !== 'DEPOSIT').sort((a,b) => new Date(a.date)-new Date(b.date));

  sorted.forEach(t => {
    const key = `${t.broker}::${t.symbol}`;
    if (!openLots[key]) openLots[key] = [];
    if (!closedPos[key]) closedPos[key] = [];
    if (!realizedByKey[key]) realizedByKey[key] = 0;

    if (t.type === 'BUY') {
      openLots[key].push({ shares: t.shares, price: t.price, date: t.date });
    } else if (t.type === 'SELL') {
      let remaining = t.shares;
      while (remaining > 0.00001 && openLots[key].length > 0) {
        const lot = openLots[key][0];
        const filled = Math.min(lot.shares, remaining);
        const profit = (t.price - lot.price) * filled;
        realizedByKey[key] += profit;
        closedPos[key].push({
          symbol: t.symbol, broker: t.broker,
          shares: filled,
          buyPrice: lot.price, sellPrice: t.price,
          buyDate: lot.date, sellDate: t.date,
          profit, roi: lot.price > 0 ? ((t.price - lot.price) / lot.price) * 100 : 0,
        });
        lot.shares -= filled;
        remaining -= filled;
        if (lot.shares < 0.00001) openLots[key].shift();
      }
    }
  });

  // Build open positions
  const openMap = {};
  Object.entries(openLots).forEach(([key, lots]) => {
    const totalShares = lots.reduce((s,l) => s + l.shares, 0);
    if (totalShares < 0.00001) return;
    const totalCost = lots.reduce((s,l) => s + l.shares * l.price, 0);
    const [broker, symbol] = key.split('::');
    openMap[key] = { symbol, broker, shares: totalShares, costBasis: totalCost, realizedPnl: realizedByKey[key] || 0, lots };
  });

  const positions = Object.values(openMap).map(p => {
    const pd = prices[p.symbol];
    const avgPrice = p.shares > 0 ? p.costBasis / p.shares : 0;
    const curPrice = pd?.price ?? null;
    const currency = pd?.currency ?? 'USD';
    const name = pd?.name ?? p.symbol;
    const curValue = curPrice != null ? curPrice * p.shares : null;
    const unrealizedPnl = curValue != null ? curValue - p.costBasis : null;
    const unrealizedPct = p.costBasis > 0 && unrealizedPnl != null ? (unrealizedPnl / p.costBasis) * 100 : null;
    const dayChange = pd?.prev && curPrice ? ((curPrice - pd.prev) / pd.prev) * 100 : null;
    return {
      ...p, avgPrice, curPrice, currency, name,
      curValue, unrealizedPnl, unrealizedPct, dayChange,
      marketState: pd?.marketState ?? 'CLOSED',
    };
  }).sort((a,b) => (b.curValue ?? 0) - (a.curValue ?? 0));

  // Build closed positions (aggregate by symbol+broker)
  const closedAgg = {};
  Object.values(closedPos).forEach(trades => {
    trades.forEach(t => {
      const key = `${t.broker}::${t.symbol}`;
      if (!closedAgg[key]) closedAgg[key] = { symbol: t.symbol, broker: t.broker, trades: [], totalProfit: 0, totalCost: 0 };
      closedAgg[key].trades.push(t);
      closedAgg[key].totalProfit += t.profit;
      closedAgg[key].totalCost += t.buyPrice * t.shares;
    });
  });
  // Only include fully closed (no open lots remaining)
  const closedPositions = Object.entries(closedAgg)
    .map(([, v]) => ({
      ...v,
      roi: v.totalCost > 0 ? (v.totalProfit / v.totalCost) * 100 : 0,
      lastDate: v.trades[v.trades.length-1]?.sellDate,
    }))
    .sort((a,b) => b.totalProfit - a.totalProfit);

  // Cash by broker
  const cashByBroker = {};
  txs.forEach(t => {
    if (!cashByBroker[t.broker]) cashByBroker[t.broker] = 0;
    if (t.type === 'DEPOSIT') cashByBroker[t.broker] += t.price;
    else if (t.type === 'BUY') cashByBroker[t.broker] -= t.shares * t.price;
    else if (t.type === 'SELL') cashByBroker[t.broker] += t.shares * t.price;
  });

  return { positions, closedPositions, cashByBroker };
}

export function aggregatePositions(positions) {
  const totalCostBasis   = positions.reduce((s,p) => s + p.costBasis, 0);
  const totalCurValue    = positions.reduce((s,p) => s + (p.curValue ?? 0), 0);
  const totalUnrealized  = positions.reduce((s,p) => s + (p.unrealizedPnl ?? 0), 0);
  const totalRealized    = positions.reduce((s,p) => s + p.realizedPnl, 0);
  const uPct = totalCostBasis > 0 ? (totalUnrealized / totalCostBasis) * 100 : 0;
  const rPct = totalCostBasis > 0 ? (totalRealized   / totalCostBasis) * 100 : 0;
  return { totalCostBasis, totalCurValue, totalUnrealized, totalRealized, uPct, rPct };
}

// ── Formatting ─────────────────────────────────────────────
const VALID_CURRENCIES = new Set(['USD','EUR','RON','GBP','CHF','JPY','CAD','AUD','HUF','CZK','PLN','SEK','NOK','DKK','BTC','ETH']);

export function fmtC(n, currency = 'USD') {
  if (n == null || isNaN(n)) return '—';
  const cur = VALID_CURRENCIES.has(String(currency).toUpperCase()) ? String(currency).toUpperCase() : 'USD';
  try {
    return new Intl.NumberFormat('ro-RO', { style:'currency', currency:cur, minimumFractionDigits:2, maximumFractionDigits:2 }).format(n);
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
  if (typeof v === 'string' && /\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0,10);
  if (typeof v === 'string') {
    const m = v.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }
  if (typeof v === 'number') {
    const d = new Date(Math.round((v-25569)*86400*1000));
    return d.toISOString().split('T')[0];
  }
  if (v instanceof Date) return v.toISOString().split('T')[0];
  return String(v).slice(0,10);
}
