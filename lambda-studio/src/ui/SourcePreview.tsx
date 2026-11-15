// Live typeset preview of the source as written: definitions, let, numerals and names kept,
// one line per statement, hover-linked to the diagram through the parser's source spans.

import { useMemo } from 'react';
import { useStore } from './store';
import { lex, parseStatements, type Token } from '../core/formats/named';
import { tokensToTex, printLatex, texName } from '../core/formats/latex';
import { makeFolder } from '../core/fold';
import { preludeInfo } from '../core/program';
import type { Path } from '../core/term';
import { TexView } from './Tex';
import { reduceInnermost } from './TermText';

const MAX_SOURCE = 6000;

interface Line { key: string; tex: string; def: boolean }

export function SourcePreview() {
  const source = useStore((s) => s.source);
  const program = useStore((s) => s.program);
  const singleLetter = useStore((s) => s.settings.singleLetter);
  const hover = useStore((s) => s.hover);
  const setHover = useStore((s) => s.setHover);
  // source paths describe the initial term; link only while it is the one on screen
  const linked = useStore((s) => s.index === 0);

  const lines = useMemo<Line[] | string>(() => {
    if (!source.trim()) return [];
    if (source.length > MAX_SOURCE) return 'Source too long to preview.';
    const fmt = program.format;
    if (fmt === 'latex') {
      // already LaTeX: show it as typed (without math delimiters), split at \\ line breaks
      return source.replace(/^\s*\$+|\$+\s*$/g, '').split(/\\\\/).filter((l) => l.trim()).map((l, i) => ({ key: String(i), tex: l, def: false }));
    }
    if (fmt !== 'named' && fmt !== 'haskell' && fmt !== 'debruijn0' && fmt !== 'debruijn1') {
      // code, combinators, bits, JSON: typeset what was parsed, with names folded back in
      if (!program.term && !program.defs.length) return program.diagnostics.length ? 'Fix the syntax error to see the preview.' : [];
      const folder = makeFolder(program.foldTable, { numerals: true, zeroAs: '0' });
      const avoid = program.foldTable.names;
      const out: Line[] = program.defs.filter((d) => d.term && d.name !== program.mainName).map((d) => ({
        key: 'def:' + d.name, def: true,
        tex: `${texName(d.name, true)} \\equiv ${printLatex(d.term!, { fold: (t) => (t === d.term ? null : folder(t)), avoid })}`,
      }));
      if (program.term) out.push({ key: 't', def: false, tex: printLatex(program.term, { tags: true, fold: folder, avoid }) });
      return out;
    }
    const text = source;
    const spans: { path: Path; from: number; to: number }[] = [...program.spans].map(([path, s]) => ({ path, ...s }));
    let toks: Token[];
    try { toks = lex(text); } catch { return 'Fix the syntax error to see the preview.'; }
    if (fmt === 'debruijn0' || fmt === 'debruijn1') {
      return [{ key: 't', tex: tokensToTex(toks, spans, { tags: true, defNames: new Set(), numerals: 'index' }), def: false }];
    }
    const defNames = new Set<string>([...preludeInfo().map((d) => d.name), ...program.defs.map((d) => d.name)]);
    const { statements } = parseStatements(text, { singleLetter, knownNames: defNames });
    return statements.map((st) => {
      const ts = toks.filter((t) => t.from >= st.from && t.to <= st.to);
      const ss = spans.filter((s) => s.from >= st.from && s.to <= st.to);
      return { key: `${st.from}`, tex: tokensToTex(ts, ss, { tags: true, defNames, numerals: 'church', singleLetter }), def: st.kind === 'def' };
    });
  }, [source, program, singleLetter]);

  if (typeof lines === 'string') return <div className="preview"><div className="empty">{lines}</div></div>;
  if (lines.length === 0) return null;
  return (
    <div className="preview" aria-label="Typeset preview">
      {lines.map((l) => (
        <TexView key={l.key} tex={l.tex} className={l.def ? 'preview-line def' : 'preview-line'} hover={linked ? hover : null}
          onHover={linked ? (p) => setHover(p, 'text') : undefined} onDoubleClick={linked ? reduceInnermost : undefined} />
      ))}
    </div>
  );
}
