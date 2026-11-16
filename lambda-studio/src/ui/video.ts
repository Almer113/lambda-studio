// GIF and WebM exports of a reduction: every recorded step is morphed (β-steps) or cross-faded
// (other steps), with a hold on the first and last diagram.

import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { type Term, type Path } from '../core/term';
import { type Diagram, type DiagramStyle } from '../core/diagram/layout';
import { segmentRect } from '../core/diagram/svg';
import { type ColorMode, segmentColor } from '../core/diagram/colors';
import { type Morph, type MorphItem, morphFrame, type FrameRect } from '../core/diagram/morph';
import { type View, layoutSafe, placeIn, stepMorph, stillFrame, paint, highlightColors } from './render';

export interface VideoStep { term: Term; kind?: string; path?: Path }
export interface VideoOptions {
  style: DiagramStyle;
  mode: ColorMode;
  dark: boolean;
  background: string;
  /** largest side of the video in pixels */
  maxPx: number;
  secondsPerStep: number;
  /** seconds to hold the first and the last diagram */
  hold: number;
  fps: number;
  highlight: boolean;
}

/** A morph frame builds its step's morph on first use (shared by all frames of that step), so planning stays cheap. */
type Frame = { kind: 'still'; d: Diagram; v: View; ms: number } | { kind: 'morph'; m: () => Morph; t: number; ms: number };

export interface VideoPlan { W: number; H: number; frames: Frame[]; seconds: number }

export const MAX_VIDEO_SEGMENTS = 6000;

/** Lay out every term and work out the frame list. Throws if a diagram is too large. */
/** Layouts are kept per term and style, so changing the size, speed, colours or range re-uses them. */
const layouts = new WeakMap<Term, Map<DiagramStyle, Diagram | null>>();
function layoutCached(t: Term, style: DiagramStyle): Diagram | null {
  let m = layouts.get(t);
  if (!m) { m = new Map(); layouts.set(t, m); }
  if (!m.has(style)) m.set(style, layoutSafe(t, style));
  return m.get(style)!;
}

export function planVideo(steps: VideoStep[], o: VideoOptions): VideoPlan {
  const ds = steps.map((s) => layoutCached(s.term, o.style));
  if (ds.some((d) => !d)) throw new Error('Could not draw one of the terms.');
  const diagrams = ds as Diagram[];
  const big = diagrams.find((d) => d.segments.length > MAX_VIDEO_SEGMENTS);
  if (big) throw new Error(`A diagram has ${big.segments.length} lines; videos are limited to ${MAX_VIDEO_SEGMENTS}.`);
  const maxW = Math.max(...diagrams.map((d) => d.width)) + 4;
  const maxH = Math.max(...diagrams.map((d) => d.height - d.top)) + 4;
  let scale = o.maxPx / Math.max(maxW, maxH);
  if (scale >= 2) scale = Math.floor(scale);
  const even = (x: number) => Math.max(2, Math.ceil(x / 2) * 2);
  const W = even(maxW * scale), H = even(maxH * scale);
  const viewOf = (d: Diagram): View => ({ scale, tx: Math.round((W - d.width * scale) / 2), ty: Math.round((H - (d.height - d.top) * scale) / 2 - d.top * scale) });
  const views = diagrams.map(viewOf);

  const frames: Frame[] = [];
  const frameMs = 1000 / o.fps;
  frames.push({ kind: 'still', d: diagrams[0], v: views[0], ms: o.hold * 1000 });
  for (let k = 1; k < steps.length; k++) {
    const s = steps[k], prev = steps[k - 1], j = k;
    let built: Morph | null = null;
    const m = () => {
      if (built) return built;
      if (s.kind === 'beta' && s.path !== undefined) built = stepMorph(prev.term, s.path, diagrams[j - 1], diagrams[j], views[j - 1], views[j], o.mode, o.dark);
      return (built ??= crossfade(diagrams[j - 1], diagrams[j], views[j - 1], views[j], o.mode, o.dark));
    };
    const n = Math.max(2, Math.round((o.secondsPerStep * 1000) / frameMs));
    for (let i = 1; i <= n; i++) frames.push({ kind: 'morph', m, t: i / n, ms: frameMs });
    frames.push({ kind: 'still', d: diagrams[k], v: views[k], ms: k === steps.length - 1 ? o.hold * 1000 : frameMs * 2 });
  }
  return { W, H, frames, seconds: frames.reduce((a, f) => a + f.ms, 0) / 1000 };
}

function crossfade(a: Diagram, b: Diagram, va: View, vb: View, mode: ColorMode, dark: boolean): Morph {
  const pa = placeIn(va), pb = placeIn(vb);
  const items: MorphItem[] = [
    ...a.segments.map((s): MorphItem => ({ from: pa(segmentRect(s)), to: null, colorFrom: segmentColor(s, mode, dark), colorTo: segmentColor(s, mode, dark), role: null })),
    ...b.segments.map((s): MorphItem => ({ from: null, to: pb(segmentRect(s)), colorFrom: segmentColor(s, mode, dark), colorTo: segmentColor(s, mode, dark), role: null })),
  ];
  return { items, bounds: { x: 0, y: 0, w: 0, h: 0 } };
}

export function frameRects(f: Frame, o: VideoOptions): FrameRect[] {
  return f.kind === 'still' ? stillFrame(f.d, f.v, o.mode, o.dark) : morphFrame(f.m(), f.t, o.highlight ? highlightColors(o.dark) : null);
}

export interface Progress { (done: number, total: number): void }

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export async function encodeGif(plan: VideoPlan, o: VideoOptions, progress: Progress, signal: AbortSignal): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = plan.W; c.height = plan.H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const gif = GIFEncoder();
  // merge consecutive identical stills; GIF delays are in 10 ms units
  for (let i = 0; i < plan.frames.length; i++) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const f = plan.frames[i];
    paint(ctx, frameRects(f, o), o.background, plan.W, plan.H);
    const { data } = ctx.getImageData(0, 0, plan.W, plan.H);
    const palette = quantize(data, 64);
    gif.writeFrame(applyPalette(data, palette), plan.W, plan.H, { palette, delay: Math.max(20, Math.round(f.ms / 10) * 10), repeat: 0 });
    progress(i + 1, plan.frames.length);
    if (i % 3 === 0) await tick();
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

export const webmSupported = () => typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';

/** Records in real time (the video takes as long to make as to watch). */
export async function encodeWebm(plan: VideoPlan, o: VideoOptions, progress: Progress, signal: AbortSignal): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = plan.W; c.height = plan.H;
  const ctx = c.getContext('2d')!;
  paint(ctx, frameRects(plan.frames[0], o), o.background, plan.W, plan.H);
  const stream = c.captureStream(o.fps);
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<void>((r) => { rec.onstop = () => r(); });
  rec.start(250);
  try {
    let at = performance.now();
    for (let i = 0; i < plan.frames.length; i++) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const f = plan.frames[i];
      paint(ctx, frameRects(f, o), o.background, plan.W, plan.H);
      progress(i + 1, plan.frames.length);
      at += f.ms;
      await new Promise((r) => setTimeout(r, Math.max(0, at - performance.now())));
    }
  } finally {
    rec.stop();
    stream.getTracks().forEach((t) => t.stop());
  }
  await done;
  return new Blob(chunks, { type: 'video/webm' });
}
