import { create } from 'zustand';
import { fetchPrices, fetchFearGreed, MARKET_SYMBOLS, ALL_MARKET_SYMBOLS } from './prices.js';
import { calcPortfolio } from './portfolio.js';
import { loadTransactions, saveTransactionsLocal, syncTransactionsToCloud, loadBrokers, saveBrokers, loadAlerts, loadClub, saveClub } from './sheets.js';

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
const cachedMarket = (() => {
  const m = readCache(MARKET_CACHE_KEY) || {};
  // Dacă VIX lipsește sau e 0 în cache, bust cache-ul market
  if (!m['^VIX']?.price) {
    try { localStorage.removeItem(MARKET_CACHE_KEY); } catch {}
    return {};
  }
  return m;
})();
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
  txs: readCache('ptf_v6_txs') || readCache('ptf_v6_local') || [],
  cloudLoading: false,
  cloudErr: null,

  loadTxs: async () => {
    // Show localStorage immediately (already set on init)
    set({ cloudLoading: true, cloudErr: null });
    try {
      const txs = await loadTransactions();
      if (txs && txs.length > 0) {
        set({ txs, cloudLoading: false });
        saveTransactionsLocal(txs);
      } else {
        set({ cloudLoading: false });
      }
    } catch (e) {
      set({ cloudLoading: false, cloudErr: e.message });
    }
  },

  addTx: async (tx) => {
    const newTx = { ...tx, id: Date.now() };
    set(s => ({ txs: [...s.txs, newTx] }));
    saveTransactionsLocal(get().txs);
    await syncTransactionsToCloud(get().txs);
  },
  updateTx: async (tx) => {
    set(s => ({ txs: s.txs.map(t => t.id === tx.id ? tx : t) }));
    saveTransactionsLocal(get().txs);
    await syncTransactionsToCloud(get().txs);
  },
  deleteTx: async (id) => {
    set(s => ({ txs: s.txs.filter(t => t.id !== id) }));
    saveTransactionsLocal(get().txs);
    await syncTransactionsToCloud(get().txs);
  },
  bulkAddTxs: async (txs) => {
    const newTxs = txs.map(t => ({ ...t, id: Date.now() + Math.random() }));
    set(s => ({ txs: [...s.txs, ...newTxs] }));
    saveTransactionsLocal(get().txs);
    await syncTransactionsToCloud(get().txs);
  },

  // ── Prices — start with cache, update in background ─────
  prices: cachedPrices,
  marketData: cachedMarket,
  fearGreed: cachedFG,
  pricesLoading: false,
  pricesUpdated: null,

  fetchAllPrices: async () => {
    const { txs, foxData } = get();
    const portfolioSyms = [...new Set(txs.filter(t => t.type !== 'DEPOSIT').map(t => t.symbol || t.sym).filter(Boolean))];
    const foxSyms = [...new Set(foxData.map(f => f.symbol).filter(Boolean))];
    const marketSyms = ALL_MARKET_SYMBOLS.map(s => s.sym);
    const allSyms = [...new Set([...portfolioSyms, ...foxSyms, ...marketSyms])];
    if (!allSyms.length) return;

    set({ pricesLoading: true });
    try {
      // Fetch prices + fear&greed in PARALLEL
      const [allPrices] = await Promise.all([
        fetchPrices(allSyms),
        fetchFearGreed().then(fg => {
          if (fg) {
            set({ fearGreed: fg });
            writeCache(FEARGREED_CACHE_KEY, fg);
            // VIX vine din feargreed (mai sigur decât /api/prices pentru ^VIX)
            if (fg.vix?.price != null) {
              const cur = get().marketData;
              const updated = { ...cur, '^VIX': { ...fg.vix, name: 'VIX', currency: 'USD', marketState: 'REGULAR' } };
              set({ marketData: updated });
              writeCache(MARKET_CACHE_KEY, updated);
            }
          }
        }),
      ]);
      const prices = {};
      const marketData = {};
      portfolioSyms.forEach(s => { if (allPrices[s]) prices[s] = allPrices[s]; });
      foxSyms.forEach(s => { if (allPrices[s]) prices[s] = allPrices[s]; });
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
    // Show cached club immediately from localStorage
    try {
      const cached = localStorage.getItem('ptf_v6_club');
      if (cached) {
        const club = JSON.parse(cached);
        set({ club, clubLoaded: true });
      }
    } catch {}
    // Then update from cloud silently
    try {
      const club = await loadClub();
      if (club) {
        set({ club, clubLoaded: true });
        try { localStorage.setItem('ptf_v6_club', JSON.stringify(club)); } catch {}
      } else {
        set({ clubLoaded: true });
      }
    } catch { set({ clubLoaded: true }); }
  },
  updateClub: async (club) => {
    set({ club });
    await saveClub(club);
  },

  // ── Company Info (sector, cap, domain) ─────────────────────
  companyInfo: (() => { try { const s=localStorage.getItem('ptf_v6_compinfo'); return s?JSON.parse(s):{}; } catch{return {};} })(),

  setCompanyInfo: (symbol, data) => {
    const merged = { ...get().companyInfo, [symbol]: { ...(get().companyInfo[symbol]||{}), ...data } };
    set({ companyInfo: merged });
    try { localStorage.setItem('ptf_v6_compinfo', JSON.stringify(merged)); } catch {}
    // Sync to cloud
    import('../config.js').then(({ SHEETS_URL, USE_CLOUD }) => {
      if (!USE_CLOUD) return;
      fetch(SHEETS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'saveCompanyInfo', data: merged }),
      }).catch(() => {});
    });
  },

  loadCompanyInfo: async () => {
    try {
      const { SHEETS_URL, USE_CLOUD } = await import('../config.js');
      if (!USE_CLOUD) return;
      // Dacă avem deja date în localStorage, nu mai bate Sheets la fiecare load
      // Sync în background doar dacă localStorage e gol
      const existing = get().companyInfo;
      if (Object.keys(existing).length > 0) {
        // Sync silențios în background după 5 secunde
        setTimeout(async () => {
          try {
            const r = await fetch(`${SHEETS_URL}?action=getCompanyInfo`);
            const j = await r.json();
            if (j.ok && j.data && Object.keys(j.data).length) {
              const merged = { ...get().companyInfo, ...j.data };
              set({ companyInfo: merged });
              try { localStorage.setItem('ptf_v6_compinfo', JSON.stringify(merged)); } catch {}
            }
          } catch {}
        }, 5000);
        return;
      }
      // Prima oară — fetch imediat
      const r = await fetch(`${SHEETS_URL}?action=getCompanyInfo`);
      const j = await r.json();
      if (j.ok && j.data && Object.keys(j.data).length) {
        const merged = { ...get().companyInfo, ...j.data };
        set({ companyInfo: merged });
        try { localStorage.setItem('ptf_v6_compinfo', JSON.stringify(merged)); } catch {}
      }
    } catch {}
  },

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
    const { SHEETS_URL, USE_CLOUD } = await import('../config.js');
    if (USE_CLOUD) {
      try {
        await fetch(SHEETS_URL, { method:'POST', body: JSON.stringify({ action:'saveFox', data: clean }) });
      } catch {}
    }
  },

  loadFoxData: async () => {
    const { SHEETS_URL, USE_CLOUD } = await import('../config.js');
    if (USE_CLOUD) {
      try {
        const r = await fetch(`${SHEETS_URL}?action=getFox`);
        const j = await r.json();
        if (j.ok && Array.isArray(j.data) && j.data.length > 0) {
          // Sheets are non-empty — use as source of truth
          const clean = j.data.filter(f => !f.type || f.type === 'FOX' || f.status === 'open' || f.status === 'closed');
          set({ foxData: clean });
          try { localStorage.setItem('ptf_v6_fox2', JSON.stringify(clean)); } catch {}
          return;
        }
        // Sheets empty — keep localStorage data (don't overwrite)
      } catch {}
    }
    // Already loaded from localStorage on init
  },

  // ── Price Alerts ─────────────────────────────────────────
  alerts: loadAlerts(),

  // Per-device notification toggle — nu se sincronizează în cloud
  notificationsEnabled: (() => {
    try { return localStorage.getItem('ptf_v6_notif') !== 'false'; } catch { return true; }
  })(),
  toggleNotifications: () => {
    const next = !useStore.getState().notificationsEnabled;
    try { localStorage.setItem('ptf_v6_notif', String(next)); } catch {}
    set({ notificationsEnabled: next });
  },

  loadAlerts: async () => {
    // Încarcă din cloud (source of truth), fallback la localStorage
    const { loadAlertsFromCloud, saveAlerts: saveLocal } = await import('./sheets.js');
    const cloudAlerts = await loadAlertsFromCloud();
    if (cloudAlerts && cloudAlerts.length > 0) {
      set({ alerts: cloudAlerts });
      saveLocal(cloudAlerts);
    }
    // dacă cloud e gol, rămânem cu ce avem din localStorage (deja setat la init)
  },

  addAlert: async (alert) => {
    const { syncAlertsToCloud, saveAlerts: saveLocal } = await import('./sheets.js');
    const next = [...get().alerts, { ...alert, id: Date.now(), triggered: false, triggeredAt: null }];
    set({ alerts: next });
    saveLocal(next);
    await syncAlertsToCloud(next);
  },
  deleteAlert: async (id) => {
    const { syncAlertsToCloud, saveAlerts: saveLocal } = await import('./sheets.js');
    const next = get().alerts.filter(a => a.id !== id);
    set({ alerts: next });
    saveLocal(next);
    await syncAlertsToCloud(next);
  },
  clearTriggeredAlerts: async () => {
    const { syncAlertsToCloud, saveAlerts: saveLocal } = await import('./sheets.js');
    const next = get().alerts.filter(a => !a.triggered);
    set({ alerts: next });
    saveLocal(next);
    await syncAlertsToCloud(next);
  },
  checkAlerts: async (prices) => {
    const { syncAlertsToCloud, saveAlerts: saveLocal } = await import('./sheets.js');
    const alerts = get().alerts;
    const notifEnabled = get().notificationsEnabled;
    let changed = false;
    const next = alerts.map(a => {
      if (a.triggered) return a;
      const p = prices[a.symbol]?.price;
      if (!p) return a;
      const hit = a.direction === 'above' ? p >= a.target : p <= a.target;
      if (hit) {
        changed = true;
        // Notificare doar dacă device-ul are notificările activate
        if (notifEnabled && Notification.permission === 'granted') {
          new Notification(`📈 Alert: ${a.symbol}`, {
            body: `Prețul a ajuns la ${p.toFixed(2)} (target: ${a.target})`,
          });
        }
        return { ...a, triggered: true, triggeredAt: new Date().toISOString() };
      }
      return a;
    });
    if (changed) {
      set({ alerts: next });
      saveLocal(next);
      await syncAlertsToCloud(next); // sync starea triggered în cloud
    }
  },
}));

export default useStore;
