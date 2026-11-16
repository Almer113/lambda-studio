// Arithmetic and Boolean expressions → λ-terms (via the prelude's names).
//
//   (2 + 3) * 4^2        →  MULT (PLUS 2 3) (EXP 4 2)
//   (a ∧ ¬b) ∨ c         →  λa b c.OR (AND a (NOT b)) c
//   x^2 + 1 ≤ 10         →  λx.LEQ (PLUS (EXP x 2) 1) 10
//
// Accepts plain ASCII / Unicode operators and LaTeX (as produced by a math editor):
// \cdot \times \div \frac{a}{b} x^{2} \land \lor \lnot \neg \oplus \to \iff \le \ge \neq \top \bot …

export type Ty = 'num' | 'bool';
export type Op =
  | 'add' | 'sub' | 'mul' | 'div' | 'mod' | 'pow' | 'fact'
  | 'lt' | 'le' | 'gt' | 'ge' | 'eq' | 'ne'
  | 'and' | 'or' | 'not' | 'xor' | 'imp' | 'iff';
export type Expr =
  | { k: 'num'; n: number }
  | { k: 'bool'; b: boolean }
  | { k: 'var'; name: string }
  | { k: 'op'; op: Op; args: Expr[] };

export class ExprError extends Error {
  constructor(message: string, public pos = 0) { super(message); }
}

// --- tokens ---------------------------------------------------------------------------------
type Tok = { t: 'num'; v: number; pos: number } | { t: 'id'; v: string; pos: number } | { t: 'op'; v: string; pos: number };

const SYMBOLS: [string, string][] = [
  // longest first
  ['<=>', 'iff'], ['<->', 'iff'], ['==>', 'imp'], ['->', 'imp'], ['=>', 'imp'],
  ['&&', 'and'], ['||', 'or'], ['<=', 'le'], ['>=', 'ge'], ['==', 'eq'], ['!=', 'ne'], ['/=', 'ne'], ['**', 'pow'],
  ['∧', 'and'], ['∨', 'or'], ['¬', 'not'], ['⊕', 'xor'], ['⊻', 'xor'], ['→', 'imp'], ['⇒', 'imp'], ['↔', 'iff'], ['⇔', 'iff'],
  ['≤', 'le'], ['≥', 'ge'], ['≠', 'ne'], ['×', 'mul'], ['·', 'mul'], ['⋅', 'mul'], ['÷', 'div'], ['−', 'sub'],
  ['+', 'add'], ['-', 'sub'], ['*', 'mul'], ['/', 'div'], ['%', 'mod'], ['^', 'pow'], ['<', 'lt'], ['>', 'gt'], ['=', 'eq'],
  ['&', 'and'], ['|', 'or'], ['~', 'not'], ['!', '!'], ['(', '('], [')', ')'], ['⊤', 'true'], ['⊥', 'false'],
];
const WORDS: Record<string, string> = {
  and: 'and', or: 'or', not: 'not', xor: 'xor', implies: 'imp', iff: 'iff', mod: 'mod', div: 'div',
  true: 'true', false: 'false', T: 'true', F: 'false', TRUE: 'true', FALSE: 'false',
};

const LATEX: Record<string, string> = {
  cdot: '*', times: '*', ast: '*', div: '/', land: '∧', wedge: '∧', lor: '∨', vee: '∨', lnot: '¬', neg: '¬',
  oplus: '⊕', veebar: '⊕', to: '→', rightarrow: '→', Rightarrow: '→', implies: '→', longrightarrow: '→', Longrightarrow: '→',
  leftrightarrow: '↔', Leftrightarrow: '↔', iff: '↔', le: '≤', leq: '≤', leqslant: '≤', ge: '≥', geq: '≥', geqslant: '≥',
  ne: '≠', neq: '≠', top: '⊤', bot: '⊥', bmod: ' mod ', mod: ' mod ', pmod: ' mod ', lt: '<', gt: '>',
  left: '', right: '', big: '', Big: '', bigl: '', bigr: '', Bigl: '', Bigr: '', ',': ' ', ';': ' ', ':': ' ', '!': '', quad: ' ', qquad: ' ',
  mathrm: '', mathit: '', mathsf: '', text: '', operatorname: '', textrm: '', mathbf: '',
};

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'θ',
  iota: 'ι', kappa: 'κ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'π', rho: 'ρ', varrho: 'ρ', sigma: 'σ', varsigma: 'ς',
  tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

