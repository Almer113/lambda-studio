// Data ↔ λ encodings beyond Church numerals: Scott and Parigot naturals, binary naturals,
// Scott lists, Maybe and Either. Each encoding has an encoder and a decoder.

import { type Term, app, lam, v, isClosed, maxFree } from './term';
import { shift } from './debruijn';
import { churchNumeral, churchList, churchTrue, churchFalse, decodeNumeral, decodeBool, decodeList } from './encodings';

// ---------------------------------------------------------------------------
// Naturals

/** Scott: 0 = λz s.z, n+1 = λz s.s n */
export function scottNumeral(n: number): Term {
  let t: Term = lam(lam(v(1), 's'), 'z');
  for (let k = 0; k < n; k++) t = lam(lam(app(v(0), shift(t, 2)), 's'), 'z');
  return t;
}
export function decodeScottNumeral(t: Term): number | null {
  let n = 0;
  for (;;) {
    if (t.tag !== 'lam' || t.body.tag !== 'lam') return null;
    const b = t.body.body;
    if (b.tag === 'var' && b.i === 1) return n;
    if (b.tag !== 'app' || b.fn.tag !== 'var' || b.fn.i !== 0 || maxFree(b.arg) > 0) return null;
    t = shift(b.arg, -2);
    n++;
  }
}

/** Parigot numerals contain their predecessor twice, so their printed size doubles with n. */
export const PARIGOT_MAX = 20;
function parigotLimit(n: number): number {
  if (n > PARIGOT_MAX) throw new Error(`Parigot numerals above ${PARIGOT_MAX} are too large to print (size doubles with each step)`);
  return n;
}

/** Parigot: 0 = λz s.z, n+1 = λz s.s n (n z s) */
export function parigotNumeral(n: number): Term {
  let t: Term = lam(lam(v(1), 's'), 'z');
  for (let k = 0; k < n; k++) {
    const p = shift(t, 2);
    t = lam(lam(app(app(v(0), p), app(app(p, v(1)), v(0))), 's'), 'z');
  }
  return t;
}
export function decodeParigotNumeral(t: Term): number | null {
  // check the structure recursively: λz s. s p (p z s), p a Parigot numeral one smaller
  const m = decodeScottLike(t);
  if (m === null || m > PARIGOT_MAX) return null;
  return equalShape(t, parigotNumeral(m)) ? m : null;
}
function decodeScottLike(t: Term): number | null {
  let n = 0;
  for (;;) {
    if (t.tag !== 'lam' || t.body.tag !== 'lam') return null;
    const b = t.body.body;
    if (b.tag === 'var' && b.i === 1) return n;
    if (b.tag !== 'app' || b.fn.tag !== 'app' || b.fn.fn.tag !== 'var' || b.fn.fn.i !== 0 || maxFree(b.fn.arg) > 0) return null;
    t = shift(b.fn.arg, -2);
    n++;
    if (n > 100000) return null;
  }
}
function equalShape(a: Term, b: Term): boolean {
  if (a.tag !== b.tag) return false;
  switch (a.tag) {
    case 'var': return a.i === (b as typeof a).i;
    case 'free': return a.name === (b as typeof a).name;
    case 'lam': return equalShape(a.body, (b as typeof a).body);
    case 'app': return equalShape(a.fn, (b as typeof a).fn) && equalShape(a.arg, (b as typeof a).arg);
  }
}

/** Binary: Church list of Church booleans, least significant bit first, no trailing FALSE (0 = []). */
export function binaryNumeral(n: number): Term {
  const bits: Term[] = [];
  for (let m = n; m > 0; m = Math.floor(m / 2)) bits.push(m % 2 ? churchTrue : churchFalse);
  return churchList(bits);
}
export function decodeBinaryNumeral(t: Term): number | null {
  const l = decodeList(t);
  if (l === null) return null;
  let n = 0, w = 1;
  for (const it of l) { const b = decodeBool(it); if (b === null) return null; if (b) n += w; w *= 2; }
  if (l.length && decodeBool(l[l.length - 1]) === false) return null;
  return n;
}

// ---------------------------------------------------------------------------
// Lists, Maybe, Either

/** Scott list: nil = λn c.n, cons h t = λn c.c h t (items are closed terms). */
export function scottList(items: Term[]): Term {
  let t: Term = lam(lam(v(1), 'c'), 'n');
  for (let k = items.length - 1; k >= 0; k--) t = lam(lam(app(app(v(0), shift(items[k], 2)), shift(t, 2)), 'c'), 'n');
  return t;
}
export function decodeScottList(t: Term): Term[] | null {
  const out: Term[] = [];
  for (;;) {
    if (t.tag !== 'lam' || t.body.tag !== 'lam') return null;
    const b = t.body.body;
    if (b.tag === 'var' && b.i === 1) return out;
    if (b.tag !== 'app' || b.fn.tag !== 'app' || b.fn.fn.tag !== 'var' || b.fn.fn.i !== 0) return null;
    if (maxFree(b.fn.arg) > 0 || maxFree(b.arg) > 0) return null;
    out.push(shift(b.fn.arg, -2));
    t = shift(b.arg, -2);
    if (out.length > 100000) return null;
  }
}

/** Maybe: Nothing = λn j.n, Just x = λn j.j x */
export const nothing: Term = lam(lam(v(1), 'j'), 'n');
export const just = (x: Term): Term => lam(lam(app(v(0), shift(x, 2)), 'j'), 'n');
/** Either: Left x = λl r.l x, Right y = λl r.r y */
export const left = (x: Term): Term => lam(lam(app(v(1), shift(x, 2)), 'r'), 'l');
export const right = (y: Term): Term => lam(lam(app(v(0), shift(y, 2)), 'r'), 'l');

