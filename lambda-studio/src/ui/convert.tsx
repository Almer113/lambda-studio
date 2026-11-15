// Notations panel (all conversions of the current term, grouped) and the data encoder.

import { useEffect, useMemo, useState } from 'react';
import { useStore, currentTerm } from './store';
import { printNamed } from '../core/formats/named';
import { printDeBruijn } from '../core/formats/debruijn';
import { encodeBLC, bitsToHex } from '../core/formats/blc';
import { bitsToBytes, bytesToHex, bytesToBase64 } from '../core/formats/blc8';
import { printJSON } from '../core/formats/json';
import { printLatex, type TexStyle } from '../core/formats/latex';
import { printCode, CODE_LANGS } from '../core/formats/code';
import { toCL, printCL, clSize, ALGORITHMS, NotationError, TooLarge, type Algorithm, type CL, type CLStyle } from '../core/combinators';
import { layout } from '../core/diagram/layout';
import { toBoxChars } from '../core/diagram/ascii';
import { type Term, size } from '../core/term';
import { encodeData, DATA_KINDS, ENCODING_NAMES, type DataKind, type Encoding } from '../core/data';
import { TexView, ViewToggle } from './Tex';
import { reduceInnermost } from './TermText';
import { useFolder } from './panels';

const BIG = 25000;
/** Longest text shown in a row (copy still gives everything). */
const SHOW = 20000;

function useTexSetting(id: string): [boolean, (v: boolean) => void] {
  const tex = useStore((s) => s.settings.tex[id] ?? false);
  return [tex, (v: boolean) => { const st = useStore.getState(); st.setSetting('tex', { ...st.settings.tex, [id]: v }); }];
}

export interface Row { id: string; label: string; text: string; note?: string; mono?: boolean; error?: string; tex?: () => { tagged: string; plain: string } }
type Group = 'lambda' | 'combinators' | 'code' | 'bits';

const GROUPS: { id: Group; title: string }[] = [
  { id: 'lambda', title: 'λ notations' },
  { id: 'combinators', title: 'Combinators' },
  { id: 'code', title: 'Code' },
  { id: 'bits', title: 'Bits & data' },
];

const attempt = (id: string, label: string, f: () => string, note?: string | (() => string)): Row => {
  try {
    const text = f();
    return { id, label, text, note: typeof note === 'function' ? note() : note };
  } catch (e) {
    if (e instanceof NotationError || e instanceof TooLarge) return { id, label, text: '', error: e.message };
    return { id, label, text: '', error: (e as Error).message };
  }
};

function lambdaRows(term: Term, fold: ReturnType<typeof useFolder>['fold'], avoid: ReadonlySet<string>): Row[] {
  const texOf = (style: TexStyle, folded: boolean) => () => ({
    tagged: printLatex(term, { style, tags: true, ...(folded ? { fold, avoid } : {}) }),
    plain: printLatex(term, { style, ...(folded ? { fold, avoid } : {}) }),
  });
  return [
    { id: 'named', label: 'Named (with names)', text: printNamed(term, { fold, avoid }).text, tex: texOf('named', true) },
    { id: 'expanded', label: 'Named (expanded)', text: printNamed(term).text, tex: texOf('named', false) },
    { id: 'ascii', label: 'Named (ASCII \\)', text: printNamed(term, { lambda: '\\' }).text },
    { id: 'debruijn0', label: 'De Bruijn (0-based)', text: printDeBruijn(term, 0).text, tex: texOf('debruijn0', false) },
    { id: 'debruijn1', label: 'De Bruijn (1-based, Tromp)', text: printDeBruijn(term, 1).text, tex: texOf('debruijn1', false) },
    { id: 'latex', label: 'LaTeX source', text: printLatex(term, { fold, avoid }), note: '⌜n⌝ needs amssymb' },
  ];
}