/** Rewrite LaTeX into the plain syntax. */
export function latexToPlain(src: string): string {
  let s = src;
  // innermost groups first: x^{…} → x^(…), \frac{a}{b} → ((a)/(b)), \overline{a} → ¬(a)
  for (let k = 0; k < 100; k++) {
    const before = s;
    s = s.replace(/\^\s*\{([^{}]*)\}/g, '^($1)')
      .replace(/_\s*\{\s*([A-Za-z0-9]*)\s*\}/g, (_m, sub: string) => (sub ? `_${sub}` : ''))
      .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))')
      .replace(/\\overline\s*\{([^{}]*)\}/g, '¬($1)');
    if (s === before) break;
  }
  s = s.replace(/\\(?:operatorname|mathrm|text|textrm)\s*\{\s*(mod|div|and|or|not|xor)\s*\}/g, ' $1 ');
  s = s.replace(/\\([A-Za-z]+|[,;:!])/g, (m, name: string) => (name in LATEX ? LATEX[name] : name in GREEK ? ` ${GREEK[name]} ` : m));
  s = s.replace(/_\s*([A-Za-z0-9])/g, '_$1'); // x_ 1 → x_1
  s = s.replace(/[{}]/g, (c) => (c === '{' ? '(' : ')'));
  s = s.replace(/\\/g, ' ');
  return s;
}

export function looksLikeLatexExpr(src: string): boolean { return /\\[A-Za-z]|[{}]/.test(src); }

function tokenize(src: string, splitLetters: boolean): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  outer: while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c)) {
      let j = i; while (j < src.length && /[0-9]/.test(src[j])) j++;
      out.push({ t: 'num', v: Number(src.slice(i, j)), pos: i }); i = j; continue;
    }
    if (/[A-Za-z_Ͱ-Ͽ]/.test(c) && c !== 'λ') {
      let j = i; while (j < src.length && /[A-Za-z0-9_'Ͱ-Ͽ]/.test(src[j])) j++;
      const w = src.slice(i, j);
      if (WORDS[w] !== undefined) { out.push({ t: 'op', v: WORDS[w], pos: i }); i = j; continue; }
      const sub = /^([A-Za-z]+)(_[A-Za-z0-9]+)$/.exec(w);
      if (splitLetters && (/^[A-Za-z]+$/.test(w) || sub)) {
        const letters = sub ? sub[1] : w;
        for (let k = 0; k < letters.length; k++) out.push({ t: 'id', v: letters[k] + (sub && k === letters.length - 1 ? sub[2] : ''), pos: i + k });
      } else out.push({ t: 'id', v: w, pos: i });
      i = j; continue;
    }
    for (const [sym, name] of SYMBOLS) {
      if (src.startsWith(sym, i)) { out.push({ t: 'op', v: name, pos: i }); i += sym.length; continue outer; }
    }
    throw new ExprError(`Unexpected '${c}'`, i);
  }
  return out;
}

