/// <reference lib="webworker" />
// Background jobs for the Tools panel: truth tables, value tables, law checks and the
// enumeration / BBλ explorer. Each job reports progress and can be cancelled by terminating.

import { type Term } from '../core/term';
import { truthTable, type TruthTable } from '../core/algebra/boolean';
import { evalAt, type Value } from '../core/algebra/numeric';
import { checkLaw, type LawResult } from '../core/algebra/laws';
import { busyBeaver, enumerateClosed, classify, Counter, type BBResult } from '../core/generate';

export type ToolRequest =
  | { id: number; type: 'truth'; term: Term; n: number; names: string[]; fuel: number }
  | { id: number; type: 'table'; term: Term; arity: 1 | 2; N: number; fuel: number }
  | { id: number; type: 'law'; left: Term; right: Term; fuel: number }
  | { id: number; type: 'bb'; n: number; fuel: number }
  | { id: number; type: 'enumerate'; n: number; fuel: number; onlyNormal: boolean; limit: number };

export interface EnumItem { term: Term; nf: number | null; betas: number | null }

export type ToolResponse =
  | { id: number; type: 'progress'; done: number; total: number }
  | { id: number; type: 'truth'; table: TruthTable }
  | { id: number; type: 'table'; rows: Value[][] }
  | { id: number; type: 'law'; result: LawResult }
  | { id: number; type: 'bb'; result: BBResult }
  | { id: number; type: 'enumerate'; items: EnumItem[]; total: number; normalizing: number; unknown: number; truncated: boolean }
  | { id: number; type: 'error'; message: string };

const post = (m: ToolResponse) => (self as unknown as Worker).postMessage(m);

self.onmessage = (e: MessageEvent<ToolRequest>) => {
  const req = e.data;
  try {
    switch (req.type) {
      case 'truth':
        post({ id: req.id, type: 'truth', table: truthTable(req.term, req.n, req.names, req.fuel) });
        break;
      case 'table': {
        const rows: Value[][] = [];
        const outer = req.arity === 1 ? 1 : req.N + 1;
        for (let m = 0; m < outer; m++) {
          const row: Value[] = [];
          for (let n = 0; n <= req.N; n++) row.push(evalAt(req.term, req.arity === 1 ? [n] : [m, n], req.fuel));
          rows.push(row);
          post({ id: req.id, type: 'progress', done: m + 1, total: outer });
        }
        post({ id: req.id, type: 'table', rows });
        break;
      }
      case 'law':
        post({ id: req.id, type: 'law', result: checkLaw(req.left, req.right, req.fuel) });
        break;
      case 'bb':
        post({ id: req.id, type: 'bb', result: busyBeaver(req.n, req.fuel, (done, total) => post({ id: req.id, type: 'progress', done, total })) });
        break;
      case 'enumerate': {
        const counter = new Counter();
        const total = Number(counter.closed(req.n));
        const items: EnumItem[] = [];
        let normalizing = 0, unknown = 0, done = 0, truncated = false;
        for (const t of enumerateClosed(req.n, counter)) {
          const c = classify(t, req.fuel);
          if (c.status === 'normal') normalizing++; else unknown++;
          if (!req.onlyNormal || c.status === 'normal') {
            if (items.length < req.limit) items.push({ term: t, nf: c.nfBits ?? null, betas: c.betas ?? null });
            else truncated = true;
          }
          if (++done % 500 === 0) post({ id: req.id, type: 'progress', done, total });
        }
        post({ id: req.id, type: 'enumerate', items, total, normalizing, unknown, truncated });
        break;
      }
    }
  } catch (err) {
    post({ id: req.id, type: 'error', message: (err as Error).message ?? String(err) });
  }
};
