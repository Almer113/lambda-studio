import { create } from 'zustand';
import { type Term, type Path } from '../core/term';
import { parseProgram, type FormatId, type Program } from '../core/program';
import { findRedex, stepAt, redexKindAt, type Strategy, type RedexKind } from '../core/reduce';
import type { WorkerRequest, WorkerResponse } from '../worker/eval.worker';
import EvalWorker from '../worker/eval.worker?worker&inline';
import type { Algorithm } from '../core/combinators';
import { applyEdit, rewriteSource, type EditAction } from '../core/edit';
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
}
export type ToolsTab = 'expr' | 'truth' | 'table' | 'laws' | 'data' | 'generate';

export const DEFAULT_SETTINGS: Settings = {
  strategy: 'normal', eta: false, singleLetter: false, foldNames: true, numerals: true, zeroAs: '0',
  colorMode: 'binder', diagramStyle: 'standard', animate: true, showRedex: true, autoLambda: true, theme: 'system',
  maxSteps: 10000, maxSize: 200000, playSpeed: 4,
  tex: { current: true, named: true, expanded: true, debruijn0: true, debruijn1: true },
  sourcePreview: true,
  clAlgorithm: 'turner',
  openGroups: { lambda: true, combinators: true, code: true, bits: true },
  toolsTab: 'expr',
  mathEditor: false,
};

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
  message: { text: string; tone: 'info' | 'warn' | 'error' } | null;
  insertText: ((s: string) => void) | null;

  setSource(s: string): void;
  setFormat(f: FormatId | 'auto'): void;
  setSetting<K extends keyof Settings>(k: K, v: Settings[K]): void;
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
}

