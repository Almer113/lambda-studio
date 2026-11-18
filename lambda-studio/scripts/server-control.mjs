// Start, stop and check the deployed server (scripts/serve.mjs on 127.0.0.1:4180), from the
// command line, the Startup shortcut (scripts/start-server.vbs) or any tool that runs commands.
//
//   node scripts/server-control.mjs start    serve the current release in the background
//   node scripts/server-control.mjs stop     stop this app's server, and nothing else
//   node scripts/server-control.mjs status [--json]
//   node scripts/server-control.mjs listen local|network   who can reach it (restarts it if running)
//
// "local" (the default) listens on 127.0.0.1: only this computer, and devices that come in through
// `tailscale serve`. "network" listens on all addresses (0.0.0.0), so other devices on the local
// network (and on the tailnet, by plain http) can open http://<this computer's address>:4180/.
// The choice is kept in data/settings.json, which is local and not in git.
//
// How it knows the server is its own: serve.mjs writes data/server-4180.json (pid, start time and
// a random token) once it is listening, and /api/health reports a hash of that token. A server
// whose hash matches is ours. Stopping asks it to shut down with the token; only if it doesn't, and
// only if that pid's command line is still serve.mjs started at the recorded time, is it killed.
// Anything else on the port is left alone. `npm run deploy` still makes releases; start only
// serves whichever release deploy/current.txt names.
//
// No prompts and no window; start and stop exit 0 on success and print a one-line reason otherwise.
// When a caller sets HUB_RUN=1, start also prints "::hub-step" progress markers for it.

import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { connect } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 4180;
const HOST = '127.0.0.1';
const app = fileURLToPath(new URL('..', import.meta.url));
const serveScript = join(app, 'scripts', 'serve.mjs');
const dataDir = join(app, 'data');
const pidFile = join(dataDir, `server-${PORT}.json`);
const logFile = join(dataDir, 'server.log');
const settingsFile = join(dataDir, 'settings.json');
const LISTEN = { local: '127.0.0.1', network: '0.0.0.0' };

