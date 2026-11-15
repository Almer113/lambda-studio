// De Bruijn index notation, 0- or 1-based:  λλ1 (1 0)   or Tromp style  λλ2 (2 1)

import { type Term, type Path, app, lam, v, free } from '../term';
import { ParseError, type Printed, type Span } from './named';

interface SpanTree { from: number; to: number; kids: SpanTree[] }
interface Parsed { t: Term; s: SpanTree }

export function parseDeBruijn(src: string, base: 0 | 1, spans?: Map<Path, Span>): Term {
  let i = 0;
  const skip = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src.startsWith('--', i) || src.startsWith('//', i) || src[i] === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
      break;
    }
  };
  const peek = () => { skip(); return src[i] as string | undefined; };
  const isLam = (c: string | undefined) => c === 'λ' || c === '\\';

  const expr = (): Parsed => {
    if (isLam(peek())) {
      const from = i;
      i++;
      if (peek() === '.') i++;
      const body = expr();
      return { t: lam(body.t), s: { from, to: body.s.to, kids: [body.s] } };
    }
    let acc = atom();
    for (;;) {
      const d = peek();
      if (d === undefined || d === ')') break;
      const arg = isLam(d) ? expr() : atom();
      acc = { t: app(acc.t, arg.t), s: { from: acc.s.from, to: arg.s.to, kids: [acc.s, arg.s] } };
      if (isLam(d)) break;
    }
    return acc;
  };
  const atom = (): Parsed => {
    const c = peek();
    const from = i;
    if (c === '(') {
      i++;
      const e = expr();
      if (peek() !== ')') throw new ParseError("Expected ')'", i, i + 1);
      i++;
      return { t: e.t, s: { ...e.s, from, to: i } };
    }
    if (c !== undefined && /[0-9]/.test(c)) {
      let j = i; while (j < src.length && /[0-9]/.test(src[j])) j++;
      const n = Number(src.slice(i, j)) - base;
      if (n < 0) throw new ParseError('Index 0 is not valid in 1-based de Bruijn notation', i, j);
      i = j;
      return { t: v(n), s: { from, to: i, kids: [] } };
    }
    if (c !== undefined && /[\p{L}_]/u.test(c) && c !== 'λ') {
      let j = i; while (j < src.length && /[\p{L}\p{N}_']/u.test(src[j]) && src[j] !== 'λ') j++;
      const name = src.slice(i, j);
      i = j;
      return { t: free(name), s: { from, to: i, kids: [] } };
    }
    throw new ParseError(c === undefined ? 'Unexpected end of input' : `Unexpected '${c}'`, i, i + 1);
  };
  const r = expr();
  skip();
  if (i < src.length) throw new ParseError(`Unexpected '${src[i]}'`, i, i + 1);
  if (spans) {
    const walk = (t: Term, s: SpanTree, p: Path) => {
      spans.set(p, { from: s.from, to: s.to });
      if (t.tag === 'lam') walk(t.body, s.kids[0], p + 'b');
      else if (t.tag === 'app') { walk(t.fn, s.kids[0], p + 'f'); walk(t.arg, s.kids[1], p + 'a'); }
    };
    walk(r.t, r.s, '');
  }
  return r.t;
}

export function printDeBruijn(t: Term, base: 0 | 1, lambda = 'λ'): Printed {
  let out = '';
  const spans: Printed['spans'] = [];
  const emit = (n: Term, path: Path, pos: 'top' | 'fn' | 'arg') => {
    const start = out.length;
    switch (n.tag) {
      case 'var': out += String(n.i + base); break;
      case 'free': out += n.name; break;
      case 'lam': {
        const paren = pos !== 'top';
        if (paren) out += '(';
        out += lambda;
        emit(n.body, path + 'b', 'top');
        if (paren) out += ')';
        break;
      }
      case 'app': {
        emit(n.fn, path + 'f', 'fn');
        out += ' ';
        if (n.arg.tag === 'app') { out += '('; emit(n.arg, path + 'a', 'top'); out += ')'; }
        else emit(n.arg, path + 'a', 'arg');
        break;
      }
    }
    spans.push({ path, from: start, to: out.length });
  };
  emit(t, '', 'top');
  return { text: out, spans };
}

/** Is the de Bruijn source closed under the given base? (null if it doesn't parse) */
export function deBruijnClosedUnder(src: string, base: 0 | 1): boolean | null {
  let t: Term;
  try { t = parseDeBruijn(src, base); } catch { return null; }
  const check = (n: Term, d: number): boolean =>
    n.tag === 'var' ? n.i < d : n.tag === 'lam' ? check(n.body, d + 1) : n.tag === 'app' ? check(n.fn, d) && check(n.arg, d) : true;
  return check(t, 0);
}
