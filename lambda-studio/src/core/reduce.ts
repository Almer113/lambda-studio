import { type Term, type Path, app, lam, getAt, replaceAt, size, hash, equal } from './term';
import { beta, isEtaRedex, etaContract } from './debruijn';

export type Strategy = 'normal' | 'applicative' | 'cbn' | 'cbv' | 'head';

export const STRATEGIES: { id: Strategy; name: string; description: string }[] = [
  { id: 'normal', name: 'Normal order', description: 'Leftmost-outermost, under λ. Finds the normal form whenever one exists.' },
  { id: 'applicative', name: 'Applicative order', description: 'Leftmost-innermost, under λ (arguments first). May loop where normal order would not.' },
  { id: 'cbn', name: 'Call-by-name', description: 'Leftmost-outermost, never under λ. Stops at weak head normal form.' },
  { id: 'cbv', name: 'Call-by-value', description: 'Arguments before calls, never under λ (like JS/Python/ML).' },
  { id: 'head', name: 'Head reduction', description: 'Only the head redex, under λ. Stops at head normal form.' },
];

export interface ReduceOptions { strategy: Strategy; eta: boolean }
export type RedexKind = 'beta' | 'eta';


/** Path of the next redex according to the strategy, or null if none (iterative: terms can be very deep). */
export function findRedex(t: Term, opts: ReduceOptions, path: Path = ''): Path | null {
  const { strategy: s, eta } = opts;
  const nodes: Term[] = [t], paths: Path[] = [path];
  if (s === 'applicative' || s === 'cbv') {
    // innermost first: children left to right, then the node itself (post-order)
    const post: boolean[] = [false];
    while (nodes.length) {
      const n = nodes.pop()!, p = paths.pop()!, done = post.pop()!;
      if (done) {
        if (n.tag === 'app' ? n.fn.tag === 'lam' : eta && isEtaRedex(n)) return p;
        continue;
      }
      if (n.tag === 'lam') {
        if (s === 'cbv') continue;
        nodes.push(n, n.body); paths.push(p, p + 'b'); post.push(true, false);
      } else if (n.tag === 'app') {
        nodes.push(n, n.arg, n.fn); paths.push(p, p + 'a', p + 'f'); post.push(true, false, false);
      }
    }
    return null;
  }
  // outermost first (pre-order); cbn never enters λ, cbn and head never enter arguments
  while (nodes.length) {
    const n = nodes.pop()!, p = paths.pop()!;
    if (n.tag === 'lam') {
      if (s === 'cbn') continue;
      if (eta && isEtaRedex(n)) return p;
      nodes.push(n.body); paths.push(p + 'b');
    } else if (n.tag === 'app') {
      if (n.fn.tag === 'lam') return p;
      if (s === 'normal') { nodes.push(n.arg); paths.push(p + 'a'); }
      nodes.push(n.fn); paths.push(p + 'f');
    }
  }
  return null;
}

/** Every redex position in the term (for manual mode and counting), outermost-first, left to right. */
export function listRedexes(t: Term, eta: boolean, limit = 10000): Path[] {
  const out: Path[] = [];
  const stack: [Term, Path][] = [[t, '']];
  while (stack.length && out.length < limit) {
    const [n, p] = stack.pop()!;
    if (n.tag === 'app') {
      if (n.fn.tag === 'lam') out.push(p);
      stack.push([n.arg, p + 'a'], [n.fn, p + 'f']);
    } else if (n.tag === 'lam') {
      if (eta && isEtaRedex(n)) out.push(p);
      stack.push([n.body, p + 'b']);
    }
  }
  return out;
}

export function redexKindAt(t: Term, path: Path, eta: boolean): RedexKind | null {
  const n = getAt(t, path);
  if (n.tag === 'app' && n.fn.tag === 'lam') return 'beta';
  if (eta && isEtaRedex(n)) return 'eta';
  return null;
}

