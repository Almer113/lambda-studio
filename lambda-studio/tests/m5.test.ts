import { describe, it, expect } from 'vitest';
import { parseProgram } from '../src/core/program';
import { normalize } from '../src/core/nbe';
import { decodeNumeral, decodeBool, churchNumeral } from '../src/core/encodings';
import { equal, isClosed, apps } from '../src/core/term';
import { parseExpr, exprToLambda, evalExpr, typeOf, exprToTex, latexToPlain } from '../src/core/algebra/expr';
import { truthTable, formulas, minimize, arityOf, argNames, formulaToLambda } from '../src/core/algebra/boolean';
import { evalAt, guessSequence, guessPredicate, guessBinary, asNumbers, asBools } from '../src/core/algebra/numeric';
import { checkLaw, LAWS } from '../src/core/algebra/laws';
import { parseData, generate, DATA_EXAMPLES } from '../src/core/adt';
import { Counter, enumerateClosed, randomClosedTerm, busyBeaver } from '../src/core/generate';
import { blcBits } from '../src/core/formats/blc';
import { inferType } from '../src/core/types';
import { PRELUDE } from '../src/core/prelude';

const P = (s: string) => {
  const p = parseProgram(s, 'named');
  if (!p.term) throw new Error(`parse failed: ${s}: ${p.diagnostics.map((d) => d.message).join('; ')}`);
  return p.term;
};
const nf = (s: string) => normalize(P(s), 2_000_000).term!;

describe('prelude additions', () => {
  it.each([
    ['LT 2 3', true], ['LT 3 3', false], ['GT 4 1', true], ['GEQ 2 2', true], ['NEQ 2 3', true], ['NEQ 3 3', false],
    ['IMPLIES TRUE FALSE', false], ['IMPLIES FALSE FALSE', true], ['IFF FALSE FALSE', true], ['NAND TRUE TRUE', false], ['NOR FALSE FALSE', true],
  ])('%s', (src, want) => expect(decodeBool(nf(src))).toBe(want));
  it.each([['DIV 7 2', 3], ['MOD 7 3', 1], ['DIV 2 5', 0], ['MOD 9 3', 0]])('%s', (src, want) => expect(decodeNumeral(nf(src))).toBe(want));
});

describe('expressions → λ', () => {
  it('translates arithmetic and checks the value', () => {
    const e = parseExpr('(2 + 3) * 4 ^ 2');
    expect(exprToLambda(e)).toBe('MULT (PLUS 2 3) (EXP 4 2)');
    expect(evalExpr(e)).toBe(80);
    expect(decodeNumeral(nf(exprToLambda(e)))).toBe(80);
  });
  it('translates Boolean formulas with variables', () => {
    expect(exprToLambda(parseExpr('(a ∧ ¬b) ∨ c'))).toBe('λa b c.OR (AND a (NOT b)) c');
    expect(exprToLambda(parseExpr('a && !b || c'))).toBe('λa b c.OR (AND a (NOT b)) c');
    expect(exprToLambda(parseExpr('p -> q -> p'))).toBe('λp q.IMPLIES p (IMPLIES q p)');
  });
  it('reads LaTeX from a math editor', () => {
    expect(exprToLambda(parseExpr('\\frac{x^{2}+x}{2}'))).toBe('λx.DIV (PLUS (EXP x 2) x) 2');
    expect(exprToLambda(parseExpr('a\\land\\lnot b'))).toBe('λa b.AND a (NOT b)');
    expect(exprToLambda(parseExpr('2x+1\\le 9'))).toBe('λx.LEQ (PLUS (MULT 2 x) 1) 9');
    expect(latexToPlain('\\left(a\\right)\\cdot b')).toBe('(a)* b');
  });
  it('mixes numbers and truth values with comparisons; = on truth values is ↔', () => {
    const e = parseExpr('x mod 2 = 0 ∨ x > 5');
    expect(typeOf(e).vars).toEqual([{ name: 'x', type: 'num' }]);
    expect(exprToLambda(parseExpr('a = b'))).toBe('λa b.EQ a b');
    expect(exprToLambda(parseExpr('a = ¬b'))).toBe('λa b.IFF a (NOT b)');
  });
  it('factorial, precedence and errors', () => {
    expect(evalExpr(parseExpr('3! + 2 * 3'))).toBe(12);
    expect(evalExpr(parseExpr('2 ^ 3 ^ 2'))).toBe(512);
    expect(evalExpr(parseExpr('2 - 5'))).toBe(0);
    expect(() => typeOf(parseExpr('a + (¬a)'))).toThrow(/both/);
    expect(() => parseExpr('2 +')).toThrow();
    expect(() => parseExpr('1 < 2 < 3')).toThrow(/Chained/);
    expect(exprToTex(parseExpr('(a ∨ b) ∧ c'))).toBe('\\left(a \\lor b\\right) \\land c');
  });
  it('every closed arithmetic expression agrees with its λ-term', () => {
    for (const src of ['7 - 3', '10 / 3', '10 mod 4', '4!', '2^5', '1 + 2 * 3', '3 * (4 + 1)']) {
      const e = parseExpr(src);
      expect(decodeNumeral(nf(exprToLambda(e))), src).toBe(evalExpr(e));
    }
  });
});

