<p>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="lambda-studio/docs/assets/lockup-horizontal-dark.svg">
    <img src="lambda-studio/docs/assets/lockup-horizontal.svg" alt="Lambda Studio" width="360">
  </picture>
</p>

**A workbench for the untyped λ-calculus, in your browser.** Write a λ-term, step through its reduction one β-step at a time, and watch John Tromp's diagram of it change as you go. Convert it to a dozen other notations, check what it computes, and export pictures, animations and LaTeX.

**[Open Lambda Studio](https://almer113.github.io/lambda-studio/)**: nothing to install or sign up for.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="lambda-studio/docs/assets/screenshot-dark.png">
  <img src="lambda-studio/docs/assets/screenshot-light.png" alt="Lambda Studio reducing MULT 2 3: the source, the playback controls, the current term, its Tromp diagram with the next redex outlined, the library on the left and the term in other notations on the right" width="100%">
</picture>

## What you can do with it

- **Write terms the way you know them.** Named λ (`λf x.f (f x)`, or `\` for λ), de Bruijn indices, LaTeX, binary λ-calculus, SKI and other combinators, or code in Haskell, JavaScript, Python, Scheme or the Wolfram Language. It detects the notation as you type. Definitions (`PLUS = …`), numerals, lists and strings work too.
- **Watch it reduce.** Step forward and back, play the steps, or run to the normal form. Choose the strategy: normal order, applicative order, call-by-name, call-by-value or head reduction, with or without η. The next redex is highlighted in the text and in the diagram.
- **See it as a Tromp diagram.** λs are horizontal lines, variables hang down from their λ, and applications join them. Click any part to select it, double-click a link to reduce it there, and zoom and pan.
- **Edit it directly.** Select part of a term to reduce it, wrap it in a λ, apply it, replace it or give it a name. Drag names from the library onto the diagram.
- **Find out what it computes.** The inspector shows the decoded value (a numeral, a Boolean, a list), the size, the binary length and the simple type. The tools turn arithmetic and logic into λ-terms, make truth and number tables, check laws, encode data types, and count and generate terms.
- **Export it.** Diagrams as SVG, PNG, TikZ or Typst. Animations as GIF or WebM. Reduction traces in LaTeX or Markdown. Share a term as a link.
- **Learn as you go.** A ten-lesson tutorial opens on your first visit, and a library has the standard combinators, Booleans, numerals, pairs and lists.

## How it works

Everything runs in your browser. Terms are parsed, reduced and drawn on your own device, in background threads so the page stays responsive, and nothing is sent to a server. Share links carry the term in the link itself. Your work and settings are saved in your browser.

On a computer or a phone you can install it as an app (**Install** in the address bar in Chrome or Edge, *Add to Home screen* on Android, *Share › Add to Home Screen* in Safari). The installed app opens in its own window, works offline, and updates itself when a new version is published.

The [user guide](lambda-studio/docs/USER_GUIDE.md) explains every part of the screen, and [the notation reference](lambda-studio/docs/FORMATS.md) lists what it reads and writes.

## Download and run it yourself

You only need this to change the code or run your own copy; the [website](https://almer113.github.io/lambda-studio/) has everything otherwise.

1. Install [Node.js](https://nodejs.org) 20 or newer, and [git](https://git-scm.com).
2. Download the code and install what it needs:

   ```bash
   git clone https://github.com/Almer113/lambda-studio.git
   cd lambda-studio/lambda-studio
   npm install
   ```

3. Start it, then open <http://localhost:5173>:

   ```bash
   npm run dev
   ```

**To get updates later:** in the same folder, run `git pull`, then `npm install`, and start it again.

**Other ways to run it:**
- **A single file:** `npm run build:single` makes one `index.html` (about 3 MB) that works offline, from a USB stick or as an e-mail attachment.
- **A permanent copy on your own computer:** `npm run deploy`, with a small server for it.

The [app's README](lambda-studio/README.md) covers both, plus the tests and how the GitHub Pages site is built.

## What's in this repository

| Folder or file | What it is |
|---|---|
| [`lambda-studio/`](lambda-studio/) | The app: source, tests and docs |
| [`PLAN.md`](PLAN.md) | The plan it was built from |
| [`Lambda_Calculus_Research_Report.md`](Lambda_Calculus_Research_Report.md) | Background: how the λ-calculus works, its notations and diagrams |
| [`Lambda_Calculus_Tools_Catalogue.md`](Lambda_Calculus_Tools_Catalogue.md) | Other λ-calculus tools |

## Credits and licence

The diagrams follow [John Tromp's lambda diagrams](https://tromp.github.io/cl/diagrams.html), and are checked against the output of his [AIT](https://github.com/tromp/AIT) tools. Typesetting by [KaTeX](https://katex.org), math input by [MathLive](https://cortexjs.io/mathlive/), editor by [CodeMirror](https://codemirror.net), GIF encoding by [gifenc](https://github.com/mattdesl/gifenc).

Lambda Studio is released under the [MIT licence](LICENSE).
