import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { type Diagram, type Segment, type DiagramStyle } from '../core/diagram/layout';
import { segmentRect } from '../core/diagram/svg';
import { type Term, type Path, size } from '../core/term';
import { colorPaths, bitmapOf, SegmentIndex } from './canvasLayer';
import { type ColorMode, COLOR_MODES, segmentColor } from '../core/diagram/colors';
import { useStore, currentTerm, useNextRedex } from './store';
import { type View, fitView, layoutSafe, stepMorph, morphFrame, paint, highlightColors } from './render';
import { useExport } from './ExportDialog';
import { DEF_MIME, preludeOrUserTerm } from './dnd';
import { useIsDark } from './theme';
import { NoTerm } from './NoTerm';
import { Film, Crosshair, Scan, ZoomIn, ZoomOut, ImageDown } from 'lucide-react';
import { IconButton } from './IconButton';

const SVG_LIMIT = 6000; // segments; above this the diagram is drawn on a canvas
const DRAW_LIMIT = 1_500_000; // term nodes; above this we do not lay the diagram out
const ANIM_LIMIT = 5000; // segments (before + after) for the step animation

export { segmentColor };

export function useDiagram(term: Term | null, style: DiagramStyle): Diagram | null {
  return useMemo(() => (term && size(term) <= DRAW_LIMIT ? layoutSafe(term, style) : null), [term, style]);
}


/** The segments lit up by hovering `path`: a λ with the variables it binds, a variable with its λ,
 *  otherwise the whole subterm. Cached per diagram, so moving back and forth costs nothing. */
const hoverCache = new WeakMap<Diagram, Map<string, Segment[]>>();
function hoverSet(d: Diagram, path: string, source: string | null): Segment[] {
  const key = (source === 'diagram' ? 'd:' : 't:') + path;
  let m = hoverCache.get(d);
  if (!m) { m = new Map(); hoverCache.set(d, m); }
  const hit = m.get(key);
  if (hit) return hit;
  const seg = source === 'diagram' ? d.segments.find((s) => s.path === path) : undefined;
  const out: Segment[] = [];
  for (const s of d.segments) {
    let on: boolean;
    if (seg?.kind === 'lam') on = s.path === path || s.binder === path;
    else if (seg?.kind === 'var') on = s.path === path || (s.kind === 'lam' && s.path === seg.binder);
    else on = s.path.startsWith(path);
    if (on) out.push(s);
  }
  if (m.size > 256) m.clear();
  m.set(key, out);
  return out;
}

