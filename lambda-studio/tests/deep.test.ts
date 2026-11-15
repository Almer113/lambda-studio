// Regression tests for very deep terms. The step engine, the core term functions and the
// named printer used to recurse once per level and overflowed in browsers (MULT 60 60, whose
// normal form is the Church numeral 3600, failed with "Term too deep"). The depths used here
// overflow Node's default stack too, so the old recursive versions fail these tests.
import { describe, it, expect } from 'vitest';
import { parseProgram } from '../src/core/program';
import { run, findRedex, type Strategy, type ReduceOptions } from '../src/core/reduce';
import { decodeNumeral, churchNumeral } from '../src/core/encodings';
import { type Term, type Path, app, lam, v, size, hash, equal, maxFree, replaceAt, getAt } from '../src/core/term';
import { shift, beta, occurs, isEtaRedex } from '../src/core/debruijn';
import { printNamed } from '../src/core/formats/named';
import { printCode } from '../src/core/formats/code';
import { printDeBruijn } from '../src/core/formats/debruijn';
import { printJSON, parseJSON } from '../src/core/formats/json';
import { toCL, printCL, fromCL, clSize, ALGORITHMS } from '../src/core/combinators';
import { normalize } from '../src/core/nbe';
import { randomClosedTerm, Counter } from '../src/core/generate';

const DEEP = 60_000;

describe('deep terms', () => {
  it('runs MULT 60 60 and MULT 200 200 to normal form', () => {
    for (const [n, steps] of [[60, 123], [200, 403]] as const) {
      const t = parseProgram(`MULT ${n} ${n}`, 'named').term!;
      const r = run(t, { strategy: 'normal', eta: false, maxSteps: 10_000, maxSize: 1_000_000 });
      expect(r.status).toBe('normal');
      expect(r.steps).toBe(steps);
      expect(decodeNumeral(r.term)).toBe(n * n);
    }
  });

  it('size, hash, equal, maxFree, shift, subst and occurs work at depth 60000', () => {
    const a = churchNumeral(DEEP), b = churchNumeral(DEEP);
    expect(size(a)).toBe(2 * DEEP + 3);
    expect(hash(a)).toBe(hash(b));
    expect(equal(a, b)).toBe(true);
    expect(equal(a, churchNumeral(DEEP - 1))).toBe(false);
    expect(maxFree(a)).toBe(0);
    const open = (a as { body: { body: Term } }).body.body; // f (f (… x)) with f = 1, x = 0
    expect(maxFree(open)).toBe(2);
    expect(occurs(open, 1)).toBe(true);
    expect(occurs(open, 5)).toBe(false);
    expect(maxFree(shift(open, 3))).toBe(5);
    // (λf.λx.f (f … x)) applied to a function: substitutes at every level
    const r = beta(lam(lam(open)), lam(v(0), 'y'));
    expect(size(r)).toBe(size(lam(open)) + 2 * DEEP - DEEP); // each var 1 becomes λy.y (2 nodes)
    expect(isEtaRedex(lam(app(open, v(0))))).toBe(false);
  });

  it('prints and edits at depth 60000', () => {
    const t = churchNumeral(DEEP);
    const p = printNamed(t);
    expect(p.text.startsWith('λf x.f (f (f')).toBe(true);
    expect(p.text.endsWith('x' + ')'.repeat(DEEP - 1))).toBe(true);
    const deepPath = 'bb' + 'a'.repeat(DEEP);
    expect(getAt(t, deepPath)).toEqual(v(0));
    const t2 = replaceAt(t, deepPath, v(1));
    expect(getAt(t2, deepPath)).toEqual(v(1));
    expect(findRedex(app(lam(v(0)), t), { strategy: 'applicative', eta: true })).toBe('');
    for (const lang of ['haskell', 'js', 'python', 'lisp', 'wolfram'] as const) {
      const code = printCode(t, lang);
      expect(code.length).toBeGreaterThan(3 * DEEP);
      expect(code).toBe(printCode(t, lang)); // deterministic, and no overflow
    }
    expect(printCode(churchNumeral(2), 'wolfram')).toBe('Function[f, Function[x, f[f[x]]]]');
    expect(printCode(churchNumeral(2), 'haskell')).toBe('\\f x -> f (f x)');
  });

  it('de Bruijn, JSON and combinator notations at depth 20000', () => {
    const N = 20_000, t = churchNumeral(N);
    for (const base of [0, 1] as const) {
      const p = printDeBruijn(t, base);
      expect(p.text.startsWith(`λλ${1 + base} (${1 + base} (`)).toBe(true);
      expect(equal(parseProgram(printDeBruijn(churchNumeral(5), base).text, base === 0 ? 'debruijn0' : 'debruijn1').term!, churchNumeral(5))).toBe(true);
    }
    // deep JSON switches to the compact form (indentation would grow with depth²) and still parses
    const json = printJSON(t);
    expect(json.startsWith('{"type":"lam","name":"f","body":')).toBe(true);
    expect(equal(parseJSON(json), t)).toBe(true);
    expect(printJSON(churchNumeral(1))).toBe(JSON.stringify({ type: 'lam', name: 'f', body: { type: 'lam', name: 'x', body: { type: 'app', fn: { type: 'var', index: 1 }, arg: { type: 'var', index: 0 } } } }, null, 1));
    for (const a of ALGORITHMS) {
      const cl = toCL(t, a.id, 400_000);
      for (const style of ['ski', 'unlambda', 'iota', 'jot', 'bcl', 'lazyk'] as const) expect(printCL(cl, style).length).toBeGreaterThan(N);
    }
    expect(clSize(toCL(t, 'turner'))).toBe(2 * N - 1);
    // the translation still means the numeral
    expect(decodeNumeral(normalize(fromCL(toCL(t, 'turner')), 5_000_000).term!)).toBe(N);
  });

  it('the fast normalizer handles deep results', () => {
    // these overflowed the old recursive normalizer, even with Node's stack
    for (const [src, n] of [['MULT 100 100', 10_000], ['MULT 300 300', 90_000], ['EXP 3 9', 19_683], ['FACT 7', 5040]] as const) {
      const r = normalize(parseProgram(src, 'named').term!, 5_000_000);
      expect(r.status, src).toBe('normal');
      expect(decodeNumeral(r.term!)).toBe(n);
    }
    // no normal form: reported as running out of fuel, not as a crash
    expect(normalize(parseProgram('Y', 'named').term!, 20_000).status).toBe('fuel');
  });
});

