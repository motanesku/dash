// ── Alerts storage (localStorage per device) ─────────────────
// Format: { [symbol]: { targetPrice, stopLoss, dayChangePct, vixPrag } }
// Cheie unificată — același localStorage folosit de Positions.jsx și AlertModal
const ALERTS_KEY = 'ptf_v1_alerts'

export function loadAlerts() {
  try { return JSON.parse(localStorage.getItem(ALERTS_KEY)) || {} } catch { return {} }
}

export function saveAlerts(alerts) {
  try { localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts)) } catch {}
}

export function getAlertForSym(sym) {
  const all = loadAlerts()
  return all[sym] || { targetPrice: '', tp1: '', tp2: '', stopLoss: '', dayChangePct: '', vixPrag: '' }
}

export function setAlertForSym(sym, data) {
  const all = loadAlerts()
  all[sym] = data
  saveAlerts(all)
}

// ── Verifică și trimite notificări locale (când app-ul e deschis) ──
export function checkAndNotify(prices, marketData, alerts) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (!navigator.serviceWorker?.controller) return

  const vixPrice = marketData?.['^VIX']?.price ?? null

  Object.entries(alerts).forEach(([sym, cfg]) => {
    const price = prices[sym]?.price
    const dayChange = prices[sym]?.prev && prices[sym]?.price
      ? ((prices[sym].price - prices[sym].prev) / prices[sym].prev) * 100
      : null

    // Target atins
    if (cfg.targetPrice && price != null && price >= parseFloat(cfg.targetPrice)) {
      notify(`🎯 Target atins: ${sym}`, `${sym} = ${price.toFixed(2)} ≥ target ${cfg.targetPrice}`, `target-${sym}`)
    }
    // TP1 atins
    if (cfg.tp1 && price != null && price >= parseFloat(cfg.tp1)) {
      notify(`🎯 TP1 atins: ${sym}`, `${sym} = ${price.toFixed(2)} ≥ TP1 ${cfg.tp1}`, `tp1-${sym}`)
    }
    // TP2 atins
    if (cfg.tp2 && price != null && price >= parseFloat(cfg.tp2)) {
      notify(`🎯 TP2 atins: ${sym}`, `${sym} = ${price.toFixed(2)} ≥ TP2 ${cfg.tp2}`, `tp2-${sym}`)
    }
    // Stop Loss atins
    if (cfg.stopLoss && price != null && price <= parseFloat(cfg.stopLoss)) {
      notify(`🛑 Stop Loss: ${sym}`, `${sym} = ${price.toFixed(2)} ≤ stop ${cfg.stopLoss}`, `stop-${sym}`)
    }
    // Apropierea de SL (în interval de 5%)
    if (cfg.stopLoss && price != null) {
      const sl = parseFloat(cfg.stopLoss)
      if (!isNaN(sl) && price > sl) {
        const distPct = ((price - sl) / sl) * 100
        if (distPct <= 5) {
          notify(`⚠️ Aproape de SL: ${sym}`, `${sym} = ${price.toFixed(2)} · SL ${sl} (dist: ${distPct.toFixed(1)}%)`, `sl-prox-${sym}`)
        }
      }
    }
    // Apropierea de TP1 (în interval de 3%)
    if (cfg.tp1 && price != null) {
      const tp1 = parseFloat(cfg.tp1)
      if (!isNaN(tp1) && price < tp1) {
        const distPct = ((tp1 - price) / tp1) * 100
        if (distPct <= 3) {
          notify(`🔔 Aproape de TP1: ${sym}`, `${sym} = ${price.toFixed(2)} · TP1 ${tp1} (dist: ${distPct.toFixed(1)}%)`, `tp1-prox-${sym}`)
        }
      }
    }
    // Apropierea de TP2 (în interval de 3%)
    if (cfg.tp2 && price != null) {
      const tp2 = parseFloat(cfg.tp2)
      if (!isNaN(tp2) && price < tp2) {
        const distPct = ((tp2 - price) / tp2) * 100
        if (distPct <= 3) {
          notify(`🔔 Aproape de TP2: ${sym}`, `${sym} = ${price.toFixed(2)} · TP2 ${tp2} (dist: ${distPct.toFixed(1)}%)`, `tp2-prox-${sym}`)
        }
      }
    }
    // Variație zilnică mare
    if (cfg.dayChangePct && dayChange != null) {
      const prag = parseFloat(cfg.dayChangePct)
      if (Math.abs(dayChange) >= prag) {
        const dir = dayChange >= 0 ? '📈' : '📉'
        notify(`${dir} Variație mare: ${sym}`, `${sym} variație ${dayChange >= 0 ? '+' : ''}${dayChange.toFixed(2)}% (prag: ±${prag}%)`, `daychange-${sym}`)
      }
    }
  })

  const vixPrags = Object.values(alerts).map(a => parseFloat(a.vixPrag)).filter(v => !isNaN(v))
  if (vixPrags.length && vixPrice != null) {
    vixPrags.forEach(prag => {
      if (vixPrice >= prag) {
        notify(`⚡ VIX Alert`, `VIX = ${vixPrice.toFixed(2)} ≥ prag ${prag}`, `vix-${prag}`)
      }
    })
  }
}

function notify(title, body, tag) {
  navigator.serviceWorker.ready.then(reg => {
    reg.showNotification(title, {
      body,
      icon: '/dash/icon-192.png',
      badge: '/dash/icon-192.png',
      tag,
      renotify: true,
    })
  })
}
