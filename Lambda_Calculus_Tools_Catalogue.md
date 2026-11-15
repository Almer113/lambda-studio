# Lambda Calculus Tools, Software and Resources: A Catalogue

*A survey of existing software, repos, web tools, guides, AI skills and communities for working with lambda calculus. It covers evaluation, conversion between notations and formalisms, visualization, and Tromp diagrams.*

Compiled 15 November 2026 from four parallel web surveys. Companion to [Lambda_Calculus_Research_Report.md](Lambda_Calculus_Research_Report.md).

**How to read the verification notes.** Most entries were checked by fetching the page, or (for GitHub repos) by querying the GitHub API on 2026-11-15, which is where the star counts (★) and "pushed" dates come from. Entries marked *(search)* were seen only in search results with a matching URL. Entries marked *(unverified)* could not be confirmed and may be dead or moved. No URLs were guessed.

---

## Contents

1. [Quick picks](#1-quick-picks)
2. [Web playgrounds and step-by-step reducers](#2-web-playgrounds-and-step-by-step-reducers)
3. [CLI interpreters and REPLs](#3-cli-interpreters-and-repls)
4. [Libraries and packages](#4-libraries-and-packages)
5. [Typed lambda calculi and type theory](#5-typed-lambda-calculi-and-type-theory)
6. [Binary Lambda Calculus (BLC)](#6-binary-lambda-calculus-blc)
7. [Lambda/combinator esolangs](#7-lambdacombinator-esolangs)
8. [Optimal and interaction-net evaluators](#8-optimal-and-interaction-net-evaluators)
9. [Compilers to lambda calculus and combinators](#9-compilers-to-lambda-calculus-and-combinators)
10. [Notation converters](#10-notation-converters)
11. [Tromp diagram builders and renderers](#11-tromp-diagram-builders-and-renderers)
12. [Other visualizers](#12-other-visualizers)
13. [Bridges: algebra, CAS, logic, Curry–Howard, categories](#13-bridges-algebra-cas-logic-curryhoward-categories)
14. [Type inference demos](#14-type-inference-demos)
15. [Guides, books, courses, videos](#15-guides-books-courses-videos)
16. [Practice, puzzles, code golf, sequences](#16-practice-puzzles-code-golf-sequences)
17. [AI: Claude skills, MCP servers, benchmarks, research](#17-ai-claude-skills-mcp-servers-benchmarks-research)
18. [Editor and typesetting support](#18-editor-and-typesetting-support)
19. [Communities, conferences, catalogues](#19-communities-conferences-catalogues)
20. [Conversion matrix: what converts to what](#20-conversion-matrix-what-converts-to-what)
21. [Gaps: what does not exist yet](#21-gaps-what-does-not-exist-yet)

---

## 1. Quick picks

| Need | Best tool | Why |
|---|---|---|
| Step through reductions in a browser | [Lambdulus](https://lambdulus.github.io) | A teaching evaluator that steps one reduction at a time, with breakpoints and macros |
| Check homework reductions | [Elsa](https://github.com/ucsd-progsys/elsa) (★194), [online](https://elsa.goto.ucsd.edu/index.html) | It checks that each step you wrote really is a valid reduction |
| Do everything in one environment | [Wolfram/Lambda paclet](https://resources.wolframcloud.com/PacletRepository/resources/Wolfram/Lambda/guide/Guide.html) | Converts between lambda, Wolfram `Function`, BLC, combinators, Church numerals and Haskell, and draws Tromp diagrams, trees and multiway graphs |
| The reference BLC implementation and diagram generator | [tromp/AIT](https://github.com/tromp/AIT) (★217, active) | Tromp's own `blc` tool: ASCII, box-character and PBM diagrams, BLC/BLC8 encodings, universal machines |
| Tromp diagrams in the browser | [Cruz Godar's applet](https://cruzgodar.com/applets/lambda-calculus/), [trompyst](https://gwennlbh.github.io/trompyst/), [Emergent Mind Lambda Diagrams](https://www.emergentmind.com/visualizations/lambda-diagrams), [lambda-calculus-visualizer](https://lambda-calculus-visualizer.vercel.app) | Animated or interactive diagrams |
| Tromp diagrams in documents | [trompet (Typst)](https://typst.app/universe/package/trompet) | Vector diagrams from a lambda string. No LaTeX/TikZ equivalent was found |
| Tromp-diagram reduction videos | [polux/lambda-diagrams](https://github.com/polux/lambda-diagrams) | Paul Brauner's Haskell tool that renders PNG frames, which you then encode to MP4 |
| Lambda → SKI and other combinators | [Ben Lynn's Kiselyov page](https://crypto.stanford.edu/~blynn/lambda/kiselyov.html), [ski-interpreter](https://dallaylaen.github.io/ski-interpreter/) | Optimized bracket abstraction in the browser |
| Rust/Python/JS library | [lambda_calculus crate](https://github.com/ljedrz/lambda_calculus) (★141), [lambda-calculus (PyPI)](https://pypi.org/project/lambda-calculus/), [lambda-calculus (npm)](https://www.npmjs.com/package/lambda-calculus) | Maintained building blocks |
| Real programs compiled to lambda | [LambdaCraft](https://github.com/woodrush/lambdacraft), [lambda-8cc](https://github.com/woodrush/lambda-8cc), [bruijn](https://github.com/marvinborner/bruijn) | Lisp DSL → BLC/SKI/JS/Python; a C compiler written as one lambda term; a de Bruijn language |
| Optimal / parallel evaluation | [HVM](https://github.com/HigherOrderCO/HVM1) (★11.4k), [Bend](https://github.com/bendlang/bend) (★25k), [Δ-Nets](https://deltanets.org/) | Interaction-net runtimes plus a visual explorer |
| Practice problems | [Codewars Lambda Calculus language](https://docs.codewars.com/languages/lambdacalc/) | Real katas written in pure λ |

---

## 2. Web playgrounds and step-by-step reducers

| Name | URL | What it does | Notes |
|---|---|---|---|
| Lambdulus | https://lambdulus.github.io | Step-by-step evaluator and debugger (FIT CTU Prague; SPLASH-E 2019). Engine: [lambdulus/core](https://github.com/lambdulus/core), npm `lambdulus` | Live, pushed 2026-09 |
| Lambda Explorer | https://lambdaexplorer.com · [repo](https://github.com/evinism/lambda-explorer) | Interactive tutorial and REPL | Live |
| Cambridge Lambda-Calculus Evaluator | https://www.cl.cam.ac.uk/~rmk35/lambda_calculus/lambda_calculus.html | Reducer in the browser | MIT licence |
| JacksonGL Lambda Interpreter | https://jacksongl.github.io/files/demo/lambda/index.htm | Interpreter that shows reduction steps | Live |
| Elsa online | https://elsa.goto.ucsd.edu/index.html | Checks reduction steps you write (UCSD CSE 130) | *(search)* |
| Ben Lynn's Lambda series | https://crypto.stanford.edu/~blynn/lambda/ | Interpreters in the browser for untyped λ, SK, System F (`systemf.html`), type operators (`typo.html`) and PTS (`pts.html`) | Excellent and deep |
| Tromp's Combinatory Logic Playground | https://tromp.github.io/cl/cl.html | Hub for BLC, combinatory logic (CL) and diagrams | Maintained |
| OpenDSA normal-order exercise | https://opendsax.cs.vt.edu/OpenDSA/AV/PL/tempNormalOrderPRO.html | Graded beta-reduction exercise (Virginia Tech) | Courseware |
| yanamal lambda-js | https://yanamal.github.io/lambda-js | Click-to-apply stepper with boolean examples | Live |
| Sestoft's reduction workbench | https://www.itu.dk/people/sestoft/lamreduce/ | Compares reduction strategies | *(search)* |
| Carl Burch Lambda Calculator | https://cburch.com/proj/lambda/ | Java teaching calculator | Old |
| Lambda Calculus Playground (Android) | https://github.com/alangpierce/LambdaCalculusPlayground | Visual Android app | Stale (2016) |
| beta-red | https://github.com/shrub719/beta-red | Small Rust web playground | New, small |

---

## 3. CLI interpreters and REPLs

| Name | URL | Language | Notes |
|---|---|---|---|
| pLam | https://github.com/slovnicki/pLam | Haskell | ★468. Pure λ for learning, with numeral shorthand |
| lc-js | https://github.com/tadeuzagallo/lc-js | JS | ★161. Written as a tutorial |
| sheepda | https://github.com/jtolio/sheepda | Go | ★83. Memoizing, byte I/O |
| Mikrokosmos | https://github.com/mroman42/mikrokosmos | Haskell | ★74. Optional types; runs in the browser |
| LCI | https://github.com/chatziko/lci · [site](https://www.chatzi.org/lci/) | C | ★72. Classic, with operators and numeral printing |
| rlci | https://github.com/orsinium-labs/rlci | Rust | ★71. Heavily documented |
| zhiayang/lambda | https://github.com/zhiayang/lambda | C++ | ★48 |
| lambster | https://github.com/minchingtonak/lambster | TS | ★42. Can **explain each step in English** |
| hallettj/LambdaCalculus | https://github.com/hallettj/LambdaCalculus | Scala | ★28 |
| lambda-php | https://github.com/igorw/lambda-php | PHP | ★23 |
| Nameless | https://github.com/ElliotPenson/Nameless | Python | ★20 |
| pylambdac | https://github.com/ciphergoth/pylambdac | Python | ★20. Also draws Tromp diagrams (§11) |
| Lambada | https://github.com/toadharvard/Lambada | OCaml | ★18. Choose the strategy: applicative order, call-by-name, call-by-value or normal order |
| ski-interpreter | https://github.com/dallaylaen/ski-interpreter | TS | ★18, active. SKI/BCKW plus λ |
| lambdascript | https://github.com/chuckcscccl/lambdascript | Rust | Shows every β- and α-step |
| ulc / io12 lambda / lambda-engine | [ulc](https://github.com/gregomni/ulc) · [io12](https://github.com/io12/lambda) · [lambda-engine](https://github.com/LRudL/lambda-engine) | Swift / C / Racket | Small |
| T3X lc (Nils Holm) | https://www.t3x.org/bits/lc.html | Scheme/C | Tiny interpreter with notes |
| lamb-engine / lambda-repl | [lamb-engine](https://pypi.org/project/lamb-engine/) · [lambda-repl](https://pypi.org/project/lambda-repl/) | Python (PyPI) | REPLs with macros |
| lambda-calculator (Hackage) | https://hackage.haskell.org/package/lambda-calculator | Haskell | REPL |

---

## 4. Libraries and packages

| Name | URL | Ecosystem | Notes |
|---|---|---|---|
| lambda_calculus | https://github.com/ljedrz/lambda_calculus | Rust crate | ★141, maintained. Parses classic and de Bruijn notation; **numbers into Church, Scott, Parigot, Stump-Fu and binary encodings**; several reduction strategies |
| lambda-calculus | https://pypi.org/project/lambda-calculus/ | PyPI | Build and normalize terms (Python 3.10 or later) |
| tablambda | https://pypi.org/project/tablambda/ | PyPI | Pure λ → Python modules |
| lambda-calculus | https://www.npmjs.com/package/lambda-calculus | npm | Minimal normalizer, v3.0.0 |
| VictorTaelin/lambda-calculus | https://github.com/VictorTaelin/lambda-calculus | JS | ★54. Fast implementation; `--to-bin` / `--from-bin` |
| @codewars/lambda-calculus | https://github.com/codewars/lambda-calculus | npm | Church, Scott or BinaryScott numeral encodings; `toInt`/`fromInt` |
| lambda (opam) | https://opam.ocaml.org/packages/lambda/ | OCaml | Library for lambda terms |
| BinaryLambdaCalculus.jl | https://github.com/phipsgabler/BinaryLambdaCalculus.jl | Julia | Stale |
| curryparty | https://pypi.org/project/curryparty/ · [repo](https://github.com/rambip/curryparty) | Python | SVG term rendering and reduction animation in notebooks (§11) |

---

## 5. Typed lambda calculi and type theory

| Name | URL | What | Notes |
|---|---|---|---|
| TAPL checkers | https://www.cis.upenn.edu/~bcpierce/tapl/checkers/ | Pierce's reference implementations: untyped, STLC, System F, F<: and more | OCaml, classic |
| PL Zoo | https://github.com/andrejbauer/plzoo · [site](https://plzoo.andrej.com) | Mini-languages: lambda, miniml, poly, levy | ★1601 |
| elaboration-zoo | https://github.com/AndrasKovacs/elaboration-zoo | NbE, dependent type checking, elaboration | ★811 |
| pi-forall | https://github.com/sweirich/pi-forall | Teaching dependently typed language | ★632, active |
| smalltt | https://github.com/AndrasKovacs/smalltt | Fast elaborator demo | ★609 |
| Morte | https://github.com/Gabriella439/Haskell-Morte-Library | Minimal Calculus of Constructions (CoC) | ★385 |
| LambdaPi | https://www.andres-loeh.de/LambdaPi/ | "Simply Easy" dependently typed λ | Tutorial paper and code |
| calculus-of-constructions | https://github.com/VictorTaelin/calculus-of-constructions | Minimal CoC in JS | ★117 |
| interaction-calculus-of-constructions | https://github.com/VictorTaelin/interaction-calculus-of-constructions | Proof checker | ★83 |
| typed-calc | https://github.com/mgechev/typed-calc | STLC in JS | ★35 |
| LICK | https://github.com/i-am-tom/LICK | STLC that is correct by construction (Idris) | ★39 |
| pts | https://github.com/Toxaris/pts | Pure type systems interpreter | ★21 |
| ttyped / coc (OCaml) / coc (Rust) | [ttyped](https://github.com/lambda-11235/ttyped) · [chrisroman/coc](https://github.com/chrisroman/coc) · [azdavis/coc](https://github.com/azdavis/coc) | Small CoC languages | — |
| elm-stlc | https://github.com/brendanzab/elm-stlc | Bidirectional STLC | ★15 |
| ts-lambda-calc | https://github.com/desi-ivanov/ts-lambda-calc | λ interpreter **written in TypeScript's type system** | Novelty |
| Type-Theory (tt) | https://type-theory.dev · [repo](https://github.com/vladyslav005/Type-Theory) | STLC through System F, λω and λP; derivation trees, **Curry–Howard view**, LaTeX/ebproof export | Active |
| PLFA, "Lambda" chapter | https://plfa.github.io/Lambda/ | STLC formalized in Agda | Book |
| Lambda Notebook | https://github.com/rawlins/lambda-notebook · [demo](https://rawlins.github.io/lambda-notebook/) | Typed λ for formal semantics in Jupyter | ★31, active |
| Penn/NYU Lambda Calculator | http://lambdacalculator.com/ · [docs](https://github.com/nyusemantics/LambdaCalculatorPublic) | Typed λ and Heim and Kratzer semantics exercises (linguistics) | Java desktop |
| normalization-bench / lambda-n-ways | [normalization-bench](https://github.com/AndrasKovacs/normalization-bench) · [lambda-n-ways](https://github.com/sweirich/lambda-n-ways) | Benchmarks of normalization and substitution implementations | Research |

---

## 6. Binary Lambda Calculus (BLC)

| Name | URL | What | Notes |
|---|---|---|---|
| tromp/AIT | https://github.com/tromp/AIT | Reference implementation: `blc` tool, universal machines, BLC/BLC8, programs, diagrams | ★217, pushed 2026-11 |
| Tromp's IOCCC 2012 entry | https://www.ioccc.org/2012/tromp/ | Obfuscated C BLC interpreter | Award winner |
| melvinzhang/binary-lambda-calculus | https://github.com/melvinzhang/binary-lambda-calculus | Annotated walkthrough of the IOCCC entry | ★36 |
| SectorLambda (Justine Tunney) | https://justine.lol/lambda/ · [jart/blc](https://github.com/jart/blc) | A ~383-byte x86-64 BLC virtual machine (a Krivine machine) | *(search)* for the site |
| lambda-calculus-devkit | https://github.com/woodrush/lambda-calculus-devkit | BLC, Universal Lambda and Lazy K interpreters plus `lam2bin` and `asc2bin` | ★17 |
| BLoC | https://github.com/marvinborner/BLoC | File format and optimizer for BLC | ★17 |
| ljedrz/blc | https://github.com/ljedrz/blc | Rust BLC; de Bruijn ↔ bits | Pushed 2026-06 |
| wedesoft/blc · sdiehl/bnlc · cl-blc | [wedesoft](https://github.com/wedesoft/blc) · [bnlc](https://github.com/sdiehl/bnlc) · [cl-blc](https://github.com/aartaka/cl-blc) | C / Python / Common Lisp | Mostly stale |
| binary-lambda-calculus-lang | https://github.com/AlexKnauth/binary-lambda-calculus-lang | Racket `#lang` | Pushed 2026-11 |
| blc-mb | https://github.com/iczelia/blc-mb | A BLC evaluator **written in Malbolge** | Novelty |
| Dependent-Binary-Lambda-Calculus | https://github.com/AHartNtkn/Dependent-Binary-Lambda-Calculus | Dependently typed BLC | — |
| Universal Lambda | https://golfscript.com/lam · [esolangs](https://esolangs.org/wiki/Universal_Lambda) | A golfing language based on BLC | — |
| Rosetta Code: Universal Lambda Machine | https://rosettacode.org/wiki/Universal_Lambda_Machine | Implement BLC in many languages | — |

---

## 7. Lambda/combinator esolangs

| Name | URL | Notes |
|---|---|---|
| Lazy K (original spec) | https://tromp.github.io/cl/lazy-k.html · [esolangs](https://esolangs.org/wiki/Lazy_K) | Ben Rudiak-Gould's pure lazy SKI/Iota/Jot language |
| irori/lazyk | https://github.com/irori/lazyk | Fast C interpreter. Accepts combinator, Unlambda, Iota and Jot syntax mixed together |
| msullivan/LazyK | https://github.com/msullivan/LazyK | Updated distribution |
| lazyk-rust | https://docs.rs/lazyk-rust/latest/lazyk_rust/ | Can print programs in each of the four syntax styles |
| hs2lazy | https://github.com/irori/hs2lazy | Haskell → Lazy K |
| Unlambda (official) | http://www.madore.org/~david/programs/unlambda/ · [esolangs](https://esolangs.org/wiki/Unlambda) | David Madore's language |
| Unlambda interpreters | [irori](https://github.com/irori/unlambda) · [hellerve](https://github.com/hellerve-pl-experiments/unlambda) · [louiswins](https://github.com/louiswins/unlambda) · [unlambda-rs](https://github.com/thomcc/unlambda-rs) · [coffee](https://github.com/replit-archive/unlambda-coffee) | C / Haskell / C / Rust / CoffeeScript |
| Iota and Jot | [Iota](https://esolangs.org/wiki/Iota) · [Jot](https://esolangs.org/wiki/Jot) · [Barker's original (archive)](https://web.archive.org/web/20181024173237/http://www.nyu.edu/projects/barker/Iota/) | One-combinator languages |
| Grass | https://esolangs.org/wiki/Grass | λ-language written with w/W/v characters |
| esolangs λ hub | https://esolangs.org/wiki/Lambda_calculus · [program repository](https://esolangs.org/wiki/Lambda-calculus_program_repository) | Index pages |

---

## 8. Optimal and interaction-net evaluators

| Name | URL | Notes |
|---|---|---|
| HVM1 / HVM2 / HVM3 | [HVM1](https://github.com/HigherOrderCO/HVM1) (★11.4k) · [HVM2](https://github.com/HigherOrderCO/HVM2) · [HVM3](https://github.com/HigherOrderCO/HVM3) | Victor Taelin's runtimes based on interaction combinators. `HigherOrderCO/HVM` now redirects to HVM1 |
| Bend | https://github.com/bendlang/bend | ★25k. High-level language on HVM, now "Bend 2" |
| BOHM 1.1 | https://github.com/asperti/BOHM1.1 | Asperti's Lamping-style optimal machine (C) |
| Lambdascope | https://hackage.haskell.org/package/graph-rewriting-lambdascope | Optimal evaluation with a GUI that visualizes the port graph (Jan Rochel) |
| graph-rewriting-ski | https://hackage.haskell.org/package/graph-rewriting-ski | Visual SKI graph-rewriting evaluators |
| Éole | https://github.com/HerrmannM/eole | Lévy-optimal evaluator without an oracle (Rust) |
| abstract-algorithm | https://github.com/VictorTaelin/abstract-algorithm | Lamping's abstract algorithm in JS, ★286 |
| Macro Lambda Calculus | https://github.com/codedot/lambda · [demo](https://codedot.github.io/lambda/) · [npm](https://www.npmjs.com/package/@alexo/lambda) | Interaction-net evaluator with Lamping and Lambdascope encodings |
| Optiscope | https://github.com/etiamz/optiscope | Lévy-optimal reducer in C. Renders each interaction step to Graphviz SVG |
| Δ-Nets | https://deltanets.org/ | **Interactive visual** Δ-Net reduction ([paper](https://arxiv.org/abs/2505.20314)) |
| inet-js | https://github.com/cicada-lang/inet-js | Interaction-net language with a canvas renderer *(search)* |

---

## 9. Compilers to lambda calculus and combinators

| Name | URL | Input → Output | Notes |
|---|---|---|---|
| LambdaCraft | https://github.com/woodrush/lambdacraft | Common Lisp DSL → BLC, SKI, Unlambda, JS, plain λ, AIT λ, Lisp, Python lambdas | Hikaru Ikuta. The most output formats of any tool here |
| LambdaLisp | https://github.com/woodrush/lambdalisp · [blog](https://woodrush.github.io/blog/lambdalisp.html) | A Lisp interpreter written as a single λ-term (BLC, Lazy K, Universal Lambda) | ★255 |
| lambda-8cc | https://github.com/woodrush/lambda-8cc | C → x86 / λ / BLC / SKI. The compiler is itself a λ-term | ★690 |
| LambdaVM | https://github.com/woodrush/lambdavm | Virtual CPU written in λ | ★72 |
| bruijn | https://github.com/marvinborner/bruijn · [site](https://bruijn.marvinborner.de) | De Bruijn-index language → BLC | ★146, active |
| Ben Lynn's compiler | https://github.com/blynn/compiler · [write-ups](https://crypto.stanford.edu/~blynn/compiler/) | Haskell subset → combinators (Kiselyov), self-hosting | Also an IOCCC 2019 entry |
| MicroHs | https://github.com/augustss/MicroHs · [Hackage](https://hackage.haskell.org/package/MicroHs) | Haskell → combinators, C runtime | Lennart Augustsson |
| mini-haskell | https://github.com/siraben/mini-haskell | Annotated version of Lynn's compiler | — |
| lambda-ski (thma) | https://github.com/thma/lambda-ski · [post](https://thma.github.io/posts/2023-10-08-Optimizing-bracket-abstraction-for-combinator-reduction.html) | Small language → SKI+BC → graph reduction; also a CCC backend | ★41 |
| sky | https://github.com/Superstar64/sky | λ → SKI bytecode, with C and Python runtimes | — |
| Matt Might, "Compiling up to λ" | https://matt.might.net/articles/compiling-up-to-lambda-calculus | Scheme subset → pure λ (Racket) | Article and code |
| pylambda | https://github.com/Checkmate50/pylambda | Small imperative language → λ | *(search)* |
| jambda-calc | https://unpkg.com/jambda-calc@0.6.1/readme.md | JS/TS → λ, plus Tromp-diagram PNG/SVG | Repo not found |
| js-to-lambda | https://www.npmjs.com/package/js-to-lambda | JS → λ | *(unverified)*, work in progress |
| unlambdascheme | https://github.com/helvm/unlambdascheme | Scheme subset → Unlambda | *(search)* |
| zk-phi/lambda_to_lazyk | https://github.com/zk-phi/lambda_to_lazyk | λ with sugar → Lazy K (Prolog) | — |
| LazyK-konn | https://github.com/helvm/LazyK-konn | Scheme-style λ → Lazy K | *(search)* |
| Tom Stuart, "Programming with Nothing" | https://tomstu.art/programming-with-nothing · [code](https://github.com/tomstuart/nothing) | FizzBuzz written with Ruby procs only | Famous talk |

---

## 10. Notation converters

| Name | URL | Conversions | Platform |
|---|---|---|---|
| Wolfram/Lambda paclet | https://resources.wolframcloud.com/PacletRepository/resources/Wolfram/Lambda/guide/Guide.html | λ ↔ Wolfram `Function`; λ ↔ BLC; λ ↔ combinators; integer ↔ Church; λ → Haskell; λ → Tromp diagram, tree and string diagram | Wolfram Language. **The broadest converter that exists** |
| timcsy/lambda | https://github.com/timcsy/lambda | Named ↔ de Bruijn ↔ BLC text ↔ BLC binary | CLI (`bin/lc`) |
| lambda_calculus (Rust) | https://github.com/ljedrz/lambda_calculus | Classic ↔ de Bruijn; numbers and lists → Church, Scott and Parigot (numbers also Stump-Fu and binary) | Rust |
| ljedrz/blc | https://github.com/ljedrz/blc | De Bruijn ↔ BLC | Rust |
| tromp/AIT `blc` | https://github.com/tromp/AIT | `.lam` → `.blc`/`.blc8`; diagram outputs; TeX text | Haskell/C |
| lam2bin (in lambda-calculus-devkit) | https://github.com/woodrush/lambda-calculus-devkit | Plain λ → BLC (by Justine Tunney) | C |
| bruijn | https://github.com/marvinborner/bruijn | De Bruijn → BLC | Haskell |
| Ben Lynn, Kiselyov translation | https://crypto.stanford.edu/~blynn/lambda/kiselyov.html | λ → B, R, S, I, K (with K/η optimizations and bulk combinators) | Browser |
| Ben Lynn, logarithmic SKI | https://crypto.stanford.edu/~blynn/lambda/logski.html | λ → SKI in O(n log n) size | Browser |
| Ben Lynn, semantic λ→CL | https://crypto.stanford.edu/~blynn/compiler/sem.html | λ → CL translation driven by semantics | Article |
| Ben Lynn, Combinatory Compiler | https://crypto.stanford.edu/~blynn/lambda/sk.html | λ → SK → WebAssembly | Browser |
| Ben Lynn, Crazy L | https://crypto.stanford.edu/~blynn/lambda/crazyl.html | Crazy L / Lazy K → combinators → WebAssembly; the article covers Iota, Jot and Unlambda output | Browser |
| ski-interpreter | https://dallaylaen.github.io/ski-interpreter/ | λ ↔ SKI (`toSKI` / `toLambda`), BCKW, Church numerals | Browser and JS |
| combinator-playground | https://github.com/dokutan/combinator-playground | λ → SKI / BCKW / SKIBC / SKIBC'; SKI ↔ BCKW; SKI → **iota**; SKI → **tree calculus** | Clojure |
| ngzhian/ski | https://github.com/ngzhian/ski | λ → SKI, then evaluates | OCaml |
| IotaBF | https://github.com/olligobber/IotaBF | λ → Iota | Haskell |
| lambda_to_lazyk | https://github.com/zk-phi/lambda_to_lazyk | λ → Lazy K | Prolog |
| irori/lazyk, lazyk-rust | see §7 | Read and print combinator, Unlambda, Iota and Jot syntax | C / Rust |
| combengine | https://combengine.sourceforge.net/README | λ → CL (can be adapted to Unlambda) | *(search)* |
| bufordrat/lambda | https://github.com/bufordrat/lambda | Typed λ DSL → **LaTeX** | OCaml |
| Type-Theory (tt) | https://type-theory.dev | Typing derivations → LaTeX/ebproof | Web |
| Codewars compiler | https://github.com/codewars/lambda-calculus · [encodings guide](https://github.com/codewars/lambda-calculus/wiki/encodings-guide) | Number literals → Church, Scott or BinaryScott | JS |
| Matt Might, Church encodings | https://matt.might.net/articles/church-encodings-demo-in-scheme | Hand-written encodings of booleans, numerals, lists and Y | Article |

---

## 11. Tromp diagram builders and renderers

| Name | URL | What it draws | Platform | Notes |
|---|---|---|---|---|
| Tromp's Lambda Diagrams page | https://tromp.github.io/cl/diagrams.html | The notation; reduction frames; prime sieve | Static plus EPSF | The hub, linking to most tools below |
| tromp/AIT `blc` | https://github.com/tromp/AIT | `diagram`/`Diagram` (ASCII), `boxchar`/`Boxchar` (Unicode box characters), `pbm`/`Pbm` (bitmap) | Haskell CLI | The canonical generator. Lowercase is the standard style, uppercase the alternative style |
| Cruz Godar's applet | https://cruzgodar.com/applets/lambda-calculus/ | **Animated, coloured** diagrams of reductions | Web | JavaScript-rendered; source not found |
| Wolfram/Lambda `LambdaDiagram` | (paclet above) | Tromp diagrams plus `LambdaTreeDiagram`, `LambdaSmiles`, `LambdaStringDiagram`, `SmoothLambdaStringDiagram`, `LambdaMultiwayGraph` and more | Wolfram | Used in Wolfram's [*The Ruliology of Lambdas*](https://writings.stephenwolfram.com/2025/09/the-ruliology-of-lambdas/) (2025) |
| polux/lambda-diagrams | https://github.com/polux/lambda-diagrams | Reduction animations as PNG frames for MP4 | Haskell | Paul Brauner; [videos](https://www.youtube.com/playlist?list=PLi8_XqluS5xc7GL-bgVrxpA2Uww6nK0gV). Last pushed 2018 |
| trompet | https://typst.app/universe/package/trompet · [repo](https://github.com/CrowdingFaun624/trompet) | `tromp("…")` inside Typst documents | Typst | Vector output, MIT licence, v0.1.1 (May 2026); built on [lambdabus](https://typst.app/universe/package/lambdabus/) |
| trompyst | https://gwennlbh.github.io/trompyst/ · [repo](https://github.com/gwennlbh/trompyst) | Diagrams from classic or de Bruijn input; shareable links | Web | — |
| lambda-calculus-visualizer | https://lambda-calculus-visualizer.vercel.app · [repo](https://github.com/spartypkp/lambda-calculus-visualizer) | Interactive diagrams with **animated β**; play/step/speed controls, zoom, minimap; arithmetic → λ | Next.js + D3 | — |
| Emergent Mind Lambda Diagrams | https://www.emergentmind.com/visualizations/lambda-diagrams | One β-step at a time with **morph animation**; hover highlights subterms; Y/Ω/SKK presets | JS canvas | Source linked from the page |
| jambda-calc | https://unpkg.com/jambda-calc@0.6.1/readme.md | JS/TS → λ → diagram **PNG/SVG** | npm CLI | Repo not found |
| pylambdac | https://github.com/ciphergoth/pylambdac | `draw` directive → PNG; also prints BLC bit size | Python | — |
| nikoof/lambda-diagrams | https://github.com/nikoof/lambda-diagrams | Closed terms | C + raylib | Early stage |
| curryparty | https://pypi.org/project/curryparty/ | SVG terms and `show_reduction` in Jupyter/marimo | Python | Tromp-like style *(unverified)* |
| 2swap's swaptube | https://github.com/2swap/swaptube | General GPU video renderer used for [*What is PLUS times PLUS?*](https://www.youtube.com/watch?v=RcVA8Nj6HEo) | C++/CUDA | ★~1.8k. Which code draws the λ scenes is *(unverified)* |
| Annotated lambda diagrams | http://apm.bplaced.net/w/index.php?title=Annotated_lambda_diagram | Variant notation with annotations | Wiki | Notation only |
| "How to draw lambda diagrams" | https://risingentropy.com/how-to-draw-lambda-diagrams/ | Tutorial | Blog | — |

**Not found:** no LaTeX/TikZ package, manim or Blender script, Shadertoy, p5.js sketch, Observable notebook or VS Code extension for Tromp diagrams.

---

## 12. Other visualizers

### Keenan, bubble and planar notations
| Name | URL | Notes |
|---|---|---|
| Dave Keenan, *To Dissect a Mockingbird* | http://dkeenan.com/Lambda/ | Notation with GIF animations; no software |
| Sylvia | https://hackage.haskell.org/package/sylvia · [repo](https://github.com/lfairy/sylvia) | Keenan-inspired GUI (GTK/Cairo). Archived 2020, no longer builds |
| Visual Lambda (Massalõgin) | https://bntre.github.io/visual-lambda/ · [repo](https://github.com/bntre/visual-lambda) · [itch.io](https://bntr.itch.io/visual-lambda) | **Bubble notation** with smooth animated β, drag-and-drop, puzzles. Revived for the web |
| λ-2D (Lingdong Huang, MIT) | [project page](https://www.media.mit.edu/projects/2d-an-exploration-of-drawing-as-programming-language-featuring-ideas-from-lambda-calculus/overview/) | Programming language you draw on a grid; [demo](https://l-2d.glitch.me) may be offline *(unverified)* |
| Lambda Circuitry (Chelsea Voss) | https://csvoss.com/circuit-notation-lambda-calculus | Circuit-style notation, hand-drawn |
| VEX (Citrin et al., 1995) | http://users.encs.concordia.ca/~haarslev/vl95www/html-papers/citrin/citrin.html | Paper *(unverified live)* |
| Lunarflow | https://github.com/lunarcast/lunarflow · [demo](https://lunarcast.github.io/lunarflow) | PureScript, archived |
| GraphLambda | https://ems.andrew.cmu.edu/2013/projects/samgruberinteractivegraphlambda/index.html · [repo](https://github.com/scgruber/GraphLambda) | Node-and-path graph notation |

### Alligator Eggs
| Name | URL | Notes |
|---|---|---|
| Bret Victor's original | https://worrydream.com/AlligatorEggs/ | Rules and printable images |
| propella/AlligatorEggs | http://metatoys.org/alligator/ · [repo](https://github.com/propella/AlligatorEggs) | Interactive animated calculator from typed terms |
| gator-calculus | https://tibordp.github.io/gator-calculus/ · [repo](https://github.com/tibordp/gator-calculus) | Click-to-eat game |
| lambda-gator | https://github.com/westoncb/lambda-gator | Animated JS version |
| LambdaGators | https://github.com/cerule7/LambdaGators | Pygame desktop app |
| Others | [rodeofly](https://github.com/rodeofly/AlligatorEggs) · [antoniomattar](https://github.com/antoniomattar/Lambda-Calculus-Interpreter-with-Alligators-and-eggs) | *(search)* |

### Trees, maps and reduction graphs
| Name | URL | Notes |
|---|---|---|
| vizlamb | https://github.com/brycec/vizlamb | d3 parse tree with animated eager reduction |
| lamviz-js (George Kaye) | https://georgejkaye.com/lambda-visualiser · [repo](https://github.com/georgejkaye/lamviz-js) | Terms as **rooted maps**/graphs, gallery, normalization graphs |
| Anagopos | https://github.com/bjornbugge/anagopos · [paper](https://ketemaj.home.xs4all.nl/publ/lambdavis.pdf) | Full **reduction graphs** with six layouts (Python 2, old) |
| Lambda Animator (Mike Thyer) | http://www.thyer.name/lambda-animator/ | Graph reduction with sharing, as a Java applet. Effectively dead (TLS errors) |
| Δ-Nets / Lambdascope / Optiscope | see §8 | Visualize optimal sharing graphs |

### Chemlambda and graphic lambda calculus (Marius Buliga)
| Name | URL | Notes |
|---|---|---|
| lambda2mol | https://mbuliga.github.io/quinegraphs/lambda2mol.html | λ → chemlambda "molecule", run as a d3 force-directed graph |
| quinegraphs | https://github.com/mbuliga/quinegraphs | JS library and demos |
| chemlambda-js | https://imar.ro/~mbuliga/chemlambda-js/chemlambda-js.html · [IC vs chem](https://imar.ro/~mbuliga/chemlambda-github/ic-vs-chem.html) · [index](https://imar.ro/~mbuliga/lambdalife.html) | Chemlambda and interaction combinators in d3 |
| Ports | [chemlambda-gui](https://github.com/chorasimilarity/chemlambda-gui) · [editor](https://github.com/ishanpm/chemlambda-editor) · [py](https://github.com/4lhc/chemlambda-py) · [hask](https://github.com/synergistics/chemlambda-hask) | Not individually checked |
| Graphic Lambda Calculus | https://arxiv.org/abs/1305.5786 | Formalism (paper) |

### Combinators (SKI)
| Name | URL | Notes |
|---|---|---|
| Wolfram Function Repository | [CombinatorPlot](https://resources.wolframcloud.com/FunctionRepository/resources/CombinatorPlot/) · [CombinatorEvolutionPlot](https://resources.wolframcloud.com/FunctionRepository/resources/CombinatorEvolutionPlot/) · [CombinatorEvolutionGraph](https://resources.wolframcloud.com/FunctionRepository/resources/CombinatorEvolutionGraph) · [CombinatorBracketsPlot](https://resources.wolframcloud.com/FunctionRepository/resources/CombinatorBracketsPlot/) | Tree, Mountain, Bush and Vee layouts; causal graphs |
| Wolfram combinators notebook | https://www.wolframcloud.com/obj/wolframphysics/Tools/combinators · [*Combinators: A Centennial View*](https://arxiv.org/abs/2103.12811) | *(search)* |
| ruski | https://rust-digger.code-maven.com/src/ruski-0.0.2/README.md | Rust SKI reducer that shares subtrees *(search)* |

### String diagrams
| Name | URL | Notes |
|---|---|---|
| sd-visualiser | https://github.com/sd-visualiser/sd-visualiser | λ-like language or MLIR → interactive **string diagrams** for closed monoidal categories |
| DisCoPy | https://pypi.org/project/discopy/ | General Python string-diagram toolkit |
| homotopy.io | https://homotopy.io | String-diagram proof assistant for higher categories *(unverified)* |

---

## 13. Bridges: algebra, CAS, logic, Curry–Howard, categories

| Name | URL | Bridge | Notes |
|---|---|---|---|
| Wolfram `Function` + Lambda paclet | https://reference.wolfram.com/language/ref/Function | λ ↔ CAS expressions (`LambdaFunction` / `FunctionLambda`) | The only direct λ ↔ CAS converter found |
| SymPy `Lambda` / `lambdify` | https://docs.sympy.org/latest/modules/core.html | Symbolic λ inside a CAS; expression → Python function | URL *(unverified)* |
| Maxima `lambda` | https://maxima.sourceforge.io/docs/manual/Function-Definition.html | Anonymous functions in a CAS | *(search)* |
| Compiling to categories (Conal Elliott) | https://github.com/compiling-to-categories/concat | Haskell λ → CCC morphisms → **circuits** (GraphViz), automatic differentiation, intervals, GLSL, SMT | ICFP 2017. The deepest λ ↔ algebra/circuit bridge |
| Clash | https://clash-lang.org/ | Haskell → VHDL/Verilog | Practical λ → digital logic |
| lambda-ski CCC backend | https://github.com/thma/lambda-ski | λ → CCC combinators | — |
| Type-Theory (tt) | https://type-theory.dev | Typing derivations shown as **propositional proofs** (Curry–Howard) | Proof → term is not built yet |
| Lean 4 `#print` | https://lean-lang.org/theorem_proving_in_lean4/propositions_and_proofs.html | Shows proofs as λ-terms | — |
| Rocq/Coq Extraction | https://coq.inria.fr/doc/master/refman/addendum/extraction.html | Proof terms → OCaml/Haskell/Scheme/JSON | — |
| Djinn | https://manpages.ubuntu.com/manpages/lunar/man1/djinn.1.html | Type (a proposition) → Haskell term, by proof search | — |
| Incredible Proof Machine | https://incredible.pm/ | Graphical natural-deduction proofs | Does not output λ-terms |
| PLFA | https://plfa.github.io/Lambda/ | λ formalized in Agda | — |

---

## 14. Type inference demos

| Name | URL | Notes |
|---|---|---|
| OTTIE | https://adamjones.me/ottie/ · [repo](https://github.com/domdomegg/ottie) | Step-by-step Hindley–Milner inference with algorithms W, W' and M, plus AST view |
| prakhar1989/type-inference | https://github.com/prakhar1989/type-inference | HM type inference in OCaml |
| TinyHM (Tomas Petricek) | https://tpetricek.github.io/teaching/2025/tiny-systems/tinyhm.html | Teaching implementation *(search)* |
| Ben Lynn's System F and PTS pages | https://crypto.stanford.edu/~blynn/lambda/ | Typed interpreters in the browser |

---

## 15. Guides, books, courses, videos

### Free texts and notes
| Title | URL |
|---|---|
| Rojas, *A Tutorial Introduction to the Lambda Calculus* | https://arxiv.org/abs/1503.09060 · [Tufts edition](https://www.cs.tufts.edu/comp/105-2019s/readings/rojas.pdf) |
| Selinger, *Lecture Notes on the Lambda Calculus* | https://arxiv.org/abs/0804.3434 |
| Barendregt & Barendsen, *Introduction to Lambda Calculus* | https://www.karlin.mff.cuni.cz/~krajicek/lambda.pdf (university mirror) |
| Stanford Encyclopedia of Philosophy, "The Lambda Calculus" | https://plato.stanford.edu/entries/lambda-calculus/ |
| Internet Encyclopedia of Philosophy, "Lambda Calculi" | https://iep.utm.edu/lambda-calculi/ |
| nLab, "lambda calculus" | https://ncatlab.org/nlab/show/lambda+calculus |
| Learn X in Y Minutes | https://learnxinyminutes.com/lambda-calculus/ |
| Brilliant wiki (no course exists) | https://brilliant.org/wiki/lambda-calculus/ |
| Tom Stuart, *Programming with Nothing* | https://tomstu.art/programming-with-nothing |
| Gabriel Lebec, *A Flock of Functions* | [notes](https://glebec.github.io/lambda-talk) · [repo](https://github.com/glebec/lambda-talk) · [slides](https://speakerdeck.com/glebec/lambda-as-js-or-a-flock-of-functions-combinators-lambda-calculus-and-church-encodings-in-javascript) |
| Matt Might's articles | [Church encodings](https://matt.might.net/articles/church-encodings-demo-in-scheme) · [Compiling up to λ](https://matt.might.net/articles/compiling-up-to-lambda-calculus) |
| Ben Lynn's series | https://crypto.stanford.edu/~blynn/lambda/ |
| Hindley & Seldin (paid textbook) | [CUP](https://www.cambridge.org/core/books/lambdacalculus-and-combinators/preface/A8E6261F5D932DED3B52FD246EA66D71) |

### Courses and exercises
| Course | URL |
|---|---|
| Aalto OpenCS, "Theory of Lambda Calculi" | https://opencs.aalto.fi/en/courses/programming-languages/part-5/1-overview |
| Tufts COMP105 λ homework | https://www.cs.tufts.edu/comp/105-2017s/homework/lambda.html |
| EPFL Foundations of Software, untyped λ exercise | https://lampwww.epfl.ch/teaching/foundations_of_software/exercises/2-untyped |
| Utah CS3520 encoding videos | https://my.eng.utah.edu/~cs3520/lambda-videos.html |
| Udemy beginner course (paid) | https://www.udemy.com/course/introduction-to-lambda-calculus-for-complete-beginners/ |

### Videos
| Video | URL |
|---|---|
| Computerphile, "Lambda Calculus" (Graham Hutton) | https://www.youtube.com/watch?v=eis11j_iGMs |
| 2swap, "What is PLUS times PLUS?" (Tromp diagrams) | https://www.youtube.com/watch?v=RcVA8Nj6HEo |
| Gabriel Lebec, Fullstack Academy talk | https://www.youtube.com/watch?v=3VQ382QG-y4 |
| Paul Brauner, reduction videos | https://www.youtube.com/playlist?list=PLi8_XqluS5xc7GL-bgVrxpA2Uww6nK0gV |

---

## 16. Practice, puzzles, code golf, sequences

| Resource | URL | Notes |
|---|---|---|
| Codewars "Lambda Calculus" language | https://docs.codewars.com/languages/lambdacalc/ · [authoring](https://docs.codewars.com/languages/lambdacalc/authoring) · [example kata](https://www.codewars.com/kata/5eecd4a5e5d13e000150e249) | Solve katas in pure λ |
| code.golf "Binary Lambda Calculus" hole | https://code.golf/binary-lambda-calculus | Golf a BLC normalizer. BLC is the task, not the language |
| Rosetta Code | [Church numerals](https://rosettacode.org/wiki/Church_numerals) · [Universal Lambda Machine](https://rosettacode.org/wiki/Universal_Lambda_Machine) | Solutions in many languages |
| Code Golf SE: write a λ interpreter | http://codegolf.stackexchange.com/questions/284/write-an-interpreter-for-the-untyped-lambda-calculus | *(unverified)* |
| OEIS A333479: BBλ | https://oeis.org/A333479 | Busy Beaver for λ |
| OEIS A361211, A385712 | [A361211](https://oeis.org/A361211) · [A385712](https://oeis.org/A385712) | BBλ variants |
| OEIS A114852, A195691 | [A114852](https://oeis.org/A114852) · [A195691](https://oeis.org/A195691) | Closed terms / normal forms by BLC size |
| OEIS A275057, A272794, A135501, A236405 | [A275057](https://oeis.org/A275057) · [A272794](https://oeis.org/A272794) · [A135501](https://oeis.org/A135501) · [A236405](https://oeis.org/A236405) | Term counts under other size measures; simply-typable terms |
| bbchallenge wiki, BBλ | https://wiki.bbchallenge.org/wiki/Busy_Beaver_for_lambda_calculus | Champions and proofs |
| Cube Composer | http://david-peter.de/cube-composer/ | Functional-programming puzzle game *(unverified)* |
| Alligator Eggs games | see §12 | — |

---

## 17. AI: Claude skills, MCP servers, benchmarks, research

### Claude skills (all community-made and unofficial)
| Name | URL | Notes |
|---|---|---|
| rainoftime/pl-skills | https://github.com/rainoftime/pl-skills | 98 SKILL.md files for programming-language research, including `lambda-calculus-interpreter`, `simply-typed-lambda-calculus` and [`system-f`](https://github.com/rainoftime/pl-skills/blob/HEAD/system-f/SKILL.md). **The README says they are LLM-generated and unverified** |
| plurigrid/asi | https://github.com/plurigrid/asi | About 1,360 skills, one listed as "lambda-calc" (the skill file itself was not opened) |
| ClaudSkills registry: System F | https://claudskills.com/skills/system-f/ | Registry entry for the skill above |

### MCP servers
| Name | URL | Notes |
|---|---|---|
| MCP-PIF | https://github.com/hungryrobot1/MCP-PIF | ★57. A metacircular λ-calculus evaluator in Haskell, served over MCP. **The only lambda calculus MCP server found** |

No MCP server exists that just β-reduces a term you give it. Other "lambda MCP" search results are about AWS Lambda.

### ChatGPT GPTs
"Lambda Guru" and "Lambda Tutor" appear only in third-party directories *(unverified)*. No official chatgpt.com/g links were found.

### Benchmarks and research
| Name | URL | Notes |
|---|---|---|
| LamBench / λ-bench (Victor Taelin) | https://github.com/VictorTaelin/LamBench · [results](https://victortaelin.github.io/LamBench/) | 120 pure-λ programming tasks for LLMs, graded on exact normal forms |
| *Towards a Neural Lambda Calculus* (Flach et al.) | https://arxiv.org/abs/2304.09276 | A transformer learns β-reduction (99.7% accuracy on one step) |
| *Towards Neural Functional Program Evaluation* | https://arxiv.org/abs/2112.04630 | T5 models evaluating λ-style programs |
| *The LLMbda Calculus* | https://arxiv.org/abs/2602.20064 | λ-calculus with an LLM-call primitive; security proofs in Lean |
| *The Y-Combinator for LLMs* (λ-RLM) | https://arxiv.org/abs/2603.20105 | λ-calculus as a runtime for long-context reasoning |
| *Opportunistically Parallel Lambda Calculus* | https://arxiv.org/abs/2405.11361 | Parallelizing scripts that call LLMs |
| *ChatGPT understands Operational Semantics* (blog) | https://blog.mikail-khan.com/post/chatgpt-operational-semantics | Informal test (2022); mostly unreliable |

No Hugging Face datasets of λ normalization examples were found.

---

## 18. Editor and typesetting support

| Tool | URL | Use |
|---|---|---|
| trompet (Typst) | https://typst.app/universe/package/trompet | Tromp diagrams |
| curryst (Typst) | https://typst.app/universe/package/curryst | Proof trees |
| bussproofs | https://ctan.org/pkg/bussproofs | LaTeX proof trees |
| ebproof | https://ctan.org/pkg/ebproof | Modern LaTeX proof trees |
| mathpartir | https://www.ctan.org/tex-archive/macros/latex/contrib/mathpartir | `\inferrule` for typing and reduction rules |
| lambda-lists | https://ctan.org/tex-archive/macros/generic/lambda-lists | λ-calculus computed in TeX macros (a curiosity) |
| lambdax | https://ctan.org/pkg/lambdax | LaTeX macros defined lambda-style |
| bufordrat/lambda | https://github.com/bufordrat/lambda | Typed λ → LaTeX |
| tree-sitter-elsa | https://lib.rs/crates/tree-sitter-elsa | Grammar for Elsa files |
| Lambdapi VS Code extension | https://lambdapi.readthedocs.io/en/latest/vscode.html | For the λΠ proof assistant |
| vscode-latex-input | https://github.com/YellPika/vscode-latex-input | Type `\lambda` to get λ anywhere in VS Code |
| unicode-latex (VS Code) | https://github.com/JuliaEditorSupport/unicode-latex | Same idea *(unverified)* |
| Vim digraphs | https://7id.xray.aps.anl.gov/software/vim/digraph.html | `Ctrl-K l*` gives λ |
| Emacs TeX input method | https://www.gnu.org/s/emacs/manual/html_node/emacs/Input-Methods.html | `\lambda` gives λ |

**Not found:** a VS Code extension, language server (LSP) or font/ligature set made specifically for plain λ-calculus.

---

## 19. Communities, conferences, catalogues

| Name | URL | Notes |
|---|---|---|
| Prathyush Pramod's catalogue of visual λ notations | https://github.com/prathyvsh/lambda-calculus-visualizations | The best index of graphical notations |
| awesome-lambda-calculus | https://github.com/mireklzicar/awesome-lambda-calculus | *(unverified)*: the direct fetch returned 404, so the repo may have moved |
| r/lambdacalculus | https://www.reddit.com/r/lambdacalculus | *(unverified)*, seen only through a mirror |
| TYPES mailing list / announcements / Zulip | [list](https://lists.seas.upenn.edu/mailman/listinfo/types-list) · [announce](https://lists.seas.upenn.edu/mailman/listinfo/types-announce) · [Zulip](https://typ.zulipchat.com/) | Research community |
| Lean Zulip λ thread | [archive](https://leanprover-community.github.io/archive/stream/217875-Is-there-code-for-X%3F/topic/Lambda.20Calculus.20and.20its.20variations.html) | Formalizing λ in Lean |
| FSCD conference | https://fscd-conference.org/ | Successor to TLCA and RTA |
| TLCA (historical) | https://duch.mimuw.edu.pl/~urzy/tlca/tlca.html | Typed Lambda Calculi and Applications, now ended |

No Discord server dedicated to λ-calculus was found.

---

## 20. Conversion matrix: what converts to what

Rows are the source format and columns the target format. Each cell names tools that do that conversion; "—" means no dedicated tool was found.

| From \ To | de Bruijn | BLC | SKI/BCKW | Iota/Jot/Unlambda/Lazy K | Tromp diagram | LaTeX/Typst | CAS / algebra | Church/Scott data |
|---|---|---|---|---|---|---|---|---|
| **Named λ** | timcsy/lambda, lambda_calculus (Rust), Wolfram | timcsy/lambda, lam2bin, AIT, Wolfram, LambdaCraft | Lynn (Kiselyov/logski), ski-interpreter, combinator-playground, ngzhian/ski, Wolfram | IotaBF (Iota), lambda_to_lazyk, LambdaCraft (Unlambda, Lazy K), combinator-playground (iota) | AIT, Wolfram, Godar, trompyst, visualizer apps, pylambdac | trompet (Typst), bufordrat/lambda (LaTeX) | Wolfram `FunctionLambda` | lambda_calculus (Rust), Codewars |
| **de Bruijn** | — | ljedrz/blc, bruijn, AIT | (via named) | — | trompyst | — | — | — |
| **BLC** | timcsy/lambda, ljedrz/blc | — | — | — | AIT (via `.lam`) | — | — | — |
| **SKI** | — | — | SKI ↔ BCKW: combinator-playground | combinator-playground (iota); Lazy K tools | — | — | — | — |
| **Real languages** | — | LambdaCraft, lambda-8cc, LambdaLisp | MicroHs, Lynn's compiler, sky, lambda-ski | hs2lazy, unlambdascheme, LazyK-konn | jambda-calc | — | concat (→ circuits) | — |
| **Integers / lists** | — | Wolfram | — | — | — | — | — | lambda_calculus (Rust), Codewars, Wolfram |
| **Types / propositions** | — | — | — | — | — | Type-Theory (ebproof) | — | Djinn (type → term) |

### Example pipelines

- **Named term → BLC bits → Tromp diagram (CLI):** write a `.lam` file, then use `tromp/AIT`'s `blc` actions (`blc`, `diagram`/`boxchar`/`pbm`).
- **Named term → animated diagram video:** `polux/lambda-diagrams` renders PNG frames, then `ffmpeg` encodes them to MP4.
- **Lisp/C → λ → BLC/SKI:** LambdaCraft or lambda-8cc.
- **λ → combinators → WebAssembly in the browser:** Ben Lynn's Combinatory Compiler.
- **λ ↔ CAS expressions, plus every diagram type:** the Wolfram/Lambda paclet.
- **Paper or report with diagrams:** Typst with `trompet` for diagrams and `curryst` for proof trees.

---

## 21. Gaps: what does not exist yet

All four surveys reported these as missing:

1. **No single hosted "universal converter"**: nothing on the web converts between named, de Bruijn, BLC, SKI, Iota/Jot and Tromp formats in one place. The Wolfram paclet comes closest but needs the Wolfram Language.
2. **No LaTeX/TikZ package for Tromp diagrams.** Only Typst (`trompet`) covers this.
3. **No manim, Blender, p5.js, Shadertoy or Observable tools** for Tromp diagrams. Animation is limited to Godar's applet, the Emergent Mind page, the Vercel visualizer and Brauner's frame renderer.
4. **No Church/Scott encoding generator** that takes an arbitrary algebraic data type declaration.
5. **No converter between Boolean algebra, truth tables or circuits and Church booleans**, in either direction.
6. **No dedicated λ → Jot converter.**
7. **No proof → λ-term generator** in the Type-Theory tool (planned there). Djinn only covers type → term.
8. **No dedicated β-reduction MCP server.** MCP-PIF is the only λ-related one, and the Claude skills that exist are LLM-generated and unverified.
9. **No VS Code extension, LSP, font, Discord server, Exercism track or Hugging Face dataset** dedicated to λ-calculus.

Any of these would be a genuinely new contribution.