// --- parser (precedence climbing) ----------------------------------------------------------
// iff < imp (right) < or < xor < and < not < comparison < + − < × ÷ mod < unary − < ^ (right) < postfix !
export function parseExpr(input: string): Expr {
  const latex = looksLikeLatexExpr(input);
  const src = latex ? latexToPlain(input) : input;
  const toks = tokenize(src, latex);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;
  const eat = (v: string) => { if (isOp(v)) { p++; return true; } return false; };
  const fail = (msg: string): never => { throw new ExprError(msg, peek()?.pos ?? src.length); };
  const mk = (op: Op, ...args: Expr[]): Expr => ({ k: 'op', op, args });

  const iff = (): Expr => { let l = imp(); while (eat('iff')) l = mk('iff', l, imp()); return l; };
  const imp = (): Expr => { const l = or(); return eat('imp') ? mk('imp', l, imp()) : l; };
  const or = (): Expr => { let l = xor(); while (eat('or')) l = mk('or', l, xor()); return l; };
  const xor = (): Expr => { let l = and(); while (eat('xor')) l = mk('xor', l, and()); return l; };
  const and = (): Expr => { let l = not(); while (eat('and')) l = mk('and', l, not()); return l; };
  const not = (): Expr => (eat('not') || eat('!') ? mk('not', not()) : cmp());
  const CMP = ['lt', 'le', 'gt', 'ge', 'eq', 'ne'];
  const cmp = (): Expr => {
    const l = add();
    const t = peek();
    if (t?.t === 'op' && CMP.includes(String(t.v))) { p++; const r = add(); const e = mk(t.v as Op, l, r); if (peek()?.t === 'op' && CMP.includes(String(peek()!.v))) fail('Chained comparisons are not supported; use ∧'); return e; }
    return l;
  };
  const add = (): Expr => {
    let l = mul();
    for (;;) { if (eat('add')) l = mk('add', l, mul()); else if (eat('sub')) l = mk('sub', l, mul()); else return l; }
  };
  const startsPrimary = () => { const t = peek(); return !!t && (t.t === 'num' || t.t === 'id' || (t.t === 'op' && (t.v === '(' || t.v === 'true' || t.v === 'false'))); };
  const mul = (): Expr => {
    let l = unary();
    for (;;) {
      if (eat('mul')) l = mk('mul', l, unary());
      else if (eat('div')) l = mk('div', l, unary());
      else if (eat('mod')) l = mk('mod', l, unary());
      else if (startsPrimary()) l = mk('mul', l, unary()); // implicit multiplication: 2x, 3(x+1)
      else return l;
    }
  };
  const unary = (): Expr => {
    if (eat('sub')) { const e = unary(); if (e.k === 'num' && e.n === 0) return e; fail('Negative numbers have no Church numeral'); }
    if (eat('add')) return unary();
    if (eat('not') || eat('!')) return mk('not', unary());
    return pow();
  };
  const pow = (): Expr => { const b = postfix(); return eat('pow') ? mk('pow', b, unary()) : b; };
  const postfix = (): Expr => { let e = primary(); while (isOp('!')) { p++; e = mk('fact', e); } return e; };
  const primary = (): Expr => {
    const t = peek();
    if (!t) return fail('Unexpected end of expression');
    p++;
    if (t.t === 'num') return { k: 'num', n: t.v };
    if (t.t === 'id') return { k: 'var', name: t.v };
    if (t.v === 'true') return { k: 'bool', b: true };
    if (t.v === 'false') return { k: 'bool', b: false };
    if (t.v === '(') { const e = iff(); if (!eat(')')) fail("Missing ')'"); return e; }
    p--; return fail(`Unexpected '${opText(String(t.v))}'`);
  };
  if (!toks.length) throw new ExprError('Empty expression');
  const e = iff();
  if (p < toks.length) fail(`Unexpected '${tokText(toks[p])}'`);
  return e;
}
const tokText = (t: Tok) => (t.t === 'op' ? opText(t.v) : String(t.v));
const opText = (v: string) => ({ add: '+', sub: '−', mul: '×', div: '÷', mod: 'mod', pow: '^', and: '∧', or: '∨', not: '¬', xor: '⊕', imp: '→', iff: '↔', lt: '<', le: '≤', gt: '>', ge: '≥', eq: '=', ne: '≠' } as Record<string, string>)[v] ?? v;

