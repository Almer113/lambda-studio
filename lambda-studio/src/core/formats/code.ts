// Programming-language notations: Haskell, JavaScript, Python, Lisp/Scheme, Wolfram Language.
//
// Printing: curried functions in the language's own lambda syntax, ready to paste into a REPL.
// Parsing: each language is translated into the named λ notation (with an offset map back into the
// original source) and then parsed by the named parser, so definitions, numbers (Church numerals)
// and library names work the same way everywhere. Multi-argument functions and calls are curried.

import { type Term } from '../term';
import { type Normalized } from './latex';
import { NameScope, collectFreeNames } from './names';

export type CodeLang = 'haskell' | 'js' | 'python' | 'lisp' | 'wolfram';

export const CODE_LANGS: { id: CodeLang; name: string; example: string }[] = [
  { id: 'haskell', name: 'Haskell', example: '\\f x -> f (f x)' },
  { id: 'js', name: 'JavaScript', example: 'f => x => f(f(x))' },
  { id: 'python', name: 'Python', example: 'lambda f: lambda x: f(f(x))' },
  { id: 'lisp', name: 'Lisp / Scheme', example: '(lambda (f x) (f (f x)))' },
  { id: 'wolfram', name: 'Wolfram Language', example: 'Function[f, Function[x, f[f[x]]]]' },
];

const RESERVED: Record<CodeLang, Set<string>> = {
  haskell: new Set('case class data default deriving do else foreign if import in infix infixl infixr instance let module newtype of then type where'.split(' ')),
  js: new Set('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof let new null return super switch this throw true try typeof var void while with yield await static implements interface package private protected public arguments eval undefined NaN Infinity'.split(' ')),
  python: new Set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' ')),
  lisp: new Set('lambda define let if cond quote'.split(' ')),
  wolfram: new Set('Function If True False Null'.split(' ')),
};

