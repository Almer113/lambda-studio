import { type Term, app, lam, v, free } from '../term';
import { ParseError } from './named';

type JNode =
  | { type: 'var'; index: number }
  | { type: 'free'; name: string }
  | { type: 'lam'; name?: string; body: JNode }
  | { type: 'app'; fn: JNode; arg: JNode };

export function toJSONNode(t: Term): JNode {
  switch (t.tag) {
    case 'var': return { type: 'var', index: t.i };
    case 'free': return { type: 'free', name: t.name };
    case 'lam': return t.hint ? { type: 'lam', name: t.hint, body: toJSONNode(t.body) } : { type: 'lam', body: toJSONNode(t.body) };
    case 'app': return { type: 'app', fn: toJSONNode(t.fn), arg: toJSONNode(t.arg) };
  }
}

export const printJSON = (t: Term) => JSON.stringify(toJSONNode(t), null, 1);

export function parseJSON(src: string): Term {
  let data: unknown;
  try { data = JSON.parse(src); }
  catch (e) { throw new ParseError(`Invalid JSON: ${(e as Error).message}`, 0, src.length); }
  const conv = (n: unknown): Term => {
    if (typeof n !== 'object' || n === null) throw new ParseError('Expected an object node', 0, src.length);
    const o = n as Record<string, unknown>;
    switch (o.type) {
      case 'var':
        if (typeof o.index !== 'number' || o.index < 0 || !Number.isInteger(o.index)) throw new ParseError('var.index must be a non-negative integer', 0, src.length);
        return v(o.index);
      case 'free':
        if (typeof o.name !== 'string') throw new ParseError('free.name must be a string', 0, src.length);
        return free(o.name);
      case 'lam': return lam(conv(o.body), typeof o.name === 'string' ? o.name : undefined);
      case 'app': return app(conv(o.fn), conv(o.arg));
      default: throw new ParseError(`Unknown node type ${JSON.stringify(o.type)}`, 0, src.length);
    }
  };
  return conv(data);
}
