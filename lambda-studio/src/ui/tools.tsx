// Tools panel: the "bridge" features — expressions → λ, truth tables, value tables with a
// guessed closed form, equation checks, data types → encodings, and term generators.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, currentTerm, type ToolsTab } from './store';
import { useFolder } from './panels';
import { TexView } from './Tex';
import { MathField } from './MathField';
import { type Term, size } from '../core/term';
import { termKind } from '../core/algebra/kind';
import { parseProgram } from '../core/program';
import { printNamed } from '../core/formats/named';
import { parseExpr, exprToLambda, exprToTex, evalExpr, typeOf, ExprError } from '../core/algebra/expr';
import { arityOf, argNames, formulas, formulaToLambda, MAX_TRUTH_VARS, type TruthTable } from '../core/algebra/boolean';
import { valueText, isPredicate, asNumbers, asBools, guessSequence, guessPredicate, guessBinary, guessBinaryPredicate, type Value, type Guess } from '../core/algebra/numeric';
import { LAWS, type LawResult } from '../core/algebra/laws';
import { parseData, generate, ENCODINGS, DATA_EXAMPLES, type Encoding } from '../core/adt';
import { Counter, randomClosedTerm } from '../core/generate';
import { PRELUDE } from '../core/prelude';
import { packDeep, unpackDeep } from '../core/pack';
import type { ToolRequest, ToolResponse, EnumItem } from '../worker/tools.worker';
import ToolsWorker from '../worker/tools.worker?worker&inline';
import type { BBResult } from '../core/generate';
import { NumberField } from './NumberField';
import { FileInput, TextCursorInput, ListPlus, Dices, Sigma, Table, Hash, Equal, Boxes } from 'lucide-react';
import type { TabDef } from './Tabs';
import { insertIntoSource } from './Toast';
import { ExampleMenu } from './Popover';
import { IconButton, CopyButton } from './IconButton';

const TABS: TabDef<ToolsTab>[] = [
  { id: 'expr', label: 'Expression → λ', icon: Sigma, title: 'Arithmetic and Boolean expressions as λ-terms.' },
  { id: 'truth', label: 'Truth table', icon: Table, title: 'Truth table, DNF/CNF and a minimal formula of the current term.' },
  { id: 'table', label: 'Number table', icon: Hash, title: 'The current term on Church numerals, with a guessed closed form.' },
  { id: 'laws', label: 'Laws', icon: Equal, title: 'Check an equation between two terms (βη).' },
  { id: 'data', label: 'Data types', icon: Boxes, title: 'Church, Scott and Parigot encodings of a data type declaration.' },
  { id: 'generate', label: 'Generate', icon: Dices, title: 'Count, sample and enumerate closed terms; the BBλ explorer.' },
];

/** When the open tool does not suit the term, point at the one that does. */
function ToolHint({ tab }: { tab: ToolsTab }) {
  const term = useStore(currentTerm);
  const setSetting = useStore((s) => s.setSetting);
  const kind = useMemo(() => (term && (tab === 'truth' || tab === 'table') && size(term) < 5000 ? termKind(term) : null), [term, tab]);
  const want: ToolsTab | null = tab === 'table' && kind === 'boolean' ? 'truth' : tab === 'truth' && kind === 'numeric' ? 'table' : null;
  if (!want) return null;
  return (
    <p className="tool-hint">
      This looks like a {kind === 'boolean' ? 'Boolean function' : 'function on numbers'}.{' '}
      <button type="button" className="linklike" onClick={() => setSetting('toolsTab', want)}>Open {TABS.find((t) => t.id === want)!.label}</button>
    </p>
  );
}