describe('truth tables', () => {
  it('evaluates a term on all inputs and finds the formulas', () => {
    const t = P(exprToLambda(parseExpr('(a ∧ ¬b) ∨ c')));
    const { n, hints } = arityOf(t);
    const tt = truthTable(t, n, argNames(hints, n));
    expect(tt.vars).toEqual(['a', 'b', 'c']);
    expect(tt.rows.map((r) => (r.out ? 1 : 0)).join('')).toBe('01011111'.split('').map((_, m) => ((m & 1) || ((m & 4) && !(m & 2)) ? 1 : 0)).join(''));
    const f = formulas(tt)!;
    expect(f.minimal).toBe('(a ∧ ¬b) ∨ c');
    // the minimal formula, turned back into λ, has the same table
    const back = P(formulaToLambda(f.minimalCubes, tt.vars));
    expect(truthTable(back, 3, tt.vars).rows.map((r) => r.out)).toEqual(tt.rows.map((r) => r.out));
  });
  it('XOR has no smaller form; constants', () => {
    const tt = truthTable(P('XOR'), 2, ['p', 'q']);
    expect(formulas(tt)!.minimal).toBe('(p ∧ ¬q) ∨ (¬p ∧ q)');
    expect(formulas(truthTable(P('λp.OR p (NOT p)'), 1, ['p']))!.minimal).toBe('⊤');
    expect(formulas(truthTable(P('λp q.FALSE'), 2, ['p', 'q']))!.minimal).toBe('⊥');
  });
  it('flags rows that are not Booleans', () => {
    const tt = truthTable(P('λp.p 2 FALSE'), 1, ['p']);
    expect(tt.complete).toBe(false);
    expect(formulas(tt)).toBeNull();
  });
  it('minimizes the classic 4-variable example', () => {
    // f = Σm(4,8,10,11,12,15) + nothing else: minimal has 3 or 4 terms; check it covers exactly
    const ones = [4, 8, 10, 11, 12, 15];
    const cubes = minimize(4, ones);
    const covered = new Set<number>();
    for (let m = 0; m < 16; m++) if (cubes.some((c) => c.every((v, k) => v === null || v === ((m >> (3 - k)) & 1)))) covered.add(m);
    expect([...covered].sort((a, b) => a - b)).toEqual(ones);
    expect(cubes.length).toBeLessThanOrEqual(4);
  });
});

describe('number tables and guesses', () => {
  const seq = (src: string, N = 10) => asNumbers(Array.from({ length: N + 1 }, (_, n) => evalAt(P(src), [n])));
  it('polynomials', () => {
    expect(guessSequence(seq('λn.MULT n n'))[0].formula).toBe('n²');
    expect(guessSequence(seq('λn.PLUS (MULT n n) n'))[0].formula).toBe('n² + n');
    expect(guessSequence([0, 1, 3, 6, 10, 15, 21, 28])[0].formula).toBe('(n² + n)/2');
    expect(guessSequence(seq('SUCC'))[0].formula).toBe('n + 1');
  });
  it('exponentials, factorial, Fibonacci, truncation', () => {
    expect(guessSequence(seq('λn.EXP 2 n'))[0].formula).toBe('2ⁿ');
    expect(guessSequence(seq('FACT', 7))[0].formula).toBe('n!');
    expect(guessSequence(seq('FIB', 9)).map((g) => g.formula)).toContain('F(n) (Fibonacci)');
    expect(guessSequence(seq('λn.SUB n 3'))[0].formula).toBe('max(0, n − 3)');
    expect(guessSequence([0, 1, 3, 7, 15, 31, 63]).map((g) => g.formula)).toContain('2ⁿ − 1');
  });
  it('predicates and two-argument functions', () => {
    const vs = Array.from({ length: 9 }, (_, n) => evalAt(P('λn.ISZERO (MOD n 2)'), [n]));
    expect(guessPredicate(asBools(vs))[0].formula).toBe('n is even');
    const tbl = (src: string) => Array.from({ length: 5 }, (_, m) => asNumbers(Array.from({ length: 5 }, (_, n) => evalAt(P(src), [m, n]))));
    expect(guessBinary(tbl('PLUS'))[0].formula).toBe('m + n');
    expect(guessBinary(tbl('EXP'))[0].formula).toBe('mⁿ');
    expect(guessBinary(tbl('SUB'))[0].formula).toBe('max(0, m − n)');
  });
  it('reports terms without a normal form', () => {
    expect(evalAt(P('λn.Ω'), [1], 1000).k).toBe('none');
  });
});