/** Contract the redex at `path`. */
export function stepAt(t: Term, path: Path, eta = true): { term: Term; kind: RedexKind } {
  const n = getAt(t, path);
  if (n.tag === 'app' && n.fn.tag === 'lam') return { term: replaceAt(t, path, beta(n.fn, n.arg)), kind: 'beta' };
  if (eta && isEtaRedex(n)) return { term: replaceAt(t, path, etaContract(n)), kind: 'eta' };
  throw new Error(`No redex at path "${path}"`);
}

export interface StepResult { term: Term; path: Path; kind: RedexKind }
export function step(t: Term, opts: ReduceOptions): StepResult | null {
  const path = findRedex(t, opts);
  if (path === null) return null;
  const r = stepAt(t, path, opts.eta);
  return { term: r.term, path, kind: r.kind };
}

export type RunStatus = 'normal' | 'step-limit' | 'size-limit' | 'cycle' | 'stopped' | 'error';

export interface RunOptions extends ReduceOptions {
  maxSteps: number;
  maxSize: number;
  /** Record up to this many history entries (0 = none). */
  record?: number;
  shouldStop?: () => boolean;
  onProgress?: (steps: number, size: number) => void;
}

export interface HistoryEntry { term: Term; /** redex contracted to produce the NEXT entry */ path: Path | null; kind: RedexKind | null }

export interface RunResult {
  term: Term;
  steps: number;
  status: RunStatus;
  message?: string;
  maxSizeSeen: number;
  history: HistoryEntry[];
  /** For cycles: number of steps in the cycle. */
  cycleLength?: number;
}

/** Run the step engine with limits and cycle detection. */
export function run(t: Term, opts: RunOptions): RunResult {
  const record = opts.record ?? 0;
  const history: HistoryEntry[] = [];
  const seen = new Map<number, { term: Term; step: number }[]>();
  let cur = t;
  let steps = 0;
  let maxSizeSeen = size(t);
  const remember = (term: Term, stepNo: number): number | null => {
    const h = hash(term);
    const bucket = seen.get(h);
    if (bucket) {
      for (const e of bucket) if (equal(e.term, term)) return stepNo - e.step;
      bucket.push({ term, step: stepNo });
    } else seen.set(h, [{ term, step: stepNo }]);
    if (seen.size > 5000) seen.clear(); // bound memory; long cycles may go undetected
    return null;
  };
  remember(cur, 0);
  try {
    for (;;) {
      const path = findRedex(cur, opts);
      if (path === null) {
        if (history.length < record) history.push({ term: cur, path: null, kind: null });
        return { term: cur, steps, status: 'normal', maxSizeSeen, history };
      }
      if (steps >= opts.maxSteps) return { term: cur, steps, status: 'step-limit', maxSizeSeen, history, message: `Stopped after ${steps} steps (limit).` };
      if (opts.shouldStop?.()) return { term: cur, steps, status: 'stopped', maxSizeSeen, history };
      const { term: next, kind } = stepAt(cur, path, opts.eta);
      if (history.length < record) history.push({ term: cur, path, kind });
      cur = next;
      steps++;
      const sz = size(cur);
      if (sz > maxSizeSeen) maxSizeSeen = sz;
      if (sz > opts.maxSize) return { term: cur, steps, status: 'size-limit', maxSizeSeen, history, message: `Term grew to ${sz} nodes (limit ${opts.maxSize}).` };
      const cyc = remember(cur, steps);
      if (cyc !== null) {
        if (history.length < record) {
          const p = findRedex(cur, opts);
          const n = p === null ? null : getAt(cur, p);
          history.push({ term: cur, path: p, kind: n === null ? null : n.tag === 'app' && n.fn.tag === 'lam' ? 'beta' : 'eta' });
        }
        return { term: cur, steps, status: 'cycle', maxSizeSeen, history, cycleLength: cyc, message: `The term reduces to itself after ${cyc} step${cyc === 1 ? '' : 's'}: it has no normal form under this strategy.` };
      }
      if (opts.onProgress && steps % 500 === 0) opts.onProgress(steps, sz);
    }
  } catch (e) {
    const msg = e instanceof RangeError ? 'Term too deep (stack overflow).' : String(e);
    return { term: cur, steps, status: 'error', maxSizeSeen, history, message: msg };
  }
}

// re-export for convenience
export { app, lam };
