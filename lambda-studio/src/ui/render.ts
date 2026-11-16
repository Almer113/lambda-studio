// Drawing helpers shared by the on-screen animation and the GIF / WebM exports.

import { type Term, type Path } from '../core/term';
import { type Diagram, type DiagramStyle, layoutStyled } from '../core/diagram/layout';
import { segmentRect } from '../core/diagram/svg';
import { type ColorMode, segmentColor, HIGHLIGHT } from '../core/diagram/colors';
import { type Rect, type FrameRect, buildMorph, morphFrame, type Morph } from '../core/diagram/morph';

export interface View { scale: number; tx: number; ty: number }

/** View that fits a diagram into a W×H box, centred (whole-pixel scale when ≥ 2). */
export function fitView(d: Diagram, W: number, H: number, pad = 4, maxScale = 16, align: 'center' | 'top' = 'center'): View {
  const dw = d.width + pad, dh = d.height - d.top + pad;
  let scale = Math.max(0.02, Math.min(maxScale, Math.min(W / dw, H / dh)));
  if (scale >= 2) scale = Math.floor(scale);
  const ty = align === 'top' ? Math.min((H - (d.height + d.top) * scale) / 2, (pad / 2 - d.top) * scale + 12) : (H - (d.height + d.top) * scale) / 2;
  return { scale, tx: (W - d.width * scale) / 2, ty };
}

export const placeIn = (v: View) => (r: Rect): Rect => ({ x: r.x * v.scale + v.tx, y: r.y * v.scale + v.ty, w: r.w * v.scale, h: r.h * v.scale });

/** Rects of a still diagram in screen space. */
export function stillFrame(d: Diagram, v: View, mode: ColorMode, dark: boolean): FrameRect[] {
  const place = placeIn(v);
  return d.segments.map((s) => ({ ...place(segmentRect(s)), color: segmentColor(s, mode, dark), alpha: 1 }));
}

/** Morph of one β-step in screen space; null if `redex` is not a β-redex of `before`. */
export function stepMorph(before: Term, redex: Path, dBefore: Diagram, dAfter: Diagram, vBefore: View, vAfter: View, mode: ColorMode, dark: boolean): Morph | null {
  try {
    return buildMorph(dBefore, dAfter, before, redex, (s) => segmentColor(s, mode, dark), { before: placeIn(vBefore), after: placeIn(vAfter) });
  } catch { return null; }
}

export const highlightColors = (dark: boolean) => (dark ? HIGHLIGHT.dark : HIGHLIGHT.light);

export { morphFrame };

export function paint(ctx: CanvasRenderingContext2D, rects: FrameRect[], background: string | null, W: number, H: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, W, H); }
  for (const r of rects) {
    ctx.globalAlpha = r.alpha;
    ctx.fillStyle = r.color;
    // snap to whole pixels when the scale is large enough, keep at least 1px
    ctx.fillRect(r.x, r.y, Math.max(r.w, 1), Math.max(r.h, 1));
  }
  ctx.globalAlpha = 1;
}

export function layoutSafe(t: Term, style: DiagramStyle): Diagram | null {
  try { return layoutStyled(t, style); } catch { return null; }
}