/** Who may reach the server: "local" or "network" (data/settings.json; "local" if unset). */
function listenSetting() {
  try { const v = JSON.parse(readFileSync(settingsFile, 'utf8')).listen; return v in LISTEN ? v : 'local'; } catch { return 'local'; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (line) => console.log(line);
function fail(reason) { console.log(reason); process.exit(1); }

function readPidFile() {
  try { const f = JSON.parse(readFileSync(pidFile, 'utf8')); return f && Number.isInteger(f.pid) && typeof f.token === 'string' ? f : null; }
  catch { return null; }
}
const hashOf = (token) => createHash('sha256').update(token).digest('hex').slice(0, 16);

function portListening() {
  return new Promise((resolve) => {
    const s = connect({ host: HOST, port: PORT });
    const done = (v) => { s.destroy(); resolve(v); };
    s.setTimeout(1000, () => done(true)); // something accepted the connection but is slow: in use
    s.once('connect', () => done(true));
    s.once('error', (e) => done(e.code !== 'ECONNREFUSED'));
  });
}

function http(method, path, headers = {}, timeout = 1500) {
  return new Promise((resolve) => {
    const req = request({ host: HOST, port: PORT, method, path, headers, timeout }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function health() {
  const r = await http('GET', '/api/health');
  if (!r || r.status !== 200) return null;
  try { return JSON.parse(r.body); } catch { return null; } // e.g. an older server answering with the page
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/** The process's command line and start time, to be sure a pid still belongs to our server. */
function processInfo(pid) {
  try {
    const ps = `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}"; if ($p) { $p.CommandLine; $p.CreationDate.ToUniversalTime().ToString('o') }`;
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', windowsHide: true, timeout: 8000 }).trim().split(/\r?\n/);
    return out.length >= 2 ? { commandLine: out[0], started: Date.parse(out[1]) } : null;
  } catch { return null; }
}
function isOurProcess(file) {
  if (!pidAlive(file.pid)) return false;
  const info = processInfo(file.pid);
  return !!info && /serve\.mjs/i.test(info.commandLine) && /node/i.test(info.commandLine)
    && Math.abs(info.started - Date.parse(file.since)) < 30_000; // the same process, not a reused pid
}

/** What is on the port: our server (answering or not), another program, or nothing. */
async function state() {
  const file = readPidFile();
  if (!(await portListening())) return { listening: false, file };
  const h = await health();
  if (file && h?.app === 'lambda-studio' && h.pid === file.pid && h.instance === hashOf(file.token)) {
    return { listening: true, ours: true, answering: true, file, pid: h.pid, since: h.since, version: h.version, host: h.host };
  }
  if (!h && file && isOurProcess(file)) return { listening: true, ours: true, answering: false, file, pid: file.pid, since: file.since };
  return { listening: true, ours: false, file, other: h?.app === 'lambda-studio' ? 'a Lambda Studio server not started by this script' : 'another program' };
}

function removeStalePidFile(file) {
  if (file && !pidAlive(file.pid)) { try { unlinkSync(pidFile); } catch { /* already gone */ } }
}
function lastLogLine() {
  try { return readFileSync(logFile, 'utf8').trim().split(/\r?\n/).pop() ?? ''; } catch { return ''; }
}
function currentRelease() {
  try {
    const name = readFileSync(join(app, 'deploy', 'current.txt'), 'utf8').trim();
    return name && existsSync(join(app, 'deploy', 'releases', name, 'index.html')) ? name : null;
  } catch { return null; }
}

async function start() {
  if (process.env.HUB_RUN === '1') say('::hub-step start Start');
  const s = await state();
  if (s.ours && s.answering) { say(`Lambda Studio is already running (pid ${s.pid}, release ${s.version ?? 'unknown'}).`); return; }
  if (s.ours) fail(`Lambda Studio's server (pid ${s.pid}) is running but not answering; stop it first.`);
  if (s.listening) fail(`Port ${PORT} is used by ${s.other}.`);
  removeStalePidFile(s.file);
  const release = currentRelease();
  if (!release) fail('No release to serve: run npm run deploy first.');

  mkdirSync(dataDir, { recursive: true });
  const log = openSync(logFile, 'a');
  const listen = listenSetting();
  const child = spawn(process.execPath, [serveScript, '--host', LISTEN[listen]], { cwd: app, detached: true, windowsHide: true, stdio: ['ignore', log, log] });
  closeSync(log);
  let exited = null;
  child.once('exit', (code) => { exited = code ?? 1; });
  child.unref();

  for (let waited = 0; waited < 20_000; waited += 200) {
    await sleep(200);
    if (exited !== null) fail(`The server stopped at once: ${lastLogLine() || `exit code ${exited}`}`);
    const now = await state();
    if (now.ours && now.answering && now.pid === child.pid) { say(`Started Lambda Studio (pid ${child.pid}), serving release ${release} at http://${HOST}:${PORT}/${listen === 'network' ? ` and on the local network (port ${PORT})` : ''}.`); process.exit(0); }
  }
  fail(`The server did not start listening on port ${PORT} within 20 s: ${lastLogLine()}`);
}

async function stop() {
  const s = await state();
  if (!s.listening) {
    removeStalePidFile(s.file);
    say('Lambda Studio is not running.');
    return;
  }
  if (!s.ours) {
    say(`Lambda Studio is not running. Port ${PORT} is used by ${s.other}, which stop leaves alone.`);
    return;
  }
  const { pid, token } = s.file;
  if (s.answering) await http('POST', '/api/shutdown', { 'X-Lambda-Token': token, 'Content-Length': 0 }, 3000);
  for (let waited = 0; waited < 6000 && (pidAlive(pid) || await portListening()); waited += 200) await sleep(200);
  if (pidAlive(pid)) {
    if (!isOurProcess(s.file)) fail(`Could not confirm pid ${pid} is still Lambda Studio's server, so it was not killed.`);
    try { process.kill(pid); } catch (e) { fail(`Could not stop pid ${pid}: ${e.message}`); }
    for (let waited = 0; waited < 5000 && pidAlive(pid); waited += 200) await sleep(200);
  }
  for (let waited = 0; waited < 5000 && await portListening(); waited += 200) await sleep(200);
  if (await portListening()) fail(`Stopped pid ${pid}, but port ${PORT} is still in use.`);
  removeStalePidFile(readPidFile());
  say(`Stopped Lambda Studio (pid ${pid}).`);
}

async function status(json) {
  const s = await state();
  const out = s.ours
    ? { running: true, ours: true, pid: s.pid, since: s.since, version: s.version ?? currentRelease() ?? undefined, message: s.answering ? `Serving release ${s.version ?? currentRelease()}${s.host === LISTEN.network ? ' (this PC and the local network)' : ' (this PC only)'}` : 'Running but not answering' }
    : s.listening ? { running: false, ours: false, message: `Port ${PORT} is used by ${s.other}` } : { running: false };
  if (!json) say(s.ours ? `Lambda Studio is running (pid ${s.pid} since ${s.since}).` : s.listening ? `Lambda Studio is not running; port ${PORT} is used by ${s.other}.` : 'Lambda Studio is not running.');
  console.log(JSON.stringify(out));
}

async function setListen(value) {
  if (!(value in LISTEN)) fail('Usage: node scripts/server-control.mjs listen local|network');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(settingsFile, JSON.stringify({ listen: value }, null, 2) + '\n');
  say(value === 'network' ? `Lambda Studio will listen on all addresses: this PC and the local network (port ${PORT}).` : 'Lambda Studio will listen on 127.0.0.1: this PC only (and tailscale serve).');
  const s = await state();
  if (s.ours && s.answering && s.host !== LISTEN[value]) { await stop(); await start(); }
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'start') await start();
else if (cmd === 'stop') await stop();
else if (cmd === 'status') await status(rest.includes('--json'));
else if (cmd === 'listen') await setListen(rest[0]);
else fail('Usage: node scripts/server-control.mjs start | stop | status [--json] | listen local|network');
