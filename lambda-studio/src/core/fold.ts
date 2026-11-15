// Display-only folding: replace closed subterms that equal a known definition by its name,
// and Church numerals by digits.

import { type Term, hash, equal, isClosed } from './term';
import { decodeNumeral } from './encodings';

export interface FoldEntry { name: string; term: Term }
export interface FoldOptions { numerals: boolean; zeroAs: '0' | 'FALSE'; minSize?: number }

export class FoldTable {
  private byHash = new Map<number, FoldEntry[]>();
  readonly names = new Set<string>();
  add(name: string, term: Term) {
    if (!isClosed(term)) return;
    const h = hash(term);
    const b = this.byHash.get(h);
    const e = { name, term };
    if (b) { if (!b.some((x) => equal(x.term, term))) b.push(e); }
    else this.byHash.set(h, [e]);
    this.names.add(name);
  }
  lookup(t: Term): string | null {
    const b = this.byHash.get(hash(t));
    if (!b) return null;
    for (const e of b) if (equal(e.term, t)) return e.name;
    return null;
  }
}

export function makeFolder(table: FoldTable, opts: FoldOptions): (t: Term) => string | null {
  return (t: Term) => {
    if (t.tag !== 'lam' && t.tag !== 'app') return null;
    if (!isClosed(t)) return null;
    if (opts.numerals) {
      const n = decodeNumeral(t);
      if (n !== null && !(n === 0 && opts.zeroAs === 'FALSE')) return String(n);
    }
    return table.lookup(t);
  };
}
