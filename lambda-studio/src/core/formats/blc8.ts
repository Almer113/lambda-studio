// BLC8: binary λ-calculus bits packed into bytes (most significant bit first, last byte padded
// with zeros), written as hex or base64.

import { ParseError } from './named';

export function bitsToBytes(bits: string): Uint8Array {
  const out = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) if (bits[i] === '1') out[i >> 3] |= 0x80 >> (i & 7);
  return out;
}

export function bytesToBits(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(2).padStart(8, '0');
  return s;
}

/** `0x07 0x3a`: the 0x prefix makes the text read back as bytes (`07 3a` would look like numbers). */
export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => '0x' + b.toString(16).padStart(2, '0')).join(' ');
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}

/** Hex (`0x05 73 a0`, `0573a0`, `\x05\x73`) or base64 (`BXOg`). */
export function parseBytes(src: string): Uint8Array {
  const s = src.trim();
  const hex = s.replace(/0x|\\x|[\s,]/gi, '');
  if (/^[0-9a-f]*$/i.test(hex) && (/^(0x|\\x)/i.test(s) || /^[0-9a-f\s,]+$/i.test(s))) {
    if (hex.length % 2) throw new ParseError('Hex input needs an even number of digits', 0, src.length);
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
    return out;
  }
  const b = s.replace(/\s/g, '').replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]*$/.test(b)) throw new ParseError('Expected hex bytes or base64', 0, src.length);
  const out: number[] = [];
  let acc = 0, n = 0;
  for (const c of b) {
    acc = (acc << 6) | B64.indexOf(c); n += 6;
    if (n >= 8) { n -= 8; out.push((acc >> n) & 0xff); }
  }
  return new Uint8Array(out);
}
