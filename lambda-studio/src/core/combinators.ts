// Combinatory logic: λ → combinators (bracket abstraction, several algorithms), combinators → λ,
// and the combinator-based notations (SKI strings, Unlambda, Iota, Jot, binary CL, Lazy K).

import { type Term, app, lam, v, free, lams, apps } from './term';
import { run, call, type Rec } from './trampoline';

// ---------------------------------------------------------------------------
// Representation

/** Combinator term. `c` = combinator, `f` = free name, `v` = bound variable (level, only during translation). */
export type CL =
  | { readonly t: 'c'; readonly n: Comb }
  | { readonly t: 'f'; readonly n: string }
  | { readonly t: 'v'; readonly x: number }
  | { readonly t: 'a'; readonly f: CL; readonly a: CL };

export type Comb = 'S' | 'K' | 'I' | 'B' | 'C' | 'W' | "S'" | 'B*' | "C'" | 'ι';

export const C = (n: Comb): CL => ({ t: 'c', n });
export const A = (f: CL, a: CL): CL => ({ t: 'a', f, a });
const As = (f: CL, ...xs: CL[]) => xs.reduce(A, f);
const S = C('S'), K = C('K'), I = C('I'), Bc = C('B'), Cc = C('C');

export function clSize(c: CL): number {
  let n = 0;
  const stack = [c];
  while (stack.length) { const x = stack.pop()!; if (x.t === 'a') stack.push(x.f, x.a); else n++; }
  return n; // number of atoms
}

const isC = (c: CL, n: Comb) => c.t === 'c' && c.n === n;

// ---------------------------------------------------------------------------
// λ → CL

export type Algorithm = 'naive' | 'ski' | 'turner' | 'turner+' | 'kiselyov';

export const ALGORITHMS: { id: Algorithm; name: string; short: string; description: string; basis: string }[] = [
  { id: 'naive', name: 'Naive SKI', short: 'naive', basis: 'S K I', description: 'Schönfinkel/Curry: [x]x = I, [x]y = K y, [x](M N) = S [x]M [x]N. Simple, but the output grows fast.' },
  { id: 'ski', name: 'SKI + K/η', short: 'SKI', basis: 'S K I', description: 'Adds [x]M = K M when x is not in M, and [x](M x) = M (η).' },
  { id: 'turner', name: 'Turner SKIBC', short: 'Turner', basis: 'S K I B C', description: 'Turner (1979): uses B and C when only one side mentions x.' },
  { id: 'turner+', name: "Turner + S′ B* C′", short: 'Turner+', basis: "S K I B C S' B* C'", description: "Turner's long-reach combinators S′, B*, C′ keep the output linear in more cases." },
  { id: 'kiselyov', name: 'Kiselyov', short: 'Kiselyov', basis: 'S K I B C', description: 'Kiselyov (2018), "λ to SKI, semantically": compositional, works on de Bruijn indices.' },
];

export class TooLarge extends Error {}

const levelMemo = new WeakMap<CL, number>();
/** Highest bound-variable level in c (-1 if none); memoized and iterative. */
function maxLevel(c: CL): number {
  const get = (x: CL): number | undefined => (x.t === 'v' ? x.x : x.t === 'a' ? levelMemo.get(x) : -1);
  const r0 = get(c);
  if (r0 !== undefined) return r0;
  const stack: CL[] = [c];
  while (stack.length) {
    const x = stack[stack.length - 1] as Extract<CL, { t: 'a' }>;
    const f = get(x.f), a = get(x.a);
    if (f === undefined || a === undefined) {
      if (a === undefined) stack.push(x.a);
      if (f === undefined) stack.push(x.f);
      continue;
    }
    levelMemo.set(x, Math.max(f, a));
    stack.pop();
  }
  return levelMemo.get(c)!;
}

/**
 * Translate a λ-term to combinators. Free names stay as free names. Everything here is iterative
 * (terms and their translations can be thousands of levels deep).
 */
