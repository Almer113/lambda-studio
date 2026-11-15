import { useEffect, useMemo, useState } from 'react';
import { useStore, currentTerm, shareLink } from './store';
import { printNamed, type Printed } from '../core/formats/named';
import { printDeBruijn } from '../core/formats/debruijn';
import { encodeBLC, bitsToHex } from '../core/formats/blc';
import { printJSON } from '../core/formats/json';
import { layout } from '../core/diagram/layout';
import { toBoxChars } from '../core/diagram/ascii';
import { makeFolder } from '../core/fold';
import { findRedex, STRATEGIES, type Strategy } from '../core/reduce';
import { termStats } from '../core/stats';
import { type Term, size } from '../core/term';
import { FORMATS, preludeInfo, type FormatId } from '../core/program';
import { EXAMPLES } from '../core/prelude';
import { TermText, reduceInnermost } from './TermText';
import { printLatex, type TexStyle } from '../core/formats/latex';
import { TexView, ViewToggle } from './Tex';

function useTexSetting(id: string): [boolean, (v: boolean) => void] {
  const tex = useStore((s) => s.settings.tex[id] ?? false);
  return [tex, (v: boolean) => { const st = useStore.getState(); st.setSetting('tex', { ...st.settings.tex, [id]: v }); }];
}

const BIG = 25000;

export function useFolder() {
  const program = useStore((s) => s.program);
  const settings = useStore((s) => s.settings);
  return useMemo(() => ({
    fold: settings.foldNames ? makeFolder(program.foldTable, { numerals: settings.numerals, zeroAs: settings.zeroAs }) : undefined,
    avoid: program.foldTable.names,
  }), [program, settings.foldNames, settings.numerals, settings.zeroAs]);
}

// --- Current term ------------------------------------------------------------
export function CurrentTerm() {
  const term = useStore(currentTerm);
  const settings = useStore((s) => s.settings);
  const index = useStore((s) => s.index);
  const history = useStore((s) => s.history);
  const { fold, avoid } = useFolder();
  const printed = useMemo<Printed | null>(() => (term && size(term) < BIG * 4 ? printNamed(term, { fold, avoid }) : null), [term, fold, avoid]);
  const redex = useMemo(() => (term && settings.showRedex ? findRedex(term, settings) : null), [term, settings]);
  const via = history[index]?.via;
  const [asTex, setAsTex] = useTexSetting('current');
  const hover = useStore((s) => s.hover);
  const setHover = useStore((s) => s.setHover);
  const tex = useMemo(() => (asTex && term && printed ? printLatex(term, { fold, avoid, tags: true }) : null), [asTex, term, printed, fold, avoid]);
  return (
    <div className="panel current">
      <div className="panel-head">
        <h2>Current term {index > 0 && <span className="sub">step {index}{via?.kind ? ` · ${via.kind === 'nbe' ? 'fast normalizer' : via.kind === 'run' ? 'run' : via.kind + '-reduction'}` : ''}</span>}</h2>
        <span className="head-tools">
          <label className="check"><input type="checkbox" checked={settings.foldNames} onChange={(e) => useStore.getState().setSetting('foldNames', e.target.checked)} /> Show names &amp; numerals</label>
          <ViewToggle tex={asTex} onChange={setAsTex} />
        </span>
      </div>
      {!term && <div className="empty">Nothing to show yet.</div>}
      {term && printed && tex !== null && (
        <TexView tex={tex} className="term-tex" hover={hover} redex={redex} onHover={(p) => setHover(p, 'text')} onDoubleClick={reduceInnermost} />
      )}
      {term && printed && tex === null && <TermText printed={printed} redex={redex} />}
      {term && !printed && <div className="empty">Term too large to print ({size(term)} nodes).</div>}
      {via?.note && <div className="note">{via.note}</div>}
    </div>
  );
}

