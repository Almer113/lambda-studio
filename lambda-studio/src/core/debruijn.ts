import { type Term, type Lam, app, lam, maxFree, v } from './term';

/** Add d to every variable index >= cutoff. */
export function shift(t: Term, d: number, cutoff = 0): Term {
  if (d === 0 || maxFree(t) <= cutoff) return t;
  switch (t.tag) {
    case 'var': return t.i >= cutoff ? v(t.i + d) : t;
    case 'free': return t;
    case 'lam': return lam(shift(t.body, d, cutoff + 1), t.hint);
    case 'app': return app(shift(t.fn, d, cutoff), shift(t.arg, d, cutoff));
  }
}

/**
 * Substitute `arg` for index `depth` in t (t sits under `depth` extra binders relative to arg),
 * decrementing indices above it. Used for beta: subst(body, 0, arg).
 */
function subst(t: Term, depth: number, arg: Term): Term {
  if (maxFree(t) <= depth) return t;
  switch (t.tag) {
    case 'var':
      if (t.i === depth) return shift(arg, depth);
      return t.i > depth ? v(t.i - 1) : t;
    case 'free': return t;
    case 'lam': return lam(subst(t.body, depth + 1, arg), t.hint);
    case 'app': {
      const f = subst(t.fn, depth, arg), a = subst(t.arg, depth, arg);
      return f === t.fn && a === t.arg ? t : app(f, a);
    }
  }
}

/** Beta-contract (λ.body) arg. */
export const beta = (fn: Lam, arg: Term): Term => subst(fn.body, 0, arg);

/** Does index `depth` occur free in t? */
export function occurs(t: Term, depth: number): boolean {
  if (maxFree(t) <= depth) return false;
  switch (t.tag) {
    case 'var': return t.i === depth;
    case 'free': return false;
    case 'lam': return occurs(t.body, depth + 1);
    case 'app': return occurs(t.fn, depth) || occurs(t.arg, depth);
  }
}

/** Is t an eta-redex λ.(M 0) with 0 not free in M? */
export const isEtaRedex = (t: Term): t is Lam =>
  t.tag === 'lam' && t.body.tag === 'app' && t.body.arg.tag === 'var' && t.body.arg.i === 0 && !occurs(t.body.fn, 0);

export const etaContract = (t: Lam): Term => shift((t.body as { fn: Term }).fn, -1);
