// Display-only folding: replace closed subterms that equal a known definition by its name,
// and Church numerals by digits.

import { type Term, hash, equal, isClosed } from './term';
import { decodeNumeral } from './encodings';

export interface FoldEntry { name: string; term: Term; user: boolean }
export interface FoldOptions { numerals: boolean; zeroAs: '0' | 'FALSE'; minSize?: number }

export class FoldTable {
  private byHash = new Map<number, FoldEntry[]>();
  readonly names = new Set<string>();
  /** user: a definition from the user's source; it is shown in preference to a numeral. */
  add(name: string, term: Term, user = false) {
    if (!isClosed(term)) return;
    const h = hash(term);
    const b = this.byHash.get(h);
    const e = { name, term, user };
    if (b) { if (!b.some((x) => equal(x.term, term))) b.push(e); }
    else this.byHash.set(h, [e]);
    this.names.add(name);
  }
  lookup(t: Term): string | null { return this.entry(t)?.name ?? null; }
  entry(t: Term): FoldEntry | null {
    const b = this.byHash.get(hash(t));
    if (!b) return null;
    for (const e of b) if (equal(e.term, t)) return e;
    return null;
  }
}

export function makeFolder(table: FoldTable, opts: FoldOptions): (t: Term) => string | null {
  return (t: Term) => {
    if (t.tag !== 'lam' && t.tag !== 'app') return null;
    if (!isClosed(t)) return null;
    const hit = table.entry(t);
    if (hit?.user) return hit.name;
    if (opts.numerals) {
      const n = decodeNumeral(t);
      if (n !== null && !(n === 0 && opts.zeroAs === 'FALSE')) return String(n);
    }
    return hit?.name ?? null;
  };
}
