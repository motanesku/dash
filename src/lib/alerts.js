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
  return all[sym] || { targetPrice: '', stopLoss: '', dayChangePct: '', vixPrag: '' }
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

    if (cfg.targetPrice && price != null && price >= parseFloat(cfg.targetPrice)) {
      notify(`🎯 Target atins: ${sym}`, `${sym} = ${price.toFixed(2)} ≥ target ${cfg.targetPrice}`, `target-${sym}`)
    }
    if (cfg.stopLoss && price != null && price <= parseFloat(cfg.stopLoss)) {
      notify(`🛑 Stop Loss: ${sym}`, `${sym} = ${price.toFixed(2)} ≤ stop ${cfg.stopLoss}`, `stop-${sym}`)
    }
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
