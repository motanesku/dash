// ╔══════════════════════════════════════════════════════════╗
// ║  CONFIGURARE — doar URL-uri publice aici                ║
// ║  Secretele (PIN, API_TOKEN) se pun EXCLUSIV în          ║
// ║  Cloudflare Worker → Settings → Environment Variables  ║
// ╚══════════════════════════════════════════════════════════╝

// URL-ul Cloudflare Worker
export const WORKER_URL = 'https://worker.danut-fagadau.workers.dev';

// Proxy Sheets prin Worker (evită CORS)
export const SHEETS_URL = WORKER_URL + '/api/sheets';

export const USE_CLOUD  = true;
export const USE_WORKER = true;