describe('laws', () => {
  it('decides the built-in examples as documented', () => {
    const want: Record<string, string> = {
      'MULT is B': 'equal', 'EXP is flipped application': 'equal', 'S K K = I': 'equal', '2 + 3 = 5': 'equal', '2 · 3 = 3 · 2': 'equal',
      'Addition commutes (open terms)': 'different', 'SUCC = PLUS 1': 'equal', 'SUCC n = PLUS n 1': 'different', 'PRED (SUCC 4) = 4': 'equal', 'NOT (NOT b) = b': 'different',
      'De Morgan on booleans': 'equal', 'η: λx.f x = f': 'equal', 'Y f = f (Y f)': 'unknown', 'FALSE is 0': 'equal',
    };
    for (const l of LAWS) expect(checkLaw(P(l.left), P(l.right), 20000).verdict, l.name).toBe(want[l.name]);
  });
});

describe('data types', () => {
  const reserved = new Set(PRELUDE.map((p) => p.name));
  it('parses declarations', () => {
    const [d] = parseData('data List a = Nil | Cons a (List a)');
    expect(d.params).toEqual(['a']);
    expect(d.ctors.map((c) => c.fields.map((f) => f.recursive))).toEqual([[], [false, true]]);
  });
  it('generates working encodings (size of the example value)', () => {
    for (const ex of DATA_EXAMPLES) for (const enc of ['church', 'scott', 'parigot'] as const) {
      const g = generate(parseData(ex.src), enc, reserved);
      const [d] = parseData(ex.src);
      const p = parseProgram(`${g.source}\nSIZE_${d.name.toUpperCase()} EXAMPLE_${d.name.toUpperCase()}`, 'named');
      expect(p.diagnostics.filter((x) => x.severity === 'error'), `${ex.name} ${enc}: ${g.source}`).toEqual([]);
      const n = decodeNumeral(normalize(p.term!, 1_000_000).term!);
      const ctors = d.ctors.some((c) => c.fields.some((f) => f.recursive)) ? 2 + (d.ctors.find((c) => c.fields.some((f) => f.recursive))!.fields.filter((f) => f.recursive).length - 1) : 1;
      expect(n, `${ex.name} ${enc}`).toBe(ctors);
    }
  });
  it('Church Nat: constructors renamed around the prelude and fold back to numerals', () => {
    const g = generate(parseData('data Nat = Zero | Succ Nat'), 'church', reserved);
    expect(g.source).toContain('SUCC_NAT = λt zero succ.succ (t zero succ)');
    const t = nf(`${g.source}\nSUCC_NAT (SUCC_NAT ZERO) 0 SUCC`);
    expect(decodeNumeral(t)).toBe(2);
  });
});

describe('generators', () => {
  const c = new Counter();
  it('counts closed terms (OEIS A114852)', () => {
    const want = [0, 0, 0, 0, 1, 0, 1, 1, 2, 1, 6, 5, 13, 14, 37, 44, 101, 134, 298, 431, 883, 1361, 2736, 4405, 8574, 14334];
    expect(want.map((_, n) => Number(c.closed(n)))).toEqual(want);
  });
  it('enumeration matches the counts and term sizes', () => {
    for (let n = 0; n <= 18; n++) {
      const all = [...enumerateClosed(n, c)];
      expect(all.length).toBe(Number(c.closed(n)));
      for (const t of all) { expect(blcBits(t)).toBe(n); expect(isClosed(t)).toBe(true); }
      // unrank agrees with the enumeration order
      all.forEach((t, r) => expect(equal(c.unrank(n, 0, BigInt(r)), t)).toBe(true));
    }
  });
  it('random terms have the requested size', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let k = 0; k < 50; k++) { const t = randomClosedTerm(60, c, rnd)!; expect(blcBits(t)).toBe(60); expect(isClosed(t)).toBe(true); }
    expect(c.closed(200) > 10n ** 40n).toBe(true);
  });
  it('BBλ for small sizes', () => {
    const r = busyBeaver(21, 5000);
    expect(r.best).toBe(22);
  });
});

describe('types', () => {
  const ty = (s: string) => { const r = inferType(P(s)); return r.ok ? r.value.text : null; };
  it('principal types', () => {
    expect(ty('I')).toBe('a → a');
    expect(ty('K')).toBe('a → b → a');
    expect(ty('S')).toBe('(a → b → c) → (a → b) → a → c');
    expect(ty('2')).toBe('(a → a) → a → a');
    expect(ty('B')).toBe('(a → b) → (c → a) → c → b');
    expect(ty('ω')).toBeNull();
    expect(ty('Y')).toBeNull();
  });
  it('Curry–Howard reading', () => {
    const r = inferType(P('K'));
    expect(r.ok && r.value.prop).toBe('A ⇒ B ⇒ A');
  });
  it('free names get a type variable each', () => {
    expect(ty('f x')).toBe('a');
    expect(inferType(apps(P('I'), churchNumeral(3))).ok).toBe(true);
  });
});
