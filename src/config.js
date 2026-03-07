// ╔══════════════════════════════════════════════════════════╗
// ║  CONFIGURARE — editează valorile de mai jos             ║
// ╚══════════════════════════════════════════════════════════╝

export const ADMIN_PIN = '1980'; // ← schimbă PIN-ul!

// URL-ul Apps Script (din Google Sheets → Extensions → Apps Script → Deploy)
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzOH7osGZ4QfOmJhVqzUqe1T7EjZ_RZq8t2MOSnCJ4Q0AUWQNzSQdU3L3rR5GdKjouE/exec';

// URL-ul Cloudflare Worker
export const WORKER_URL = 'https://worker.danut-fagadau.workers.dev';

// Proxy Sheets prin Worker (evită CORS)
export const SHEETS_URL = WORKER_URL + '/api/sheets';

export const USE_CLOUD  = true;
export const USE_WORKER = true;
