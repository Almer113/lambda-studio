// Deeply nested input must parse (and lay out) without overflowing the call stack.
import { describe, expect, test } from 'vitest';
import { parseProgram, printTerm, FORMATS } from '../src/core/program';
import { layout, layoutAlternative } from '../src/core/diagram/layout';
import { size, equal } from '../src/core/term';
import { run, call, type Rec } from '../src/core/trampoline';

const N = 20000;
const nestedApps = 'λf x.' + 'f ('.repeat(N) + 'x' + ')'.repeat(N); // the numeral N
const nestedLams = '(λy.'.repeat(N) + 'y' + ')'.repeat(N);

describe('deep input', () => {
  test('named notation: nested brackets and nested λs', () => {
    const a = parseProgram(nestedApps);
    expect(a.diagnostics).toEqual([]);
    expect(size(a.term!)).toBe(2 * N + 3);
    const b = parseProgram(nestedLams);
    expect(b.diagnostics).toEqual([]);
    expect(size(b.term!)).toBe(N + 1);
  });

  test('every notation round-trips a deep term', () => {
    const terms = [parseProgram('λf x.' + 'f ('.repeat(5000) + 'x' + ')'.repeat(5000)).term!, parseProgram('(λy.'.repeat(5000) + 'y' + ')'.repeat(5000)).term!];
    for (const t of terms) for (const f of FORMATS) {
      const r = parseProgram(printTerm(t, f.id), f.id);
      expect(r.diagnostics.filter((d) => d.severity === 'error'), f.id).toEqual([]);
      expect(r.term, f.id).not.toBeNull();
      // combinator notations come back as an equivalent but different term; λ notations exactly
      if (['named', 'debruijn0', 'debruijn1', 'blc', 'blc8', 'json', 'latex', 'haskell', 'js', 'python', 'lisp', 'wolfram'].includes(f.id)) expect(equal(r.term!, t), f.id).toBe(true);
    }
  });

  test('errors in deep input are still reported at the right place', () => {
    const src = '(λy.'.repeat(N) + 'y' + ')'.repeat(N - 1);
    const r = parseProgram(src);
    expect(r.term).toBeNull();
    expect(r.diagnostics[0].message).toMatch(/Expected '\)'/);
    expect(r.diagnostics[0].from).toBe(src.length);
  });

  test('diagrams of deep terms', () => {
    for (const t of [parseProgram(nestedApps).term!, parseProgram(nestedLams).term!]) {
      expect(layout(t).segments.length).toBe(size(t));
      expect(layoutAlternative(t).segments.length).toBe(size(t));
    }
  });

  test('the trampoline runs deep recursion and propagates errors', () => {
    function* depth(n: number): Rec<number> { return n === 0 ? 0 : 1 + (yield* call(depth(n - 1))); }
    expect(run(depth(200000))).toBe(200000);
    function* boom(n: number): Rec<number> { if (n === 0) throw new Error('bottom'); try { return yield* call(boom(n - 1)); } finally { /* unwinds */ } }
    expect(() => run(boom(50000))).toThrow('bottom');
  });
});
