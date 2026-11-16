import { type Term, type Lam, maxFree, rewrite, v, lam, app } from './term';

/** Add d to every variable index >= cutoff. */
export function shift(t: Term, d: number, cutoff = 0): Term {
  if (d === 0) return t;
  return rewrite(t, cutoff, (n, c) => {
    if (maxFree(n) <= c) return n;
    if (n.tag === 'var') return n.i >= c ? v(n.i + d) : n;
    return n.tag === 'free' ? n : null;
  });
}

/**
 * Substitute `arg` for index `depth` in t (t sits under `depth` extra binders relative to arg),
 * decrementing indices above it. Used for beta: subst(body, 0, arg).
 */
function subst(t: Term, depth0: number, arg: Term): Term {
  return rewrite(t, depth0, (n, depth) => {
    if (maxFree(n) <= depth) return n;
    if (n.tag === 'var') return n.i === depth ? shift(arg, depth) : n.i > depth ? v(n.i - 1) : n;
    return n.tag === 'free' ? n : null;
  });
}

/** Beta-contract (λ.body) arg. */
export const beta = (fn: Lam, arg: Term): Term => subst(fn.body, 0, arg);

/** Does index `depth` occur free in t? */
export function occurs(t: Term, depth: number): boolean {
  const nodes: Term[] = [t], depths: number[] = [depth];
  while (nodes.length) {
    const n = nodes.pop()!, d = depths.pop()!;
    if (maxFree(n) <= d) continue;
    if (n.tag === 'var') { if (n.i === d) return true; }
    else if (n.tag === 'lam') { nodes.push(n.body); depths.push(d + 1); }
    else if (n.tag === 'app') { nodes.push(n.arg, n.fn); depths.push(d, d); }
  }
  return false;
}

/** Is t an eta-redex λ.(M 0) with 0 not free in M? */
export const isEtaRedex = (t: Term): t is Lam =>
  t.tag === 'lam' && t.body.tag === 'app' && t.body.arg.tag === 'var' && t.body.arg.i === 0 && !occurs(t.body.fn, 0);

export const etaContract = (t: Lam): Term => shift((t.body as { fn: Term }).fn, -1);

/** Contract every η-redex, innermost first (iteratively: terms can be very deep). */
export function etaNormal(t: Term): Term {
  const nodes: Term[] = [t], post: boolean[] = [false], out: Term[] = [];
  while (nodes.length) {
    const n = nodes.pop()!, done = post.pop()!;
    if (!done) {
      if (n.tag === 'var' || n.tag === 'free') { out.push(n); continue; }
      nodes.push(n); post.push(true);
      if (n.tag === 'lam') { nodes.push(n.body); post.push(false); }
      else { nodes.push(n.arg, n.fn); post.push(false, false); }
    } else if (n.tag === 'lam') {
      const b = out.pop()!;
      const l = b === n.body ? n : lam(b, n.hint);
      out.push(isEtaRedex(l) ? etaContract(l) : l);
    } else if (n.tag === 'app') {
      const a = out.pop()!, f = out.pop()!;
      out.push(f === n.fn && a === n.arg ? n : app(f, a));
    }
  }
  return out[0];
}
