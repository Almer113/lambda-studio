// De Bruijn index notation, 0- or 1-based:  λλ1 (1 0)   or Tromp style  λλ2 (2 1)

import { type Term, type Path, app, lam, v, free, maxFree } from '../term';
import { ParseError, SPAN_PATH_LIMIT, type Printed, type Span } from './named';
import { run, call, type Rec } from '../trampoline';

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

  function* expr(): Rec<Parsed> {
    if (isLam(peek())) {
      const from = i;
      i++;
      if (peek() === '.') i++;
      const body = yield* call(expr());
      return { t: lam(body.t), s: { from, to: body.s.to, kids: [body.s] } };
    }
    let acc = yield* call(atom());
    for (;;) {
      const d = peek();
      if (d === undefined || d === ')') break;
      const arg = yield* call(isLam(d) ? expr() : atom());
      acc = { t: app(acc.t, arg.t), s: { from: acc.s.from, to: arg.s.to, kids: [acc.s, arg.s] } };
      if (isLam(d)) break;
    }
    return acc;
  }
  function* atom(): Rec<Parsed> {
    const c = peek();
    const from = i;
    if (c === '(') {
      i++;
      const e = yield* call(expr());
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
  }
  const r = run(expr());
  skip();
  if (i < src.length) throw new ParseError(`Unexpected '${src[i]}'`, i, i + 1);
  if (spans) {
    const todo: [Term, SpanTree, Path][] = [[r.t, r.s, '']];
    while (todo.length) {
      const [t, s, p] = todo.pop()!;
      if (p.length > SPAN_PATH_LIMIT) continue;
      spans.set(p, { from: s.from, to: s.to });
      if (t.tag === 'lam') todo.push([t.body, s.kids[0], p + 'b']);
      else if (t.tag === 'app') todo.push([t.arg, s.kids[1], p + 'a'], [t.fn, s.kids[0], p + 'f']);
    }
  }
  return r.t;
}

export function printDeBruijn(t: Term, base: 0 | 1, lambda = 'λ'): Printed {
  let out = '';
  const spans: Printed['spans'] = [];
  // explicit task stack (tasks pushed in reverse order): terms can be very deep
  const tasks: (() => void)[] = [];
  const text = (s: string) => tasks.push(() => { out += s; });
  const emit = (n: Term, path: Path, pos: 'top' | 'fn' | 'arg') => tasks.push(() => visit(n, path, pos));
  const visit = (n: Term, path: Path, pos: 'top' | 'fn' | 'arg') => {
    const start = out.length;
    const finish = () => tasks.push(() => spans.push({ path, from: start, to: out.length }));
    switch (n.tag) {
      case 'var': out += String(n.i + base); spans.push({ path, from: start, to: out.length }); break;
      case 'free': out += n.name; spans.push({ path, from: start, to: out.length }); break;
      case 'lam': {
        const paren = pos !== 'top';
        out += (paren ? '(' : '') + lambda;
        finish();
        if (paren) text(')');
        emit(n.body, path + 'b', 'top');
        break;
      }
      case 'app': {
        finish();
        if (n.arg.tag === 'app') { text(')'); emit(n.arg, path + 'a', 'top'); text(' ('); }
        else { emit(n.arg, path + 'a', 'arg'); text(' '); }
        emit(n.fn, path + 'f', 'fn');
        break;
      }
    }
  };
  emit(t, '', 'top');
  while (tasks.length) tasks.pop()!();
  return { text: out, spans };
}

/** Is the de Bruijn source closed under the given base? (null if it doesn't parse) */
export function deBruijnClosedUnder(src: string, base: 0 | 1): boolean | null {
  let t: Term;
  try { t = parseDeBruijn(src, base); } catch { return null; }
  return maxFree(t) === 0;
}
