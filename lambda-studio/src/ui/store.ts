import { create } from 'zustand';
import { type Term, type Path } from '../core/term';
import { parseProgram, detectFormat, FORMATS, type FormatId, type Program } from '../core/program';
import { findRedex, stepAt, redexKindAt, STRATEGIES, type Strategy, type RedexKind } from '../core/reduce';
import { COLOR_MODES } from '../core/diagram/colors';
import { ALGORITHMS } from '../core/combinators';
import type { WorkerRequest, WorkerResponse } from '../worker/eval.worker';
import EvalWorker from '../worker/eval.worker?worker&inline';
import type { Algorithm } from '../core/combinators';
import { applyEdit, rewriteSource, sourceFolder, ACTIONS, type EditAction } from '../core/edit';
import { printNamed } from '../core/formats/named';
import { makeFolder } from '../core/fold';
import { getAt } from '../core/term';
import { packDeep, unpackDeep } from '../core/pack';

import type { ColorMode } from '../core/diagram/colors';
import type { DiagramStyle } from '../core/diagram/layout';
export type { ColorMode };
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  strategy: Strategy;
  eta: boolean;
  singleLetter: boolean;
  foldNames: boolean;
  numerals: boolean;
  zeroAs: '0' | 'FALSE';
  colorMode: ColorMode;
  diagramStyle: DiagramStyle;
  /** Animate single β-steps in the diagram. */
  animate: boolean;
  showRedex: boolean;
  autoLambda: boolean;
  theme: Theme;
  maxSteps: number;
  maxSize: number;
  playSpeed: number; // steps per second
  /** Typeset (KaTeX) instead of plain text, per view id ('current', 'named', 'debruijn0', …). */
  tex: Record<string, boolean>;
  /** Show a typeset preview of the source under the editor. */
  sourcePreview: boolean;
  /** Bracket-abstraction algorithm for the combinator notations. */
  clAlgorithm: Algorithm;
  /** Which notation groups are expanded. */
  openGroups: Record<string, boolean>;
  /** Open tab of the Tools panel. */
  toolsTab: ToolsTab;
  /** Use the WYSIWYG math editor for expressions. */
  mathEditor: boolean;
  /** Which of Notations / Tools the right-hand panel shows. */
  sideTab: SideTab;
}
export type SideTab = 'notations' | 'tools';
export type ToolsTab = 'expr' | 'truth' | 'table' | 'laws' | 'data' | 'generate';

export const DEFAULT_SETTINGS: Settings = {
  strategy: 'normal', eta: false, singleLetter: false, foldNames: true, numerals: true, zeroAs: '0',
  colorMode: 'binder', diagramStyle: 'standard', animate: true, showRedex: true, autoLambda: true, theme: 'system',
  maxSteps: 10000, maxSize: 200000, playSpeed: 4,
  tex: { current: true, named: true, expanded: true, debruijn0: true, debruijn1: true },
  sourcePreview: true,
  clAlgorithm: 'turner',
  // combinators and code are costly for big terms: closed until asked for
  openGroups: { lambda: true, combinators: false, code: false, bits: true },
  toolsTab: 'expr',
  mathEditor: false,
  sideTab: 'notations',
};

const ENUMS: Partial<Record<keyof Settings, readonly string[]>> = {
  strategy: STRATEGIES.map((x) => x.id),
  zeroAs: ['0', 'FALSE'],
  colorMode: COLOR_MODES.map((x) => x.id),
  diagramStyle: ['standard', 'alternative'],
  theme: ['system', 'light', 'dark'],
  clAlgorithm: ALGORITHMS.map((x) => x.id),
  toolsTab: ['expr', 'truth', 'table', 'laws', 'data', 'generate'],
  sideTab: ['notations', 'tools'],
};
const RANGES: Partial<Record<keyof Settings, [number, number]>> = {
  maxSteps: [1, 10_000_000], maxSize: [100, 50_000_000], playSpeed: [0.25, 60],
};

/** Valid settings from stored or imported data: unknown keys are dropped, bad values reset. */
export function sanitizeSettings(raw: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS, tex: { ...DEFAULT_SETTINGS.tex }, openGroups: { ...DEFAULT_SETTINGS.openGroups } };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  const o = out as unknown as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const val = r[k], def = DEFAULT_SETTINGS[k];
    if (val === undefined) continue;
    const allowed = ENUMS[k];
    if (allowed) { if (typeof val === 'string' && allowed.includes(val)) o[k] = val; continue; }
    if (typeof def === 'boolean') { if (typeof val === 'boolean') o[k] = val; continue; }
    if (typeof def === 'number') {
      const [lo, hi] = RANGES[k] ?? [-Infinity, Infinity];
      if (typeof val === 'number' && val >= lo && val <= hi) o[k] = val;
      continue;
    }
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const rec: Record<string, boolean> = { ...(def as Record<string, boolean>) };
      for (const [kk, vv] of Object.entries(val)) if (typeof vv === 'boolean') rec[kk] = vv;
      o[k] = rec;
    }
  }
  return out;
}

