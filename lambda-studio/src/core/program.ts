// High-level entry point: parse a source text in any supported format into a term,
// with definitions, diagnostics and source spans.

import { type Term, type Path } from './term';
import { parseStatements, Resolver, ParseError, type DefSource, type Diagnostic, type Span, printNamed } from './formats/named';
import { parseDeBruijn, printDeBruijn, deBruijnClosedUnder } from './formats/debruijn';
import { decodeBLC, encodeBLC } from './formats/blc';
import { parseJSON, printJSON } from './formats/json';
import { PRELUDE } from './prelude';
import { FoldTable } from './fold';

export type FormatId = 'named' | 'debruijn0' | 'debruijn1' | 'blc' | 'json';

export const FORMATS: { id: FormatId; name: string; example: string }[] = [
  { id: 'named', name: 'Named λ', example: 'λf x.f (f x)' },
  { id: 'debruijn0', name: 'De Bruijn (0-based)', example: 'λλ1 (1 0)' },
  { id: 'debruijn1', name: 'De Bruijn (1-based, Tromp)', example: 'λλ2 (2 1)' },
  { id: 'blc', name: 'Binary λ-calculus (BLC)', example: '0000011100111010' },
  { id: 'json', name: 'JSON AST', example: '{"type":"lam","body":…}' },
];

export interface DefInfo { name: string; origin: 'prelude' | 'user'; term: Term | null; error?: string; recursive?: boolean; span?: Span; doc?: string; group?: string }

export interface Program {
  term: Term | null;
  format: FormatId;
  detected: boolean;
  diagnostics: Diagnostic[];
  /** Source spans of the main expression's nodes, by path. */
  spans: Map<Path, Span>;
  defs: DefInfo[];
  /** Name of the definition shown when the source has no main expression. */
  mainName?: string;
  foldTable: FoldTable;
}

export interface ProgramOptions { singleLetter?: boolean; defaultDeBruijnBase?: 0 | 1 }

// --- prelude (resolved once, lazily) ---------------------------------------
let preludeCache: Map<string, DefSource> | null = null;
function preludeDefs(): Map<string, DefSource> {
  if (preludeCache) return preludeCache;
  const m = new Map<string, DefSource>();
  for (const e of PRELUDE) {
    const { statements, diagnostics } = parseStatements(e.src);
    if (diagnostics.length || statements.length !== 1) throw new Error(`Prelude ${e.name}: ${diagnostics[0]?.message}`);
    m.set(e.name, { name: e.name, node: statements[0].node, origin: 'prelude' });
  }
  const r: Resolver = new Resolver(m, (): Term => r.resolveDef('Y'));
  for (const name of m.keys()) r.resolveDef(name);
  preludeCache = m;
  return m;
}

let preludeFold: FoldTable | null = null;
function preludeFoldTable(): FoldTable {
  if (preludeFold) return preludeFold;
  const defs = preludeDefs();
  const t = new FoldTable();
  for (const e of PRELUDE) if (e.fold) t.add(e.name, defs.get(e.name)!.term!);
  preludeFold = t;
  return t;
}

export function preludeInfo(): DefInfo[] {
  const defs = preludeDefs();
  return PRELUDE.map((e) => ({ name: e.name, origin: 'prelude' as const, term: defs.get(e.name)!.term ?? null, doc: e.doc, group: e.group, recursive: defs.get(e.name)!.recursive }));
}

export function preludeTerm(name: string): Term {
  const d = preludeDefs().get(name);
  if (!d?.term) throw new Error(`No prelude definition ${name}`);
  return d.term;
}