// --- Controls ----------------------------------------------------------------
export function Controls() {
  const s = useStore();
  const term = currentTerm(s);
  const atEnd = s.index >= s.history.length - 1;
  const hasNext = useMemo(() => (term ? findRedex(term, s.settings) !== null : false), [term, s.settings]);

  useEffect(() => {
    if (!s.playing) return;
    const id = window.setInterval(() => { if (!useStore.getState().stepForward()) useStore.getState().setPlaying(false); }, 1000 / s.settings.playSpeed);
    return () => window.clearInterval(id);
  }, [s.playing, s.settings.playSpeed]);

  return (
    <div className="controls">
      <div className="buttons">
        <button onClick={() => s.goto(0)} disabled={s.index === 0} title="Back to the start">⏮</button>
        <button onClick={s.stepBack} disabled={s.index === 0} title="Step back (Alt+←)">◀ Back</button>
        <button className="primary" onClick={() => s.stepForward()} disabled={!term || (atEnd && !hasNext) || !!s.running} title="One reduction step (Alt+→)">Step ▶</button>
        <button onClick={() => s.setPlaying(!s.playing)} disabled={!term || !!s.running || (atEnd && !hasNext)} title="Play steps automatically">{s.playing ? '⏸ Pause' : '⏵ Play'}</button>
        <button onClick={s.runToNormal} disabled={!term || !!s.running || !hasNext} title="Reduce to normal form, recording steps (Ctrl+Enter)">Run ⏭</button>
        <button onClick={s.normalizeFast} disabled={!term || !!s.running || !hasNext} title="Fast normalizer (no step history)">⚡ Normalize</button>
        {s.running && <button className="danger" onClick={s.stop}>■ Stop</button>}
        <label className="speed" title="Play speed">
          <input type="range" min={1} max={30} value={s.settings.playSpeed} onChange={(e) => s.setSetting('playSpeed', Number(e.target.value))} />
          {s.settings.playSpeed}/s
        </label>
      </div>
      <div className="timeline">
        <input type="range" min={0} max={Math.max(0, s.history.length - 1)} value={s.index} onChange={(e) => s.goto(Number(e.target.value))} disabled={s.history.length < 2} aria-label="Reduction timeline" />
        <span className="tl-label">step {s.index} / {Math.max(0, s.history.length - 1)}</span>
      </div>
      {s.running && <div className="status running">{s.running.kind === 'run' ? `Reducing… ${s.running.steps} steps, ${s.running.size} nodes` : 'Normalizing…'}</div>}
      {!s.running && s.message && <div className={`status ${s.message.tone}`}>{s.message.text}</div>}
    </div>
  );
}

// --- Conversions -------------------------------------------------------------
export function Conversions() {
  const term = useStore(currentTerm);
  const { fold, avoid } = useFolder();
  const [force, setForce] = useState(false);
  useEffect(() => setForce(false), [term]);
  const rows = useMemo(() => {
    if (!term) return [];
    if (size(term) > BIG && !force) return null;
    return conversions(term, fold, avoid);
  }, [term, fold, avoid, force]);
  return (
    <div className="panel conversions">
      <div className="panel-head"><h2>Notations</h2></div>
      {!term && <div className="empty">—</div>}
      {rows === null && <button onClick={() => setForce(true)}>Term is large ({size(term!)} nodes) — compute notations</button>}
      {rows?.map((r) => <OutputRow key={r.id} row={r} />)}
    </div>
  );
}

interface Row { id: string; label: string; text: string; note?: string; mono?: boolean; tex?: () => { tagged: string; plain: string } }

