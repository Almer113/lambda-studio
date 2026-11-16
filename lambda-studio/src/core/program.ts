// High-level entry point: parse a source text in any supported format into a term,
// with definitions, diagnostics and source spans.

import { type Term, type Path } from './term';
import { parseStatements, definedNames, Resolver, ParseError, type DefSource, type Diagnostic, type Span, printNamed } from './formats/named';
import { parseDeBruijn, printDeBruijn, deBruijnClosedUnder } from './formats/debruijn';
import { decodeBLC, encodeBLC } from './formats/blc';
import { parseJSON, printJSON } from './formats/json';
import { looksLikeLatex, normalizeLatex, mapSpan, printLatex, type Normalized } from './formats/latex';
import { parseSKI, parseUnlambda, parseIota, parseJot, parseBCL, parseLazyK, fromCL, toCL, printCL, ParseFail, type CL, type Algorithm } from './combinators';
import { codeToNamed, printCode, CodeParseError, type CodeLang } from './formats/code';
import { bytesToBits, bitsToBytes, bytesToHex, parseBytes, bytesToBase64 } from './formats/blc8';
import { PRELUDE } from './prelude';
import { FoldTable } from './fold';

export type FormatId =
  | 'named' | 'debruijn0' | 'debruijn1' | 'latex'
  | 'blc' | 'blc8' | 'json'
  | 'ski' | 'unlambda' | 'iota' | 'jot' | 'bcl' | 'lazyk'
  | 'haskell' | 'js' | 'python' | 'lisp' | 'wolfram';

export type FormatGroup = 'λ' | 'Bits & data' | 'Combinators' | 'Code';

