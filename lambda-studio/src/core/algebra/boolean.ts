// λ-term → truth table → canonical DNF / CNF and a minimal sum of products (Quine–McCluskey).

import { type Term, apps, size } from '../term';
import { churchTrue, churchFalse, decodeBool } from '../encodings';
import { normalize } from '../nbe';

export interface TruthRow { inputs: boolean[]; out: boolean | null; note?: string }
export interface TruthTable { vars: string[]; rows: TruthRow[]; complete: boolean }

/** Leading λs of a term (its arity as a function), with their name hints. */
export function arityOf(t: Term): { n: number; hints: (string | undefined)[] } {
  const hints: (string | undefined)[] = [];
  let x = t;
  while (x.tag === 'lam') { hints.push(x.hint); x = x.body; }
  return { n: hints.length, hints };
}

/** Distinct variable names: the λ hints where usable, otherwise a, b, c, … */
export function argNames(hints: (string | undefined)[], n: number): string[] {
  const names: string[] = [];
  for (let k = 0; k < n; k++) {
    const h = hints[k];
    const ok = h && /^[A-Za-z][A-Za-z0-9]*$/.test(h) && !names.includes(h);
    names.push(ok ? h! : '');
  }
  let next = 0;
  const letter = () => { for (;;) { const c = String.fromCharCode(97 + (next % 26)) + (next >= 26 ? Math.floor(next / 26) : ''); next++; if (!names.includes(c)) return c; } };
  return names.map((x) => x || letter());
}

export const MAX_TRUTH_VARS = 10;

export function truthTable(t: Term, n: number, names: string[], fuel = 200_000): TruthTable {
  if (n > MAX_TRUTH_VARS) throw new Error(`At most ${MAX_TRUTH_VARS} inputs (${2 ** MAX_TRUTH_VARS} rows).`);
  const rows: TruthRow[] = [];
  let complete = true;
  for (let m = 0; m < 2 ** n; m++) {
    const inputs = Array.from({ length: n }, (_, k) => ((m >> (n - 1 - k)) & 1) === 1);
    const r = normalize(apps(t, ...inputs.map((b) => (b ? churchTrue : churchFalse))), fuel);
    let out: boolean | null = null, note: string | undefined;
    if (r.status !== 'normal' || !r.term) note = r.status === 'fuel' ? 'no normal form within the limit' : r.message ?? 'error';
    else { out = decodeBool(r.term); if (out === null) note = size(r.term) < 40 ? 'not a Boolean' : 'not a Boolean'; }
    if (out === null) complete = false;
    rows.push({ inputs, out, note });
  }
  return { vars: names, rows, complete };
}

// --- formulas --------------------------------------------------------------------------------
/** An implicant: for each variable 1, 0 or null (absent). */
export type Cube = (0 | 1 | null)[];

const lit = (name: string, v: 0 | 1, neg = '¬') => (v ? name : `${neg}${name}`);

export function cubeText(c: Cube, vars: string[], sym = { and: ' ∧ ', not: '¬' }): string {
  const parts = c.flatMap((v, k) => (v === null ? [] : [lit(vars[k], v, sym.not)]));
  return parts.length ? parts.join(sym.and) : '⊤';
}

export interface Formulas { dnf: string; cnf: string; minimal: string; minimalCubes: Cube[]; ones: number[] }

export function formulas(tt: TruthTable): Formulas | null {
  if (!tt.complete) return null;
  const n = tt.vars.length;
  const ones = tt.rows.flatMap((r, m) => (r.out ? [m] : []));
  const zeros = tt.rows.flatMap((r, m) => (r.out ? [] : [m]));
  const bits = (m: number): Cube => Array.from({ length: n }, (_, k) => (((m >> (n - 1 - k)) & 1) as 0 | 1));
  const wrap = (s: string, many: boolean) => (many ? `(${s})` : s);
  const dnf = ones.length === 0 ? '⊥' : n === 0 ? '⊤' : ones.map((m) => wrap(cubeText(bits(m), tt.vars), ones.length > 1 && n > 1)).join(' ∨ ');
  const cnf = zeros.length === 0 ? '⊤' : n === 0 ? '⊥'
    : zeros.map((m) => wrap(bits(m).map((v, k) => lit(tt.vars[k], v ? 0 : 1)).join(' ∨ '), zeros.length > 1 && n > 1)).join(' ∧ ');
  const minimalCubes = minimize(n, ones);
  const minimal = ones.length === 0 ? '⊥' : minimalCubes.length === 1 ? cubeText(minimalCubes[0], tt.vars)
    : minimalCubes.map((c) => { const s = cubeText(c, tt.vars); return c.filter((x) => x !== null).length > 1 ? `(${s})` : s; }).join(' ∨ ');
  return { dnf, cnf, minimal, minimalCubes, ones };
}

