# Lambda Studio

A browser workbench for the untyped λ-calculus: write a term in almost any notation, step through its reduction, watch John Tromp's diagram of it change, convert it to other notations, and export the results.

- **Guide:** [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- **Notations:** [docs/FORMATS.md](docs/FORMATS.md)

## Running it

```bash
npm install
npm run dev            # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm test` | Unit, property and golden tests (Vitest) |
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
src/ui/            React interface
tests/             Vitest; tests/golden/tromp.json holds diagrams from Tromp's own tool
scripts/           make-golden.mjs regenerates the golden file (needs GHC and tromp/AIT)
```

## Credits

Diagrams follow John Tromp's description and are checked against the output of his [AIT](https://github.com/tromp/AIT) tools. Typesetting by [KaTeX](https://katex.org), math input by [MathLive](https://cortexjs.io/mathlive/), GIF encoding by [gifenc](https://github.com/mattdesl/gifenc).
