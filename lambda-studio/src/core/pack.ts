// Flat encoding of terms for postMessage. Structured clone recurses, so deeply nested terms
// (e.g. the Church numeral 5000) overflow its stack; a flat Int32Array does not.

import { type Term, v, free, lam, app } from './term';

export interface Packed { __packed: 1; code: Int32Array; strs: string[] }

const VAR = 0, FREE = 1, LAM = 2, APP = 3;

export function pack(t: Term): Packed {
  const code: number[] = [];
  const strs: string[] = [];
  const idx = new Map<string, number>();
  const str = (s: string | undefined) => {
    if (s === undefined) return -1;
    let k = idx.get(s);
    if (k === undefined) { k = strs.length; strs.push(s); idx.set(s, k); }
    return k;
  };
  const stack: Term[] = [t];
  while (stack.length) {
    const n = stack.pop()!;
    switch (n.tag) {
      case 'var': code.push(VAR, n.i); break;
      case 'free': code.push(FREE, str(n.name)); break;
      case 'lam': code.push(LAM, str(n.hint)); stack.push(n.body); break;
      case 'app': code.push(APP, 0); stack.push(n.arg, n.fn); break;
    }
  }
  return { __packed: 1, code: Int32Array.from(code), strs };
}

export function unpack(p: Packed): Term {
  const out: Term[] = [];
  const { code, strs } = p;
  for (let k = code.length - 2; k >= 0; k -= 2) {
    const op = code[k], x = code[k + 1];
    if (op === VAR) out.push(v(x));
    else if (op === FREE) out.push(free(strs[x]));
    else if (op === LAM) out.push(lam(out.pop()!, x < 0 ? undefined : strs[x]));
    else { const fn = out.pop()!, arg = out.pop()!; out.push(app(fn, arg)); }
  }
  return out[0];
}

const isTerm = (x: unknown): x is Term =>
  !!x && typeof x === 'object' && 'tag' in x && ['var', 'free', 'lam', 'app'].includes((x as { tag: string }).tag);

/** Replace every term inside a message (objects and arrays) with its packed form. */
export function packDeep<T>(x: T): T {
  if (isTerm(x)) return pack(x) as unknown as T;
  if (Array.isArray(x)) return x.map(packDeep) as unknown as T;
  if (x && typeof x === 'object' && !(x instanceof Int32Array)) {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(x)) o[k] = packDeep(val);
    return o as T;
  }
  return x;
}

export function unpackDeep<T>(x: T): T {
  if (x && typeof x === 'object' && (x as { __packed?: number }).__packed === 1) return unpack(x as unknown as Packed) as unknown as T;
  if (Array.isArray(x)) return x.map(unpackDeep) as unknown as T;
  if (x && typeof x === 'object' && !(x instanceof Int32Array)) {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(x)) o[k] = unpackDeep(val);
    return o as T;
  }
  return x;
}
