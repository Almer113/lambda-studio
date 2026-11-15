// Generates golden Tromp-diagram fixtures using John Tromp's reference `blc` tool
// (https://github.com/tromp/AIT, built locally into tools/AIT/blc.exe).
// Usage: node scripts/make-golden.mjs [path-to-blc] > tests/golden/tromp.json
// For each term: blc's own BLC encoding (after its eta/opt pass) and its PBM pixel rows.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const blc = resolve(process.argv[2] ?? '../tools/AIT/blc.exe');
const dir = mkdtempSync(join(tmpdir(), 'golden-'));

const fixed = {
  I: '\\x.x',
  K: '\\x\\y.x',
  FALSE: '\\x\\y.y',
  S: '\\x\\y\\z.x z (y z)',
  B: '\\f\\g\\x.f (g x)',
  C: '\\f\\x\\y.f y x',
  W: '\\x\\y.x y y',
  omega: '\\x.x x',
  Y: '\\f.(\\x.f (x x)) (\\x.f (x x))',
  Omega: '(\\x.x x) (\\x.x x)',
  PAIR: '\\a\\b\\f.f a b',
  SUCC: '\\n\\f\\x.f (n f x)',
  PLUS: '\\m\\n\\f\\x.m f (n f x)',
  MULT: '\\m\\n\\f.m (n f)',
  PRED: '\\n\\f\\x.n (\\g\\h.h (g f)) (\\u.x) (\\u.u)',
};
for (let n = 0; n <= 5; n++) fixed[`church${n}`] = `\\f\\x.${'f ('.repeat(n)}x${')'.repeat(n)}`;

// Deterministic PRNG so the fixture is reproducible.
let seed = 20261115;
const rnd = (k) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % k; };

// Random closed beta-normal form, printed in Tromp's .lam syntax with names v<depth>.
function nf(depth, budget) {
  if (depth === 0 || (budget > 1 && rnd(3) === 0)) return `\\v${depth}.${nf(depth + 1, budget - 1)}`;
  return neutral(depth, budget);
}
function neutral(depth, budget) {
  let head = `v${rnd(depth)}`;
  let b = budget;
  while (b > 1 && rnd(2) === 0) { const arg = nf(depth, Math.floor(b / 2)); head = `${head} (${arg})`; b = Math.floor(b / 2); }
  return head;
}
for (let i = 0; i < 40; i++) fixed[`random${i}`] = nf(0, 6 + rnd(10));

const run = (action, file) => execFileSync(blc, [action, file], { input: '', encoding: 'latin1' });
const out = [];
for (const [name, lam] of Object.entries(fixed)) {
  const file = join(dir, `${name}.lam`);
  writeFileSync(file, lam + '\n');
  const bits = run('blc', file).trim();
  const pbm = run('pbm', file).split('\n');
  const [w, h] = pbm[1].trim().split(/\s+/).map(Number);
  const rows = pbm.slice(2, 2 + h).map((r) => r.trim().split(/\s+/).join(''));
  if (rows.length !== h || rows.some((r) => r.length !== w)) throw new Error(`bad pbm for ${name}`);
  out.push({ name, lam, blc: bits, width: w, height: h, rows });
}
process.stdout.write(JSON.stringify(out, null, 1) + '\n');
