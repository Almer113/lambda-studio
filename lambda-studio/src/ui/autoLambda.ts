// Editor typing aid: `\` becomes λ, except in LaTeX sources. When a LaTeX command is being typed
// after an auto-inserted λ (λlambda, λmathsf, λ, …) the λ turns back into a backslash as soon as
// the command word is complete.

import { looksLikeLatex } from '../core/formats/latex';

const LATEX_WORDS = new Set(['lambda', 'mathsf', 'mathrm', 'mathit', 'mathbf', 'text', 'operatorname', 'ulcorner', 'urcorner', 'equiv', 'left', 'right', 'quad', 'qquad', 'mapsto']);
const AMBIGUOUS = new Set(['left', 'right', 'text']);

export interface Edit { from: number; to: number; insert: string; anchor: number }

/** The edit to make instead of inserting `text` over [from, to), or null for the default. */
export function autoLambdaEdit(doc: string, from: number, to: number, text: string, latexFormat: boolean): Edit | null {
  // judge the text as it will be after this edit (typing over a selection replaces it)
  const latex = latexFormat || looksLikeLatex(doc.slice(0, from) + doc.slice(to));
  if (text === '\\') return latex ? null : { from, to, insert: 'λ', anchor: from + 1 };
  if (from === to && /^[^A-Za-z]$/.test(text) && text !== '.') {
    const before = doc.slice(Math.max(0, from - 20), from);
    const m = /λ([A-Za-z]+)$/.exec(before);
    const cmd = m ? m[1] : /λ$/.test(before) && /^[,;:!]$/.test(text) ? '' : null;
    // a space also ends a command word, except for words that are plausible parameter names
    const ok = cmd === '' || (cmd !== null && LATEX_WORDS.has(cmd) && (text !== ' ' || !AMBIGUOUS.has(cmd)));
    if (cmd !== null && ok) {
      const at = from - cmd.length - 1;
      return { from: at, to: from, insert: '\\' + cmd + text, anchor: from + text.length };
    }
  }
  return null;
}
