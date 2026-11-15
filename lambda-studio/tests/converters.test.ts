import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { type Term, app, lam, v, equal } from '../src/core/term';
import { isEtaRedex, etaContract } from '../src/core/debruijn';
import { normalize } from '../src/core/nbe';
import { toCL, fromCL, printCL, printSKI, parseSKI, parseUnlambda, parseIota, parseJot, parseBCL, parseLazyK, ALGORITHMS, clSize, type CL } from '../src/core/combinators';
import { printCode, codeToNamed, CODE_LANGS } from '../src/core/formats/code';
import { bitsToBytes, bytesToBits, bytesToHex, bytesToBase64, parseBytes } from '../src/core/formats/blc8';
import { parseProgram, detectFormat, printTerm, FORMATS, type FormatId } from '../src/core/program';
import { churchNumeral } from '../src/core/encodings';

const P = (s: string) => parseProgram(s, 'auto').term!;

const closedTerm = (maxDepth = 6): fc.Arbitrary<Term> => {
  const gen = (depth: number, fuel: number): fc.Arbitrary<Term> => {
    const opts: fc.Arbitrary<Term>[] = [];
    if (depth > 0) opts.push(fc.integer({ min: 0, max: depth - 1 }).map((i): Term => v(i)));
    if (fuel > 0) opts.push(fc.constant(null).chain(() => gen(depth + 1, fuel - 1).map((b): Term => lam(b))));
    if (fuel > 0 && depth > 0) opts.push(fc.tuple(gen(depth, fuel - 1), gen(depth, fuel - 1)).map(([f, a]): Term => app(f, a)));
    return fc.oneof(...opts);
  };
  return gen(0, maxDepth);
};

/** η-normalise a β-normal form (bottom-up). */
function etaNormal(t: Term): Term {
  switch (t.tag) {
    case 'lam': { const b = etaNormal(t.body); const l = lam(b); return isEtaRedex(l) ? etaNormal(etaContract(l)) : l; }
    case 'app': return app(etaNormal(t.fn), etaNormal(t.arg));
    default: return t;
  }
}
/** βη-normal form, or null when it does not normalise within the fuel. */
function nf(t: Term): Term | null {
  const r = normalize(t, 20000);
  return r.status === 'normal' && r.term ? etaNormal(r.term) : null;
}
const sameNF = (a: Term, b: Term) => { const x = nf(a), y = nf(b); return x === null || y === null || equal(x, y); };

describe('bracket abstraction', () => {
  it('gives the classic results', () => {
    expect(printSKI(toCL(P('λx.x'), 'turner'))).toBe('I');
    expect(printSKI(toCL(P('λx y.x'), 'turner'))).toBe('K');
    expect(printSKI(toCL(P('λx y.y x'), 'turner'))).toBe('CI');
    expect(printSKI(toCL(P('λf g x.f (g x)'), 'turner'))).toBe('B');
    expect(printSKI(toCL(P('λx.x x'), 'ski'))).toBe('SII');
    expect(printSKI(toCL(P('λx y.x'), 'kiselyov'))).toBe('K');
    expect(printSKI(toCL(P('λx.x'), 'naive'))).toBe('I');
    expect(printSKI(toCL(P('λx y.x'), 'naive'))).toBe('S(KK)I');
  });
  for (const alg of ALGORITHMS) {
    it(`${alg.name} preserves meaning (βη) and uses only its basis`, () => {
      const basis = new Set(alg.basis.split(' '));
      fc.assert(fc.property(closedTerm(), (t) => {
        const c = toCL(t, alg.id);
        const atoms: string[] = [];
        const walk = (x: CL) => { if (x.t === 'a') { walk(x.f); walk(x.a); } else atoms.push(x.t === 'c' ? x.n : '?'); };
        walk(c);
        return atoms.every((a) => basis.has(a)) && sameNF(fromCL(c), t);
      }), { numRuns: 300 });
    });
  }
  it('Turner+ is never larger than SKI + K/η on these terms', () => {
    fc.assert(fc.property(closedTerm(), (t) => clSize(toCL(t, 'turner+')) <= clSize(toCL(t, 'ski'))), { numRuns: 300 });
  });
});