function decodeTagged(t: Term): { index: 0 | 1; arg: Term } | null {
  if (t.tag !== 'lam' || t.body.tag !== 'lam') return null;
  const b = t.body.body;
  if (b.tag !== 'app' || b.fn.tag !== 'var' || (b.fn.i !== 0 && b.fn.i !== 1) || maxFree(b.arg) > 0) return null;
  return { index: b.fn.i === 1 ? 0 : 1, arg: shift(b.arg, -2) };
}

// ---------------------------------------------------------------------------
// Encoding UI model

export type DataKind = 'nat' | 'bool' | 'list' | 'string' | 'pair' | 'maybe' | 'either';
export type Encoding = 'church' | 'scott' | 'parigot' | 'binary';

export const DATA_KINDS: { id: DataKind; name: string; encodings: Encoding[]; placeholder: string; hint: string }[] = [
  { id: 'nat', name: 'Natural number', encodings: ['church', 'scott', 'parigot', 'binary'], placeholder: '5', hint: 'A whole number ≥ 0' },
  { id: 'bool', name: 'Boolean', encodings: ['church'], placeholder: 'true', hint: 'true or false' },
  { id: 'list', name: 'List of naturals', encodings: ['church', 'scott'], placeholder: '1, 2, 3', hint: 'Comma-separated numbers (items are Church numerals)' },
  { id: 'string', name: 'String', encodings: ['church', 'scott'], placeholder: 'hi', hint: 'Text: a list of Church-numeral code points' },
  { id: 'pair', name: 'Pair of naturals', encodings: ['church'], placeholder: '3, 4', hint: 'Two comma-separated numbers' },
  { id: 'maybe', name: 'Maybe natural', encodings: ['scott'], placeholder: '7', hint: 'A number for Just n, empty for Nothing' },
  { id: 'either', name: 'Either natural', encodings: ['scott'], placeholder: 'L 3', hint: 'L n for Left, R n for Right' },
];

export const ENCODING_NAMES: Record<Encoding, string> = { church: 'Church', scott: 'Scott', parigot: 'Parigot', binary: 'Binary (bit list)' };

const MAX = 5000;

function nat(s: string): number {
  const t = s.trim();
  if (!/^\d+$/.test(t)) throw new Error(`'${t || '(empty)'}' is not a whole number`);
  const n = Number(t);
  if (n > MAX) throw new Error(`Numbers above ${MAX} make very large terms`);
  return n;
}

export function encodeData(kind: DataKind, enc: Encoding, value: string): Term {
  switch (kind) {
    case 'nat': {
      const n = nat(value);
      return enc === 'scott' ? scottNumeral(n) : enc === 'parigot' ? parigotNumeral(parigotLimit(n)) : enc === 'binary' ? binaryNumeral(n) : churchNumeral(n);
    }
    case 'bool': {
      const b = value.trim().toLowerCase();
      if (b === 'true' || b === '1' || b === 't') return churchTrue;
      if (b === 'false' || b === '0' || b === 'f') return churchFalse;
      throw new Error('Expected true or false');
    }
    case 'list': {
      const items = value.trim() === '' ? [] : value.split(',').map((x) => churchNumeral(nat(x)));
      return enc === 'scott' ? scottList(items) : churchList(items);
    }
    case 'string': {
      const items = [...value].map((ch) => churchNumeral(ch.codePointAt(0)!));
      return enc === 'scott' ? scottList(items) : churchList(items);
    }
    case 'pair': {
      const parts = value.split(',');
      if (parts.length !== 2) throw new Error('Expected two numbers separated by a comma');
      const [a, b] = parts.map((x) => churchNumeral(nat(x)));
      return lam(app(app(v(0), shift(a, 1)), shift(b, 1)), 's');
    }
    case 'maybe': return value.trim() === '' ? nothing : just(churchNumeral(nat(value)));
    case 'either': {
      const m = /^\s*([LR])\s+(\d+)\s*$/i.exec(value);
      if (!m) throw new Error('Expected L n or R n');
      const x = churchNumeral(nat(m[2]));
      return m[1].toUpperCase() === 'L' ? left(x) : right(x);
    }
  }
}

/** Extra readings (beyond Church data, which `describe` covers). */
export function describeMore(t: Term): string[] {
  if (!isClosed(t)) return [];
  const out: string[] = [];
  const s = decodeScottNumeral(t);
  if (s !== null && s > 0) out.push(`Scott numeral ${s}`);
  const p = decodeParigotNumeral(t);
  if (p !== null && p > 1) out.push(`Parigot numeral ${p}`);
  const bin = decodeBinaryNumeral(t);
  if (bin !== null && bin > 0) out.push(`binary numeral ${bin}`);
  const sl = decodeScottList(t);
  if (sl !== null && sl.length > 0) {
    const nums = sl.map(decodeNumeral);
    if (nums.every((n) => n !== null)) {
      out.push(`Scott list [${nums.join(', ')}]`);
      if ((nums as number[]).every((c) => c >= 32 && c < 0x10ffff)) out.push(`Scott string "${String.fromCodePoint(...(nums as number[]))}"`);
    }
  }
  const tg = decodeTagged(t);
  if (tg) {
    // only when the payload is a number, to keep the list of readings short
    const n = decodeNumeral(tg.arg);
    if (n !== null) out.push(tg.index === 1 ? `Just ${n} / Right ${n}` : `Left ${n}`);
  }
  return out;
}