function conversions(term: Term, fold: ReturnType<typeof useFolder>['fold'], avoid: ReadonlySet<string>): Row[] {
  const out: Row[] = [];
  const texOf = (style: TexStyle, folded: boolean) => () => ({
    tagged: printLatex(term, { style, tags: true, ...(folded ? { fold, avoid } : {}) }),
    plain: printLatex(term, { style, ...(folded ? { fold, avoid } : {}) }),
  });
  out.push({ id: 'named', label: 'Named (with names)', text: printNamed(term, { fold, avoid }).text, tex: texOf('named', true) });
  out.push({ id: 'expanded', label: 'Named (expanded)', text: printNamed(term).text, tex: texOf('named', false) });
  out.push({ id: 'ascii', label: 'Named (ASCII \\)', text: printNamed(term, { lambda: '\\' }).text });
  out.push({ id: 'debruijn0', label: 'De Bruijn (0-based)', text: printDeBruijn(term, 0).text, tex: texOf('debruijn0', false) });
  out.push({ id: 'debruijn1', label: 'De Bruijn (1-based, Tromp)', text: printDeBruijn(term, 1).text, tex: texOf('debruijn1', false) });
  out.push({ id: 'latex', label: 'LaTeX source', text: printLatex(term, { fold, avoid }), note: '⌜n⌝ needs amssymb' });
  try {
    const bits = encodeBLC(term);
    out.push({ id: 'blc', label: 'Binary λ-calculus', text: bits, note: `${bits.length} bits · hex ${bitsToHex(bits)}` });
  } catch (e) { out.push({ id: 'blc', label: 'Binary λ-calculus', text: '', note: (e as Error).message }); }
  if (size(term) < 3000) out.push({ id: 'box', label: 'Diagram (box characters)', text: toBoxChars(layout(term)), mono: true });
  out.push({ id: 'json', label: 'JSON AST', text: printJSON(term) });
  return out;
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
  const { id, label, text, note, mono } = row;
  const [asTex, setAsTex] = useTexSetting(id);
  const hover = useStore((s) => s.hover);
  const setHover = useStore((s) => s.setHover);
  const tex = useMemo(() => (asTex && row.tex && text ? row.tex() : null), [asTex, row, text]);
  return (
    <div className="out-row">
      <div className="out-head">
        <span className="out-label">{label}</span>
        {note && <span className="out-note">{note}</span>}
        <span className="out-tools">
          {row.tex && text && <ViewToggle tex={asTex} onChange={setAsTex} />}
          {text && <CopyButton text={text} />}
          {tex && <CopyButton text={tex.plain} label="LaTeX" />}
        </span>
      </div>
      {tex && <TexView tex={tex.tagged} className="out-tex" hover={hover} onHover={(p) => setHover(p, 'text')} onDoubleClick={reduceInnermost} />}
      {text && !tex && <pre className={mono ? 'out-text box' : 'out-text'}>{text}</pre>}
    </div>
  );
}

// --- Inspector ---------------------------------------------------------------
export function Inspector() {
  const term = useStore(currentTerm);
  const eta = useStore((s) => s.settings.eta);
  const strategy = useStore((s) => s.settings.strategy);
  const stats = useMemo(() => (term && size(term) < 200000 ? termStats(term, eta) : null), [term, eta]);
  if (!term || !stats) return <div className="panel inspector"><div className="panel-head"><h2>Inspector</h2></div><div className="empty">—</div></div>;
  const strat = STRATEGIES.find((s) => s.id === strategy)!;
  return (
    <div className="panel inspector">
      <div className="panel-head"><h2>Inspector</h2></div>
      <dl className="stats">
        <dt>Status</dt><dd>{stats.normal ? <b className="ok">normal form</b> : `${stats.redexes} redex${stats.redexes === 1 ? '' : 'es'}`}</dd>
        {stats.decoded.length > 0 && (<><dt>Value</dt><dd>{stats.decoded.map((d) => d.text).join(' · ')}</dd></>)}
        <dt>Size</dt><dd>{stats.nodes} nodes · {stats.lams} λ · {stats.apps} app · {stats.vars} var</dd>
        <dt>Depth</dt><dd>{stats.depth}</dd>
        <dt>BLC</dt><dd>{stats.blcBits === null ? '— (free names)' : `${stats.blcBits} bits`}</dd>
        <dt>Closed</dt><dd>{stats.closed ? 'yes (combinator)' : `no${stats.freeNames.length ? ` · free: ${stats.freeNames.join(', ')}` : ''}${stats.danglingIndices ? ` · ${stats.danglingIndices} open index` : ''}`}</dd>
        <dt>Strategy</dt><dd title={strat.description}>{strat.name}</dd>
      </dl>
      <p className="hint">{strat.description}</p>
    </div>
  );
}

