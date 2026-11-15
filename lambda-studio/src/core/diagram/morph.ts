// Smooth β-reduction animation.
//
// Every node of the term before a step gets a lineage id (its path). Through the step
// (λ.body) arg → body[arg], nodes outside the redex and nodes of the body keep their ids, every
// copy of the argument gets `<arg id>#k`, and the redex's application, its λ and the bound
// variable occurrences disappear. Diagram segments carry node paths, so segments can be matched
// across the step and tweened: matched segments move, argument copies fly out of the original
// argument, vanished segments fade out and new ones fade in.

import { type Term, type Path, getAt } from '../term';
import { type Diagram, type Segment } from './layout';
import { segmentRect } from './svg';

/** Lineage ids of the nodes of the term after a β-step at `redex`, by path in the new term. */
export function betaLineage(before: Term, redex: Path): Map<Path, string> {
  const after = new Map<Path, string>();
  const r = getAt(before, redex);
  if (r.tag !== 'app' || r.fn.tag !== 'lam') throw new Error('not a β-redex');
  const lamNode = r.fn;
  // outside the redex: unchanged paths (only ancestors' paths and siblings, which we enumerate lazily)
  const mapSame = (t: Term, p: Path) => {
    const stack: [Term, Path][] = [[t, p]];
    while (stack.length) {
      const [n, q] = stack.pop()!;
      if (q === redex) continue;
      after.set(q, q);
      if (n.tag === 'lam') stack.push([n.body, q + 'b']);
      else if (n.tag === 'app') stack.push([n.fn, q + 'f'], [n.arg, q + 'a']);
    }
  };
  mapSame(before, '');
  // the contractum: walk the body; bound occurrences become copies of the argument
  let copies = 0;
  const walkArg = (n: Term, srcPath: Path, dstPath: Path, k: number) => {
    after.set(dstPath, `${srcPath}#${k}`);
    if (n.tag === 'lam') walkArg(n.body, srcPath + 'b', dstPath + 'b', k);
    else if (n.tag === 'app') { walkArg(n.fn, srcPath + 'f', dstPath + 'f', k); walkArg(n.arg, srcPath + 'a', dstPath + 'a', k); }
  };
  const walkBody = (n: Term, srcPath: Path, dstPath: Path, depth: number) => {
    if (n.tag === 'var' && n.i === depth) { walkArg(r.arg, redex + 'a', dstPath, copies++); return; }
    after.set(dstPath, srcPath);
    if (n.tag === 'lam') walkBody(n.body, srcPath + 'b', dstPath + 'b', depth + 1);
    else if (n.tag === 'app') { walkBody(n.fn, srcPath + 'f', dstPath + 'f', depth); walkBody(n.arg, srcPath + 'a', dstPath + 'a', depth); }
  };
  walkBody(lamNode.body, redex + 'fb', redex, 0);
  return after;
}

export interface Rect { x: number; y: number; w: number; h: number }
export type Role = 'fn' | 'arg' | 'link' | null;

/** One animated rectangle. */
export interface MorphItem {
  from: Rect | null;
  to: Rect | null;
  /** colour before / after the step */
  colorFrom: string;
  colorTo: string;
  /** part of the redex (highlighted at the start of the animation) */
  role: Role;
}

export interface Morph { items: MorphItem[]; bounds: { x: number; y: number; w: number; h: number } }

const segId = (s: Segment, id: string) => `${s.kind}:${id}`;

/**
 * Pair up the segments of the diagrams before and after a β-step at `redex`.
 * `color` gives the resting colour of a segment in its own diagram.
 */
export interface Placement { before?: (r: Rect) => Rect; after?: (r: Rect) => Rect }

export function buildMorph(before: Diagram, after: Diagram, termBefore: Term, redex: Path, color: (s: Segment, which: 'before' | 'after') => string, place: Placement = {}): Morph {
  const pb = (s: Segment) => (place.before ? place.before(segmentRect(s)) : segmentRect(s));
  const pa = (s: Segment) => (place.after ? place.after(segmentRect(s)) : segmentRect(s));
  const lineage = betaLineage(termBefore, redex);
  const byId = new Map<string, Segment>();
  for (const s of before.segments) byId.set(segId(s, s.path), s);
  const used = new Set<string>();
  const fnPath = redex + 'f', argPath = redex + 'a';
  const roleOf = (s: Segment): Role =>
    s.kind === 'app' && s.path === redex ? 'link'
      : (s.kind === 'lam' && s.path === fnPath) || (s.kind === 'var' && s.binder === fnPath) ? 'fn'
        : s.path.startsWith(argPath) ? 'arg' : null;

  const items: MorphItem[] = [];
  for (const a of after.segments) {
    const id = lineage.get(a.path);
    let src: Segment | undefined;
    if (id !== undefined) {
      const base = id.replace(/#\d+$/, '');
      src = byId.get(segId(a, base));
      if (src) used.add(segId(a, base)); // matched (argument copies all start from the original)
    }
    items.push({
      from: src ? pb(src) : null,
      to: pa(a),
      colorFrom: src ? color(src, 'before') : color(a, 'after'),
      colorTo: color(a, 'after'),
      role: src ? roleOf(src) : null,
    });
  }
  for (const b of before.segments) {
    if (used.has(segId(b, b.path))) continue;
    items.push({ from: pb(b), to: null, colorFrom: color(b, 'before'), colorTo: color(b, 'before'), role: roleOf(b) });
  }
  const y0 = Math.min(before.top, after.top);
  return { items, bounds: { x: 0, y: y0, w: Math.max(before.width, after.width), h: Math.max(before.height, after.height) - y0 } };
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Timeline of one step: highlight (0–0.25), vanish (0.15–0.5), move (0.25–0.9), appear (0.6–1). */
export interface FrameRect extends Rect { color: string; alpha: number }

export function morphFrame(m: Morph, t: number, highlight: { fn: string; arg: string; link: string } | null): FrameRect[] {
  const out: FrameRect[] = [];
  const move = ease(clamp((t - 0.25) / 0.65));
  const hl = clamp(t / 0.15) * (1 - clamp((t - 0.6) / 0.3)); // highlight on, then back to normal colours
  for (const it of m.items) {
    const base = it.role && highlight ? highlight[it.role] : null;
    if (it.from && it.to) {
      const r = lerpRect(it.from, it.to, move);
      out.push({ ...r, color: base && hl > 0.5 ? base : move > 0.5 ? it.colorTo : it.colorFrom, alpha: 1 });
    } else if (it.from) {
      const a = 1 - clamp((t - 0.15) / 0.35);
      if (a > 0) out.push({ ...it.from, color: base && hl > 0.3 ? base : it.colorFrom, alpha: a });
    } else if (it.to) {
      const a = clamp((t - 0.6) / 0.4);
      if (a > 0) out.push({ ...it.to, color: it.colorTo, alpha: a });
    }
  }
  return out;
}

function lerpRect(a: Rect, b: Rect, u: number): Rect {
  const l = (p: number, q: number) => p + (q - p) * u;
  return { x: l(a.x, b.x), y: l(a.y, b.y), w: l(a.w, b.w), h: l(a.h, b.h) };
}

/** Draw a frame on a 2D canvas context (transform already set to diagram units). */
export function drawFrame(ctx: CanvasRenderingContext2D, rects: FrameRect[], minPixel: number) {
  for (const r of rects) {
    ctx.globalAlpha = r.alpha;
    ctx.fillStyle = r.color;
    ctx.fillRect(r.x, r.y, Math.max(r.w, minPixel), Math.max(r.h, minPixel));
  }
  ctx.globalAlpha = 1;
}