export function toCL(t: Term, alg: Algorithm = 'turner', limit = 2_000_000): CL {
  if (alg === 'kiselyov') return kiselyov(t, limit)[1];
  let budget = limit;
  // Abstraction runs innermost-first, so when abstracting level x every variable left in the term
  // has level <= x: "x occurs in m" is "the highest level in m is x".
  const occ = (x: number, m: CL): boolean => maxLevel(m) >= x;
  const abs = (x: number, m0: CL): CL => {
    const work: CL[] = [m0], post: boolean[] = [false], out: CL[] = [];
    while (work.length) {
      const m = work.pop()!;
      if (post.pop()) {
        const q = out.pop()!, p = out.pop()!;
        out.push(alg === 'naive' || alg === 'ski' ? As(S, p, q) : mkS(p, q, alg === 'turner+'));
        continue;
      }
      if (--budget < 0) throw new TooLarge('Translation too large');
      if (alg === 'naive') {
        if (m.t === 'v' && m.x === x) { out.push(I); continue; }
        if (m.t !== 'a') { out.push(A(K, m)); continue; }
      } else {
        if (!occ(x, m)) { out.push(A(K, m)); continue; }
        if (m.t === 'v') { out.push(I); continue; }
        if (m.t !== 'a') { out.push(A(K, m)); continue; }
        if (m.a.t === 'v' && m.a.x === x && !occ(x, m.f)) { out.push(m.f); continue; } // η
      }
      work.push(m, m.a, m.f);
      post.push(true, false, false);
    }
    return out[0];
  };
  const nodes: Term[] = [t], depths: number[] = [0], post: boolean[] = [false], out: CL[] = [];
  while (nodes.length) {
    const n = nodes.pop()!, depth = depths.pop()!;
    if (post.pop()) {
      if (n.tag === 'lam') out.push(abs(depth, out.pop()!));
      else { const a = out.pop()!, f = out.pop()!; out.push(A(f, a)); }
      continue;
    }
    switch (n.tag) {
      case 'var': out.push(n.i < depth ? { t: 'v', x: depth - 1 - n.i } : { t: 'f', n: `_${n.i - depth}` }); break;
      case 'free': out.push({ t: 'f', n: n.name }); break;
      case 'app': nodes.push(n, n.arg, n.fn); depths.push(depth, depth, depth); post.push(true, false, false); break;
      case 'lam': nodes.push(n, n.body); depths.push(depth, depth + 1); post.push(true, false); break;
    }
  }
  return out[0];
}

/** Turner's optimisations of S p q. */
function mkS(p: CL, q: CL, plus: boolean): CL {
  const kArg = (c: CL) => (c.t === 'a' && isC(c.f, 'K') ? c.a : null);
  const bArgs = (c: CL) => (c.t === 'a' && c.f.t === 'a' && isC(c.f.f, 'B') ? [c.f.a, c.a] as const : null);
  const kp = kArg(p), kq = kArg(q);
  if (kp && kq) return A(K, A(kp, kq));
  if (kp && isC(q, 'I')) return kp;
  if (plus && kp) { const b = bArgs(q); if (b) return As(C('B*'), kp, b[0], b[1]); }
  if (kp) return As(Bc, kp, q);
  if (plus && kq) { const b = bArgs(p); if (b) return As(C("C'"), b[0], b[1], kq); }
  if (kq) return As(Cc, p, kq);
  if (plus) { const b = bArgs(p); if (b) return As(C("S'"), b[0], b[1], q); }
  return As(S, p, q);
}

