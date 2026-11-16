import { describe, it, expect } from 'vitest';
import { parseProgram, detectFormat, printTerm, printDeBruijn0 } from '../src/core/program';
import { printNamed } from '../src/core/formats/named';
import { makeFolder } from '../src/core/fold';
import { normalize } from '../src/core/nbe';
import { decodeNumeral } from '../src/core/encodings';
import { equal, app, lam, v } from '../src/core/term';
import { rewriteSource } from '../src/core/edit';

const show = (src: string) => {
  const p = parseProgram(src);
  return printNamed(p.term!, { fold: makeFolder(p.foldTable, { numerals: true, zeroAs: '0' }), avoid: p.foldTable.names }).text;
};
const value = (src: string, opts = {}) => decodeNumeral(normalize(parseProgram(src, 'auto', opts).term!).term!);

describe('P1 fixes', () => {
  it('folding prefers user names over numerals and skips redefined library names', () => {
    expect(show('TWO = λf x.f (f x)\nλg.g TWO')).toBe('λg.g TWO');
    // TRUE redefined: the library term λt f.t must not be shown as TRUE
    expect(show('TRUE = λa b.b\nλg.g (λt f.t)')).not.toContain('TRUE');
  });

  it('library definitions keep their library meaning; recursion uses the library Y', () => {
    expect(value('Y = λf.f\nFACT 3')).toBe(6);
    expect(value('SUCC = λn.n\nLENGTH [1, 2, 3]')).toBe(3);
    expect(value('Y = λf.f\nF = λn.ISZERO n 0 (F (PRED n))\nF 2')).toBe(0);
  });

  it('binary-looking numbers are not BLC', () => {
    for (const s of ['1000', '1111', '10 11', '101']) expect(detectFormat(s)).toBe('named');
    expect(detectFormat('0010')).toBe('blc');
    expect(detectFormat('0000011100111010')).toBe('blc');
  });

  it('single-letter mode keeps defined names whole', () => {
    const p = parseProgram('twice = λf x.f (f x)\ntwice SUCC 0', 'auto', { singleLetter: true });
    expect(p.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(value('twice = λf x.f (f x)\ntwice SUCC 0', { singleLetter: true })).toBe(2);
  });

  it('BLC8 and 0-based de Bruijn round-trip through detection', () => {
    for (const src of ['λx y.x', 'λx y.y', 'λf x.f (f x)', 'λx.x', 'λx y z.x z (y z)']) {
      const t = parseProgram(src).term!;
      for (const fmt of ['blc8', 'debruijn0', 'debruijn1', 'blc'] as const) {
        const text = printTerm(t, fmt);
        const back = parseProgram(text);
        expect(back.format, `${src} as ${fmt}: ${text}`).toBe(fmt);
        expect(equal(back.term!, t)).toBe(true);
      }
    }
    expect(printDeBruijn0(parseProgram('λx y.x').term!)).toContain('0-based');
    expect(printDeBruijn0(parseProgram('λx y.y').term!)).toBe('λλ0');
  });

  it('rewriting the source keeps definitions that do not parse', () => {
    expect(rewriteSource('-- hi\nA = λx.x\nB = (λx.\nC = 2\nA C', 'C')).toBe('-- hi\nA = λx.x\nB = (λx.\nC = 2\nC\n');
    expect(rewriteSource('A = λx.x\nB = λ@.x\nA', 'A')).toContain('B = λ@.x');
  });

  it('the fast normalizer keeps dangling indices and can η-reduce', () => {
    // (λx.x) 0 under no binder: the dangling index stays index 0, at any depth
    expect(equal(normalize(app(lam(v(0)), v(0))).term!, v(0))).toBe(true);
    expect(equal(normalize(lam(app(lam(v(0)), v(1)))).term!, lam(v(1)))).toBe(true);
    // λx.(λy.f y) x with f dangling →β λx.f x →η f
    const t = lam(app(lam(app(v(2), v(0))), v(0)));
    expect(equal(normalize(t).term!, lam(app(v(1), v(0))))).toBe(true);
    expect(equal(normalize(t, 1000, true).term!, v(0))).toBe(true);
  });
});
