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

  // A loop over an explicit stack of frames (not recursion): terms can be far deeper than the call
  // stack. `ret` carries a finished subdiagram back to its parent frame.
  interface Frame { n: Term; col: number; row: number; path: Path; st: number; bar?: Segment; f?: Box }
  const stack: Frame[] = [{ n: t, col: 0, row: 0, path: '', st: 0 }];
  let ret: Box = null!;
  while (stack.length) {
    const fr = stack[stack.length - 1];
    const n = fr.n;
    if (n.tag === 'var' || n.tag === 'free') {
      let top = -1;
      let binder: Path | null = null;
      if (n.tag === 'var' && n.i < binders.length) {
        const b = binders[binders.length - 1 - n.i];
        top = b.row; binder = b.path;
      } else hasFree = true;
      const seg: Segment = { kind: 'var', x1: 4 * fr.col + 1, x2: 4 * fr.col + 1, y1: top, y2: fr.row, path: fr.path, binder, index: n.tag === 'var' ? n.i : undefined };
      segments.push(seg);
      ret = { w: 1, h: 1, out: seg };
      stack.pop();
    } else if (n.tag === 'lam') {
      if (fr.st === 0) {
        const bar: Segment = { kind: 'lam', x1: 4 * fr.col, x2: 0, y1: fr.row, y2: fr.row, path: fr.path };
        segments.push(bar);
        binders.push({ row: fr.row, path: fr.path });
        fr.bar = bar; fr.st = 1;
        stack.push({ n: n.body, col: fr.col, row: fr.row + 2, path: fr.path + 'b', st: 0 });
      } else {
        const body = ret;
        binders.pop();
        fr.bar!.x2 = 4 * (fr.col + body.w) - 2;
        ret = { w: body.w, h: body.h + 2, out: body.out };
        stack.pop();
      }
    } else if (fr.st === 0) {
      fr.st = 1;
      stack.push({ n: n.fn, col: fr.col, row: fr.row, path: fr.path + 'f', st: 0 });
    } else if (fr.st === 1) {
      fr.f = ret; fr.st = 2;
      stack.push({ n: n.arg, col: fr.col + ret.w, row: fr.row, path: fr.path + 'a', st: 0 });
    } else {
      const f = fr.f!, a = ret, row = fr.row;
      // As in Tromp's AIT renderer: the link sits on the lower of the two sub-diagrams' last rows,
      // and the function's line continues two rows below it (the application's own 2 rows).
      const link = row + Math.max(f.h, a.h) - 1;
      a.out.y2 = link;
      segments.push({ kind: 'app', x1: f.out.x1, x2: a.out.x1, y1: link, y2: link, path: fr.path });
      f.out.y2 = link + 2;
      ret = { w: f.w + a.w, h: Math.max(f.h, a.h) + 2, out: f.out };
      stack.pop();
    }
  }

  const box = ret;
  return { width: 4 * box.w - 1, height: box.h, top: hasFree ? -1 : 0, segments, vars: box.w };
}

export type DiagramStyle = 'standard' | 'alternative';

/** Lay out a term in either style. */
export function layoutStyled(t: Term, style: DiagramStyle): Diagram {
  return style === 'alternative' ? layoutAlternative(t) : layout(t);
}

/**
 * Tromp's alternative style: a variable stops just above the row where it is used, and an
 * application links the *rightmost* anchor line of the function with the leftmost anchor line of
 * the argument, one row below the deeper of the two; no output line continues below a link.
 * The result is more compact (I is a single bar; ω looks like an upside-down Ω).
 */
export function layoutAlternative(t: Term): Diagram {
  const segments: Segment[] = [];
  let hasFree = false;
  const binders: { row: number; path: Path }[] = [];
  /** w: variable columns; bottom: last pixel row used; left/right: anchor lines */
  interface ABox { w: number; bottom: number; left: Segment; right: Segment }

  // explicit frame stack, as in layout()
  interface Frame { n: Term; col: number; row: number; path: Path; st: number; bar?: Segment; f?: ABox }
  const stack: Frame[] = [{ n: t, col: 0, row: 0, path: '', st: 0 }];
  let ret: ABox = null!;
  while (stack.length) {
    const fr = stack[stack.length - 1];
    const n = fr.n;
    if (n.tag === 'var' || n.tag === 'free') {
      let top = -1;
      let binder: Path | null = null;
      if (n.tag === 'var' && n.i < binders.length) {
        const b = binders[binders.length - 1 - n.i];
        top = b.row; binder = b.path;
      } else hasFree = true;
      const bottom = Math.max(top, fr.row - 2);
      const seg: Segment = { kind: 'var', x1: 4 * fr.col + 1, x2: 4 * fr.col + 1, y1: top, y2: bottom, path: fr.path, binder, index: n.tag === 'var' ? n.i : undefined };
      segments.push(seg);
      ret = { w: 1, bottom, left: seg, right: seg };
      stack.pop();
    } else if (n.tag === 'lam') {
      if (fr.st === 0) {
        const bar: Segment = { kind: 'lam', x1: 4 * fr.col, x2: 0, y1: fr.row, y2: fr.row, path: fr.path };
        segments.push(bar);
        binders.push({ row: fr.row, path: fr.path });
        fr.bar = bar; fr.st = 1;
        stack.push({ n: n.body, col: fr.col, row: fr.row + 2, path: fr.path + 'b', st: 0 });
      } else {
        const body = ret;
        binders.pop();
        fr.bar!.x2 = 4 * (fr.col + body.w) - 2;
        ret = { ...body, bottom: Math.max(body.bottom, fr.row) };
        stack.pop();
      }
    } else if (fr.st === 0) {
      fr.st = 1;
      stack.push({ n: n.fn, col: fr.col, row: fr.row, path: fr.path + 'f', st: 0 });
    } else if (fr.st === 1) {
      fr.f = ret; fr.st = 2;
      stack.push({ n: n.arg, col: fr.col + ret.w, row: fr.row, path: fr.path + 'a', st: 0 });
    } else {
      const f = fr.f!, a = ret;
      const link = Math.max(f.bottom, a.bottom) + 2;
      f.right.y2 = link;
      a.left.y2 = link;
      segments.push({ kind: 'app', x1: f.right.x1, x2: a.left.x1, y1: link, y2: link, path: fr.path });
      ret = { w: f.w + a.w, bottom: link, left: f.right, right: a.left };
      stack.pop();
    }
  }

  const box = ret;
  return { width: 4 * box.w - 1, height: box.bottom + 1, top: hasFree ? -1 : 0, segments, vars: box.w };
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
