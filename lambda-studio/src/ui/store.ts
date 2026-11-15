import { create } from 'zustand';
import { type Term, type Path } from '../core/term';
import { parseProgram, type FormatId, type Program } from '../core/program';
import { findRedex, stepAt, redexKindAt, type Strategy, type RedexKind } from '../core/reduce';
import type { WorkerRequest, WorkerResponse } from '../worker/eval.worker';

export type ColorMode = 'mono' | 'binder' | 'depth';
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  strategy: Strategy;
  eta: boolean;
  singleLetter: boolean;
  foldNames: boolean;
  numerals: boolean;
  zeroAs: '0' | 'FALSE';
  colorMode: ColorMode;
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
}

export const DEFAULT_SETTINGS: Settings = {
  strategy: 'normal', eta: false, singleLetter: false, foldNames: true, numerals: true, zeroAs: '0',
  colorMode: 'binder', showRedex: true, autoLambda: true, theme: 'system',
  maxSteps: 10000, maxSize: 200000, playSpeed: 4,
  tex: { current: true, named: true, expanded: true, debruijn0: true, debruijn1: true },
  sourcePreview: true,
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
  running: RunState | null;
  playing: boolean;
  message: { text: string; tone: 'info' | 'warn' | 'error' } | null;
  insertText: ((s: string) => void) | null;

  setSource(s: string): void;
  setFormat(f: FormatId | 'auto'): void;
  setSetting<K extends keyof Settings>(k: K, v: Settings[K]): void;
  setHover(p: Path | null, from?: 'diagram' | 'text'): void;
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
export function shareLink(source: string): string {
  const enc = btoa(unescape(encodeURIComponent(source)));
  return `${location.origin}${location.pathname}#s=${enc}`;
}

// --- worker ------------------------------------------------------------------
let worker: Worker | null = null;
let reqId = 0;
function getWorker(onMsg: (m: WorkerResponse) => void): Worker {
  if (!worker) {
    worker = new Worker(new URL('../worker/eval.worker.ts', import.meta.url), { type: 'module' });
  }
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => onMsg(e.data);
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
    hover: null, hoverSource: null, running: null, insertText: null,

    setSource(s) {
      if (get().running) get().stop();
      const p = compile(s, get().format, get().settings);
      set({ source: s, ...reset(p) });
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
      w.postMessage(req);
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
      w.postMessage(req);
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
