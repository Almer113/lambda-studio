// Short confirmations that do not move the layout (e.g. "Inserted PLUS" while the editor is on
// another tab on a phone).

import { create } from 'zustand';
import { useStore } from './store';

interface ToastState { text: string | null; id: number; show(text: string): void }

let timer = 0;
export const useToast = create<ToastState>((set, get) => ({
  text: null, id: 0,
  show(text) {
    window.clearTimeout(timer);
    set({ text, id: get().id + 1 });
    timer = window.setTimeout(() => set({ text: null }), 2200);
  },
}));

export function Toast() {
  const { text, id } = useToast();
  return <div className="toast-region" role="status" aria-live="polite">{text && <div key={id} className="toast">{text}</div>}</div>;
}

/**
 * Insert text into the source editor. When the editor is out of sight (on a phone it is on
 * another tab), a toast confirms that something happened.
 */
export function insertIntoSource(text: string, what: string) {
  const insert = useStore.getState().insertText;
  if (!insert) return;
  insert(text);
  const ed = document.querySelector('.editor-panel') as HTMLElement | null;
  const r = ed?.getBoundingClientRect();
  const visible = !!ed && ed.offsetParent !== null && !!r && r.bottom > 0 && r.top < window.innerHeight;
  if (!visible) useToast.getState().show(`Inserted ${what} into the source`);
}
