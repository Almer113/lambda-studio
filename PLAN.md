# Plan: "Lambda Studio", a Universal Lambda Notation Workbench

*Working title. It is one tool that does the job of an editor, creator, calculator, generator/exporter and converter for lambda calculus, with Tromp diagrams as its main view.*

Status: **draft for review**, 15 November 2026. Nothing has been built yet.
Background reading: [Lambda_Calculus_Research_Report.md](Lambda_Calculus_Research_Report.md), [Lambda_Calculus_Tools_Catalogue.md](Lambda_Calculus_Tools_Catalogue.md).

---

## 1. Goals and positioning

### 1.1 What it is
A **web app**, delivered as a static site with no backend, where you can:

1. **Write** a λ-term in any supported notation. The input format is detected automatically.
2. **See it** immediately as a Tromp diagram and in every other notation, all kept in sync.
3. **Edit and create** terms through text, through the diagram (select, apply, abstract, substitute a definition), or from a library of definitions.
4. **Compute**: step-by-step or full reduction under a chosen strategy, with history, animation and statistics.
5. **Convert** between notations, between λ and combinators, between data and its encodings, and between algebra/Boolean expressions and λ.
6. **Generate** terms: random, exhaustive enumeration, and encodings derived from a data type declaration.
7. **Export**: text in every format, SVG/PNG/animated GIF/WebM diagrams, LaTeX/TikZ, Typst, JSON, runnable JS/Python/Haskell, and shareable links.

### 1.2 Why it is new
The tools survey found these gaps, and this project fills them:

| Gap found in the survey | How this project fills it |
|---|---|
| No single hosted converter covering named, de Bruijn, BLC, SKI, Iota/Jot and Tromp diagrams | The core feature: every format kept in sync |
| No LaTeX/TikZ export for Tromp diagrams | TikZ exporter |
| No generator of Church/Scott encodings from a data type declaration | ADT → encodings generator |
| No converter between Boolean algebra / truth tables and Church booleans | Algebra and Boolean bridge |
| No λ → Jot converter | Jot encoder |
| Animation limited to a handful of apps | Animated β-steps plus GIF/WebM export |

### 1.3 Non-goals (for v1)
- Full dependent type checking (System F and CoC are possible later).
- A server, accounts, or a shared database.
- Parsing Tromp diagrams *back from images*. Diagram-based *editing* is in scope; recognizing pictures is not.
- Producing output identical, pixel for pixel, to every quirk of Tromp's own code. We match his *rules and metrics*, checked by tests (§9).

---

## 2. Platform and tech stack (recommended)

| Layer | Choice | Reason |
|---|---|---|
| Language | **TypeScript** (strict) | Type safety for an AST-heavy codebase |
| Build | **Vite** | Fast dev server; can produce a single self-contained HTML file for an Artifact or offline use |
| UI | **React 18** + small state store (**Zustand**) | Large ecosystem; fine for a multi-pane editor |
| Text editor | **CodeMirror 6** | Syntax highlighting, error markers, Unicode λ input, bracket matching |
| Diagram rendering | **SVG** for normal sizes, **Canvas 2D** fallback for huge terms | SVG gives crisp export and hover hit-testing; Canvas scales to tens of thousands of lines |
| Heavy computation | **Web Worker** | Reductions that run away don't freeze the UI; can be cancelled |
| Tests | **Vitest** + **fast-check** (property tests) | Round-trip and semantic-equivalence properties |
| GIF/WebM export | `MediaRecorder` (WebM) + `gifenc` (GIF) | Runs fully in the browser |
| Styling | CSS variables with light and dark themes | — |

Environment check: Node 24 and npm 11 are installed, and git is available. GHC is **not** installed, which affects how we validate against Tromp's Haskell tool (§9.3). The project folder is not yet a git repository, so step one is `git init`.

**Architecture rule:** the **core** (`src/core/`) is pure TypeScript with no DOM or React dependencies, so it can be tested in isolation and reused later as an npm library or a CLI. The UI is a thin layer on top of it.

