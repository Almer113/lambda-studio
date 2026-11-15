import { type Term, counts, size, maxFree, freeNames, isClosed } from './term';
import { blcBits } from './formats/blc';
import { listRedexes } from './reduce';
import { describe, type Decoded } from './encodings';

export interface TermStats {
  nodes: number;
  lams: number;
  apps: number;
  vars: number;
  depth: number;
  blcBits: number | null;
  closed: boolean;
  danglingIndices: number;
  freeNames: string[];
  redexes: number;
  normal: boolean;
  decoded: Decoded[];
}

export function termStats(t: Term, eta: boolean): TermStats {
  const c = counts(t);
  const redexes = listRedexes(t, eta, 100000).length;
  const closed = isClosed(t);
  return {
    nodes: size(t),
    lams: c.lams, apps: c.apps, vars: c.vars, depth: c.depth,
    blcBits: freeNames(t).size === 0 ? blcBits(t) : null,
    closed,
    danglingIndices: maxFree(t),
    freeNames: [...freeNames(t)],
    redexes,
    normal: redexes === 0,
    decoded: closed && redexes === 0 ? describe(t) : [],
  };
}
