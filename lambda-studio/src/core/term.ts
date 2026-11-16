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

// Every traversal below uses an explicit stack, never recursion: terms can be thousands of
// levels deep (the Church numeral 3600 is), and worker threads have small call stacks.

const REC_LIMIT = 2000;
const TOO_DEEP = { tooDeep: true };

/** Bottom-up fold with a per-node memo, safe at any depth. */
function memoFold<R>(t: Term, memo: WeakMap<Term, R>, leaf: (n: Var | Free) => R,
  onLam: (n: Lam, body: R) => R, onApp: (fn: R, arg: R) => R): R {
  const get = (n: Term): R | undefined => (n.tag === 'var' || n.tag === 'free' ? leaf(n) : memo.get(n));
  const r0 = get(t);
  if (r0 !== undefined) return r0;
  // Plain recursion is ~2.5× faster, so use it until the term gets deep, then switch to the
  // explicit stack (whatever the recursion memoized so far is reused).
  const rec = (n: Term, d: number): R => {
    const m = get(n);
    if (m !== undefined) return m;
    if (d > REC_LIMIT) throw TOO_DEEP;
    const r = n.tag === 'lam' ? onLam(n, rec(n.body, d + 1)) : onApp(rec((n as App).fn, d + 1), rec((n as App).arg, d + 1));
    memo.set(n, r);
    return r;
  };
  try { return rec(t, 0); } catch (e) { if (e !== TOO_DEEP) throw e; }
  const stack: Term[] = [t];
  while (stack.length) {
    const n = stack[stack.length - 1];
    if (n.tag === 'lam') {
      const b = get(n.body);
      if (b === undefined) { stack.push(n.body); continue; }
      memo.set(n, onLam(n, b));
    } else if (n.tag === 'app') {
      const f = get(n.fn), a = get(n.arg);
      if (f === undefined || a === undefined) {
        if (a === undefined) stack.push(n.arg);
        if (f === undefined) stack.push(n.fn);
        continue;
      }
      memo.set(n, onApp(f, a));
    }
    stack.pop();
  }
  return memo.get(t)!;
}

const sizeMemo = new WeakMap<Term, number>();
/** Number of nodes. */
export function size(t: Term): number {
  return memoFold(t, sizeMemo, () => 1, (_, b) => 1 + b, (f, a) => 1 + f + a);
}

const maxFreeMemo = new WeakMap<Term, number>();
/** Smallest n such that wrapping t in n lambdas leaves no dangling indices. */
export function maxFree(t: Term): number {
  return memoFold(t, maxFreeMemo, n => (n.tag === 'var' ? n.i + 1 : 0), (_, b) => Math.max(0, b - 1), Math.max);
}

const freeNamesMemo = new WeakMap<Term, ReadonlySet<string>>();
const EMPTY: ReadonlySet<string> = new Set();
/** Named free variables (from unresolved identifiers). */
export function freeNames(t: Term): ReadonlySet<string> {
  return memoFold(t, freeNamesMemo, n => (n.tag === 'free' ? new Set([n.name]) : EMPTY), (_, b) => b,
    (a, b) => (a.size === 0 ? b : b.size === 0 ? a : new Set([...a, ...b])));
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
  return memoFold(t, hashMemo,
    n => (n.tag === 'var' ? mix(0x9e3779b9, n.i + 1) : mix(0x85ebca6b, strHash(n.name))),
    (_, b) => mix(mix(0xc2b2ae35, 7), b),
    (f, a) => mix(mix(0x27d4eb2f, f), a));
}

/** Alpha-equivalence (structural equality of nameless terms). */
export function equal(a0: Term, b0: Term): boolean {
  const stack: Term[] = [a0, b0];
  while (stack.length) {
    const b = stack.pop()!, a = stack.pop()!;
    if (a === b) continue;
    if (a.tag !== b.tag || hash(a) !== hash(b)) return false;
    switch (a.tag) {
      case 'var': if (a.i !== (b as Var).i) return false; break;
      case 'free': if (a.name !== (b as Free).name) return false; break;
      case 'lam': stack.push(a.body, (b as Lam).body); break;
      case 'app': stack.push(a.arg, (b as App).arg, a.fn, (b as App).fn); break;
    }
  }
  return true;
}

/**
 * Rebuild a term top-down with a binder-depth counter, iteratively. `visit(n, depth)` returns
 * the replacement for n, or null to descend into its children. Unchanged subterms keep their
 * identity, so sharing (and the memo tables above) survive.
 */
export function rewrite(t: Term, depth0: number, visit: (n: Term, depth: number) => Term | null): Term {
  const nodes: Term[] = [t], depths: number[] = [depth0], post: boolean[] = [false];
  const out: Term[] = [];
  while (nodes.length) {
    const n = nodes.pop()!, d = depths.pop()!, done = post.pop()!;
    if (!done) {
      const r = visit(n, d);
      if (r !== null) { out.push(r); continue; }
      nodes.push(n); depths.push(d); post.push(true);
      if (n.tag === 'lam') { nodes.push(n.body); depths.push(d + 1); post.push(false); }
      else if (n.tag === 'app') { nodes.push(n.arg, n.fn); depths.push(d, d); post.push(false, false); }
    } else if (n.tag === 'lam') {
      const b = out.pop()!;
      out.push(b === n.body ? n : lam(b, n.hint));
    } else if (n.tag === 'app') {
      const a = out.pop()!, f = out.pop()!;
      out.push(f === n.fn && a === n.arg ? n : app(f, a));
    }
  }
  return out[0];
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

export function replaceAt(t: Term, path: Path, sub: Term): Term {
  const spine: Term[] = [];
  let cur = t;
  for (const c of path) {
    spine.push(cur);
    if (c === 'b' && cur.tag === 'lam') cur = cur.body;
    else if (c === 'f' && cur.tag === 'app') cur = cur.fn;
    else if (c === 'a' && cur.tag === 'app') cur = cur.arg;
    else throw new Error(`Invalid path ${path}`);
  }
  let r = sub;
  for (let k = path.length - 1; k >= 0; k--) {
    const n = spine[k];
    if (n.tag === 'lam') r = lam(r, n.hint);
    else if (n.tag === 'app') r = path[k] === 'f' ? app(r, n.arg) : app(n.fn, r);
  }
  return r;
}

/** Number of lambdas crossed on the way down a path (binder depth at that position). */
export function depthAt(path: Path): number {
  let d = 0;
  for (const c of path) if (c === 'b') d++;
  return d;
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
