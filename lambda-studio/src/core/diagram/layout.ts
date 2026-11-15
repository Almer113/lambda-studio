// Tromp lambda diagrams (standard style).
//
// Rules (https://tromp.github.io/cl/diagrams.html):
//   * every λ is a horizontal line spanning the width of its body,
//   * every variable is a vertical line hanging down from the λ that binds it,
//   * every application is a horizontal link joining the leftmost variable line of the function
//     to the leftmost variable line of the argument; the function's line continues downward.
//
// Geometry is in "pixel" units like Tromp's own renderer: each variable occupies a column 4 units
// wide (3 used + 1 gap), so width = 4·vars − 1; each λ / application adds 2 rows, a variable is
// 1 row, so height = 2·depth + 1.  The BLC size of a closed term equals
// 2·(number of lines) + (number of 4-way crossings).

import { type Term, type Path } from '../term';

export type SegmentKind = 'lam' | 'var' | 'app';

export interface Segment {
  kind: SegmentKind;
  /** Inclusive pixel coordinates. Horizontal: y1 === y2; vertical: x1 === x2. */
  x1: number; y1: number; x2: number; y2: number;
  /** Path of the term node that produced the segment (lam / var / app node). */
  path: Path;
  /** For var segments: path of the binding λ (null when free). */
  binder?: Path | null;
  /** De Bruijn index for var segments. */
  index?: number;
}

export interface Diagram {
  width: number;
  height: number;
  /** Topmost row (−1 when free variables stick out of the top). */
  top: number;
  segments: Segment[];
  vars: number;
}

interface Box { w: number; h: number; out: Segment }

export function layout(t: Term): Diagram {
  const segments: Segment[] = [];
  let hasFree = false;
  // binders: stack of { row, path } of enclosing λs (innermost last)
  const binders: { row: number; path: Path }[] = [];

  const go = (n: Term, col: number, row: number, path: Path): Box => {
    switch (n.tag) {
      case 'var':
      case 'free': {
        let top = -1;
        let binder: Path | null = null;
        if (n.tag === 'var' && n.i < binders.length) {
          const b = binders[binders.length - 1 - n.i];
          top = b.row; binder = b.path;
        } else hasFree = true;
        const seg: Segment = { kind: 'var', x1: 4 * col + 1, x2: 4 * col + 1, y1: top, y2: row, path, binder, index: n.tag === 'var' ? n.i : undefined };
        segments.push(seg);
        return { w: 1, h: 1, out: seg };
      }
      case 'lam': {
        const bar: Segment = { kind: 'lam', x1: 4 * col, x2: 0, y1: row, y2: row, path };
        segments.push(bar);
        binders.push({ row, path });
        const body = go(n.body, col, row + 2, path + 'b');
        binders.pop();
        bar.x2 = 4 * (col + body.w) - 2;
        return { w: body.w, h: body.h + 2, out: body.out };
      }
      case 'app': {
        const f = go(n.fn, col, row, path + 'f');
        const a = go(n.arg, col + f.w, row, path + 'a');
        const link = row + Math.max(f.h, a.h);
        a.out.y2 = link;
        segments.push({ kind: 'app', x1: f.out.x1, x2: a.out.x1, y1: link, y2: link, path });
        f.out.y2 = link + 1;
        return { w: f.w + a.w, h: Math.max(f.h, a.h) + 2, out: f.out };
      }
    }
  };

  const box = go(t, 0, 0, '');
  return { width: 4 * box.w - 1, height: box.h, top: hasFree ? -1 : 0, segments, vars: box.w };
}

/** Number of 4-way crossings (a variable line passing through a λ bar it is not bound by). */
export function crossings(d: Diagram): number {
  const bars = d.segments.filter((s) => s.kind === 'lam');
  let n = 0;
  for (const s of d.segments) {
    if (s.kind !== 'var') continue;
    for (const b of bars) if (b.y1 > s.y1 && b.y1 <= s.y2 && s.x1 > b.x1 && s.x1 < b.x2) n++;
  }
  return n;
}

/** Pixel grid of the diagram (row-major, rows from `top`). */
export function rasterize(d: Diagram): { w: number; h: number; top: number; cells: Uint8Array } {
  const w = d.width, h = d.height - d.top, top = d.top;
  const cells = new Uint8Array(w * h);
  for (const s of d.segments)
    for (let y = s.y1; y <= s.y2; y++) for (let x = s.x1; x <= s.x2; x++) cells[(y - top) * w + x] = 1;
  return { w, h, top, cells };
}
