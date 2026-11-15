// Data encodings (Church) and decoding of normal forms back into data.

import { type Term, app, lam, v, maxFree, isClosed } from './term';
import { shift } from './debruijn';

/** Church numeral n = λf.λx. f^n x */
export function churchNumeral(n: number): Term {
  let body: Term = v(0);
  for (let k = 0; k < n; k++) body = app(v(1), body);
  return lam(lam(body, 'x'), 'f');
}

/** Church list [a, b, ...] = λc.λn. c a (c b (... n)); items must be resolved in the outer scope. */
export function churchList(items: Term[]): Term {
  let body: Term = v(0);
  for (let k = items.length - 1; k >= 0; k--) body = app(app(v(1), shift(items[k], 2)), body);
  return lam(lam(body, 'n'), 'c');
}

export const churchTrue: Term = lam(lam(v(1), 'f'), 't');
export const churchFalse: Term = lam(lam(v(0), 'f'), 't');

export function decodeNumeral(t: Term): number | null {
  if (t.tag !== 'lam' || t.body.tag !== 'lam') return null;
  let b: Term = t.body.body;
  let n = 0;
  while (b.tag === 'app') {
    if (b.fn.tag !== 'var' || b.fn.i !== 1) return null;
    n++;
    b = b.arg;
  }
  return b.tag === 'var' && b.i === 0 ? n : null;
}

export function decodeBool(t: Term): boolean | null {
  if (t.tag !== 'lam' || t.body.tag !== 'lam' || t.body.body.tag !== 'var') return null;
  const i = t.body.body.i;
  return i === 1 ? true : i === 0 ? false : null;
}

/** Church list: λc.λn. c h1 (c h2 (... n)) with each hi not mentioning c or n. */
export function decodeList(t: Term): Term[] | null {
  if (t.tag !== 'lam' || t.body.tag !== 'lam') return null;
  let b: Term = t.body.body;
  const items: Term[] = [];
  while (b.tag === 'app') {
    if (b.fn.tag !== 'app' || b.fn.fn.tag !== 'var' || b.fn.fn.i !== 1) return null;
    const h = b.fn.arg;
    if (maxFree(h) > 0) return null; // refers to c, n or outer scope
    items.push(h);
    b = b.arg;
  }
  return b.tag === 'var' && b.i === 0 ? items : null;
}

/** Pair λs. s a b with a, b closed. */
export function decodePair(t: Term): [Term, Term] | null {
  if (t.tag !== 'lam' || t.body.tag !== 'app' || t.body.fn.tag !== 'app') return null;
  const s = t.body.fn.fn;
  if (s.tag !== 'var' || s.i !== 0) return null;
  const a = t.body.fn.arg, b = t.body.arg;
  if (maxFree(a) > 0 || maxFree(b) > 0) return null;
  return [shift(a, -1), shift(b, -1)];
}

export interface Decoded { kind: 'numeral' | 'boolean' | 'list' | 'pair' | 'string'; text: string }

/** All plausible readings of a closed term as data. */
export function describe(t: Term, depth = 0): Decoded[] {
  if (!isClosed(t) || depth > 4) return [];
  const out: Decoded[] = [];
  const n = decodeNumeral(t);
  if (n !== null) out.push({ kind: 'numeral', text: `Church numeral ${n}` });
  const b = decodeBool(t);
  if (b !== null) out.push({ kind: 'boolean', text: b ? 'TRUE' : 'FALSE' });
  const l = decodeList(t);
  if (l !== null && l.length > 0) {
    const items = l.map((it) => short(it, depth + 1));
    out.push({ kind: 'list', text: `list [${items.join(', ')}]` });
    const codes = l.map(decodeNumeral);
    if (codes.every((c) => c !== null && c >= 32 && c < 0x10ffff)) out.push({ kind: 'string', text: `string "${String.fromCodePoint(...(codes as number[]))}"` });
  }
  const p = decodePair(t);
  if (p !== null) out.push({ kind: 'pair', text: `pair (${short(p[0], depth + 1)}, ${short(p[1], depth + 1)})` });
  return out;
}

function short(t: Term, depth: number): string {
  const n = decodeNumeral(t);
  if (n !== null) return String(n);
  const b = decodeBool(t);
  if (b !== null) return b ? 'TRUE' : 'FALSE';
  const d = describe(t, depth);
  return d.length ? d[0].text : '…';
}
