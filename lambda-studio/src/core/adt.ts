// Algebraic data type declarations → λ-encodings (Church, Scott, Parigot), as named-notation
// definitions ready to paste into the source.
//
//   data Tree = Leaf | Node Tree Nat Tree
//
// Church:  LEAF = λleaf node.leaf
//          NODE = λl x r leaf node.node (l leaf node) x (r leaf node)     (a value is its own fold)
// Scott:   NODE = λl x r leaf node.node l x r                             (a value is its own case)
// Parigot: NODE = λl x r leaf node.node l (l leaf node) x r (r leaf node) (both: sub-values and results)

export type Encoding = 'church' | 'scott' | 'parigot';
export const ENCODINGS: { id: Encoding; name: string; blurb: string }[] = [
  { id: 'church', name: 'Church', blurb: 'A value is its own fold: recursion comes for free, but taking it apart (e.g. a predecessor) is slow.' },
  { id: 'scott', name: 'Scott', blurb: 'A value is its own case analysis: O(1) access to the fields, recursion needs a fixed point (Y).' },
  { id: 'parigot', name: 'Parigot', blurb: 'Both at once: each case gets the fields and the results for the recursive fields. Terms grow quickly.' },
];

export interface Field { type: string; recursive: boolean }
export interface Ctor { name: string; fields: Field[] }
export interface DataDecl { name: string; params: string[]; ctors: Ctor[] }

export class AdtError extends Error {}

/** Parse one or more `data T a = C1 f1 f2 | C2 …` declarations (one per line or `;`-separated). */
export function parseData(src: string): DataDecl[] {
  const decls: DataDecl[] = [];
  const parts = src.replace(/--.*$/gm, '').split(/\n(?=\s*data\b)|;/).map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    const m = /^data\s+([A-Z][A-Za-z0-9_]*)((?:\s+[a-z][A-Za-z0-9_]*)*)\s*=\s*([\s\S]+)$/.exec(part);
    if (!m) throw new AdtError(`Expected "data Name = Ctor fields | …", got: ${part.slice(0, 60)}`);
    const [, name, params, rhs] = m;
    const ctors: Ctor[] = [];
    for (const alt of rhs.split('|').map((s) => s.trim())) {
      const toks = fieldTokens(alt);
      if (!toks.length || !/^[A-Z]/.test(toks[0])) throw new AdtError(`Constructor names start with a capital letter: "${alt}"`);
      const [cname, ...fs] = toks;
      ctors.push({ name: cname, fields: fs.map((f) => ({ type: f, recursive: headOf(f) === name })) });
    }
    const dup = ctors.find((c, i) => ctors.findIndex((d) => d.name === c.name) !== i);
    if (dup) throw new AdtError(`Constructor ${dup.name} appears twice`);
    for (const c of ctors) {
      const other = decls.find((d) => d.ctors.some((x) => x.name === c.name));
      if (other) throw new AdtError(`Constructor ${c.name} is declared in both ${other.name} and ${name}`);
    }
    if (decls.some((d) => d.name === name)) throw new AdtError(`Type ${name} is declared twice`);
    decls.push({ name, params: params.trim() ? params.trim().split(/\s+/) : [], ctors });
  }
  if (!decls.length) throw new AdtError('No data declaration found');
  return decls;
}

/** Split a constructor alternative into tokens, keeping parenthesised types together. */
function fieldTokens(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const c of s) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (/\s/.test(c) && depth === 0) { if (cur) out.push(cur); cur = ''; } else cur += c;
  }
  if (depth !== 0) throw new AdtError(`Unbalanced parentheses in "${s}"`);
  if (cur) out.push(cur);
  return out;
}
const headOf = (t: string) => t.replace(/^\(+/, '').split(/[\s)]/)[0];

const lower = (s: string) => s[0].toLowerCase() + s.slice(1);
const upper = (s: string) => s.toUpperCase();

export interface Generated { source: string; names: string[] }

/** Field variable names for a constructor: x, y, z / l, r … avoiding the case names. */
function fieldVars(c: Ctor, taken: Set<string>): string[] {
  const pool = c.fields.length <= 3 ? ['x', 'y', 'z'] : [];
  return c.fields.map((f, k) => {
    let base = f.recursive ? (c.fields.filter((g) => g.recursive).length > 1 ? `${'lr'[c.fields.filter((g, j) => g.recursive && j < k).length] ?? 't'}` : 't') : pool[k] ?? `x${k + 1}`;
    while (taken.has(base)) base += "'";
    taken.add(base);
    return base;
  });
}

/**
 * Definitions for every declaration. Constructor names are upper-cased; a name that clashes with
 * `reserved` (e.g. the prelude's SUCC or TRUE) gets the type name as a suffix: SUCC_NAT.
 */
