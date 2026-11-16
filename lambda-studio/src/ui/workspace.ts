// Workspace files (source, input format and settings as JSON), and the file download helper.

import { useStore, type Settings } from './store';
import { FORMATS, type FormatId } from '../core/program';

export interface Workspace { app: 'lambda-studio'; version: 1; source: string; format: string; settings: Partial<Settings> }

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function workspaceJSON(): string {
  const { source, format, settings } = useStore.getState();
  const ws: Workspace = { app: 'lambda-studio', version: 1, source, format, settings };
  return JSON.stringify(ws, null, 2);
}

export function saveWorkspace() {
  download(new Blob([workspaceJSON()], { type: 'application/json' }), 'lambda-workspace.json');
}

/** Load a workspace file; throws an Error with a readable message. */
export async function openWorkspace(f: File): Promise<void> {
  let w: Partial<Workspace>;
  try { w = JSON.parse(await f.text()); } catch { throw new Error(`${f.name} is not a JSON file.`); }
  if (!w || w.app !== 'lambda-studio' || typeof w.source !== 'string') throw new Error(`${f.name} is not a Lambda Studio workspace file.`);
  const st = useStore.getState();
  st.replaceSettings({ ...st.settings, ...(w.settings && typeof w.settings === 'object' ? w.settings : {}) });
  const format = FORMATS.some((x) => x.id === w.format) ? (w.format as FormatId) : 'auto';
  st.setSource(w.source, format);
}

/** Ask for a workspace file and open it, reporting the result in the status bar. */
export function pickWorkspace() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    try {
      await openWorkspace(f);
      useStore.setState({ message: { text: `Opened ${f.name}.`, tone: 'info' } });
    } catch (e) { useStore.setState({ message: { text: (e as Error).message, tone: 'error' } }); }
  };
  input.click();
}
