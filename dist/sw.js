const CACHE_NAME = 'ptf-v2';
const BASE = '/dash';

const PRECACHE = [
  `${BASE}/`,
  `${BASE}/index.html`,
];

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch — network first, fallback cache ────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('yahoo.com') ||
    url.hostname.includes('alternative.me') ||
    url.hostname.includes('cnn.io') ||
    url.hostname.includes('fonts.gstatic.com')
  ) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const clone = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return r;
        })
        .catch(() => caches.match(`${BASE}/index.html`))
    );
    return;
  }

  if (e.request.destination === 'script' || e.request.destination === 'style') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(r => {
          const clone = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return r;
        });
      })
    );
    return;
  }
});

// ── Sync Background — verifică alertele ─────────────────────
// Declanșat de app cu: navigator.serviceWorker.ready.then(r => r.sync.register('check-alerts'))
self.addEventListener('sync', e => {
  if (e.tag === 'check-alerts') {
    e.waitUntil(checkAlerts());
  }
});

// ── Periodic Background Sync (unde e suportat) ──────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-alerts-periodic') {
    e.waitUntil(checkAlerts());
  }
});

// ── Message din app — verifică alertele imediat ──────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'CHECK_ALERTS') {
    checkAlerts();
  }
  if (e.data?.type === 'UPDATE_ALERTS') {
    // App trimite alertele actualizate — le stocăm în SW cache
    storeAlertsInCache(e.data.alerts, e.data.prices, e.data.workerUrl);
  }
});

// ── Stochează alerte + workerUrl în SW pentru acces background ──
async function storeAlertsInCache(alerts, prices, workerUrl) {
  try {
    const cache = await caches.open('ptf-alerts-v1');
    await cache.put('alerts-data', new Response(JSON.stringify({
      alerts, prices, workerUrl, ts: Date.now()
    })));
  } catch {}
}

// ── Verifică alerte și trimite notificări ────────────────────
async function checkAlerts() {
  try {
    const cache = await caches.open('ptf-alerts-v1');
    const stored = await cache.match('alerts-data');
    if (!stored) return;

    const { alerts, workerUrl } = await stored.json();
    if (!alerts || typeof alerts !== 'object') return;

    const symbols = Object.keys(alerts);
    if (!symbols.length) return;

    // Fetch prețuri curente
    const r = await fetch(`${workerUrl}/api/prices?symbols=${encodeURIComponent(symbols.join(','))}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return;
    const { prices } = await r.json();
    if (!prices) return;

    const vixPrice = prices['^VIX']?.price ?? null;

    for (const [sym, cfg] of Object.entries(alerts)) {
      const price = prices[sym]?.price;
      const prev = prices[sym]?.prev;
      const dayChange = (price != null && prev != null && prev > 0)
        ? ((price - prev) / prev) * 100
        : null;

      // Target Price
      if (cfg.targetPrice && price != null && price >= parseFloat(cfg.targetPrice)) {
        await showAlert(
          `🎯 Target atins: ${sym}`,
          `${sym} = ${price.toFixed(2)} ≥ target ${cfg.targetPrice}`,
          `target-${sym}`
        );
      }

      // Stop Loss
      if (cfg.stopLoss && price != null && price <= parseFloat(cfg.stopLoss)) {
        await showAlert(
          `🛑 Stop Loss: ${sym}`,
          `${sym} = ${price.toFixed(2)} ≤ stop ${cfg.stopLoss}`,
          `stop-${sym}`
        );
      }

      // Variație zilnică
      if (cfg.dayChangePct && dayChange != null) {
        const prag = parseFloat(cfg.dayChangePct);
        if (Math.abs(dayChange) >= prag) {
          const dir = dayChange >= 0 ? '📈' : '📉';
          await showAlert(
            `${dir} Variație mare: ${sym}`,
            `${sym} variație ${dayChange >= 0 ? '+' : ''}${dayChange.toFixed(2)}% (prag: ±${prag}%)`,
            `daychange-${sym}`
          );
        }
      }
    }

    // VIX prag (global)
    const vixPrags = Object.values(alerts)
      .map(a => parseFloat(a.vixPrag))
      .filter(v => !isNaN(v));
    if (vixPrags.length && vixPrice != null) {
      for (const prag of vixPrags) {
        if (vixPrice >= prag) {
          await showAlert(
            `⚡ VIX Alert`,
            `VIX = ${vixPrice.toFixed(2)} ≥ prag ${prag}`,
            `vix-${prag}`
          );
        }
      }
    }
  } catch {}
}

async function showAlert(title, body, tag) {
  const perm = await self.registration.pushManager.permissionState({ userVisibleOnly: true });
  if (Notification.permission !== 'granted') return;
  await self.registration.showNotification(title, {
    body,
    icon:     `${BASE}/icon-192.png`,
    badge:    `${BASE}/icon-192.png`,
    tag,
    renotify: true,
  });
}

// ── Click pe notificare — deschide app ───────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('/dash/'));
      if (existing) return existing.focus();
      return clients.openWindow(`${BASE}/`);
    })
  );
});
