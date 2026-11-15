// Help dialog, global keyboard shortcuts (including keyboard navigation of the selected
// subterm) and a screen-reader announcer.

import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { useStore, currentTerm } from './store';
import { getAt, size } from '../core/term';
import { printNamed } from '../core/formats/named';
import { useTutorial } from './Tutorial';

export const useHelp = create<{ open: boolean; set(v: boolean): void }>((set) => ({ open: false, set: (open) => set({ open }) }));

const SHORTCUTS: [string, string][] = [
  ['\\', 'Type λ in the editor (\\lambda in LaTeX input)'],
  ['Ctrl + Enter', 'Run to normal form'],
  ['Alt + → / Alt + ←', 'Step forward / back'],
  ['Double-click', 'Reduce the redex under the pointer (text, TeX or diagram)'],
  ['Click', 'Select a subterm for editing (click again to clear)'],
  ['↑ ↓ ← →', 'With a selection: parent, first child, previous / next sibling'],
  ['Enter', 'With a selection: β-reduce it if it is a redex'],
  ['Delete', 'With a selection: remove that side of an application'],
  ['Esc', 'Clear the selection, close dialogs'],
  ['Ctrl + wheel, pinch', 'Zoom the diagram; drag to pan'],
  ['?', 'This help'],
];

const typing = (el: Element | null) => !!el && (el.closest('input, textarea, select, [contenteditable="true"], .cm-editor, math-field') !== null);

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState();
      if (e.altKey && e.key === 'ArrowRight' && !typing(document.activeElement)) { e.preventDefault(); st.stepForward(); return; }
      if (e.altKey && e.key === 'ArrowLeft' && !typing(document.activeElement)) { e.preventDefault(); st.stepBack(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !typing(document.activeElement)) { e.preventDefault(); st.runToNormal(); return; }
      if (typing(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '?') { e.preventDefault(); useHelp.getState().set(true); return; }
      const sel = st.selected;
      const term = currentTerm(st);
      if (e.key === 'Escape') {
        if (useHelp.getState().open) useHelp.getState().set(false);
        else if (sel !== null) st.select(null);
        else if (useTutorial.getState().open) useTutorial.getState().set({ open: false });
        return;
      }
      if (!term) return;
      const inDiagram = !!document.activeElement?.closest('.diagram-wrap');
      if (sel === null) { if (inDiagram && e.key.startsWith('Arrow')) { e.preventDefault(); st.select(''); } return; }
      const valid = (p: string) => { try { getAt(term, p); return true; } catch { return false; } };
      let next: string | null = null;
      switch (e.key) {
        case 'ArrowUp': next = sel === '' ? null : sel.slice(0, -1); break;
        case 'ArrowDown': next = valid(sel + 'b') ? sel + 'b' : valid(sel + 'f') ? sel + 'f' : null; break;
        case 'ArrowRight': next = sel.endsWith('f') && valid(sel.slice(0, -1) + 'a') ? sel.slice(0, -1) + 'a' : null; break;
        case 'ArrowLeft': next = sel.endsWith('a') ? sel.slice(0, -1) + 'f' : null; break;
        case 'Enter': e.preventDefault(); st.edit('beta', sel); return;
        case 'Delete': case 'Backspace': e.preventDefault(); st.edit('delete', sel); return;
        default: return;
      }
      e.preventDefault();
      if (next !== null) st.select(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Announces the selection and status messages to screen readers. */
export function Announcer() {
  const selected = useStore((s) => s.selected);
  const term = useStore(currentTerm);
  const message = useStore((s) => s.message);
  const [text, setText] = useState('');
  useEffect(() => {
    if (!term || selected === null) return;
    try {
      const sub = getAt(term, selected);
      const kind = sub.tag === 'lam' ? 'abstraction' : sub.tag === 'app' ? 'application' : 'variable';
      setText(`Selected ${kind}: ${size(sub) < 60 ? printNamed(sub).text : `${size(sub)} nodes`}`);
    } catch { /* stale */ }
  }, [term, selected]);
  useEffect(() => { if (message) setText(message.text); }, [message]);
  return <div className="sr-only" aria-live="polite" role="status">{text}</div>;
}

export function Help() {
  const { open, set } = useHelp();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <>
      <Announcer />
      <dialog ref={ref} className="export-dialog help-dialog" onClose={() => set(false)} onClick={(e) => { if (e.target === ref.current) set(false); }} aria-labelledby="help-title">
        {open && (
          <div className="export-body">
            <div className="export-head"><h2 id="help-title">Help</h2><button className="close" onClick={() => set(false)} aria-label="Close">✕</button></div>
            <p>Type a λ-term in the <b>Source</b> editor (or paste one in another notation: it is detected), then step through its reduction and watch the Tromp diagram. New here? Open the <button className="linklike" onClick={() => { set(false); useTutorial.getState().set({ open: true }); }}>tutorial</button>.</p>
            <h3>Keyboard and mouse</h3>
            <table className="shortcuts"><tbody>{SHORTCUTS.map(([k, d]) => <tr key={k}><th><kbd>{k}</kbd></th><td>{d}</td></tr>)}</tbody></table>
            <h3>Syntax</h3>
            <p><code>λx y.M</code> or <code>\x y -&gt; M</code> · application <code>f x y</code> = <code>(f x) y</code> · definitions <code>NAME = term</code> (recursive definitions are compiled with Y) · numbers are Church numerals · <code>[1, 2]</code> lists · <code>"text"</code> strings · <code>let x = M in N</code> · comments <code>--</code>.</p>
            <p className="muted">The user guide and the format reference are in the <code>docs/</code> folder of the project.</p>
          </div>
        )}
      </dialog>
    </>
  );
}
