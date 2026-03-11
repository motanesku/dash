import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'

// ── Înregistrare Service Worker (PWA) ────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/dash/sw.js', { scope: '/dash/' })
      .then(reg => {
        console.log('[SW] Înregistrat:', reg.scope);
      })
      .catch(err => console.warn('[SW] Eroare:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