---

## 3. Core data model

### 3.1 Term representation
Internally every term is **nameless (de Bruijn)**, with optional **name hints** kept for display:

```ts
type Term =
  | { tag: 'var'; index: number; hint?: string }          // 0-based de Bruijn index
  | { tag: 'free'; name: string }                          // free variable / unresolved name
  | { tag: 'lam'; hint?: string; body: Term }
  | { tag: 'app'; fn: Term; arg: Term }
  | { tag: 'ref'; name: string }                           // reference to a library definition (macro)
  | { tag: 'comb'; name: 'S'|'K'|'I'|'B'|'C'|'W'|'ι'|... }  // primitive combinator (in CL mode)
```

- **Why nameless:** α-equivalence becomes plain structural equality, capture-avoiding substitution is mechanical, and both BLC and Tromp diagrams are de Bruijn notations to begin with.
- **Name hints** keep the user's chosen names when printing named notation. A fresh-name generator avoids clashes (`x`, `x'`, `x₂`…).
- **`ref`** nodes keep definitions like `PLUS` folded for display. They can be expanded (δ-reduction) on demand or automatically during evaluation.
- **Node IDs:** each node gets a stable ID, used for hover linking between text and diagram, highlighting and animation tracking.
- **Hash-consing** (structural sharing plus memoized hashes) is planned so that large terms can be compared and deduplicated quickly.

### 3.2 Workspace model
```ts
interface Workspace {
  definitions: Map<string, Definition>;   // user + prelude
  documents: Doc[];                        // multiple terms/tabs
  settings: { strategy, eta, diagramStyle, colorMode, indexBase: 0|1, ... };
}
```
It is saved to `localStorage` (wrapped in try/catch), can be exported and imported as JSON, and can be shared through the URL hash (compressed term plus settings).

---

## 4. Notations: parsers and printers

Every format implements one interface: `{ id, name, detect(text): confidence, parse(text): Term | Errors, print(term, opts): string }`.

### 4.1 Format list

| # | Format | Example (identity / K) | Parse | Print | Phase |
|---|---|---|---|---|---|
| 1 | **Standard named** (`λ`, `\`, `^`, multi-arg `λx y.`, dot) | `λx.x` / `λx y.x` | ✔ | ✔ | 1 |
| 2 | **De Bruijn, 0-based** | `λ0` / `λλ1` | ✔ | ✔ | 1 |
| 3 | **De Bruijn, 1-based** (Tromp's convention) | `λ1` / `λλ2` | ✔ | ✔ | 1 |
| 4 | **BLC bits** | `0010` / `0000110` | ✔ | ✔ | 2 |
| 5 | **BLC8 / hex / base64 bytes** | packed bytes | ✔ | ✔ | 2 |
| 6 | **SKI / BCKW combinator strings** | `SKK` / `K` | ✔ | ✔ | 2 |
| 7 | **Unlambda** (backtick prefix) | `` ``skk `` | ✔ | ✔ | 2 |
| 8 | **Iota** (`*` application, `i`) | `*ii` | ✔ | ✔ | 2 |
| 9 | **Jot** (bitstring) | `11111…` | ✔ | ✔ | 2 |
| 10 | **Lazy K** (any of its 4 syntaxes) | — | ✔ | ✔ | 2 |
| 11 | **Haskell** | `\x -> x` | ✔ | ✔ | 2 |
| 12 | **JavaScript** | `x => x` | ✔ | ✔ | 2 |
| 13 | **Python** | `lambda x: x` | ✔ | ✔ | 2 |
| 14 | **Lisp / Scheme** | `(lambda (x) x)` | ✔ | ✔ | 2 |
| 15 | **Binary combinatory logic** (Tromp: `00`=K, `01`=S, `1`=app) | — | ✔ | ✔ | 3 |
| 16 | **LaTeX** | `\lambda x.\, x` | — | ✔ | 3 |
| 17 | **Tromp diagram ASCII / box characters** (like `blc diagram` / `boxchar`) | — | — | ✔ | 2 |
| 18 | **JSON AST** | — | ✔ | ✔ | 1 |
| 19 | **Wolfram `Function`** | `Function[x, x]` | ✔ | ✔ | 3 |

### 4.2 Parsing details
- **Hand-written recursive-descent parsers** with precise error locations, shown as CodeMirror diagnostics.
- **Sugar** (in named and de Bruijn modes):
  - number literals (`3` → Church 3, or Scott, per setting)
  - booleans (`true`/`false`)
  - lists `[a, b]`, pairs `(a, b)`, strings `"hi"` (as lists of Church-numeral code points, or BLC-style bit lists)
  - `let x = M in N` → `(λx.N) M`
  - definitions `NAME = term` on separate lines
- **Auto-detect:** each parser scores the input, and the highest score wins. The user can pin a format. Ambiguous inputs show a "detected as … (change)" chip, since `0010` could be BLC or de Bruijn digits.
- **Unicode:** `\lambda` and `\` are accepted for λ; the editor offers `\l` → `λ` autocompletion.
- **Round-trip guarantee:** for every lossless format, `parse(print(t)) ≡ t` (property-tested).

---

## 5. Converters (beyond printing)

### 5.1 λ ↔ combinators
- **Bracket abstraction algorithms**, chosen from a dropdown, with the output size of each shown side by side:
  1. Naive SKI (Schönfinkel/Curry)
  2. SKI + η-optimization
  3. Turner's SKIBC (+ S′, B*, C′)
  4. **Kiselyov** (2018) translation, as on Ben Lynn's page, linear or logarithmic
- **Combinators → λ:** expand S, K, I, B, C, W, … into their λ-definitions.
- **SKI → Iota / Jot / Unlambda / Lazy K / binary CL:** direct encodings.

### 5.2 Data ↔ encodings (encode and *decode*)
| Data | Encodings |
|---|---|
| Natural numbers | Church, Scott, Parigot, binary (Mogensen-style bit lists) |
| Booleans | Church (`K`, `KI`) |
| Pairs, Maybe, Either | Church and Scott |
| Lists, strings | Church (fold), Scott, BLC-style nested pairs |
| λ-terms themselves | Mogensen–Scott (for self-interpreters) |

**Decoding:** after evaluation the app *recognizes* normal forms and labels them, for example "= Church numeral 6", "= TRUE" or "= [1, 2, 3]". Results can also be re-folded into library names ("= PLUS", via α-equivalence lookup in the definitions).

### 5.3 Algebra and Boolean bridge (survey gaps #4 and #5)
- **Arithmetic expression → λ:** `(2 + 3) * 4 ^ 2` → `MULT (PLUS 2 3) (EXP 4 2)`. Then evaluate it and confirm the result decodes to 80.
- **Boolean expression → λ:** `(a ∧ ¬b) ∨ c` → `λa b c. OR (AND a (NOT b)) c`.
- **λ → truth table:** apply a term of *n* arguments to all 2ⁿ combinations of TRUE/FALSE and decode the results. Then show the truth table, the canonical DNF/CNF, and a simplified expression (Quine–McCluskey for small *n*).
- **λ → numeric function table:** apply the term to Church 0…N, decode, and show the table. Then **guess a closed form**: a polynomial by finite differences, or forms like 2ⁿ and n! by pattern matching. This is clearly labelled a *conjecture*.
- **Algebraic laws demo:** check identities such as `MULT = B` and `EXP m n = n m` by normalizing both sides and comparing them (βη).

### 5.4 Data type declaration → encodings (survey gap #4)
Input such as `data Tree = Leaf | Node Tree Nat Tree` generates:
- Church encoding: the constructors, plus the `fold`/catamorphism
- Scott encoding: the constructors, plus `case`
- Parigot encoding (both behaviours)

All of these are added to the library as definitions, with example terms.

### 5.5 Types (Phase 4)
- **Simple type inference** (Hindley–Milner without let) for untyped terms. It shows `I : a → a`, `K : a → b → a`, or "not simply typable" for `ω`.
- **Curry–Howard view:** show the inferred type read as a proposition.

---

## 6. Evaluator ("calculator")

### 6.1 Reduction
- **Strategies:** normal order (default), applicative order, call-by-name, call-by-value, head reduction, and *"pick a redex"* (the user clicks any redex in the text or the diagram).
- **Rules:** β always; η optional; δ (definition expansion) automatic or manual.
- **Two engines:**
  1. **Step engine:** explicit small-step reduction on de Bruijn terms using shift and substitute. It records every step so you can see each one, animate it, and step back.
  2. **Fast engine:** normalization by evaluation (NbE), or a Krivine/environment machine with sharing. It is used for "run to normal form" on large computations, then shows only the final result and statistics.
- **Safety:** step limit, size limit and time limit (all configurable). It runs in a Web Worker with a **Cancel** button. Detection of cycles (repeated term hashes) catches Ω and similar loops: "This term reduces to itself after 1 step".
- **History:** a timeline of every step, where you can click to jump to it. It can be exported as a reduction trace in any notation, or as LaTeX `\to_\beta` chains.

### 6.2 Statistics panel
Size (nodes), BLC bits, number of variables, depth, free variables, redex count, normal form yes/no/unknown, steps taken, maximum size during reduction, decoded value, inferred type.

### 6.3 Prelude library (built in)
- **Combinators:** I K S B C W Y Z Θ ω Ω
- **Booleans:** TRUE FALSE NOT AND OR XOR IF
- **Numerals:** 0…n SUCC PRED PLUS MULT EXP SUB ISZERO LEQ EQ FACT FIB DIV MOD
- **Pairs and lists:** PAIR FST SND, NIL CONS HEAD TAIL ISNIL MAP FOLD LENGTH APPEND RANGE
- Showcase programs from Tromp: the prime sieve and the 232-bit universal machine (to be checked against tromp/AIT before inclusion)

Each library definition has a short description and links to the research report.

---

## 7. Tromp diagram engine (the centrepiece)

### 7.1 Layout: standard style
The rules come from Tromp's page and the research report. Each λ is a horizontal line, each variable a vertical line hanging from its binder, and each application a horizontal link between the leftmost variables of function and argument.

The layout is computed recursively on the de Bruijn term and returns a box:
```
layout(t) → { width (variable columns), height (rows), segments[], anchorX }
```
- **Var**: one column, height 1. The vertical line runs from its binder's row (resolved by de Bruijn index) down to where it is consumed.
- **Lam**: height = body + 2. A horizontal bar on top spans the body's width.
- **App(f, a)**: place `f` and `a` side by side and pad them to equal height. Add a link row joining `anchorX(f)` and `anchorX(a)`, then continue `f`'s anchor down to the bottom.

Each variable column is 4 pixel units wide with a 1-unit gap, which gives **width = 4·vars − 1** and **height = 2·maxDepth + 1**, matching Tromp's published metrics.

**Free variables** (open terms) are drawn as lines sticking out of the top, as Tromp describes.

### 7.2 Alternative style
Applications link the **nearest deepest** variables, which gives the more compact and iconic look (Ω resembles an upside-down Ω). Plan:
1. Check the licence of `tromp/AIT`.
2. If it is compatible, port the `Diagram` (alternative) logic from `AIT.lhs` faithfully.
3. Otherwise, reimplement it from the published description and compare against his rendered images.

### 7.3 Rendering
- SVG with `<line>` / `<path>` elements, one per segment. Each element is tagged with the node ID of its term node.
- **Colour modes:**
  - monochrome (classic)
  - by binder: each λ and its variables share a hue
  - by depth
  - redex highlight: the function's λ in one colour, its bound variables in another, the argument in a third
  - Cruz Godar-style palettes
- **Interaction:** zoom and pan (wheel, pinch, buttons); hovering highlights the subterm in the diagram *and* the text (and the reverse); clicking selects a subterm; double-clicking a redex reduces it.
- **Annotations (optional):** variable names under lines, λ names next to bars, de Bruijn indices.
- **Large terms:** switch automatically to Canvas above a threshold (around 5k segments), with a "simplify" level of detail.
- **ASCII/box-drawing output** that mimics `blc diagram`/`boxchar`. This is useful for golden tests and for pasting into chat or code.

### 7.4 Animation of β-reduction
- **v1 (Tromp's frame sequence):** highlight the redex → show the bound variables and argument → make room → substitute → final term, as discrete frames with crossfades.
- **v2 (smooth morph):** each segment keeps a *lineage ID* through substitution (copies of the argument get `id#copyN`). Between frames, segments are tweened by ID: moved, grown, faded in or out. This gives a fluid animation where you can watch the argument "flow" into its variables.
- **Playback controls:** play, pause, step, speed, loop, and "animate the whole reduction to normal form".
- **Export:** animated GIF, WebM, PNG frame sequence (ZIP).