export const FORMATS: { id: FormatId; name: string; example: string; group: FormatGroup }[] = [
  { id: 'named', name: 'Named λ', example: 'λf x.f (f x)', group: 'λ' },
  { id: 'debruijn0', name: 'De Bruijn (0-based)', example: 'λλ1 (1 0)', group: 'λ' },
  { id: 'debruijn1', name: 'De Bruijn (1-based, Tromp)', example: 'λλ2 (2 1)', group: 'λ' },
  { id: 'latex', name: 'LaTeX', example: '\\lambda f.\\,\\lambda x.\\, f\\,(f\\,x)', group: 'λ' },
  { id: 'blc', name: 'Binary λ-calculus (BLC)', example: '0000011100111010', group: 'Bits & data' },
  { id: 'blc8', name: 'BLC8 bytes (hex / base64)', example: '0x05 0x73 0xa0', group: 'Bits & data' },
  { id: 'json', name: 'JSON AST', example: '{"type":"lam","body":…}', group: 'Bits & data' },
  { id: 'ski', name: 'SKI / combinators', example: 'S(S(KS)K)I', group: 'Combinators' },
  { id: 'unlambda', name: 'Unlambda', example: '``s``s`ksk`ki', group: 'Combinators' },
  { id: 'iota', name: 'Iota', example: '*i*i*ii', group: 'Combinators' },
  { id: 'jot', name: 'Jot', example: '11100', group: 'Combinators' },
  { id: 'bcl', name: 'Binary combinatory logic', example: '0100', group: 'Combinators' },
  { id: 'lazyk', name: 'Lazy K', example: '(SKK)', group: 'Combinators' },
  { id: 'haskell', name: 'Haskell', example: '\\f x -> f (f x)', group: 'Code' },
  { id: 'js', name: 'JavaScript', example: 'f => x => f(f(x))', group: 'Code' },
  { id: 'python', name: 'Python', example: 'lambda f: lambda x: f(f(x))', group: 'Code' },
  { id: 'lisp', name: 'Lisp / Scheme', example: '(lambda (f x) (f (f x)))', group: 'Code' },
  { id: 'wolfram', name: 'Wolfram Language', example: 'Function[f, Function[x, f[f[x]]]]', group: 'Code' },
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
/**
 * Bits that can start a closed BLC term: it begins with a λ (00) or an application (01), so numbers
 * such as 1000, 1111 or `10 11` stay numerals. (Incomplete bits still count, so that while BLC is
 * being typed its errors are BLC errors.)
 */
function looksLikeBLC(s: string): boolean {
  return /^[01\s]+$/.test(s) && /^0[01]/.test(s) && s.replace(/\s/g, '').length >= 4;
}

export function detectFormat(src: string, defaultBase: 0 | 1 = 1): FormatId {
  const based = /(?:--|\/\/|#)\s*([01])-based\b/i.exec(src);
  const s = src.replace(/(--|\/\/|#).*$/gm, '').trim();
  if (s.startsWith('{')) return 'json';
  if (/^0x[0-9a-f]/i.test(s)) return 'blc8';
  if (looksLikeLatex(src)) return 'latex';
  if (/^[\[(]\s*(lambda|define)\b/.test(s) || /\(\s*lambda\s*[([]/.test(s)) return 'lisp';
  if (/\bFunction\s*\[/.test(s) || /\|->/.test(s)) return 'wolfram';
  if (/\blambda\s+[A-Za-z_][\w\s,]*:/.test(s)) return 'python';
  if (/=>/.test(s)) return 'js';
  if (/^`/.test(s) && /^[`skiSKI\s]+$/.test(s.replace(/#.*$/gm, ''))) return 'unlambda';
  if (/^\*/.test(s) && /^[*i\s]+$/.test(s)) return 'iota';
  if (/^[SKIBCWι()\s'*]+$/.test(s) && /[SKIBCWι]/.test(s) && !/[λ\\]/.test(s)) return 'ski';
  if (looksLikeBLC(s)) return 'blc';
  if (/[λ\\]/.test(s) && /^[λ\\().\s0-9]+$/.test(s) && /[0-9]/.test(s)) {
    if (/(^|[^0-9])0([^0-9]|$)/.test(s)) return 'debruijn0';
    const c0 = deBruijnClosedUnder(s, 0), c1 = deBruijnClosedUnder(s, 1);
    if (c1 && !c0) return 'debruijn1';
    if (c0 && !c1) return 'debruijn0';
    if (based) return based[1] === '0' ? 'debruijn0' : 'debruijn1';
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
    if (e instanceof ParseError || e instanceof ParseFail || e instanceof CodeParseError) return { ...base, diagnostics: [{ from: e.from, to: Math.max(e.to, e.from), message: e.message, severity: 'error' }] };
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
      case 'latex':
        return parseLatexProgram(src, opts, base);
      case 'blc8': {
        const bytes = parseBytes(src);
        const bits = bytesToBits(bytes);
        const r = decodeBLC(bits);
        const padding = r.trailing > 0 && r.trailing < 8 && /^0*$/.test(bits.slice(r.used));
        const diagnostics: Diagnostic[] = r.trailing && !padding ? [{ from: 0, to: src.length, message: `${r.trailing} trailing bit(s) after the term were ignored (input data?)`, severity: 'warning' }] : [];
        return { ...base, term: r.term, diagnostics };
      }
      case 'ski': case 'unlambda': case 'iota': case 'jot': case 'bcl': case 'lazyk':
        return { ...base, term: fromCL(CL_PARSERS[fmt](src)) };
      case 'haskell':
        return parseNamedProgram(src, opts, base);
      case 'js': case 'python': case 'lisp': case 'wolfram':
        return parseViaNamed(codeToNamed(src, fmt), 'named', opts, base);
    }
  } catch (e) { return fail(e); }
}

const CL_PARSERS: Record<'ski' | 'unlambda' | 'iota' | 'jot' | 'bcl' | 'lazyk', (src: string) => CL> = {
  ski: parseSKI, unlambda: parseUnlambda, iota: parseIota, jot: parseJot, bcl: parseBCL, lazyk: parseLazyK,
};

/** LaTeX: normalise to plain notation, parse that, and map positions back into the LaTeX source. */
function parseLatexProgram(src: string, opts: ProgramOptions, base: Program): Program {
  const n = normalizeLatex(src);
  let inner = detectFormat(n.text, opts.defaultDeBruijnBase ?? 1);
  if (inner !== 'debruijn0' && inner !== 'debruijn1') inner = 'named';
  return { ...parseViaNamed(n, inner, opts, base), format: 'latex' };
}

/** Parse translated text and map spans / diagnostics back into the original source. */
function parseViaNamed(n: Normalized, inner: FormatId, opts: ProgramOptions, base: Program): Program {
  const p = parseProgram(n.text, inner, opts);
  const spans = new Map<Path, Span>();
  for (const [k, s] of p.spans) spans.set(k, mapSpan(n, s));
  return {
    ...p,
    format: base.format,
    detected: base.detected,
    spans,
    diagnostics: p.diagnostics.map((d) => ({ ...d, ...mapSpan(n, d) })),
    defs: p.defs.map((d) => (d.span ? { ...d, span: mapSpan(n, d.span) } : d)),
  };
}

function parseNamedProgram(src: string, opts: ProgramOptions, base: Program): Program {
  const prelude = preludeDefs();
  const known = new Set<string>([...prelude.keys(), ...(opts.singleLetter ? definedNames(src) : [])]);
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
  // User definitions shadow library ones in the user's own code only: library definitions keep
  // their library meaning (they are resolved once, in the prelude), and recursion is always
  // compiled with the library's Y, so redefining Y or SUCC cannot break FACT or LENGTH.
  const fixpoint = prelude.get('Y')!.term!;
  const r: Resolver = new Resolver(defs, (): Term => fixpoint);
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
  // (a library name the user redefined is not used: it would mean something else in their code)
  let foldTable = base.foldTable;
  if (user.length) {
    foldTable = new FoldTable();
    for (const u of user) if (u.term && u.name !== mainName) foldTable.add(u.name, u.term, true);
    for (const e of PRELUDE) if (e.fold && defs.get(e.name)?.origin === 'prelude') foldTable.add(e.name, prelude.get(e.name)!.term!);
  }
  const defInfos: DefInfo[] = user.map((u) => ({ name: u.name, origin: 'user', term: u.term ?? null, error: u.error, recursive: u.recursive, span: u.span }));
  diagnostics.push(...r.warnings);
  return { ...base, term, diagnostics, defs: defInfos, mainName, foldTable };
}

// --- printing in any format -----------------------------------------------
/**
 * 0-based de Bruijn text. Without an index 0 it would read back as 1-based (`λλ1` is K 0-based but
 * FALSE 1-based), so such text carries a `-- 0-based` comment that detection honours.
 */
export function printDeBruijn0(t: Term): string {
  const text = printDeBruijn(t, 0).text;
  return detectFormat(text) === 'debruijn0' ? text : `${text}   -- 0-based`;
}

export interface PrintTermOptions { algorithm?: Algorithm }

export function printTerm(t: Term, fmt: FormatId, opts: PrintTermOptions = {}): string {
  switch (fmt) {
    case 'named': return printNamed(t).text;
    case 'debruijn0': return printDeBruijn0(t);
    case 'debruijn1': return printDeBruijn(t, 1).text;
    case 'latex': return printLatex(t);
    case 'blc': return encodeBLC(t);
    case 'blc8': return bytesToHex(bitsToBytes(encodeBLC(t)));
    case 'json': return printJSON(t);
    case 'ski': case 'unlambda': case 'iota': case 'jot': case 'bcl': case 'lazyk':
      return printCL(toCL(t, opts.algorithm ?? (fmt === 'ski' ? 'turner' : 'ski')), fmt);
    case 'haskell': case 'js': case 'python': case 'lisp': case 'wolfram':
      return printCode(t, fmt as CodeLang);
  }
}

export { bytesToBase64 };
