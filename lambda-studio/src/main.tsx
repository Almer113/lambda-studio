import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// The service worker lets the installed app open offline. Only in a served production build: not
// on the dev server, and not in the single-file build (opened from disk, where it cannot register).
if (import.meta.env.PROD && import.meta.env.MODE !== 'single' && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* not allowed here: the app still works */ }); });
}
