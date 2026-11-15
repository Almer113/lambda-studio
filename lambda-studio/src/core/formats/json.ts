import { type Term, app, lam, v, free, counts } from '../term';
import { ParseError } from './named';

/** Nesting depth above which JSON is printed compactly: indented output grows with depth². */
const PRETTY_DEPTH = 500;

/**
 * JSON AST, written iteratively (JSON.stringify recurses and overflows on deep terms). Matches
 * JSON.stringify(node, null, 1) up to PRETTY_DEPTH levels, and JSON.stringify(node) beyond.
 */
export function printJSON(t: Term): string {
  const pretty = counts(t).depth <= PRETTY_DEPTH;
  const parts: string[] = [];
  const nl = (d: number) => (pretty ? '\n' + ' '.repeat(d) : '');
  const colon = pretty ? ': ' : ':';
  const key = (k: string, d: number, first = false) => (first ? '' : ',') + nl(d) + JSON.stringify(k) + colon;
  // tasks: a string to append, or a node to open at an indent depth
  const tasks: (string | [Term, number])[] = [[t, 0]];
  while (tasks.length) {
    const x = tasks.pop()!;
    if (typeof x === 'string') { parts.push(x); continue; }
    const [n, d] = x, d1 = d + 1;
    const close = nl(d) + '}';
    switch (n.tag) {
      case 'var': parts.push('{' + key('type', d1, true) + '"var"' + key('index', d1) + n.i + close); break;
      case 'free': parts.push('{' + key('type', d1, true) + '"free"' + key('name', d1) + JSON.stringify(n.name) + close); break;
      case 'lam':
        parts.push('{' + key('type', d1, true) + '"lam"' + (n.hint ? key('name', d1) + JSON.stringify(n.hint) : '') + key('body', d1));
        tasks.push(close, [n.body, d1]);
        break;
      case 'app':
        parts.push('{' + key('type', d1, true) + '"app"' + key('fn', d1));
        tasks.push(close, [n.arg, d1], key('arg', d1), [n.fn, d1]);
        break;
    }
  }
  return parts.join('');
}

export function parseJSON(src: string): Term {
  let data: unknown;
  try { data = JSON.parse(src); }
  catch (e) { throw new ParseError(`Invalid JSON: ${(e as Error).message}`, 0, src.length); }
  const bad = (msg: string) => new ParseError(msg, 0, src.length);
  // iterative post-order conversion: the JSON may be nested very deeply
  const nodes: unknown[] = [data], post: boolean[] = [false], out: Term[] = [];
  while (nodes.length) {
    const n = nodes.pop(), done = post.pop()!;
    if (typeof n !== 'object' || n === null) throw bad('Expected an object node');
    const o = n as Record<string, unknown>;
    if (done) {
      if (o.type === 'lam') out.push(lam(out.pop()!, typeof o.name === 'string' ? o.name : undefined));
      else { const a = out.pop()!, f = out.pop()!; out.push(app(f, a)); }
      continue;
    }
    switch (o.type) {
      case 'var':
        if (typeof o.index !== 'number' || o.index < 0 || !Number.isInteger(o.index)) throw bad('var.index must be a non-negative integer');
        out.push(v(o.index)); break;
      case 'free':
        if (typeof o.name !== 'string') throw bad('free.name must be a string');
        out.push(free(o.name)); break;
      case 'lam': nodes.push(o, o.body); post.push(true, false); break;
      case 'app': nodes.push(o, o.arg, o.fn); post.push(true, false, false); break;
      default: throw bad(`Unknown node type ${JSON.stringify(o.type)}`);
    }
  }
  return out[0];
}