const VALID: Record<CodeLang, RegExp> = {
  haskell: /^[a-z_][A-Za-z0-9_']*$/,
  js: /^[A-Za-z_$][A-Za-z0-9_$]*$/,
  python: /^[A-Za-z_][A-Za-z0-9_]*$/,
  lisp: /^[A-Za-z_*+!?<>=/-][A-Za-z0-9_*+!?<>=/-]*$/,
  wolfram: /^[A-Za-z][A-Za-z0-9]*$/,
};

const DEFAULT_NAMES = ['x', 'y', 'z', 'w', 'v', 'u', 't', 's', 'r', 'q'];

// ---------------------------------------------------------------------------
// Printing

export function printCode(t: Term, lang: CodeLang): string {
  const reserved = RESERVED[lang], valid = VALID[lang];
  const freeName = (n: string) => (valid.test(n) && !reserved.has(n) ? n : 'free_' + n.replace(/[^A-Za-z0-9]/g, ''));
  const dangling = (k: number) => (lang === 'wolfram' ? `free${k}` : `_${k}`);
  // bound names avoid reserved words and every name a free variable is printed with
  const freeNames = new Set<string>();
  collectFreeNames(t, freeNames, dangling, freeName);
  const ctx = new NameScope((n) => reserved.has(n) || freeNames.has(n));
  const pick = (hint?: string) => ctx.fresh(hint && valid.test(hint) && !reserved.has(hint) ? hint : DEFAULT_NAMES[ctx.depth % DEFAULT_NAMES.length]);
  const varName = (i: number) => (i < ctx.depth ? ctx.at(i)! : dangling(i - ctx.depth));

  // collect a run of lambdas
  const params = (n: Term): { names: string[]; body: Term } => {
    const names: string[] = [];
    let cur = n;
    while (cur.tag === 'lam') { const x = pick(cur.hint); ctx.push(x); names.push(x); cur = cur.body; }
    return { names, body: cur };
  };
  const spine = (n: Term): Term[] => { const args: Term[] = []; let c = n; while (c.tag === 'app') { args.unshift(c.arg); c = c.fn; } return [c, ...args]; };

  // Output is produced strictly left to right, so printing runs off an explicit task stack
  // (tasks pushed in reverse order) instead of recursion: terms can be very deep.
  let out = '';
  const tasks: (() => void)[] = [];
  const text = (s: string) => tasks.push(() => { out += s; });
  const go = (n: Term, pos: 'top' | 'fn' | 'arg') => tasks.push(() => visit(n, pos));
  /** Push `parts` so they run in the order given. */
  const seq = (...parts: (() => void)[]) => { for (let k = parts.length - 1; k >= 0; k--) parts[k](); };

  const visit = (n: Term, pos: 'top' | 'fn' | 'arg') => {
    if (n.tag === 'var') { out += varName(n.i); return; }
    if (n.tag === 'free') { out += freeName(n.name); return; }
    if (n.tag === 'lam') {
      const { names, body } = params(n);
      const paren = pos !== 'top';
      const pop = () => tasks.push(() => { for (let k = 0; k < names.length; k++) ctx.pop(); });
      switch (lang) {
        case 'haskell': seq(() => text(`${paren ? '(' : ''}\\${names.join(' ')} -> `), () => go(body, 'top'), pop, () => text(paren ? ')' : '')); break;
        case 'js': seq(() => text(`${paren ? '(' : ''}${names.join(' => ')} => `), () => go(body, 'top'), pop, () => text(paren ? ')' : '')); break;
        case 'python': seq(() => text((paren ? '(' : '') + names.map((x) => `lambda ${x}: `).join('')), () => go(body, 'top'), pop, () => text(paren ? ')' : '')); break;
        case 'lisp': seq(() => text(`(lambda (${names.join(' ')}) `), () => go(body, 'top'), pop, () => text(')')); break;
        case 'wolfram': seq(() => text(names.map((x) => `Function[${x}, `).join('')), () => go(body, 'top'), pop, () => text(']'.repeat(names.length))); break;
      }
      return;
    }
    const [head, ...args] = spine(n);
    const parts: (() => void)[] = [];
    switch (lang) {
      case 'haskell': {
        const paren = pos === 'arg';
        if (paren) parts.push(() => text('('));
        parts.push(() => go(head, 'fn'));
        for (const a of args) parts.push(() => text(' '), () => go(a, 'arg'));
        if (paren) parts.push(() => text(')'));
        break;
      }
      case 'lisp':
        parts.push(() => text('('), () => go(head, 'fn'));
        for (const a of args) parts.push(() => text(' '), () => go(a, 'top'));
        parts.push(() => text(')'));
        break;
      case 'wolfram':
        parts.push(() => go(head, 'fn'));
        for (const a of args) parts.push(() => text('['), () => go(a, 'top'), () => text(']'));
        break;
      default: // js, python
        parts.push(() => go(head, 'fn'));
        for (const a of args) parts.push(() => text('('), () => go(a, 'top'), () => text(')'));
    }
    seq(...parts);
  };
  go(t, 'top');
  while (tasks.length) tasks.pop()!();
  return out;
}

// ---------------------------------------------------------------------------
// Parsing: translate to named notation

export class CodeParseError extends Error {
  constructor(message: string, public from: number, public to: number) { super(message); }
}

interface Tok { k: 'id' | 'num' | 'sym'; s: string; from: number; to: number; bol: boolean }

function tokenize(src: string, lang: CodeLang): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let bol = true;
  const syms = lang === 'js' ? ['=>', '(', ')', ',', '=', ';', '{', '}'] : lang === 'python' ? ['(', ')', ',', ':', '='] : lang === 'lisp' ? ['(', ')', '[', ']', "'"] : ['[', ']', '{', '}', ',', ':=', '=', '|->', '&', '#', ';'];
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { i++; bol = true; continue; }
    if (/\s/.test(c)) { i++; if (c !== '\r') bol = false; continue; }
    // comments
    if ((lang === 'js' && src.startsWith('//', i)) || (lang === 'python' && c === '#') || (lang === 'lisp' && c === ';')) { while (i < src.length && src[i] !== '\n') i++; continue; }
    if ((lang === 'js' && src.startsWith('/*', i)) || (lang === 'wolfram' && src.startsWith('(*', i))) {
      const end = src.indexOf(lang === 'js' ? '*/' : '*)', i + 2);
      i = end < 0 ? src.length : end + 2; continue;
    }
    const start = i;
    if (/[0-9]/.test(c)) { while (i < src.length && /[0-9]/.test(src[i])) i++; toks.push({ k: 'num', s: src.slice(start, i), from: start, to: i, bol }); bol = false; continue; }
    const idRe = lang === 'lisp' ? /[A-Za-z_*+!?<>=/λ-]/ : lang === 'js' ? /[A-Za-z_$]/ : /[A-Za-z_]/;
    const idCont = lang === 'lisp' ? /[A-Za-z0-9_*+!?<>=/'-]/ : lang === 'js' ? /[A-Za-z0-9_$]/ : lang === 'wolfram' ? /[A-Za-z0-9]/ : /[A-Za-z0-9_]/;
    const sym = syms.find((s) => src.startsWith(s, i));
    if (sym && !(lang === 'lisp' && sym === "'" )) {
      // in Lisp a lone '-' etc. are identifiers; symbols list has none of those
      toks.push({ k: 'sym', s: sym, from: start, to: start + sym.length, bol }); i += sym.length; bol = false; continue;
    }
    if (idRe.test(c)) { while (i < src.length && idCont.test(src[i])) i++; toks.push({ k: 'id', s: src.slice(start, i), from: start, to: i, bol }); bol = false; continue; }
    throw new CodeParseError(`Unexpected '${c}'`, i, i + 1);
  }
  return toks;
}