export function generate(decls: DataDecl[], enc: Encoding, reserved: ReadonlySet<string> = new Set()): Generated {
  const lines: string[] = [];
  const names: string[] = [];
  const nameOf = new Map<string, string>();
  for (const d of decls) for (const c of d.ctors) nameOf.set(c.name, reserved.has(upper(c.name)) ? `${upper(c.name)}_${upper(d.name)}` : upper(c.name));
  const upperC = (c: string) => nameOf.get(c) ?? upper(c);
  const own = (n: string) => { let r = n; while (reserved.has(r)) r += '_'; return r; };
  for (const d of decls) {
    const caseNames = d.ctors.map((c) => { const n = lower(c.name); return n === 'let' || n === 'in' || n === 'v' ? `${n}_` : n; });
    // de-clash case names that equal type params etc.
    const cs = caseNames.map((n, i) => (caseNames.indexOf(n) !== i ? `${n}${i}` : n));
    const all = cs.join(' ');
    lines.push(`-- data ${d.name}${d.params.map((p) => ' ' + p).join('')} = ${d.ctors.map((c) => [c.name, ...c.fields.map((f) => f.type)].join(' ')).join(' | ')}`);
    lines.push(`-- ${ENCODINGS.find((e) => e.id === enc)!.name} encoding`);
    for (const [i, c] of d.ctors.entries()) {
      const taken = new Set(cs);
      const xs = fieldVars(c, taken);
      const args = c.fields.flatMap((f, k) => {
        if (!f.recursive || enc === 'scott') return [xs[k]];
        const rec = `(${xs[k]} ${all})`;
        return enc === 'church' ? [rec] : [xs[k], rec];
      });
      const binders = [...xs, ...cs].join(' ');
      const body = args.length ? `${cs[i]} ${args.join(' ')}` : cs[i];
      lines.push(`${upperC(c.name)} = λ${binders}.${body}`);
      names.push(upperC(c.name));
    }
    const elim = own(`${enc === 'church' ? 'FOLD' : enc === 'scott' ? 'CASE' : 'REC'}_${upper(d.name)}`);
    lines.push(`${elim} = λv ${all}.v ${all}   -- ${enc === 'church' ? 'the fold (catamorphism)' : enc === 'scott' ? 'case analysis' : 'primitive recursion'}`);
    names.push(elim);
    // SIZE: number of constructors in a value (shows how recursion works in each encoding)
    const size = sizeFunction(d, enc, own(`SIZE_${upper(d.name)}`));
    lines.push(size.line);
    names.push(size.name);
    const ex = example(d, upperC);
    const exName = own(`EXAMPLE_${upper(d.name)}`);
    if (ex) { lines.push(`${exName} = ${ex}`); names.push(exName); }
    lines.push('');
  }
  return { source: lines.join('\n').trimEnd() + '\n', names };
}

function sizeFunction(d: DataDecl, enc: Encoding, name: string): { name: string; line: string } {
  const cases = d.ctors.map((c) => {
    const taken = new Set<string>(['v']);
    const xs = fieldVars(c, taken);
    if (enc === 'scott') {
      const recs = c.fields.flatMap((f, k) => (f.recursive ? [`(${name} ${xs[k]})`] : []));
      const sum = recs.reduce((acc, r) => `PLUS ${wrap(acc)} ${r}`, '1');
      return xs.length ? `(λ${xs.join(' ')}.${sum})` : '1';
    }
    // church: recursive fields already hold the sizes; parigot: a sub-value and its size
    const params = c.fields.flatMap((f, k) => (f.recursive && enc === 'parigot' ? [`_${xs[k]}`, xs[k]] : [xs[k]]));
    const recs = c.fields.flatMap((f, k) => (f.recursive ? [xs[k]] : []));
    const sum = recs.reduce((acc, r) => `PLUS ${wrap(acc)} ${r}`, '1');
    return params.length ? `(λ${params.join(' ')}.${sum})` : '1';
  });
  return { name, line: `${name} = λv.v ${cases.join(' ')}   -- number of constructors${enc === 'scott' ? ' (recursive)' : ''}` };
}
const wrap = (s: string) => (s.includes(' ') ? `(${s})` : s);

/** A small value using every constructor once if possible. */
function example(d: DataDecl, upper: (c: string) => string): string | null {
  const base = d.ctors.find((c) => c.fields.every((f) => !f.recursive));
  if (!base) return null;
  const leafOf = (f: Field): string => {
    if (f.recursive) return base.fields.length ? `(${upper(base.name)} ${base.fields.map(leafOf).join(' ')})` : upper(base.name);
    const h = headOf(f.type);
    if (/^(Nat|Int|Integer|Num|Number)$/.test(h)) return '1';
    if (/^Bool/.test(h)) return 'TRUE';
    return '0';
  };
  const rec = d.ctors.find((c) => c.fields.some((f) => f.recursive));
  const top = rec ?? d.ctors[d.ctors.length - 1];
  return top.fields.length ? `${upper(top.name)} ${top.fields.map(leafOf).join(' ')}` : upper(top.name);
}

export const DATA_EXAMPLES: { name: string; src: string }[] = [
  { name: 'Binary tree', src: 'data Tree = Leaf | Node Tree Nat Tree' },
  { name: 'Natural numbers', src: 'data Nat = Zero | Succ Nat' },
  { name: 'Lists', src: 'data List a = Nil | Cons a (List a)' },
  { name: 'Booleans', src: 'data Bool = True | False' },
  { name: 'Maybe', src: 'data Maybe a = Nothing | Just a' },
  { name: 'Expressions', src: 'data Expr = Lit Nat | Add Expr Expr | Mul Expr Expr' },
];
