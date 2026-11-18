// Build the app for the server in scripts/serve.mjs.
//
//   npm run deploy
//
// Each deploy is built into its own folder, deploy/releases/<time>-<commit>/, and only when the
// build is complete does deploy/current.txt switch to it. The running server reads current.txt, so
// it never sees a half-written build, and no folder it has open is renamed (Windows refuses that).
// The previous release is kept; older ones are removed. `npm run build` (dist/) never touches this.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const deployDir = join(cwd, 'deploy');
const releases = join(deployDir, 'releases');
const run = (cmd) => execSync(cmd, { cwd, stdio: 'inherit' });

let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { cwd }).toString().trim(); } catch { /* not a git checkout */ }
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const name = `${stamp}-${commit}`;
const out = join(releases, name);

run('npx tsc -p .');
mkdirSync(releases, { recursive: true });
run(`npx vite build --outDir "${out}" --emptyOutDir`);
writeFileSync(join(out, 'version.txt'), `${commit} ${new Date().toISOString()}\n`);

// switch: write the pointer beside it, then move it into place in one step
const pointer = join(deployDir, 'current.txt');
const previous = existsSync(pointer) ? readFileSync(pointer, 'utf8').trim() : null;
writeFileSync(pointer + '.tmp', name + '\n');
try { renameSync(pointer + '.tmp', pointer); }
catch { writeFileSync(pointer, name + '\n'); rmSync(pointer + '.tmp', { force: true }); } // the server was reading it

// tidy up: keep this release and the one before; leave anything still in use for next time
const keep = new Set([name, previous]);
for (const r of readdirSync(releases)) {
  if (!keep.has(r)) { try { rmSync(join(releases, r), { recursive: true, force: true }); } catch { /* in use */ } }
}
// files from the old layout (the build directly in deploy/)
for (const f of readdirSync(deployDir)) {
  if (f !== 'releases' && f !== 'current.txt') { try { rmSync(join(deployDir, f), { recursive: true, force: true }); } catch { /* in use */ } }
}
for (const old of ['.deploy-next', '.deploy-old']) { try { rmSync(join(cwd, old), { recursive: true, force: true }); } catch { /* ignore */ } }

console.log(`Deployed ${commit} as deploy/releases/${name} (the running server switches at once).`);