/** Output builder: named-notation text plus a map back into the source. */
class Out {
  text = ''; map: number[] = []; ends: number[] = [];
  put(s: string, from: number, to: number) { for (const c of s) { this.text += c; this.map.push(from); this.ends.push(to); } }
  done(srcLen: number): Normalized { this.map.push(srcLen); this.ends.push(srcLen); return { text: this.text, map: this.map, ends: this.ends }; }
}

const safeName = (s: string) => {
  const n = s.replace(/\$/g, '_').replace(/[^\p{L}\p{N}_']/gu, (ch) => `_${ch.charCodeAt(0)}_`);
  return n === 'let' || n === 'in' ? n + '_' : n;
};

export function codeToNamed(src: string, lang: CodeLang): Normalized {
  const toks = tokenize(src, lang);
  const out = new Out();
  let k = 0;
  const peek = (o = 0) => toks[k + o];
  const err = (msg: string): never => { const t = peek() ?? { from: src.length, to: src.length }; throw new CodeParseError(msg, t.from, t.to); };
  const isSym = (s: string, o = 0) => peek(o)?.k === 'sym' && peek(o).s === s;
  const expect = (s: string) => { if (!isSym(s)) err(`Expected '${s}'`); return toks[k++]; };
  const ident = (): Tok => { const t = peek(); if (t?.k !== 'id') err('Expected a name'); k++; return t; };
  const emitId = (t: Tok) => out.put(safeName(t.s), t.from, t.to);

  // ---- per-language expression grammars (emit fully parenthesised named notation)
  const lamOpen = (names: Tok[], at: Tok) => { out.put('(λ', at.from, at.to); names.forEach((n, j) => { if (j) out.put(' ', n.from, n.from); emitId(n); }); out.put('.', at.from, at.to); };

  const exprJS = (): void => {
    // arrow functions: x => e | (x, y) => e
    if (peek()?.k === 'id' && isSym('=>', 1)) { const x = ident(); const arrow = expect('=>'); lamOpen([x], arrow); exprJS(); out.put(')', arrow.from, arrow.to); return; }
    if (isSym('(')) {
      let j = 1; const names: Tok[] = [];
      while (peek(j)?.k === 'id') { names.push(peek(j)); j++; if (peek(j)?.k === 'sym' && peek(j).s === ',') j++; else break; }
      if (peek(j)?.k === 'sym' && peek(j).s === ')' && peek(j + 1)?.k === 'sym' && peek(j + 1).s === '=>') {
        k += j + 1; const arrow = expect('=>');
        if (!names.length) err('Functions need at least one parameter');
        lamOpen(names, arrow); exprJS(); out.put(')', arrow.from, arrow.to); return;
      }
    }
    callLike(exprJS, '(', ')');
  };
  const exprPy = (): void => {
    if (peek()?.k === 'id' && peek().s === 'lambda') {
      const kw = toks[k++]; const names: Tok[] = [ident()];
      while (isSym(',')) { k++; names.push(ident()); }
      expect(':'); lamOpen(names, kw); exprPy(); out.put(')', kw.from, kw.to); return;
    }
    callLike(exprPy, '(', ')');
  };
  const exprWl = (): void => {
    if (peek()?.k === 'id' && peek().s === 'Function' && isSym('[', 1)) {
      const kw = toks[k++]; k++;
      const names: Tok[] = [];
      if (isSym('{')) { k++; names.push(ident()); while (isSym(',')) { k++; names.push(ident()); } expect('}'); } else names.push(ident());
      expect(',');
      const start = out.text.length;
      lamOpen(names, kw); exprWl(); out.put(')', kw.from, kw.to); expect(']');
      suffixes(exprWl, '[', ']', start); // Function[x, b][a]
      return;
    }
    if (peek()?.k === 'id' && isSym('|->', 1)) { const x = ident(); const arrow = expect('|->'); lamOpen([x], arrow); exprWl(); out.put(')', arrow.from, arrow.to); return; }
    callLike(exprWl, '[', ']');
  };
  // primary followed by call suffixes f(a)(b, c), curried: ((f a) b) c
  const callLike = (expr: () => void, open: string, close: string) => {
    const t = peek();
    if (!t) err('Unexpected end of input');
    const start = out.text.length;
    if (t.k === 'id') { k++; emitId(t); }
    else if (t.k === 'num') { k++; out.put(t.s, t.from, t.to); }
    else if (t.k === 'sym' && t.s === '(') { const o = toks[k++]; out.put('(', o.from, o.to); expr(); const c = expect(')'); out.put(')', c.from, c.to); }
    else err(`Unexpected '${t.s}'`);
    suffixes(expr, open, close, start);
  };
  const suffixes = (expr: () => void, open: string, close: string, start: number) => {
    while (isSym(open)) {
      const o = toks[k++];
      if (isSym(close)) err('Calls need an argument');
      for (;;) {
        // (F A): insert '(' at start, then ' ' A ')'
        insertAt(start, '(', o.from, o.to);
        out.put(' ', o.from, o.to);
        expr();
        out.put(')', o.from, o.to);
        if (isSym(',')) { k++; continue; }
        break;
      }
      expect(close);
    }
  };
  const insertAt = (pos: number, s: string, from: number, to: number) => {
    out.text = out.text.slice(0, pos) + s + out.text.slice(pos);
    out.map.splice(pos, 0, ...Array(s.length).fill(from));
    out.ends.splice(pos, 0, ...Array(s.length).fill(to));
  };

  const exprLisp = (): void => {
    const t = peek();
    if (!t) err('Unexpected end of input');
    if (t.k === 'id') { k++; emitId(t); return; }
    if (t.k === 'num') { k++; out.put(t.s, t.from, t.to); return; }
    if (t.k === 'sym' && (t.s === '(' || t.s === '[')) {
      const o = toks[k++];
      const close = o.s === '(' ? ')' : ']';
      const h = peek();
      if (h?.k === 'id' && (h.s === 'lambda' || h.s === 'λ')) {
        k++;
        const po = peek();
        if (!(po?.k === 'sym' && (po.s === '(' || po.s === '['))) err('Expected a parameter list');
        const pclose = po.s === '(' ? ')' : ']';
        k++;
        const names: Tok[] = [];
        while (peek()?.k === 'id') names.push(ident());
        expect(pclose);
        if (!names.length) err('Functions need at least one parameter');
        lamOpen(names, h); exprLisp(); out.put(')', h.from, h.to); expect(close); return;
      }
      // application (f a b ...) — left-nested
      const start = out.text.length;
      if (isSym(close)) err('Empty application');
      exprLisp();
      while (!isSym(close)) {
        if (!peek()) err(`Expected '${close}'`);
        insertAt(start, '(', o.from, o.to); out.put(' ', o.from, o.to); exprLisp(); out.put(')', o.from, o.to);
      }
      k++;
      return;
    }
    err(`Unexpected '${t.s}'`);
  };

  const expr = lang === 'js' ? exprJS : lang === 'python' ? exprPy : lang === 'wolfram' ? exprWl : exprLisp;

  // ---- statements
  let first = true;
  while (k < toks.length) {
    const t = peek();
    if (t.k === 'sym' && (t.s === ';')) { k++; continue; }
    if (!first) out.put('\n', t.from, t.from);
    first = false;
    // definitions
    if (lang === 'js' && t.k === 'id' && (t.s === 'const' || t.s === 'let' || t.s === 'var')) {
      k++; const name = ident(); expect('=');
      emitId(name); out.put(' = ', name.to, name.to); expr(); continue;
    }
    if ((lang === 'python' || lang === 'wolfram') && t.k === 'id' && (isSym('=', 1) || isSym(':=', 1))) {
      const name = ident(); k++;
      emitId(name); out.put(' = ', name.to, name.to); expr(); continue;
    }
    if (lang === 'lisp' && t.k === 'sym' && t.s === '(' && peek(1)?.k === 'id' && peek(1).s === 'define') {
      const o = toks[k++]; k++;
      if (isSym('(')) { // (define (f x y) body)
        k++; const name = ident(); const names: Tok[] = [];
        while (peek()?.k === 'id') names.push(ident());
        expect(')');
        emitId(name); out.put(' = ', name.to, name.to);
        if (names.length) { lamOpen(names, name); exprLisp(); out.put(')', name.from, name.to); } else exprLisp();
      } else { const name = ident(); emitId(name); out.put(' = ', name.to, name.to); exprLisp(); }
      expect(')'); void o; continue;
    }
    expr();
  }
  return out.done(src.length);
}

