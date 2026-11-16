// Simple type inference (Hindley–Milner without let, i.e. the simply typed λ-calculus à la
// Curry): every untyped term gets its principal type, or a reason why it has none.
// The Curry–Howard view reads the type as a proposition of implicational logic.

import { type Term } from './term';

export type Type = { k: 'var'; id: number } | { k: 'fun'; from: Type; to: Type };

export class TypeError_ extends Error {}

export interface Inferred { type: Type; text: string; prop: string; vars: number; size: number }
export type InferResult = { ok: true; value: Inferred } | { ok: false; reason: string };

const MAX_TYPE_NODES = 4000;

export function inferType(t: Term): InferResult {
  const parent: (Type | null)[] = []; // union-find over type variables: bound to a type or null
  const fresh = (): Type => { parent.push(null); return { k: 'var', id: parent.length - 1 }; };
  const resolve = (ty: Type): Type => {
    while (ty.k === 'var' && parent[ty.id]) ty = parent[ty.id]!;
    return ty;
  };
  const occurs = (id: number, ty: Type): boolean => {
    const stack = [ty];
    let seen = 0;
    while (stack.length) {
      const x = resolve(stack.pop()!);
      if (++seen > 1_000_000) throw new TypeError_('Type too large');
      if (x.k === 'var') { if (x.id === id) return true; }
      else stack.push(x.from, x.to);
    }
    return false;
  };
  const unify = (a0: Type, b0: Type) => {
    const work: [Type, Type][] = [[a0, b0]];
    while (work.length) {
      const [x, y] = work.pop()!.map(resolve) as [Type, Type];
      if (x === y) continue;
      if (x.k === 'var' && y.k === 'var' && x.id === y.id) continue;
      if (x.k === 'var') { if (occurs(x.id, y)) throw new TypeError_('occurs'); parent[x.id] = y; continue; }
      if (y.k === 'var') { if (occurs(y.id, x)) throw new TypeError_('occurs'); parent[y.id] = x; continue; }
      work.push([x.from, y.from], [x.to, y.to]);
    }
  };
  const freeTypes = new Map<string, Type>();
  // recursive inference over an explicit context list (de Bruijn: index i = ctx[len-1-i]); very deep
  // terms are turned away before this runs ("Term too deep to type")
  const infer = (t: Term, ctx: Type[]): Type => {
    switch (t.tag) {
      case 'var': {
        const ty = ctx[ctx.length - 1 - t.i];
        if (!ty) throw new TypeError_('unbound index');
        return ty;
      }
      case 'free': {
        let ty = freeTypes.get(t.name);
        if (!ty) { ty = fresh(); freeTypes.set(t.name, ty); }
        return ty;
      }
      case 'lam': {
        const a = fresh();
        ctx.push(a);
        const b = infer(t.body, ctx);
        ctx.pop();
        return { k: 'fun', from: a, to: b };
      }
      case 'app': {
        const f = infer(t.fn, ctx);
        const x = infer(t.arg, ctx);
        const r = fresh();
        unify(f, { k: 'fun', from: x, to: r });
        return r;
      }
    }
  };
  let ty: Type;
  try { ty = infer(t, []); } catch (e) {
    if (e instanceof TypeError_) {
      return { ok: false, reason: e.message === 'occurs' ? 'Not simply typable: some variable would need an infinite type (like a = a → b), as in self-application x x.' : e.message };
    }
    if (e instanceof RangeError) return { ok: false, reason: 'Term too deep to type.' };
    throw e;
  }
  // zonk and rename variables a, b, c … in order of appearance
  const names = new Map<number, number>();
  let nodes = 0;
  const zonk = (ty: Type): Type => {
    if (++nodes > MAX_TYPE_NODES) throw new TypeError_('big');
    const r = resolve(ty);
    if (r.k === 'var') { if (!names.has(r.id)) names.set(r.id, names.size); return { k: 'var', id: names.get(r.id)! }; }
    return { k: 'fun', from: zonk(r.from), to: zonk(r.to) };
  };
  try { ty = zonk(ty); } catch { return { ok: false, reason: `Typable, but the type has more than ${MAX_TYPE_NODES} parts.` }; }
  return { ok: true, value: { type: ty, text: typeText(ty, letter), prop: typeText(ty, (i) => letter(i).toUpperCase(), '⇒'), vars: names.size, size: nodes } };
}

const letter = (i: number) => String.fromCharCode(97 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : '');

export function typeText(t: Type, name: (i: number) => string = letter, arrow = '→'): string {
  if (t.k === 'var') return name(t.id);
  const left = t.from.k === 'fun' ? `(${typeText(t.from, name, arrow)})` : typeText(t.from, name, arrow);
  return `${left} ${arrow} ${typeText(t.to, name, arrow)}`;
}

/** LaTeX for the type (Greek letters, as in textbooks). */
export function typeTex(t: Type): string {
  const GREEK = ['\\alpha', '\\beta', '\\gamma', '\\delta', '\\varepsilon', '\\zeta', '\\eta', '\\theta', '\\iota', '\\kappa', '\\mu', '\\nu', '\\xi', '\\pi', '\\rho', '\\sigma', '\\tau', '\\phi', '\\chi', '\\psi', '\\omega'];
  const name = (i: number) => (i < GREEK.length ? GREEK[i] : `\\alpha_{${i}}`);
  const go = (t: Type): string => {
    if (t.k === 'var') return name(t.id);
    const l = t.from.k === 'fun' ? `(${go(t.from)})` : go(t.from);
    return `${l} \\to ${go(t.to)}`;
  };
  return go(t);
}