describe('combinator notations', () => {
  it('encodes S, K, I as in the literature', () => {
    const K = toCL(P('λx y.x'), 'ski'), S = toCL(P('λx y z.x z (y z)'), 'ski'), I = toCL(P('λx.x'), 'ski');
    expect(printSKI(S)).toBe('S');
    expect(printCL(K, 'jot')).toBe('11100');
    expect(printCL(S, 'jot')).toBe('11111000');
    expect(printCL(I, 'iota')).toBe('*ii');
    expect(printCL(K, 'iota')).toBe('*i*i*ii');
    expect(printCL(S, 'iota')).toBe('*i*i*i*ii');
    expect(printCL(K, 'bcl')).toBe('00');
    expect(printCL(I, 'bcl')).toBe('11010000'); // (S K) K = 1 1 01 00 00
    expect(printCL(toCL(P('λx.x x'), 'ski'), 'unlambda')).toBe('``sii');
  });
  it('parses SKI strings', () => {
    expect(printSKI(parseSKI('S(KS)K'))).toBe('S(KS)K');
    expect(printSKI(parseSKI('s k k'))).toBe('SKK');
    expect(printSKI(parseSKI("S' B* x"))).toBe("S' B* x");
    expect(() => parseSKI('S(K')).toThrow();
  });
  it('every printer round-trips through its parser (same meaning)', () => {
    const parsers = { ski: parseSKI, unlambda: parseUnlambda, iota: parseIota, jot: parseJot, bcl: parseBCL, lazyk: parseLazyK } as const;
    fc.assert(fc.property(closedTerm(5), (t) => {
      const c = toCL(t, 'turner+');
      for (const style of Object.keys(parsers) as (keyof typeof parsers)[]) {
        const back = parsers[style](printCL(c, style));
        if (!sameNF(fromCL(back), t)) return false;
      }
      return true;
    }), { numRuns: 150 });
  });
  it('Jot and Iota programs mean what they should', () => {
    expect(sameNF(fromCL(parseJot('11100')), P('λx y.x'))).toBe(true);
    expect(sameNF(fromCL(parseIota('*ii')), P('λx.x'))).toBe(true);
    // the empty Jot program is I
    expect(sameNF(fromCL(parseJot('')), P('λx.x'))).toBe(true);
  });
});

describe('code notations', () => {
  it('prints Church 2 in each language', () => {
    const two = churchNumeral(2);
    expect(printCode(two, 'haskell')).toBe('\\f x -> f (f x)');
    expect(printCode(two, 'js')).toBe('f => x => f(f(x))');
    expect(printCode(two, 'python')).toBe('lambda f: lambda x: f(f(x))');
    expect(printCode(two, 'lisp')).toBe('(lambda (f x) (f (f x)))');
    expect(printCode(two, 'wolfram')).toBe('Function[f, Function[x, f[f[x]]]]');
    expect(printCode(P('(λx.x x)(λy.y)'), 'js')).toBe('(x => x(x))(y => y)');
    expect(printCode(P('λx.x (λy.y) x'), 'haskell')).toBe('\\x -> x (\\y -> y) x');
  });
  it('avoids reserved words', () => {
    expect(printCode(lam(v(0), 'in'), 'js')).toBe('x => x');
    expect(printCode(lam(v(0), 'lambda'), 'python')).toBe('lambda x: x');
  });
  it('parses each language, including multi-argument forms', () => {
    const two = churchNumeral(2);
    for (const src of ['\\f x -> f (f x)', 'f => x => f(f(x))', '(f, x) => f(f(x))', 'lambda f, x: f(f(x))', 'lambda f: lambda x: f(f(x))',
      '(lambda (f x) (f (f x)))', '(lambda (f) (lambda (x) (f (f x))))', 'Function[f, Function[x, f[f[x]]]]', 'Function[{f, x}, f[f[x]]]', 'f |-> x |-> f[f[x]]']) {
      expect(equal(P(src), two), src).toBe(true);
    }
    expect(equal(P('(x => x(x))(y => y)'), P('(λx.x x)(λy.y)'))).toBe(true);
    expect(equal(P('f => f(1, 2)'), P('λf.f 1 2'))).toBe(true);
  });
  it('supports definitions in each language', () => {
    const cases: [FormatId, string][] = [
      ['js', 'const TWICE = f => x => f(f(x));\nTWICE(TWICE)'],
      ['python', 'TWICE = lambda f: lambda x: f(f(x))\nTWICE(TWICE)'],
      ['lisp', '(define (TWICE f x) (f (f x)))\n(TWICE TWICE)'],
      ['wolfram', 'TWICE = Function[f, Function[x, f[f[x]]]]\nTWICE[TWICE]'],
    ];
    for (const [fmt, src] of cases) {
      const p = parseProgram(src, 'auto');
      expect(p.format, src).toBe(fmt);
      expect(p.defs.map((d) => d.name)).toEqual(['TWICE']);
      expect(equal(p.term!, P('(λf x.f (f x)) (λf x.f (f x))'))).toBe(true);
    }
  });
  it('reports errors at source positions', () => {
    const p = parseProgram('x => x(', 'js');
    expect(p.term).toBeNull();
    expect(p.diagnostics[0].from).toBeLessThanOrEqual(7);
  });
  it('round-trips random terms in every language', () => {
    fc.assert(fc.property(closedTerm(), (t) => CODE_LANGS.every((l) => {
      const p = parseProgram(printCode(t, l.id), l.id);
      return p.term !== null && equal(p.term, t);
    })), { numRuns: 300 });
  });
  it('codeToNamed keeps an offset map', () => {
    const n = codeToNamed('x => x', 'js');
    expect(n.map.length).toBe(n.text.length + 1);
  });
});

