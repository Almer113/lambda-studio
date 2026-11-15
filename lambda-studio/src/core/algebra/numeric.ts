// λ-term → table of values on Church numerals → a guessed closed form (always a conjecture).

import { type Term, apps } from '../term';
import { churchNumeral, decodeNumeral, decodeBool } from '../encodings';
import { normalize } from '../nbe';

export type Value = { k: 'num'; n: number; eta?: boolean } | { k: 'bool'; b: boolean } | { k: 'other' } | { k: 'none'; why: string };

export function evalAt(t: Term, args: number[], fuel = 300_000): Value {
  const r = normalize(apps(t, ...args.map(churchNumeral)), fuel);
  if (r.status !== 'normal' || !r.term) return { k: 'none', why: r.status === 'fuel' ? 'no normal form within the limit' : r.message ?? 'error' };
  const n = decodeNumeral(r.term);
  if (n !== null) return { k: 'num', n };
  // λx.x is η-equal to the numeral 1 (e.g. EXP n 0 = 0 n = λx.x)
  if (r.term.tag === 'lam' && r.term.body.tag === 'var' && r.term.body.i === 0) return { k: 'num', n: 1, eta: true };
  const b = decodeBool(r.term);
  if (b !== null) return { k: 'bool', b };
  return { k: 'other' };
}

export function valueText(v: Value): string {
  return v.k === 'num' ? `${v.n}${v.eta ? ' (η)' : ''}` : v.k === 'bool' ? (v.b ? 'TRUE' : 'FALSE') : v.k === 'other' ? '(not a number)' : '—';
}

/** Read results as numbers, or as truth values when the function is a predicate (0 is also FALSE). */
export function asNumbers(vs: Value[]): (number | null)[] {
  return vs.map((v) => (v.k === 'num' ? v.n : null));
}
export function isPredicate(vs: Value[]): boolean {
  return vs.some((v) => v.k === 'bool' && v.b) && vs.every((v) => v.k === 'bool' || (v.k === 'num' && v.n === 0) || v.k === 'none');
}
export function asBools(vs: Value[]): (boolean | null)[] {
  return vs.map((v) => (v.k === 'bool' ? v.b : v.k === 'num' && v.n === 0 ? false : null));
}

// --- rationals -------------------------------------------------------------------------------
type Q = [bigint, bigint]; // numerator, denominator > 0
const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const q = (n: bigint, d = 1n): Q => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return [n / g, d / g]; };
const qadd = (a: Q, b: Q) => q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const qmul = (a: Q, b: Q) => q(a[0] * b[0], a[1] * b[1]);

