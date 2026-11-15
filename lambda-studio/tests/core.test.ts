import { describe, it, expect } from 'vitest';
import { parseProgram, printTerm, detectFormat, preludeTerm } from '../src/core/program';
import { printNamed } from '../src/core/formats/named';
import { printDeBruijn, parseDeBruijn } from '../src/core/formats/debruijn';
import { encodeBLC, decodeBLC, blcBits } from '../src/core/formats/blc';
import { run, step, findRedex } from '../src/core/reduce';
import { normalize } from '../src/core/nbe';
import { decodeNumeral, decodeBool, decodeList, describe as describeTerm } from '../src/core/encodings';
import { type Term, equal, app, lam, v, free } from '../src/core/term';
import { makeFolder } from '../src/core/fold';

const P = (src: string) => {
  const p = parseProgram(src, 'auto');
  const errs = p.diagnostics.filter((d) => d.severity === 'error');
  if (errs.length) throw new Error(errs.map((e) => e.message).join('; '));
  return p.term!;
};
const nf = (src: string, strategy: 'normal' | 'applicative' = 'normal') =>
  run(P(src), { strategy, eta: false, maxSteps: 100000, maxSize: 1e6 });

describe('named parser', () => {
  it('parses identity and K', () => {
    expect(printDeBruijn(P('λx.x'), 0).text).toBe('λ0');
    expect(printDeBruijn(P('\\x y. x'), 0).text).toBe('λλ1');
    expect(printDeBruijn(P('\\x -> x'), 0).text).toBe('λ0');
  });
  it('application is left-associative and λ extends right', () => {
    expect(printDeBruijn(P('λf x.f x x'), 0).text).toBe('λλ1 0 0');
    expect(printDeBruijn(P('λx.x λy.y'), 0).text).toBe('λ0 (λ0)');
  });
  it('handles shadowing', () => {
    expect(printDeBruijn(P('λx.λx.x'), 0).text).toBe('λλ0');
  });
  it('numerals, lists and let', () => {
    expect(decodeNumeral(P('3'))).toBe(3);
    expect(decodeList(P('[1,2]'))!.map(decodeNumeral)).toEqual([1, 2]);
    expect(decodeNumeral(nf('let two = 2 in PLUS two two').term)).toBe(4);
  });
  it('reports errors with positions', () => {
    const p = parseProgram('λx. (x', 'named');
    expect(p.diagnostics[0].severity).toBe('error');
    expect(p.diagnostics[0].from).toBeGreaterThanOrEqual(4);
  });
  it('definitions, self-recursion via Y', () => {
    const p = parseProgram('TWICE = λf x.f (f x)\nTWICE SUCC 0', 'named');
    expect(decodeNumeral(run(p.term!, { strategy: 'normal', eta: false, maxSteps: 1000, maxSize: 1e5 }).term)).toBe(2);
    const q = parseProgram('LEN = λl.ISNIL l 0 (SUCC (LEN (TAIL l)))\nLEN [5,6,7]', 'named');
    expect(q.defs[0].recursive).toBe(true);
    expect(decodeNumeral(normalize(q.term!).term!)).toBe(3);
  });
  it('mutual recursion is reported', () => {
    const p = parseProgram('A = λx.B x\nB = λx.A x\nA', 'named');
    expect(p.diagnostics.some((d) => /mutual recursion/.test(d.message))).toBe(true);
  });
  it('single-letter mode splits variables', () => {
    const p = parseProgram('λxy.xy', 'named', { singleLetter: true });
    expect(printDeBruijn(p.term!, 0).text).toBe('λλ1 0');
  });
  it('unknown names are free variables', () => {
    const t = P('λx.f x');
    expect(t).toEqual(lam(app(free('f'), v(0)), 'x'));
  });
});

describe('printers', () => {
  it('named printer keeps hints and avoids capture', () => {
    expect(printNamed(P('λf x.f (f x)')).text).toBe('λf x.f (f x)');
    // λx.λx'.x with clashing hints is renamed
    expect(printNamed(lam(lam(v(1), 'x'), 'x')).text).toBe('λx x1.x');
    // free variable y must not be captured by a binder named y
    expect(printNamed(lam(app(v(0), free('y')), 'y')).text).toBe('λy1.y1 y');
  });
  it('folding shows numerals and names', () => {
    const p = parseProgram('PLUS 2 3', 'named');
    const r = run(p.term!, { strategy: 'normal', eta: false, maxSteps: 1000, maxSize: 1e5 });
    const fold = makeFolder(p.foldTable, { numerals: true, zeroAs: '0' });
    expect(printNamed(r.term, { fold }).text).toBe('5');
    expect(printNamed(preludeTerm('S'), { fold }).text).toBe('S');
  });
  it('de Bruijn round trip in both bases', () => {
    for (const src of ['λx.x', 'λf x.f (f x)', 'λx y z.x z (y z)', 'λf.(λx.f (x x)) (λx.f (x x))']) {
      const t = P(src);
      for (const base of [0, 1] as const) expect(equal(parseDeBruijn(printDeBruijn(t, base).text, base), t)).toBe(true);
    }
  });
});

