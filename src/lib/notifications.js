import { WORKER_URL } from '../config.js';

// ── Cere permisiune notificări ───────────────────────────────
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  const result = await Notification.requestPermission();
  return result;
}

// ── Înregistrează Periodic Background Sync (unde e suportat) ─
export async function registerPeriodicSync() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    // Periodic Background Sync — funcționează pe Android Chrome
    if ('periodicSync' in reg) {
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state === 'granted') {
        await reg.periodicSync.register('check-alerts-periodic', {
          minInterval: 5 * 60 * 1000, // minim 5 minute
        });
      }
    }
  } catch {}
}

// ── Trimite alertele la Service Worker pentru verificare background ──
// Apelat la fiecare update de prețuri din store
export async function syncAlertsToSW(alerts, prices) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) return;

    // Trimite datele la SW (le stochează în cache pentru background sync)
    reg.active.postMessage({
      type: 'UPDATE_ALERTS',
      alerts,
      prices,
      workerUrl: WORKER_URL,
    });

    // Declanșează o verificare imediată
    reg.active.postMessage({ type: 'CHECK_ALERTS' });

    // Înregistrează Background Sync pentru când device-ul are conexiune
    if ('sync' in reg) {
      await reg.sync.register('check-alerts');
    }
  } catch {}
}

// ── Notificare locală directă (când app-ul e deschis) ────────
export function sendLocalNotification(title, body, tag = 'ptf-alert') {
  if (Notification.permission !== 'granted') return;
  navigator.serviceWorker.ready.then(reg => {
    reg.showNotification(title, {
      body,
      icon:     '/dash/icon-192.png',
      badge:    '/dash/icon-192.png',
      tag,
      renotify: true,
    });
  });
}

