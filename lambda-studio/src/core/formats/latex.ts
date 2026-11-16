// LaTeX output and input.
//
// Output: the text printers (named, de Bruijn) already record a source span for every term node,
// so LaTeX is produced by re-tokenising their output and wrapping each node in
// \htmlData{p=<path>}{…}. KaTeX keeps those as data-p attributes, which gives hover linking
// between rendered math, text and diagram. `tags: false` gives clean LaTeX for copying.
//
// Input: LaTeX is normalised to the plain notations (λ, spaces, identifiers, digits) with an
// offset map back into the original source, then parsed by the ordinary parsers.

import { type Term, type Path } from '../term';
import { lex, type Token, type Span, printNamed, type PrintOptions } from './named';
import { printDeBruijn } from './debruijn';

// ---------------------------------------------------------------------------
// Output

export type TexStyle = 'named' | 'debruijn0' | 'debruijn1';

export interface TexOptions extends PrintOptions {
  style?: TexStyle;
  /** Wrap nodes in \htmlData{p=…} for hover linking (KaTeX with trust). */
  tags?: boolean;
  /** Names to typeset as definitions (\mathsf). Defaults to `avoid`. */
  defNames?: ReadonlySet<string>;
}

const GREEK: Record<string, string> = {
  α: '\\alpha', β: '\\beta', γ: '\\gamma', δ: '\\delta', ε: '\\varepsilon', ζ: '\\zeta', η: '\\eta', θ: '\\theta',
  ι: '\\iota', κ: '\\kappa', μ: '\\mu', ν: '\\nu', ξ: '\\xi', π: '\\pi', ρ: '\\rho', σ: '\\sigma', τ: '\\tau',
  υ: '\\upsilon', φ: '\\varphi', χ: '\\chi', ψ: '\\psi', ω: '\\omega',
  Γ: '\\Gamma', Δ: '\\Delta', Θ: '\\Theta', Λ: '\\Lambda', Ξ: '\\Xi', Π: '\\Pi', Σ: '\\Sigma', Φ: '\\Phi', Ψ: '\\Psi', Ω: '\\Omega',
};
const GREEK_BACK: Record<string, string> = Object.fromEntries(Object.entries(GREEK).map(([k, v]) => [v.slice(1), k]));
GREEK_BACK.epsilon = 'ε'; GREEK_BACK.phi = 'φ'; GREEK_BACK.vartheta = 'θ';

const SUB = '₀₁₂₃₄₅₆₇₈₉';