/** Coefficients (ascending powers of n) of the polynomial through (start+i, ys[i]). */
function polyFit(ys: number[], start: number): Q[] | null {
  // Newton forward differences
  const diffs: bigint[] = [];
  let row = ys.map(BigInt);
  while (row.length) { diffs.push(row[0]); if (row.every((x) => x === row[0])) break; row = row.slice(1).map((x, i) => x - row[i]); }
  const degree = diffs.length - 1;
  if (row.length < 3 && degree > 0) return null; // need at least 2 confirming points beyond the fit
  // p(n) = Σ_k Δ^k · C(n − start, k)
  let coeffs: Q[] = [q(0n)];
  let basis: Q[] = [q(1n)]; // C(n − start, 0) as a polynomial in n
  let kfact = 1n;
  for (let k = 0; k <= degree; k++) {
    if (k > 0) {
      // basis *= (n − start − (k − 1)), divided later by k!
      const c = BigInt(-(start + k - 1));
      const next: Q[] = Array(basis.length + 1).fill(q(0n));
      basis.forEach((b, i) => { next[i] = qadd(next[i], qmul(b, q(c))); next[i + 1] = qadd(next[i + 1], b); });
      basis = next;
      kfact *= BigInt(k);
    }
    const scale = q(diffs[k], kfact);
    basis.forEach((b, i) => { while (coeffs.length <= i) coeffs.push(q(0n)); coeffs[i] = qadd(coeffs[i], qmul(b, scale)); });
  }
  while (coeffs.length > 1 && coeffs[coeffs.length - 1][0] === 0n) coeffs.pop();
  return coeffs;
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (k: number) => String(k).split('').map((d) => SUP[Number(d)]).join('');

/** "(n² + n)/2" style printing with a common denominator. */
function polyText(c: Q[], x = 'n'): string {
  const den = c.reduce((d, [, b]) => (d * b) / gcd(d, b), 1n);
  const ints = c.map(([a, b]) => (a * den) / b);
  const terms: string[] = [];
  for (let k = ints.length - 1; k >= 0; k--) {
    const a = ints[k];
    if (a === 0n) continue;
    const mag = a < 0n ? -a : a;
    const mon = k === 0 ? '' : k === 1 ? x : `${x}${sup(k)}`;
    const coef = mon && mag === 1n ? '' : String(mag);
    const s = `${coef}${coef && mon ? '·' : ''}${mon}`;
    terms.push(terms.length === 0 ? (a < 0n ? `−${s}` : s) : `${a < 0n ? ' − ' : ' + '}${s}`);
  }
  const body = terms.join('') || '0';
  return den === 1n ? body : terms.length > 1 ? `(${body})/${den}` : `${body}/${den}`;
}

export interface Guess { formula: string; note?: string }

const FACT = (n: number) => { let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; };
const isPrime = (n: number) => { if (n < 2) return false; for (let k = 2; k * k <= n; k++) if (n % k === 0) return false; return true; };

/** Guesses for a sequence a(0), a(1), … (nulls end the usable prefix). */
export function guessSequence(values: (number | null)[]): Guess[] {
  const firstNull = values.indexOf(null);
  const ys = (firstNull < 0 ? values : values.slice(0, firstNull)) as number[];
  const out: Guess[] = [];
  if (ys.length < 3) return out;
  const fits = (f: (n: number) => number) => ys.every((y, n) => f(n) === y);
  if (ys.every((y) => y === ys[0])) return [{ formula: `${ys[0]}`, note: 'constant' }];
  const poly = polyFit(ys, 0);
  if (poly) out.push({ formula: polyText(poly), note: `polynomial of degree ${poly.length - 1}` });
  // 0 for small n, then a polynomial (truncated subtraction)
  if (!poly) {
    for (let k = 1; k < ys.length - 3; k++) {
      if (ys.slice(0, k).every((y) => y === 0) && ys[k] !== 0) {
        const p = polyFit(ys.slice(k - 1), k - 1);
        if (p && p.length === 2) { out.push({ formula: `max(0, ${polyText(p)})`, note: 'truncated at 0' }); break; }
        const p2 = polyFit(ys.slice(k), k);
        if (p2) { out.push({ formula: `${polyText(p2)} for n ≥ ${k}, 0 before` }); break; }
        break;
      }
    }
  }
  for (let c = 2; c <= 10; c++) {
    if (ys[0] !== 0 && fits((n) => ys[0] * c ** n)) out.push({ formula: ys[0] === 1 ? `${c}ⁿ` : `${ys[0]}·${c}ⁿ`, note: 'exponential' });
    else { const a = ys[1] - ys[0]; const scale = a / (c - 1); const b = ys[0] - scale; if (Number.isInteger(scale) && scale !== 0 && fits((n) => scale * c ** n + b)) out.push({ formula: `${scale === 1 ? '' : `${scale}·`}${c}ⁿ ${b < 0 ? '−' : '+'} ${Math.abs(b)}`, note: 'exponential' }); }
  }
  for (const [shift, label] of [[0, 'n!'], [1, '(n+1)!']] as const) if (fits((n) => FACT(n + shift))) out.push({ formula: label, note: 'factorial' });
  if (ys.length >= 4 && ys.slice(2).every((y, i) => y === ys[i] + ys[i + 1])) {
    out.push({ formula: ys[0] === 0 && ys[1] === 1 ? 'F(n) (Fibonacci)' : `a(n) = a(n−1) + a(n−2), a(0) = ${ys[0]}, a(1) = ${ys[1]}`, note: 'Fibonacci recurrence' });
  }
  if (!out.length && fits((n) => (isPrime(n) ? 1 : 0))) out.push({ formula: '1 if n is prime, else 0' });
  return out;
}

/** Guesses for a predicate p(0), p(1), … */
export function guessPredicate(values: (boolean | null)[]): Guess[] {
  const firstNull = values.indexOf(null);
  const bs = (firstNull < 0 ? values : values.slice(0, firstNull)) as boolean[];
  if (bs.length < 3) return [];
  const fits = (f: (n: number) => boolean) => bs.every((b, n) => f(n) === b);
  const out: Guess[] = [];
  const cands: [string, (n: number) => boolean][] = [];
  cands.push(['n is even', (n) => n % 2 === 0], ['n is odd', (n) => n % 2 === 1], ['n is prime', isPrime]);
  for (let k = 0; k < bs.length - 1; k++) cands.push([`n = ${k}`, (n) => n === k], [`n ≠ ${k}`, (n) => n !== k], [`n ≤ ${k}`, (n) => n <= k], [`n ≥ ${k + 1}`, (n) => n >= k + 1]);
  for (let m = 3; m <= 6; m++) for (let r = 0; r < m; r++) cands.push([`n mod ${m} = ${r}`, (n) => n % m === r]);
  cands.push(['always TRUE', () => true], ['always FALSE', () => false]);
  for (const [name, f] of cands) if (fits(f)) out.push({ formula: name });
  return out.slice(0, 3);
}

/** Guesses for a two-argument function, from a table f(m, n). */
export function guessBinary(table: (number | null)[][]): Guess[] {
  const binom = (m: number, n: number) => (n > m ? 0 : Math.round(FACT(m) / (FACT(n) * FACT(m - n))));
  const cands: [string, (m: number, n: number) => number | null][] = [
    ['m + n', (m, n) => m + n], ['m · n', (m, n) => m * n], ['mⁿ', (m, n) => m ** n], ['nᵐ', (m, n) => n ** m],
    ['max(0, m − n)', (m, n) => Math.max(0, m - n)], ['max(0, n − m)', (m, n) => Math.max(0, n - m)],
    ['max(m, n)', Math.max], ['min(m, n)', Math.min], ['m', (m) => m], ['n', (_, n) => n],
    ['⌊m / n⌋', (m, n) => (n === 0 ? null : Math.floor(m / n))], ['m mod n', (m, n) => (n === 0 ? null : m % n)],
    ['C(m, n)', binom], ['m + n + 1', (m, n) => m + n + 1], ['m · n + 1', (m, n) => m * n + 1], ['2m + n', (m, n) => 2 * m + n],
    ['|m − n|', (m, n) => Math.abs(m - n)], ['(m + n)²', (m, n) => (m + n) ** 2], ['m² + n²', (m, n) => m * m + n * n],
  ];
  let known = 0;
  for (const row of table) for (const x of row) if (x !== null) known++;
  if (known < 6) return [];
  return cands.filter(([, f]) => table.every((row, m) => row.every((x, n) => x === null || f(m, n) === null || f(m, n) === x))
    && table.some((row, m) => row.some((x, n) => x !== null && f(m, n) !== null)))
    .map(([formula]) => ({ formula })).slice(0, 3);
}

export function guessBinaryPredicate(table: (boolean | null)[][]): Guess[] {
  const cands: [string, (m: number, n: number) => boolean | null][] = [
    ['m = n', (m, n) => m === n], ['m ≠ n', (m, n) => m !== n], ['m ≤ n', (m, n) => m <= n], ['m < n', (m, n) => m < n],
    ['m ≥ n', (m, n) => m >= n], ['m > n', (m, n) => m > n], ['n divides m', (m, n) => (n === 0 ? null : m % n === 0)],
    ['m + n is even', (m, n) => (m + n) % 2 === 0],
  ];
  return cands.filter(([, f]) => table.every((row, m) => row.every((x, n) => x === null || f(m, n) === null || f(m, n) === x)))
    .map(([formula]) => ({ formula })).slice(0, 3);
}