// Reference: the previous recursive findRedex, to check the iterative one picks the same redex.
function findRedexRec(t: Term, opts: ReduceOptions, path: Path = ''): Path | null {
  const { strategy: s, eta } = opts;
  const weak = s === 'cbn' || s === 'cbv';
  switch (t.tag) {
    case 'var': case 'free': return null;
    case 'lam': {
      if (weak) return null;
      if (s === 'applicative') {
        const r = findRedexRec(t.body, opts, path + 'b');
        if (r !== null) return r;
        return eta && isEtaRedex(t) ? path : null;
      }
      if (eta && isEtaRedex(t)) return path;
      return findRedexRec(t.body, opts, path + 'b');
    }
    case 'app': {
      if (s === 'applicative' || s === 'cbv') {
        const r = findRedexRec(t.fn, opts, path + 'f') ?? findRedexRec(t.arg, opts, path + 'a');
        if (r !== null) return r;
        return t.fn.tag === 'lam' ? path : null;
      }
      if (t.fn.tag === 'lam') return path;
      const r = findRedexRec(t.fn, opts, path + 'f');
      if (r !== null || s === 'cbn' || s === 'head') return r;
      return findRedexRec(t.arg, opts, path + 'a');
    }
  }
}

describe('iterative findRedex', () => {
  it('agrees with the recursive definition on random terms, every strategy', () => {
    let seed = 12345;
    const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
    const counter = new Counter();
    const strategies: Strategy[] = ['normal', 'applicative', 'cbn', 'cbv', 'head'];
    for (let k = 0; k < 400; k++) {
      const t = randomClosedTerm(20 + (k % 40), counter, rnd);
      if (!t) continue;
      for (const strategy of strategies) for (const eta of [false, true]) {
        expect(findRedex(t, { strategy, eta })).toBe(findRedexRec(t, { strategy, eta }));
      }
    }
  });
});
