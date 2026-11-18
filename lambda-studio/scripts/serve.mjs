// A small static server for the deployed build (no dependencies).
//
//   node scripts/serve.mjs [dir] [--port 4180] [--host 127.0.0.1]
//
// Serves `deploy/` by default: the release that deploy/current.txt names (deploy/releases/<name>/),
// or the folder itself when there is no current.txt. It listens on 127.0.0.1 only: other devices
// reach it through `tailscale serve`, which adds HTTPS (needed for clipboard access in the
// browser). current.txt is checked on each request, so `npm run deploy` takes effect at once.
//
// When it serves deploy/, it also records itself for scripts/server-control.mjs (start, stop and
// status): data/server-<port>.json holds its pid, start time and a random
// token, and is removed on exit. GET /api/health says whether it is up (and, by a hash of the
// token, which server it is); POST /api/shutdown with the token in X-Lambda-Token stops it.

import { createServer } from 'node:http';
import { createReadStream, mkdirSync, readFileSync, unlinkSync, writeFileSync, renameSync } from 'node:fs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { stat, readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const here = fileURLToPath(new URL('..', import.meta.url));
const dirArg = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const base = resolve(here, dirArg ?? 'deploy');

/** The folder to serve: the current release, re-read when current.txt changes. */
let current = { mtime: -1, root: base };
async function currentRoot() {
  try {
    const s = await stat(join(base, 'current.txt'));
    if (s.mtimeMs !== current.mtime) {
      const name = (await readFile(join(base, 'current.txt'), 'utf8')).trim();
      current = { mtime: s.mtimeMs, root: join(base, 'releases', name) };
    }
  } catch { current = { mtime: -1, root: base }; }
  return current.root;
}

/** Other releases, newest first: a page still open from the previous deploy may ask for its own chunks. */
async function otherRoots(root) {
  try { return (await readdir(join(base, 'releases'))).sort().reverse().map((r) => join(base, 'releases', r)).filter((r) => r !== root); }
  catch { return []; }
}
const port = Number(opt('port', process.env.PORT ?? 4180));
const host = opt('host', process.env.HOST ?? '127.0.0.1');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.map': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};

async function fileFor(root, urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  const full = resolve(join(root, p));
  if (full !== root && !full.startsWith(root + sep)) return null; // no escaping the folder
  try {
    const s = await stat(full);
    if (s.isFile()) return { full, size: s.size, mtime: s.mtimeMs };
    if (s.isDirectory()) { const idx = join(full, 'index.html'); const t = await stat(idx); return { full: idx, size: t.size, mtime: t.mtimeMs }; }
  } catch { /* not found */ }
  return null;
}

/** Text files are sent gzipped (Tailscale does not compress); each is compressed once and kept. */
const COMPRESS = /^(text\/|application\/(json|manifest|wasm)|image\/svg)/;
const gz = new Map();
async function gzipped(f) {
  const key = `${f.full}:${f.mtime}`;
  let buf = gz.get(key);
  if (!buf) { buf = gzipSync(await readFile(f.full), { level: 9 }); gz.set(key, buf); if (gz.size > 500) gz.delete(gz.keys().next().value); }
  return buf;
}

// --- identity, health and shutdown (only when serving deploy/, the copy server-control.mjs manages) ---
const managed = dirArg === undefined;
const token = randomBytes(24).toString('hex');
const instance = createHash('sha256').update(token).digest('hex').slice(0, 16);
const since = new Date().toISOString();
const pidFile = join(here, 'data', `server-${port}.json`);
const release = () => { try { return readFileSync(join(base, 'current.txt'), 'utf8').trim() || null; } catch { return null; } };

function writePidFile() {
  if (!managed) return;
  mkdirSync(join(here, 'data'), { recursive: true });
  const body = JSON.stringify({ app: 'lambda-studio', pid: process.pid, since, port, token, script: fileURLToPath(import.meta.url) }) + '\n';
  writeFileSync(pidFile + '.tmp', body);
  renameSync(pidFile + '.tmp', pidFile);
}
function removePidFile() {
  if (!managed) return;
  try { if (JSON.parse(readFileSync(pidFile, 'utf8')).token === token) unlinkSync(pidFile); } catch { /* gone, or another server's */ }
}
const tokenOk = (given) => {
  const a = Buffer.from(String(given ?? '')), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
};
let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  removePidFile();
  console.log(`${new Date().toISOString()} Lambda Studio: stopping`);
  server.close(() => process.exit(code));
  server.closeAllConnections();
  setTimeout(() => process.exit(code), 2000).unref();
}

const server = createServer(async (req, res) => {
  const apiPath = new URL(req.url ?? '/', 'http://x').pathname;
  if (apiPath === '/api/health' && (req.method === 'GET' || req.method === 'HEAD')) {
    const body = JSON.stringify({ ok: true, app: 'lambda-studio', pid: process.pid, since, version: release(), host, instance: managed ? instance : null });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(req.method === 'HEAD' ? undefined : body);
    return;
  }
  if (apiPath === '/api/shutdown' && req.method === 'POST') {
    if (!managed || !tokenOk(req.headers['x-lambda-token'])) { res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Forbidden'); return; }
    res.writeHead(202, { 'Content-Type': 'text/plain', Connection: 'close' }).end('Stopping');
    setTimeout(() => shutdown(0), 50);
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
  const path = new URL(req.url ?? '/', 'http://x').pathname;
  // the app has one page: unknown paths without an extension get index.html
  const root = await currentRoot();
  let f = (await fileFor(root, path)) ?? (extname(path) ? null : await fileFor(root, '/index.html'));
  if (!f && path.startsWith('/assets/')) for (const r of await otherRoots(root)) { if ((f = await fileFor(r, path))) break; }
  if (!f) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
  const hashed = path.startsWith('/assets/'); // Vite names these by content hash
  const type = TYPES[extname(f.full).toLowerCase()] ?? 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Accept-Encoding',
  };
  if (COMPRESS.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
    const body = await gzipped(f);
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': f.size });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(f.full).on('error', () => res.destroy()).pipe(res);
});

server.on('error', (e) => { console.error(`${new Date().toISOString()} Lambda Studio server: ${e.message}`); process.exit(1); });
server.listen(port, host, async () => {
  writePidFile();
  console.log(`${new Date().toISOString()} Lambda Studio: serving ${await currentRoot()} at http://${host}:${port} (pid ${process.pid})`);
});
for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP']) process.on(sig, () => shutdown(0));
process.on('exit', removePidFile);
