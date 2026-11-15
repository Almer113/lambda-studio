// Counting, sampling and enumerating closed λ-terms by their size in binary λ-calculus bits
// (λ = 2 + body, application = 2 + both sides, de Bruijn index i (0-based) = i + 2 bits).
// The counts of closed terms are OEIS A114852. The BBλ explorer computes Tromp's busy beaver
// for λ: the largest normal form (in bits) of a closed term of a given size.

import { type Term, app, lam, v } from './term';
import { normalize } from './nbe';
import { blcBits } from './formats/blc';

/** counts[n][k]: terms of size n whose free indices are all < k. */
export class Counter {
  private memo = new Map<number, bigint>();
  count(n: number, k: number): bigint {
    if (n < 2) return 0n;
    const key = n * 4096 + k;
    const hit = this.memo.get(key);
    if (hit !== undefined) return hit;
    let c = n - 2 < k ? 1n : 0n; // the variable with index n − 2
    c += this.count(n - 2, k + 1); // λ
    for (let a = 2; a <= n - 4; a++) {
      const fa = this.count(a, k);
      if (fa) c += fa * this.count(n - 2 - a, k);
    }
    this.memo.set(key, c);
    return c;
  }
  closed(n: number): bigint { return this.count(n, 0); }

  /** The r-th term (0 ≤ r < count(n, k)) in a fixed order: variable, λ, applications by left size. */
  unrank(n: number, k: number, r: bigint): Term {
    if (n - 2 < k) { if (r === 0n) return v(n - 2); r -= 1n; }
    const l = this.count(n - 2, k + 1);
    if (r < l) return lam(this.unrank(n - 2, k + 1, r));
    r -= l;
    for (let a = 2; a <= n - 4; a++) {
      const fa = this.count(a, k), fb = this.count(n - 2 - a, k);
      const block = fa * fb;
      if (r < block) return app(this.unrank(a, k, r / fb), this.unrank(n - 2 - a, k, r % fb));
      r -= block;
    }
    throw new Error('rank out of range');
  }
}

/** Uniform random bigint in [0, max). */
export function randomBelow(max: bigint, rnd: () => number = Math.random): bigint {
  if (max <= 0n) throw new Error('empty range');
  const bits = max.toString(2).length;
  for (;;) {
    let x = 0n;
    for (let b = 0; b < bits; b += 24) x = (x << 24n) | BigInt(Math.floor(rnd() * 2 ** 24));
    x &= (1n << BigInt(bits)) - 1n;
    if (x < max) return x;
  }
}

export function randomClosedTerm(n: number, counter = new Counter(), rnd: () => number = Math.random): Term | null {
  const total = counter.closed(n);
  if (total === 0n) return null;
  return counter.unrank(n, 0, randomBelow(total, rnd));
}

/** All closed terms of size n (in unrank order). */
export function* enumerateClosed(n: number, counter = new Counter()): Generator<Term> {
  function* go(n: number, k: number): Generator<Term> {
    if (n < 2) return;
    if (n - 2 < k) yield v(n - 2);
    if (counter.count(n - 2, k + 1)) for (const b of go(n - 2, k + 1)) yield lam(b);
    for (let a = 2; a <= n - 4; a++) {
      if (!counter.count(a, k) || !counter.count(n - 2 - a, k)) continue;
      for (const f of go(a, k)) for (const x of go(n - 2 - a, k)) yield app(f, x);
    }
  }
  yield* go(n, 0);
}

export interface Classified { term: Term; status: 'normal' | 'diverges' | 'unknown'; nfBits?: number; betas?: number }

/** Normalize with a step budget; Ω-like loops show up as 'unknown' (we cannot prove divergence). */
export function classify(t: Term, fuel: number, maxBits = 100_000): Classified {
  const r = normalize(t, fuel);
  if (r.status === 'normal' && r.term) {
    const bits = blcBits(r.term);
    return bits > maxBits ? { term: t, status: 'unknown' } : { term: t, status: 'normal', nfBits: bits, betas: r.betas };
  }
  return { term: t, status: 'unknown' };
}

export interface BBResult {
  n: number;
  terms: number;
  normalizing: number;
  unknown: number;
  best: number | null;
  champions: { term: Term; nf: number; betas: number }[];
}

/** BBλ(n) as far as a step budget can tell: a lower bound when some terms stay undecided. */
export function busyBeaver(n: number, fuel = 20_000, onProgress?: (done: number, total: number) => boolean | void): BBResult {
  const counter = new Counter();
  const total = Number(counter.closed(n));
  const res: BBResult = { n, terms: total, normalizing: 0, unknown: 0, best: null, champions: [] };
  let done = 0;
  for (const t of enumerateClosed(n, counter)) {
    const c = classify(t, fuel);
    if (c.status === 'normal') {
      res.normalizing++;
      const nf = c.nfBits!;
      if (res.best === null || nf > res.best) { res.best = nf; res.champions = [{ term: t, nf, betas: c.betas! }]; }
      else if (nf === res.best && res.champions.length < 8) res.champions.push({ term: t, nf, betas: c.betas! });
    } else res.unknown++;
    done++;
    if (onProgress && done % 500 === 0 && onProgress(done, total) === false) break;
  }
  return res;
}