// --- types ---------------------------------------------------------------------------------
const SIG: Record<Op, [Ty[], Ty]> = {
  add: [['num', 'num'], 'num'], sub: [['num', 'num'], 'num'], mul: [['num', 'num'], 'num'], div: [['num', 'num'], 'num'],
  mod: [['num', 'num'], 'num'], pow: [['num', 'num'], 'num'], fact: [['num'], 'num'],
  lt: [['num', 'num'], 'bool'], le: [['num', 'num'], 'bool'], gt: [['num', 'num'], 'bool'], ge: [['num', 'num'], 'bool'],
  eq: [['num', 'num'], 'bool'], ne: [['num', 'num'], 'bool'],
  and: [['bool', 'bool'], 'bool'], or: [['bool', 'bool'], 'bool'], not: [['bool'], 'bool'], xor: [['bool', 'bool'], 'bool'],
  imp: [['bool', 'bool'], 'bool'], iff: [['bool', 'bool'], 'bool'],
};

export interface Typed { type: Ty; vars: { name: string; type: Ty }[] }

/**
 * Check operand types. A variable's type comes from any of its uses (the whole expression is
 * solved first); only a variable that nothing decides gets a default: a number when it is compared
 * with = or ≠, a truth value otherwise.
 */
export function typeOf(e: Expr): Typed {
  const vars = new Map<string, Ty | null>();
  const order: string[] = [];
  let changed = false;
  const go = (e: Expr, want: Ty | null, final: boolean): Ty | null => {
    if (e.k === 'num') return 'num';
    if (e.k === 'bool') return 'bool';
    if (e.k === 'var') {
      if (!vars.has(e.name)) { vars.set(e.name, null); order.push(e.name); }
      const have = vars.get(e.name)!;
      if (have && want && have !== want) throw new ExprError(`${e.name} is used both as a ${have === 'num' ? 'number' : 'Boolean'} and as a ${want === 'num' ? 'number' : 'Boolean'}`);
      if (!have && want) { vars.set(e.name, want); changed = true; }
      return want ?? have;
    }
    if (e.op === 'eq' || e.op === 'ne') {
      // = and ≠ also compare truth values (as ↔ and ⊕); in the final pass the node is rewritten in place
      let t0 = go(e.args[0], null, final);
      const t1 = go(e.args[1], t0, final);
      if (!t0 && t1) t0 = go(e.args[0], t1, final);
      if (t0 && t1 && t0 !== t1) throw new ExprError(`${opText(e.op)} compares a number with a truth value`);
      const ty = t0 ?? t1 ?? (final ? 'num' : null);
      if (ty) {
        if (!t0) go(e.args[0], ty, final);
        if (!t1) go(e.args[1], ty, final);
        if (final && ty === 'bool') (e as { op: Op }).op = e.op === 'eq' ? 'iff' : 'xor';
      }
      return 'bool';
    }
    const [args, res] = SIG[e.op];
    e.args.forEach((a, k) => {
      const t = go(a, args[k], final);
      if (t && t !== args[k]) throw new ExprError(`${opText(e.op)} needs ${args[k] === 'num' ? 'numbers' : 'truth values'}`);
    });
    return res;
  };
  // solve: repeat until no variable gets a type, then apply the defaults
  do { changed = false; go(e, null, false); } while (changed);
  const t = go(e, null, true) ?? 'bool';
  return { type: t, vars: order.sort(compareNames).map((name) => ({ name, type: vars.get(name) ?? 'bool' })) };
}
const compareNames = (a: string, b: string) => (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0);

// --- λ output ------------------------------------------------------------------------------
const PRELUDE_NAME: Record<Op, string> = {
  add: 'PLUS', sub: 'SUB', mul: 'MULT', div: 'DIV', mod: 'MOD', pow: 'EXP', fact: 'FACT',
  lt: 'LT', le: 'LEQ', gt: 'GT', ge: 'GEQ', eq: 'EQ', ne: 'NEQ',
  and: 'AND', or: 'OR', not: 'NOT', xor: 'XOR', imp: 'IMPLIES', iff: 'IFF',
};

/** Named-notation source using the prelude: `λa b.OR a (NOT b)`. */
export function exprToLambda(e: Expr): string {
  const { vars } = typeOf(e);
  const body = (e: Expr, nested: boolean): string => {
    if (e.k === 'num') return String(e.n);
    if (e.k === 'bool') return e.b ? 'TRUE' : 'FALSE';
    if (e.k === 'var') return e.name;
    const s = `${PRELUDE_NAME[e.op]} ${e.args.map((a) => body(a, true)).join(' ')}`;
    return nested ? `(${s})` : s;
  };
  const b = body(e, false);
  return vars.length ? `λ${vars.map((v) => v.name).join(' ')}.${b}` : b;
}

