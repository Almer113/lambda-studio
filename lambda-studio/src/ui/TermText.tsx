// Read-only printed term with two-way hover linking to the diagram.

import { useMemo, useRef } from 'react';
import { type Path, getAt, size } from '../core/term';
import { printNamed, type Printed } from '../core/formats/named';
import { useStore, currentTerm } from './store';
import { redexKindAt } from '../core/reduce';

/** Above this many folded names the text is left plain. */
const MAX_FOLDS = 3000;

interface Props { printed: Printed; redex: Path | null; maxHighlight?: number }

export function TermText({ printed, redex, maxHighlight = 30000 }: Props) {
  const hover = useStore((s) => s.hover);
  const setHover = useStore((s) => s.setHover);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const ref = useRef<HTMLPreElement>(null);
  const { text, spans } = printed;

  // smallest span containing each offset is found by scanning (spans are few enough)
  const spanOf = (p: Path | null) => {
    if (p === null) return null;
    for (let q = p; ; q = q.slice(0, -1)) {
      const s = spans.find((x) => x.path === q);
      if (s) return s;
      if (q === '') return null;
    }
  };
  const hl = spanOf(hover);
  const rx = redex !== null ? spans.find((x) => x.path === redex) ?? null : null;
  const sel = spanOf(selected);

  // names and numerals that stand for a longer term are styled, with the term in a tooltip
  const folds = useMemo(() => (printed.folds && printed.folds.length <= MAX_FOLDS ? printed.folds : []), [printed]);
  const runs = useMemo(() => {
    if (text.length > maxHighlight) return [{ from: 0, to: text.length, cls: '', fold: null }];
    const cuts = new Set<number>([0, text.length]);
    for (const s of [hl, rx, sel]) if (s) { cuts.add(s.from); cuts.add(s.to); }
    for (const f of folds) { cuts.add(f.from); cuts.add(f.to); }
    const pts = [...cuts].sort((a, b) => a - b);
    const out: { from: number; to: number; cls: string; fold: Path | null }[] = [];
    let fi = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      while (fi < folds.length && folds[fi].to <= a) fi++;
      const f = fi < folds.length && folds[fi].from <= a && b <= folds[fi].to ? folds[fi] : null;
      const cls = [f ? 'tx-fold' : '', rx && a >= rx.from && b <= rx.to ? 'tx-redex' : '', hl && a >= hl.from && b <= hl.to ? 'tx-hover' : '', sel && a >= sel.from && b <= sel.to ? 'tx-select' : ''].join(' ').trim();
      out.push({ from: a, to: b, cls, fold: f?.path ?? null });
    }
    return out;
  }, [text, hl, rx, sel, maxHighlight, folds]);
  const term = useStore(currentTerm);
  const expansion = (p: Path) => {
    if (!term) return undefined;
    try {
      const sub = getAt(term, p);
      return size(sub) > 300 ? `stands for a term of ${size(sub)} nodes` : `stands for ${printNamed(sub).text}`;
    } catch { return undefined; }
  };

  const pathAtOffset = (off: number): Path | null => {
    let best: { path: Path; len: number } | null = null;
    for (const s of spans) if (off >= s.from && off < s.to && (!best || s.to - s.from < best.len)) best = { path: s.path, len: s.to - s.from };
    return best?.path ?? null;
  };

  const offsetFromEvent = (e: React.MouseEvent): number | null => {
    const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
    let node: Node | null = null, off = 0;
    if (doc.caretPositionFromPoint) { const p = doc.caretPositionFromPoint(e.clientX, e.clientY); if (p) { node = p.offsetNode; off = p.offset; } }
    else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(e.clientX, e.clientY); if (r) { node = r.startContainer; off = r.startOffset; } }
    if (!node || !ref.current?.contains(node)) return null;
    const el = node.parentElement?.closest('[data-from]');
    if (!el) return null;
    return Number(el.getAttribute('data-from')) + off;
  };

  return (
    <pre
      ref={ref}
      className="term-text"
      onMouseMove={(e) => { const o = offsetFromEvent(e); setHover(o === null ? null : pathAtOffset(o), 'text'); }}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => { if (e.detail > 1) return; const o = offsetFromEvent(e); const p = o === null ? null : pathAtOffset(o); select(p === selected ? null : p); }}
      onDoubleClick={(e) => { const o = offsetFromEvent(e); if (o !== null) reduceInnermost(pathAtOffset(o)); }}
    >
      {runs.map((r) => <span key={r.from} data-from={r.from} className={r.cls || undefined} title={r.fold !== null ? expansion(r.fold) : undefined}>{text.slice(r.from, r.to)}</span>)}
    </pre>
  );
}

/** Reduce the innermost redex (beta, or eta when enabled) at or above `p` in the current term. */
export function reduceInnermost(p: Path | null) {
  const st = useStore.getState();
  const term = currentTerm(st);
  if (!term) return;
  while (p !== null) {
    try { if (redexKindAt(term, p, st.settings.eta)) { st.reduceAt(p); return; } } catch { /* folded path */ }
    if (p === '') break;
    p = p.slice(0, -1);
  }
}
