// Combinatory logic: λ → combinators (bracket abstraction, several algorithms), combinators → λ,
// and the combinator-based notations (SKI strings, Unlambda, Iota, Jot, binary CL, Lazy K).

import { type Term, app, lam, v, free, lams, apps } from './term';

// ---------------------------------------------------------------------------
// Representation

/** Combinator term. `c` = combinator, `f` = free name, `v` = bound variable (level, only during translation). */
export type CL =
  | { readonly t: 'c'; readonly n: Comb }
  | { readonly t: 'f'; readonly n: string }
  | { readonly t: 'v'; readonly x: number }
  | { readonly t: 'a'; readonly f: CL; readonly a: CL };

export type Comb = 'S' | 'K' | 'I' | 'B' | 'C' | 'W' | "S'" | 'B*' | "C'" | 'ι';

export const COMBINATORS: { name: Comb; def: string; rule: string }[] = [
  { name: 'S', def: 'λx y z.x z (y z)', rule: 'S x y z = x z (y z)' },
  { name: 'K', def: 'λx y.x', rule: 'K x y = x' },
  { name: 'I', def: 'λx.x', rule: 'I x = x' },
  { name: 'B', def: 'λx y z.x (y z)', rule: 'B x y z = x (y z)' },
  { name: 'C', def: 'λx y z.x z y', rule: 'C x y z = x z y' },
  { name: 'W', def: 'λx y.x y y', rule: 'W x y = x y y' },
  { name: "S'", def: 'λc f g x.c (f x) (g x)', rule: "S' c f g x = c (f x) (g x)" },
  { name: 'B*', def: 'λc f g x.c (f (g x))', rule: 'B* c f g x = c (f (g x))' },
  { name: "C'", def: 'λc f g x.c (f x) g', rule: "C' c f g x = c (f x) g" },
  { name: 'ι', def: 'λf.f S K', rule: 'ι f = f S K' },
];

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

