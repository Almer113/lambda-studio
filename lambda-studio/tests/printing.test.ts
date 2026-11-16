// Bound-variable naming in the printers: linear time, and no capture of free variables.
import { describe, it, expect } from 'vitest';
import { type Term, app, lam, v, free, equal } from '../src/core/term';
import { NameScope } from '../src/core/formats/names';
import { printNamed } from '../src/core/formats/named';
import { printCode, CODE_LANGS } from '../src/core/formats/code';
import { parseProgram } from '../src/core/program';
import { normalize } from '../src/core/nbe';
import { encodeData } from '../src/core/data';

const random = (seed: number) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);

describe('NameScope', () => {
  it('picks the same names as a linear search over the names in scope', () => {
    const rnd = random(7);
    const blocked = new Set(['y', 'x2', 'z1', 'x11']);
    for (let run = 0; run < 200; run++) {
      const scope = new NameScope((n) => blocked.has(n));
      const ref: string[] = [];
      for (let k = 0; k < 300; k++) {
        if (ref.length && rnd() < 0.45) { scope.pop(); ref.pop(); continue; }
        const base = ['x', 'y', 'z', 'x1', 'x12'][Math.floor(rnd() * 5)];
        // reference: the base itself, else the smallest suffix j >= 1 that is free
        const taken = (n: string) => ref.includes(n) || blocked.has(n);
        let want = base;
        if (taken(base)) for (let j = 1; ; j++) if (!taken(base + j)) { want = base + j; break; }
        const got = scope.fresh(base);
        expect(got).toBe(want);
        scope.push(got);
        ref.push(got);
      }
      expect(scope.depth).toBe(ref.length);
    }
  });
});

describe('printers', () => {
  it('print deeply nested binders in linear time', () => {
    // 6000 nested binders that all want the name x: a scan of the scope per candidate name made
    // this cubic (minutes)
    let t: Term = v(0);
    for (let k = 0; k < 6000; k++) t = lam(t, 'x');
    const p = printNamed(t).text;
    expect(p.startsWith('λx x1 x2 x3 ')).toBe(true);
    expect(p.endsWith(' x5999.x5999')).toBe(true);
    for (const l of CODE_LANGS) expect(printCode(t, l.id)).toContain('x5999');
    // Scott numerals nest binders per unit: printing 1000 used to take 13 seconds
    expect(printNamed(encodeData('nat', 'scott', '3000')).text.length).toBeGreaterThan(3000);
  });

  it('code printers do not capture free variables', () => {
    const t = normalize(parseProgram('(λy x.y x) x', 'named').term!).term!;
    expect(printNamed(t).text).toBe('λx1.x x1');
    expect(printCode(t, 'js')).toBe('x1 => x(x1)');
    expect(printCode(t, 'haskell')).toBe('\\x1 -> x x1');
    expect(printCode(t, 'python')).toBe('lambda x1: x(x1)');
    expect(printCode(t, 'lisp')).toBe('(lambda (x1) (x x1))');
    expect(printCode(t, 'wolfram')).toBe('Function[x1, x[x1]]');
  });

  it('round-trip terms whose binders want the names of free variables', () => {
    const rnd = random(99);
    const names = ['x', 'y', 'f'];
    const pickName = () => names[Math.floor(rnd() * names.length)];
    const gen = (depth: number, size: number): Term => {
      const r = rnd();
      if (size <= 1 || r < 0.25) return depth > 0 && rnd() < 0.6 ? v(Math.floor(rnd() * depth)) : free(pickName());
      if (r < 0.6) return lam(gen(depth + 1, size - 1), pickName());
      const k = 1 + Math.floor(rnd() * (size - 2));
      return app(gen(depth, k), gen(depth, size - 1 - k));
    };
    for (let k = 0; k < 300; k++) {
      const t = gen(0, 4 + (k % 20));
      const named = printNamed(t).text;
      expect(equal(parseProgram(named, 'named').term!, t), named).toBe(true);
      for (const l of CODE_LANGS) {
        const code = printCode(t, l.id);
        const p = parseProgram(code, l.id);
        expect(p.term !== null && equal(p.term, t), `${l.id}: ${code}`).toBe(true);
      }
    }
  });
});
