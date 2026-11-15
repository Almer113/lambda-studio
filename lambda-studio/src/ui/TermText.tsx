// Read-only printed term with two-way hover linking to the diagram.

import { useMemo, useRef } from 'react';
import type { Path } from '../core/term';
import type { Printed } from '../core/formats/named';
import { useStore, currentTerm } from './store';
import { redexKindAt } from '../core/reduce';

interface Props { printed: Printed; redex: Path | null; maxHighlight?: number }

export function TermText({ printed, redex, maxHighlight = 30000 }: Props) {
  const hover = useStore((s) => s.hover);
  const setHover = useStore((s) => s.setHover);
  const reduceAt = useStore((s) => s.reduceAt);
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

  const runs = useMemo(() => {
    if (text.length > maxHighlight) return [{ from: 0, to: text.length, cls: '' }];
    const cuts = new Set<number>([0, text.length]);
    for (const s of [hl, rx]) if (s) { cuts.add(s.from); cuts.add(s.to); }
    const pts = [...cuts].sort((a, b) => a - b);
    const out: { from: number; to: number; cls: string }[] = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      const cls = [rx && a >= rx.from && b <= rx.to ? 'tx-redex' : '', hl && a >= hl.from && b <= hl.to ? 'tx-hover' : ''].join(' ').trim();
      out.push({ from: a, to: b, cls });
    }
    return out;
  }, [text, hl, rx, maxHighlight]);

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
      onDoubleClick={(e) => {
        const o = offsetFromEvent(e);
        if (o === null) return;
        // reduce the innermost redex (application of a λ) containing the click
        const st = useStore.getState();
        const term = currentTerm(st);
        if (!term) return;
        let p = pathAtOffset(o);
        while (p !== null) {
          try { if (redexKindAt(term, p, st.settings.eta)) { reduceAt(p); return; } } catch { /* folded path */ }
          if (p === '') break;
          p = p.slice(0, -1);
        }
      }}
    >
      {runs.map((r) => <span key={r.from} data-from={r.from} className={r.cls || undefined}>{text.slice(r.from, r.to)}</span>)}
    </pre>
  );
}
