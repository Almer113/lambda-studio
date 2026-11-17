# Lambda Studio user guide

New to the λ-calculus? The **Tutorial** (the graduation-cap button in the header) opens on your first visit: ten short lessons load examples and check your progress. Press **?** for help, keyboard shortcuts, this guide and the notation reference.

## The screen

| Area | What it is for |
|---|---|
| **Library** (left, first tab) | Built-in definitions grouped by topic. Each name shows a short description; point at it for the full one and its definition. Click a name to insert it, or drag it onto a line of the diagram. Your own definitions are listed at the top. |
| **Encode data** (left, second tab) | Turns a number, Boolean, list, string, pair, Maybe or Either into a λ-term (Church, Scott, Parigot or binary). |
| **Source** (centre) | The editor. Type `\` for λ. The eye button shows a typeset preview underneath (off by default). |
| **Controls** | Step, back, play, run, fast normalizer, and a timeline of the steps taken. The bar stays at the top of the centre column while you scroll. |
| **Current term** | The term at the current step, as text or typeset. Click a part to select it for editing. The tag button turns names and numerals on and off. If the last line has a syntax error, the last definition is shown instead, with a note saying so. |
| **Tromp diagram** | The term as a diagram. Hover, click, double-click, zoom and pan. The legend under it explains the colours. |
| **Inspector** (right) | Status, decoded value, size, BLC bits, closedness and the simple type. |
| **Notations · Tools** (right, tabs) | Notations: the current term in every notation. One TeX/Text switch at the top typesets the λ notations; their copy menu copies as text or as LaTeX. Tools: pick one from the Tool menu: Expression → λ, truth tables, number tables, laws, data types, generators. |

The header holds the **File** menu (new, open and save a workspace, copy a share link, export), the **Examples** menu (grouped by topic, with one example for each input notation), the **Input** format and the **Strategy** menu (the reduction strategy and η). On the right: **Settings** (gear), the tutorial, help and the theme.

Icon buttons name themselves in a tooltip when you point at them or reach them with Tab.

On a phone the areas are behind the tabs **Edit · Diagram · Tools · Notations · Library**, and the input format, the strategy and η options, tutorial, help and theme are in the **⋯** menu. The Diagram tab shows the source as a one-line strip at the top: tap it to read it all, or **Edit the source** to go back to the editor. On phones and tablets the diagram keeps redex highlighting, fit and zoom in its toolbar; style, colours, animation and export are in its own **⋯** menu.

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
- Above about 6000 lines the diagram is drawn on a canvas. Hover and selection still work; zoomed out, lines blend into a grey overview.

## Building terms (the creator)

Select a subterm by clicking it in the diagram or the current term (or press an arrow key with the diagram focused, then use ↑ ↓ ← → to move). With the diagram focused, Enter β-reduces the selection and Delete removes it. The edit bar appears at the bottom of the window, over the centre column, with its actions in groups (Reduce, Wrap, Change, Name) divided by thin lines; **Parent** sits next to the selection. The page keeps room below so the bar does not cover the diagram. It offers:

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
- **Data types:** `data Tree = Leaf | Node Tree Nat Tree` → constructors, fold or case, and a SIZE function, in the Church, Scott or Parigot encoding.
- **Generate:** the number of closed terms of each size in bits (OEIS A114852), uniformly random terms, the list of all terms of a size, and BBλ, the largest normal form a term of that size reaches. Terms that do not finish within the step budget are counted as undecided, and the BBλ value is then a lower bound.

## Exporting and sharing

**File › Export…** (or the image button on the diagram) opens a dialog with:

- **Diagram:** SVG, PNG (1× to 16×), TikZ, Typst, or text art; light or dark, optionally transparent.
- **Animation:** GIF or WebM of any range of recorded steps.
- **Text & code:** reduction traces (named, de Bruijn, LaTeX `align*`), a Markdown summary, Tromp's `.lam`, `.blc` bits and `.blc8` bytes.
- **Workspace:** save the source, input format and settings as JSON, and open it again later.

**Settings** (the gear) holds the display options (numerals, how λt f.f is shown), the editor options and the limits for Run. Showing known parts by name is the tag button on **Current term**, the typeset preview is the eye button on **Source**, and the theme is the button at the right of the header. Settings are kept in this browser; **Reset all settings** restores the defaults.

**File › Copy share link** copies a URL with the source compressed into it (where the browser does not allow copying, the link is shown instead). Nothing is sent to a server: the whole app runs in your browser. Opening a share link replaces your source; the status bar then offers to restore the previous one, and the link is removed from the address bar so a later reload keeps your newer work.
