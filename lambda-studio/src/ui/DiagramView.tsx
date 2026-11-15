import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { type Diagram, type Segment, type DiagramStyle } from '../core/diagram/layout';
import { segmentRect } from '../core/diagram/svg';
import { type Term, type Path } from '../core/term';
import { type ColorMode, COLOR_MODES, segmentColor } from '../core/diagram/colors';
import { useStore, currentTerm } from './store';
import { type View, fitView, layoutSafe, stepMorph, morphFrame, paint, highlightColors } from './render';
import { useExport } from './ExportDialog';
import { findRedex } from '../core/reduce';
import { useIsDark } from './theme';

const SVG_LIMIT = 12000; // segments; above this we draw on a canvas without hover
const ANIM_LIMIT = 5000; // segments (before + after) for the step animation

export { segmentColor };

export function useDiagram(term: Term | null, style: DiagramStyle): Diagram | null {
  return useMemo(() => (term ? layoutSafe(term, style) : null), [term, style]);
}


export function DiagramView() {
  const term = useStore(currentTerm);
  const settings = useStore((s) => s.settings);
  const hover = useStore((s) => s.hover);
  const hoverSource = useStore((s) => s.hoverSource);
  const setHover = useStore((s) => s.setHover);
  const reduceAt = useStore((s) => s.reduceAt);
  const dark = useIsDark();
  const diagram = useDiagram(term, settings.diagramStyle);
  const history = useStore((s) => s.history);
  const index = useStore((s) => s.index);
  const playing = useStore((s) => s.playing);
  const animRef = useRef<HTMLCanvasElement>(null);
  const [animating, setAnimating] = useState(false);
  const shown = useRef<{ index: number; term: Term | null; diagram: Diagram | null; view: View } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  const [autoFit, setAutoFit] = useState(true);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);

  const redex = useMemo(() => (term && settings.showRedex ? findRedex(term, settings) : null), [term, settings]);
  const useCanvas = !!diagram && diagram.segments.length > SVG_LIMIT;

  const fit = useCallback(() => {
    const el = wrap.current;
    if (!el || !diagram) return;
    setView(fitView(diagram, el.clientWidth, el.clientHeight));
  }, [diagram]);

  useEffect(() => { if (autoFit) fit(); }, [diagram, autoFit, fit]);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { if (autoFit) fit(); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoFit, fit]);

  // Animate a single β-step: morph the previous diagram into the new one on a canvas overlay.
  useEffect(() => {
    const prev = shown.current;
    const el = wrap.current, c = animRef.current;
    const entry = history[index];
    const newView = autoFit && el && diagram ? fitView(diagram, el.clientWidth, el.clientHeight) : view;
    shown.current = { index, term, diagram, view: newView };
    if (!settings.animate || !prev || !el || !c || !diagram || !prev.diagram || useCanvas) return;
    if (index !== prev.index + 1 || entry?.via?.kind !== 'beta' || entry.via.path === undefined || history[index - 1]?.term !== prev.term) return;
    if (prev.diagram.segments.length + diagram.segments.length > ANIM_LIMIT) return;
    const duration = playing ? Math.min(700, 850 / settings.playSpeed) : 700;
    if (duration < 120 || document.hidden) return;
    const m = stepMorph(prev.term!, entry.via.path, prev.diagram, diagram, prev.view, newView, settings.colorMode, dark);
    if (!m) return;
    const dpr = window.devicePixelRatio || 1;
    const W = el.clientWidth, H = el.clientHeight;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d')!;
    const hl = settings.showRedex ? highlightColors(dark) : null;
    const t0 = performance.now();
    let raf = 0;
    setAnimating(true);
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      paint(ctx, [], null, c.width, c.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const r of morphFrame(m, t, hl)) {
        ctx.globalAlpha = r.alpha; ctx.fillStyle = r.color;
        ctx.fillRect(r.x, r.y, Math.max(r.w, 1), Math.max(r.h, 1));
      }
      ctx.globalAlpha = 1;
      if (t < 1) raf = requestAnimationFrame(tick); else setAnimating(false);
    };
    raf = requestAnimationFrame(tick);
    // requestAnimationFrame pauses in background tabs: never leave the diagram hidden
    const failsafe = window.setTimeout(() => { cancelAnimationFrame(raf); setAnimating(false); }, duration + 300);
    return () => { cancelAnimationFrame(raf); clearTimeout(failsafe); setAnimating(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, diagram]);

  useEffect(() => { if (shown.current && shown.current.diagram === diagram) shown.current.view = view; }, [view, diagram]);

  // Base layer as an HTML string (fast for thousands of rects).
  const baseHtml = useMemo(() => {
    if (!diagram || useCanvas) return '';
    const parts: string[] = [];
    diagram.segments.forEach((s, i) => {
      const r = segmentRect(s);
      parts.push(`<rect data-i="${i}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${segmentColor(s, settings.colorMode, dark)}"/>`);
    });
    return parts.join('');
  }, [diagram, settings.colorMode, dark, useCanvas]);

  // Canvas fallback for huge diagrams.
  useEffect(() => {
    if (!useCanvas || !diagram || !canvasRef.current || !wrap.current) return;
    const c = canvasRef.current, el = wrap.current;
    const dpr = window.devicePixelRatio || 1;
    c.width = el.clientWidth * dpr; c.height = el.clientHeight * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.tx, dpr * view.ty);
    ctx.clearRect(-1e6, -1e6, 2e6, 2e6);
    for (const s of diagram.segments) {
      ctx.fillStyle = segmentColor(s, settings.colorMode, dark);
      const r = segmentRect(s);
      ctx.fillRect(r.x, r.y, r.w, Math.max(r.h, 1 / view.scale));
    }
  }, [useCanvas, diagram, view, settings.colorMode, dark]);

  // Overlay highlights: hovered subtree and next redex.
  const overlay = useMemo(() => {
    if (!diagram || useCanvas) return [] as { s: Segment; cls: string }[];
    const out: { s: Segment; cls: string }[] = [];
    if (redex !== null) {
      const fnPath = redex + 'f', argPath = redex + 'a';
      for (const s of diagram.segments) {
        if (s.kind === 'app' && s.path === redex) out.push({ s, cls: 'hl-link' });
        else if ((s.kind === 'lam' && s.path === fnPath) || (s.kind === 'var' && s.binder === fnPath)) out.push({ s, cls: 'hl-fn' });
        else if (s.path.startsWith(argPath)) out.push({ s, cls: 'hl-arg' });
      }
    }
    if (hover !== null) {
      const hoveredSeg = hoverSource === 'diagram' ? diagram.segments.find((s) => s.path === hover) : undefined;
      for (const s of diagram.segments) {
        let on: boolean;
        if (hoveredSeg?.kind === 'lam') on = s.path === hover || s.binder === hover; // λ and the variables it binds
        else if (hoveredSeg?.kind === 'var') on = s.path === hover || (s.kind === 'lam' && s.path === hoveredSeg.binder); // variable and its λ
        else on = s.path.startsWith(hover); // application / text hover: the whole subterm
        if (on) out.push({ s, cls: 'hl-hover' });
      }
    }
    return out;
  }, [diagram, redex, hover, hoverSource, useCanvas]);

  const segAt = (e: React.MouseEvent): Segment | null => {
    const el = e.target as Element;
    const i = el.getAttribute?.('data-i');
    return i !== null && i !== undefined && diagram ? diagram.segments[Number(i)] ?? null : null;
  };

  // Ctrl/⌘ + wheel (and trackpad pinch) zooms; a plain wheel scrolls the page.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setAutoFit(false);
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const k = Math.exp(-e.deltaY * 0.004);
      setView((v) => {
        const scale = Math.max(0.02, Math.min(200, v.scale * k));
        const f = scale / v.scale;
        return { scale, tx: mx - (mx - v.tx) * f, ty: my - (my - v.ty) * f };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const hoveredSegment = hover !== null && diagram ? diagram.segments.find((s) => s.path === hover) : undefined;

  return (
    <div className="panel diagram-panel">
      <div className="panel-head">
        <h2>Tromp diagram</h2>
        <div className="toolbar">
          <select aria-label="Diagram style" value={settings.diagramStyle} onChange={(e) => useStore.getState().setSetting('diagramStyle', e.target.value as DiagramStyle)} title="Standard: lines for every variable reach the bottom. Alternative: Tromp's compact style, applications link right next to their parts.">
            <option value="standard">Standard</option>
            <option value="alternative">Alternative</option>
          </select>
          <select aria-label="Colour mode" value={settings.colorMode} onChange={(e) => useStore.getState().setSetting('colorMode', e.target.value as ColorMode)}>
            {COLOR_MODES.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <label className="check" title="Animate single β-steps"><input type="checkbox" checked={settings.animate} onChange={(e) => useStore.getState().setSetting('animate', e.target.checked)} /> Animate</label>
          <label className="check"><input type="checkbox" checked={settings.showRedex} onChange={(e) => useStore.getState().setSetting('showRedex', e.target.checked)} /> Next redex</label>
          <button onClick={() => { setAutoFit(true); fit(); }} title="Fit to view">Fit</button>
          <button onClick={() => { setAutoFit(false); setView((v) => ({ ...v, scale: v.scale * 1.25 })); }} title="Zoom in">+</button>
          <button onClick={() => { setAutoFit(false); setView((v) => ({ ...v, scale: v.scale / 1.25 })); }} title="Zoom out">−</button>
          <button onClick={() => useExport.getState().show('diagram')} disabled={!diagram}>Export…</button>
        </div>
      </div>
      <div
        className="diagram-wrap"
        ref={wrap}
        onMouseDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false }; }}
        onMouseMove={(e) => {
          const d = drag.current;
          if (d && e.buttons === 1) {
            const dx = e.clientX - d.x, dy = e.clientY - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) { d.moved = true; setAutoFit(false); }
            if (d.moved) { setView((v) => ({ ...v, tx: d.tx + dx, ty: d.ty + dy })); return; }
          }
          const s = segAt(e);
          setHover(s ? s.path : null, 'diagram');
        }}
        onMouseUp={() => { setTimeout(() => { drag.current = null; }, 0); }}
        onMouseLeave={() => { drag.current = null; setHover(null); }}
        onDoubleClick={(e) => {
          const s = segAt(e);
          if (!s) return;
          // double-click an application link (or anything inside a redex's function) to reduce it
          let p: Path | null = s.kind === 'app' ? s.path : s.kind === 'lam' && s.path.endsWith('f') ? s.path.slice(0, -1) : null;
          if (p === null && s.kind === 'var' && s.binder?.endsWith('f')) p = s.binder.slice(0, -1);
          if (p !== null) reduceAt(p);
        }}
      >
        {!diagram && <div className="empty">No term to draw.</div>}
        {diagram && !useCanvas && (
          <svg className="diagram-svg" width="100%" height="100%" style={animating ? { visibility: 'hidden' } : undefined}>
            <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`} shapeRendering="crispEdges">
              <g dangerouslySetInnerHTML={{ __html: baseHtml }} />
              <g className="overlay" pointerEvents="none">
                {overlay.map(({ s, cls }, k) => { const r = segmentRect(s); return <rect key={k} className={cls} x={r.x} y={r.y} width={r.w} height={r.h} />; })}
              </g>
            </g>
          </svg>
        )}
        {diagram && useCanvas && <canvas ref={canvasRef} className="diagram-canvas" />}
        <canvas ref={animRef} className="diagram-canvas" style={{ pointerEvents: 'none', visibility: animating ? 'visible' : 'hidden' }} />
        {diagram && (
          <div className="diagram-info">
            {diagram.width}×{diagram.height - diagram.top} px · {diagram.segments.length} lines
            {useCanvas && ' · large term: hover disabled'}
            {hoveredSegment && <> · {describeSeg(hoveredSegment)}</>}
          </div>
        )}
        {redex !== null && diagram && !useCanvas && (
          <div className="legend">
            <span className="sw hl-fn" /> function λ and its variables <span className="sw hl-arg" /> argument <span className="sw hl-link" /> application · double-click a link to reduce · drag to pan · Ctrl+wheel to zoom
          </div>
        )}
      </div>
    </div>
  );
}

function describeSeg(s: Segment): string {
  if (s.kind === 'lam') return 'λ abstraction';
  if (s.kind === 'app') return 'application';
  return s.binder == null ? 'free variable' : `variable (de Bruijn ${s.index})`;
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