// --- persistence -------------------------------------------------------------
const KEY = 'lambda-studio:v1';
function load(): { source?: string; format?: FormatId | 'auto'; settings?: Partial<Settings> } {
  try {
    const hash = location.hash.startsWith('#s=') ? location.hash.slice(3) : null;
    if (hash) return { source: decodeURIComponent(escape(atob(hash))) };
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
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
  if (!hash.startsWith('#z=')) return null;
  try {
    const bytes = await pipe(unb64url(hash.slice(3)), new DecompressionStream('deflate-raw'));
    const p = JSON.parse(new TextDecoder().decode(bytes));
    return typeof p.source === 'string' ? p : null;
  } catch { return null; }
}

// --- worker ------------------------------------------------------------------
let worker: Worker | null = null;
let reqId = 0;
function getWorker(onMsg: (m: WorkerResponse) => void): Worker {
  if (!worker) {
    worker = new EvalWorker();
  }
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => onMsg(unpackDeep(e.data));
  return worker;
}
function killWorker() { worker?.terminate(); worker = null; }

const initial = load();
const DEFAULT_SOURCE = '-- Type a λ-term below (\\ becomes λ). Definitions: NAME = term\n-- Try the examples menu, then press Step or Run.\n\nPLUS 2 3';

function compile(source: string, format: FormatId | 'auto', settings: Settings): Program {
  return parseProgram(source, format, { singleLetter: settings.singleLetter });
}

export const useStore = create<State>((set, get) => {
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(initial.settings ?? {}) };
  const source = initial.source ?? DEFAULT_SOURCE;
  const format = initial.format ?? 'auto';
  const program = compile(source, format, settings);

  const reset = (p: Program) => ({ program: p, history: p.term ? [{ term: p.term }] : [], index: 0, playing: false, message: null });

  const pushEntries = (entries: Entry[]) => {
    const { history, index } = get();
    const h = history.slice(0, index + 1).concat(entries);
    set({ history: h, index: h.length - 1 });
  };

  return {
    source, format, settings, ...reset(program),
    hover: null, hoverSource: null, selected: null, running: null, insertText: null,

    setSource(s) {
      if (get().running) get().stop();
      const p = compile(s, get().format, get().settings);
      set({ source: s, ...reset(p), selected: null });
      save(get());
    },
    setFormat(f) {
      const p = compile(get().source, f, get().settings);
      set({ format: f, ...reset(p) });
      save(get());
    },
    setSetting(k, v) {
      const settings = { ...get().settings, [k]: v };
      set({ settings });
      if (k === 'singleLetter') set(reset(compile(get().source, get().format, settings)));
      save(get());
    },
    setHover(p, from) { set({ hover: p, hoverSource: p === null ? null : from ?? null }); },
    select(p) { set({ selected: p }); },
    edit(action, p, arg, name) {
      const st = get();
      const term = st.history[st.index]?.term;
      if (!term) return 'No term';
      const next = applyEdit(term, p, action, arg, name);
      if (!next) return 'This action does not apply here';
      const fold = st.settings.foldNames ? makeFolder(st.program.foldTable, { numerals: st.settings.numerals, zeroAs: st.settings.zeroAs }) : undefined;
      const avoid = new Set([...st.program.foldTable.names, ...(name ? [name] : [])]);
      const newDefs = action === 'fold' && name ? [{ name, body: printNamed(getAt(term, p), { fold, avoid }).text }] : [];
      const named = st.program.format === 'named' || st.program.format === 'haskell';
      const src = rewriteSource(named ? st.source : '', printNamed(next, { fold, avoid }).text, newDefs);
      if (st.running) st.stop();
      const prog = compile(src, 'auto', st.settings);
      let keep: Path | null = null;
      if (prog.term) { try { getAt(prog.term, p); keep = p; } catch { keep = null; } }
      set({ source: src, format: 'auto', ...reset(prog), selected: keep, message: { text: `Edited: ${action}. The source was rewritten from the current term.`, tone: 'info' } });
      save(get());
      return null;
    },

    stepForward() {
      const { history, index, settings } = get();
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
    stepBack() { const { index } = get(); if (index > 0) set({ index: index - 1, message: null }); },
    goto(i) { const { history } = get(); set({ index: Math.max(0, Math.min(history.length - 1, i)), message: null }); },
    reduceAt(path) {
      const { history, index, settings } = get();
      const cur = history[index]?.term;
      if (!cur) return;
      const kind = redexKindAt(cur, path, settings.eta);
      if (!kind) return;
      const r = stepAt(cur, path, settings.eta);
      pushEntries([{ term: r.term, via: { kind: r.kind, path } }]);
    },
    runToNormal() {
      const { history, index, settings } = get();
      const cur = history[index]?.term;
      if (!cur) return;
      const id = ++reqId;
      set({ running: { kind: 'run', steps: 0, size: 0 }, playing: false, message: null });
      const w = getWorker((m) => {
        if (m.id !== id) return;
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
          pushEntries(entries);
          const tone = m.status === 'normal' ? 'info' : m.status === 'cycle' ? 'warn' : 'error';
          const text = m.status === 'normal' ? `Normal form after ${m.steps} step${m.steps === 1 ? '' : 's'} (largest term: ${m.maxSizeSeen} nodes).` : m.message ?? m.status;
          set({ running: null, message: { text, tone } });
        }
      });
      const req: WorkerRequest = { id, type: 'run', term: cur, opts: { strategy: settings.strategy, eta: settings.eta }, maxSteps: settings.maxSteps, maxSize: settings.maxSize, record: 2000 };
      w.postMessage(packDeep(req));
    },
    normalizeFast() {
      const { history, index, settings } = get();
      const cur = history[index]?.term;
      if (!cur) return;
      const id = ++reqId;
      set({ running: { kind: 'normalize', steps: 0, size: 0 }, playing: false, message: null });
      const w = getWorker((m) => {
        if (m.id !== id || m.type !== 'normalize-done') return;
        if (m.term) {
          pushEntries([{ term: m.term, via: { kind: 'nbe', note: `${m.betas} shared β-steps` } }]);
          set({ running: null, message: { text: `Normal form via fast normalizer (${m.betas} β-steps with sharing, ${m.size} nodes).`, tone: 'info' } });
        } else set({ running: null, message: { text: m.message ?? 'Failed', tone: 'error' } });
      });
      const req: WorkerRequest = { id, type: 'normalize', term: cur, fuel: settings.maxSteps * 100 };
      w.postMessage(packDeep(req));
    },
    stop() {
      if (get().running) { killWorker(); set({ running: null, message: { text: 'Stopped.', tone: 'warn' } }); }
      set({ playing: false });
    },
    setPlaying(p) { set({ playing: p }); },
    registerInsert(f) { set({ insertText: f }); },
  };
});

export const currentTerm = (s: State): Term | null => s.history[s.index]?.term ?? null;

// A compressed share link is decoded asynchronously after start-up.
if (typeof location !== 'undefined' && location.hash.startsWith('#z=')) {
  readShareHash(location.hash).then((p) => {
    if (!p) { useStore.setState({ message: { text: 'Could not read the share link.', tone: 'error' } }); return; }
    const st = useStore.getState();
    if (p.format) st.setFormat(p.format);
    st.setSource(p.source);
  });
}
