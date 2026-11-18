// Service worker: lets the installed app open offline. The whole app runs in the browser, so once
// its files are cached nothing else is needed.
//
// - Pages: network first, so a new deploy shows on the next load; the cached page when offline.
// - /assets/*: cache first (Vite names them by content hash, so they never change).
// - Anything else of ours (manifest, icons): network first, cache as fallback.
//
// precache.json (written by the build) lists every file of the build. It is read on install and
// after each page load, so the cache holds exactly the current build: new files are fetched, files
// of earlier deploys are dropped, and parts of the app not opened yet still work offline.

const CACHE = 'lambda-studio-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];

async function syncBuild() {
  const cache = await caches.open(CACHE);
  let list;
  try { list = await (await fetch('/precache.json', { cache: 'no-store' })).json(); } catch { return; } // offline, or no list
  const want = new Set(list);
  const keys = await cache.keys();
  const have = new Set(keys.map((r) => new URL(r.url).pathname));
  await Promise.all(keys.filter((r) => { const p = new URL(r.url).pathname; return p.startsWith('/assets/') && !want.has(p); }).map((r) => cache.delete(r)));
  await cache.addAll(list.filter((f) => !have.has(f)));
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    await (await caches.open(CACHE)).addAll(SHELL);
    await syncBuild();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function networkFirst(req, key) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(key ?? req, res.clone());
    return res;
  } catch {
    return (await cache.match(key ?? req)) ?? Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // one page: every path is the app. After it loads, bring the cache up to the current build.
    e.respondWith(networkFirst(req, '/'));
    e.waitUntil(syncBuild().catch(() => {}));
  } else if (url.pathname.startsWith('/assets/')) e.respondWith(cacheFirst(req));
  else if (url.pathname !== '/version.txt' && url.pathname !== '/precache.json') e.respondWith(networkFirst(req));
});
