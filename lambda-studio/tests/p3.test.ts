// Regression tests for the P3 items of the review: data types, the Expression tool, readings,
// size limits and the smaller rendering fixes.
import { describe, expect, test } from 'vitest';
import { parseData, generate, AdtError } from '../src/core/adt';
import { parseExpr, exprToLambda } from '../src/core/algebra/expr';
import { guessSequence } from '../src/core/algebra/numeric';
import { describe as readings } from '../src/core/encodings';
import { encodeData, describeMore } from '../src/core/data';
import { parseProgram, preludeInfo } from '../src/core/program';
import { normalize } from '../src/core/nbe';
import { toCL, TooLarge } from '../src/core/combinators';
import { layout, layoutAlternative } from '../src/core/diagram/layout';
import { toBoxChars } from '../src/core/diagram/ascii';
import { betaLineage } from '../src/core/diagram/morph';
import { equal } from '../src/core/term';
import { rewriteSource } from '../src/core/edit';

const term = (s: string) => parseProgram(s).term!;

describe('data-type generator', () => {
  test('constructors named Let and In do not become keywords', () => {
    const g = generate(parseData('data T = Let Nat | In T'), 'scott');
    const p = parseProgram(g.source + '\nSIZE_T (IN (LET 1))');
    expect(p.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });
  test('a ; inside a comment does not split the declaration', () => {
    const d = parseData('data Tree = Leaf | Node Tree Tree -- leaves; nodes');
    expect(d).toHaveLength(1);
    expect(d[0].ctors.map((c) => c.name)).toEqual(['Leaf', 'Node']);
  });
  test('a constructor in two declarations is an error', () => {
    expect(() => parseData('data A = X | Y\ndata B = X')).toThrow(AdtError);
    expect(() => parseData('data A = X\ndata A = Y')).toThrow(/declared twice/);
  });
  test('generated helper names avoid library names', () => {
    const g = generate(parseData('data Nat = Zero | Succ Nat'), 'church', new Set(['SIZE_NAT', 'SUCC']));
    expect(g.names).toContain('SIZE_NAT_');
    expect(g.names).toContain('SUCC_NAT');
    expect(g.names).not.toContain('SIZE_NAT');
  });
  test('a constructor called V does not clash with the eliminator binder', () => {
    const g = generate(parseData('data T = V | W T'), 'church');
    const p = parseProgram(g.source + '\nSIZE_T (W V)');
    expect(normalize(p.term!, 100000).term && readings(normalize(p.term!, 100000).term!)[0].text).toBe('Church numeral 2');
  });
});

describe('Expression tool', () => {
  test('LaTeX subscripts are part of the name', () => {
    expect(exprToLambda(parseExpr('x_{1} \\land \\lnot x_{2}'))).toBe('λx_1 x_2.AND x_1 (NOT x_2)');
    expect(exprToLambda(parseExpr('xy_{1}'))).toBe('λx y_1.MULT x y_1');
  });
  test('Greek letter commands are single variables', () => {
    expect(exprToLambda(parseExpr('\\alpha + \\beta'))).toBe('λα β.PLUS α β');
  });
  test('a later use decides a variable type', () => {
    expect(exprToLambda(parseExpr('(a = b) ∧ a'))).toBe('λa b.AND (IFF a b) a');
    expect(exprToLambda(parseExpr('a = b'))).toBe('λa b.EQ a b');
  });
  test('generated λ-terms parse', () => {
    for (const s of ['x_{1} \\land \\lnot x_{2}', '\\alpha \\cdot x_{i}']) expect(parseProgram(exprToLambda(parseExpr(s))).term).not.toBeNull();
  });
});

describe('readings and Encode data', () => {
  test('NIL reads as the empty list too', () => {
    expect(readings(term('NIL')).map((r) => r.text)).toContain('empty list (NIL)');
  });
  test('Maybe and Either accept Just / Nothing / Left / Right', () => {
    expect(describeMore(encodeData('maybe', 'scott', 'Just 3'))).toContain('Just 3 / Right 3');
    expect(equal(encodeData('maybe', 'scott', 'Nothing'), encodeData('maybe', 'scott', ''))).toBe(true);
    expect(describeMore(encodeData('either', 'scott', 'Right 4'))).toContain('Just 4 / Right 4');
    expect(describeMore(encodeData('either', 'scott', 'L 2'))).toContain('Left 2');
  });
  test('guessSequence finds a late start of a linear part', () => {
    const g = guessSequence([0, 0, 0, 0, 1, 2, 3]);
    expect(g.map((x) => x.formula).join(' | ')).toMatch(/max\(0/);
  });
  test('characters above the numeral limit are reported', () => {
    const p = parseProgram('"a😀"');
    expect(p.term).not.toBeNull();
    expect(p.diagnostics.some((d) => d.severity === 'warning' && /😀/.test(d.message))).toBe(true);
  });
});

describe('limits and rendering', () => {
  test('a huge de Bruijn index normalizes at once', () => {
    const t = parseProgram('λ1000000000', 'debruijn1').term!;
    const r = normalize(t, 1000);
    expect(r.status).toBe('normal');
    expect(equal(r.term!, t)).toBe(true);
  });
  test('the Kiselyov translation respects its size limit', () => {
    const big = term('λa b c d e f g h.' + 'a b c d e f g h '.repeat(40));
    expect(() => toCL(big, 'kiselyov', 1000)).toThrow(TooLarge);
  });
  test('the step animation lineage handles deep terms', () => {
    const N = 30000;
    const t = term('(λz.z) (' + '(λy.'.repeat(N) + 'y' + ')'.repeat(N) + ')');
    expect(betaLineage(t, '').size).toBe(N + 1);
  });
  test('box drawing of the alternative style has no output stub', () => {
    expect(toBoxChars(layoutAlternative(term('I')))).toBe('───');
    expect(toBoxChars(layoutAlternative(term('λx.x x')))).toBe('─┬───┬─\n └───┘');
    expect(toBoxChars(layout(term('I')))).toBe('─┬─\n │');
  });
  test('an edit does not add a trailing blank line', () => {
    expect(rewriteSource('A = λx.x\nA', 'A A')).toBe('A = λx.x\nA A');
  });
  test('the prelude still compiles', () => {
    expect(preludeInfo().every((d) => d.term)).toBe(true);
  });
});
