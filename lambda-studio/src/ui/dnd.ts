// Drag and drop of library definitions onto the diagram (and as text into the editor).

import { type Term, free } from '../core/term';

export const DEF_MIME = 'application/x-lambda-def';

export function startDefDrag(e: React.DragEvent, name: string) {
  e.dataTransfer.setData(DEF_MIME, name);
  e.dataTransfer.setData('text/plain', name + ' ');
  e.dataTransfer.effectAllowed = 'copy';
}

/** The dropped name as a term: a free name that the rewritten source resolves to the definition. */
export function preludeOrUserTerm(name: string): Term | null {
  return /^\p{L}[\p{L}0-9_']*$/u.test(name) ? free(name) : null;
}
