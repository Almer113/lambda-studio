import { describe, it, expect } from 'vitest';
import { encodeData, decodeScottNumeral, decodeParigotNumeral, decodeBinaryNumeral, decodeScottList, describeMore, DATA_KINDS } from '../src/core/data';
import { decodeNumeral, decodeBool, decodeList, describe as describeData } from '../src/core/encodings';
import { parseProgram } from '../src/core/program';
import { normalize } from '../src/core/nbe';
import { app, type Term } from '../src/core/term';

const P = (s: string) => parseProgram(s, 'auto').term!;
const nf = (t: Term) => normalize(t).term!;

describe('data encodings', () => {
  it('naturals round-trip in every encoding', () => {
    for (let n = 0; n <= 20; n++) {
      expect(decodeNumeral(encodeData('nat', 'church', String(n)))).toBe(n);
      expect(decodeScottNumeral(encodeData('nat', 'scott', String(n)))).toBe(n);
      expect(decodeParigotNumeral(encodeData('nat', 'parigot', String(n)))).toBe(n);
      expect(decodeBinaryNumeral(encodeData('nat', 'binary', String(n)))).toBe(n);
    }
    expect(() => encodeData('nat', 'parigot', '21')).toThrow(/too large/);
    expect(() => encodeData('nat', 'church', 'x')).toThrow();
  });
  it('Scott numerals support constant-time predecessor', () => {
    // PRED_S = λn. n 0 (λp.p) applied to Scott 5 gives Scott 4
    const five = encodeData('nat', 'scott', '5');
    const pred = P('λn. n (λz s.z) (λp.p)');
    expect(decodeScottNumeral(nf(app(pred, five)))).toBe(4);
  });
  it('Parigot numerals support both recursion and predecessor', () => {
    // as an iterator: n z s with s = λp r. SUCC r and z = 0 gives the Church numeral
    const four = encodeData('nat', 'parigot', '4');
    const toChurch = P('λn. n 0 (λp r. SUCC r)');
    expect(decodeNumeral(nf(app(toChurch, four)))).toBe(4);
  });
  it('lists, strings, pairs, Maybe and Either', () => {
    expect(decodeList(encodeData('list', 'church', '1, 2, 3'))!.map(decodeNumeral)).toEqual([1, 2, 3]);
    expect(decodeScottList(encodeData('list', 'scott', '1, 2, 3'))!.map(decodeNumeral)).toEqual([1, 2, 3]);
    expect(decodeScottList(encodeData('list', 'scott', ''))).toEqual([]);
    expect(describeData(encodeData('string', 'church', 'hi')).map((d) => d.text)).toContain('string "hi"');
    expect(describeMore(encodeData('string', 'scott', 'hi'))).toContain('Scott string "hi"');
    expect(describeData(encodeData('pair', 'church', '3, 4')).map((d) => d.text)).toContain('pair (3, 4)');
    expect(describeMore(encodeData('maybe', 'scott', '7'))).toContain('Just 7 / Right 7');
    expect(describeMore(encodeData('either', 'scott', 'L 3'))).toContain('Left 3');
    expect(decodeBool(encodeData('bool', 'church', 'false'))).toBe(false);
  });
  it('every data kind encodes its placeholder example', () => {
    for (const k of DATA_KINDS) for (const e of k.encodings) expect(() => encodeData(k.id, e, k.placeholder), `${k.id}/${e}`).not.toThrow();
  });
});
