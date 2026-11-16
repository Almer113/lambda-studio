// Help dialog, global keyboard shortcuts (including keyboard navigation of the selected
// subterm) and a screen-reader announcer.

import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { useStore, currentTerm } from './store';
import { getAt, size } from '../core/term';
import { printNamed } from '../core/formats/named';
import { useTutorial } from './Tutorial';
import { X, Keyboard, BookOpen, Languages } from 'lucide-react';
import { TabList, TabPanel, type TabDef } from './Tabs';
import { Markdown } from './Markdown';
import GUIDE from '../../docs/USER_GUIDE.md?raw';
import FORMATS_DOC from '../../docs/FORMATS.md?raw';
import { IconButton } from './IconButton';

export const useHelp = create<{ open: boolean; set(v: boolean): void }>((set) => ({ open: false, set: (open) => set({ open }) }));

const SHORTCUTS: [string, string][] = [
  ['\\', 'Type λ in the editor (\\lambda in LaTeX input)'],
  ['Ctrl + Enter', 'Run to normal form'],
  ['Alt + → / Alt + ←', 'Step forward / back (in the editor on a Mac: Ctrl + Option + arrows)'],
  ['Double-click', 'Reduce the redex under the pointer (text, TeX or diagram)'],
  ['Click', 'Select a subterm for editing (click again to clear)'],
  ['↑ ↓ ← →', 'With a selection (not on a button or field): parent, first child, previous / next sibling'],
  ['Enter', 'With a selection (not on a button or field): β-reduce it if it is a redex'],
  ['Delete', 'With a selection (not on a button or field): remove that side of an application'],
  ['Esc', 'Clear the selection, close dialogs'],
  ['Ctrl + wheel, pinch', 'Zoom the diagram; drag to pan'],
  ['?', 'This help'],
];

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const typing = (el: Element | null) => !!el && (el.closest('input, textarea, select, [contenteditable="true"], .cm-editor, math-field') !== null);
/**
 * The term-navigation keys (arrows, Enter, Delete) act on the selection only when nothing else
 * has focus or the diagram has it: on a button, link, tab or field they keep their usual meaning.
 */
const onTerm = (el: Element | null) => !el || el === document.body || el.closest('.diagram-wrap') !== null;
/** Modal dialogs (Help, Export) handle their own keys; Esc closes them natively. */
const modalOpen = () => document.querySelector('dialog[open]') !== null;

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || modalOpen()) return;
      const st = useStore.getState();
      const active = document.activeElement;
      // in a form field Alt+arrows are left to the field, but must not leave the page (browser Back)
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && typing(active) && !IS_MAC) { e.preventDefault(); return; }
      if (e.altKey && e.key === 'ArrowRight' && !typing(active)) { e.preventDefault(); st.stepForward(); return; }
      if (e.altKey && e.key === 'ArrowLeft' && !typing(active)) { e.preventDefault(); st.stepBack(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !typing(active)) { e.preventDefault(); st.runToNormal(); return; }
      if (typing(active) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '?') { e.preventDefault(); useHelp.getState().set(true); return; }
      const sel = st.selected;
      const term = currentTerm(st);
      if (e.key === 'Escape') {
        if (sel !== null) st.select(null);
        else if (useTutorial.getState().open) useTutorial.getState().set({ open: false });
        return;
      }
      if (!term || !onTerm(active)) return;
      const inDiagram = !!active?.closest('.diagram-wrap');
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
  // errors are announced by the status line itself (role="alert"): saying them here too repeats them
  useEffect(() => { if (message && message.tone !== 'error') setText(message.text); }, [message]);
  return <div className="sr-only" aria-live="polite" role="status">{text}</div>;
}

type HelpTab = 'basics' | 'guide' | 'formats';
const HELP_TABS: TabDef<HelpTab>[] = [
  { id: 'basics', label: 'Basics', icon: Keyboard },
  { id: 'guide', label: 'User guide', icon: BookOpen },
  { id: 'formats', label: 'Notations', icon: Languages },
];

export function Help() {
  const { open, set } = useHelp();
  const [tab, setTab] = useState<HelpTab>('basics');
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
            <div className="export-head">
              <h2 id="help-title">Help</h2>
              <TabList<HelpTab> tabs={HELP_TABS} value={tab} onChange={setTab} label="Help sections" idPrefix="help" className="export-tabs" />
              <IconButton icon={X} className="close" label="Close" onClick={() => set(false)} />
            </div>
            <TabPanel idPrefix="help" value={tab} className="help-body">
            {tab === 'guide' && <Markdown text={GUIDE} skipTitle />}
            {tab === 'formats' && <Markdown text={FORMATS_DOC} skipTitle />}
            {tab === 'basics' && <>
            <p>Type a λ-term in the <b>Source</b> editor (or paste one in another notation: it is detected), then step through its reduction and watch the Tromp diagram. New here? Open the <button className="linklike" onClick={() => { set(false); useTutorial.getState().set({ open: true }); }}>tutorial</button>.</p>
            <h3>Keyboard and mouse</h3>
            <table className="shortcuts"><tbody>{SHORTCUTS.map(([k, d]) => <tr key={k}><th><kbd>{k}</kbd></th><td>{d}</td></tr>)}</tbody></table>
            <h3>Syntax</h3>
            <p><code>λx y.M</code> or <code>\x y -&gt; M</code> · application <code>f x y</code> = <code>(f x) y</code> · definitions <code>NAME = term</code> (recursive definitions are compiled with Y) · numbers are Church numerals · <code>[1, 2]</code> lists · <code>"text"</code> strings · <code>let x = M in N</code> · comments <code>--</code>.</p>
            <p className="muted">The full guide and the notation reference are in the other two tabs.</p>
            <h3>Settings</h3>
            <p>Settings are kept in this browser; the gear button in the header changes them. <button onClick={() => { useStore.getState().replaceSettings(); useStore.setState({ message: { text: 'Settings were reset to their defaults.', tone: 'info' } }); set(false); }}>Reset settings</button> <span className="muted">(your source is kept)</span></p>
            </>}
            </TabPanel>
          </div>
        )}
      </dialog>
    </>
  );
}
