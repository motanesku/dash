import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── Config (user sets these once) ─────────────────────────────
export const CONFIG = {
  WORKER_URL: 'https://api.yourdomain.com', // ← change after CF Worker deploy
  SCRIPT_URL: 'PUNE_URL_APPS_SCRIPT_AICI',  // ← change after Apps Script deploy
  ADMIN_PIN: '1234',                          // ← change this!
}

export const USE_CLOUD = CONFIG.SCRIPT_URL !== 'PUNE_URL_APPS_SCRIPT_AICI'
export const USE_WORKER = CONFIG.WORKER_URL !== 'https://api.yourdomain.com'

// ── Main store ────────────────────────────────────────────────
export const useStore = create(
  persist(
    (set, get) => ({
      // ── Auth
      isAdmin: false,
      setAdmin: (v) => set({ isAdmin: v }),

      // ── Transactions
      txs: [],
      setTxs: (txs) => set({ txs }),
      addTx: (tx) => set(s => ({ txs: [...s.txs, tx] })),
      updateTx: (id, tx) => set(s => ({ txs: s.txs.map(t => t.id === id ? tx : t) })),
      deleteTx: (id) => set(s => ({ txs: s.txs.filter(t => t.id !== id) })),
      addTxsBulk: (newTxs) => set(s => ({ txs: [...s.txs, ...newTxs] })),

      // ── Prices
      prices: {},
      setPrices: (prices) => set(s => ({ prices: { ...s.prices, ...prices } })),
      setPrice: (sym, data) => set(s => ({ prices: { ...s.prices, [sym]: data } })),

      // ── Market data
      marketData: {},
      setMarketData: (d) => set({ marketData: d }),
      fearGreed: null,
      setFearGreed: (v) => set({ fearGreed: v }),
      usdRon: null,
      setUsdRon: (v) => set({ usdRon: v }),

      // ── Price history cache
      priceHistory: {}, // { symbol: [{time, open, high, low, close}] }
      setPriceHistory: (sym, data) => set(s => ({ priceHistory: { ...s.priceHistory, [sym]: data } })),

      // ── Brokers (dynamic)
      brokers: ['XTB', 'IBKR'],
      addBroker: (name) => set(s => ({ brokers: [...s.brokers, name.toUpperCase()] })),
      removeBroker: (name) => set(s => ({ brokers: s.brokers.filter(b => b !== name) })),

      // ── Alerts
      alerts: [], // { id, symbol, condition: 'above'|'below', price, active, triggered }
      addAlert: (alert) => set(s => ({ alerts: [...s.alerts, alert] })),
      removeAlert: (id) => set(s => ({ alerts: s.alerts.filter(a => a.id !== id) })),
      triggerAlert: (id) => set(s => ({ alerts: s.alerts.map(a => a.id === id ? { ...a, triggered: true } : a) })),

      // ── Club
      club: {
        name: 'Investment Club',
        investors: [],
        contributions: [],
      },
      setClub: (club) => set({ club }),
      updateClub: (fn) => set(s => ({ club: fn(s.club) })),

      // ── UI state (not persisted)
      tab: 'dashboard',
      setTab: (tab) => set({ tab }),
      brokerTab: null,
      setBrokerTab: (b) => set({ brokerTab: b }),
      selectedSymbol: null,
      setSelectedSymbol: (s) => set({ selectedSymbol: s }),
    }),
    {
      name: 'ptf-store-v2',
      partialize: (s) => ({
        txs: s.txs,
        brokers: s.brokers,
        club: s.club,
        alerts: s.alerts,
        // don't persist prices/market data
      }),
    }
  )
)

// ── Portfolio calculations ────────────────────────────────────
export function calcPortfolio(txs, prices) {
  const posMap = {}

  txs.forEach(tx => {
    if (tx.type === 'DEPOSIT') return
    const key = `${tx.broker}:${tx.symbol}`
    if (!posMap[key]) posMap[key] = { symbol: tx.symbol, broker: tx.broker, shares: 0, costBasis: 0, realizedPnl: 0 }
    const p = posMap[key]
    if (tx.type === 'BUY') {
      p.costBasis += tx.shares * tx.price
      p.shares += tx.shares
    } else if (tx.type === 'SELL') {
      const avgCost = p.shares > 0 ? p.costBasis / p.shares : 0
      p.realizedPnl += tx.shares * (tx.price - avgCost)
      p.costBasis -= tx.shares * avgCost
      p.shares -= tx.shares
    }
  })

  const positions = Object.values(posMap)
    .filter(p => p.shares > 0.0001)
    .map(p => {
      const priceData = prices[p.symbol]
      const curPrice = priceData?.price || null
      const avgPrice = p.shares > 0 ? p.costBasis / p.shares : 0
      const curValue = curPrice ? curPrice * p.shares : null
      const unrealizedPnl = curValue != null ? curValue - p.costBasis : null
      const unrealizedPct = p.costBasis > 0 && unrealizedPnl != null ? (unrealizedPnl / p.costBasis) * 100 : null
      const realizedPct = p.costBasis > 0 ? (p.realizedPnl / p.costBasis) * 100 : null
      const dayChange = priceData?.price && priceData?.prev
        ? ((priceData.price - priceData.prev) / priceData.prev) * 100
        : null
      return {
        ...p,
        avgPrice,
        curPrice,
        curValue,
        unrealizedPnl,
        unrealizedPct,
        realizedPct,
        dayChange,
        currency: priceData?.currency || 'USD',
        name: priceData?.name || p.symbol,
        marketState: priceData?.marketState,
      }
    })
    .sort((a, b) => (b.curValue || 0) - (a.curValue || 0))

  // Cash by broker
  const cashByBroker = {}
  txs.forEach(tx => {
    if (!cashByBroker[tx.broker]) cashByBroker[tx.broker] = 0
    if (tx.type === 'DEPOSIT') cashByBroker[tx.broker] += tx.price
    else if (tx.type === 'BUY') cashByBroker[tx.broker] -= tx.shares * tx.price
    else if (tx.type === 'SELL') cashByBroker[tx.broker] += tx.shares * tx.price
  })

  return { positions, cashByBroker }
}
