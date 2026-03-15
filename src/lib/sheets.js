import { SHEETS_URL, USE_CLOUD } from '../config.js';

const LOCAL_KEY   = 'ptf_v6_txs';
const BROKERS_KEY = 'ptf_v6_brokers';
const ALERTS_KEY  = 'ptf_v6_alerts';

// ── Auth header — token din sessionStorage (niciodată în bundle) ──
function getAuthHeaders() {
  const token = sessionStorage.getItem('ptf_session') || ''
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  }
}

// ── GET helper ─────────────────────────────────────────────
async function sheetsGet(action) {
  return fetch(`${SHEETS_URL}?action=${action}`, {
    headers: getAuthHeaders(),
  })
}

// ── POST helper ────────────────────────────────────────────
async function sheetsPost(body) {
  return fetch(SHEETS_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  })
}

// ── Transactions ───────────────────────────────────────────
export async function loadTransactions() {
  if (USE_CLOUD) {
    try {
      const r = await sheetsGet('getTxs')
      const j = await r.json()
      if (j.ok && j.data) return j.data.map(row => ({
        ...row,
        id:     Number(row.id) || row.id,
        shares: Number(row.shares),
        price:  Number(row.price),
        sym:    row.symbol || row.sym || '',
        symbol: row.symbol || row.sym || '',
      }))
    } catch (e) { console.warn('Cloud load failed:', e.message) }
  }
  try {
    const s = localStorage.getItem(LOCAL_KEY)
    return s ? JSON.parse(s) : []
  } catch { return [] }
}

export function saveTransactionsLocal(txs) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(txs)) } catch {}
}

async function saveAllTxs(txs) {
  if (!USE_CLOUD) return
  try { await sheetsPost({ action: 'saveTxs', data: txs }) }
  catch (e) { console.warn('Cloud saveTxs failed:', e.message) }
}

export async function addTransaction(tx, allTxs) {
  if (USE_CLOUD && allTxs) await saveAllTxs(allTxs)
}
export async function updateTransaction(tx, allTxs) {
  if (USE_CLOUD && allTxs) await saveAllTxs(allTxs)
}
export async function deleteTransaction(id, allTxs) {
  if (USE_CLOUD && allTxs) await saveAllTxs(allTxs)
}
export async function bulkAddTransactions(txs, allTxs) {
  if (USE_CLOUD && allTxs) await saveAllTxs(allTxs)
  else if (USE_CLOUD && txs) await saveAllTxs(txs)
}
export async function syncTransactionsToCloud(txs) {
  await saveAllTxs(txs)
}

// ── Club data ──────────────────────────────────────────────
export async function loadClub() {
  if (USE_CLOUD) {
    try {
      const r = await sheetsGet('getClub')
      const j = await r.json()
      if (j.ok && j.data) return j.data
    } catch {}
  }
  try {
    const s = localStorage.getItem('ptf_v6_club')
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export async function saveClub(club) {
  try { localStorage.setItem('ptf_v6_club', JSON.stringify(club)) } catch {}
  if (USE_CLOUD) {
    try { await sheetsPost({ action: 'saveClub', data: club }) } catch {}
  }
}

// ── Brokers ────────────────────────────────────────────────
export function loadBrokers() {
  try {
    const s = localStorage.getItem(BROKERS_KEY)
    return s ? JSON.parse(s) : ['XTB', 'IBKR']
  } catch { return ['XTB', 'IBKR'] }
}

export function saveBrokers(brokers) {
  try { localStorage.setItem(BROKERS_KEY, JSON.stringify(brokers)) } catch {}
}

// ── Price Alerts — localStorage per device ─────────────────
export function loadAlerts() {
  try {
    const s = localStorage.getItem(ALERTS_KEY)
    return s ? JSON.parse(s) : {}
  } catch { return {} }
}

export function saveAlerts(alerts) {
  try { localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts)) } catch {}
}

// Alerts nu se mai sincronizează în cloud — sunt per device/user
export async function syncAlertsToCloud() {}
export async function loadAlertsFromCloud() { return null }

// ── Excel Import ───────────────────────────────────────────
export function parseImportFile(file, cb) {
  import('xlsx').then(({ default: XLSX }) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        let hi = 0
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const r = rows[i].map(c => String(c).toLowerCase())
          if (r.some(c => ['symbol', 'ticker', 'simbol'].includes(c))) { hi = i; break }
        }
        const headers = rows[hi].map(c => String(c).toLowerCase().trim())
        const idx = {
          sym:    ['symbol', 'ticker', 'simbol'].map(k => headers.indexOf(k)).find(i => i >= 0) ?? -1,
          shares: ['shares', 'qty', 'quantity', 'cantitate'].map(k => headers.indexOf(k)).find(i => i >= 0) ?? -1,
          price:  ['price', 'pret', 'pret mediu', 'avg price'].map(k => headers.indexOf(k)).find(i => i >= 0) ?? -1,
          date:   ['date', 'data'].map(k => headers.indexOf(k)).find(i => i >= 0) ?? -1,
          type:   ['type', 'tip', 'action'].map(k => headers.indexOf(k)).find(i => i >= 0) ?? -1,
          broker: ['broker'].map(k => headers.indexOf(k)).find(i => i >= 0) ?? -1,
          notes:  ['notes', 'note', 'observatii'].map(k => headers.indexOf(k)).find(i => i >= 0) ?? -1,
        }
        if (idx.sym < 0 || idx.shares < 0 || idx.price < 0) {
          cb({ ok: false, error: 'Coloane lipsă: symbol, shares, price' }); return
        }
        const out = []
        for (let i = hi + 1; i < rows.length; i++) {
          const r = rows[i]
          if (!r[idx.sym]) continue
          const sym    = String(r[idx.sym]).toUpperCase().trim()
          const shares = parseFloat(r[idx.shares])
          const price  = parseFloat(r[idx.price])
          const rawType = idx.type >= 0 ? String(r[idx.type]).toUpperCase() : 'BUY'
          const type   = rawType.includes('SELL') ? 'SELL' : rawType.includes('DEP') ? 'DEPOSIT' : 'BUY'
          const broker = idx.broker >= 0 ? String(r[idx.broker]).trim() || 'XTB' : 'XTB'
          const notes  = idx.notes >= 0 ? String(r[idx.notes]) : ''
          const errors = []
          if (!sym) errors.push('symbol lipsă')
          if (isNaN(shares) || shares <= 0) errors.push('shares invalid')
          if (isNaN(price)  || price  <= 0) errors.push('price invalid')
          out.push({ sym, shares, price, type, broker, notes, errors, selected: errors.length === 0 })
        }
        cb({ ok: true, rows: out })
      } catch (e) { cb({ ok: false, error: e.message }) }
    }
    reader.readAsBinaryString(file)
  })
}
