# Lambda Studio user guide

**Open it:** <https://almer113.github.io/lambda-studio/>. It runs in your browser with nothing to install or sign up for, and your work stays on your device. To keep it as an app that works offline, see [Installing it](#installing-it-and-running-your-own-copy).

New to the λ-calculus? The **Tutorial** (the graduation-cap button in the header) opens on your first visit as a drawer at the right (on tablets and phones, along the bottom): ten short lessons load examples and check your progress. When the drawer covers what a lesson points at, it moves to the other side. Press **?** for help, keyboard shortcuts, this guide and the notation reference.

## The screen

| Area | What it is for |
|---|---|
| **Library** (left, first tab) | Built-in definitions grouped by topic. Each name shows a short description; point at it for the full one and its definition. Click a name to insert it, or drag it onto a line of the diagram. Your own definitions are listed at the top. |
| **Encode data** (left, second tab) | Turns a number, Boolean, list, string, pair, Maybe or Either into a λ-term (Church, Scott, Parigot or binary). |
| **Source** (centre) | The editor. Type `\` for λ. The eye button shows a typeset preview underneath (off by default). An empty source offers a few examples to start from: 2 + 3, Boolean logic, Definitions, Factorial 3, the Y combinator and Ω. |
| **Controls** | Start, Back, Step, Play, Run and Normalize, the **Speed** menu, and a timeline of the steps taken (with a tick per step for runs of up to 80 steps). The bar stays at the top of the centre column while you scroll. |
| **Current term** | The term at the current step, as text or typeset. Click a part to select it for editing. The tag button turns names and numerals on and off. If the last line has a syntax error, the last definition is shown instead, with a note saying so and a **Go to the error** link. |
| **Tromp diagram** | The term as a diagram. It takes the height the panels above leave, so the diagram and its legend fit the window. Hover, click, double-click, zoom and pan (a reminder sits in the corner of the drawing). The legend under it explains the colours. |
| **Inspector** (right) | Status, decoded value, size, BLC bits, closedness and the simple type. |
| **Notations · Tools** (right, tabs) | Notations: the current term in every notation. One TeX/Text switch at the top typesets the λ notations; their copy menu copies as text or as LaTeX. Tools: pick one from the Tool menu: Expression → λ, truth tables, number tables, laws, data types, generators. |

The header starts with the Lambda Studio logo: a λ whose long stroke is a staircase, for reduction one step at a time, followed by the name. On screens 1100 pixels wide or less only the λ is shown. The same mark is the browser tab's icon and the icon of the installed app. It is only the logo, not a button.

Then the header holds the **File** menu (new, open and save a workspace, copy a share link, export), the **Examples** menu (grouped by topic, with one example for each input notation), the **Input** format and the **Strategy** button, which names the current choice ("Normal order", or "Normal order + η") and opens the strategies with a line on each. On the right: **Settings** (gear), the tutorial, help and the theme.

On medium-width screens the Input menu drops its visible label (it says what it is). On a tablet (640 to 860 pixels wide) the page has two columns: the source, term and diagram on the left; the inspector, Notations, Tools, Library and Encode data on the right. The strategy, tutorial, help and theme move into the **⋯** menu, and the diagram toolbar keeps to one row (see below).

Icon buttons name themselves in a tooltip when you point at them or reach them with Tab.

On a phone the areas are behind the tabs **Edit · Diagram · Tools · Notations · Library**, and the input format, the strategy and η options, tutorial, help and theme are in the **⋯** menu. The Diagram tab shows the source as a one-line strip at the top: tap it to read it all, or **Edit the source** to go back to the editor. Under it come the playback controls and the diagram, with the current term below the diagram. On phones and tablets the diagram keeps redex highlighting, fit and zoom in its toolbar; style, colours, animation and export are in its own **⋯** menu.

## Writing terms

```
λx y.x                  -- or \x y. x, or \x y -> x
(λx.x x) (λy.y)         -- application is left-associative: f x y = (f x) y
TWICE = λf x.f (f x)    -- a definition, one per line
TWICE SUCC 0            -- the last expression is the one evaluated
FACT = λn.ISZERO n 1 (MULT n (FACT (PRED n)))   -- recursion is compiled with Y
let two = 2 in PLUS two two
[1, 2, 3]   "hi"        -- Church lists of numerals and of character codes
```

Numbers are Church numerals. Names in capitals come from the library. Your definitions shadow library ones in your own code, while library definitions keep their library meaning (redefining `SUCC` does not change `LENGTH`), and recursion is always compiled with the library's Y. With **Single-letter variables** on (in **Settings**), `λxy.xy` reads as `λx.λy.x y` (the names you define are kept whole).

The current term shows closed parts by name (your definitions first, then numerals and library names). At step 0, what you typed is shown as you typed it: only names and numbers you wrote are kept as names.

Paste a term in another notation and the input format is detected (the Input menu shows what was detected, and you can pin a format). See [FORMATS.md](FORMATS.md).

## Reducing

- **Step** contracts one redex chosen by the **Strategy** menu in the header (normal order by default; the menu describes each strategy). The next redex is highlighted. In the text it is shaded. In the diagram it is outlined, with a thin gap so the outline stands apart from the lines, which keep their own colours: a pink outline for its function λ and that λ's variables, blue for the argument and yellow for the application link.
- **Double-click** a redex in the text, the TeX view or the diagram to contract that one instead.
- **Play** steps automatically at the chosen **Speed** (1 to 30 steps a second). **Run** reduces to normal form in the background, recording up to 2000 steps; **Normalize** uses a much faster engine with sharing and records only the result.
- The **timeline** goes back to any earlier step. From there, Step and Play move forward along the recorded steps; contracting a redex of your choice (double-click, or β-reduce in the edit bar) starts a new branch, and Run or Normalize continue from that step and replace what came after it. An edit rewrites the source, so it starts a new timeline.
- Stepping clears the selection (it pointed into the previous term).
- Tick **η-reduction** in the Strategy menu to also contract η-redexes `λx.M x → M`.
- Limits (steps, term size) stop runaway terms, and loops like Ω are detected. When Run reaches a limit, the status bar offers to raise it and continue; the limits are also in **Settings**.

## The diagram

Each λ is a horizontal bar, each variable a vertical line from its binder's bar, each application a horizontal link between the function's and the argument's leftmost lines. The **Alternative** style is Tromp's compact variant.

- Hover a line to highlight the matching part of the term (and the other way round).
- Click a line to select its subterm (the rest of the diagram dims and the selected part gets a box); Ctrl + wheel or pinch to zoom (the zoom buttons zoom about the centre); drag to pan; the fit button fits the drawing again.
- Colour modes: by binder, by depth, by kind, or monochrome.
- With the film button (animate) on, each single β-step morphs smoothly from the old diagram to the new one. The crosshair button shows or hides the next redex.
- On phones and tablets the toolbar keeps the crosshair, fit and zoom buttons; the style, the colour mode, animation and export are in its **⋯** menu.
- Above about 6000 lines the diagram is drawn on a canvas. Hover and selection still work; zoomed out, lines blend into a grey overview.

## Building terms (the creator)

Select a subterm by clicking it in the diagram or the current term (or press an arrow key with the diagram focused, then use ↑ ↓ ← → to move). With the diagram focused, Enter β-reduces the selection and Delete removes it. The edit bar appears at the bottom of the window, over the centre column, with its actions in groups (Reduce, Wrap, Change, Name) divided by thin lines; **Parent** sits next to the selection. The page keeps room below so the bar does not cover the diagram (with auto-fit on, the diagram re-fits to the smaller space and grows back when you clear the selection). On a phone the buttons simply flow in rows, without dividers. It offers:

| Action | Effect |
|---|---|
| β-reduce | Contract the selected redex: a step on the timeline, like a double-click |
| Wrap in λ / Remove λ | `M → λx.M`, and back when x is unused |
| η-expand / η-reduce | `M → λx.M x`, and back |
| Apply to… / Pass to… | `M → M N` / `M → F M` with a term you type |
| Replace with… | Put another term in its place |
| Delete | Drop one side of an application |
| Name it… | Turn the subterm into a definition and use its name |

Dragging a library name onto a diagram line replaces that subterm with the definition. Clicking a library name inserts it at the cursor in the source; before you have clicked into the editor, it goes at the end of the main expression. Every other edit rewrites the source, so the text and the diagram never disagree. In named notation your definitions and leading comments are kept, and only names you already use are folded back in; a source in another notation (BLC, SKI, de Bruijn…) becomes named notation, keeping its leading comments.

## Tools

Choose a tool from the **Tool** menu. When the term suits another tool better (a Boolean function in the Number table, or a function on numbers in the Truth table), a note offers to switch.

- **Expression → λ:** type arithmetic or logic, e.g. `(2 + 3) * 4^2` or `(a ∧ ¬b) ∨ c`, as text, LaTeX, or with the **Math editor**. Closed expressions are evaluated both directly and as λ-terms, and the results are compared.
- **Truth table:** applies the current term to all combinations of TRUE/FALSE (up to 10 inputs) and gives the canonical DNF and CNF and a minimal formula.
- **Number table:** values on Church numerals 0…N for one or two arguments, with a guessed closed form. The guess is labelled a conjecture: it fits the table, it is not a proof.
- **Laws:** compares the βη-normal forms of two terms. Different normal forms mean different terms even if they agree on all numerals (Böhm's theorem).
- **Data types:** `data Tree = Leaf | Node Tree Nat Tree` → constructors, fold or case, and a SIZE function, in the Church, Scott or Parigot encoding. **Use as source** replaces the source with the definitions and a small example using them.
- **Generate:** the number of closed terms of each size in bits (OEIS A114852), uniformly random terms, the list of all terms of a size, and BBλ, the largest normal form a term of that size reaches. Terms that do not finish within the step budget are counted as undecided, and the BBλ value is then a lower bound.

## Exporting and sharing

**File › Export…** (or the image button on the diagram; on phones and tablets, **Export the diagram…** in the diagram's **⋯** menu) opens a dialog with:

- **Diagram:** SVG, PNG (1× to 16×), TikZ, Typst, or text art; light or dark, optionally transparent.
- **Animation:** GIF or WebM of any range of recorded steps.
- **Text & code:** reduction traces (named, de Bruijn, LaTeX `align*`), a Markdown summary, Tromp's `.lam`, `.blc` bits and `.blc8` bytes.
- **Workspace:** save the source, input format and settings as JSON, and open it again later.

**Settings** (the gear) holds the display options (numerals, how λt f.f is shown), the editor options and the limits for Run. Showing known parts by name is the tag button on **Current term**, the typeset preview is the eye button on **Source**, and the theme is the button at the right of the header (in the **⋯** menu on phones and tablets). Settings are kept in this browser; **Reset all settings** restores the defaults.

**File › Copy share link** copies a URL with the source compressed into it (where the browser does not allow copying, the link is shown instead). Nothing is sent to a server: the whole app runs in your browser. Opening a share link replaces your source; the status bar then offers to restore the previous one, and the link is removed from the address bar so a later reload keeps your newer work.

## Installing it, and running your own copy

The public site is <https://almer113.github.io/lambda-studio/>. To keep it as an app, install it from the browser: **Install** in the address bar in Chrome and Edge, *Add to Home screen* on Android, *Share › Add to Home Screen* in Safari. The installed app opens in its own window, works offline and updates itself when the site changes.

You can also run your own copy from the source (see the README for setup). `npm run deploy` builds a release into `deploy/`, and a small server serves it at `http://localhost:4180/`. From the app folder:

