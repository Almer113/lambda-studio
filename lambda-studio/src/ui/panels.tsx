import { useEffect, useMemo, useState } from 'react';
import { useStore, currentTerm, shareLink } from './store';
import { useExport } from './ExportDialog';
import { inferType, typeTex } from '../core/types';
import { printNamed, type Printed } from '../core/formats/named';
import { makeFolder } from '../core/fold';
import { findRedex, STRATEGIES, type Strategy } from '../core/reduce';
import { termStats } from '../core/stats';
import { size, type Term, type Path } from '../core/term';
import { FORMATS, preludeInfo, type FormatId } from '../core/program';
import { EXAMPLES } from '../core/prelude';
import { describeMore } from '../core/data';
import { TermText, reduceInnermost } from './TermText';
import { printLatex } from '../core/formats/latex';
import { TexView, ViewToggle } from './Tex';
import { EditBar } from './EditBar';
import { startDefDrag } from './dnd';
import { useTutorial } from './Tutorial';
import { useHelp } from './Help';
import { NoTerm } from './NoTerm';

function useTexSetting(id: string): [boolean, (v: boolean) => void] {
  const tex = useStore((s) => s.settings.tex[id] ?? false);
  return [tex, (v: boolean) => { const st = useStore.getState(); st.setSetting('tex', { ...st.settings.tex, [id]: v }); }];
}

const BIG = 25000;

