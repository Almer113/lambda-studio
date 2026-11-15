// Fast normalizer: lazy normalization-by-evaluation with sharing (call-by-need).
// Computes the same normal form as normal-order reduction (when one exists), much faster,
// but does not produce a step-by-step trace.

import { type Term, app, lam, v, free } from './term';

interface Thunk { val?: Val; term?: Term; env?: Env }
type Env = { head: Thunk; tail: Env } | null;
type Val =
  | { k: 'lam'; body: Term; env: Env; hint?: string }
  | { k: 'neu'; head: number | string; spine: Thunk[] };

class OutOfFuel extends Error {}

export interface NormalizeResult {
  term: Term | null;
  betas: number;
  status: 'normal' | 'fuel' | 'error';
  message?: string;
}

export function normalize(t: Term, fuel = 1_000_000): NormalizeResult {
  let betas = 0;
  const lookup = (env: Env, i: number): Thunk => {
    let e = env;
    for (let k = 0; k < i && e; k++) e = e.tail;
    if (!e) throw new Error('Unbound index');
    return e.head;
  };
  const force = (th: Thunk): Val => {
    if (th.val) return th.val;
    const r = evaluate(th.term!, th.env!);
    th.val = r; th.term = undefined; th.env = undefined;
    return r;
  };
  const evaluate = (t: Term, env: Env): Val => {
    for (;;) {
      switch (t.tag) {
        case 'var': return force(lookup(env, t.i));
        case 'free': return { k: 'neu', head: t.name, spine: [] };
        case 'lam': return { k: 'lam', body: t.body, env, hint: t.hint };
        case 'app': {
          const f = evaluate(t.fn, env);
          const arg: Thunk = { term: t.arg, env };
          if (f.k === 'lam') {
            if (++betas > fuel) throw new OutOfFuel();
            t = f.body; env = { head: arg, tail: f.env };
            continue; // tail call
          }
          return { k: 'neu', head: f.head, spine: [...f.spine, arg] };
        }
      }
    }
  };
  const quote = (val: Val, level: number): Term => {
    if (val.k === 'lam') {
      const x: Thunk = { val: { k: 'neu', head: level, spine: [] } };
      return lam(quote(evaluate(val.body, { head: x, tail: val.env }), level + 1), val.hint);
    }
    let h: Term = typeof val.head === 'number' ? v(level - val.head - 1) : free(val.head);
    for (const a of val.spine) h = app(h, quote(force(a), level));
    return h;
  };
  try {
    // Free indices at top level are treated as neutral variables beyond the root.
    const term = quote(evaluate(t, openEnv(t)), 0);
    return { term, betas, status: 'normal' };
  } catch (e) {
    if (e instanceof OutOfFuel) return { term: null, betas, status: 'fuel', message: `Gave up after ${fuel} β-steps (fuel limit).` };
    if (e instanceof RangeError) return { term: null, betas, status: 'error', message: 'Term too deep (stack overflow).' };
    return { term: null, betas, status: 'error', message: String(e) };
  }
}

// Open terms: dangling indices become free names "_k".
function openEnv(t: Term): Env {
  let max = 0;
  const walk = (n: Term, d: number) => {
    if (n.tag === 'var') { if (n.i - d + 1 > max) max = n.i - d + 1; }
    else if (n.tag === 'lam') walk(n.body, d + 1);
    else if (n.tag === 'app') { walk(n.fn, d); walk(n.arg, d); }
  };
  walk(t, 0);
  // env index 0 (innermost) is _0, index 1 is _1, ...
  let env: Env = null;
  for (let k = max - 1; k >= 0; k--) env = { head: { val: { k: 'neu', head: `_${k}`, spine: [] } }, tail: env };
  return env;
}
