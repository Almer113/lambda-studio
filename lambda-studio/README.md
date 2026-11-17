# Lambda Studio

A browser workbench for the untyped λ-calculus: write a term in almost any notation, step through its reduction, watch John Tromp's diagram of it change, convert it to other notations, and export the results.

- **Guide:** [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- **Notations:** [docs/FORMATS.md](docs/FORMATS.md)

## The interface

- **Header:** File, Examples, the input format and a **Strategy** button that names the current choice ("Normal order", "… + η"). On the right: Settings, the tutorial, help and the theme.
- **Left column:** **Library** and **Encode data** as two tabs. Library rows show a short description; the full text is in the tooltip.
- **Centre column:**
  - **Source**, with starter examples when the source is empty. If a line has an error, the app says which definition it is showing instead.
  - **Playback:** Start, Back, Step, Play, Run and Normalize, a speed menu, and a timeline (with a tick per step for runs of up to 80 steps).
  - **Current term.**
  - **Tromp diagram:** it fills the remaining height, so the diagram and its legend fit a 1440×900 screen.
    - The next redex is outlined in pink (function), blue (argument) and yellow (link), while the lines keep their own colours.
    - Selecting a part dims the rest and boxes the selection.
- **Edit bar:** appears at the bottom when you select a subterm. It sits over the centre column, with its actions in groups (Reduce, Wrap, Change, Name); the page keeps room below it so it doesn't cover the diagram.
- **Right column:**
  - **Inspector.**
  - **Notations:** one TeX/Text switch for the panel, and a copy menu per row (text or LaTeX).
  - **Tools:** a **Tool** menu for Expression → λ, Truth table, Number table, Laws, Data types and Generate. When the term suits another tool (a Boolean function in the Number table, say), a note offers to switch.
- **Tablets** (640–860 px) get two columns, with a one-row diagram toolbar.
- **Phones:**
  - Sections are tabs: Edit, Diagram, Tools, Notations and Library.
  - The input format and strategy are in the **⋯** menu.
  - The Diagram tab shows the source as a strip you can expand.
  - The diagram toolbar fits on one row, with the rest in its own **⋯** menu.
- **Tutorial:** opens on the first visit, as a drawer on the right that moves aside when it covers what a lesson points at.

Light and dark themes follow the system or the theme button.

## Running it

```bash
npm install
npm run dev            # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm test` | Unit, property and golden tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright): layout at desktop, tablet and phone sizes, the edit bar, menus and tools |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build in `dist/` |
| `npm run build:single` | One self-contained `dist-single/index.html` (about 3 MB) that works offline, from a USB stick or as an e-mail attachment |

## Layout of the code

```
src/core/          pure TypeScript, no DOM: terms, parsers and printers, reduction,
                   diagrams, combinators, algebra tools, generators, types
src/core/formats/  one module per notation
src/core/diagram/  Tromp layouts (standard and alternative), SVG/TikZ/Typst, morphs
src/core/algebra/  expressions, truth tables, number tables, laws
src/worker/        background evaluation (step engine, fast normalizer, tools)
src/ui/            React interface; styles.css starts with the design tokens (control
                   heights, font sizes, radii, colours for both themes)
tests/             Vitest; tests/golden/tromp.json holds diagrams from Tromp's own tool
e2e/               Playwright browser tests
scripts/           make-golden.mjs regenerates the golden file (needs GHC and tromp/AIT)
```

## Credits

Diagrams follow John Tromp's description and are checked against the output of his [AIT](https://github.com/tromp/AIT) tools. Typesetting by [KaTeX](https://katex.org), math input by [MathLive](https://cortexjs.io/mathlive/), GIF encoding by [gifenc](https://github.com/mattdesl/gifenc).
