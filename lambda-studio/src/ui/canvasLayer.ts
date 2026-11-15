// Canvas rendering for diagrams too large for SVG: one Path2D per colour, a bitmap level of
// detail when zoomed out, and a grid index so hover and selection still work.

import { type Diagram, type Segment } from '../core/diagram/layout';
import { segmentRect } from '../core/diagram/svg';

export function colorPaths(d: Diagram, color: (s: Segment) => string): [string, Path2D][] {
  const m = new Map<string, Path2D>();
  for (const s of d.segments) {
    const c = color(s);
    let p = m.get(c);
    if (!p) { p = new Path2D(); m.set(c, p); }
    const r = segmentRect(s);
    p.rect(r.x, r.y, r.w, r.h);
  }
  return [...m];
}

/** The diagram at one pixel per unit (null when it would be too big). Downscaling it averages lines into tones. */
export function bitmapOf(d: Diagram, color: (s: Segment) => string, maxPixels = 16_000_000): HTMLCanvasElement | null {
  const w = d.width, h = d.height - d.top;
  if (w <= 0 || h <= 0 || w * h > maxPixels || w > 16384 || h > 16384) return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.translate(0, -d.top);
  for (const [col, p] of colorPaths(d, color)) { ctx.fillStyle = col; ctx.fill(p); }
  return c;
}

/** Uniform grid over segment rectangles for point queries. */
export class SegmentIndex {
  private cells = new Map<number, number[]>();
  private readonly size: number;
  constructor(private d: Diagram, size = 16) {
    this.size = size;
    d.segments.forEach((s, i) => {
      const r = segmentRect(s);
      for (let cx = Math.floor(r.x / size); cx <= Math.floor((r.x + r.w) / size); cx++)
        for (let cy = Math.floor(r.y / size); cy <= Math.floor((r.y + r.h) / size); cy++) {
          const k = cx * 1_000_003 + cy;
          const b = this.cells.get(k);
          if (b) b.push(i); else this.cells.set(k, [i]);
        }
    });
  }
  /** The segment nearest to (x, y) within `tol` diagram units, preferring the thinnest match. */
  at(x: number, y: number, tol: number): Segment | null {
    let best: Segment | null = null, bestD = Infinity;
    const s = this.size;
    for (let cx = Math.floor((x - tol) / s); cx <= Math.floor((x + tol) / s); cx++)
      for (let cy = Math.floor((y - tol) / s); cy <= Math.floor((y + tol) / s); cy++) {
        for (const i of this.cells.get(cx * 1_000_003 + cy) ?? []) {
          const r = segmentRect(this.d.segments[i]);
          const dx = Math.max(r.x - x, 0, x - (r.x + r.w)), dy = Math.max(r.y - y, 0, y - (r.y + r.h));
          const dist = Math.hypot(dx, dy);
          if (dist <= tol && dist < bestD) { best = this.d.segments[i]; bestD = dist; }
        }
      }
    return best;
  }
}
