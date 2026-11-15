// WYSIWYG math input (MathLive), lazy-loaded. It reuses KaTeX's fonts, which the TeX views
// already load, so MathLive's own font files are not needed.

import { useEffect, useRef, useState } from 'react';

type MathLive = typeof import('mathlive');
let loading: Promise<MathLive> | null = null;

function loadMathLive(): Promise<MathLive> {
  if (!loading) {
    loading = Promise.all([import('mathlive'), import('katex/dist/katex.min.css')]).then(([m]) => {
      m.MathfieldElement.fontsDirectory = null;
      m.MathfieldElement.soundsDirectory = null;
      return m;
    });
  }
  return loading;
}

type MathfieldEl = HTMLElement & { value: string; focus(): void };

export function MathField({ value, onChange, placeholder }: { value: string; onChange: (latex: string) => void; placeholder?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<MathfieldEl | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    loadMathLive().then(() => {
      if (!alive || !host.current) return;
      const mf = document.createElement('math-field') as MathfieldEl;
      mf.setAttribute('aria-label', 'Math input');
      if (placeholder) mf.setAttribute('placeholder', placeholder);
      mf.className = 'math-field';
      mf.value = value;
      mf.addEventListener('input', () => change.current(mf.value));
      host.current.appendChild(mf);
      field.current = mf;
      setState('ready');
    }).catch(() => alive && setState('error'));
    return () => { alive = false; field.current?.remove(); field.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { const mf = field.current; if (mf && mf.value !== value) mf.value = value; }, [value]);

  return (
    <div className="math-host" ref={host}>
      {state === 'loading' && <span className="muted">Loading the math editor…</span>}
      {state === 'error' && <span className="err">The math editor could not be loaded.</span>}
    </div>
  );
}
