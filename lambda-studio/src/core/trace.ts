// Text exports of a whole reduction: a trace in any notation, a LaTeX →β chain, a Markdown
// summary and Tromp's .lam source syntax.

import { type Term, type Path, size } from './term';
import { printNamed, type PrintOptions } from './formats/named';
import { printDeBruijn } from './formats/debruijn';
import { printLatex } from './formats/latex';
import { encodeBLC } from './formats/blc';
import { layout } from './diagram/layout';
import { toBoxChars } from './diagram/ascii';
import { describe } from './encodings';

export interface TraceEntry { term: Term; kind?: string; path?: Path }
export type TraceFormat = 'named' | 'debruijn1' | 'latex';

const ARROW: Record<string, string> = { beta: '→β', eta: '→η', nbe: '↠', run: '↠' };
const TEX_ARROW: Record<string, string> = { beta: '\\to_\\beta', eta: '\\to_\\eta', nbe: '\\twoheadrightarrow', run: '\\twoheadrightarrow' };

/** One line per step. */
export function traceText(entries: TraceEntry[], fmt: TraceFormat, opts: PrintOptions = {}, maxSize = 5000): string {
  const show = (t: Term) => (size(t) > maxSize ? `… (${size(t)} nodes)` : fmt === 'debruijn1' ? printDeBruijn(t, 1).text : printNamed(t, opts).text);
  if (fmt === 'latex') {
    const lines = entries.map((e, i) => {
      const body = size(e.term) > maxSize ? `\\ldots` : printLatex(e.term, opts);
      return i === 0 ? `  & ${body}` : `  ${TEX_ARROW[e.kind ?? 'beta'] ?? '\\to'} {} & ${body}`;
    });
    return ['% needs \\usepackage{amsmath,amssymb}', '\\begin{align*}', lines.join(' \\\\\n'), '\\end{align*}'].join('\n');
  }
  const width = String(entries.length - 1).length;
  return entries.map((e, i) => `${String(i).padStart(width)}  ${i === 0 ? '  ' : (ARROW[e.kind ?? 'beta'] ?? '→')} ${show(e.term)}`).join('\n');
}

/** Tromp's AIT .lam syntax: \x.body, application by juxtaposition (closed terms). */
export function toLam(t: Term): string {
  return printNamed(t, { lambda: '\\', multiArg: false }).text;
}

/** Markdown report: source, result, decoded value, BLC and an ASCII diagram. */
export function markdownSummary(source: string, start: Term, result: Term, steps: number, opts: PrintOptions = {}): string {
  const lines: string[] = [];
  lines.push('# λ-term');
  lines.push('', '```', source.trim(), '```');
  lines.push('', `**Start:** \`${printNamed(start, opts).text}\``);
  if (result !== start) lines.push('', `**After ${steps} step${steps === 1 ? '' : 's'}:** \`${printNamed(result, opts).text}\``);
  const d = describe(result);
  if (d.length) lines.push('', `**Value:** ${d.map((x) => x.text).join(' · ')}`);
  try { lines.push('', `**BLC (${encodeBLC(result).length} bits):** \`${encodeBLC(result)}\``); } catch { /* free variables */ }
  if (size(result) < 1500) lines.push('', '**Tromp diagram:**', '', '```', toBoxChars(layout(result)), '```');
  return lines.join('\n') + '\n';
}
