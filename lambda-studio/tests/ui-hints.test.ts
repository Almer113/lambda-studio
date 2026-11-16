import { describe, expect, test } from 'vitest';
import { termKind } from '../src/core/algebra/kind';
import { parseProgram } from '../src/core/program';

const kind = (s: string) => termKind(parseProgram(s).term!);

describe('termKind', () => {
  test('Boolean functions', () => {
    for (const s of ['AND', 'OR', 'NOT', 'XOR', 'IMPLIES']) expect(kind(s)).toBe('boolean');
    expect(kind('λa b.AND a (NOT b)')).not.toBe('numeric'); // encodings overlap: no wrong hint
  });
  test('functions on numbers, predicates included', () => {
    for (const s of ['PLUS', 'SUCC', 'ISZERO', 'LEQ', 'λn.MULT n n', 'λn.PLUS n 1']) expect(kind(s)).toBe('numeric');
  });
  test('neither', () => {
    expect(kind('3')).toBeNull();
    expect(kind('λx.x')).toBeNull(); // works on both kinds
  });
});