function combinatorRows(cl: CL | Error): Row[] {
  if (cl instanceof Error) return [{ id: 'ski', label: 'Combinators', text: '', error: cl.message }];
  const style = (id: CLStyle, label: string, note?: string): Row => attempt(id, label, () => printCL(cl, id), note);
  return [
    attempt('ski', 'Combinators', () => printCL(cl, 'ski'), () => `${clSize(cl)} atoms`),
    style('unlambda', 'Unlambda', 's k i, ` = apply'),
    style('lazyk', 'Lazy K (SKI)', 'S K I only'),
    style('iota', 'Iota', 'ι = λf.f S K, * = apply'),
    style('jot', 'Jot', 'K = 11100, S = 11111000'),
    style('bcl', 'Binary combinatory logic', 'K = 00, S = 01, 1 = apply'),
  ];
}

function codeRows(term: Term): Row[] {
  return CODE_LANGS.map((l) => attempt(l.id, l.name, () => printCode(term, l.id)));
}

function bitRows(term: Term): Row[] {
  const rows: Row[] = [];
  try {
    const bits = encodeBLC(term);
    rows.push({ id: 'blc', label: 'Binary λ-calculus', text: bits, note: `${bits.length} bits · hex ${bitsToHex(bits)}` });
    const bytes = bitsToBytes(bits);
    rows.push({ id: 'blc8', label: 'BLC8 bytes', text: bytesToHex(bytes), note: `${bytes.length} byte${bytes.length === 1 ? '' : 's'} · base64 ${bytesToBase64(bytes)}` });
  } catch (e) { rows.push({ id: 'blc', label: 'Binary λ-calculus', text: '', error: (e as Error).message }); }
  if (size(term) < 3000) rows.push({ id: 'box', label: 'Diagram (box characters)', text: toBoxChars(layout(term)), mono: true });
  rows.push({ id: 'json', label: 'JSON AST', text: printJSON(term) });
  return rows;
}

export function Conversions() {
  const term = useStore(currentTerm);
  const algorithm = useStore((s) => s.settings.clAlgorithm);
  const open = useStore((s) => s.settings.openGroups);
  const setSetting = useStore((s) => s.setSetting);
  const { fold, avoid } = useFolder();
  const [force, setForce] = useState(false);
  useEffect(() => setForce(false), [term]);
  const tooBig = !!term && size(term) > BIG && !force;

  const cl = useMemo<CL | Error | null>(() => {
    if (!term || tooBig || !open.combinators) return null;
    try { return toCL(term, algorithm, 400_000); } catch (e) { return e as Error; }
  }, [term, tooBig, algorithm, open.combinators]);
  const sizes = useMemo(() => {
    if (!term || tooBig || !open.combinators || size(term) > 2000) return null;
    return ALGORITHMS.map((a) => { try { return { id: a.id, n: clSize(toCL(term, a.id, 200_000)) }; } catch { return { id: a.id, n: null }; } });
  }, [term, tooBig, open.combinators]);

  const groups = useMemo(() => {
    if (!term || tooBig) return null;
    const out: Partial<Record<Group, Row[]>> = {};
    if (open.lambda) out.lambda = lambdaRows(term, fold, avoid);
    if (open.combinators && cl) out.combinators = combinatorRows(cl);
    if (open.code) out.code = codeRows(term);
    if (open.bits) out.bits = bitRows(term);
    return out;
  }, [term, tooBig, fold, avoid, cl, open]);

  return (
    <div className="panel conversions">
      <div className="panel-head"><h2>Notations</h2></div>
      {!term && <div className="empty">—</div>}
      {tooBig && <button onClick={() => setForce(true)}>Term is large ({size(term!)} nodes) — compute notations</button>}
      {term && !tooBig && GROUPS.map((g) => (
        <section key={g.id} className="conv-group">
          <button className="group-title" aria-expanded={!!open[g.id]} onClick={() => setSetting('openGroups', { ...open, [g.id]: !open[g.id] })}>
            {open[g.id] ? '▾' : '▸'} {g.title}
          </button>
          {open[g.id] && g.id === 'combinators' && (
            <div className="alg-row">
              <label>Algorithm
                <select value={algorithm} onChange={(e) => setSetting('clAlgorithm', e.target.value as Algorithm)}>
                  {ALGORITHMS.map((a) => <option key={a.id} value={a.id} title={a.description}>{a.name}</option>)}
                </select>
              </label>
              {sizes && (
                <span className="alg-sizes" title="Size of the combinator term (number of atoms) with each algorithm">
                  {sizes.map((s) => <span key={s.id} className={s.id === algorithm ? 'on' : ''}>{ALGORITHMS.find((a) => a.id === s.id)!.short} {s.n ?? '—'}</span>)}
                </span>
              )}
              <p className="hint">{ALGORITHMS.find((a) => a.id === algorithm)!.description} Unlambda, Iota, Jot and binary CL rewrite the result into S and K.</p>
            </div>
          )}
          {open[g.id] && groups?.[g.id]?.map((r) => <OutputRow key={r.id} row={r} />)}
        </section>
      ))}
    </div>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button className="copy" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {}); }}>
      {copied ? 'Copied' : label}
    </button>
  );
}

