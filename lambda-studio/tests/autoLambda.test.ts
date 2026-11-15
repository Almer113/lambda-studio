import { describe, it, expect } from 'vitest';
import { autoLambdaEdit } from '../src/ui/autoLambda';

/** Simulate typing `keys` one character at a time into `doc` (cursor at the end / replacing a selection). */
function type(keys: string, doc = '', sel: [number, number] = [doc.length, doc.length], latexFormat = false): string {
  let [from, to] = sel;
  for (const ch of keys) {
    const e = autoLambdaEdit(doc, from, to, ch, latexFormat);
    if (e) { doc = doc.slice(0, e.from) + e.insert + doc.slice(e.to); from = to = e.anchor; }
    else { doc = doc.slice(0, from) + ch + doc.slice(to); from = to = from + ch.length; }
  }
  return doc;
}

describe('backslash → λ while typing', () => {
  it('turns \\ into λ in plain sources', () => {
    expect(type('\\x y. y x')).toBe('λx y. y x');
    expect(type('\\f.\\x.f x')).toBe('λf.λx.f x');
  });
  it('restores LaTeX commands as they are typed', () => {
    expect(type('\\lambda x.\\, x\\,x')).toBe('\\lambda x.\\, x\\,x');
    expect(type('\\mathsf{PLUS}\\;\\ulcorner 2\\urcorner')).toBe('\\mathsf{PLUS}\\;\\ulcorner 2\\urcorner');
  });
  it('keeps backslashes once the source is LaTeX, or in LaTeX format', () => {
    expect(type('\\x', '\\lambda y.')).toBe('\\lambda y.\\x');
    expect(type('\\x.x', '', [0, 0], true)).toBe('\\x.x');
  });
  it('judges the text after replacing a selection', () => {
    const doc = '\\lambda x.x';
    expect(type('\\x y. y x', doc, [0, doc.length])).toBe('λx y. y x');
  });
  it('does not touch ordinary parameter names', () => {
    expect(type('\\to.to')).toBe('λto.to');
    expect(type('\\left right. left')).toBe('λleft right. left');
  });
});