### 7.5 Diagram-based editing ("creator")
- Select a subterm, then: **wrap in λ** (abstract), **apply to…** (pick a term from the library or text), **replace with definition**, **delete**, **η-expand / η-reduce**, **fold into a named definition**.
- Drag a library item onto a variable line to substitute it.
- Each action updates the text representation, so editing is never diagram-only.

---

## 8. Generators and exporters

### 8.1 Generators
- **Random closed term of BLC size n:** sampled uniformly, using counts computed by dynamic programming over (size, number of free indices). The counts match OEIS A114852, which is used as a test.
- **Enumerate all closed terms of size n,** with a filter for "has a normal form within k steps". This gives a tiny **BBλ explorer** that reproduces the known small values (for example BBλ(21) = 22).
- **Random by other measures:** number of λs, number of variables, depth.
- **Generators from §5:** encodings from data type declarations, arithmetic and Boolean expressions.

### 8.2 Exporters
| Export | Content |
|---|---|
| Text | Any notation from §4 (copy button per format) |
| **SVG** | Diagram with optional colours and labels, with a transparent or solid background |
| **PNG** | Rendered at 1×, 2× or 4× scale |
| **GIF / WebM** | Reduction animation |
| **TikZ** (new) | `\begin{tikzpicture}`, one `\draw` per segment, colour options |
| **Typst** | `#tromp("…")` call for the `trompet` package, *and* a raw Typst drawing |
| **LaTeX** | Term with `\lambda`, reduction chains, ebproof typing derivation (once types exist) |
| **Markdown** | Term plus an embedded ASCII diagram plus the decoded result |
| **Code** | Runnable JS / Python / Haskell / Scheme translation of the term |
| **BLC file** | `.blc` bits, `.blc8` bytes, `.lam` source (compatible with tromp/AIT) |
| **JSON** | AST plus definitions plus settings (reimportable) |
| **Share link** | URL with the workspace in the hash (compressed) |