describe('BLC8', () => {
  it('packs and unpacks bytes', () => {
    const bits = '0000011100111010'; // Church 2
    const bytes = bitsToBytes(bits);
    expect(bytesToHex(bytes)).toBe('07 3a');
    expect(bytesToBits(parseBytes('0x07 0x3a'))).toBe(bits);
    expect(bytesToBits(parseBytes(bytesToBase64(bytes)))).toBe(bits);
    expect(equal(P('0x07 0x3a'), churchNumeral(2))).toBe(true);
    expect(parseProgram('0x07 0x3a', 'auto').diagnostics).toEqual([]);
  });
});

describe('format detection and printing', () => {
  it('detects each notation', () => {
    const cases: [string, FormatId][] = [
      ['λx.x', 'named'], ['(λx.x) y', 'named'], ['\\x -> x', 'named'], ['λλ2 (2 1)', 'debruijn1'], ['0010', 'blc'], ['0x07 0x3a', 'blc8'],
      ['S(KS)K', 'ski'], ['SKK', 'ski'], ['``skk', 'unlambda'], ['*i*ii', 'iota'], ['x => x', 'js'], ['lambda x: x', 'python'],
      ['(lambda (x) x)', 'lisp'], ['Function[x, x]', 'wolfram'], ['\\lambda x.x', 'latex'], ['{"type":"lam","body":{"type":"var","index":0}}', 'json'],
      ['SUCC 2', 'named'], ['PLUS 2 3', 'named'],
    ];
    for (const [src, fmt] of cases) expect(detectFormat(src), src).toBe(fmt);
  });
  it('prints every format and parses it back', () => {
    const t = P('λf x.f (f x)');
    for (const f of FORMATS) {
      const text = printTerm(t, f.id);
      const back = parseProgram(text, f.id).term;
      expect(back, `${f.id}: ${text}`).not.toBeNull();
      expect(sameNF(back!, t), `${f.id}: ${text}`).toBe(true);
    }
  });
});

describe('examples', () => {
  it('every example parses without errors', async () => {
    const { EXAMPLES } = await import('../src/core/prelude');
    for (const ex of EXAMPLES) {
      const p = parseProgram(ex.src, 'auto');
      expect(p.diagnostics.filter((d) => d.severity === 'error'), ex.name).toEqual([]);
      expect(p.term, ex.name).not.toBeNull();
    }
  });
  it('the notation examples mean what their notes say', () => {
    expect(sameNF(P('SKK'), P('λx.x'))).toBe(true);
    expect(sameNF(P('``s`k`sik'), P('λx y.y x'))).toBe(true);
    expect(sameNF(P('*i*i*ii'), P('λx y.x'))).toBe(true);
  });
});
