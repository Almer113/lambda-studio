// Vector exports of Tromp diagrams for documents: TikZ (LaTeX) and Typst.
// One filled rectangle per line segment, in diagram pixel units scaled by `unit` points.

import { type Diagram, type Segment } from './layout';
import { segmentRect } from './svg';

export interface VectorOptions {
  /** Size of one diagram pixel in points. */
  unit?: number;
  color?: (s: Segment) => string;
  background?: string | null;
}

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();

export function toTikZ(d: Diagram, opts: VectorOptions = {}): string {
  const u = opts.unit ?? 2;
  const colors = new Map<string, string>();
  const name = (hex: string) => {
    let n = colors.get(hex);
    if (!n) { n = `lam${String.fromCharCode(97 + (colors.size % 26))}${colors.size >= 26 ? Math.floor(colors.size / 26) : ''}`; colors.set(hex, n); }
    return n;
  };
  const body: string[] = [];
  if (opts.background) body.push(`  \\fill[${name(opts.background)}] (-1,${fmt(d.top - 1)}) rectangle (${fmt(d.width + 1)},${fmt(d.height + 1)});`);
  for (const s of d.segments) {
    const r = segmentRect(s);
    body.push(`  \\fill[${name(opts.color?.(s) ?? '#000000')}] (${r.x},${r.y}) rectangle (${r.x + r.w},${r.y + r.h});`);
  }
  const defs = [...colors].map(([hex, n]) => `\\definecolor{${n}}{HTML}{${hex.replace('#', '').toUpperCase()}}`);
  return [
    '% Tromp diagram — needs \\usepackage{tikz}',
    ...defs,
    `\\begin{tikzpicture}[x=${fmt(u)}pt, y=-${fmt(u)}pt]`,
    ...body,
    '\\end{tikzpicture}',
  ].join('\n');
}

export function toTypst(d: Diagram, opts: VectorOptions = {}): string {
  const u = opts.unit ?? 2;
  const h = d.height - d.top;
  const lines: string[] = [];
  lines.push('// Tromp diagram (Typst)');
  lines.push(`#box(width: ${fmt(d.width * u)}pt, height: ${fmt(h * u)}pt${opts.background ? `, fill: rgb("${opts.background}")` : ''}, {`);
  for (const s of d.segments) {
    const r = segmentRect(s);
    lines.push(`  place(dx: ${fmt(r.x * u)}pt, dy: ${fmt((r.y - d.top) * u)}pt, rect(width: ${fmt(r.w * u)}pt, height: ${fmt(r.h * u)}pt, fill: rgb("${opts.color?.(s) ?? '#000000'}"), stroke: none))`);
  }
  lines.push('})');
  return lines.join('\n');
}