export function ToolsPanel() {
  const tab = useStore((s) => s.settings.toolsTab);
  const setSetting = useStore((s) => s.setSetting);
  const cur = TABS.find((t) => t.id === tab) ?? TABS[0];
  return (
    <div className="tools-panel">
      {/* one menu instead of six wrapping tabs: a fourth level of tabs on phones */}
      <div className="tool-pick">
        <label className="field">Tool
          <select value={tab} onChange={(e) => setSetting('toolsTab', e.target.value as ToolsTab)}>
            {TABS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <span className="muted">{cur.title}</span>
      </div>
      <ToolHint tab={tab} />
      <div className="tool-body" role="region" aria-label={cur.label}>
        {tab === 'expr' && <ExpressionTool />}
        {tab === 'truth' && <TruthTool />}
        {tab === 'table' && <TableTool />}
        {tab === 'laws' && <LawsTool />}
        {tab === 'data' && <DataTool />}
        {tab === 'generate' && <GenerateTool />}
      </div>
    </div>
  );
}

// --- background jobs -----------------------------------------------------------------------
type Req = ToolRequest extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never;

/**
 * Background jobs for one tool. The tool keeps its worker between jobs; a job that is still running
 * when a new one starts (or on Cancel) is stopped by replacing the worker, the only way to interrupt
 * it. Results of a superseded job are dropped.
 */
function useJob() {
  const worker = useRef<Worker | null>(null);
  const running = useRef(false);
  const seq = useRef(0);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const drop = () => { worker.current?.terminate(); worker.current = null; running.current = false; };
  const cancel = () => { seq.current++; drop(); setBusy(null); };
  useEffect(() => () => { seq.current++; drop(); }, []);
  const run = (req: Req): Promise<ToolResponse> => {
    if (running.current) drop();
    const w = worker.current ?? (worker.current = new ToolsWorker());
    const id = ++seq.current;
    running.current = true;
    setBusy({ done: 0, total: 0 });
    return new Promise((resolve, reject) => {
      w.onmessage = (e: MessageEvent<ToolResponse>) => {
        const m = unpackDeep(e.data);
        if (m.id !== id || seq.current !== id) return;
        if (m.type === 'progress') { setBusy({ done: m.done, total: m.total }); return; }
        running.current = false; setBusy(null);
        if (m.type === 'error') reject(new Error(m.message)); else resolve(m);
      };
      w.onerror = (e) => {
        if (seq.current !== id) return;
        drop(); setBusy(null);
        reject(new Error(e.message || 'Worker failed'));
      };
      w.postMessage(packDeep({ ...req, id }));
    });
  };
  return { run, busy, cancel };
}

function Busy({ busy, cancel, label }: { busy: { done: number; total: number } | null; cancel: () => void; label: string }) {
  if (!busy) return null;
  return <div className="status running">{label}{busy.total ? ` ${busy.done.toLocaleString('en')} / ${busy.total.toLocaleString('en')}` : '…'} <button onClick={cancel}>Cancel</button></div>;
}

function useActions() {
  const setSource = useStore((s) => s.setSource);
  const source = useStore((s) => s.source);
  return {
    use: (src: string) => setSource(src, 'auto'),
    insert: (src: string) => insertIntoSource(src, 'the term'),
    append: (src: string) => setSource(`${source.trimEnd()}\n\n${src}`),
  };
}

function Code({ text, actions = true }: { text: string; actions?: boolean }) {
  const a = useActions();
  return (
    <div className="tool-code">
      <code>{text}</code>
      {actions && (
        <span className="tool-code-actions">
          <IconButton icon={FileInput} text="Use as source" label="Replace the source with this" onClick={() => a.use(text)} />
          <IconButton icon={TextCursorInput} text="Insert" label="Insert at the cursor in the source" onClick={() => a.insert(text)} />
          <CopyButton text={text} what="this term" />
        </span>
      )}
    </div>
  );
}

/** Parse a named-notation expression with the prelude and, when the source is in named notation, its definitions. */
function useParseInContext() {
  const source = useStore((s) => s.source);
  const program = useStore((s) => s.program);
  return (expr: string): { term: Term | null; error?: string } => {
    const withDefs = program.format === 'named' || program.format === 'haskell';
    const p = parseProgram(withDefs ? `${source}\n${expr}` : expr, 'named');
    const own = parseProgram(expr, 'named');
    if (own.diagnostics.some((d) => d.severity === 'error') && !withDefs) return { term: null, error: own.diagnostics[0].message };
    if (!p.term) return { term: null, error: (own.diagnostics[0] ?? p.diagnostics.find((d) => d.severity === 'error'))?.message ?? 'Could not parse' };
    return { term: p.term };
  };
}

// --- expression → λ ------------------------------------------------------------------------
const EXPR_EXAMPLES = [
  '(2 + 3) * 4^2', '(a ∧ ¬b) ∨ c', 'p → q ↔ ¬q → ¬p', 'n^2 + n', 'n mod 3 = 0', '(m + n)^2', '5! / 3!', 'x ≥ 3 ∧ x ≤ 6',
];

function ExpressionTool() {
  const [text, setText] = useState('(2 + 3) * 4^2');
  const [latex, setLatex] = useState('(2+3)\\cdot4^2');
  const math = useStore((s) => s.settings.mathEditor);
  const setSetting = useStore((s) => s.setSetting);
  const actions = useActions();
  const input = math ? latex : text;

  const r = useMemo(() => {
    try {
      const e = parseExpr(input);
      const typed = typeOf(e);
      const lambda = exprToLambda(e);
      // a closed expression: its value computed directly, to compare with the λ-term's
      let direct: { value: number | boolean } | { error: string } | null = null;
      if (!typed.vars.length) { try { direct = { value: evalExpr(e) }; } catch (x) { direct = { error: (x as Error).message }; } }
      return { ok: true as const, tex: exprToTex(e), lambda, typed, direct };
    } catch (x) {
      return { ok: false as const, error: x instanceof ExprError ? x.message : String(x) };
    }
  }, [input]);

  // the λ-term's value, normalized in the background (after a short pause in typing)
  const job = useJob();
  const [got, setGot] = useState<{ lambda: string; value: number | boolean | null } | null>(null);
  const directValue = r.ok && r.direct && 'value' in r.direct ? r.direct.value : null;
  useEffect(() => {
    setGot(null);
    if (!r.ok || directValue === null || (typeof directValue === 'number' && directValue > 5000)) { job.cancel(); return; }
    const t = parseProgram(r.lambda, 'named').term;
    if (!t) return;
    const lambda = r.lambda;
    const timer = setTimeout(() => {
      job.run({ type: 'value', term: t, as: typeof directValue === 'number' ? 'num' : 'bool', fuel: 2_000_000 })
        .then((m) => { if (m.type === 'value') setGot({ lambda, value: m.value }); })
        .catch(() => setGot({ lambda, value: null }));
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);
  const value = !r.ok || !r.direct ? null
    : 'error' in r.direct ? { direct: r.direct.error, lambda: '', agree: null }
    : typeof r.direct.value === 'number' && r.direct.value > 5000 ? { direct: String(r.direct.value), lambda: 'too large to build as a Church numeral', agree: null }
    : !got || got.lambda !== r.lambda ? { direct: String(r.direct.value), lambda: job.busy ? 'computing…' : '…', agree: null }
    : { direct: String(r.direct.value), lambda: got.value === null ? 'no value within the limit' : String(got.value), agree: got.value === null ? null : got.value === r.direct.value };

  const send = (tab: ToolsTab) => { if (r.ok) { actions.use(r.lambda); setSetting('toolsTab', tab); } };
  return (
    <div className="tool">
      <div className="tool-row">
        <label className="check" title="Type with a WYSIWYG math editor (fractions, powers, ∧ ∨ ¬ …)"><input type="checkbox" checked={math} onChange={(e) => setSetting('mathEditor', e.target.checked)} /> Math editor</label>
        <ExampleMenu label="Expression examples" items={EXPR_EXAMPLES} name={(x) => x} onPick={(v) => { setText(v); setLatex(toLatexGuess(v)); }} />
        <span className="muted">+ − × ÷ mod ^ ! · &lt; ≤ = ≠ · ∧ ∨ ¬ ⊕ → ↔ (or and/or/not, &amp;&amp; || !)</span>
      </div>
      {math
        ? <MathField value={latex} onChange={setLatex} placeholder="\text{Type an expression}" />
        : <input className="tool-input" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="Expression" placeholder="(a ∧ ¬b) ∨ c" />}
      {!r.ok ? <p className="err">{r.error}</p> : (
        <>
          <div className="tool-preview"><TexView tex={r.tex} /></div>
          <dl className="stats">
            <dt>λ-term</dt><dd><Code text={r.lambda} /></dd>
            {r.typed.vars.length > 0 && <><dt>Inputs</dt><dd>{r.typed.vars.map((v) => `${v.name} : ${v.type === 'num' ? 'number' : 'truth value'}`).join(', ')} → {r.typed.type === 'num' ? 'number' : 'truth value'}</dd></>}
            {value && <><dt>Value</dt><dd>
              {value.direct}{value.lambda && <> · λ-term gives <b>{value.lambda}</b></>}
              {value.agree === true && <span className="ok"> ✓ agrees</span>}
              {value.agree === false && <span className="err"> ✗ disagrees</span>}
            </dd></>}
          </dl>
          {r.typed.vars.length > 0 && (
            <div className="tool-row">
              {r.typed.vars.every((v) => v.type === 'bool') && r.typed.type === 'bool' && <button onClick={() => send('truth')}>Truth table →</button>}
              {r.typed.vars.every((v) => v.type === 'num') && r.typed.vars.length <= 2 && <button onClick={() => send('table')}>Number table →</button>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Rough LaTeX for an example (for the math editor). */
function toLatexGuess(s: string): string {
  return s.replace(/\*/g, '\\cdot ').replace(/∧/g, '\\land ').replace(/∨/g, '\\lor ').replace(/¬/g, '\\lnot ').replace(/↔/g, '\\leftrightarrow ')
    .replace(/→/g, '\\to ').replace(/≥/g, '\\ge ').replace(/≤/g, '\\le ').replace(/\bmod\b/g, '\\bmod ').replace(/\//g, '\\div ');
}

// --- truth table ---------------------------------------------------------------------------
function TruthTool() {
  const term = useStore(currentTerm);
  const { run, busy, cancel } = useJob();
  const ar = useMemo(() => (term ? arityOf(term) : { n: 0, hints: [] }), [term]);
  const [n, setN] = useState<number | null>(null);
  const inputs = Math.min(MAX_TRUTH_VARS, n ?? ar.n);
  const names = useMemo(() => argNames(ar.hints, inputs), [ar, inputs]);
  const [table, setTable] = useState<TruthTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setN(null); }, [term]);
  useEffect(() => {
    setTable(null); setError(null);
    if (!term) return;
    run({ type: 'truth', term, n: inputs, names, fuel: 200_000 })
      .then((m) => { if (m.type === 'truth') setTable(m.table); })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, inputs, names.join(',')]);
  const f = useMemo(() => (table ? formulas(table) : null), [table]);
  if (!term) return <p className="muted">No term.</p>;
  return (
    <div className="tool">
      <p className="muted">Applies the current term to every combination of TRUE and FALSE and reads the results. Try XOR, IMPLIES or an expression from the first tab.</p>
      <div className="tool-row">
        <label>Inputs <NumberField min={0} max={MAX_TRUTH_VARS} value={inputs} onChange={setN} /></label>
        {ar.n > MAX_TRUTH_VARS && <span className="muted">(the term takes {ar.n} arguments; showing {MAX_TRUTH_VARS})</span>}
      </div>
      <Busy busy={busy} cancel={cancel} label="Evaluating rows" />
      {error && <p className="err">{error}</p>}
      {table && (
        <>
          {f ? (
            <dl className="stats">
              <dt>Minimal</dt><dd><b>{f.minimal}</b> <CopyButton text={f.minimal} what="the minimal formula" /></dd>
              <dt>As λ</dt><dd><Code text={formulaToLambda(f.minimalCubes, table.vars)} /></dd>
              <dt>DNF</dt><dd className="wrap">{f.dnf}</dd>
              <dt>CNF</dt><dd className="wrap">{f.cnf}</dd>
            </dl>
          ) : <p className="warn">Some rows are not TRUE or FALSE, so there is no formula. Is this a Boolean function of {inputs} input{inputs === 1 ? '' : 's'}?</p>}
          <div className="table-scroll">
            <table className="truth">
              <thead><tr>{table.vars.map((v) => <th key={v}>{v}</th>)}<th className="out">out</th></tr></thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i}>{r.inputs.map((b, k) => <td key={k} className={b ? 't' : 'f'}>{b ? 'T' : 'F'}</td>)}
                    <td className={`out ${r.out === null ? 'bad' : r.out ? 't' : 'f'}`} title={r.note}>{r.out === null ? '?' : r.out ? 'T' : 'F'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// --- number table --------------------------------------------------------------------------
function TableTool() {
  const term = useStore(currentTerm);
  const { run, busy, cancel } = useJob();
  const ar = useMemo(() => (term ? arityOf(term).n : 0), [term]);
  const [arityPick, setArity] = useState<1 | 2 | null>(null);
  const arity: 1 | 2 = arityPick ?? (ar >= 2 ? 2 : 1);
  const [N, setNum] = useState<number | null>(null);
  const max = N ?? (arity === 1 ? 10 : 5);
  const [rows, setRows] = useState<Value[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setArity(null); }, [term]);
  useEffect(() => {
    setRows(null); setError(null);
    if (!term) return;
    run({ type: 'table', term, arity, N: max, fuel: 300_000 })
      .then((m) => { if (m.type === 'table') setRows(m.rows); })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, arity, max]);

  const guesses = useMemo((): { pred: boolean; list: Guess[] } | null => {
    if (!rows) return null;
    const flat = rows.flat();
    const pred = isPredicate(flat);
    if (arity === 1) return { pred, list: pred ? guessPredicate(asBools(rows[0])) : guessSequence(asNumbers(rows[0])) };
    return { pred, list: pred ? guessBinaryPredicate(rows.map(asBools)) : guessBinary(rows.map(asNumbers)) };
  }, [rows, arity]);

  if (!term) return <p className="muted">No term.</p>;
  const cell = (v: Value) => <td className={v.k === 'none' || v.k === 'other' ? 'bad' : ''} title={v.k === 'none' ? v.why : v.k === 'num' && v.eta ? 'λx.x, which is η-equal to the numeral 1' : undefined}>{valueText(v)}</td>;
  return (
    <div className="tool">
      <p className="muted">Applies the current term to Church numerals and decodes the results. Try FACT, FIB, λn.MULT n n or an expression from the first tab.{ar === 0 && ' The current term takes no arguments.'}</p>
      <div className="tool-row">
        <label>Arguments <select value={arity} onChange={(e) => setArity(Number(e.target.value) as 1 | 2)}><option value={1}>1: f(n)</option><option value={2}>2: f(m, n)</option></select></label>
        <label>Up to <NumberField min={2} max={arity === 1 ? 30 : 12} value={max} onChange={setNum} /></label>
      </div>
      <Busy busy={busy} cancel={cancel} label="Evaluating" />
      {error && <p className="err">{error}</p>}
      {rows && (
        <>
          <div className="table-scroll">
            {arity === 1 ? (
              <table className="values">
                <tbody>
                  <tr><th>n</th>{rows[0].map((_, n) => <th key={n}>{n}</th>)}</tr>
                  <tr><th>f(n)</th>{rows[0].map((v, n) => <Cell key={n} v={v} render={cell} />)}</tr>
                </tbody>
              </table>
            ) : (
              <table className="values grid">
                <thead><tr><th>m \ n</th>{rows[0].map((_, n) => <th key={n}>{n}</th>)}</tr></thead>
                <tbody>{rows.map((row, m) => <tr key={m}><th>{m}</th>{row.map((v, n) => <Cell key={n} v={v} render={cell} />)}</tr>)}</tbody>
              </table>
            )}
          </div>
          {guesses && (
            <div className="conjecture">
              <span className="tag">Conjecture</span>
              {guesses.list.length ? (
                <>f({arity === 1 ? 'n' : 'm, n'}) {guesses.pred ? 'is TRUE when ' : '= '}<b>{guesses.list[0].formula}</b>
                  {guesses.list[0].note && <span className="muted"> ({guesses.list[0].note})</span>}
                  {guesses.list.length > 1 && <span className="muted"> · also fits: {guesses.list.slice(1).map((g) => g.formula).join(', ')}</span>}
                  <span className="muted"> — fits the values above; not a proof.</span></>
              ) : <span className="muted">No simple formula fits these values.</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
const Cell = ({ v, render }: { v: Value; render: (v: Value) => JSX.Element }) => render(v);

// --- laws ----------------------------------------------------------------------------------
function LawsTool() {
  const [left, setLeft] = useState(LAWS[0].left);
  const [right, setRight] = useState(LAWS[0].right);
  const [note, setNote] = useState<string | undefined>(LAWS[0].note);
  const parse = useParseInContext();
  const { run, busy, cancel } = useJob();
  const [res, setRes] = useState<LawResult | { error: string } | null>(null);
  const { fold, avoid } = useFolder();
  const check = (l = left, r = right) => {
    const a = parse(l), b = parse(r);
    if (!a.term || !b.term) { setRes({ error: `${!a.term ? 'Left' : 'Right'} side: ${(!a.term ? a : b).error}` }); return; }
    setRes(null);
    run({ type: 'law', left: a.term, right: b.term, fuel: 500_000 }).then((m) => { if (m.type === 'law') setRes(m.result); }).catch((e) => setRes({ error: e.message }));
  };
  useEffect(() => { check(); /* initial example */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const show = (t: Term | null) => (t ? (size(t) > 3000 ? `(${size(t)} nodes)` : printNamed(t, { fold, avoid }).text) : '—');
  return (
    <div className="tool">
      <p className="muted">Normalizes both sides and compares the normal forms, up to η. Different βη-normal forms mean the terms are really different (Böhm's theorem), even if they agree on every numeral.</p>
      <div className="tool-row">
        <ExampleMenu label="Example equations" items={LAWS} name={(l) => l.name} onPick={(l) => { setLeft(l.left); setRight(l.right); setNote(l.note); check(l.left, l.right); }} />
      </div>
      <div className="law-row">
        <input className="tool-input" value={left} onChange={(e) => { setLeft(e.target.value); setNote(undefined); }} aria-label="Left side" spellCheck={false} />
        <span className="law-eq">=</span>
        <input className="tool-input" value={right} onChange={(e) => { setRight(e.target.value); setNote(undefined); }} aria-label="Right side" spellCheck={false} />
        <button className="primary" onClick={() => check()}>Check</button>
      </div>
      <Busy busy={busy} cancel={cancel} label="Normalizing" />
      {res && ('error' in res ? <p className="err">{res.error}</p> : (
        <div className={`law-result ${res.verdict}`}>
          <b>{res.verdict === 'equal' ? '✓ Equal' : res.verdict === 'different' ? '✗ Not equal' : '? Undecided'}</b> — {res.note}
          {note && <div className="muted">{note}</div>}
          <dl className="stats">
            <dt>Left</dt><dd><code>{show(res.left)}</code></dd>
            <dt>Right</dt><dd><code>{show(res.right)}</code></dd>
          </dl>
        </div>
      ))}
    </div>
  );
}

// --- data types ----------------------------------------------------------------------------
function DataTool() {
  const [src, setSrc] = useState(DATA_EXAMPLES[0].src);
  const [enc, setEnc] = useState<Encoding>('scott');
  const actions = useActions();
  const reserved = useMemo(() => new Set(PRELUDE.map((p) => p.name)), []);
  const out = useMemo(() => {
    try {
      const decls = parseData(src);
      const g = generate(decls, enc, reserved);
      const d = decls[0];
      const demo = g.names.includes(`EXAMPLE_${d.name.toUpperCase()}`) ? `SIZE_${d.name.toUpperCase()} EXAMPLE_${d.name.toUpperCase()}` : null;
      return { ok: true as const, g, demo };
    } catch (e) { return { ok: false as const, error: (e as Error).message }; }
  }, [src, enc, reserved]);
  return (
    <div className="tool">
      <p className="muted">Write Haskell-style declarations. Constructors become λ-terms; the generated SIZE function shows how recursion works in each encoding.</p>
      <div className="tool-row">
        <ExampleMenu label="Data type examples" items={DATA_EXAMPLES} name={(x) => x.name} onPick={(x) => setSrc(x.src)} />
        <span className="seg">
          {ENCODINGS.map((e) => <button key={e.id} className={enc === e.id ? 'on' : ''} onClick={() => setEnc(e.id)} title={e.blurb}>{e.name}</button>)}
        </span>
      </div>
      <textarea className="tool-input" rows={2} value={src} onChange={(e) => setSrc(e.target.value)} spellCheck={false} aria-label="Data declaration" />
      <p className="muted">{ENCODINGS.find((e) => e.id === enc)!.blurb}</p>
      {!out.ok ? <p className="err">{out.error}</p> : (
        <>
          <pre className="tool-pre">{out.g.source}</pre>
          <div className="tool-row">
            {out.demo && <button className="primary" onClick={() => actions.use(`${out.g.source}\n${out.demo}`)} title={`Replace the source with these definitions, followed by ${out.demo}`}>Use as source</button>}
            <IconButton icon={ListPlus} text="Append to source" label="Append these definitions to the source" onClick={() => actions.append(out.g.source)} />
            <CopyButton text={out.g.source} what="the definitions" />
          </div>
        </>
      )}
    </div>
  );
}

// --- generators ----------------------------------------------------------------------------
function GenerateTool() {
  const counter = useMemo(() => new Counter(), []);
  const { fold, avoid } = useFolder();
  const actions = useActions();
  const [n, setN] = useState(24);
  const [rand, setRand] = useState<Term | null>(null);
  const job = useJob();
  const [bb, setBB] = useState<BBResult | null>(null);
  const [list, setList] = useState<{ items: EnumItem[]; total: number; normalizing: number; unknown: number; truncated: boolean } | null>(null);
  const [onlyNormal, setOnlyNormal] = useState(true);
  const [fuel, setFuel] = useState(10_000);
  const [error, setError] = useState<string | null>(null);
  const count = counter.closed(n);
  const counts = useMemo(() => Array.from({ length: 31 }, (_, k) => counter.closed(k)), [counter]);
  const show = (t: Term) => printNamed(t, { fold, avoid }).text;
  const big = count > 300_000n;

  const doEnumerate = () => {
    setError(null); setList(null); setBB(null);
    job.run({ type: 'enumerate', n, fuel, onlyNormal, limit: 400 }).then((m) => { if (m.type === 'enumerate') setList(m); }).catch((e) => setError(e.message));
  };
  const doBB = () => {
    setError(null); setList(null); setBB(null);
    job.run({ type: 'bb', n, fuel }).then((m) => { if (m.type === 'bb') setBB(m.result); }).catch((e) => setError(e.message));
  };
  return (
    <div className="tool">
      <p className="muted">Closed terms measured in binary λ-calculus bits (λ = 2, application = 2, variable i = i + 1 bits for 1-based i). The counts are sequence A114852 in the OEIS (the On-Line Encyclopedia of Integer Sequences).</p>
      <div className="tool-row">
        <label>Size <NumberField min={4} max={2000} value={n} onChange={setN} /> bits</label>
        <span><b>{count.toLocaleString('en')}</b> closed term{count === 1n ? '' : 's'}</span>
      </div>
      <details className="counts">
        <summary>Counts for sizes 0–30</summary>
        <div className="count-grid">{counts.map((c, k) => <span key={k}><i>{k}</i>{c.toString()}</span>)}</div>
      </details>
      <h3>Random term</h3>
      <div className="tool-row">
        <IconButton icon={Dices} text={`Random term of ${n} bits`} label={`Random closed term of ${n} bits`} onClick={() => setRand(randomClosedTerm(n, counter))} disabled={count === 0n} />
        <span className="muted">uniform over all {count.toLocaleString('en')}</span>
      </div>
      {rand && <Code text={show(rand)} />}
      <h3>Enumerate and BBλ</h3>
      <p className="muted">BBλ(n), the busy beaver function for λ-calculus, is the largest normal form (in bits) that any closed term of n bits reduces to. It grows faster than any computable function, so only small sizes can be settled.</p>
      <div className="tool-row">
        <label title="β-steps allowed before a term counts as undecided">Step budget <select value={fuel} onChange={(e) => setFuel(Number(e.target.value))}>{[1000, 10_000, 100_000].map((f) => <option key={f} value={f}>{f.toLocaleString('en')}</option>)}</select></label>
        <label className="check"><input type="checkbox" checked={onlyNormal} onChange={(e) => setOnlyNormal(e.target.checked)} /> only terms with a normal form</label>
      </div>
      <div className="tool-row">
        <button onClick={doEnumerate} disabled={big || !!job.busy}>List all {count.toLocaleString('en')}</button>
        <button onClick={doBB} disabled={big || !!job.busy} title="The largest normal form (in bits) reached by a closed term of this size">BBλ({n})</button>
        {big && <span className="muted">too many terms to list (limit 300,000)</span>}
      </div>
      <Busy busy={job.busy} cancel={job.cancel} label="Normalizing terms" />
      {error && <p className="err">{error}</p>}
      {bb && (
        <div className="bb">
          <p><b>BBλ({bb.n}) {bb.unknown ? '≥' : '='} {bb.best ?? '—'}</b> bits · {bb.normalizing.toLocaleString('en')} of {bb.terms.toLocaleString('en')} terms normalize{bb.unknown > 0 && <>, <b>{bb.unknown}</b> undecided within the step budget (they probably diverge, so the value is a lower bound)</>}.</p>
          {bb.champions.length > 0 && <>Champion{bb.champions.length > 1 ? 's' : ''}:
            <ul className="term-list">{bb.champions.map((c, i) => <li key={i}><TermItem text={show(c.term)} info={`→ ${c.nf} bits in ${c.betas} β`} use={actions.use} /></li>)}</ul></>}
        </div>
      )}
      {list && (
        <>
          <p className="muted">{list.normalizing.toLocaleString('en')} of {list.total.toLocaleString('en')} normalize, {list.unknown} undecided{list.truncated ? ` · showing the first ${list.items.length}` : ''}. Click a term to load it.</p>
          <ul className="term-list">
            {list.items.map((it, i) => <li key={i}><TermItem text={show(it.term)} info={it.nf === null ? 'undecided' : `normal form: ${it.nf} bits`} use={actions.use} /></li>)}
          </ul>
        </>
      )}
    </div>
  );
}

function TermItem({ text, info, use }: { text: string; info: string; use: (s: string) => void }) {
  return <button className="term-item" onClick={() => use(text)} title="Use as source"><code>{text}</code><span className="muted">{info}</span></button>;
}
