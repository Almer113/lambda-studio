import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { type Term, app, lam, v } from '../src/core/term';
import { parseProgram } from '../src/core/program';
import { findRedex, stepAt } from '../src/core/reduce';
import { layout, layoutAlternative, type Diagram } from '../src/core/diagram/layout';
import { segmentRect } from '../src/core/diagram/svg';
import { betaLineage, buildMorph, morphFrame } from '../src/core/diagram/morph';
import { toTikZ, toTypst } from '../src/core/diagram/vector';
import { segmentColor, hsl } from '../src/core/diagram/colors';
import { traceText, toLam, markdownSummary } from '../src/core/trace';

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
/** closed terms that have a β-redex: (λ...) applied to something */
const withRedex = fc.tuple(closedTerm(5), closedTerm(4)).map(([f, a]) => app(f.tag === 'lam' ? f : lam(f), a));

const key = (r: { x: number; y: number; w: number; h: number }) => `${r.x},${r.y},${r.w},${r.h}`;
const rectSet = (d: Diagram) => new Set(d.segments.map((s) => key(segmentRect(s))));

describe('β-step lineage', () => {
  it('tracks the argument copies', () => {
    const t = P('(λx.x x) (λy.y)');
    const m = betaLineage(t, '');
    expect(m.get('')).toBe('fb');
    expect(m.get('f')).toBe('a#0');
    expect(m.get('fb')).toBe('ab#0');
    expect(m.get('a')).toBe('a#1');
  });
  it('keeps everything outside the redex', () => {
    const t = P('λz.z ((λx.x) z)');
    const m = betaLineage(t, 'ba');
    expect(m.get('')).toBe('');
    expect(m.get('bf')).toBe('bf');
    expect(m.get('ba')).toBe('baa#0'); // the body x is replaced by the argument z
  });
});

describe('morph', () => {
  for (const [name, lay] of [['standard', layout], ['alternative', layoutAlternative]] as const) {
    it(`starts on the old diagram and ends on the new one (${name} style)`, () => {
      fc.assert(fc.property(withRedex, (t) => {
        const p = findRedex(t, { strategy: 'normal', eta: false });
        if (p === null) return true;
        const t2 = stepAt(t, p, false).term;
        const d1 = lay(t), d2 = lay(t2);
        const m = buildMorph(d1, d2, t, p, (s) => segmentColor(s, 'mono', false));
        const at0 = new Set(morphFrame(m, 0, null).filter((r) => r.alpha > 0.999).map(key));
        const at1 = morphFrame(m, 1, null).filter((r) => r.alpha > 0.999).map(key);
        const s1 = rectSet(d1);
        return [...at0].every((k) => s1.has(k)) && [...s1].every((k) => at0.has(k))
          && at1.length === d2.segments.length && new Set(at1).size === rectSet(d2).size && at1.every((k) => rectSet(d2).has(k));
      }), { numRuns: 200 });
    });
  }
});

describe('vector exports', () => {
  const d = layout(P('λf x.f (f x)'));
  it('TikZ draws one rectangle per segment', () => {
    const tex = toTikZ(d, { color: (s) => segmentColor(s, 'binder', false) });
    expect(tex.match(/\\fill/g)!.length).toBe(d.segments.length);
    expect(tex).toContain('\\begin{tikzpicture}');
    expect(tex).toMatch(/\\definecolor\{lama\}\{HTML\}\{[0-9A-F]{6}\}/);
  });
  it('Typst places one rectangle per segment', () => {
    const typ = toTypst(d, { background: '#ffffff' });
    expect(typ.match(/place\(/g)!.length).toBe(d.segments.length);
  });
  it('colours are hex', () => {
    expect(hsl(0, 100, 50)).toBe('#ff0000');
    for (const mode of ['mono', 'binder', 'depth', 'kind'] as const) for (const s of d.segments) expect(segmentColor(s, mode, true)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('text exports', () => {
  const t0 = P('(λx.x) (λy.y)');
  const t1 = stepAt(t0, '', false).term;
  it('trace in plain text and as a LaTeX chain', () => {
    const entries = [{ term: t0 }, { term: t1, kind: 'beta' }];
    expect(traceText(entries, 'named')).toBe('0     (λx.x) (λy.y)\n1  →β λy.y');
    const tex = traceText(entries, 'latex');
    expect(tex).toContain('\\to_\\beta');
    expect(tex).toContain('\\begin{align*}');
  });
  it('.lam and Markdown', () => {
    expect(toLam(P('λf x.f (f x)'))).toBe('\\f.\\x.f (f x)');
    const md = markdownSummary('PLUS 1 1', t0, P('2'), 7);
    expect(md).toContain('Church numeral 2');
    expect(md).toContain('After 7 steps');
  });
});
