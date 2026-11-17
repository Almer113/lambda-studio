// Build the app into `deploy/`, the folder scripts/serve.mjs serves.
//
//   npm run deploy
//
// It type-checks, builds into `.deploy-next/`, and only then swaps that in, so the running server
// never sees a half-written build (and `npm run build`, which writes `dist/`, never touches it).

import { execSync } from 'node:child_process';
import { existsSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const run = (cmd) => execSync(cmd, { cwd, stdio: 'inherit' });

run('npx tsc -p .');
run('npx vite build --outDir .deploy-next --emptyOutDir');

let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { cwd }).toString().trim(); } catch { /* not a git checkout */ }
writeFileSync(new URL('../.deploy-next/version.txt', import.meta.url), `${commit} ${new Date().toISOString()}\n`);

const at = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
rmSync(at('.deploy-old'), { recursive: true, force: true });
if (existsSync(at('deploy'))) renameSync(at('deploy'), at('.deploy-old'));
renameSync(at('.deploy-next'), at('deploy'));
rmSync(at('.deploy-old'), { recursive: true, force: true });
console.log(`Deployed ${commit} to deploy/ (the running server picks it up at once).`);
