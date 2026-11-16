// Fast normalizer: lazy normalization-by-evaluation with sharing (call-by-need).
// Computes the same normal form as normal-order reduction (when one exists), much faster,
// but does not produce a step-by-step trace.
//
// Both halves run on explicit stacks rather than the call stack: evaluation is a small
// abstract machine (pending arguments and thunk updates on a stack), and read-back (quote)
// uses a task stack. Terms can be tens of thousands of levels deep.

import { type Term, app, lam, v, free } from './term';
import { etaNormal } from './debruijn';

interface Thunk { val?: Val; term?: Term; env?: Env }
type Env = { head: Thunk; tail: Env } | null;
type Val =
  | { k: 'lam'; body: Term; env: Env; hint?: string }
  | { k: 'neu'; head: number | string; spine: Spine };
/** Arguments of a neutral term, last one first: adding one is O(1) and shares the rest. */
type Spine = { arg: Thunk; rest: Spine } | null;

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

/** eta: also contract η-redexes (η-reducing a β-normal form gives the βη-normal form). */
export function normalize(t: Term, fuel = 1_000_000, eta = false): NormalizeResult {
  let betas = 0;
  // An index that runs past the end of the environment is free in the whole term: dangling index k
  // is a neutral variable at level -(k+1), below the root, so that read-back at level L turns it into
  // index L + k (the same dangling variable). These are made on demand: building one environment
  // entry per free index would take time and memory proportional to the largest index (λ1000000000).
  const dangling = new Map<number, Thunk>();
  const lookup = (env: Env, i: number): Thunk => {
    let e = env, k = 0;
    for (; k < i && e; k++) e = e.tail;
    if (e) return e.head;
    const d = i - k;
    let th = dangling.get(d);
    if (!th) { th = { val: { k: 'neu', head: -(d + 1), spine: null } }; dangling.set(d, th); }
    return th;
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
        case 'free': val = { k: 'neu', head: t.name, spine: null }; break;
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
        val = { k: 'neu', head: val.head, spine: { arg: fr.arg!, rest: val.spine } };
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
        const x: Thunk = { val: { k: 'neu', head: level, spine: null } };
        tasks.push({ q: 'body', body: val.body, env: { head: x, tail: val.env }, level: level + 1 });
        return;
      }
      out.push(typeof val.head === 'number' ? v(level - val.head - 1) : free(val.head));
      // h a1 … an: quote a1, apply, quote a2, apply, … (pushed in reverse)
      // the spine lists the last argument first, which is the order the tasks are pushed in
      for (let sp = val.spine; sp; sp = sp.rest) tasks.push({ q: 'app' }, { q: 'thunk', th: sp.arg, level });
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
    const nf = quote(evaluate(t, null));
    const term = eta ? etaNormal(nf) : nf;
    return { term, betas, status: 'normal' };
  } catch (e) {
    if (e instanceof OutOfFuel) return { term: null, betas, status: 'fuel', message: `Gave up after ${fuel} β-steps (fuel limit).` };
    if (e instanceof RangeError) return { term: null, betas, status: 'error', message: 'Term too deep (stack overflow).' };
    return { term: null, betas, status: 'error', message: String(e) };
  }
}