export interface Entry {
  term: Term;
  /** How this entry was produced from the previous one. */
  via?: { kind: RedexKind | 'nbe' | 'run'; path?: Path; note?: string };
}

export interface RunState { kind: 'run' | 'normalize'; steps: number; size: number }

interface State {
  source: string;
  format: FormatId | 'auto';
  settings: Settings;
  program: Program;
  history: Entry[];
  index: number;
  hover: Path | null;
  hoverSource: 'diagram' | 'text' | null;
  /** Subterm selected for editing (path in the current term). */
  selected: Path | null;
  running: RunState | null;
  playing: boolean;
  message: Message | null;
  insertText: ((s: string) => void) | null;
  /** Select a range of the source in the editor and focus it (registered by the editor). */
  revealSource: ((from: number, to: number) => void) | null;

  /** Replace the source; pass a format (usually 'auto') when the new text is not the user's typing. */
  setSource(s: string, format?: FormatId | 'auto'): void;
  setFormat(f: FormatId | 'auto'): void;
  setSetting<K extends keyof Settings>(k: K, v: Settings[K]): void;
  /** Replace all settings (validated); with no argument, restore the defaults. */
  replaceSettings(s?: unknown): void;
  setHover(p: Path | null, from?: 'diagram' | 'text'): void;
  select(p: Path | null): void;
  /** Apply a structural edit to the current term and write the result back to the source. */
  edit(action: EditAction, p: Path, arg?: Term, name?: string): string | null;
  stepForward(): boolean;
  stepBack(): void;
  goto(i: number): void;
  reduceAt(path: Path): void;
  runToNormal(): void;
  normalizeFast(): void;
  stop(): void;
  setPlaying(p: boolean): void;
  registerInsert(f: ((s: string) => void) | null): void;
  registerReveal(f: ((from: number, to: number) => void) | null): void;
}

export interface Message { text: string; tone: 'info' | 'warn' | 'error'; action?: { label: string; run(): void } }

// --- persistence -------------------------------------------------------------
const KEY = 'lambda-studio:v1';
function load(): { source?: string; format?: FormatId | 'auto'; settings?: Partial<Settings> } {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch { return {}; }
}
function save(s: Pick<State, 'source' | 'format' | 'settings'>) {
  try { localStorage.setItem(KEY, JSON.stringify({ source: s.source, format: s.format, settings: s.settings })); } catch { /* ignore */ }
}

// Share links: #z=<base64url of deflate-raw(JSON)>; the old #s=<base64 source> still opens.
const b64url = (b: Uint8Array) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = (s: string) => { const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };
async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
export interface SharePayload { source: string; format?: FormatId | 'auto' }
export async function shareLink(source: string, format: FormatId | 'auto' = 'auto'): Promise<string> {
  const base = `${location.origin}${location.pathname}`;
  const json = new TextEncoder().encode(JSON.stringify(format === 'auto' ? { source } : { source, format }));
  if (typeof CompressionStream === 'undefined') return `${base}#s=${btoa(unescape(encodeURIComponent(source)))}`;
  return `${base}#z=${b64url(await pipe(json, new CompressionStream('deflate-raw')))}`;
}
export async function readShareHash(hash: string): Promise<SharePayload | null> {
  if (hash.startsWith('#s=')) {
    try { return { source: decodeURIComponent(escape(atob(hash.slice(3)))) }; } catch { return null; }
  }
  if (!hash.startsWith('#z=') || typeof DecompressionStream === 'undefined') return null;
  try {
    const bytes = await pipe(unb64url(hash.slice(3)), new DecompressionStream('deflate-raw'));
    const p = JSON.parse(new TextDecoder().decode(bytes));
    return typeof p.source === 'string' ? p : null;
  } catch { return null; }
}

