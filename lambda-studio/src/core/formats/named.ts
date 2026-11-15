// Standard named lambda notation: lexer, parser (with definitions), resolver and printer.
//
//   λx y. x        \x y. x        \x -> x        (λx.x) (λy.y)
//   PLUS = λm n f x. m f (n f x)          -- definitions, one per line
//   let two = 2 in PLUS two two           -- sugar
//   [1, 2, 3]   3   "numbers are Church numerals"

import { type Term, type Path, app, lam, v, free } from '../term';
import { shift, occurs } from '../debruijn';
import { churchNumeral, churchList } from '../encodings';

export interface Span { from: number; to: number }
export interface Diagnostic extends Span { message: string; severity: 'error' | 'warning' | 'info' }

export class ParseError extends Error {
  constructor(message: string, public from: number, public to: number) { super(message); }
}

// ---------------------------------------------------------------------------
// Lexer

type TokKind = 'lam' | 'dot' | 'lp' | 'rp' | 'lb' | 'rb' | 'comma' | 'eq' | 'semi' | 'id' | 'num' | 'let' | 'in' | 'str';
export interface Token { kind: TokKind; text: string; from: number; to: number; bol: boolean }

const isIdStart = (c: string) => c !== 'λ' && (/\p{L}/u.test(c) || c === '_');
const isIdChar = (c: string) => isIdStart(c) || /[0-9'₀-₉]/.test(c);

export function lex(src: string): Token[] {
  const toks: Token[] = [];
  let i = 0;
  let bol = true; // at start of a line, column 0
  let lineStart = true;
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { i++; lineStart = true; bol = true; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; bol = false; continue; }
    const two = src.slice(i, i + 2);
    if (two === '--' || two === '//' || c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    const start = i;
    const push = (kind: TokKind, len: number) => {
      toks.push({ kind, text: src.slice(start, start + len), from: start, to: start + len, bol: bol && lineStart });
      i += len; bol = false; lineStart = false;
    };
    if (c === 'λ' || c === '\\') push('lam', 1);
    else if (two === '->') push('dot', 2);
    else if (c === '→' || c === '.') push('dot', 1);
    else if (c === '(') push('lp', 1);
    else if (c === ')') push('rp', 1);
    else if (c === '[') push('lb', 1);
    else if (c === ']') push('rb', 1);
    else if (c === ',') push('comma', 1);
    else if (c === ';') push('semi', 1);
    else if (two === ':=') push('eq', 2);
    else if (c === '=' || c === '≡') push('eq', 1);
    else if (/[0-9]/.test(c)) { let j = i; while (j < src.length && /[0-9]/.test(src[j])) j++; push('num', j - i); }
    else if (c === '"') {
      let j = i + 1; while (j < src.length && src[j] !== '"' && src[j] !== '\n') j++;
      if (src[j] !== '"') throw new ParseError('Unterminated string', i, j);
      push('str', j - i + 1);
    }
    else if (isIdStart(c)) {
      let j = i; while (j < src.length && isIdChar(src[j])) j++;
      const word = src.slice(i, j);
      push(word === 'let' ? 'let' : word === 'in' ? 'in' : 'id', j - i);
    } else throw new ParseError(`Unexpected character '${c}'`, i, i + 1);
  }
  return toks;
}

// ---------------------------------------------------------------------------
// Surface syntax

export type SNode =
  | { k: 'id'; name: string; from: number; to: number }
  | { k: 'num'; n: number; from: number; to: number }
  | { k: 'str'; s: string; from: number; to: number }
  | { k: 'lam'; params: { name: string; from: number; to: number }[]; body: SNode; from: number; to: number }
  | { k: 'app'; fn: SNode; arg: SNode; from: number; to: number }
  | { k: 'list'; items: SNode[]; from: number; to: number }
  | { k: 'let'; name: string; value: SNode; body: SNode; from: number; to: number };

export interface Statement { kind: 'def' | 'expr'; name?: string; nameSpan?: Span; node: SNode; from: number; to: number; doc?: string }

export interface ParseOptions { singleLetter?: boolean; knownNames?: ReadonlySet<string> }

class Parser {
  k = 0;
  constructor(private t: Token[], private end: number, private opts: ParseOptions) {}
  peek() { return this.t[this.k]; }
  eof() { return this.k >= this.t.length; }
  next() { return this.t[this.k++]; }
  expect(kind: TokKind, what: string) {
    const tok = this.peek();
    if (!tok || tok.kind !== kind) {
      const at = tok ? tok.from : this.end;
      throw new ParseError(`Expected ${what}${tok ? ` but found '${tok.text}'` : ''}`, at, tok ? tok.to : at);
    }
    return this.next();
  }
  splitWord(tok: Token): { name: string; from: number; to: number }[] {
    const w = tok.text;
    if (this.opts.singleLetter && w.length > 1 && /^\p{Ll}+$/u.test(w) && !this.opts.knownNames?.has(w))
      return [...w].map((ch, j) => ({ name: ch, from: tok.from + j, to: tok.from + j + 1 }));
    return [{ name: w, from: tok.from, to: tok.to }];
  }
  expr(): SNode {
    const tok = this.peek();
    if (!tok) throw new ParseError('Expected an expression', this.end, this.end);
    if (tok.kind === 'lam') return this.lambda();
    if (tok.kind === 'let') return this.letExpr();
    return this.application();
  }
  lambda(): SNode {
    const l = this.next();
    const params: { name: string; from: number; to: number }[] = [];
    while (this.peek()?.kind === 'id') params.push(...this.splitWord(this.next()));
    if (params.length === 0) {
      const tok = this.peek();
      throw new ParseError('Expected a variable name after λ', tok?.from ?? this.end, tok?.to ?? this.end);
    }
    this.expect('dot', "'.' after the λ parameters");
    const body = this.expr();
    return { k: 'lam', params, body, from: l.from, to: body.to };
  }
  letExpr(): SNode {
    const l = this.next();
    const name = this.expect('id', 'a name after let');
    this.expect('eq', "'=' in let");
    const value = this.expr();
    this.expect('in', "'in' after the let value");
    const body = this.expr();
    return { k: 'let', name: name.text, value, body, from: l.from, to: body.to };
  }
  application(): SNode {
    let fn: SNode | null = null;
    for (;;) {
      const tok = this.peek();
      if (!tok || tok.kind === 'rp' || tok.kind === 'rb' || tok.kind === 'comma' || tok.kind === 'in') break;
      let arg: SNode;
      if (tok.kind === 'lam' || tok.kind === 'let') arg = this.expr();
      else arg = this.atom();
      fn = fn ? { k: 'app', fn, arg, from: fn.from, to: arg.to } : arg;
      if (tok.kind === 'lam' || tok.kind === 'let') break;
    }
    if (!fn) {
      const tok = this.peek();
      throw new ParseError(tok ? `Unexpected '${tok.text}'` : 'Expected an expression', tok?.from ?? this.end, tok?.to ?? this.end);
    }
    return fn;
  }
  atom(): SNode {
    const tok = this.next();
    switch (tok.kind) {
      case 'id': {
        const parts = this.splitWord(tok);
        let node: SNode = { k: 'id', ...parts[0] };
        for (const p of parts.slice(1)) node = { k: 'app', fn: node, arg: { k: 'id', ...p }, from: node.from, to: p.to };
        return node;
      }
      case 'num': return { k: 'num', n: Number(tok.text), from: tok.from, to: tok.to };
      case 'str': return { k: 'str', s: tok.text.slice(1, -1), from: tok.from, to: tok.to };
      case 'lp': {
        const e = this.expr();
        const r = this.expect('rp', "')'");
        return { ...e, from: tok.from, to: r.to } as SNode;
      }
      case 'lb': {
        const items: SNode[] = [];
        if (this.peek()?.kind !== 'rb') {
          items.push(this.expr());
          while (this.peek()?.kind === 'comma') { this.next(); items.push(this.expr()); }
        }
        const r = this.expect('rb', "']'");
        return { k: 'list', items, from: tok.from, to: r.to };
      }
      default:
        throw new ParseError(`Unexpected '${tok.text}'`, tok.from, tok.to);
    }
  }
}

/** Split tokens into statements: a new statement starts at column 0 (outside brackets) or after ';'. */
function splitStatements(toks: Token[]): Token[][] {
  const out: Token[][] = [];
  let cur: Token[] = [];
  let depth = 0;
  for (const tok of toks) {
    if (depth === 0 && (tok.kind === 'semi' || (tok.bol && cur.length > 0))) {
      if (cur.length) out.push(cur);
      cur = [];
      if (tok.kind === 'semi') continue;
    }
    if (tok.kind === 'lp' || tok.kind === 'lb') depth++;
    if ((tok.kind === 'rp' || tok.kind === 'rb') && depth > 0) depth--;
    cur.push(tok);
  }
  if (cur.length) out.push(cur);
  return out;
}

export function parseStatements(src: string, opts: ParseOptions = {}): { statements: Statement[]; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  let toks: Token[];
  try { toks = lex(src); }
  catch (e) {
    if (e instanceof ParseError) return { statements: [], diagnostics: [{ from: e.from, to: e.to, message: e.message, severity: 'error' }] };
    throw e;
  }
  const statements: Statement[] = [];
  for (const group of splitStatements(toks)) {
    const from = group[0].from, to = group[group.length - 1].to;
    try {
      if (group.length >= 2 && group[0].kind === 'id' && group[1].kind === 'eq') {
        const p = new Parser(group.slice(2), to, opts);
        const node = p.expr();
        if (!p.eof()) { const t = p.peek(); throw new ParseError(`Unexpected '${t.text}'`, t.from, t.to); }
        statements.push({ kind: 'def', name: group[0].text, nameSpan: { from: group[0].from, to: group[0].to }, node, from, to });
      } else {
        const p = new Parser(group, to, opts);
        const node = p.expr();
        if (!p.eof()) { const t = p.peek(); throw new ParseError(`Unexpected '${t.text}'`, t.from, t.to); }
        statements.push({ kind: 'expr', node, from, to });
      }
    } catch (e) {
      if (e instanceof ParseError) diagnostics.push({ from: e.from, to: e.to, message: e.message, severity: 'error' });
      else throw e;
    }
  }
  return { statements, diagnostics };
}

// ---------------------------------------------------------------------------
// Resolution: surface syntax -> nameless terms

export interface DefSource {
  name: string;
  node: SNode;
  origin: 'prelude' | 'user';
  span?: Span;
  term?: Term;
  error?: string;
  recursive?: boolean;
  state?: 'resolving' | 'done';
}

export const MAX_NUMERAL = 100_000;

export class Resolver {
  readonly warnings: Diagnostic[] = [];
  constructor(
    private defs: Map<string, DefSource>,
    private fixpoint: () => Term,
  ) {}

  resolveDef(name: string): Term {
    const d = this.defs.get(name)!;
    if (d.state === 'done') {
      if (d.error) throw new ParseError(`'${name}' has an error: ${d.error}`, 0, 0);
      return d.term!;
    }
    if (d.state === 'resolving') throw new RecursionMarker(name);
    d.state = 'resolving';
    try {
      // Resolve with the definition's own name bound by an outer λ, to support self-recursion via Y.
      const body = this.resolve(d.node, [name], '', null);
      if (occurs(body, 0)) {
        d.term = app(this.fixpoint(), lam(body, name));
        d.recursive = true;
      } else d.term = shift(body, -1);
      d.state = 'done';
      return d.term;
    } catch (e) {
      d.state = 'done';
      d.error = e instanceof RecursionMarker
        ? `mutual recursion with '${e.target}' is not supported (only direct self-reference is turned into Y)`
        : e instanceof ParseError ? e.message : String(e);
      if (e instanceof ParseError && e.from + e.to > 0) throw e;
      throw new ParseError(d.error, d.node.from, d.node.to);
    }
  }

  /** scope: innermost name last. spans: optional map filled with path -> source span. */
  resolve(n: SNode, scope: string[], path: Path, spans: Map<Path, Span> | null): Term {
    spans?.set(path, { from: n.from, to: n.to });
    switch (n.k) {
      case 'id': {
        const idx = scope.lastIndexOf(n.name);
        if (idx >= 0) return v(scope.length - 1 - idx);
        if (this.defs.has(n.name)) {
          try { return this.resolveDef(n.name); }
          catch (e) {
            if (e instanceof RecursionMarker) throw e;
            if (e instanceof ParseError) throw new ParseError(e.message.startsWith(`'${n.name}'`) ? e.message : `In '${n.name}': ${e.message}`, n.from, n.to);
            throw e;
          }
        }
        return free(n.name);
      }
      case 'num':
        if (n.n > MAX_NUMERAL) throw new ParseError(`Numeral too large (max ${MAX_NUMERAL})`, n.from, n.to);
        return churchNumeral(n.n);
      case 'str': {
        const codes = [...n.s].map((ch) => churchNumeral(Math.min(ch.codePointAt(0)!, MAX_NUMERAL)));
        return churchList(codes);
      }
      case 'lam': {
        let inner = scope;
        for (const p of n.params) inner = [...inner, p.name];
        let pth = path;
        for (let k = 0; k < n.params.length; k++) pth += 'b';
        // record spans for nested lambdas made from a multi-parameter binder
        if (spans) { let q = path; for (let k = 1; k < n.params.length; k++) { q += 'b'; spans.set(q, { from: n.params[k].from, to: n.to }); } }
        let body = this.resolve(n.body, inner, pth, spans);
        for (let k = n.params.length - 1; k >= 0; k--) body = lam(body, n.params[k].name);
        return body;
      }
      case 'app':
        return app(this.resolve(n.fn, scope, path + 'f', spans), this.resolve(n.arg, scope, path + 'a', spans));
      case 'list': {
        const items = n.items.map((it, k) => this.resolve(it, scope, path + 'bb' + 'a'.repeat(k) + 'fa', spans));
        return churchList(items);
      }
      case 'let': {
        const value = this.resolve(n.value, scope, path + 'a', spans);
        const body = this.resolve(n.body, [...scope, n.name], path + 'fb', spans);
        return app(lam(body, n.name), value);
      }
    }
  }
}

class RecursionMarker extends Error { constructor(public target: string) { super(`recursion:${target}`); } }

// ---------------------------------------------------------------------------
// Printer

export interface PrintOptions {
  lambda?: string;
  multiArg?: boolean;
  /** Return a display name for a (closed) subterm, or null to print it structurally. */
  fold?: (t: Term) => string | null;
  /** Names that must not be used for bound variables (e.g. definition names used by fold). */
  avoid?: ReadonlySet<string>;
}

export interface Printed { text: string; spans: { path: Path; from: number; to: number }[] }

const DEFAULT_NAMES = ['x', 'y', 'z', 'w', 'v', 'u', 't', 's', 'r', 'q'];

export function printNamed(t: Term, opts: PrintOptions = {}): Printed {
  const L = opts.lambda ?? 'λ';
  const multi = opts.multiArg ?? true;
  const fold = opts.fold;
  const avoid = new Set<string>(opts.avoid ?? []);
  collectFreeNames(t, avoid);
  let out = '';
  const spans: Printed['spans'] = [];
  const ctx: string[] = [];

  const pick = (hint: string | undefined): string => {
    const base = hint && /^[\p{L}_][\p{L}\p{N}_'₀-₉]*$/u.test(hint) && hint !== 'λ' ? hint : DEFAULT_NAMES[ctx.length % DEFAULT_NAMES.length];
    const taken = (n: string) => avoid.has(n) || ctx.includes(n) || /^[0-9]/.test(n) || n === 'let' || n === 'in';
    if (!taken(base)) return base;
    for (let k = 1; ; k++) if (!taken(base + k)) return base + k;
  };

  // Iterative printing (an explicit task stack): terms can be far deeper than the call stack.
  // Tasks are pushed in reverse order of execution.
  const tasks: (() => void)[] = [];
  const emit = (n: Term, path: Path, pos: 'top' | 'fn' | 'arg') => tasks.push(() => visit(n, path, pos));
  const text = (s: string) => tasks.push(() => { out += s; });
  const visit = (n: Term, path: Path, pos: 'top' | 'fn' | 'arg') => {
    const start = out.length;
    const finish = () => spans.push({ path, from: start, to: out.length });
    const folded = fold && n.tag !== 'var' && n.tag !== 'free' ? fold(n) : null;
    if (folded !== null) {
      out += folded;
      finish();
    } else if (n.tag === 'var') {
      out += n.i < ctx.length ? ctx[ctx.length - 1 - n.i] : `_${n.i - ctx.length}`;
      finish();
    } else if (n.tag === 'free') {
      out += n.name;
      finish();
    } else if (n.tag === 'lam') {
      const paren = pos !== 'top';
      if (paren) out += '(';
      const inner: { path: Path; from: number }[] = [];
      let cur: Term = n;
      let p = path;
      out += L;
      for (;;) {
        const name = pick(cur.tag === 'lam' ? cur.hint : undefined);
        ctx.push(name);
        if (p !== path) { out += ' '; inner.push({ path: p, from: out.length }); }
        out += name;
        const body: Term = (cur as { body: Term }).body;
        p += 'b';
        if (multi && body.tag === 'lam' && !(fold && fold(body) !== null)) { cur = body; continue; }
        out += '.';
        tasks.push(() => {
          for (const s of inner) spans.push({ path: s.path, from: s.from, to: out.length });
          for (let k = 0; k <= inner.length; k++) ctx.pop();
          if (paren) out += ')';
          finish();
        });
        emit(body, p, 'top');
        break;
      }
    } else {
      tasks.push(finish);
      const a = n.arg;
      const needParen = (a.tag === 'app' || a.tag === 'lam') && !(fold && fold(a) !== null);
      if (needParen && a.tag === 'app') { text(')'); emit(a, path + 'a', 'top'); text('('); }
      else emit(a, path + 'a', a.tag === 'lam' && needParen ? 'arg' : 'top');
      text(' ');
      emit(n.fn, path + 'f', 'fn');
    }
  };
  emit(t, '', 'top');
  while (tasks.length) tasks.pop()!();
  return { text: out, spans };
}

function collectFreeNames(t: Term, into: Set<string>) {
  const stack: Term[] = [t];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.tag === 'free') into.add(n.name);
    else if (n.tag === 'lam') stack.push(n.body);
    else if (n.tag === 'app') stack.push(n.fn, n.arg);
  }
}
