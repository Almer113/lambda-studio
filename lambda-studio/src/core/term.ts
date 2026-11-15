// Core term representation: nameless (de Bruijn, 0-based) with optional name hints.
// Terms are immutable plain objects, so they can be shared, memoized and posted to workers.

export type Var = { readonly tag: 'var'; readonly i: number };
export type Free = { readonly tag: 'free'; readonly name: string };
export type Lam = { readonly tag: 'lam'; readonly body: Term; readonly hint?: string };
export type App = { readonly tag: 'app'; readonly fn: Term; readonly arg: Term };
export type Term = Var | Free | Lam | App;

export const v = (i: number): Var => ({ tag: 'var', i });
export const free = (name: string): Free => ({ tag: 'free', name });
export const lam = (body: Term, hint?: string): Lam =>
  hint === undefined ? { tag: 'lam', body } : { tag: 'lam', body, hint };
export const app = (fn: Term, arg: Term): App => ({ tag: 'app', fn, arg });
export const apps = (f: Term, ...args: Term[]): Term => args.reduce<Term>((acc, a) => app(acc, a), f);
/** n nested lambdas around body; hints listed outermost first. */
export const lams = (n: number, body: Term, hints: (string | undefined)[] = []): Term => {
  let t = body;
  for (let k = n - 1; k >= 0; k--) t = lam(t, hints[k]);
  return t;
};

// ---------------------------------------------------------------------------
// Memoized structural properties (safe because terms are immutable).

const sizeMemo = new WeakMap<Term, number>();
/** Number of nodes. */
export function size(t: Term): number {
  if (t.tag === 'var' || t.tag === 'free') return 1;
  const m = sizeMemo.get(t);
  if (m !== undefined) return m;
  const s = t.tag === 'lam' ? 1 + size(t.body) : 1 + size(t.fn) + size(t.arg);
  sizeMemo.set(t, s);
  return s;
}

const maxFreeMemo = new WeakMap<Term, number>();
/** Smallest n such that wrapping t in n lambdas leaves no dangling indices. */
export function maxFree(t: Term): number {
  switch (t.tag) {
    case 'var': return t.i + 1;
    case 'free': return 0;
    default: {
      const m = maxFreeMemo.get(t);
      if (m !== undefined) return m;
      const r = t.tag === 'lam' ? Math.max(0, maxFree(t.body) - 1) : Math.max(maxFree(t.fn), maxFree(t.arg));
      maxFreeMemo.set(t, r);
      return r;
    }
  }
}

const freeNamesMemo = new WeakMap<Term, ReadonlySet<string>>();
const EMPTY: ReadonlySet<string> = new Set();
/** Named free variables (from unresolved identifiers). */
export function freeNames(t: Term): ReadonlySet<string> {
  switch (t.tag) {
    case 'var': return EMPTY;
    case 'free': return new Set([t.name]);
    default: {
      const m = freeNamesMemo.get(t);
      if (m) return m;
      let r: ReadonlySet<string>;
      if (t.tag === 'lam') r = freeNames(t.body);
      else {
        const a = freeNames(t.fn), b = freeNames(t.arg);
        r = a.size === 0 ? b : b.size === 0 ? a : new Set([...a, ...b]);
      }
      freeNamesMemo.set(t, r);
      return r;
    }
  }
}

export const isClosed = (t: Term) => maxFree(t) === 0 && freeNames(t).size === 0;

const hashMemo = new WeakMap<Term, number>();
const mix = (h: number, x: number) => Math.imul(h ^ x, 0x01000193) >>> 0;
function strHash(s: string): number {
  let h = 0x811c9dc5;
  for (let k = 0; k < s.length; k++) h = mix(h, s.charCodeAt(k));
  return h;
}
/** Structural hash (alpha-invariant, ignores hints). */
export function hash(t: Term): number {
  switch (t.tag) {
    case 'var': return mix(0x9e3779b9, t.i + 1);
    case 'free': return mix(0x85ebca6b, strHash(t.name));
    default: {
      const m = hashMemo.get(t);
      if (m !== undefined) return m;
      const h = t.tag === 'lam' ? mix(mix(0xc2b2ae35, 7), hash(t.body)) : mix(mix(0x27d4eb2f, hash(t.fn)), hash(t.arg));
      hashMemo.set(t, h);
      return h;
    }
  }
}

/** Alpha-equivalence (structural equality of nameless terms). */
export function equal(a: Term, b: Term): boolean {
  if (a === b) return true;
  if (a.tag !== b.tag || hash(a) !== hash(b)) return false;
  switch (a.tag) {
    case 'var': return a.i === (b as Var).i;
    case 'free': return a.name === (b as Free).name;
    case 'lam': return equal(a.body, (b as Lam).body);
    case 'app': return equal(a.fn, (b as App).fn) && equal(a.arg, (b as App).arg);
  }
}

// ---------------------------------------------------------------------------
// Paths: a string of steps from the root. 'f' = app.fn, 'a' = app.arg, 'b' = lam.body.

export type Path = string;

export function getAt(t: Term, path: Path): Term {
  let cur = t;
  for (const c of path) {
    if (c === 'b' && cur.tag === 'lam') cur = cur.body;
    else if (c === 'f' && cur.tag === 'app') cur = cur.fn;
    else if (c === 'a' && cur.tag === 'app') cur = cur.arg;
    else throw new Error(`Invalid path ${path}`);
  }
  return cur;
}

export function replaceAt(t: Term, path: Path, sub: Term, k = 0): Term {
  if (k === path.length) return sub;
  const c = path[k];
  if (c === 'b' && t.tag === 'lam') return lam(replaceAt(t.body, path, sub, k + 1), t.hint);
  if (c === 'f' && t.tag === 'app') return app(replaceAt(t.fn, path, sub, k + 1), t.arg);
  if (c === 'a' && t.tag === 'app') return app(t.fn, replaceAt(t.arg, path, sub, k + 1));
  throw new Error(`Invalid path ${path}`);
}

/** Number of lambdas crossed on the way down a path (binder depth at that position). */
export function depthAt(path: Path): number {
  let d = 0;
  for (const c of path) if (c === 'b') d++;
  return d;
}

/** For a variable at `path` with index i, the path of the lambda that binds it (or null if free). */
export function binderPath(path: Path, i: number): Path | null {
  let remaining = i;
  for (let k = path.length - 1; k >= 0; k--) {
    if (path[k] === 'b') {
      if (remaining === 0) return path.slice(0, k);
      remaining--;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Counts and metrics

export interface Counts { lams: number; apps: number; vars: number; depth: number }
export function counts(t: Term): Counts {
  const c: Counts = { lams: 0, apps: 0, vars: 0, depth: 0 };
  const stack: [Term, number][] = [[t, 0]];
  while (stack.length) {
    const [n, d] = stack.pop()!;
    if (n.tag === 'var' || n.tag === 'free') { c.vars++; if (d > c.depth) c.depth = d; }
    else if (n.tag === 'lam') { c.lams++; stack.push([n.body, d + 1]); }
    else { c.apps++; stack.push([n.fn, d + 1], [n.arg, d + 1]); }
  }
  return c;
}