/** Translate a λ-term to combinators. Free names stay as free names. */
export function toCL(t: Term, alg: Algorithm = 'turner', limit = 2_000_000): CL {
  if (alg === 'kiselyov') return kiselyov(t)[1];
  let budget = limit;
  const occ = (x: number, m: CL): boolean => (m.t === 'v' ? m.x === x : m.t === 'a' ? occ(x, m.f) || occ(x, m.a) : false);
  const abs = (x: number, m: CL): CL => {
    if (--budget < 0) throw new TooLarge('Translation too large');
    if (alg === 'naive') {
      if (m.t === 'v' && m.x === x) return I;
      if (m.t !== 'a') return A(K, m);
      return As(S, abs(x, m.f), abs(x, m.a));
    }
    if (!occ(x, m)) return A(K, m);
    if (m.t === 'v') return I;
    if (m.t !== 'a') return A(K, m);
    if (m.a.t === 'v' && m.a.x === x && !occ(x, m.f)) return m.f; // η
    const p = abs(x, m.f), q = abs(x, m.a);
    return alg === 'ski' ? As(S, p, q) : mkS(p, q, alg === 'turner+');
  };
  const go = (n: Term, depth: number): CL => {
    switch (n.tag) {
      case 'var': return n.i < depth ? { t: 'v', x: depth - 1 - n.i } : { t: 'f', n: `_${n.i - depth}` };
      case 'free': return { t: 'f', n: n.name };
      case 'app': return A(go(n.fn, depth), go(n.arg, depth));
      case 'lam': return abs(depth, go(n.body, depth + 1));
    }
  };
  return go(t, 0);
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
function kiselyov(t: Term): [number, CL] {
  const f = ([a, x]: [number, CL], [b, y]: [number, CL]): CL => {
    if (a === 0 && b === 0) return A(x, y);
    if (a === 0 && b === 1 && isC(y, 'I')) return x; // η: x (I v) = x v
    if (a === 0) return f([0, A(Bc, x)], [b - 1, y]);
    if (b === 0) return f([a - 1, f([0, Cc], [a - 1, x])], [0, y]);
    return f([a - 1, f([0, S], [a - 1, x])], [b - 1, y]);
  };
  const go = (n: Term): [number, CL] => {
    switch (n.tag) {
      case 'var': {
        let r: [number, CL] = [1, I];
        for (let k = 0; k < n.i; k++) r = [r[0] + 1, f([0, K], r)];
        return r;
      }
      case 'free': return [0, { t: 'f', n: n.name }];
      case 'app': { const x = go(n.fn), y = go(n.arg); return [Math.max(x[0], y[0]), f(x, y)]; }
      case 'lam': { const [k, e] = go(n.body); return k === 0 ? [0, A(K, e)] : [k - 1, e]; }
    }
  };
  const r = go(t);
  // open terms: remaining context becomes free index names
  let [k, e] = r;
  for (let i = k - 1; i >= 0; i--) e = A(e, { t: 'f', n: `_${i}` });
  return [0, e];
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
  switch (c.t) {
    case 'c': return combTerm(c.n);
    case 'f': return /^_\d+$/.test(c.n) ? v(Number(c.n.slice(1))) : free(c.n);
    case 'v': throw new Error('unexpected bound variable');
    case 'a': return app(fromCL(c.f), fromCL(c.a));
  }
}

/** Rewrite every combinator into S and K only (I = S K K), as needed by Jot / Iota / binary CL / Unlambda. */
export function toSK(c: CL, keepI = false): CL {
  switch (c.t) {
    case 'c':
      if (c.n === 'S' || c.n === 'K') return c;
      if (c.n === 'I') return keepI ? c : As(S, K, K);
      return toSK(toCL(combTerm(c.n), 'ski'), keepI);
    case 'a': return A(toSK(c.f, keepI), toSK(c.a, keepI));
    default: return c;
  }
}

// ---------------------------------------------------------------------------
// Printers

export type CLStyle = 'ski' | 'unlambda' | 'iota' | 'jot' | 'bcl' | 'lazyk';

export class NotationError extends Error {}

function noFree(c: CL, style: string): void {
  if (c.t === 'f') throw new NotationError(`${style} has no free variables (found '${c.n}')`);
  if (c.t === 'a') { noFree(c.f, style); noFree(c.a, style); }
}

/** SKI string: juxtaposition, left-associative; compact when every atom is a single letter. */
export function printSKI(c: CL): string {
  let compact = true;
  // compact (SKK) only when every atom is a one-letter combinator; otherwise space-separated
  const scan = (x: CL) => { if (x.t === 'a') { scan(x.f); scan(x.a); } else if (x.t !== 'c' || x.n.length > 1 || x.n === 'ι') compact = false; };
  scan(c);
  const parts: string[] = [];
  const emit = (x: CL, argPos: boolean) => {
    if (x.t === 'a') {
      if (argPos) parts.push('(');
      emit(x.f, false);
      if (!compact) parts.push(' ');
      emit(x.a, true);
      if (argPos) parts.push(')');
    } else parts.push(x.t === 'c' ? x.n : x.t === 'f' ? x.n : `v${x.x}`);
  };
  emit(c, false);
  return parts.join('');
}

export function printCL(c: CL, style: CLStyle): string {
  switch (style) {
    case 'ski': return printSKI(c);
    case 'lazyk': { noFree(c, 'Lazy K'); return printSKI(toSK(c, true)); }
    case 'unlambda': {
      noFree(c, 'Unlambda');
      const out: string[] = [];
      const emit = (x: CL) => { if (x.t === 'a') { out.push('`'); emit(x.f); emit(x.a); } else out.push((x as { n: string }).n.toLowerCase()); };
      emit(toSK(c, true));
      return out.join('');
    }
    case 'iota': {
      noFree(c, 'Iota');
      const ATOM: Record<string, string> = { I: '*ii', K: '*i*i*ii', S: '*i*i*i*ii' };
      const out: string[] = [];
      const emit = (x: CL) => { if (x.t === 'a') { out.push('*'); emit(x.f); emit(x.a); } else out.push(ATOM[(x as { n: string }).n]); };
      emit(toSK(c, true));
      return out.join('');
    }
    case 'jot': {
      noFree(c, 'Jot');
      // [K] = 11100, [S] = 11111000, [F A] = 1 [F] [A]
      const out: string[] = [];
      const emit = (x: CL) => { if (x.t === 'a') { out.push('1'); emit(x.f); emit(x.a); } else out.push((x as { n: string }).n === 'K' ? '11100' : '11111000'); };
      emit(toSK(c));
      return out.join('');
    }
    case 'bcl': {
      noFree(c, 'Binary combinatory logic');
      const out: string[] = [];
      const emit = (x: CL) => { if (x.t === 'a') { out.push('1'); emit(x.f); emit(x.a); } else out.push((x as { n: string }).n === 'K' ? '00' : '01'); };
      emit(toSK(c));
      return out.join('');
    }
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
  const atom = (): CL | null => {
    skip();
    if (i >= src.length) return null;
    const c = src[i];
    if (c === '(') {
      const start = i; i++;
      const e = seq();
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
  };
  const seq = (): CL | null => {
    let e: CL | null = null;
    for (;;) {
      const save = i;
      const a = atom();
      if (!a) { i = save; return e; }
      e = e ? A(e, a) : a;
    }
  };
  const e = seq();
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
  const go = (): CL => {
    skip();
    if (i >= src.length) throw new ParseFail(`${name}: unexpected end of input`, src.length, src.length);
    const c = src[i];
    if (c === appChar) { i++; const f = go(); const a = go(); return A(f, a); }
    const at = atoms[c];
    if (!at) throw new ParseFail(`${name}: unexpected '${c}'`, i, i + 1);
    i++;
    return at;
  };
  const e = go();
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
  const go = (): CL => {
    if (k >= bits.length) throw new ParseFail('Binary CL: unexpected end of input', src.length, src.length);
    if (bits[k].b === '1') { k++; const f = go(); const a = go(); return A(f, a); }
    if (k + 1 >= bits.length) throw new ParseFail('Binary CL: unexpected end of input', src.length, src.length);
    const r = bits[k + 1].b === '0' ? K : S;
    k += 2;
    return r;
  };
  const e = go();
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