/** Quine–McCluskey prime implicants, then an exact cover for small problems (greedy otherwise). */
export function minimize(n: number, ones: number[]): Cube[] {
  if (ones.length === 0) return [];
  if (ones.length === 2 ** n) return [Array(n).fill(null)];
  type Imp = { mask: number; value: number; covers: Set<number> }; // mask: bits that are fixed
  const full = (1 << n) - 1;
  let layer: Imp[] = ones.map((m) => ({ mask: full, value: m, covers: new Set([m]) }));
  const primes: Imp[] = [];
  while (layer.length) {
    const next = new Map<string, Imp>();
    const used = new Set<Imp>();
    for (let i = 0; i < layer.length; i++) for (let j = i + 1; j < layer.length; j++) {
      const a = layer[i], b = layer[j];
      if (a.mask !== b.mask) continue;
      const diff = (a.value ^ b.value) & a.mask;
      if (diff && (diff & (diff - 1)) === 0) {
        const mask = a.mask & ~diff, value = a.value & mask;
        const key = `${mask}:${value}`;
        if (!next.has(key)) next.set(key, { mask, value, covers: new Set([...a.covers, ...b.covers]) });
        used.add(a); used.add(b);
      }
    }
    for (const x of layer) if (!used.has(x)) primes.push(x);
    layer = [...next.values()];
  }
  // dedupe primes
  const uniq = new Map<string, Imp>();
  for (const p of primes) uniq.set(`${p.mask}:${p.value}`, p);
  const P = [...uniq.values()];
  // exact minimum cover (fewest implicants, then fewest literals) by search when small
  const lits = (p: Imp) => popcount(p.mask);
  let best: Imp[] | null = null;
  if (P.length <= 20) {
    const choose = (left: Set<number>, picked: Imp[]) => {
      if (best && (picked.length > best.length)) return;
      if (left.size === 0) {
        if (!best || picked.length < best.length || (picked.length === best.length && sum(picked, lits) < sum(best, lits))) best = [...picked];
        return;
      }
      const m = Math.min(...left);
      for (const p of P) if (p.covers.has(m)) {
        const rest = new Set([...left].filter((x) => !p.covers.has(x)));
        choose(rest, [...picked, p]);
      }
    };
    choose(new Set(ones), []);
  }
  if (!best) {
    best = [];
    const left = new Set(ones);
    while (left.size) {
      let pick = P[0], score = -1;
      for (const p of P) { const s = [...p.covers].filter((x) => left.has(x)).length; if (s > score || (s === score && lits(p) < lits(pick))) { pick = p; score = s; } }
      best.push(pick);
      for (const x of pick.covers) left.delete(x);
    }
  }
  const toCube = (p: Imp): Cube => Array.from({ length: n }, (_, k) => { const bit = 1 << (n - 1 - k); return p.mask & bit ? ((p.value & bit ? 1 : 0) as 0 | 1) : null; });
  return (best as Imp[]).map(toCube).sort((a, b) => cmpCube(a, b));
}
const popcount = (x: number) => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);
const rank = (v: 0 | 1 | null) => (v === 1 ? 0 : v === 0 ? 1 : 2); // a before ¬a before absent
const cmpCube = (a: Cube, b: Cube) => { for (let k = 0; k < a.length; k++) { const x = rank(a[k]), y = rank(b[k]); if (x !== y) return x - y; } return 0; };

/** Minimal formula as λ source over the prelude (for "use as source"). */
export function formulaToLambda(cubes: Cube[], vars: string[]): string {
  const term = (c: Cube) => {
    const ls = c.flatMap((v, k) => (v === null ? [] : [v ? vars[k] : `(NOT ${vars[k]})`]));
    if (!ls.length) return 'TRUE';
    return ls.reduce((acc, l) => `(AND ${acc} ${l})`);
  };
  const body = cubes.length === 0 ? 'FALSE' : cubes.map(term).reduce((acc, t) => `(OR ${acc} ${t})`);
  const strip = body.startsWith('(') ? body.slice(1, -1) : body; // every parenthesised body is one outer group
  return vars.length ? `λ${vars.join(' ')}.${strip}` : strip;
}
