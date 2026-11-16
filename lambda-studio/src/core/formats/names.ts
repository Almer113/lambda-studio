// Bound-variable names for the printers. A binder gets its preferred name if that is free,
// otherwise the same name with the smallest numeric suffix that is free: x, x1, x2, …
//
// Checking each candidate against the list of names in scope made printing cubic in the nesting
// depth (a Scott numeral of 1000 took seconds). Here membership is a set lookup and, per base
// name, the search starts where the last one ended, moving back down when a name is released,
// so each choice costs amortized constant time and the chosen names are exactly the same.

import type { Term } from '../term';

/**
 * Add the names a term's free variables are printed with: free names through `freeName`, and
 * dangling de Bruijn indices (k levels beyond the root) as `dangling(k)`. Bound names must avoid
 * all of them, or a binder would capture a free variable.
 */
export function collectFreeNames(t: Term, into: Set<string>, dangling: (k: number) => string, freeName: (n: string) => string = (n) => n): void {
  const stack: Term[] = [t], depth: number[] = [0];
  while (stack.length) {
    const n = stack.pop()!, d = depth.pop()!;
    if (n.tag === 'free') into.add(freeName(n.name));
    else if (n.tag === 'var') { if (n.i >= d) into.add(dangling(n.i - d)); }
    else if (n.tag === 'lam') { stack.push(n.body); depth.push(d + 1); }
    else { stack.push(n.fn, n.arg); depth.push(d, d); }
  }
}

export class NameScope {
  private readonly inScope = new Set<string>();
  /** For a base b: every b+j with 1 <= j < next(b) is taken (in scope or blocked). */
  private readonly next = new Map<string, number>();
  private readonly stack: string[] = [];

  /** `blocked` names are never used (reserved words, free names, …); it must not change. */
  constructor(private readonly blocked: (name: string) => boolean) {}

  get depth(): number { return this.stack.length; }

  /** The name of the binder `i` levels up (de Bruijn index i), if there is one. */
  at(i: number): string | undefined { return this.stack[this.stack.length - 1 - i]; }

  taken(name: string): boolean { return this.inScope.has(name) || this.blocked(name); }

  /** A name for a new binder, based on `base`. */
  fresh(base: string): string {
    if (!this.taken(base)) return base;
    let k = this.next.get(base) ?? 1;
    while (this.taken(base + k)) k++;
    this.next.set(base, k + 1);
    return base + k;
  }

  push(name: string): void { this.stack.push(name); this.inScope.add(name); }

  pop(): void {
    const name = this.stack.pop();
    if (name === undefined) return;
    this.inScope.delete(name);
    // the name is free again: every base it is a numbered form of may use it again
    for (let i = name.length - 1; i > 0; i--) {
      const c = name.charCodeAt(i);
      if (c < 48 || c > 57) break;
      if (c === 48) continue; // suffixes are written without leading zeros
      const base = name.slice(0, i), k = Number(name.slice(i));
      const cur = this.next.get(base);
      if (cur !== undefined && k < cur) this.next.set(base, k);
    }
  }
}
