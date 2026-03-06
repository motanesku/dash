import { create } from 'zustand';
import { fetchPrices, fetchFearGreed, MARKET_SYMBOLS } from './prices.js';
import { calcPortfolio } from './portfolio.js';
import { loadTransactions, saveTransactionsLocal, addTransaction, updateTransaction, deleteTransaction, bulkAddTransactions, loadBrokers, saveBrokers, loadAlerts, saveAlerts, loadClub, saveClub } from './sheets.js';

const useStore = create((set, get) => ({
  // ── Auth ────────────────────────────────────────────────
  isAdmin: false,
  setAdmin: (v) => set({ isAdmin: v }),

  // ── Navigation ─────────────────────────────────────────
  tab: 'dashboard',
  setTab: (tab) => set({ tab }),
  brokerTab: null, // null = all (TOTAL)

  // ── Brokers ─────────────────────────────────────────────
  brokers: loadBrokers(),
  addBroker: (name) => {
    const n = name.trim().toUpperCase();
    if (!n) return;
    const brokers = [...get().brokers];
    if (brokers.includes(n)) return;
    const next = [...brokers, n];
    saveBrokers(next);
    set({ brokers: next });
  },
  deleteBroker: (name) => {
    const next = get().brokers.filter(b => b !== name);
    saveBrokers(next);
    set({ brokers: next, brokerTab: get().brokerTab === name ? null : get().brokerTab });
  },
  setBrokerTab: (b) => set({ brokerTab: b }),

  // ── Transactions ────────────────────────────────────────
  txs: [],
  cloudLoading: false,
  cloudErr: null,

  loadTxs: async () => {
    set({ cloudLoading: true, cloudErr: null });
    try {
      const txs = await loadTransactions();
      set({ txs, cloudLoading: false });
      saveTransactionsLocal(txs);
    } catch (e) {
      set({ cloudLoading: false, cloudErr: e.message });
    }
  },

  addTx: async (tx) => {
    const newTx = { ...tx, id: Date.now() };
    set(s => ({ txs: [...s.txs, newTx] }));
    saveTransactionsLocal(get().txs);
    await addTransaction(newTx);
  },

  updateTx: async (tx) => {
    set(s => ({ txs: s.txs.map(t => t.id === tx.id ? tx : t) }));
    saveTransactionsLocal(get().txs);
    await updateTransaction(tx);
  },

  deleteTx: async (id) => {
    set(s => ({ txs: s.txs.filter(t => t.id !== id) }));
    saveTransactionsLocal(get().txs);
    await deleteTransaction(id);
  },

  bulkAddTxs: async (txs) => {
    const newTxs = txs.map(t => ({ ...t, id: Date.now() + Math.random() }));
    set(s => ({ txs: [...s.txs, ...newTxs] }));
    saveTransactionsLocal(get().txs);
    await bulkAddTransactions(newTxs);
  },

  // ── Prices ──────────────────────────────────────────────
  prices: {},
  marketData: {},
  fearGreed: null,
  pricesLoading: false,
  pricesUpdated: null,

  fetchAllPrices: async () => {
    const { txs } = get();
    const portfolioSyms = [...new Set(txs.filter(t => t.type !== 'DEPOSIT').map(t => t.symbol))];
    const marketSyms = MARKET_SYMBOLS.map(s => s.sym);
    const allSyms = [...new Set([...portfolioSyms, ...marketSyms])];
    if (!allSyms.length) return;

    set({ pricesLoading: true });
    try {
      const allPrices = await fetchPrices(allSyms);
      const prices = {};
      const marketData = {};
      portfolioSyms.forEach(s => { if (allPrices[s]) prices[s] = allPrices[s]; });
      marketSyms.forEach(s => { if (allPrices[s]) marketData[s] = allPrices[s]; });
      set({ prices, marketData, pricesLoading: false, pricesUpdated: new Date() });
    } catch (e) {
      set({ pricesLoading: false });
    }
    // Fear & greed separately
    fetchFearGreed().then(fg => { if (fg) set({ fearGreed: fg }); });
  },

  // ── Portfolio computed (derived) ─────────────────────────
  getPortfolio: () => {
    const { txs, prices } = get();
    return calcPortfolio(txs, prices);
  },

  // ── Club ────────────────────────────────────────────────
  club: {
    name: 'Investment Club',
    totalValue: 0,
    investors: [],
    contributions: [],
  },
  clubLoaded: false,

  loadClub: async () => {
    const club = await loadClub();
    if (club) set({ club, clubLoaded: true });
    else set({ clubLoaded: true });
  },

  updateClub: async (club) => {
    set({ club });
    await saveClub(club);
  },

  // ── Price Alerts ─────────────────────────────────────────
  alerts: loadAlerts(),
  addAlert: (alert) => {
    const next = [...get().alerts, { ...alert, id: Date.now(), triggered: false }];
    set({ alerts: next });
    saveAlerts(next);
  },
  deleteAlert: (id) => {
    const next = get().alerts.filter(a => a.id !== id);
    set({ alerts: next });
    saveAlerts(next);
  },
  checkAlerts: (prices) => {
    const alerts = get().alerts;
    let changed = false;
    const next = alerts.map(a => {
      if (a.triggered) return a;
      const p = prices[a.symbol]?.price;
      if (!p) return a;
      const hit = a.direction === 'above' ? p >= a.target : p <= a.target;
      if (hit) {
        changed = true;
        // Browser notification
        if (Notification.permission === 'granted') {
          new Notification(`📈 Alert: ${a.symbol}`, {
            body: `Prețul a ajuns la ${p.toFixed(2)} (target: ${a.target})`,
          });
        }
        return { ...a, triggered: true, triggeredAt: new Date().toISOString() };
      }
      return a;
    });
    if (changed) { set({ alerts: next }); saveAlerts(next); }
  },
}));

export default useStore;
