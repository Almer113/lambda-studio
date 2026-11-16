// Binary Lambda Calculus (John Tromp): λM = 00 M, MN = 01 M N, variable i (1-based) = 1^i 0.

import { type Term, app, lam, v } from '../term';
import { ParseError } from './named';
import { run, call, type Rec } from '../trampoline';

export function encodeBLC(t: Term): string {
  const parts: string[] = [];
  const stack: Term[] = [t];
  while (stack.length) {
    const n = stack.pop()!;
    switch (n.tag) {
      case 'var': parts.push('1'.repeat(n.i + 1) + '0'); break;
      case 'free': throw new Error(`BLC cannot encode the free variable '${n.name}'`);
      case 'lam': parts.push('00'); stack.push(n.body); break;
      case 'app': parts.push('01'); stack.push(n.arg, n.fn); break;
    }
  }
  return parts.join('');
}

/** Size in bits without building the string. Free names count as 0. */
export function blcBits(t: Term): number {
  let bits = 0;
  const stack: Term[] = [t];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.tag === 'var') bits += n.i + 2;
    else if (n.tag === 'lam') { bits += 2; stack.push(n.body); }
    else if (n.tag === 'app') { bits += 2; stack.push(n.fn, n.arg); }
  }
  return bits;
}

export interface BLCDecode { term: Term; used: number; trailing: number }

export function decodeBLC(src: string): BLCDecode {
  // keep a map from bit index to source offset for error messages
  const offsets: number[] = [];
  let bits = '';
  for (let k = 0; k < src.length; k++) {
    const c = src[k];
    if (c === '0' || c === '1') { bits += c; offsets.push(k); }
    else if (!/\s/.test(c)) throw new ParseError(`Unexpected '${c}' in binary lambda calculus (only 0 and 1)`, k, k + 1);
  }
  let i = 0;
  const err = (msg: string): never => {
    const at = offsets[Math.min(i, offsets.length - 1)] ?? 0;
    throw new ParseError(msg, at, at + 1);
  };
  function* parse(): Rec<Term> {
    if (i >= bits.length) err('Unexpected end of bits');
    if (bits[i] === '0') {
      if (i + 1 >= bits.length) err('Unexpected end of bits');
      const b = bits[i + 1];
      i += 2;
      if (b === '0') return lam(yield* call(parse()));
      const f = yield* call(parse());
      return app(f, yield* call(parse()));
    }
    let n = 0;
    while (i < bits.length && bits[i] === '1') { n++; i++; }
    if (i >= bits.length) err('Variable not terminated by 0');
    i++;
    return v(n - 1);
  }
  const term = run(parse());
  return { term, used: i, trailing: bits.length - i };
}

/** Pack bits into bytes (BLC8-style, MSB first, zero-padded) as hex. */
export function bitsToHex(bits: string): string {
  let out = '';
  for (let k = 0; k < bits.length; k += 8) out += parseInt(bits.slice(k, k + 8).padEnd(8, '0'), 2).toString(16).padStart(2, '0');
  return out;
}
