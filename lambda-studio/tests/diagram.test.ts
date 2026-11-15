import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { type Term, app, lam, v, counts, isClosed } from '../src/core/term';
import { layout, crossings } from '../src/core/diagram/layout';
import { toBoxChars, toPixelArt } from '../src/core/diagram/ascii';
import { blcBits, encodeBLC, decodeBLC } from '../src/core/formats/blc';
import { parseProgram } from '../src/core/program';
import { printDeBruijn, parseDeBruijn } from '../src/core/formats/debruijn';
import { printNamed } from '../src/core/formats/named';
import { equal } from '../src/core/term';

const P = (s: string) => parseProgram(s, 'auto').term!;

/** Arbitrary closed term: generated with a binder depth so every index is bound. */
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

describe('Tromp diagram metrics', () => {
  it('identity, K, Church 2', () => {
    const I = layout(P('λx.x'));
    expect([I.width, I.height]).toEqual([3, 3]);
    const K = layout(P('λx y.x'));
    expect([K.width, K.height, crossings(K)]).toEqual([3, 5, 1]);
    const two = layout(P('2'));
    expect([two.width, two.height, crossings(two)]).toEqual([11, 9, 2]);
  });

  it('width = 4·vars − 1 and height = 2·depth + 1', () => {
    fc.assert(fc.property(closedTerm(), (t) => {
      const d = layout(t), c = counts(t);
      return d.width === 4 * c.vars - 1 && d.height === 2 * c.depth + 1;
    }), { numRuns: 500 });
  });

  it("Tromp's identity: BLC bits = 2·lines + crossings (closed terms)", () => {
    fc.assert(fc.property(closedTerm(), (t) => {
      if (!isClosed(t)) return true;
      const d = layout(t);
      return blcBits(t) === 2 * d.segments.length + crossings(d);
    }), { numRuns: 1000 });
  });

  it('application links never cross variable lines', () => {
    fc.assert(fc.property(closedTerm(), (t) => {
      const d = layout(t);
      const links = d.segments.filter((s) => s.kind === 'app');
      const vars = d.segments.filter((s) => s.kind === 'var');
      return links.every((l) => vars.every((s) => !(s.x1 > l.x1 && s.x1 < l.x2 && s.y1 <= l.y1 && s.y2 >= l.y1)));
    }), { numRuns: 500 });
  });

  it('segments stay inside the bounding box', () => {
    fc.assert(fc.property(closedTerm(), (t) => {
      const d = layout(t);
      return d.segments.every((s) => s.x1 >= 0 && s.x2 < d.width && s.y1 >= d.top && s.y2 < d.height && s.x1 <= s.x2 && s.y1 <= s.y2);
    }), { numRuns: 500 });
  });
});

describe('round trips (property)', () => {
  it('BLC encode/decode', () => {
    fc.assert(fc.property(closedTerm(), (t) => equal(decodeBLC(encodeBLC(t)).term, t)), { numRuns: 500 });
  });
  it('de Bruijn print/parse (both bases)', () => {
    fc.assert(fc.property(closedTerm(), (t) =>
      equal(parseDeBruijn(printDeBruijn(t, 0).text, 0), t) && equal(parseDeBruijn(printDeBruijn(t, 1).text, 1), t)), { numRuns: 500 });
  });
  it('named print/parse', () => {
    fc.assert(fc.property(closedTerm(), (t) => equal(parseProgram(printNamed(t).text, 'named').term!, t)), { numRuns: 500 });
  });
});

describe('text renderings', () => {
  it('box characters for identity and ω', () => {
    expect(toBoxChars(layout(P('λx.x')))).toBe('─┬─\n │');
    expect(toBoxChars(layout(P('λx.x x')))).toBe('─┬───┬─\n ├───┘\n │');
  });
  it('pixel art has the right size', () => {
    const art = toPixelArt(layout(P('λx.x')), '#', '.');
    expect(art).toBe('###\n.#.\n.#.');
  });
});
