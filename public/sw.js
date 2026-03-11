const CACHE_NAME = 'ptf-v1';
const BASE = '/dash';

// Resurse de cacheat la install
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

// ── Activate — șterge cache-uri vechi ────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch — network first, fallback cache ────────────────────
self.addEventListener('fetch', e => {
  // Nu intercepta requesturi către worker/sheets/yahoo
  const url = new URL(e.request.url);
  if (
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('yahoo.com') ||
    url.hostname.includes('alternative.me') ||
    url.hostname.includes('cnn.io') ||
    url.hostname.includes('fonts.gstatic.com')
  ) return;

  // Pentru HTML — network first cu fallback la cache
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

  // Pentru assets JS/CSS — cache first
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

// ── Push Notifications ────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || '📈 Portfolio Alert', {
      body: data.body || '',
      icon: `${BASE}/icon-192.png`,
      badge: `${BASE}/icon-192.png`,
      tag: data.tag || 'ptf-alert',
      renotify: true,
      data: { url: `${BASE}/` },
    })
  );
});

// Click pe notificare — deschide app
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
