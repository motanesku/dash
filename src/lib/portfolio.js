// ── FIFO Portfolio Engine ──────────────────────────────────

export function calcPortfolio(txs, prices) {
  const openLots      = {};  // key -> [{shares, price, date}]
  const realizedTrades = {}; // key -> [{shares, buyPrice, sellPrice, buyDate, sellDate, profit, roi}]
  const realizedByKey = {};

  const sorted = [...txs]
    .filter(t => t.type !== 'DEPOSIT')
    .sort((a,b) => new Date(a.date) - new Date(b.date));

  sorted.forEach(t => {
    const key = `${t.broker}::${t.symbol}`;
    if (!openLots[key])       openLots[key]       = [];
    if (!realizedTrades[key]) realizedTrades[key] = [];
    if (!realizedByKey[key])  realizedByKey[key]  = 0;

    if (t.type === 'BUY') {
      openLots[key].push({ shares: t.shares, price: t.price, date: t.date });
    } else if (t.type === 'SELL') {
      let remaining = t.shares;
      while (remaining > 0.00001 && openLots[key].length > 0) {
        const lot    = openLots[key][0];
        const filled = Math.min(lot.shares, remaining);
        const profit = (t.price - lot.price) * filled;
        realizedByKey[key] += profit;
        realizedTrades[key].push({
          shares: filled,
          buyPrice: lot.price, sellPrice: t.price,
          buyDate: lot.date,   sellDate: t.date,
          profit,
          roi: lot.price > 0 ? ((t.price - lot.price) / lot.price) * 100 : 0,
        });
        lot.shares -= filled;
        remaining  -= filled;
        if (lot.shares < 0.00001) openLots[key].shift();
      }
    }
  });

  // ── Open positions (still have lots) ──
  const positions = Object.entries(openLots)
    .filter(([, lots]) => lots.reduce((s,l) => s+l.shares, 0) > 0.00001)
    .map(([key, lots]) => {
      const [broker, symbol] = key.split('::');
      const shares     = lots.reduce((s,l) => s+l.shares, 0);
      const costBasis  = lots.reduce((s,l) => s+l.shares*l.price, 0);
      const realizedPnl = realizedByKey[key] || 0;
      const pd         = prices[symbol];
      const avgPrice   = shares > 0 ? costBasis / shares : 0;
      const curPrice   = pd?.price   ?? null;
      const currency   = pd?.currency ?? 'USD';
      const name       = pd?.name     ?? symbol;
      const curValue   = curPrice != null ? curPrice * shares : null;
      const unrealizedPnl  = curValue != null ? curValue - costBasis : null;
      const unrealizedPct  = costBasis > 0 && unrealizedPnl != null ? (unrealizedPnl/costBasis)*100 : null;
      const dayChange  = pd?.prev && curPrice ? ((curPrice-pd.prev)/pd.prev)*100 : null;
      return {
        symbol, broker, shares, costBasis, realizedPnl, lots,
        avgPrice, curPrice, currency, name,
        curValue, unrealizedPnl, unrealizedPct, dayChange,
        marketState: pd?.marketState ?? 'CLOSED',
      };
    })
    .sort((a,b) => (b.curValue ?? 0) - (a.curValue ?? 0));

  // ── Closed positions (aggregated per broker::symbol, only if trades exist) ──
  // Include even if symbol still has open lots (partial sells)
  const closedPositions = Object.entries(realizedTrades)
    .filter(([, trades]) => trades.length > 0)
    .map(([key, trades]) => {
      const [broker, symbol] = key.split('::');
      const nameTx = sorted.find(t => t.symbol === symbol && t.broker === broker);
      const name = nameTx?.name || prices[symbol]?.name || '';
      const totalProfit  = trades.reduce((s,t) => s+t.profit, 0);
      const totalCost    = trades.reduce((s,t) => s+t.buyPrice*t.shares, 0);
      const totalShares  = trades.reduce((s,t) => s+t.shares, 0);
      const totalRevenue = trades.reduce((s,t) => s+t.sellPrice*t.shares, 0);
      const avgBuyPrice  = totalShares > 0 ? totalCost / totalShares : 0;
      const avgSellPrice = totalShares > 0 ? totalRevenue / totalShares : 0;
      return {
        symbol, broker, trades, totalProfit, totalCost, totalShares,
        totalRevenue, avgBuyPrice, avgSellPrice,
        roi:      totalCost > 0 ? (totalProfit/totalCost)*100 : 0,
        lastDate: trades[trades.length-1]?.sellDate,
        name,
      };
    })
    .sort((a,b) => b.totalProfit - a.totalProfit);

  // ── Cash by broker ──
  const cashByBroker = {};
  txs.forEach(t => {
    if (!cashByBroker[t.broker]) cashByBroker[t.broker] = 0;
    if      (t.type === 'DEPOSIT') cashByBroker[t.broker] += t.price;
    else if (t.type === 'BUY')     cashByBroker[t.broker] -= t.shares * t.price;
    else if (t.type === 'SELL')    cashByBroker[t.broker] += t.shares * t.price;
  });

  return { positions, closedPositions, cashByBroker };
}

export function aggregatePositions(positions, closedPositions = []) {
  const totalCostBasis  = positions.reduce((s,p) => s+p.costBasis, 0);
  const totalCurValue   = positions.reduce((s,p) => s+(p.curValue ?? 0), 0);
  const totalUnrealized = positions.reduce((s,p) => s+(p.unrealizedPnl ?? 0), 0);
  // Realized = doar din tabelul pozitiilor inchise (ambii brokeri)
  const totalRealized     = closedPositions.reduce((s,p) => s+p.totalProfit, 0);
  const totalRealizedCost = closedPositions.reduce((s,p) => s+p.totalCost, 0);
  const uPct = totalCostBasis > 0 ? (totalUnrealized/totalCostBasis)*100 : 0;
  const rPct = totalRealizedCost > 0 ? (totalRealized/totalRealizedCost)*100 : 0;
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

export function fmtDate(d) {
  if (!d) return '—';
  try {
    // Handle ISO timestamp like "2026-01-20T22:00:00.000Z"
    const s = String(d).slice(0,10);
    const [y,m,day] = s.split('-');
    if (!y||!m||!day) return String(d).slice(0,10);
    return `${day.padStart(2,'0')}.${m.padStart(2,'0')}.${y}`;
  } catch { return String(d).slice(0,10); }
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
