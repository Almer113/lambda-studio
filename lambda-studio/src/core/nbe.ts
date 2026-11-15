// Fast normalizer: lazy normalization-by-evaluation with sharing (call-by-need).
// Computes the same normal form as normal-order reduction (when one exists), much faster,
// but does not produce a step-by-step trace.
//
// Both halves run on explicit stacks rather than the call stack: evaluation is a small
// abstract machine (pending arguments and thunk updates on a stack), and read-back (quote)
// uses a task stack. Terms can be tens of thousands of levels deep.

import { type Term, app, lam, v, free, maxFree } from './term';

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

/** Evaluation continuation: apply the value to a pending argument, or store it in a thunk. */
type Frame = { arg: Thunk; update?: undefined } | { update: Thunk; arg?: undefined };

/** Read-back task: quote a thunk or a λ-body, or rebuild a node from finished children. */
type Task =
  | { q: 'thunk'; th: Thunk; level: number }
  | { q: 'body'; body: Term; env: Env; level: number }
  | { q: 'lam'; hint?: string }
  | { q: 'app' };

export function normalize(t: Term, fuel = 1_000_000): NormalizeResult {
  let betas = 0;
  const lookup = (env: Env, i: number): Thunk => {
    let e = env;
    for (let k = 0; k < i && e; k++) e = e.tail;
    if (!e) throw new Error('Unbound index');
    return e.head;
  };

  /** Weak head normal form of `t` in `env`, updating every thunk forced on the way. */
  const evaluate = (t0: Term, env0: Env): Val => {
    const frames: Frame[] = [];
    let t: Term = t0, env: Env = env0;
    for (;;) {
      // evaluate t in env until it yields a value
      let val: Val;
      switch (t.tag) {
        case 'var': {
          const th = lookup(env, t.i);
          if (th.val) { val = th.val; break; }
          frames.push({ update: th });
          t = th.term!; env = th.env!;
          continue;
        }
        case 'free': val = { k: 'neu', head: t.name, spine: [] }; break;
        case 'lam': val = { k: 'lam', body: t.body, env, hint: t.hint }; break;
        case 'app':
          frames.push({ arg: { term: t.arg, env } });
          t = t.fn;
          continue;
      }
      // return val to the waiting frames
      for (;;) {
        const fr = frames.pop();
        if (!fr) return val;
        if (fr.update) {
          const th = fr.update;
          th.val = val; th.term = undefined; th.env = undefined;
          continue;
        }
        if (val.k === 'lam') {
          if (++betas > fuel) throw new OutOfFuel();
          t = val.body; env = { head: fr.arg!, tail: val.env };
          break; // evaluate the body
        }
        val = { k: 'neu', head: val.head, spine: [...val.spine, fr.arg!] };
      }
    }
  };
  const force = (th: Thunk): Val => {
    if (th.val) return th.val;
    const r = evaluate(th.term!, th.env!);
    th.val = r; th.term = undefined; th.env = undefined; // share the result
    return r;
  };

  /** Read a value back into a normal-form term (left to right, as the recursive version did). */
  const quote = (root: Val): Term => {
    const out: Term[] = [];
    const tasks: Task[] = [];
    const visit = (val: Val, level: number) => {
      if (val.k === 'lam') {
        tasks.push({ q: 'lam', hint: val.hint });
        const x: Thunk = { val: { k: 'neu', head: level, spine: [] } };
        tasks.push({ q: 'body', body: val.body, env: { head: x, tail: val.env }, level: level + 1 });
        return;
      }
      out.push(typeof val.head === 'number' ? v(level - val.head - 1) : free(val.head));
      // h a1 … an: quote a1, apply, quote a2, apply, … (pushed in reverse)
      for (let k = val.spine.length - 1; k >= 0; k--) tasks.push({ q: 'app' }, { q: 'thunk', th: val.spine[k], level });
    };
    visit(root, 0);
    while (tasks.length) {
      const task = tasks.pop()!;
      switch (task.q) {
        case 'thunk': visit(force(task.th), task.level); break;
        case 'body': visit(evaluate(task.body, task.env), task.level); break;
        case 'lam': out.push(lam(out.pop()!, task.hint)); break;
        case 'app': { const a = out.pop()!, f = out.pop()!; out.push(app(f, a)); break; }
      }
    }
    return out[0];
  };

  try {
    // Free indices at top level are treated as neutral variables beyond the root.
    const term = quote(evaluate(t, openEnv(t)));
    return { term, betas, status: 'normal' };
  } catch (e) {
    if (e instanceof OutOfFuel) return { term: null, betas, status: 'fuel', message: `Gave up after ${fuel} β-steps (fuel limit).` };
    if (e instanceof RangeError) return { term: null, betas, status: 'error', message: 'Term too deep (stack overflow).' };
    return { term: null, betas, status: 'error', message: String(e) };
  }
}

// Open terms: dangling indices become free names "_k".
function openEnv(t: Term): Env {
  const max = maxFree(t);
  // env index 0 (innermost) is _0, index 1 is _1, ...
  let env: Env = null;
  for (let k = max - 1; k >= 0; k--) env = { head: { val: { k: 'neu', head: `_${k}`, spine: [] } }, tail: env };
  return env;
}
