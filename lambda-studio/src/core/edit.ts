// Structural editing of a term at a path ("creator" actions). Every action returns a new
// term (or null when it does not apply), and the UI writes the result back to the source.

import { type Term, type Path, app, lam, v, free, getAt, replaceAt, maxFree } from './term';
import { shift, occurs, isEtaRedex, etaContract } from './debruijn';
import { redexKindAt, stepAt } from './reduce';
import { definitionTexts } from './formats/named';

export type EditAction = 'abstract' | 'unwrap' | 'apply' | 'pass' | 'replace' | 'delete' | 'eta-expand' | 'eta-reduce' | 'beta' | 'fold';

export interface ActionInfo { id: EditAction; label: string; title: string; needsTerm?: boolean; needsName?: boolean }

export const ACTIONS: ActionInfo[] = [
  { id: 'beta', label: 'β-reduce', title: 'Contract this redex (a step on the timeline, like a double-click)' },
  { id: 'abstract', label: 'Wrap in λ', title: 'M → λx.M (x not used)' },
  { id: 'unwrap', label: 'Remove λ', title: 'λx.M → M when x is not used in M' },
  { id: 'eta-expand', label: 'η-expand', title: 'M → λx.M x' },
  { id: 'eta-reduce', label: 'η-reduce', title: 'λx.M x → M' },
  { id: 'apply', label: 'Apply to…', title: 'M → M N', needsTerm: true },
  { id: 'pass', label: 'Pass to…', title: 'M → F M', needsTerm: true },
  { id: 'replace', label: 'Replace with…', title: 'Replace this subterm', needsTerm: true },
  { id: 'delete', label: 'Delete', title: 'Remove this side of an application (M N → M or N)' },
  { id: 'fold', label: 'Name it…', title: 'Make this subterm a definition and use its name here', needsName: true },
];

/** Which actions apply at `p`. */
export function applicable(t: Term, p: Path, eta = true): Set<EditAction> {
  const s = new Set<EditAction>(['abstract', 'eta-expand', 'apply', 'pass', 'replace']);
  let sub: Term;
  try { sub = getAt(t, p); } catch { return new Set(); }
  if (sub.tag === 'lam' && !occurs(sub.body, 0)) s.add('unwrap');
  if (sub.tag === 'lam' && isEtaRedex(sub)) s.add('eta-reduce');
  try { if (redexKindAt(t, p, eta) === 'beta') s.add('beta'); } catch { /* ignore */ }
  if (p !== '' && (p.endsWith('f') || p.endsWith('a'))) s.add('delete');
  if (maxFree(sub) === 0 && sub.tag !== 'free') s.add('fold');
  return s;
}

/** `arg` must be closed apart from free names (as parsed from text): it needs no shifting. */
export function applyEdit(t: Term, p: Path, action: EditAction, arg?: Term, name?: string): Term | null {
  let sub: Term;
  try { sub = getAt(t, p); } catch { return null; }
  switch (action) {
    case 'abstract': return replaceAt(t, p, lam(shift(sub, 1), 'x'));
    case 'unwrap': return sub.tag === 'lam' && !occurs(sub.body, 0) ? replaceAt(t, p, shift(sub.body, -1)) : null;
    case 'eta-expand': return replaceAt(t, p, lam(app(shift(sub, 1), v(0)), 'x'));
    case 'eta-reduce': return sub.tag === 'lam' && isEtaRedex(sub) ? replaceAt(t, p, etaContract(sub)) : null;
    case 'apply': return arg ? replaceAt(t, p, app(sub, arg)) : null;
    case 'pass': return arg ? replaceAt(t, p, app(arg, sub)) : null;
    case 'replace': return arg ? replaceAt(t, p, arg) : null;
    case 'delete': {
      if (p === '') return null;
      const parent = p.slice(0, -1);
      const par = getAt(t, parent);
      if (par.tag !== 'app') return null;
      return replaceAt(t, parent, p.endsWith('f') ? par.arg : par.fn);
    }
    case 'beta': try { return redexKindAt(t, p, true) === 'beta' ? stepAt(t, p, false).term : null; } catch { return null; }
    case 'fold': return name && maxFree(sub) === 0 ? replaceAt(t, p, free(name)) : null;
  }
}

/**
 * Write an edited term back into named-notation source: keep the user's definitions, add new
 * ones, and replace the main expression with `expr`.
 */
export function rewriteSource(source: string, expr: string, newDefs: { name: string; body: string }[] = [], named = true): string {
  // definitions with errors are kept too: an edit must not delete the user's work. A source in
  // another notation has no named definitions: only its leading comments are kept (as `--` lines,
  // without a `-- 0-based` marker, which would mean something else in named notation).
  const defsText = named ? definitionTexts(source).join('\n') : '';
  let header = source.match(/^(?:\s*(?:--|\/\/|#)[^\n]*\n)*/)?.[0].trimEnd() ?? '';
  if (!named) {
    header = header.split('\n')
      .filter((l) => l.trim() !== '' && !/^\s*(--|\/\/|#)\s*[01]-based\b/i.test(l))
      .map((l) => l.replace(/^\s*(--|\/\/|#)/, '--'))
      .join('\n');
  }
  const parts = [header, defsText, ...newDefs.map((d) => `${d.name} = ${d.body}`), expr].filter((x) => x.trim() !== '');
  return parts.join('\n');
}

/**
 * Restrict a folder to what `source` already uses: names that occur in it, and numerals only if
 * it has a number. Used when an edit rewrites the source, so it keeps the user's own vocabulary.
 */
export function sourceFolder(source: string, fold: (t: Term) => string | null): (t: Term) => string | null {
  const code = source.replace(/(--|\/\/|#).*$/gm, '');
  const used = new Set(code.match(/[\p{L}_][\p{L}\p{N}_'₀-₉]*/gu) ?? []);
  const numerals = /(^|[^\p{L}\p{N}_])\d/u.test(code);
  return (t) => {
    const r = fold(t);
    if (r === null) return null;
    return (/^\d+$/.test(r) ? numerals : used.has(r)) ? r : null;
  };
}

/** A definition name that is valid and not taken. */
export function freshName(base: string, taken: ReadonlySet<string>): string {
  const b = base.toUpperCase().replace(/[^A-Z0-9_]/g, '') || 'DEF';
  if (!taken.has(b)) return b;
  for (let k = 2; ; k++) if (!taken.has(`${b}${k}`)) return `${b}${k}`;
}
