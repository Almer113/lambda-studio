// Standalone SVG export of a Tromp diagram.

import { type Diagram, type Segment } from './layout';

export interface SvgOptions {
  scale?: number;
  padding?: number;
  foreground?: string;
  background?: string | null;
  color?: (s: Segment) => string | null;
}

export function segmentRect(s: Segment) {
  return { x: s.x1, y: s.y1, w: s.x2 - s.x1 + 1, h: s.y2 - s.y1 + 1 };
}

export function toSVG(d: Diagram, opts: SvgOptions = {}): string {
  const scale = opts.scale ?? 8, pad = opts.padding ?? 2;
  const fg = opts.foreground ?? '#111';
  const w = d.width + 2 * pad, h = d.height - d.top + 2 * pad;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="${-pad} ${d.top - pad} ${w} ${h}" shape-rendering="crispEdges">`);
  if (opts.background) parts.push(`<rect x="${-pad}" y="${d.top - pad}" width="${w}" height="${h}" fill="${opts.background}"/>`);
  for (const s of d.segments) {
    const r = segmentRect(s);
    const c = opts.color?.(s) ?? fg;
    parts.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${c}"/>`);
  }
  parts.push('</svg>');
  return parts.join('');
}