---

## 9. Correctness and testing strategy

### 9.1 Unit tests (Vitest)
- **Parsers:** every format, including edge cases (shadowing, Unicode, whitespace, comments, errors with correct positions).
- **Substitution:** capture-avoidance cases, e.g. `(λx.λy.x) y` → `λz.y`.
- **Strategies:** `K I Ω` normalizes under normal order and diverges under applicative order.
- **Arithmetic:** `PLUS 2 2 = 4`, `FACT 3 = 6`, `PRED 0 = 0`, `EXP 2 3 = 8`.

### 9.2 Property tests (fast-check)
- `parse_F(print_F(t)) ≡ t` for every lossless format F.
- **Bracket abstraction preserves meaning:** `toLambda(toSKI(t))` is βη-equal to `t` (within a step budget).
- **BLC size = 2 × lines + 4-way intersections** in our diagram for every term. This is Tromp's identity, and a powerful check that the layout is right.
- Diagram width = 4·vars − 1; height = 2·maxDepth + 1.
- Encoding and decoding round-trip for numerals, lists, booleans.

### 9.3 Golden tests against Tromp
- Known BLC encodings: `I` = `0010`, `K` = `0000110`, Church 2 = `0000011100111010`.
- Known counts: OEIS A114852 for small sizes; BBλ values for small n.
- **Diagram shapes:** GHC is not installed, so we cannot run `blc diagram` locally. Options, in order of preference:
  1. Install GHC/Stack once and generate golden ASCII outputs from tromp/AIT. This needs your OK, since it is a large download.
  2. Hand-transcribe a dozen diagrams from Tromp's page images (I, K, S, Y, Ω, numerals).
  3. Rely on the metric and identity properties in §9.2.

