import { describe, it, expect } from 'vitest';
import { parseProgram } from '../src/core/program';
import { printNamed } from '../src/core/formats/named';
import { equal, free } from '../src/core/term';
import { applyEdit, applicable, rewriteSource, freshName } from '../src/core/edit';
import { normalize } from '../src/core/nbe';
import { decodeNumeral } from '../src/core/encodings';

const P = (s: string) => parseProgram(s, 'named').term!;
const show = (s: string, p: string, a: Parameters<typeof applyEdit>[2], arg?: string, name?: string) => {
  const r = applyEdit(P(s), p, a, arg ? P(arg) : undefined, name);
  return r ? printNamed(r).text : null;
};

describe('edit actions', () => {
  it('wraps, unwraps and η-converts', () => {
    expect(show('λx.x y', 'b', 'abstract')).toBe('λx x1.x y');
    expect(show('λx y.x', 'b', 'unwrap')).toBe('λx.x');
    expect(show('λx y.y', 'b', 'unwrap')).toBeNull();
    expect(show('λf.f', 'b', 'eta-expand')).toBe('λf x.f x');
    expect(show('λf x.f x', 'b', 'eta-reduce')).toBe('λf.f');
  });
  it('applies, passes, replaces and deletes', () => {
    expect(show('λx.x', 'b', 'apply', 'y')).toBe('λx.x y');
    expect(show('λx.x', 'b', 'pass', 'λz.z z')).toBe('λx.(λz.z z) x');
    expect(show('λx.x x', 'ba', 'replace', 'λz.z')).toBe('λx.x (λz.z)');
    expect(show('λx.x x', 'ba', 'delete')).toBe('λx.x');
    expect(show('λx.x x', 'bf', 'delete')).toBe('λx.x');
    expect(show('λx.x', '', 'delete')).toBeNull();
  });
  it('β-reduces at the selection and names closed subterms', () => {
    expect(show('(λx.x) y', '', 'beta')).toBe('y');
    const t = P('λx.x (λa b.a)');
    const r = applyEdit(t, 'ba', 'fold', undefined, 'MYK')!;
    expect(equal(r, P('λx.x MYK'))).toBe(true);
    expect(applicable(t, 'ba').has('fold')).toBe(true);
    expect(applicable(t, 'bf').has('fold')).toBe(false); // x is bound outside
  });
  it('replacing with a free name resolves through definitions after rewriting the source', () => {
    const src = '-- demo\nTWO = λf x.f (f x)\nPLUS 1 1';
    const t = P(src);
    const edited = applyEdit(t, 'a', 'replace', free('TWO'))!;
    const out = rewriteSource(src, printNamed(edited).text.replace(/λ.*$/, '') || 'PLUS 1 TWO');
    expect(out.startsWith('-- demo\nTWO = λf x.f (f x)\n')).toBe(true);
    const p = parseProgram(rewriteSource(src, 'PLUS 1 TWO'), 'named');
    expect(decodeNumeral(normalize(p.term!).term!)).toBe(3);
  });
  it('adds new definitions and fresh names', () => {
    expect(rewriteSource('A = λx.x\nA A', 'B A', [{ name: 'B', body: 'λy.y' }])).toBe('A = λx.x\nB = λy.y\nB A\n');
    expect(freshName('my', new Set(['MY', 'MY2']))).toBe('MY3');
  });
});

import { pack, unpack, packDeep, unpackDeep } from '../src/core/pack';
import { churchNumeral } from '../src/core/encodings';
describe('packing terms for workers', () => {
  it('round-trips, including very deep terms', () => {
    for (const s of ['λx.x', 'λf x.f (f x)', 'S K K', 'λx.free_name x', 'PLUS 2 3']) { const t = P(s); expect(equal(unpack(pack(t)), t)).toBe(true); }
    const deep = churchNumeral(20000);
    expect([...pack(unpack(pack(deep))).code]).toEqual([...pack(deep).code]); // (equal() itself recurses)
    const msg = unpackDeep(packDeep({ id: 1, history: [{ term: P('λx.x'), path: 'b' }], n: 3 }));
    expect(equal(msg.history[0].term, P('λx.x'))).toBe(true);
    expect(msg.n).toBe(3);
    expect((structuredClone(packDeep({ t: deep })).t as unknown as { code: Int32Array }).code.length).toBe(pack(deep).code.length);
  });
});
