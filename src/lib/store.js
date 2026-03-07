import { create } from 'zustand';
import { fetchPrices, fetchFearGreed, MARKET_SYMBOLS } from './prices.js';
import { calcPortfolio } from './portfolio.js';
import { loadTransactions, saveTransactionsLocal, addTransaction, updateTransaction, deleteTransaction, bulkAddTransactions, loadBrokers, saveBrokers, loadAlerts, saveAlerts, loadClub, saveClub } from './sheets.js';

const PRICES_CACHE_KEY = 'ptf_v6_prices';
const MARKET_CACHE_KEY = 'ptf_v6_market';
const FEARGREED_CACHE_KEY = 'ptf_v6_feargreed';

function readCache(key) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function writeCache(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// Load cached prices immediately on startup
const cachedPrices = readCache(PRICES_CACHE_KEY) || {};
const cachedMarket = readCache(MARKET_CACHE_KEY) || {};
const cachedFG = readCache(FEARGREED_CACHE_KEY);

const useStore = create((set, get) => ({
  // ── Theme ───────────────────────────────────────────────
  theme: localStorage.getItem('ptf_theme') || 'dark',
  toggleTheme: () => set(s => {
    const next = s.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('ptf_theme', next);
    document.documentElement.setAttribute('data-theme', next === 'light' ? 'light' : '');
    return { theme: next };
  }),

  // ── Auth ────────────────────────────────────────────────
  isAdmin: false,
  setAdmin: (v) => set({ isAdmin: v }),

  // ── Navigation ─────────────────────────────────────────
  tab: 'dashboard',
  setTab: (tab) => set({ tab }),
  brokerTab: null,

  // ── Brokers ─────────────────────────────────────────────
  brokers: loadBrokers(),
  addBroker: (name) => {
    const n = name.trim().toUpperCase();
    if (!n) return;
    const brokers = [...get().brokers];
    if (brokers.includes(n)) return;
    const next = [...brokers, n];
    saveBrokers(next); set({ brokers: next });
  },
  deleteBroker: (name) => {
    const next = get().brokers.filter(b => b !== name);
    saveBrokers(next);
    set({ brokers: next, brokerTab: get().brokerTab === name ? null : get().brokerTab });
  },
  setBrokerTab: (b) => set({ brokerTab: b }),

  // ── Transactions ────────────────────────────────────────
  // Start with cached txs immediately — page renders instantly
  txs: readCache('ptf_v6_local') || [],
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

  // ── Prices — start with cache, update in background ─────
  prices: cachedPrices,
  marketData: cachedMarket,
  fearGreed: cachedFG,
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
      // Fetch prices + fear&greed in PARALLEL
      const [allPrices] = await Promise.all([
        fetchPrices(allSyms),
        fetchFearGreed().then(fg => {
          if (fg) { set({ fearGreed: fg }); writeCache(FEARGREED_CACHE_KEY, fg); }
        }),
      ]);
      const prices = {};
      const marketData = {};
      portfolioSyms.forEach(s => { if (allPrices[s]) prices[s] = allPrices[s]; });
      marketSyms.forEach(s => { if (allPrices[s]) marketData[s] = allPrices[s]; });
      set({ prices, marketData, pricesLoading: false, pricesUpdated: new Date() });
      // Cache for next visit
      writeCache(PRICES_CACHE_KEY, prices);
      writeCache(MARKET_CACHE_KEY, marketData);
    } catch (e) {
      set({ pricesLoading: false });
    }
  },

  // ── Portfolio computed ───────────────────────────────────
  getPortfolio: () => {
    const { txs, prices } = get();
    return calcPortfolio(txs, prices);
  },

  // ── Club ────────────────────────────────────────────────
  club: { name: 'Investment Club', totalValue: 0, investors: [], contributions: [] },
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

  // ── Company Info (sector, cap, domain) ─────────────────────
  companyInfo: (() => { try { const s=localStorage.getItem('ptf_v6_compinfo'); return s?JSON.parse(s):{}; } catch{return {};} })(),

  fetchCompanyInfo: async (symbols) => {
    if (!symbols.length) return;
    try {
      const { fetchCompanyInfo } = await import('./prices.js');
      const info = await fetchCompanyInfo(symbols);
      const merged = { ...get().companyInfo, ...info };
      set({ companyInfo: merged });
      try { localStorage.setItem('ptf_v6_compinfo', JSON.stringify(merged)); } catch {}
    } catch {}
  },

  // ── FOX Positions ───────────────────────────────────────────
  // ptf_v6_fox2 = clean key (avoids old contaminated data with BUY/SELL txs)
  foxData: (() => {
    try {
      const s = localStorage.getItem('ptf_v6_fox2');
      if (s) {
        const arr = JSON.parse(s);
        // Filter out any accidentally imported transactions (they have type:BUY/SELL)
        return arr.filter(f => !f.type || f.type === 'FOX');
      }
      return [];
    } catch { return []; }
  })(),

  setFoxData: async (data) => {
    const clean = data.filter(f => !f.type || f.type === 'FOX');
    set({ foxData: clean });
    try { localStorage.setItem('ptf_v6_fox2', JSON.stringify(clean)); } catch {}
    // Sync to Google Sheets (FOX sheet)
    const { SCRIPT_URL, USE_CLOUD } = await import('../config.js');
    if (USE_CLOUD) {
      try {
        await fetch(SCRIPT_URL, { method:'POST', body: JSON.stringify({ action:'saveFox', data: clean }) });
      } catch {}
    }
  },

  loadFoxData: async () => {
    const { SCRIPT_URL, USE_CLOUD } = await import('../config.js');
    if (USE_CLOUD) {
      try {
        const r = await fetch(`${SCRIPT_URL}?action=getFox`);
        const j = await r.json();
        if (j.ok && Array.isArray(j.data)) {
          const clean = j.data.filter(f => !f.type || f.type === 'FOX');
          set({ foxData: clean });
          try { localStorage.setItem('ptf_v6_fox2', JSON.stringify(clean)); } catch {}
          return;
        }
      } catch {}
    }
    // Already loaded from localStorage on init
  },

  // ── Price Alerts ─────────────────────────────────────────
  alerts: loadAlerts(),
  addAlert: (alert) => {
    const next = [...get().alerts, { ...alert, id: Date.now(), triggered: false }];
    set({ alerts: next }); saveAlerts(next);
  },
  deleteAlert: (id) => {
    const next = get().alerts.filter(a => a.id !== id);
    set({ alerts: next }); saveAlerts(next);
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
