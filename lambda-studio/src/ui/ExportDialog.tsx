import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { useStore, currentTerm, DEFAULT_SETTINGS, type Settings } from './store';
import { layoutSafe } from './render';
import { toSVG } from '../core/diagram/svg';
import { toTikZ, toTypst } from '../core/diagram/vector';
import { toPixelArt, toBoxChars } from '../core/diagram/ascii';
import { segmentColor } from '../core/diagram/colors';
import { traceText, toLam, markdownSummary } from '../core/trace';
import { encodeBLC } from '../core/formats/blc';
import { bitsToBytes } from '../core/formats/blc8';
import { size } from '../core/term';
import { useIsDark } from './theme';
import { useFolder } from './panels';
import { planVideo, encodeGif, encodeWebm, webmSupported, type VideoOptions } from './video';
import { download } from './DiagramView';

type Tab = 'diagram' | 'animation' | 'text' | 'workspace';

export const useExport = create<{ open: boolean; tab: Tab; show(tab?: Tab): void; hide(): void }>((set) => ({
  open: false, tab: 'diagram',
  show: (tab) => set((s) => ({ open: true, tab: tab ?? s.tab })),
  hide: () => set({ open: false }),
}));

const TABS: { id: Tab; name: string }[] = [
  { id: 'diagram', name: 'Diagram' },
  { id: 'animation', name: 'Animation' },
  { id: 'text', name: 'Text & code' },
  { id: 'workspace', name: 'Workspace' },
];

export function ExportDialog() {
  const { open, tab, hide } = useExport();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="export-dialog" onClose={hide} onClick={(e) => { if (e.target === ref.current) hide(); }}>
      {open && (
        <div className="export-body">
          <div className="export-head">
            <h2>Export</h2>
            <nav className="export-tabs" role="tablist">
              {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => useExport.getState().show(t.id)}>{t.name}</button>)}
            </nav>
            <button className="close" onClick={hide} aria-label="Close">✕</button>
          </div>
          {tab === 'diagram' && <DiagramExport />}
          {tab === 'animation' && <AnimationExport />}
          {tab === 'text' && <TextExport />}
          {tab === 'workspace' && <WorkspaceExport />}
        </div>
      )}
    </dialog>
  );
}

// --- diagram -----------------------------------------------------------------
type DiagramFormat = 'svg' | 'png' | 'tikz' | 'typst' | 'pixels' | 'box';
const DIAGRAM_FORMATS: { id: DiagramFormat; name: string; ext: string; mime: string }[] = [
  { id: 'svg', name: 'SVG', ext: 'svg', mime: 'image/svg+xml' },
  { id: 'png', name: 'PNG', ext: 'png', mime: 'image/png' },
  { id: 'tikz', name: 'TikZ (LaTeX)', ext: 'tex', mime: 'text/x-tex' },
  { id: 'typst', name: 'Typst', ext: 'typ', mime: 'text/plain' },
  { id: 'pixels', name: 'Text (pixel art)', ext: 'txt', mime: 'text/plain' },
  { id: 'box', name: 'Text (box drawing)', ext: 'txt', mime: 'text/plain' },
];