function OutputRow({ row }: { row: Row }) {
  const { id, label, text, note, mono, error } = row;
  const [asTex, setAsTex] = useTexSetting(id);
  const hover = useStore((s) => s.hover);
  const setHover = useStore((s) => s.setHover);
  const tex = useMemo(() => (asTex && row.tex && text ? row.tex() : null), [asTex, row, text]);
  const shown = text.length > SHOW ? text.slice(0, SHOW) : text;
  return (
    <div className="out-row">
      <div className="out-head">
        <span className="out-label">{label}</span>
        {(note || text.length > SHOW) && <span className="out-note">{text.length > SHOW ? `${text.length.toLocaleString()} characters, showing the start · ` : ''}{note}</span>}
        <span className="out-tools">
          {row.tex && text && <ViewToggle tex={asTex} onChange={setAsTex} />}
          {text && <CopyButton text={text} />}
          {tex && <CopyButton text={tex.plain} label="LaTeX" />}
        </span>
      </div>
      {error && <div className="out-error">{error}</div>}
      {tex && <TexView tex={tex.tagged} className="out-tex" hover={hover} onHover={(p) => setHover(p, 'text')} onDoubleClick={reduceInnermost} />}
      {text && !tex && <pre className={mono ? 'out-text box' : 'out-text'}>{shown}{text.length > SHOW ? '…' : ''}</pre>}
    </div>
  );
}

// --- data encoder ------------------------------------------------------------
export function DataPanel() {
  const [kind, setKind] = useState<DataKind>('nat');
  const [enc, setEnc] = useState<Encoding>('church');
  const [value, setValue] = useState('5');
  const insert = useStore((s) => s.insertText);
  const setSource = useStore((s) => s.setSource);
  const info = DATA_KINDS.find((k) => k.id === kind)!;
  const encoding = info.encodings.includes(enc) ? enc : info.encodings[0];
  const result = useMemo(() => {
    try {
      const t = encodeData(kind, encoding, value);
      return { text: printNamed(t).text, size: size(t) };
    } catch (e) { return { error: (e as Error).message }; }
  }, [kind, encoding, value]);
  return (
    <div className="panel data-panel">
      <div className="panel-head"><h2>Encode data</h2></div>
      <div className="data-form">
        <select aria-label="Data type" value={kind} onChange={(e) => { const k = e.target.value as DataKind; setKind(k); setValue(DATA_KINDS.find((x) => x.id === k)!.placeholder); }}>
          {DATA_KINDS.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <select aria-label="Encoding" value={encoding} onChange={(e) => setEnc(e.target.value as Encoding)} disabled={info.encodings.length < 2}>
          {info.encodings.map((x) => <option key={x} value={x}>{ENCODING_NAMES[x]}</option>)}
        </select>
        <input aria-label="Value" value={value} placeholder={info.placeholder} onChange={(e) => setValue(e.target.value)} title={info.hint} />
      </div>
      {'error' in result ? <div className="out-error">{result.error}</div> : (
        <>
          <pre className="out-text">{result.text!.length > 2000 ? result.text!.slice(0, 2000) + '…' : result.text}</pre>
          <div className="buttons">
            <button onClick={() => insert?.(`(${result.text})`)}>Insert</button>
            <button onClick={() => setSource(result.text!)}>Use as source</button>
            <span className="sub">{result.size} nodes</span>
          </div>
        </>
      )}
    </div>
  );
}