// --- worker ------------------------------------------------------------------
let worker: Worker | null = null;
let reqId = 0;
/** The evaluation worker; `onFail` runs (and the worker is discarded) if it crashes or sends garbage. */
function getWorker(onMsg: (m: WorkerResponse) => void, onFail: (why: string) => void): Worker {
  if (!worker) {
    worker = new EvalWorker();
  }
  const fail = (why: string) => { killWorker(); onFail(why); };
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    let m: WorkerResponse;
    try { m = unpackDeep(e.data); } catch (err) { fail((err as Error).message || 'unreadable result'); return; }
    onMsg(m);
  };
  worker.onerror = (e) => { e.preventDefault(); fail(e.message || 'worker error'); };
  worker.onmessageerror = () => fail('unreadable result');
  return worker;
}
function killWorker() { worker?.terminate(); worker = null; }

const initial = load();
const DEFAULT_SOURCE = '-- Type a λ-term below (\\ becomes λ). Definitions: NAME = term\n-- Try the examples menu, then press Step or Run.\n\nPLUS 2 3';

function compile(source: string, format: FormatId | 'auto', settings: Settings): Program {
  return parseProgram(source, format, { singleLetter: settings.singleLetter });
}

export const useStore = create<State>((set, get) => {
  const settings: Settings = sanitizeSettings(initial.settings);
  const source = typeof initial.source === 'string' ? initial.source : DEFAULT_SOURCE;
  const format: FormatId | 'auto' = initial.format && (initial.format === 'auto' || FORMATS.some((f) => f.id === initial.format)) ? initial.format : 'auto';
  const program = compile(source, format, settings);

  const reset = (p: Program) => ({ program: p, history: p.term ? [{ term: p.term }] : [], index: 0, playing: false, message: null });

  const pushEntries = (entries: Entry[], base?: { history: Entry[]; index: number }) => {
    const { history, index } = base ?? get();
    const h = history.slice(0, index + 1).concat(entries);
    set({ history: h, index: h.length - 1 });
  };
  const failed = (why: string) => set({ running: null, message: { text: `The evaluator stopped unexpectedly (${why}).`, tone: 'error' } });
  /** Changes that make a running job's result meaningless stop it first. */
  const stopRun = () => { if (get().running) get().stop(); };

  return {
    source, format, settings, ...reset(program),
    hover: null, hoverSource: null, selected: null, running: null, insertText: null, revealSource: null,

    setSource(s, f) {
      if (get().running) get().stop();
      const format = f ?? get().format;
      const p = compile(s, format, get().settings);
      set({ source: s, format, ...reset(p), selected: null });
      save(get());
    },
    setFormat(f) {
      stopRun();
      const p = compile(get().source, f, get().settings);
      set({ format: f, ...reset(p) });
      save(get());
    },
    setSetting(k, v) {
      if (k === 'singleLetter' || k === 'strategy' || k === 'eta') stopRun();
      const settings = { ...get().settings, [k]: v };
      set({ settings });
      if (k === 'singleLetter') set(reset(compile(get().source, get().format, settings)));
      save(get());
    },
    replaceSettings(raw) {
      stopRun();
      const settings = sanitizeSettings(raw);
      set({ settings, ...reset(compile(get().source, get().format, settings)) });
      save(get());
    },
    setHover(p, from) {
      const hoverSource = p === null ? null : from ?? null;
      if (get().hover === p && get().hoverSource === hoverSource) return; // mouse moves within one part
      set({ hover: p, hoverSource });
    },
    select(p) { set({ selected: p }); },
    edit(action, p, arg, name) {
      const st = get();
      const term = st.history[st.index]?.term;
      if (!term) return 'No term';
      const next = applyEdit(term, p, action, arg, name);
      if (!next) return 'This action does not apply here';
      // The rewritten source folds only names (and numerals) the source already uses: folding in
      // other library names would change what the user wrote (λx.λx.x x must not come back as λx.ω).
      const fold = st.settings.foldNames ? sourceFolder(st.source, makeFolder(st.program.foldTable, { numerals: st.settings.numerals, zeroAs: st.settings.zeroAs })) : undefined;
      const avoid = new Set([...st.program.foldTable.names, ...(name ? [name] : [])]);
      const newDefs = action === 'fold' && name ? [{ name, body: printNamed(getAt(term, p), { fold, avoid }).text }] : [];
      const named = st.program.format === 'named' || st.program.format === 'haskell';
      const src = rewriteSource(named ? st.source : '', printNamed(next, { fold, avoid }).text, newDefs);
      if (st.running) st.stop();
      // The rewritten source is named notation. Keep a pinned Named/Haskell format; with 'auto',
      // keep it only if the new text is detected as named (a bare numeral like 1000 is not BLC).
      const format: FormatId | 'auto' = st.format === 'haskell' ? 'haskell'
        : st.format === 'auto' && detectFormat(src) === 'named' ? 'auto' : 'named';
      const prog = compile(src, format, st.settings);
      let keep: Path | null = null;
      if (prog.term) { try { getAt(prog.term, p); keep = p; } catch { keep = null; } }
      set({ source: src, format, ...reset(prog), selected: keep, message: { text: `${ACTIONS.find((a) => a.id === action)?.label.replace(/…$/, '') ?? action}: the source was rewritten from the current term.`, tone: 'info' } });
      save(get());
      return null;
    },

    // While a run or normalization is in progress the timeline is frozen: its result is appended
    // to the timeline as it was when the job started.
    stepForward() {
      const { history, index, settings, running } = get();
      if (running) return false;
      if (index < history.length - 1) { set({ index: index + 1 }); return true; }
      const cur = history[index]?.term;
      if (!cur) return false;
      const path = findRedex(cur, settings);
      if (path === null) { set({ message: { text: 'Normal form reached under this strategy.', tone: 'info' }, playing: false }); return false; }
      const r = stepAt(cur, path, settings.eta);
      pushEntries([{ term: r.term, via: { kind: r.kind, path } }]);
      set({ message: null });
      return true;
    },
    stepBack() { const { index, running } = get(); if (index > 0 && !running) set({ index: index - 1, message: null }); },
    goto(i) { const { history, running } = get(); if (!running) set({ index: Math.max(0, Math.min(history.length - 1, i)), message: null }); },
    reduceAt(path) {
      const { history, index, settings, running } = get();
      const cur = history[index]?.term;
      if (!cur || running) return;
      const kind = redexKindAt(cur, path, settings.eta);
      if (!kind) return;
      const r = stepAt(cur, path, settings.eta);
      pushEntries([{ term: r.term, via: { kind: r.kind, path } }]);
      // the selection is a path into the old term; it would now point at something else
      set({ selected: null, message: null });
    },
    runToNormal() {
      const { history, index, settings, running } = get();
      const cur = history[index]?.term;
      if (!cur || running) return;
      const id = ++reqId;
      const base = { history, index };
      set({ running: { kind: 'run', steps: 0, size: 0 }, playing: false, message: null });
      const w = getWorker((m) => {
        if (m.id !== id) return;
        // the program changed underneath (that stops the job, but a last message can still arrive)
        if (get().history !== base.history) { set({ running: null }); return; }
        if (m.type === 'progress') set({ running: { kind: 'run', steps: m.steps, size: m.size } });
        else if (m.type === 'run-done') {
          const entries: Entry[] = [];
          // history[0] is the current term; following entries are produced by history[k].path
          for (let k = 1; k < m.history.length; k++) {
            const prev = m.history[k - 1];
            entries.push({ term: m.history[k].term, via: { kind: prev.kind ?? 'beta', path: prev.path ?? undefined } });
          }
          const lastRecorded = entries.length ? entries[entries.length - 1].term : cur;
          if (lastRecorded !== m.term && m.steps > entries.length) {
            entries.push({ term: m.term, via: { kind: 'run', note: `${m.steps - entries.length} more steps (not recorded)` } });
          }
          pushEntries(entries, base);
          const limit = m.status === 'step-limit' || m.status === 'size-limit';
          const tone = m.status === 'normal' ? 'info' : m.status === 'cycle' || limit ? 'warn' : 'error';
          const text = m.status === 'normal' ? `Normal form after ${m.steps} step${m.steps === 1 ? '' : 's'} (largest term: ${m.maxSizeSeen} nodes).` : m.message ?? m.status;
          // a limit is not a failure: offer to raise it and carry on from where the run stopped
          const key = m.status === 'step-limit' ? 'maxSteps' : 'maxSize';
          const action = limit ? { label: `Raise the limit to ${(settings[key] * 10).toLocaleString('en')} and continue`, run: () => { const s = useStore.getState(); s.setSetting(key, Math.min(key === 'maxSteps' ? 10_000_000 : 50_000_000, s.settings[key] * 10)); s.runToNormal(); } } : undefined;
          set({ running: null, message: { text, tone, action } });
        }
      }, failed);
      const req: WorkerRequest = { id, type: 'run', term: cur, opts: { strategy: settings.strategy, eta: settings.eta }, maxSteps: settings.maxSteps, maxSize: settings.maxSize, record: 2000 };
      w.postMessage(packDeep(req));
    },
    normalizeFast() {
      const { history, index, settings, running } = get();
      const cur = history[index]?.term;
      if (!cur || running) return;
      const id = ++reqId;
      const base = { history, index };
      set({ running: { kind: 'normalize', steps: 0, size: 0 }, playing: false, message: null });
      const w = getWorker((m) => {
        if (m.id !== id || m.type !== 'normalize-done') return;
        if (get().history !== base.history) { set({ running: null }); return; }
        if (m.term) {
          pushEntries([{ term: m.term, via: { kind: 'nbe', note: `${m.betas} shared β-steps` } }], base);
          set({ running: null, message: { text: `Normal form via fast normalizer (${m.betas} β-steps with sharing, ${m.size} nodes).`, tone: 'info' } });
        } else if (m.status === 'fuel') {
          // not an error: the term may have no normal form (Ω), or need more work than allowed
          const fuel = settings.maxSteps * 100;
          set({ running: null, message: {
            text: `No normal form within ${fuel.toLocaleString('en')} β-steps: the term may have none (like Ω), or need more.`, tone: 'warn',
            action: settings.maxSteps < 10_000_000 ? { label: 'Raise the limit ×10 and try again', run: () => { const s = useStore.getState(); s.setSetting('maxSteps', Math.min(10_000_000, s.settings.maxSteps * 10)); s.normalizeFast(); } } : undefined,
          } });
        } else set({ running: null, message: { text: m.message ?? 'Failed', tone: 'error' } });
      }, failed);
      const req: WorkerRequest = { id, type: 'normalize', term: cur, fuel: settings.maxSteps * 100, eta: settings.eta };
      w.postMessage(packDeep(req));
    },
    stop() {
      if (get().running) { killWorker(); set({ running: null, message: { text: 'Stopped.', tone: 'warn' } }); }
      set({ playing: false });
    },
    setPlaying(p) { set({ playing: p && !get().running }); },
    registerInsert(f) { set({ insertText: f }); },
    registerReveal(f) { set({ revealSource: f }); },
  };
});