| Command | What it does |
|---|---|
| `node scripts/server-control.mjs start` | Starts serving the current release in the background (no window). If it is already running, it says so and does nothing. If another program has port 4180, it says so and starts nothing. |
| `node scripts/server-control.mjs stop` | Stops Lambda Studio's own server and nothing else. If it isn't running, it says so. |
| `node scripts/server-control.mjs status` | Says whether it is running, since when, which release, and who can reach it. Add `--json` for one line of JSON. |
| `node scripts/server-control.mjs listen network` | Lets other devices on the local network open it too (`listen local` goes back to this computer only). It restarts the server if it is running. |
| `npm run deploy` | Builds a new release and switches the running server to it at once. |

The server's log is `data/server.log` in the app folder. On Windows, a shortcut to `scripts/start-server.vbs` in the Startup folder starts it at logon. By default only this computer can open it. To let the other devices on your local network open it too, run `node scripts/server-control.mjs listen network` (and `listen local` to undo it). They then use `http://<this computer's address>:4180/`; on Windows the firewall must allow port 4180 on private networks. On such a plain `http://` address the app works, but the browser won't install it or keep it offline. The README explains this, and how to reach it securely from your other devices through Tailscale (at `https://<machine>.<tailnet>.ts.net:4180/`, the same port).

**Running the commands from other tools.** A scheduled task, a script or a dashboard can run the same three commands. They never open a window or wait for a key press.
- `start` and `stop` exit with 0 when they succeed, including when there was nothing to do. Otherwise they exit with 1, and their last line says why ("Port 4180 is used by another program.").
- `status --json` always exits with 0, and its last line is one line of JSON, for example `{"running":true,"ours":true,"pid":1234,"since":"…","version":"…"}`. When the server isn't running it is `{"running":false}`. When another program has the port it is `{"running":false,"ours":false}`.
- To check that the server answers, use `http://localhost:4180/api/health`. It returns a small JSON reply and changes nothing.

Settings and your source are kept separately for each address: the public site and your own copy each remember their own, and an installed app shares them with the site it was installed from.