// --- Library -----------------------------------------------------------------
export function Library() {
  const insert = useStore((s) => s.insertText);
  const program = useStore((s) => s.program);
  const info = useMemo(() => preludeInfo(), []);
  const groups = useMemo(() => {
    const m = new Map<string, typeof info>();
    for (const d of info) { const g = d.group ?? 'Other'; if (!m.has(g)) m.set(g, []); m.get(g)!.push(d); }
    return [...m];
  }, [info]);
  const [open, setOpen] = useState<Record<string, boolean>>({ Combinators: true, Booleans: true, Numerals: true });
  return (
    <div className="panel library">
      <div className="panel-head"><h2>Library</h2></div>
      <p className="hint">Click a name to insert it. Define your own with <code>NAME = term</code>.</p>
      {program.defs.length > 0 && (
        <div className="lib-group">
          <div className="lib-title">Your definitions</div>
          {program.defs.map((d) => (
            <button key={d.name} className={`lib-item${d.error ? ' err' : ''}`} onClick={() => insert?.(d.name + ' ')} title={d.error ?? (d.term ? printNamed(d.term).text : '')}>
              <span className="lib-name">{d.name}</span>{d.recursive && <span className="tag">rec</span>}{d.error && <span className="tag err">error</span>}
            </button>
          ))}
        </div>
      )}
      {groups.map(([g, items]) => (
        <div className="lib-group" key={g}>
          <button className="lib-title" onClick={() => setOpen((o) => ({ ...o, [g]: !o[g] }))}>{open[g] ? '▾' : '▸'} {g}</button>
          {open[g] && items.map((d) => (
            <button key={d.name} className="lib-item" onClick={() => insert?.(d.name + ' ')} title={`${d.doc}\n\n${d.term ? printNamed(d.term).text : ''}`}>
              <span className="lib-name">{d.name}</span><span className="lib-doc">{d.doc}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// --- Header ------------------------------------------------------------------
export function Header() {
  const s = useStore();
  const [shared, setShared] = useState(false);
  return (
    <header className="header">
      <div className="brand"><span className="logo">λ</span> Lambda Studio</div>
      <div className="header-controls">
        <select aria-label="Examples" value="" onChange={(e) => { const ex = EXAMPLES[Number(e.target.value)]; if (ex) s.setSource(ex.src); }}>
          <option value="">Examples…</option>
          {EXAMPLES.map((ex, i) => <option key={ex.name} value={i}>{ex.name}</option>)}
        </select>
        <label>Input
          <select value={s.format} onChange={(e) => s.setFormat(e.target.value as FormatId | 'auto')}>
            <option value="auto">Auto-detect{s.format === 'auto' ? ` (${FORMATS.find((f) => f.id === s.program.format)?.name})` : ''}</option>
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label>Strategy
          <select value={s.settings.strategy} onChange={(e) => s.setSetting('strategy', e.target.value as Strategy)}>
            {STRATEGIES.map((st) => <option key={st.id} value={st.id} title={st.description}>{st.name}</option>)}
          </select>
        </label>
        <label className="check" title="Also contract η-redexes λx.M x → M"><input type="checkbox" checked={s.settings.eta} onChange={(e) => s.setSetting('eta', e.target.checked)} /> η</label>
        <label className="check" title="Read λxy.xy as λx.λy.x y"><input type="checkbox" checked={s.settings.singleLetter} onChange={(e) => s.setSetting('singleLetter', e.target.checked)} /> Single-letter vars</label>
        <button onClick={() => { navigator.clipboard?.writeText(shareLink(s.source)).then(() => { setShared(true); setTimeout(() => setShared(false), 1500); }).catch(() => {}); }}>{shared ? 'Link copied' : 'Share link'}</button>
        <select aria-label="Theme" value={s.settings.theme} onChange={(e) => s.setSetting('theme', e.target.value as 'system' | 'light' | 'dark')}>
          <option value="system">System theme</option><option value="light">Light</option><option value="dark">Dark</option>
        </select>
      </div>
    </header>
  );
}
