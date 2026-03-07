// ╔══════════════════════════════════════════════════════════╗
// ║  CONFIGURARE — editează valorile de mai jos             ║
// ╚══════════════════════════════════════════════════════════╝

export const ADMIN_PIN = '1980'; // ← schimbă PIN-ul!

// URL-ul Apps Script (din Google Sheets → Extensions → Apps Script → Deploy)
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJYZcYD9G2Btqp_0GvQqWIBMUsW08Ff9Fs6OKlkHGxDeM_J9UX72Aa2H36YxP6Z7dU/exec';

// URL-ul Cloudflare Worker
export const WORKER_URL = 'https://worker.danut-fagadau.workers.dev';

// Proxy Sheets prin Worker (evită CORS)
export const SHEETS_URL = WORKER_URL + '/api/sheets';

export const USE_CLOUD  = true;
export const USE_WORKER = true;