/** Kiselyov's compositional translation; returns [context size, combinator term]. */
function kiselyov(t: Term, limit: number): [number, CL] {
  // every application node built counts against the budget, as in the other algorithms
  let budget = limit;
  const mk = (x: CL, y: CL): CL => { if (--budget < 0) throw new TooLarge('Translation too large'); return A(x, y); };
  // The recursive definition with its tail calls turned into a loop; the inner calls start with
  // a = 0 and so never recurse further.
  const f = (a: number, x: CL, b: number, y: CL): CL => {
    for (;;) {
      if (a === 0 && b === 0) return mk(x, y);
      if (a === 0 && b === 1 && isC(y, 'I')) return x; // η: x (I v) = x v
      if (a === 0) { x = mk(Bc, x); b--; continue; }
      if (b === 0) { x = f(0, Cc, a - 1, x); a--; continue; }
      x = f(0, S, a - 1, x); a--; b--;
    }
  };
  const nodes: Term[] = [t], post: boolean[] = [false], out: [number, CL][] = [];
  while (nodes.length) {
    const n = nodes.pop()!;
    if (post.pop()) {
      if (n.tag === 'lam') { const [k, e] = out.pop()!; out.push(k === 0 ? [0, mk(K, e)] : [k - 1, e]); }
      else { const y = out.pop()!, x = out.pop()!; out.push([Math.max(x[0], y[0]), f(x[0], x[1], y[0], y[1])]); }
      continue;
    }
    switch (n.tag) {
      case 'var': {
        let r: [number, CL] = [1, I];
        for (let k = 0; k < n.i; k++) r = [r[0] + 1, f(0, K, r[0], r[1])];
        out.push(r);
        break;
      }
      case 'free': out.push([0, { t: 'f', n: n.name }]); break;
      case 'app': nodes.push(n, n.arg, n.fn); post.push(true, false, false); break;
      case 'lam': nodes.push(n, n.body); post.push(true, false); break;
    }
  }
  // open terms: remaining context becomes free index names
  let [k, e] = out[0];
  for (let i = k - 1; i >= 0; i--) e = A(e, { t: 'f', n: `_${i}` });
  return [0, e];
}

/** Rebuild a CL term bottom-up without recursion: `leaf` maps atoms, `node` combines applications. */
function mapCL<R>(c: CL, leaf: (x: Exclude<CL, { t: 'a' }>) => R, node: (f: R, a: R) => R): R {
  const work: CL[] = [c], post: boolean[] = [false], out: R[] = [];
  while (work.length) {
    const x = work.pop()!;
    if (post.pop()) { const a = out.pop()!, f = out.pop()!; out.push(node(f, a)); continue; }
    if (x.t === 'a') { work.push(x, x.a, x.f); post.push(true, false, false); }
    else out.push(leaf(x));
  }
  return out[0];
}

/** Visit a CL term in prefix order (each application before its function and argument). */
function prefix(c: CL, onApp: () => void, onAtom: (x: Exclude<CL, { t: 'a' }>) => void): void {
  const work: CL[] = [c];
  while (work.length) {
    const x = work.pop()!;
    if (x.t === 'a') { onApp(); work.push(x.a, x.f); } else onAtom(x);
  }
}

// ---------------------------------------------------------------------------
// CL → λ

let combTerms: Map<Comb, Term> | null = null;
function combTerm(n: Comb): Term {
  if (!combTerms) {
    const m = new Map<Comb, Term>();
    const Sx = lams(3, apps(v(2), v(0), app(v(1), v(0))), ['x', 'y', 'z']);
    const Kx = lams(2, v(1), ['x', 'y']);
    m.set('S', Sx); m.set('K', Kx); m.set('I', lam(v(0), 'x'));
    m.set('B', lams(3, app(v(2), app(v(1), v(0))), ['x', 'y', 'z']));
    m.set('C', lams(3, apps(v(2), v(0), v(1)), ['x', 'y', 'z']));
    m.set('W', lams(2, apps(v(1), v(0), v(0)), ['x', 'y']));
    m.set("S'", lams(4, apps(v(3), app(v(2), v(0)), app(v(1), v(0))), ['c', 'f', 'g', 'x']));
    m.set('B*', lams(4, app(v(3), app(v(2), app(v(1), v(0)))), ['c', 'f', 'g', 'x']));
    m.set("C'", lams(4, apps(v(3), app(v(2), v(0)), v(1)), ['c', 'f', 'g', 'x']));
    m.set('ι', lam(apps(v(0), Sx, Kx), 'f'));
    combTerms = m;
  }
  return combTerms.get(n)!;
}

/** Expand combinators into their λ-definitions (the result still has to be reduced). */
export function fromCL(c: CL): Term {
  return mapCL<Term>(c, (x) => {
    switch (x.t) {
      case 'c': return combTerm(x.n);
      case 'f': return /^_\d+$/.test(x.n) ? v(Number(x.n.slice(1))) : free(x.n);
      case 'v': throw new Error('unexpected bound variable');
    }
  }, app);
}

