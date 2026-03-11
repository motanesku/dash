// ── Notificări Push PWA ───────────────────────────────────────

// Cere permisiune notificări
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  const result = await Notification.requestPermission();
  return result;
}

// Trimite notificare locală (fără server push, funcționează offline)
export function sendLocalNotification(title, body, tag = 'ptf-alert') {
  if (Notification.permission !== 'granted') return;
  navigator.serviceWorker.ready.then(reg => {
    reg.showNotification(title, {
      body,
      icon: '/dash/icon-192.png',
      badge: '/dash/icon-192.png',
      tag,
      renotify: true,
    });
  });
}

// Verifică prețuri față de alerte salvate și trimite notificări
// alerts = [{ sym, targetPrice, stopLoss, currentPrice, prevNotified }]
export function checkPriceAlerts(prices, alerts) {
  if (!alerts?.length) return;
  alerts.forEach(alert => {
    const price = prices[alert.sym]?.price;
    if (!price) return;

    if (alert.targetPrice && price >= alert.targetPrice) {
      sendLocalNotification(
        `🎯 Target atins: ${alert.sym}`,
        `${alert.sym} a ajuns la $${price.toFixed(2)} (target: $${alert.targetPrice})`,
        `target-${alert.sym}`
      );
    }
    if (alert.stopLoss && price <= alert.stopLoss) {
      sendLocalNotification(
        `🛑 Stop Loss: ${alert.sym}`,
        `${alert.sym} a scăzut la $${price.toFixed(2)} (stop: $${alert.stopLoss})`,
        `stop-${alert.sym}`
      );
    }
  });
}
