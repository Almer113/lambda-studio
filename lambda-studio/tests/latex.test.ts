import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { type Term, app, lam, v, equal } from '../src/core/term';
import { printLatex, normalizeLatex, looksLikeLatex, texName } from '../src/core/formats/latex';
import { parseProgram, detectFormat } from '../src/core/program';
import { makeFolder } from '../src/core/fold';

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

describe('LaTeX output', () => {
  it('typesets standard terms', () => {
    expect(printLatex(P('λx.x'))).toBe('\\lambda x.\\,x');
    expect(printLatex(P('λf x.f (f x)'))).toBe('\\lambda f\\,x.\\,f\\:(f\\:x)');
    expect(printLatex(P('λx.λy.y'), { style: 'debruijn1' })).toBe('\\lambda \\lambda 1 ');
  });
  it('typesets names', () => {
    expect(texName('x1', false)).toBe('x_{1}');
    expect(texName("y'", false)).toBe("y'");
    expect(texName('foo', false)).toBe('\\mathit{foo}');
    expect(texName('PLUS', true)).toBe('\\mathsf{PLUS}');
    expect(texName('ω', true)).toBe('\\omega');
  });
  it('folds definitions and numerals', () => {
    const prog = parseProgram('PLUS 2', 'auto');
    const fold = makeFolder(prog.foldTable, { numerals: true, zeroAs: '0' });
    const tex = printLatex(prog.term!, { fold, avoid: prog.foldTable.names });
    expect(tex).toBe('\\mathsf{PLUS}\\:\\ulcorner 2\\urcorner ');
  });
  it('tags every node for hover linking', () => {
    const tex = printLatex(P('λf x.f (f x)'), { tags: true });
    expect(tex.startsWith('\\htmlData{p=r}{')).toBe(true);
    for (const p of ['b', 'bb', 'bbf', 'bba', 'bbaf', 'bbaa']) expect(tex).toContain(`{p=r${p}}`);
    // braces balanced
    let d = 0; for (const c of tex) { if (c === '{') d++; if (c === '}') d--; expect(d).toBeGreaterThanOrEqual(0); }
    expect(d).toBe(0);
  });
});

describe('LaTeX input', () => {
  it('is detected', () => {
    expect(detectFormat('\\lambda x.\\, x')).toBe('latex');
    expect(detectFormat('$\\lambda f.\\lambda x. f\\,(f\\,x)$')).toBe('latex');
    expect(detectFormat('\\x.x')).toBe('named');
    expect(looksLikeLatex('\\x y. x')).toBe(false);
  });
  it('parses common LaTeX forms', () => {
    expect(equal(P('$\\lambda f.\\lambda x.\\, f\\,(f\\,x)$'), P('λf x.f (f x)'))).toBe(true);
    expect(equal(P('\\lambda x_{1}\\, x_2.\\; x_1'), P('λa b.a'))).toBe(true);
    expect(equal(P('\\mathsf{PLUS}\\;\\ulcorner 2\\urcorner\\;\\ulcorner 3 \\urcorner'), P('PLUS 2 3'))).toBe(true);
    expect(equal(P('\\left(\\lambda x . x\\, x\\right)\\left(\\lambda x . x\\, x\\right)'), P('(λx.x x)(λx.x x)'))).toBe(true);
    expect(equal(P('\\lambda x \\mapsto x'), P('λx.x'))).toBe(true);
    expect(equal(P('\\lambda\\lambda 2\\,(2\\,1)'), P('λf x.f (f x)'))).toBe(true);
  });
  it('parses definitions over several lines', () => {
    const p = parseProgram('\\mathsf{TWICE} \\equiv \\lambda f\\,x.\\, f\\,(f\\,x) \\\\\n  \\mathsf{TWICE}\\; \\mathsf{TWICE}', 'auto');
    expect(p.format).toBe('latex');
    expect(p.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(p.defs.map((d) => d.name)).toEqual(['TWICE']);
  });
  it('maps error positions back into the LaTeX source', () => {
    const src = '\\lambda x.\\, (x';
    const p = parseProgram(src, 'auto');
    expect(p.term).toBeNull();
    const d = p.diagnostics[0];
    expect(d.from).toBeGreaterThanOrEqual(0);
    expect(d.to).toBeLessThanOrEqual(src.length);
  });
  it('maps spans of commands to the whole command', () => {
    const n = normalizeLatex('\\lambda x.x');
    expect(n.text).toBe('λ x.x');
    expect(n.map[0]).toBe(0);
    expect(n.ends[0]).toBe(7);
  });
  it('round-trips every closed term (named and de Bruijn styles)', () => {
    fc.assert(fc.property(closedTerm(), (t) => {
      for (const style of ['named', 'debruijn0', 'debruijn1'] as const) {
        for (const tags of [false, true]) {
          const src = printLatex(t, { style, tags });
          const prog = parseProgram(src, 'auto', { defaultDeBruijnBase: style === 'debruijn0' ? 0 : 1 });
          if (!prog.term || !equal(prog.term, t)) return false;
        }
      }
      return true;
    }), { numRuns: 300 });
  });
});