/** A name or a number: the only things that may be folded at a place where the user typed them. */
const ONE_TOKEN = /^(?:[\p{L}_][\p{L}\p{N}_'₀-₉]*|[0-9]+)$/u;

/**
 * The display folder (names and numerals for closed subterms). Pass the term being shown when it
 * may be the one the user typed: there, a part is folded only if the user wrote it as a single
 * name or number, so `λt f.t` stays as typed instead of turning into TRUE.
 */
export function useFolder(shown?: Term | null) {
  const program = useStore((s) => s.program);
  const settings = useStore((s) => s.settings);
  const source = useStore((s) => s.source);
  const typed = !!shown && shown === program.term;
  return useMemo(() => {
    const avoid = program.foldTable.names;
    if (!settings.foldNames) return { fold: undefined, avoid };
    const base = makeFolder(program.foldTable, { numerals: settings.numerals, zeroAs: settings.zeroAs });
    if (!typed) return { fold: base, avoid };
    const fold = (t: Term, path: Path) => {
      const sp = program.spans.get(path);
      if (sp && !ONE_TOKEN.test(source.slice(sp.from, sp.to).trim())) return null;
      return base(t);
    };
    return { fold, avoid };
  }, [program, settings.foldNames, settings.numerals, settings.zeroAs, typed, source]);
}

// --- Current term ------------------------------------------------------------
export function CurrentTerm() {
  const term = useStore(currentTerm);
  const settings = useStore((s) => s.settings);
  const index = useStore((s) => s.index);
  const history = useStore((s) => s.history);
  const { fold, avoid } = useFolder(term);
  const printed = useMemo<Printed | null>(() => (term && size(term) < BIG * 4 ? printNamed(term, { fold, avoid }) : null), [term, fold, avoid]);
  const redex = useMemo(() => (term && settings.showRedex ? findRedex(term, settings) : null), [term, settings]);
  const via = history[index]?.via;
  const [asTex, setAsTex] = useTexSetting('current');
  const hover = useStore((s) => s.hover);
  const setHover = useStore((s) => s.setHover);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
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
      {!term && <NoTerm />}
      {term && printed && tex !== null && (
        <TexView tex={tex} className="term-tex" hover={hover} redex={redex} onHover={(p) => setHover(p, 'text')} onDoubleClick={reduceInnermost} selected={selected} onSelect={select} />
      )}
      {term && printed && tex === null && <TermText printed={printed} redex={redex} />}
      {term && !printed && <div className="empty">Term too large to print ({size(term)} nodes).</div>}
      {via?.note && <div className="note">{via.note}</div>}
      <EditBar />
      {/* always one line, so selecting does not move the panels below (double-clicks land there) */}
      {term && <p className="hint">{selected === null ? 'Click part of the term or a line of the diagram to select it and edit.' : 'Selected: the editing toolbar is at the bottom of the window (Esc clears).'}</p>}
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
        <button onClick={() => s.goto(0)} disabled={s.index === 0 || !!s.running} title="Back to the start" aria-label="Back to the start">⏮</button>
        <button onClick={s.stepBack} disabled={s.index === 0 || !!s.running} title="Step back (Alt+←)">◀ Back</button>
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
        <input type="range" min={0} max={Math.max(0, s.history.length - 1)} value={s.index} onChange={(e) => s.goto(Number(e.target.value))} disabled={s.history.length < 2 || !!s.running} aria-label="Reduction timeline" />
        <span className="tl-label">step {s.index} / {Math.max(0, s.history.length - 1)}</span>
      </div>
      {s.running && <div className="status running">{s.running.kind === 'run' ? `Reducing… ${s.running.steps} steps, ${s.running.size} nodes` : 'Normalizing…'}</div>}
      {!s.running && s.message && (
        <div className={`status ${s.message.tone}`} role={s.message.tone === 'error' ? 'alert' : undefined}>
          {s.message.text}
          {s.message.action && <> <button type="button" className="linklike" onClick={s.message.action.run}>{s.message.action.label}</button></>}
        </div>
      )}
    </div>
  );
}

// --- Inspector ---------------------------------------------------------------
export function Inspector() {
  const term = useStore(currentTerm);
  const eta = useStore((s) => s.settings.eta);
  const strategy = useStore((s) => s.settings.strategy);
  const stats = useMemo(() => (term && size(term) < 200000 ? termStats(term, eta) : null), [term, eta]);
  const typed = useMemo(() => (term && size(term) < 20000 ? inferType(term) : null), [term]);
  if (!term || !stats) return <div className="panel inspector"><div className="panel-head"><h2>Inspector</h2></div>{term ? <div className="empty">—</div> : <NoTerm text="—" brief />}</div>;
  const strat = STRATEGIES.find((s) => s.id === strategy)!;
  const values = [...stats.decoded.map((d) => d.text), ...(stats.normal && stats.closed ? describeMore(term) : [])];
  return (
    <div className="panel inspector">
      <div className="panel-head"><h2>Inspector</h2></div>
      <dl className="stats">
        <dt>Status</dt><dd>{stats.normal ? <b className="ok">normal form</b> : `${stats.redexes} redex${stats.redexes === 1 ? '' : 'es'}`}</dd>
        {values.length > 0 && (<><dt>Value</dt><dd>{values.join(' · ')}</dd></>)}
        <dt>Size</dt><dd>{stats.nodes} nodes · {stats.lams} λ · {stats.apps} app · {stats.vars} var</dd>
        <dt>Depth</dt><dd>{stats.depth}</dd>
        <dt>BLC</dt><dd>{stats.blcBits === null ? '— (free names)' : `${stats.blcBits} bits`}</dd>
        <dt>Closed</dt><dd>{stats.closed ? 'yes (combinator)' : `no${stats.freeNames.length ? ` · free: ${stats.freeNames.join(', ')}` : ''}${stats.danglingIndices ? ` · ${stats.danglingIndices} open index` : ''}`}</dd>
        <dt>Type</dt><dd>{!typed ? '— (term too large)' : typed.ok ? <TypeView text={typed.value.text} tex={typeTex(typed.value.type)} prop={typed.value.prop} /> : <span className="muted" title={typed.reason}>not simply typable</span>}</dd>
        <dt>Strategy</dt><dd title={strat.description}>{strat.name}</dd>
      </dl>
      <p className="hint">{strat.description}</p>
    </div>
  );
}

function TypeView({ text, tex, prop }: { text: string; tex: string; prop: string }) {
  const [asTex] = useTexSetting('current');
  return (
    <span className="type-view">
      {asTex && text.length < 400 ? <TexView tex={tex} /> : <code>{text}</code>}
      <span className="muted" title="Curry–Howard: a type read as a proposition of implicational logic. Every simply typed closed term proves its type."> · as a proposition: {prop}</span>
    </span>
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
            <button key={d.name} className={`lib-item${d.error ? ' err' : ''}`} draggable onDragStart={(e) => startDefDrag(e, d.name)} onClick={() => insert?.(d.name + ' ')} title={d.error ?? (d.term ? printNamed(d.term).text : '')}>
              <span className="lib-name">{d.name}</span>{d.recursive && <span className="tag">rec</span>}{d.error && <span className="tag err">error</span>}
            </button>
          ))}
        </div>
      )}
      {groups.map(([g, items]) => (
        <div className="lib-group" key={g}>
          <button className="lib-title" onClick={() => setOpen((o) => ({ ...o, [g]: !o[g] }))}>{open[g] ? '▾' : '▸'} {g}</button>
          {open[g] && items.map((d) => (
            <button key={d.name} className="lib-item" draggable onDragStart={(e) => startDefDrag(e, d.name)} onClick={() => insert?.(d.name + ' ')} title={`${d.doc}\n\n${d.term ? printNamed(d.term).text : ''}`}>
              <span className="lib-name">{d.name}</span><span className="lib-doc">{d.doc}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// --- Header ------------------------------------------------------------------
/**
 * Copy a share link. The page URL is left alone (a link written into the address bar would bring
 * this snapshot back over later work on reload). Without clipboard access (e.g. plain http) the
 * link is shown for copying by hand.
 */
async function copyShareLink(source: string, format: FormatId | 'auto', copied: () => void) {
  let url: string;
  try { url = await shareLink(source, format); }
  catch { useStore.setState({ message: { text: 'Could not create a share link in this browser.', tone: 'error' } }); return; }
  try {
    if (!navigator.clipboard) throw new Error('no clipboard');
    await navigator.clipboard.writeText(url);
    copied();
    return;
  } catch { /* no clipboard access: show the link instead */ }
  try { window.prompt('Copy this link:', url); }
  catch { useStore.setState({ message: { text: `Copy this link: ${url}`, tone: 'info' } }); } // embedded pages may not allow prompt()
}

export function Header() {
  const s = useStore();
  const [shared, setShared] = useState(false);
  return (
    <header className="header">
      <div className="brand"><span className="logo">λ</span> Lambda Studio</div>
      <div className="header-controls">
        <select aria-label="Examples" value="" onChange={(e) => { const ex = EXAMPLES[Number(e.target.value)]; if (ex) s.setSource(ex.src, 'auto'); }}>
          <option value="">Examples…</option>
          {EXAMPLES.map((ex, i) => <option key={ex.name} value={i}>{ex.name}</option>)}
        </select>
        <label>Input
          <select value={s.format} onChange={(e) => s.setFormat(e.target.value as FormatId | 'auto')}>
            <option value="auto">Auto-detect{s.format === 'auto' ? ` (${FORMATS.find((f) => f.id === s.program.format)?.name})` : ''}</option>
            {(['λ', 'Combinators', 'Code', 'Bits & data'] as const).map((g) => (
              <optgroup key={g} label={g}>
                {FORMATS.filter((f) => f.group === g).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label>Strategy
          <select value={s.settings.strategy} onChange={(e) => s.setSetting('strategy', e.target.value as Strategy)}>
            {STRATEGIES.map((st) => <option key={st.id} value={st.id} title={st.description}>{st.name}</option>)}
          </select>
        </label>
        <label className="check" title="Also contract η-redexes λx.M x → M"><input type="checkbox" checked={s.settings.eta} onChange={(e) => s.setSetting('eta', e.target.checked)} /> η</label>
        <label className="check" title="Read λxy.xy as λx.λy.x y"><input type="checkbox" checked={s.settings.singleLetter} onChange={(e) => s.setSetting('singleLetter', e.target.checked)} /> Single-letter vars</label>
        <button onClick={() => copyShareLink(s.source, s.format, () => { setShared(true); setTimeout(() => setShared(false), 1500); })} title="Copy a link that opens this source (compressed into the URL)">{shared ? 'Link copied' : 'Share link'}</button>
        <button onClick={() => useExport.getState().show()}>Export…</button>
        <button onClick={() => useTutorial.getState().set({ open: !useTutorial.getState().open })} aria-pressed={useTutorial((t) => t.open)}>Tutorial</button>
        <button onClick={() => useHelp.getState().set(true)} aria-label="Help and keyboard shortcuts" title="Help and keyboard shortcuts (?)">?</button>
        <select aria-label="Theme" value={s.settings.theme} onChange={(e) => s.setSetting('theme', e.target.value as 'system' | 'light' | 'dark')}>
          <option value="system">System theme</option><option value="light">Light</option><option value="dark">Dark</option>
        </select>
      </div>
    </header>
  );
}
