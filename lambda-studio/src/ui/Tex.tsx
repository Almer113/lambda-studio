// KaTeX rendering (lazy-loaded) with two-way hover linking via \htmlData{p=r<path>} tags.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Path } from '../core/term';
import { pathFromElement } from '../core/formats/latex';

type Katex = typeof import('katex');
let katexPromise: Promise<Katex> | null = null;
let katexLoaded: Katex | null = null;

function loadKatex(): Promise<Katex> {
  if (!katexPromise) {
    katexPromise = Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([m]) => {
      // the ESM build exposes the API as its default export
      const k = ((m as unknown as { default?: Katex }).default ?? m) as Katex;
      katexLoaded = k;
      return k;
    });
  }
  return katexPromise;
}

export function useKatex(): Katex | null {
  const [k, setK] = useState<Katex | null>(katexLoaded);
  useEffect(() => { if (!k) loadKatex().then(setK).catch(() => {}); }, [k]);
  return k;
}

/** Above this many characters of LaTeX, rendering is skipped (slow, and unreadable anyway). */
export const TEX_LIMIT = 40000;

export function renderTex(katex: Katex, tex: string, display = false): string {
  return katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    strict: 'ignore',
    output: 'html',
    trust: (ctx: { command: string }) => ctx.command === '\\htmlData',
    maxExpand: 1000,
  });
}

interface Props {
  tex: string;
  className?: string;
  /** Paths to highlight; the closest tagged ancestor path is used when a path has no tag. */
  hover?: Path | null;
  redex?: Path | null;
  onHover?: (p: Path | null) => void;
  onDoubleClick?: (p: Path) => void;
  /** Selected subterm (highlighted) and a click handler to select one. */
  selected?: Path | null;
  onSelect?: (p: Path | null) => void;
  display?: boolean;
}

export function TexView({ tex, className, hover = null, redex = null, onHover, onDoubleClick, selected = null, onSelect, display }: Props) {
  const katex = useKatex();
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => (katex && tex.length <= TEX_LIMIT ? renderTex(katex, tex, display) : null), [katex, tex, display]);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll('.tx-hover, .tx-redex, .tx-select').forEach((e) => e.classList.remove('tx-hover', 'tx-redex', 'tx-select'));
    const find = (p: Path | null): Element | null => {
      if (p === null) return null;
      for (let q = p; ; q = q.slice(0, -1)) {
        const el = root.querySelector(`[data-p="r${q}"]`);
        if (el) return el;
        if (q === '') return null;
      }
    };
    find(redex)?.classList.add('tx-redex');
    find(hover)?.classList.add('tx-hover');
    find(selected)?.classList.add('tx-select');
  }, [html, hover, redex, selected]);

  if (tex.length > TEX_LIMIT) return <div className="empty">Too large to typeset ({tex.length.toLocaleString()} characters of LaTeX). Switch to text.</div>;
  if (!html) return <div className="empty">Loading typesetter…</div>;
  return (
    <div
      ref={ref}
      className={`tex ${className ?? ''}`}
      onMouseMove={onHover ? (e) => onHover(pathFromElement(e.target as Element, ref.current!)) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onClick={onSelect ? (e) => { if (e.detail > 1) return; const p = pathFromElement(e.target as Element, ref.current!); onSelect(p === selected ? null : p); } : undefined}
      onDoubleClick={onDoubleClick ? (e) => { const p = pathFromElement(e.target as Element, ref.current!); if (p !== null) onDoubleClick(p); } : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Small "TeX | Text" switch. */
export function ViewToggle({ tex, onChange, title }: { tex: boolean; onChange: (tex: boolean) => void; title?: string }) {
  return (
    <span className="seg" role="group" aria-label={title ?? 'View'}>
      <button className={tex ? 'on' : ''} onClick={() => onChange(true)} title="Typeset with KaTeX">TeX</button>
      <button className={!tex ? 'on' : ''} onClick={() => onChange(false)} title="Plain text">Text</button>
    </span>
  );
}
