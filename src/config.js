// ╔══════════════════════════════════════════════════════════╗
// ║  CONFIGURARE — editează valorile de mai jos             ║
// ╚══════════════════════════════════════════════════════════╝

export const ADMIN_PIN = '1980'; // ← schimbă PIN-ul!

// URL-ul Apps Script (din Google Sheets → Extensions → Apps Script → Deploy)
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxtnXwqqr6gXbNEnswwIsnUxcCKPIJY3bGskRpJpCBaxhI9LQH_gtKvDHC-DSmeSInc/exec';

// URL-ul Cloudflare Worker (după deploy pe cloudflare.com)
export const WORKER_URL = 'https://worker.danut-fagadau.workers.dev';
// Exemplu: 'https://portfolio-proxy.TU.workers.dev'

export const USE_CLOUD = SCRIPT_URL !== 'PUNE_URL_APPS_SCRIPT_AICI';
export const USE_WORKER = WORKER_URL !== 'PUNE_URL_WORKER_AICI';