### 9.4 UI tests
Playwright smoke tests for the main flows (type → diagram → step → export), driven in the in-app browser pane during development.

---

## 10. UI layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Lambda Studio   [format: auto ▾] [strategy: normal ▾] [⟲ ⟳] [share] [☀/☾]│
├───────────────┬───────────────────────────────────┬──────────────────────┤
│ LIBRARY       │  EDITOR (CodeMirror)              │ CONVERSIONS          │
│ ▸ Combinators │  PLUS 2 3                         │ Named:   λf x.…      │
│ ▸ Booleans    │  ───────────────────────────────  │ de Bruijn: λλ…       │
│ ▸ Numerals    │  TROMP DIAGRAM (zoom/pan/hover)   │ BLC: 0000 0111 …     │
│ ▸ Lists       │                                   │ SKI: S(S(KS)K)…      │
│ ▸ My defs     │   ─────────────                   │ Unlambda / Iota / Jot│
│ + New def     │   ─┼───┼───┬─                     │ JS / Python / Haskell│
│               │    │   ├───┘                      │ LaTeX / TikZ / Typst │
│ GENERATORS    │    ├───┘                          ├──────────────────────┤
│ ▸ Random term │                                   │ INSPECTOR            │
│ ▸ ADT→encode  │  [◀ step] [▶ step] [▶▶ run] [■]   │ size 23 · BLC 58 bits│
│ ▸ Algebra→λ   │  [animate] [style ▾] [colour ▾]   │ NF: yes · = 5 (Church)│
│ ▸ Bool→λ      │  TIMELINE ●──●──●──●──○           │ type: (a→a)→a→a      │
│               │                                   │ [truth table][fn tbl]│
└───────────────┴───────────────────────────────────┴──────────────────────┘
```
- **Responsive:** on narrow screens the three columns become tabs (Editor / Diagram / Convert / Library).
- **Keyboard shortcuts:** `\` inserts λ; `Ctrl+Enter` runs; `→`/`←` step forward and back; `Space` plays or pauses the animation.
- **Guided tour / tutorial mode** (Phase 4): short lessons using the research report content (identity → booleans → numerals → Y), with exercises checked in the style of Elsa.

---

## 11. Project structure

```
lambda-studio/
├─ index.html
├─ package.json, tsconfig.json, vite.config.ts
├─ src/
│  ├─ core/                    ← pure TS, no DOM
│  │  ├─ term.ts               (AST, constructors, hashing, equality)
│  │  ├─ debruijn.ts           (shift, substitute, naming/fresh names)
│  │  ├─ reduce/               (strategies, step engine, NbE engine, limits)
│  │  ├─ formats/              (one file per notation: parse + print + detect)
│  │  ├─ combinators/          (bracket abstraction algorithms, CL encodings)
│  │  ├─ encodings/            (Church/Scott/Parigot encode + decode, ADT generator)
│  │  ├─ algebra/              (arith/boolean expr parsers, truth tables, fn tables, guesses)
│  │  ├─ types/                (simple type inference)
│  │  ├─ generate/             (counting, uniform random, enumeration, BBλ)
│  │  ├─ diagram/              (Tromp layout: standard + alt, segment model, metrics)
│  │  ├─ export/               (svg, tikz, typst, latex, ascii, code, json)
│  │  └─ prelude.ts            (built-in library)
│  ├─ worker/                  (evaluation worker + message protocol)
│  ├─ ui/                      (React components, stores, CodeMirror setup, theming)
│  └─ main.tsx
├─ tests/                      (unit, property, golden)
└─ docs/                       (user guide, format reference)
```

---

## 12. Milestones

| Milestone | Delivers | Usable outcome |
|---|---|---|
| **M0: Scaffold** | git init, Vite + React + TS, Vitest, lint, CI script, `.claude/launch.json` for preview | Empty app runs |
| **M1: Core** | AST, named + de Bruijn (0/1) + JSON formats, substitution, step engine with all strategies, prelude, limits, worker | Calculator in the console / tests |
| **M2: Diagrams + editor** | Tromp standard layout, SVG renderer, hover linking, redex highlight, ASCII output, CodeMirror editor, step/run/timeline UI | **First usable app:** type a term, see the diagram, step through reduction |
| **M3: Universal converter** | BLC/BLC8, SKI/BCKW (4 algorithms), Unlambda, Iota, Jot, Lazy K, Haskell/JS/Python/Lisp, auto-detect, conversions panel, encode/decode of data | The "universal notation" goal reached |
| **M4: Animation + export** | v1 frame animation, then v2 smooth morph; colour modes; alternative style; SVG/PNG/GIF/WebM/TikZ/Typst/LaTeX/code exports; share links | Publication-quality diagrams and videos |
| **M5: Algebra, generators, types** | Arithmetic/Boolean → λ, truth tables, numeric table + closed-form guess, ADT → encodings, random/enumerate/BBλ, type inference | All the "bridge" features |
| **M6: Creator + polish** | Diagram-based editing actions, drag-and-drop library, tutorial mode, Canvas renderer for huge terms, accessibility, mobile, docs, single-file build | Release candidate |

Each milestone ends with passing tests and a demo in the browser preview. After M2, each later milestone can be reviewed on its own.

---

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Diagram layout subtly differs from Tromp's | Metric and identity property tests; golden comparisons (§9.3); port AIT code if the licence allows |
| Term explosion (e.g. `FACT 10`) freezes the browser | Worker plus limits plus cancel; fast engine with sharing; Canvas renderer; "result too large to draw" fallback that still shows statistics |
| Format auto-detection is ambiguous (`0010`) | Confidence scores, a visible "detected as" chip, and pinning a format |
| Smooth morph animation is complex | Ship the v1 frame-based version first; v2 is an enhancement |
| Scope creep (this is a big feature list) | Strict milestone order; M2 is useful by itself; M5–M6 items can be cut |
| Licence of reused code (AIT, Kiselyov algorithm descriptions) | Implement from papers or specs; check licences before porting anything |
| "Closed form" guesses could be wrong | Always labelled as a conjecture, with the evidence table shown |

---

## 14. Delivery options

1. **Local dev app** in this folder, previewed in the in-app browser (default during development).
2. **Single-file build** (`vite-plugin-singlefile`): one HTML file that works offline. It can be **published as a private claude.ai Artifact** for sharing, or committed to GitHub Pages.
3. **Later:** publish the core as an npm package and/or a small CLI (`lstudio convert --from named --to blc`).

---

## 15. Decisions needed from you

1. **Tech stack:** React + TypeScript + Vite (recommended), or Svelte / vanilla TS?
2. **Name:** "Lambda Studio" (working title), or something else?
3. **First target:** build through **M2** (first usable app) and review, or go straight through M3 (universal converter)?
4. **Golden tests:** may I install GHC/Stack to generate reference diagrams from Tromp's AIT tool? It is a large download; without it we rely on hand-checked examples plus property tests.
5. **Hosting:** keep it local only, or also publish builds as a claude.ai Artifact or on GitHub Pages?
6. **Git:** may I `git init` this folder and commit at the end of each milestone?
