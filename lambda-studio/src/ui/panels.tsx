import { useEffect, useMemo, useState } from 'react';
import { useStore, currentTerm, useNextRedex } from './store';
import { useShallow } from 'zustand/react/shallow';
import { inferType, typeTex } from '../core/types';
import { printNamed, type Printed } from '../core/formats/named';
import { makeFolder } from '../core/fold';
import { STRATEGIES } from '../core/reduce';
import { termStats } from '../core/stats';
import { size, type Term, type Path } from '../core/term';
import { preludeInfo } from '../core/program';
import { PRELUDE } from '../core/prelude';
import { insertIntoSource } from './Toast';
import { describeMore } from '../core/data';
import { TermText, reduceInnermost } from './TermText';
import { printLatex } from '../core/formats/latex';
import { TexView, ViewToggle } from './Tex';
import { EditBar } from './EditBar';
import { startDefDrag } from './dnd';
import { NoTerm, FallbackNotice } from './NoTerm';
import { SkipBack, StepBack, StepForward, Play, Pause, FastForward, Zap, Square, ChevronDown, ChevronRight, Tag } from 'lucide-react';
import { IconButton } from './IconButton';

/** Whether a view shows typeset TeX (per view id, kept in the settings). */
export function useTexSetting(id: string): [boolean, (v: boolean) => void] {
  const tex = useStore((s) => s.settings.tex[id] ?? false);
  return [tex, (v: boolean) => { const st = useStore.getState(); st.setSetting('tex', { ...st.settings.tex, [id]: v }); }];
}

/** Above this many nodes, terms are summarised instead of printed in full. */
export const BIG = 25000;

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
  const next = useNextRedex();
  const redex = settings.showRedex ? next : null;
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
          <IconButton icon={Tag} label="Show names and numerals for known parts" pressed={settings.foldNames} className="toggle" onClick={() => useStore.getState().setSetting('foldNames', !settings.foldNames)} />
          <ViewToggle tex={asTex} onChange={setAsTex} />
        </span>
      </div>
      <FallbackNotice />
      {!term && <NoTerm starters />}
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
const SPEEDS = [1, 2, 4, 8, 16, 30];
/** The speed choices, with a saved value that is not one of them kept in its place. */
const speeds = (cur: number) => (SPEEDS.includes(cur) ? SPEEDS : [...SPEEDS, cur].sort((a, b) => a - b));

export function Controls() {
  // only what the controls show: hover and selection changes do not re-render them
  const s = useStore(useShallow((st) => ({
    index: st.index, historyLength: st.history.length, running: st.running, playing: st.playing, message: st.message,
    playSpeed: st.settings.playSpeed, goto: st.goto, stepBack: st.stepBack, stepForward: st.stepForward, setPlaying: st.setPlaying,
    runToNormal: st.runToNormal, normalizeFast: st.normalizeFast, stop: st.stop, setSetting: st.setSetting,
  })));
  const term = useStore(currentTerm);
  const atEnd = s.index >= s.historyLength - 1;
  const hasNext = useNextRedex() !== null;

  useEffect(() => {
    if (!s.playing) return;
    const id = window.setInterval(() => { if (!useStore.getState().stepForward()) useStore.getState().setPlaying(false); }, 1000 / s.playSpeed);
    return () => window.clearInterval(id);
  }, [s.playing, s.playSpeed]);

  return (
    <div className="controls">
      <div className="buttons">
        <IconButton icon={SkipBack} text="Start" label="Back to the start" onClick={() => s.goto(0)} disabled={s.index === 0 || !!s.running} />
        <IconButton icon={StepBack} text="Back" label="Step back" shortcut="Alt+←" onClick={s.stepBack} disabled={s.index === 0 || !!s.running} />
        <IconButton icon={StepForward} className="primary" text="Step" label="One reduction step" shortcut="Alt+→" onClick={() => s.stepForward()} disabled={!term || (atEnd && !hasNext) || !!s.running} />
        <IconButton icon={s.playing ? Pause : Play} text={s.playing ? 'Pause' : 'Play'} label={s.playing ? 'Pause' : 'Play steps automatically'} pressed={s.playing} onClick={() => s.setPlaying(!s.playing)} disabled={!term || !!s.running || (atEnd && !hasNext)} />
        <IconButton icon={FastForward} text="Run" label="Reduce to normal form, recording the steps" shortcut="Ctrl+Enter" onClick={s.runToNormal} disabled={!term || !!s.running || !hasNext} />
        <IconButton icon={Zap} text="Normalize" label="Fast normalizer (result only, no step history)" onClick={s.normalizeFast} disabled={!term || !!s.running || !hasNext} />
        {s.running && <IconButton icon={Square} className="danger" text="Stop" label="Stop the evaluation" onClick={s.stop} />}
        <label className="speed" title="Play speed">Speed
          <select value={s.playSpeed} onChange={(e) => s.setSetting('playSpeed', Number(e.target.value))} aria-label="Play speed, steps per second">
            {speeds(s.playSpeed).map((v) => <option key={v} value={v}>{v} / s</option>)}
          </select>
        </label>
      </div>
      <div className="timeline">
        <div className="tl-track" style={{ '--steps': Math.max(1, s.historyLength - 1) } as React.CSSProperties} data-marks={s.historyLength > 1 && s.historyLength <= 80 ? '' : undefined}>
          <input type="range" min={0} max={Math.max(0, s.historyLength - 1)} value={s.index} onChange={(e) => s.goto(Number(e.target.value))} disabled={s.historyLength < 2 || !!s.running} aria-label="Reduction timeline" aria-valuetext={`step ${s.index} of ${Math.max(0, s.historyLength - 1)}`} />
        </div>
        <span className="tl-label">step {s.index} / {Math.max(0, s.historyLength - 1)}</span>
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
const PRELUDE_SRC = new Map(PRELUDE.map((e) => [e.name, e.src]));
const short = (s: string) => (s.length > 160 ? s.slice(0, 160) + '…' : s);

export function Library() {
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
      <p className="hint">Click a name to insert it, or drag it onto the diagram. Define your own with <code>NAME = term</code>.</p>
      {program.defs.length > 0 && (
        <div className="lib-group">
          <div className="lib-title">Your definitions</div>
          {program.defs.map((d) => (
            <button key={d.name} className={`lib-item${d.error ? ' err' : ''}`} draggable onDragStart={(e) => startDefDrag(e, d.name)} onClick={() => insertIntoSource(d.name, d.name)} title={d.error ?? (d.term ? short(printNamed(d.term).text) : '')}>
              <span className="lib-name">{d.name}</span>{d.recursive && <span className="tag">rec</span>}{d.error && <span className="tag err">error</span>}
            </button>
          ))}
        </div>
      )}
      {groups.map(([g, items]) => (
        <div className="lib-group" key={g}>
          <button className="lib-title" aria-expanded={!!open[g]} onClick={() => setOpen((o) => ({ ...o, [g]: !o[g] }))}>{open[g] ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />} {g}</button>
          {open[g] && items.map((d) => (
            <button key={d.name} className="lib-item" draggable onDragStart={(e) => startDefDrag(e, d.name)} onClick={() => insertIntoSource(d.name, d.name)} title={`${d.doc}\n\n${d.name} = ${PRELUDE_SRC.get(d.name) ?? ''}`}>
              <span className="lib-name">{d.name}</span><span className="lib-doc">{d.doc}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
