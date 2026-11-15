/// <reference lib="webworker" />
import { run, type HistoryEntry, type ReduceOptions } from '../core/reduce';
import { normalize } from '../core/nbe';
import { type Term, size } from '../core/term';

export type WorkerRequest =
  | { id: number; type: 'run'; term: Term; opts: ReduceOptions; maxSteps: number; maxSize: number; record: number }
  | { id: number; type: 'normalize'; term: Term; fuel: number };

export type WorkerResponse =
  | { id: number; type: 'progress'; steps: number; size: number }
  | { id: number; type: 'run-done'; term: Term; steps: number; status: string; message?: string; history: HistoryEntry[]; maxSizeSeen: number; cycleLength?: number }
  | { id: number; type: 'normalize-done'; term: Term | null; betas: number; status: string; message?: string; size: number };

const post = (m: WorkerResponse) => (self as unknown as Worker).postMessage(m);

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  if (req.type === 'run') {
    const r = run(req.term, {
      ...req.opts,
      maxSteps: req.maxSteps,
      maxSize: req.maxSize,
      // only keep history for moderately sized terms to bound memory
      record: size(req.term) < 20000 ? req.record : 0,
      onProgress: (steps, sz) => post({ id: req.id, type: 'progress', steps, size: sz }),
    });
    post({ id: req.id, type: 'run-done', term: r.term, steps: r.steps, status: r.status, message: r.message, history: r.history, maxSizeSeen: r.maxSizeSeen, cycleLength: r.cycleLength });
  } else {
    const r = normalize(req.term, req.fuel);
    post({ id: req.id, type: 'normalize-done', term: r.term, betas: r.betas, status: r.status, message: r.message, size: r.term ? size(r.term) : 0 });
  }
};
