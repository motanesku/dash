# Portfolio Tracker v2

## Setup rapid

### 1. Cloudflare Worker (proxy prețuri — rezolvă CORS)
1. Mergi pe [cloudflare.com](https://cloudflare.com) → Sign up gratuit
2. **Workers & Pages** → **Create Worker** → **Edit code**
3. Copiază tot conținutul din `worker.js` → **Save & Deploy**
4. Copiază URL-ul worker-ului (ex: `https://portfolio-proxy.TU.workers.dev`)
5. *Opțional dar recomandat:* KV Store pentru cache
   - **KV** → **Create namespace** → numește-l `CACHE`
   - În worker → **Settings** → **Variables** → **KV Namespace Bindings** → Add `CACHE`

### 2. Google Apps Script (sync tranzacții)
1. Deschide Google Sheets → **Extensions** → **Apps Script**
2. Copiază conținutul din `google_apps_script.js`
3. Înlocuiește `SHEET_ID` cu ID-ul fișierului tău (din URL)
4. **Deploy** → **New deployment** → **Web app** → Execute as: Me, Access: Anyone
5. Copiază URL-ul deployment-ului

### 3. Configurare
Editează `src/config.js`:
```js
export const ADMIN_PIN = 'PIN_TĂU';
export const SCRIPT_URL = 'URL_APPS_SCRIPT';
export const WORKER_URL = 'URL_CLOUDFLARE_WORKER';
```

### 4. Deploy pe GitHub
```bash
npm install
npm run build   # test local
```

1. Creează repo nou pe GitHub
2. Urcă toate fișierele (inclusiv folderul `.github`)
3. **Settings** → **Pages** → **Source**: GitHub Actions
4. Fă push → se deployează automat în ~2 minute

### 5. Domeniu propriu (opțional)
1. Cumpără domeniu pe [porkbun.com](https://porkbun.com) sau [namecheap.com](https://namecheap.com)
2. Pe Cloudflare: **Add site** → adaugă domeniul → schimbă nameservers la Cloudflare
3. **DNS** → adaugă `CNAME` → `@` → `TU.github.io`
4. Pe GitHub: **Settings** → **Pages** → **Custom domain** → adaugă domeniul

## Structură fișiere
```
src/
  config.js          ← configurare (PIN, URLs)
  lib/
    prices.js        ← fetch prețuri via Worker/fallback
    portfolio.js     ← calcule portofoliu
    sheets.js        ← Google Sheets + localStorage
    store.js         ← Zustand global state
  components/        ← Header, Nav, Modals, PriceChart
  pages/             ← Dashboard, Positions, Transactions, Club
  styles/            ← global.css
worker.js            ← Cloudflare Worker (deploy separat)
google_apps_script.js ← Apps Script (Google Sheets)
```

## Costuri
| Serviciu | Cost |
|---|---|
| Domeniu .com | ~$10/an |
| GitHub Pages | Gratuit |
| Cloudflare Workers | Gratuit (100k req/zi) |
| Google Sheets | Gratuit |
| **Total** | **~$10/an** |