const skMemo = new Map<string, CL>();
/** Rewrite every combinator into S and K only (I = S K K), as needed by Jot / Iota / binary CL / Unlambda. */
export function toSK(c: CL, keepI = false): CL {
  return mapCL<CL>(c, (x) => {
    if (x.t !== 'c' || x.n === 'S' || x.n === 'K') return x;
    if (x.n === 'I') return keepI ? x : As(S, K, K);
    const key = x.n + (keepI ? '+I' : '');
    let r = skMemo.get(key);
    if (!r) { r = toSK(toCL(combTerm(x.n), 'ski'), keepI); skMemo.set(key, r); }
    return r;
  }, A);
}

// ---------------------------------------------------------------------------
// Printers

export type CLStyle = 'ski' | 'unlambda' | 'iota' | 'jot' | 'bcl' | 'lazyk';

export class NotationError extends Error {}

function noFree(c: CL, style: string): void {
  prefix(c, () => {}, (x) => { if (x.t === 'f') throw new NotationError(`${style} has no free variables (found '${x.n}')`); });
}

/** SKI string: juxtaposition, left-associative; compact when every atom is a single letter. */
export function printSKI(c: CL): string {
  // compact (SKK) only when every atom is a one-letter combinator; otherwise space-separated
  let compact = true;
  prefix(c, () => {}, (x) => { if (x.t !== 'c' || x.n.length > 1 || x.n === 'ι') compact = false; });
  const parts: string[] = [];
  const work: (CL | string)[] = [c], argPos: boolean[] = [false];
  while (work.length) {
    const x = work.pop()!, inArg = argPos.pop()!;
    if (typeof x === 'string') { parts.push(x); continue; }
    if (x.t === 'a') {
      // pushed in reverse of:  '(' f ' ' a ')'
      if (inArg) { work.push(')'); argPos.push(false); }
      work.push(x.a); argPos.push(true);
      if (!compact) { work.push(' '); argPos.push(false); }
      work.push(x.f); argPos.push(false);
      if (inArg) { work.push('('); argPos.push(false); }
    } else parts.push(x.t === 'c' ? x.n : x.t === 'f' ? x.n : `v${x.x}`);
  }
  return parts.join('');
}

/** Prefix notation: `app` before each application, `atom(name)` for each combinator. */
function printPrefix(c: CL, app: string, atom: (name: string) => string): string {
  const out: string[] = [];
  prefix(c, () => out.push(app), (x) => out.push(atom((x as { n: string }).n)));
  return out.join('');
}

export function printCL(c: CL, style: CLStyle): string {
  switch (style) {
    case 'ski': return printSKI(c);
    case 'lazyk': { noFree(c, 'Lazy K'); return printSKI(toSK(c, true)); }
    case 'unlambda': { noFree(c, 'Unlambda'); return printPrefix(toSK(c, true), '`', (n) => n.toLowerCase()); }
    case 'iota': {
      noFree(c, 'Iota');
      const ATOM: Record<string, string> = { I: '*ii', K: '*i*i*ii', S: '*i*i*i*ii' };
      return printPrefix(toSK(c, true), '*', (n) => ATOM[n]);
    }
    // [K] = 11100, [S] = 11111000, [F A] = 1 [F] [A]
    case 'jot': { noFree(c, 'Jot'); return printPrefix(toSK(c), '1', (n) => (n === 'K' ? '11100' : '11111000')); }
    case 'bcl': { noFree(c, 'Binary combinatory logic'); return printPrefix(toSK(c), '1', (n) => (n === 'K' ? '00' : '01')); }
  }
}

// ---------------------------------------------------------------------------
// Parsers (each returns a CL term; positions are reported via ParseFail)

export class ParseFail extends Error {
  constructor(message: string, public from: number, public to: number) { super(message); }
}

const COMB_LETTERS = 'SKIBCW';