// --- detection --------------------------------------------------------------
export function detectFormat(src: string, defaultBase: 0 | 1 = 1): FormatId {
  const s = src.replace(/(--|\/\/|#).*$/gm, '').trim();
  if (s.startsWith('{')) return 'json';
  if (/^[01\s]+$/.test(s) && s.replace(/\s/g, '').length >= 4) return 'blc';
  if (/[λ\\]/.test(s) && /^[λ\\().\s0-9]+$/.test(s) && /[0-9]/.test(s)) {
    if (/(^|[^0-9])0([^0-9]|$)/.test(s)) return 'debruijn0';
    const c0 = deBruijnClosedUnder(s, 0), c1 = deBruijnClosedUnder(s, 1);
    if (c1 && !c0) return 'debruijn1';
    if (c0 && !c1) return 'debruijn0';
    return defaultBase === 0 ? 'debruijn0' : 'debruijn1';
  }
  return 'named';
}

// --- parsing ----------------------------------------------------------------
export function parseProgram(src: string, format: FormatId | 'auto' = 'auto', opts: ProgramOptions = {}): Program {
  const fmt: FormatId = format === 'auto' ? detectFormat(src, opts.defaultDeBruijnBase ?? 1) : format;
  const detected = format === 'auto';
  const spans = new Map<Path, Span>();
  const base: Program = { term: null, format: fmt, detected, diagnostics: [], spans, defs: [], foldTable: preludeFoldTable() };
  const fail = (e: unknown): Program => {
    if (e instanceof ParseError) return { ...base, diagnostics: [{ from: e.from, to: Math.max(e.to, e.from), message: e.message, severity: 'error' }] };
    return { ...base, diagnostics: [{ from: 0, to: src.length, message: String(e), severity: 'error' }] };
  };
  if (src.trim() === '') return base;
  try {
    switch (fmt) {
      case 'debruijn0':
      case 'debruijn1':
        return { ...base, term: parseDeBruijn(src, fmt === 'debruijn0' ? 0 : 1, spans) };
      case 'blc': {
        const r = decodeBLC(src);
        const diagnostics: Diagnostic[] = r.trailing ? [{ from: 0, to: src.length, message: `${r.trailing} trailing bit(s) after the term were ignored (input data?)`, severity: 'warning' }] : [];
        return { ...base, term: r.term, diagnostics };
      }
      case 'json':
        return { ...base, term: parseJSON(src) };
      case 'named':
        return parseNamedProgram(src, opts, base);
    }
  } catch (e) { return fail(e); }
}

function parseNamedProgram(src: string, opts: ProgramOptions, base: Program): Program {
  const prelude = preludeDefs();
  const known = new Set<string>(prelude.keys());
  const { statements, diagnostics } = parseStatements(src, { singleLetter: opts.singleLetter, knownNames: known });
  const defs = new Map<string, DefSource>();
  for (const [k, d] of prelude) defs.set(k, d);
  const user: DefSource[] = [];
  for (const st of statements) {
    if (st.kind !== 'def') continue;
    if (user.some((u) => u.name === st.name)) {
      diagnostics.push({ ...st.nameSpan!, message: `'${st.name}' is defined twice; the later definition wins`, severity: 'warning' });
    }
    const d: DefSource = { name: st.name!, node: st.node, origin: 'user', span: st.nameSpan };
    defs.set(st.name!, d);
    const idx = user.findIndex((u) => u.name === st.name);
    if (idx >= 0) user.splice(idx, 1);
    user.push(d);
  }
  // user definitions shadow prelude ones, so they need fresh resolution state; copy prelude entries
  // only when a user definition overrides something they depend on (rare): keep it simple and
  // re-resolve everything if any prelude name is shadowed.
  if (user.some((u) => prelude.has(u.name))) {
    for (const [k, d] of prelude) if (defs.get(k) === d) defs.set(k, { name: d.name, node: d.node, origin: 'prelude' });
  }
  const r: Resolver = new Resolver(defs, (): Term => r.resolveDef('Y'));
  for (const u of user) {
    try { r.resolveDef(u.name); }
    catch (e) {
      if (e instanceof ParseError) diagnostics.push({ from: e.from, to: e.to, message: e.message, severity: 'error' });
    }
  }
  const exprs = statements.filter((s) => s.kind === 'expr');
  if (exprs.length > 1) for (const s of exprs.slice(0, -1)) diagnostics.push({ from: s.from, to: s.to, message: 'Only the last expression is evaluated', severity: 'warning' });
  let term: Term | null = null;
  let mainName: string | undefined;
  const main = exprs[exprs.length - 1];
  if (main) {
    try { term = r.resolve(main.node, [], '', base.spans); }
    catch (e) {
      if (e instanceof ParseError) diagnostics.push({ from: e.from, to: e.to, message: e.message, severity: 'error' });
      else throw e;
    }
  } else if (user.length) {
    const last = user[user.length - 1];
    term = last.term ?? null;
    mainName = last.name;
    if (last.span) base.spans.set('', { from: last.node.from, to: last.node.to });
  }
  // fold table: prelude + user definitions
  let foldTable = base.foldTable;
  if (user.some((u) => u.term)) {
    foldTable = new FoldTable();
    for (const u of user) if (u.term && u.name !== mainName) foldTable.add(u.name, u.term);
    for (const e of PRELUDE) if (e.fold) foldTable.add(e.name, prelude.get(e.name)!.term!);
  }
  const defInfos: DefInfo[] = user.map((u) => ({ name: u.name, origin: 'user', term: u.term ?? null, error: u.error, recursive: u.recursive, span: u.span }));
  return { ...base, term, diagnostics, defs: defInfos, mainName, foldTable };
}

// --- printing in any format -----------------------------------------------
export function printTerm(t: Term, fmt: FormatId): string {
  switch (fmt) {
    case 'named': return printNamed(t).text;
    case 'debruijn0': return printDeBruijn(t, 0).text;
    case 'debruijn1': return printDeBruijn(t, 1).text;
    case 'blc': return encodeBLC(t);
    case 'json': return printJSON(t);
  }
}
