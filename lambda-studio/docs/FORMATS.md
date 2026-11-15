# Notations

Every notation below can be typed or pasted into the editor (auto-detected or chosen in the **Input** menu) and is shown for the current term in the **Notations** panel. The running example is Church 2, `λf x.f (f x)`.

## λ notations

| Notation | Example | Notes |
|---|---|---|
| Named λ | `λf x.f (f x)` | `\` or `λ`; `.` or `->`; definitions `NAME = term`; `let … in`; numerals, `[lists]`, `"strings"`; comments `--`, `//`, `#` |
| De Bruijn, 0-based | `λλ1 (1 0)` | index 0 is the nearest λ |
| De Bruijn, 1-based | `λλ2 (2 1)` | Tromp's convention |
| LaTeX | `\lambda f.\,\lambda x.\, f\,(f\,x)` | spacing commands are ignored; the TeX views can copy their LaTeX |

## Bits and data

| Notation | Example | Notes |
|---|---|---|
| Binary λ-calculus (BLC) | `0000011100111010` | λ = `00`, application = `01`, variable i (1-based) = `1`ⁱ`0` |
| BLC8 | `0x05 0x73 0xa0` | BLC packed into bytes, zero-padded; hex or base64 |
| JSON AST | `{"type":"lam","body":…}` | for tools and tests |

## Combinators

The λ → combinator translation uses bracket abstraction; choose the algorithm in the Notations panel (naive, SKI with η, Turner, Turner+, Kiselyov), which also shows the size each one produces.

| Notation | Example | Notes |
|---|---|---|
| SKI / combinators | `S K K` (identity) | S K I B C W and more; juxtaposition is application |
| Unlambda | `` ``skk `` (identity) | `` ` `` is application |
| Iota | `*ii` (identity) | one combinator ι = λf.f S K |
| Jot | `11100` (K) | bit strings; every string is a program |
| Binary combinatory logic | `11010000` (S K K) | K = `00`, S = `01`, application = `1` |
| Lazy K | `(SKK)` (identity) | the combinator syntax of Lazy K |

## Code

| Notation | Example |
|---|---|
| Haskell | `\f x -> f (f x)` |
| JavaScript | `f => x => f(f(x))` |
| Python | `lambda f: lambda x: f(f(x))` |
| Lisp / Scheme | `(lambda (f x) (f (f x)))` |
| Wolfram Language | `Function[f, Function[x, f[f[x]]]]` |

Programs in these languages may define names first (`const TWICE = …`, `def`, `(define …)`, `TWICE = …`) and end with an expression.

## Expressions (Tools → Expression → λ)

| Kind | Operators |
|---|---|
| Arithmetic | `+ − × ÷ mod ^ !` (`*`, `/`, `%`, `**` also work); subtraction is truncated at 0 |
| Comparison | `< ≤ > ≥ = ≠` (`<=`, `>=`, `==`, `!=`) |
| Logic | `∧ ∨ ¬ ⊕ → ↔` (`and or not xor`, `&& || !`, `-> <->`), `⊤ ⊥`, `true false` |
| LaTeX | `\cdot \times \frac{}{} x^{2} \land \lor \lnot \oplus \to \iff \le \ge \neq \bmod` |

## Exports

SVG, PNG, TikZ (`\usepackage{tikz}`), Typst, text diagrams, GIF, WebM, reduction traces in named, de Bruijn or LaTeX (`amsmath`), Markdown, Tromp's `.lam` (`\x.body`), `.blc`, `.blc8` and a JSON workspace file.