/** SKI / combinator-calculus strings: `S(KS)K`, `S K K`, `S' B* x`, lowercase `skk` (Lazy K CC style). */
export function parseSKI(src: string): CL {
  let i = 0;
  const skip = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] === '#' || src.startsWith('--', i)) { while (i < src.length && src[i] !== '\n') i++; continue; }
      return;
    }
  };
  function* atom(): Rec<CL | null> {
    skip();
    if (i >= src.length) return null;
    const c = src[i];
    if (c === '(') {
      const start = i; i++;
      const e = yield* call(seq());
      skip();
      if (src[i] !== ')') throw new ParseFail("Expected ')'", start, i);
      i++;
      if (!e) throw new ParseFail('Empty parentheses', start, i);
      return e;
    }
    if (c === 'ι') { i++; return C('ι'); }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      const up = word.toUpperCase();
      // a run of combinator letters is split into single combinators: SKK → S K K
      if ([...up].every((ch) => COMB_LETTERS.includes(ch)) && (word === up || word === word.toLowerCase())) {
        const first = up[0] as Comb;
        i++;
        if (first === 'S' && src[i] === "'" ) { i++; return C("S'"); }
        if (first === 'C' && src[i] === "'") { i++; return C("C'"); }
        if (first === 'B' && src[i] === '*') { i++; return C('B*'); }
        return C(first);
      }
      i = j;
      return { t: 'f', n: word };
    }
    return null;
  }
  function* seq(): Rec<CL | null> {
    let e: CL | null = null;
    for (;;) {
      const save = i;
      const a = yield* call(atom());
      if (!a) { i = save; return e; }
      e = e ? A(e, a) : a;
    }
  }
  const e = run(seq());
  skip();
  if (i < src.length) throw new ParseFail(`Unexpected '${src[i]}'`, i, i + 1);
  if (!e) throw new ParseFail('Empty input', 0, src.length);
  return e;
}

/** Prefix notations: Unlambda (` app, s k i) and Iota (* app, i = ι). */
function parsePrefix(src: string, appChar: string, atoms: Record<string, CL>, name: string): CL {
  let i = 0;
  const skip = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
      return;
    }
  };
  function* go(): Rec<CL> {
    skip();
    if (i >= src.length) throw new ParseFail(`${name}: unexpected end of input`, src.length, src.length);
    const c = src[i];
    if (c === appChar) { i++; const f = yield* call(go()); const a = yield* call(go()); return A(f, a); }
    const at = atoms[c];
    if (!at) throw new ParseFail(`${name}: unexpected '${c}'`, i, i + 1);
    i++;
    return at;
  }
  const e = run(go());
  skip();
  if (i < src.length) throw new ParseFail(`${name}: trailing input`, i, src.length);
  return e;
}

export const parseUnlambda = (src: string) => parsePrefix(src, '`', { s: S, k: K, i: I, S, K, I }, 'Unlambda');
export const parseIota = (src: string) => parsePrefix(src, '*', { i: C('ι') }, 'Iota');

/** Jot: [] = I, [w0] = [w] S K, [w1] = S (K [w]). */
export function parseJot(src: string): CL {
  let w: CL = I;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (/\s/.test(c)) continue;
    if (c === '0') w = As(w, S, K);
    else if (c === '1') w = A(S, A(K, w));
    else throw new ParseFail(`Jot: unexpected '${c}'`, i, i + 1);
  }
  return w;
}

/** Binary combinatory logic (Tromp): 00 = K, 01 = S, 1 F A = application. */
export function parseBCL(src: string): CL {
  const bits: { b: string; at: number }[] = [];
  for (let i = 0; i < src.length; i++) if (src[i] === '0' || src[i] === '1') bits.push({ b: src[i], at: i }); else if (!/\s/.test(src[i])) throw new ParseFail(`Unexpected '${src[i]}'`, i, i + 1);
  let k = 0;
  function* go(): Rec<CL> {
    if (k >= bits.length) throw new ParseFail('Binary CL: unexpected end of input', src.length, src.length);
    if (bits[k].b === '1') { k++; const f = yield* call(go()); const a = yield* call(go()); return A(f, a); }
    if (k + 1 >= bits.length) throw new ParseFail('Binary CL: unexpected end of input', src.length, src.length);
    const r = bits[k + 1].b === '0' ? K : S;
    k += 2;
    return r;
  }
  const e = run(go());
  if (k < bits.length) throw new ParseFail(`Binary CL: ${bits.length - k} trailing bit(s)`, bits[k].at, src.length);
  return e;
}

/** Lazy K: accepts its combinator-calculus, Unlambda, Iota and Jot styles (one style per program). */
export function parseLazyK(src: string): CL {
  const s = src.replace(/#.*$/gm, '').trim();
  if (/^[01\s]*$/.test(s)) return parseJot(src);
  if (s.startsWith('`')) return parseUnlambda(src);
  if (s.startsWith('*')) return parseIota(src);
  return parseSKI(src);
}