/** Typeset one identifier. */
export function texName(name: string, isDef: boolean): string {
  if (isDef) {
    if (name.length === 1 && GREEK[name]) return GREEK[name];
    return `\\mathsf{${escapeText(name)}}`;
  }
  // x, x1, x₁, x', foo, foo2, _0
  const m = /^(.*?)([0-9₀-₉]*)('*)$/u.exec(name)!;
  let [, stem, digits, primes] = m;
  digits = [...digits].map((c) => (SUB.includes(c) ? String(SUB.indexOf(c)) : c)).join('');
  if (stem === '' && digits) { stem = digits; digits = ''; }
  let s: string;
  if (stem === '_') s = '\\_';
  else if ([...stem].length === 1) s = GREEK[stem] ?? (/^[A-Za-z]$/.test(stem) ? stem : `\\text{${escapeText(stem)}}`);
  else s = `\\mathit{${escapeText(stem)}}`;
  if (digits) s += `_{${digits}}`;
  if (primes) s += "'".repeat(primes.length);
  return s;
}

function escapeText(s: string): string {
  return s.replace(/[\\{}_^#$%&~]/g, (c) => (c === '\\' ? '\\backslash ' : c === '~' ? '\\sim ' : c === '^' ? '\\hat{}' : '\\' + c));
}

export type TokenTex = (tok: Token, prev: Token | null) => string;

/**
 * Convert a token stream (from `lex`) to LaTeX, inserting explicit spacing (math mode ignores
 * source whitespace) and wrapping `spans` (properly nested) in \htmlData groups.
 */
export function tokensToTex(toks: Token[], spans: { path: Path; from: number; to: number }[], opts: { tags: boolean; defNames: ReadonlySet<string>; numerals: 'church' | 'index'; singleLetter?: boolean }): string {
  const sorted = opts.tags ? [...spans].sort((a, b) => a.from - b.from || b.to - a.to) : [];
  let si = 0;
  const open: number[] = [];
  let out = '';
  let prev: Token | null = null;
  let inParams = false;
  const atomEnd = (t: Token) => t.kind === 'id' || t.kind === 'num' || t.kind === 'str' || t.kind === 'rp' || t.kind === 'rb';
  const atomStart = (t: Token) => t.kind === 'id' || t.kind === 'num' || t.kind === 'str' || t.kind === 'lp' || t.kind === 'lb' || t.kind === 'lam' || t.kind === 'let';
  for (const tok of toks) {
    // spacing
    if (prev) {
      if (inParams && prev.kind === 'id' && tok.kind === 'id') out += '\\,';
      // ⌜2⌝ ⌜3⌝ needs a wider gap than f x: the corners otherwise read as one token
      else if (atomEnd(prev) && atomStart(tok)) out += opts.numerals === 'church' && (prev.kind === 'num' || tok.kind === 'num') ? '\\;' : '\\:';
    }
    while (si < sorted.length && sorted[si].from <= tok.from) {
      const s = sorted[si++];
      if (s.to <= s.from) continue;
      out += `\\htmlData{p=r${s.path}}{`;
      open.push(s.to);
    }
    switch (tok.kind) {
      case 'lam': out += '\\lambda '; inParams = true; break;
      case 'dot': out += '.\\,'; inParams = false; break;
      case 'lp': out += '('; break;
      case 'rp': out += ')'; break;
      case 'lb': out += '['; break;
      case 'rb': out += ']'; break;
      case 'comma': out += ',\\,'; break;
      case 'semi': out += ';\\;'; break;
      case 'eq': out += '\\equiv '; break;
      case 'let': out += '\\mathbf{let}\\;'; break;
      case 'in': out += '\\;\\mathbf{in}\\;'; break;
      case 'str': out += `\\text{\\textquotedblleft{}${escapeText(tok.text.slice(1, -1))}\\textquotedblright{}}`; break;
      case 'num': out += opts.numerals === 'church' ? `\\ulcorner ${tok.text}\\urcorner ` : tok.text + ' '; break;
      case 'id': {
        const isDef = opts.defNames.has(tok.text);
        if (opts.singleLetter && !isDef && /^[a-z]{2,}$/.test(tok.text)) out += [...tok.text].join(inParams ? '\\,' : '\\:');
        else out += texName(tok.text, isDef);
        break;
      }
    }
    while (open.length && open[open.length - 1] <= tok.to) { open.pop(); out += '}'; }
    prev = tok;
  }
  while (open.length) { open.pop(); out += '}'; }
  return out;
}

/** LaTeX for a term in the given style. */
export function printLatex(t: Term, opts: TexOptions = {}): string {
  const style = opts.style ?? 'named';
  const tags = opts.tags ?? false;
  if (style === 'named') {
    const p = printNamed(t, { ...opts, lambda: 'λ' });
    return tokensToTex(lex(p.text), p.spans, { tags, defNames: opts.defNames ?? opts.avoid ?? new Set(), numerals: 'church' });
  }
  const p = printDeBruijn(t, style === 'debruijn0' ? 0 : 1);
  return tokensToTex(lex(p.text), p.spans, { tags, defNames: new Set(), numerals: 'index' });
}

/** Read the path from a KaTeX-rendered element (data-p="r<path>"). */
export function pathFromElement(el: Element | null, root: Element): Path | null {
  const hit = el?.closest('[data-p]');
  if (!hit || !root.contains(hit)) return null;
  return hit.getAttribute('data-p')!.slice(1);
}

// ---------------------------------------------------------------------------
// Input

export interface Normalized {
  text: string;
  /** map[i] = source offset where text[i] came from; map[text.length] = src.length */
  map: number[];
  /** ends[i] = end offset (exclusive) of the source chunk that produced text[i] */
  ends: number[];
}

const DROP_CMDS = new Set(['mathsf', 'mathrm', 'mathit', 'mathbf', 'mathtt', 'mathnormal', 'text', 'textsf', 'textrm', 'textit', 'textbf', 'texttt',
  'operatorname', 'boldsymbol', 'bm', 'underline', 'overline', 'left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr',
  'ulcorner', 'urcorner', 'llcorner', 'lrcorner', 'displaystyle', 'textstyle', 'mathbb', 'mathcal']);
const DROP_WITH_ARG = new Set(['textcolor', 'color', 'htmlData', 'htmlClass', 'htmlId', 'htmlStyle', 'colorbox', 'begin', 'end', 'label']);
const SPACE_CMDS = new Set([',', ';', ':', '!', ' ', '>', 'quad', 'qquad', 'enspace', 'thinspace', 'medspace', 'thickspace', 'space']);
const TO_DOT = new Set(['to', 'rightarrow', 'mapsto', 'cdot', 'ldotp', 'centerdot']);
const TO_EQ = new Set(['equiv', 'coloneqq', 'triangleq', 'eqdef', 'doteq', 'defeq']);

/** Heuristic: does this source look like LaTeX rather than plain notation? */
export function looksLikeLatex(src: string): boolean {
  return /\$|\\(lambda|Lambda|math[a-z]+|text[a-z]*|operatorname|[,;:!]|quad|left[(\[]|right[)\]]|ulcorner|htmlData|equiv|coloneqq|mapsto|omega|Omega|Theta)(?![A-Za-z])/.test(src);
}

export function normalizeLatex(src: string): Normalized {
  let text = '';
  const map: number[] = [];
  const ends: number[] = [];
  const put = (s: string, at: number, end = at + 1) => {
    for (const c of s) {
      // keep definitions at column 0 after a line break (`\\` followed by indentation)
      if ((c === ' ' || c === '\t') && (text === '' || text.endsWith('\n'))) continue;
      text += c; map.push(at); ends.push(end);
    }
  };
  const skipGroup = (i: number): number => {
    // skip whitespace then one {...} group (balanced) if present
    let j = i; while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] !== '{') return i;
    let depth = 0;
    for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}' && --depth === 0) return j + 1; }
    return j;
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '%') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '$' || c === '&' || c === '{' || c === '}') { i++; continue; }
    if (c === '~') { put(' ', i); i++; continue; }
    if (c === '_' && i > 0 && /[\p{L}\p{N}}]/u.test(src[i - 1])) { i++; continue; } // subscript: x_1 → x1
    if (c === '^') {
      const m = /^\^\s*(\{\s*)?\\prime\s*\}?/.exec(src.slice(i));
      if (m) { put("'", i, i + m[0].length); i += m[0].length; continue; }
      i++; continue;
    }
    if (c === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i));
      if (!m) { i++; continue; }
      const name = m[1];
      const at = i;
      i += m[0].length;
      if (name === '\\') { put('\n', at, i); continue; }
      if (name === '[' || name === ']' || name === '(' || name === ')') continue; // display delimiters
      if (name === '{' || name === '}') continue;
      if (name === '_') { put('_', at, i); continue; }
      if (name === 'lambda' || name === 'Lambda') { put('λ', at, i); continue; }
      if (SPACE_CMDS.has(name)) { put(' ', at, i); continue; }
      if (TO_DOT.has(name)) { put('.', at, i); continue; }
      if (TO_EQ.has(name)) { put('=', at, i); continue; }
      if (name === 'textquotedblleft' || name === 'textquotedblright') { put('"', at, i); continue; }
      if (name === 'prime') { put("'", at, i); continue; }
      if (name === 'stackrel' || name === 'overset') { i = skipGroup(i); continue; }
      if (GREEK_BACK[name]) { put(GREEK_BACK[name], at, i); continue; }
      if (DROP_WITH_ARG.has(name)) { i = skipGroup(i); continue; }
      if (DROP_CMDS.has(name)) continue;
      // unknown command: keep its name as an identifier
      put(name, at, i);
      continue;
    }
    put(c, i);
    i++;
  }
  map.push(src.length);
  ends.push(src.length);
  return { text, map, ends };
}

/** Map a span in normalised text back to the LaTeX source. */
export function mapSpan(n: Normalized, s: Span): Span {
  const from = n.map[Math.min(s.from, n.map.length - 1)];
  const to = s.to > s.from ? n.ends[Math.min(s.to - 1, n.ends.length - 1)] : from;
  return { from, to: Math.max(from, to) };
}