describe('BLC', () => {
  it('matches Tromp’s published encodings', () => {
    expect(encodeBLC(P('λx.x'))).toBe('0010');
    expect(encodeBLC(P('λx y.x'))).toBe('0000110');
    expect(encodeBLC(P('2'))).toBe('0000011100111010');
    expect(blcBits(P('2'))).toBe(16);
  });
  it('decodes and reports trailing bits', () => {
    const r = decodeBLC('0010 11');
    expect(printDeBruijn(r.term, 1).text).toBe('λ1');
    expect(r.trailing).toBe(2);
  });
});

describe('format detection', () => {
  it('detects formats', () => {
    expect(detectFormat('λx.x')).toBe('named');
    expect(detectFormat('0000110')).toBe('blc');
    expect(detectFormat('λλ1 (1 0)')).toBe('debruijn0');
    expect(detectFormat('λλ2 (2 1)')).toBe('debruijn1');
    expect(detectFormat('{"type":"var","index":0}')).toBe('json');
    expect(detectFormat('PLUS 2 3')).toBe('named');
  });
  it('every format round-trips through printTerm/parseProgram', () => {
    const t = P('λf x.f (f (f x))');
    for (const fmt of ['named', 'debruijn0', 'debruijn1', 'blc', 'json'] as const) {
      const back = parseProgram(printTerm(t, fmt), fmt).term!;
      expect(equal(back, t)).toBe(true);
    }
  });
});

describe('reduction', () => {
  it('arithmetic', () => {
    expect(decodeNumeral(nf('PLUS 2 3').term)).toBe(5);
    expect(decodeNumeral(nf('MULT 2 3').term)).toBe(6);
    expect(decodeNumeral(nf('EXP 2 3').term)).toBe(8);
    expect(decodeNumeral(nf('PRED 3').term)).toBe(2);
    expect(decodeNumeral(nf('PRED 0').term)).toBe(0);
    expect(decodeNumeral(nf('SUB 5 2').term)).toBe(3);
    expect(decodeNumeral(nf('FACT 3').term)).toBe(6);
    expect(decodeNumeral(nf('SUM [1, 2, 3]').term)).toBe(6);
  });
  it('booleans', () => {
    expect(decodeBool(nf('AND TRUE (NOT FALSE)').term)).toBe(true);
    expect(decodeBool(nf('XOR TRUE TRUE').term)).toBe(false);
    expect(decodeBool(nf('EQ 3 3').term)).toBe(true);
    expect(decodeBool(nf('LEQ 4 3').term)).toBe(false);
  });
  it('lists', () => {
    expect(decodeList(nf('TAIL [1,2,3]').term)!.map(decodeNumeral)).toEqual([2, 3]);
    expect(decodeList(nf('MAP SUCC [1,2]').term)!.map(decodeNumeral)).toEqual([2, 3]);
    expect(decodeNumeral(nf('HEAD [7,8]').term)).toBe(7);
  });
  it('capture-avoiding substitution', () => {
    // (λx.λy.x) y  →  λz.y  (y free, not captured)
    const r = run(P('(λx y.x) y'), { strategy: 'normal', eta: false, maxSteps: 10, maxSize: 100 });
    expect(r.term).toEqual(lam(free('y'), 'y'));
    expect(printNamed(r.term).text).toBe('λy1.y');
  });
  it('normal order vs applicative order on K I Ω', () => {
    expect(nf('K I Ω').status).toBe('normal');
    const r = run(P('K I Ω'), { strategy: 'applicative', eta: false, maxSteps: 50, maxSize: 1e4 });
    expect(r.status).toBe('cycle');
  });
  it('detects Ω cycle', () => {
    const r = nf('(λx.x x)(λx.x x)');
    expect(r.status).toBe('cycle');
    expect(r.cycleLength).toBe(1);
  });
  it('weak strategies stop at weak head normal form', () => {
    const t = P('λx.(λy.y) x');
    expect(findRedex(t, { strategy: 'cbn', eta: false })).toBeNull();
    expect(findRedex(t, { strategy: 'cbv', eta: false })).toBeNull();
    expect(findRedex(t, { strategy: 'normal', eta: false })).toBe('b');
  });
  it('eta reduction', () => {
    const r = run(P('λx.f x'), { strategy: 'normal', eta: true, maxSteps: 10, maxSize: 100 });
    expect(r.term).toEqual(free('f'));
    expect(step(P('λx.f x'), { strategy: 'normal', eta: false })).toBeNull();
  });
  it('records history', () => {
    const r = run(P('PLUS 1 1'), { strategy: 'normal', eta: false, maxSteps: 100, maxSize: 1e4, record: 100 });
    expect(r.history.length).toBe(r.steps + 1);
    expect(r.history[r.history.length - 1].path).toBeNull();
  });
  it('NbE agrees with normal order', () => {
    for (const src of ['PLUS 2 3', 'FACT 3', 'MULT 3 (EXP 2 2)', 'TAIL [1,2]', 'K I Ω', 'λx.(λy.y x) x']) {
      const a = nf(src).term;
      const b = normalize(P(src)).term as Term;
      expect(equal(a, b)).toBe(true);
    }
    expect(normalize(P('Ω'), 1000).status).toBe('fuel');
  });
});

describe('decoding', () => {
  it('describes values', () => {
    expect(describeTerm(nf('PAIR 1 TRUE').term).map((d) => d.text)).toContain('pair (1, TRUE)');
    expect(describeTerm(P('"hi"')).map((d) => d.text)).toContain('string "hi"');
  });
});
