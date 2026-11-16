// What kind of function a term is, for pointing at the tool that suits it.

import { type Term, apps, equal } from '../term';
import { normalize } from '../nbe';
import { decodeBool, decodeNumeral } from '../encodings';
import { parseProgram, preludeInfo } from '../program';
import { arityOf } from './boolean';

export type TermKind = 'boolean' | 'numeric';

let known: { term: Term; kind: TermKind }[] | null = null;
/** Library Booleans and numeral functions, by their compiled terms. */
function library() {
  return known ??= preludeInfo()
    .filter((d) => d.term && (d.group === 'Booleans' || d.group === 'Numerals') && arityOf(d.term).n > 0)
    .map((d) => ({ term: d.term!, kind: d.group === 'Booleans' ? 'boolean' as const : 'numeric' as const }));
}

/**
 * Boolean function or function on numbers? A library definition says so by its group. Otherwise
 * the term is tried: on TRUE…/FALSE… it must give Booleans, or on numerals numbers (or Booleans),
 * and the other trial must fail — Church encodings overlap (AND applied to numerals gives a
 * number, PLUS applied to Booleans a Boolean), so when both work the answer is null.
 */
export function termKind(t: Term): TermKind | null {
  const lib = library().find((d) => equal(d.term, t));
  if (lib) return lib.kind;
  const n = arityOf(t).n;
  if (n === 0 || n > 4) return null;
  if (decodeNumeral(t) !== null || decodeBool(t) !== null) return null; // a value, not a function on values
  const at = (args: Term[]) => { try { const r = normalize(apps(t, ...args), 20_000); return r.status === 'normal' ? r.term ?? null : null; } catch { return null; } };
  const lit = (s: string) => parseProgram(s).term!;
  const [T, F] = [lit('TRUE'), lit('FALSE')];
  const bools = [at(Array(n).fill(T)), at(Array(n).fill(F)), at([T, ...Array(n - 1).fill(F)])];
  const isBool = bools.every((r) => r && decodeBool(r) !== null);
  const k = Math.min(n, 2);
  const nums = [at(Array(k).fill(lit('2'))), at(Array(k).fill(lit('3')))];
  const isNum = nums.every((r) => r && (decodeNumeral(r) !== null || decodeBool(r) !== null));
  return isBool && !isNum ? 'boolean' : isNum && !isBool ? 'numeric' : null;
}
