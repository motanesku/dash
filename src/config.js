// ╔══════════════════════════════════════════════════════════╗
// ║  CONFIGURARE NOUĂ — CLOUDFLARE PAGES + D1                ║
// ╚══════════════════════════════════════════════════════════╝

// Folosim path-ul relativ '/api?endpoint='
// Site-ul se va apela pe el însuși, eliminând orice eroare de CORS
export const WORKER_URL = '/api?endpoint=';

// URL-ul pentru API-ul nou (nu mai avem nevoie de proxy de Sheets)
export const SHEETS_URL = WORKER_URL; 

export const USE_CLOUD  = true;
export const USE_WORKER = true;