export function DiagramView() {
  const term = useStore(currentTerm);
  const settings = useStore((s) => s.settings);
  const hover = useStore((s) => s.hover);
  const hoverSource = useStore((s) => s.hoverSource);
  const setHover = useStore((s) => s.setHover);
  const reduceAt = useStore((s) => s.reduceAt);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const [dropAt, setDropAt] = useState<Segment | null>(null);
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
  const hoverCanvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  const [autoFit, setAutoFit] = useState(true);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  /** The segment under the first click of a possible double-click (the page may move in between). */
  const firstClick = useRef<{ seg: Segment | null; at: number } | null>(null);

  const next = useNextRedex();
  const redex = settings.showRedex ? next : null;
  const useCanvas = !!diagram && diagram.segments.length > SVG_LIMIT;

  const fit = useCallback(() => {
    const el = wrap.current;
    if (!el || !diagram) return;
    // on a phone a wide diagram sits at the top of its box, not in the middle of blank space
    setView(fitView(diagram, el.clientWidth, el.clientHeight, 4, 16, innerWidth < 640 ? 'top' : 'center'));
  }, [diagram]);

  /** Zoom the buttons apply: about the centre of the view (not the top-left corner). */
  const zoomBy = (k: number) => {
    const el = wrap.current;
    const cx = (el?.clientWidth ?? 0) / 2, cy = (el?.clientHeight ?? 0) / 2;
    setAutoFit(false);
    setView((v) => {
      const scale = Math.max(0.02, Math.min(200, v.scale * k));
      const f = scale / v.scale;
      return { scale, tx: cx - (cx - v.tx) * f, ty: cy - (cy - v.ty) * f };
    });
  };

  // With auto-fit off the zoom is kept, but a new diagram that would be entirely out of view is fitted.
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    if (autoFit) { fit(); return; }
    const el = wrap.current;
    if (!el || !diagram) return;
    const v = viewRef.current;
    const x0 = v.tx, y0 = v.ty + diagram.top * v.scale, x1 = v.tx + diagram.width * v.scale, y1 = v.ty + diagram.height * v.scale;
    if (x1 < 0 || y1 < 0 || x0 > el.clientWidth || y0 > el.clientHeight) fit();
  }, [diagram, autoFit, fit]);
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
    if (duration < 120 || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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

  // Canvas for huge diagrams: colour-batched paths, a bitmap when zoomed out, highlights on top.
  const canvasData = useMemo(() => {
    if (!useCanvas || !diagram) return null;
    const color = (s: Segment) => segmentColor(s, settings.colorMode, dark);
    return { paths: colorPaths(diagram, color), bitmap: bitmapOf(diagram, color), index: new SegmentIndex(diagram) };
  }, [useCanvas, diagram, settings.colorMode, dark]);
  useEffect(() => {
    if (!canvasData || !diagram || !canvasRef.current || !wrap.current) return;
    const c = canvasRef.current, el = wrap.current;
    const dpr = window.devicePixelRatio || 1;
    c.width = el.clientWidth * dpr; c.height = el.clientHeight * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.tx, dpr * view.ty);
    if (canvasData.bitmap && view.scale * dpr < 1) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvasData.bitmap, 0, diagram.top);
    } else {
      for (const [col, p] of canvasData.paths) { ctx.fillStyle = col; ctx.fill(p); }
    }
    // the selection, drawn at least one screen pixel wide (hover has its own canvas)
    const minPx = 1 / (view.scale * dpr);
    const css = getComputedStyle(el);
    if (selected !== null) {
      const inSel = (s: Segment) => s.path.startsWith(selected);
      if (selected !== '') {
        // dim the rest: a veil of the background colour, then the selection again on top
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = css.getPropertyValue('--diagram-bg').trim() || '#fff';
        ctx.fillRect(-view.tx / view.scale, -view.ty / view.scale, el.clientWidth / view.scale, el.clientHeight / view.scale);
        ctx.globalAlpha = 1;
        for (const s of diagram.segments) if (inSel(s)) { ctx.fillStyle = segmentColor(s, settings.colorMode, dark); const r = segmentRect(s); ctx.fillRect(r.x, r.y, Math.max(r.w, minPx), Math.max(r.h, minPx)); }
      }
      const b = boundsOf(diagram.segments.filter(inSel));
      if (b) {
        ctx.strokeStyle = css.getPropertyValue('--accent').trim() || '#5b4bd6';
        ctx.lineWidth = 1.5 / view.scale;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }
    }
  }, [canvasData, diagram, view, selected, settings.colorMode, dark]);

  // The hovered subterm on its own transparent canvas: a hover change repaints only these rectangles.
  const hoverSegs = useMemo(() => {
    if (!diagram || hover === null) return [] as Segment[];
    return hoverSet(diagram, hover, hoverSource);
  }, [diagram, hover, hoverSource]);
  useEffect(() => {
    const c = hoverCanvasRef.current, el = wrap.current;
    if (!canvasData || !c || !el) return;
    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth * dpr, h = el.clientHeight * dpr;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (!hoverSegs.length) return;
    ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.tx, dpr * view.ty);
    const minPx = 1 / (view.scale * dpr);
    ctx.fillStyle = getComputedStyle(el).getPropertyValue('--hl-hover').trim() || 'orange';
    // only what is on screen (diagram coordinates of the visible area)
    const x0 = -view.tx / view.scale, y0 = -view.ty / view.scale, x1 = x0 + el.clientWidth / view.scale, y1 = y0 + el.clientHeight / view.scale;
    for (const s of hoverSegs) {
      const r = segmentRect(s);
      if (r.x > x1 || r.y > y1 || r.x + r.w < x0 || r.y + r.h < y0) continue;
      ctx.fillRect(r.x, r.y, Math.max(r.w, minPx), Math.max(r.h, minPx));
    }
  }, [canvasData, view, hoverSegs]);

  // The next redex glows under the lines, so the lines keep their own colours on top.
  const halo = useMemo(() => {
    if (!diagram || useCanvas || redex === null) return [] as { s: Segment; cls: string }[];
    const out: { s: Segment; cls: string }[] = [];
    const fnPath = redex + 'f', argPath = redex + 'a';
    for (const s of diagram.segments) {
      if (s.kind === 'app' && s.path === redex) out.push({ s, cls: 'hl-link' });
      else if ((s.kind === 'lam' && s.path === fnPath) || (s.kind === 'var' && s.binder === fnPath)) out.push({ s, cls: 'hl-fn' });
      else if (s.path.startsWith(argPath)) out.push({ s, cls: 'hl-arg' });
    }
    return out;
  }, [diagram, redex, useCanvas]);
  // The selection: the rest of the diagram is dimmed and the selected part boxed.
  const selection = useMemo(() => {
    if (!diagram || useCanvas || selected === null) return null;
    const segs = diagram.segments.filter((s) => s.path.startsWith(selected));
    return { segs: selected === '' ? [] : segs, box: boundsOf(segs), dim: selected !== '' };
  }, [diagram, useCanvas, selected]);
  const overlay = useMemo(() => {
    if (!diagram || useCanvas || !dropAt) return [] as { s: Segment; cls: string }[];
    return diagram.segments.filter((s) => s.path.startsWith(dropAt.path)).map((s) => ({ s, cls: 'hl-drop' }));
  }, [diagram, useCanvas, dropAt]);

  const segAt = (e: React.MouseEvent | React.DragEvent): Segment | null => {
    if (canvasData && wrap.current) {
      const r = wrap.current.getBoundingClientRect();
      const x = (e.clientX - r.left - view.tx) / view.scale, y = (e.clientY - r.top - view.ty) / view.scale;
      return canvasData.index.at(x, y, Math.max(0.5, 4 / view.scale));
    }
    const el = e.target as Element;
    const i = el.getAttribute?.('data-i');
    return i !== null && i !== undefined && diagram ? diagram.segments[Number(i)] ?? null : null;
  };

  // Touch: one finger pans, two fingers pinch-zoom around their midpoint.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let last: { x: number; y: number; d: number } | null = null;
    const read = (t: TouchList) => {
      const r = el.getBoundingClientRect();
      if (t.length === 1) return { x: t[0].clientX - r.left, y: t[0].clientY - r.top, d: 0 };
      const x = (t[0].clientX + t[1].clientX) / 2 - r.left, y = (t[0].clientY + t[1].clientY) / 2 - r.top;
      return { x, y, d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) };
    };
    const start = (e: TouchEvent) => { last = read(e.touches); };
    const move = (e: TouchEvent) => {
      if (!last || e.touches.length > 2) return;
      e.preventDefault();
      const cur = read(e.touches);
      const k = e.touches.length === 2 && last.d > 0 && cur.d > 0 ? cur.d / last.d : 1;
      const prev = last;
      setAutoFit(false);
      setView((v) => {
        const scale = Math.max(0.02, Math.min(200, v.scale * k));
        const f = scale / v.scale;
        return { scale, tx: cur.x - (prev.x - v.tx) * f, ty: cur.y - (prev.y - v.ty) * f };
      });
      last = cur;
    };
    const end = (e: TouchEvent) => { last = e.touches.length ? read(e.touches) : null; };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move); el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end); };
  }, []);

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
          <IconButton icon={Film} className="toggle" label="Animate single β-steps" pressed={settings.animate} onClick={() => useStore.getState().setSetting('animate', !settings.animate)} />
          <IconButton icon={Crosshair} className="toggle" label="Highlight the next redex" pressed={settings.showRedex} onClick={() => useStore.getState().setSetting('showRedex', !settings.showRedex)} />
          <span className="tb-sep" aria-hidden />
          <IconButton icon={Scan} className="toggle" label="Fit the diagram to the view" pressed={autoFit} onClick={() => { setAutoFit(true); fit(); }} />
          <IconButton icon={ZoomIn} label="Zoom in" shortcut="Ctrl+wheel" onClick={() => zoomBy(1.25)} />
          <IconButton icon={ZoomOut} label="Zoom out" onClick={() => zoomBy(1 / 1.25)} />
          <IconButton icon={ImageDown} label="Export the diagram" onClick={() => useExport.getState().show('diagram')} disabled={!diagram} />
        </div>
      </div>
      <div
        className="diagram-wrap"
        ref={wrap}
        tabIndex={0}
        role="group"
        aria-roledescription="interactive diagram"
        aria-label={diagram ? `Tromp diagram, ${diagram.segments.length} lines. Press an arrow key to select the term, then arrows to move through it.` : 'Tromp diagram'}
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
        onClick={(e) => {
          if (drag.current?.moved || e.detail > 1) return;
          const s = segAt(e);
          firstClick.current = { seg: s, at: e.timeStamp };
          select(s ? (s.path === selected ? null : s.path) : null);
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(DEF_MIME)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const i = el?.getAttribute('data-i');
          setDropAt(canvasData ? segAt(e) : i != null && diagram ? diagram.segments[Number(i)] ?? null : null);
        }}
        onDragLeave={() => setDropAt(null)}
        onDrop={(e) => {
          const name = e.dataTransfer.getData(DEF_MIME);
          const target = dropAt;
          setDropAt(null);
          if (!name || !target) return;
          e.preventDefault();
          const def = preludeOrUserTerm(name);
          if (def) useStore.getState().edit('replace', target.path, def);
        }}
        onMouseLeave={() => { drag.current = null; setHover(null); }}
        onDoubleClick={(e) => {
          // use what the first click hit: selecting it can change the layout around the diagram
          const first = firstClick.current;
          firstClick.current = null;
          const s = first && e.timeStamp - first.at < 1000 ? first.seg : segAt(e);
          if (!s) return;
          // double-click an application link (or anything inside a redex's function) to reduce it
          let p: Path | null = s.kind === 'app' ? s.path : s.kind === 'lam' && s.path.endsWith('f') ? s.path.slice(0, -1) : null;
          if (p === null && s.kind === 'var' && s.binder?.endsWith('f')) p = s.binder.slice(0, -1);
          if (p !== null) reduceAt(p);
        }}
      >
        {!diagram && (term
          ? <div className="empty">{size(term) > DRAW_LIMIT ? `Too large to draw (${size(term).toLocaleString('en')} nodes). The Inspector still has its statistics.` : 'This term could not be drawn.'}</div>
          : <NoTerm text="No term to draw." />)}
        {diagram && !useCanvas && (
          <svg className="diagram-svg" width="100%" height="100%" style={animating ? { visibility: 'hidden' } : undefined}>
            <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`} shapeRendering="crispEdges">
              <g className={selection?.dim ? 'dimmed' : undefined}>
                <g className="halo" pointerEvents="none">
                  {halo.map(({ s, cls }, k) => { const r = segmentRect(s); return <rect key={k} className={cls} x={r.x - HALO} y={r.y - HALO} width={r.w + 2 * HALO} height={r.h + 2 * HALO} rx={HALO} />; })}
                </g>
                <g dangerouslySetInnerHTML={{ __html: baseHtml }} />
              </g>
              <g className="overlay" pointerEvents="none">
                {selection?.segs.map((s, k) => { const r = segmentRect(s); return <rect key={'s' + k} x={r.x} y={r.y} width={r.w} height={r.h} fill={segmentColor(s, settings.colorMode, dark)} />; })}
                {selection?.box && <rect className="hl-select" x={selection.box.x} y={selection.box.y} width={selection.box.w} height={selection.box.h} rx={0.4} vectorEffect="non-scaling-stroke" />}
                {overlay.map(({ s, cls }, k) => { const r = segmentRect(s); return <rect key={k} className={cls} x={r.x} y={r.y} width={r.w} height={r.h} />; })}
                {hoverSegs.map((s, k) => { const r = segmentRect(s); return <rect key={'h' + k} className="hl-hover" x={r.x} y={r.y} width={r.w} height={r.h} />; })}
              </g>
            </g>
          </svg>
        )}
        {diagram && useCanvas && <canvas ref={canvasRef} className="diagram-canvas" />}
        {diagram && useCanvas && <canvas ref={hoverCanvasRef} className="diagram-canvas" style={{ pointerEvents: 'none' }} />}
        <canvas ref={animRef} className="diagram-canvas" style={{ pointerEvents: 'none', visibility: animating ? 'visible' : 'hidden' }} />
        {diagram && (
          <div className="diagram-info">
            {diagram.width}×{diagram.height - diagram.top} units · {diagram.segments.length} lines
            {useCanvas && ' · canvas renderer'}
            {hoveredSegment && <> · {describeSeg(hoveredSegment)}</>}
          </div>
        )}
        {dropAt && <div className="drop-hint">Drop to replace this {dropAt.kind === 'var' ? 'variable' : dropAt.kind === 'lam' ? 'abstraction' : 'application'}</div>}
      </div>
      {diagram && <Legend mode={settings.colorMode} redex={redex !== null && !useCanvas} />}
    </div>
  );
}

/** How far the redex glow reaches past a line, in diagram units (lines are 1 unit wide, 1 apart). */
const HALO = 0.45;

/** The box around some segments, with a little room. */
function boundsOf(segs: Segment[]): { x: number; y: number; w: number; h: number } | null {
  if (!segs.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of segs) { x0 = Math.min(x0, s.x1); y0 = Math.min(y0, s.y1); x1 = Math.max(x1, s.x2 + 1); y1 = Math.max(y1, s.y2 + 1); }
  const pad = 0.6;
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}

function describeSeg(s: Segment): string {
  if (s.kind === 'lam') return 'λ abstraction';
  if (s.kind === 'app') return 'application';
  return s.binder == null ? 'free variable' : `variable (de Bruijn ${s.index})`;
}


const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** What the colours mean in the current mode, the redex highlight, and how to interact. */
function Legend({ mode, redex }: { mode: ColorMode; redex: boolean }) {
  return (
    <div className="legend">
      {mode === 'binder' && <span>Each λ and the variables it binds share a colour; <span className="sw kind-app" /> applications are grey; <span className="sw kind-free" /> free variables are red.</span>}
      {mode === 'depth' && <span>Colour follows depth: the hue shifts with each enclosing λ.</span>}
      {mode === 'kind' && <span><span className="sw kind-lam" /> λ <span className="sw kind-app" /> application <span className="sw kind-var" /> bound variable <span className="sw kind-free" /> free variable</span>}
      {redex && <span>The next redex glows: <span className="sw glow hl-fn" /> its function λ and variables <span className="sw glow hl-arg" /> argument <span className="sw glow hl-link" /> application link</span>}
      <span className="legend-how">{COARSE ? 'Double-tap a link to reduce · drag to pan · pinch to zoom' : 'Double-click a link to reduce · drag to pan · Ctrl+wheel to zoom'}</span>
    </div>
  );
}