/** The expression typeset as LaTeX (for a preview). */
export function exprToTex(e: Expr): string {
  const PREC: Record<Op, number> = { iff: 1, imp: 2, or: 3, xor: 4, and: 5, not: 6, lt: 7, le: 7, gt: 7, ge: 7, eq: 7, ne: 7, add: 8, sub: 8, mul: 9, div: 9, mod: 9, pow: 11, fact: 12 };
  const SYM: Partial<Record<Op, string>> = { iff: '\\leftrightarrow', imp: '\\to', or: '\\lor', xor: '\\oplus', and: '\\land', lt: '<', le: '\\le', gt: '>', ge: '\\ge', eq: '=', ne: '\\ne', add: '+', sub: '-', mul: '\\cdot', div: '\\div', mod: '\\bmod' };
  const go = (e: Expr, ctx: number): string => {
    if (e.k === 'num') return String(e.n);
    if (e.k === 'bool') return e.b ? '\\top' : '\\bot';
    if (e.k === 'var') return e.name.length > 1 ? `\\mathit{${e.name}}` : e.name;
    const p = PREC[e.op];
    let s: string;
    if (e.op === 'not') s = `\\lnot ${go(e.args[0], p)}`;
    else if (e.op === 'fact') s = `${go(e.args[0], p + 1)}!`;
    else if (e.op === 'pow') s = `${go(e.args[0], p + 1)}^{${go(e.args[1], 0)}}`;
    else s = `${go(e.args[0], e.op === 'imp' ? p + 1 : p)} ${SYM[e.op]} ${go(e.args[1], e.op === 'imp' ? p : p + 1)}`;
    return p < ctx ? `\\left(${s}\\right)` : s;
  };
  return go(e, 0);
}

// --- direct evaluation (to check the λ result) ---------------------------------------------
export function evalExpr(e: Expr, env: Record<string, number | boolean> = {}): number | boolean {
  const n = (x: number | boolean) => x as number;
  const b = (x: number | boolean) => x as boolean;
  switch (e.k) {
    case 'num': return e.n;
    case 'bool': return e.b;
    case 'var': { if (!(e.name in env)) throw new ExprError(`No value for ${e.name}`); return env[e.name]; }
  }
  const a = e.args.map((x) => evalExpr(x, env));
  switch (e.op) {
    case 'add': return n(a[0]) + n(a[1]);
    case 'sub': return Math.max(0, n(a[0]) - n(a[1]));
    case 'mul': return n(a[0]) * n(a[1]);
    case 'div': if (n(a[1]) === 0) throw new ExprError('Division by zero (DIV m 0 has no normal form)'); return Math.floor(n(a[0]) / n(a[1]));
    case 'mod': if (n(a[1]) === 0) throw new ExprError('Remainder by zero (MOD m 0 has no normal form)'); return n(a[0]) % n(a[1]);
    case 'pow': return n(a[0]) ** n(a[1]);
    case 'fact': { let r = 1; for (let k = 2; k <= n(a[0]); k++) r *= k; return r; }
    case 'lt': return n(a[0]) < n(a[1]);
    case 'le': return n(a[0]) <= n(a[1]);
    case 'gt': return n(a[0]) > n(a[1]);
    case 'ge': return n(a[0]) >= n(a[1]);
    case 'eq': return a[0] === a[1];
    case 'ne': return a[0] !== a[1];
    case 'and': return b(a[0]) && b(a[1]);
    case 'or': return b(a[0]) || b(a[1]);
    case 'not': return !b(a[0]);
    case 'xor': return b(a[0]) !== b(a[1]);
    case 'imp': return !b(a[0]) || b(a[1]);
    case 'iff': return b(a[0]) === b(a[1]);
  }
}