function DiagramExport() {
  const term = useStore(currentTerm);
  const settings = useStore((s) => s.settings);
  const isDark = useIsDark();
  const [fmt, setFmt] = useState<DiagramFormat>('svg');
  const [scale, setScale] = useState(8);
  const [transparent, setTransparent] = useState(false);
  const [dark, setDark] = useState(isDark);
  const d = useMemo(() => (term ? layoutSafe(term, settings.diagramStyle) : null), [term, settings.diagramStyle]);
  const color = (s: Parameters<typeof segmentColor>[0]) => segmentColor(s, settings.colorMode, dark);
  const bg = transparent ? null : dark ? '#121214' : '#ffffff';
  const info = DIAGRAM_FORMATS.find((f) => f.id === fmt)!;
  const maxSide = d ? Math.max(d.width + 4, d.height - d.top + 4) : 1;
  const pngScale = Math.max(1, Math.min(scale, Math.floor(16384 / maxSide)));

  const text = useMemo(() => {
    if (!d) return '';
    switch (fmt) {
      case 'svg': return d.segments.length < 200000 ? toSVG(d, { scale: 1, background: bg, color }) : '';
      case 'tikz': return toTikZ(d, { unit: scale / 4, background: bg, color });
      case 'typst': return toTypst(d, { unit: scale / 4, background: bg, color });
      case 'pixels': return d.width <= 400 ? toPixelArt(d) : '';
      case 'box': return d.width <= 400 ? toBoxChars(d) : '';
      default: return '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, fmt, scale, bg, dark, settings.colorMode]);

  const previewSvg = useMemo(() => (d && d.segments.length < 30000 ? toSVG(d, { scale: 1, background: bg, color }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, bg, dark, settings.colorMode]);

  const save = () => {
    if (!d) return;
    if (fmt === 'png') {
      const svg = toSVG(d, { scale: pngScale, background: bg, color });
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0);
        c.toBlob((b) => b && download(b, 'lambda-diagram.png'));
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      return;
    }
    const out = fmt === 'svg' ? toSVG(d, { scale, background: bg, color }) : text;
    download(new Blob([out], { type: info.mime }), `lambda-diagram.${info.ext}`);
  };

  if (!d) return <p className="muted">No diagram to export.</p>;
  const isText = fmt !== 'svg' && fmt !== 'png';
  const tooWide = (fmt === 'pixels' || fmt === 'box') && !text;
  return (
    <div className="export-pane">
      <div className="export-options">
        <label>Format <select value={fmt} onChange={(e) => setFmt(e.target.value as DiagramFormat)}>{DIAGRAM_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        {(fmt === 'svg' || fmt === 'png' || fmt === 'tikz' || fmt === 'typst') && <>
          <label>{fmt === 'png' || fmt === 'svg' ? 'Pixels per unit' : 'Size'}
            <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
              {[1, 2, 4, 8, 16].map((k) => <option key={k} value={k}>{fmt === 'tikz' || fmt === 'typst' ? `${k / 4} pt per unit` : `${k}×`}</option>)}
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} /> Transparent background</label>
          <label className="check"><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> Dark colours</label>
        </>}
        <span className="muted">{settings.diagramStyle === 'alternative' ? 'Alternative' : 'Standard'} style · colour mode from the diagram panel</span>
      </div>
      {fmt === 'png' && <p className="muted">{(d.width + 4) * pngScale} × {(d.height - d.top + 4) * pngScale} px{pngScale < scale ? ' (scale reduced to stay under 16384 px)' : ''}</p>}
      <div className="export-preview">
        {isText ? (tooWide ? <p className="muted">Too wide for a text drawing ({d.width} columns).</p> : <textarea readOnly value={text} spellCheck={false} />)
          : previewSvg ? <div className="img-preview" style={{ background: transparent ? 'repeating-conic-gradient(#8884 0 25%, transparent 0 50%) 0 0 / 16px 16px' : undefined }} dangerouslySetInnerHTML={{ __html: previewSvg.replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%" ') }} /> : <p className="muted">Too large to preview.</p>}
      </div>
      <div className="export-actions">
        {isText && text && <CopyButton text={text} />}
        <button className="primary" onClick={save} disabled={tooWide}>Download .{info.ext}</button>
      </div>
    </div>
  );
}

// --- animation ---------------------------------------------------------------
function AnimationExport() {
  const history = useStore((s) => s.history);
  const index = useStore((s) => s.index);
  const settings = useStore((s) => s.settings);
  const isDark = useIsDark();
  const [kind, setKind] = useState<'gif' | 'webm'>('gif');
  const [maxPx, setMaxPx] = useState(480);
  const [perStep, setPerStep] = useState(0.8);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(index);
  const [dark, setDark] = useState(isDark);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; blob: Blob; kind: 'gif' | 'webm' } | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => { abort.current?.abort(); }, []);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const last = history.length - 1;
  const lo = Math.min(from, last), hi = Math.max(lo, Math.min(to, last));
  const steps = history.slice(lo, hi + 1).map((e, k) => ({ term: e.term, kind: k === 0 ? undefined : e.via?.kind, path: e.via?.path }));
  const opts: VideoOptions = {
    style: settings.diagramStyle, mode: settings.colorMode, dark, background: dark ? '#121214' : '#ffffff',
    maxPx, secondsPerStep: perStep, hold: 1, fps: kind === 'gif' ? 15 : 30, highlight: settings.showRedex,
  };
  const plan = useMemo(() => {
    try { return { plan: planVideo(steps, opts), error: null }; } catch (e) { return { plan: null, error: (e as Error).message }; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lo, hi, history, maxPx, perStep, kind, dark, settings.diagramStyle, settings.colorMode, settings.showRedex]);

  const make = async () => {
    if (!plan.plan) return;
    setError(null); setResult(null);
    const ac = new AbortController();
    abort.current = ac;
    setBusy({ done: 0, total: plan.plan.frames.length });
    try {
      const enc = kind === 'gif' ? encodeGif : encodeWebm;
      const blob = await enc(plan.plan, opts, (done, total) => setBusy({ done, total }), ac.signal);
      setResult({ url: URL.createObjectURL(blob), blob, kind });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally { setBusy(null); }
  };

  if (history.length < 2) return <p className="muted">Take some steps first (Step, Play or Run): the animation shows the recorded reduction.</p>;
  return (
    <div className="export-pane">
      <div className="export-options">
        <label>Format <select value={kind} onChange={(e) => setKind(e.target.value as 'gif' | 'webm')}>
          <option value="gif">GIF</option>
          <option value="webm" disabled={!webmSupported()}>WebM video{webmSupported() ? '' : ' (not supported here)'}</option>
        </select></label>
        <label>Steps <input type="number" min={0} max={last} value={lo} onChange={(e) => setFrom(Number(e.target.value))} /> to <input type="number" min={0} max={last} value={hi} onChange={(e) => setTo(Number(e.target.value))} /></label>
        <label>Size <select value={maxPx} onChange={(e) => setMaxPx(Number(e.target.value))}>{[240, 360, 480, 720, 1080].map((k) => <option key={k} value={k}>{k} px</option>)}</select></label>
        <label>Seconds per step <input type="number" min={0.2} max={4} step={0.1} value={perStep} onChange={(e) => setPerStep(Math.max(0.2, Number(e.target.value)))} /></label>
        <label className="check"><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> Dark colours</label>
      </div>
      <p className="muted">
        {plan.plan ? <>{hi - lo} step{hi - lo === 1 ? '' : 's'} · {plan.plan.W}×{plan.plan.H} px · {plan.plan.seconds.toFixed(1)} s · {plan.plan.frames.length} frames{kind === 'webm' ? ' · records in real time' : ''}</> : <span className="err">{plan.error}</span>}
        {steps.some((s, k) => k > 0 && s.kind !== 'beta') && ' · steps that are not single β-steps cross-fade'}
      </p>
      <div className="export-preview">
        {busy && <div className="progress"><div style={{ width: `${(100 * busy.done) / busy.total}%` }} /><span>{busy.done}/{busy.total} frames</span></div>}
        {error && <p className="err">{error}</p>}
        {result && (result.kind === 'gif' ? <img className="anim-preview" src={result.url} alt="Animation preview" /> : <video className="anim-preview" src={result.url} controls autoPlay loop muted />)}
        {!busy && !result && !error && <p className="muted">Press Make to render the animation.</p>}
      </div>
      <div className="export-actions">
        {busy ? <button onClick={() => abort.current?.abort()}>Cancel</button> : <button onClick={make} disabled={!plan.plan}>Make {kind.toUpperCase()}</button>}
        {result && <span className="muted">{(result.blob.size / 1024).toFixed(0)} KB</span>}
        <button className="primary" disabled={!result} onClick={() => result && download(result.blob, `lambda-reduction.${result.kind}`)}>Download</button>
      </div>
    </div>
  );
}

// --- text --------------------------------------------------------------------
type TextFormat = 'trace-named' | 'trace-db' | 'trace-latex' | 'markdown' | 'lam' | 'blc' | 'blc8';
const TEXT_FORMATS: { id: TextFormat; name: string; ext: string }[] = [
  { id: 'trace-named', name: 'Reduction trace (named)', ext: 'txt' },
  { id: 'trace-db', name: 'Reduction trace (de Bruijn)', ext: 'txt' },
  { id: 'trace-latex', name: 'Reduction trace (LaTeX)', ext: 'tex' },
  { id: 'markdown', name: 'Markdown summary', ext: 'md' },
  { id: 'lam', name: 'Tromp .lam source', ext: 'lam' },
  { id: 'blc', name: 'Binary λ-calculus (.blc bits)', ext: 'blc' },
  { id: 'blc8', name: 'Binary λ-calculus (.blc8 bytes)', ext: 'blc8' },
];

function TextExport() {
  const history = useStore((s) => s.history);
  const index = useStore((s) => s.index);
  const source = useStore((s) => s.source);
  const term = useStore(currentTerm);
  const { fold, avoid } = useFolder();
  const [fmt, setFmt] = useState<TextFormat>('trace-named');
  const [names, setNames] = useState(true);
  const info = TEXT_FORMATS.find((f) => f.id === fmt)!;
  const opts = names ? { fold, avoid } : {};
  const entries = history.slice(0, index + 1).map((e) => ({ term: e.term, kind: e.via?.kind }));

  const out = useMemo((): { text: string; bytes?: Uint8Array; error?: string } => {
    if (!term) return { text: '', error: 'No term.' };
    try {
      switch (fmt) {
        case 'trace-named': return { text: traceText(entries, 'named', opts) };
        case 'trace-db': return { text: traceText(entries, 'debruijn1') };
        case 'trace-latex': return { text: traceText(entries, 'latex', opts) };
        case 'markdown': return { text: markdownSummary(source, history[0].term, term, index, opts) };
        case 'lam': return { text: toLam(term) };
        case 'blc': return { text: encodeBLC(term) };
        case 'blc8': { const bits = encodeBLC(term); const bytes = bitsToBytes(bits); return { text: `${bytes.length} bytes (${bits.length} bits, zero-padded)\n${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ')}`, bytes }; }
      }
    } catch (e) { return { text: '', error: (e as Error).message }; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fmt, term, history, index, names, fold, avoid, source]);

  const save = () => {
    const blob = out.bytes ? new Blob([out.bytes], { type: 'application/octet-stream' }) : new Blob([out.text], { type: 'text/plain;charset=utf-8' });
    download(blob, `lambda.${info.ext}`);
  };
  const large = term && size(term) > 5000 && fmt.startsWith('trace');
  return (
    <div className="export-pane">
      <div className="export-options">
        <label>Format <select value={fmt} onChange={(e) => setFmt(e.target.value as TextFormat)}>{TEXT_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        {(fmt === 'trace-named' || fmt === 'trace-latex' || fmt === 'markdown') && <label className="check"><input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} /> Show definition names</label>}
        <span className="muted">{fmt.startsWith('trace') ? `steps 0–${index} of the history` : fmt === 'markdown' ? 'source, current term, value, BLC, diagram' : 'current term'}{large ? ' · terms over 5000 nodes are elided' : ''}</span>
      </div>
      <div className="export-preview">{out.error ? <p className="err">{out.error}</p> : <textarea readOnly value={out.text} spellCheck={false} />}</div>
      <div className="export-actions">
        {!out.error && !out.bytes && <CopyButton text={out.text} />}
        <button className="primary" onClick={save} disabled={!!out.error}>Download .{info.ext}</button>
      </div>
    </div>
  );
}

// --- workspace ---------------------------------------------------------------
interface Workspace { app: 'lambda-studio'; version: 1; source: string; format: string; settings: Partial<Settings> }

function WorkspaceExport() {
  const source = useStore((s) => s.source);
  const format = useStore((s) => s.format);
  const settings = useStore((s) => s.settings);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  const ws: Workspace = { app: 'lambda-studio', version: 1, source, format, settings };
  const json = JSON.stringify(ws, null, 2);
  const file = useRef<HTMLInputElement>(null);

  const load = async (f: File) => {
    try {
      const w = JSON.parse(await f.text()) as Partial<Workspace>;
      if (w.app !== 'lambda-studio' || typeof w.source !== 'string') throw new Error('Not a Lambda Studio workspace file.');
      const st = useStore.getState();
      for (const [k, v] of Object.entries(w.settings ?? {})) if (k in DEFAULT_SETTINGS) st.setSetting(k as keyof Settings, v as never);
      if (w.format) st.setFormat(w.format as never);
      st.setSource(w.source);
      setMsg({ text: `Loaded ${f.name}.`, tone: 'ok' });
    } catch (e) { setMsg({ text: (e as Error).message, tone: 'err' }); }
  };

  return (
    <div className="export-pane">
      <p className="muted">A workspace file holds the source, the input format and all settings. Opening one replaces the current source.</p>
      <div className="export-preview"><textarea readOnly value={json} spellCheck={false} /></div>
      {msg && <p className={msg.tone === 'err' ? 'err' : 'ok'}>{msg.text}</p>}
      <div className="export-actions">
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ''; }} />
        <button onClick={() => file.current?.click()}>Open workspace…</button>
        <button className="primary" onClick={() => download(new Blob([json], { type: 'application/json' }), 'lambda-workspace.json')}>Download .json</button>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return <button onClick={() => navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1200); }).catch(() => {})}>{ok ? 'Copied' : 'Copy'}</button>;
}