export const currentTerm = (s: State): Term | null => s.history[s.index]?.term ?? null;

/** The next redex of a term under a strategy, computed once per term (several panels ask). */
const redexCache = new WeakMap<Term, Map<string, Path | null>>();
export function nextRedex(t: Term, strategy: Strategy, eta: boolean): Path | null {
  let m = redexCache.get(t);
  if (!m) redexCache.set(t, (m = new Map()));
  const key = `${strategy}|${eta}`;
  if (!m.has(key)) m.set(key, findRedex(t, { strategy, eta }));
  return m.get(key)!;
}
/** Hook: the next redex of the current term (null when there is none). */
export function useNextRedex(): Path | null {
  const term = useStore(currentTerm);
  const strategy = useStore((s) => s.settings.strategy);
  const eta = useStore((s) => s.settings.eta);
  return term ? nextRedex(term, strategy, eta) : null;
}

// Share links (#z=…, and the older #s=…) open once. The hash is removed at once, so reloading the
// page later does not bring the shared snapshot back over newer work, and the source the link
// replaced can be restored from the status message.
function openShareHash() {
  const hash = location.hash;
  if (!hash.startsWith('#z=') && !hash.startsWith('#s=')) return;
  history.replaceState(null, '', location.pathname + location.search);
  readShareHash(hash).then((p) => {
    if (!p) {
      const text = hash.startsWith('#z=') && typeof DecompressionStream === 'undefined'
        ? 'This browser cannot open compressed share links.' : 'Could not read the share link.';
      useStore.setState({ message: { text, tone: 'error' } });
      return;
    }
    const st = useStore.getState();
    const format = p.format && (p.format === 'auto' || FORMATS.some((f) => f.id === p.format)) ? p.format : 'auto';
    const prev = { source: st.source, format: st.format };
    if (p.source === prev.source && format === prev.format) return;
    if (format !== st.format) st.setFormat(format);
    st.setSource(p.source);
    const replaced = prev.source.trim() !== '' && prev.source !== DEFAULT_SOURCE;
    useStore.setState({
      message: {
        text: replaced ? 'Opened a shared link. It replaced your previous source.' : 'Opened a shared link.',
        tone: 'info',
        action: replaced ? { label: 'Restore my previous source', run: () => { const s = useStore.getState(); if (prev.format !== s.format) s.setFormat(prev.format); s.setSource(prev.source); } } : undefined,
      },
    });
  });
}
if (typeof location !== 'undefined' && typeof window !== 'undefined') {
  openShareHash();
  window.addEventListener('hashchange', openShareHash);
}
