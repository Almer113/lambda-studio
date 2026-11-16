// Tutorial lessons. Text uses a tiny markup: blank line = paragraph, `code`, **bold**.

import type { ToolsTab } from './store';
import { useStore, currentTerm } from './store';
import { decodeNumeral, decodeBool } from '../core/encodings';
import { findRedex } from '../core/reduce';

type St = ReturnType<typeof useStore.getState>;

export interface LessonStep {
  text: string;
  /** Source to load with the "Load" button (replaces the editor). */
  load?: string;
  /** Tools tab to open. */
  tool?: ToolsTab;
  /** CSS selector of a panel to point at. */
  focus?: string;
  goal?: { text: string; check: (s: St) => boolean };
}
export interface Lesson { id: string; title: string; steps: LessonStep[] }

const num = (s: St) => { const t = currentTerm(s); return t ? decodeNumeral(t) : null; };
const isNormal = (s: St) => { const t = currentTerm(s); return !!t && findRedex(t, s.settings) === null; };

export const LESSONS: Lesson[] = [
  {
    id: 'syntax', title: '1. Terms', steps: [
      { text: 'The λ-calculus has three kinds of terms: **variables** like `x`, **abstractions** `λx.M` (a function with parameter x and body M) and **applications** `M N` (M applied to N).\n\nType `\\` in the editor and it becomes λ. Application binds tightest and associates to the left: `f x y` means `(f x) y`. A λ reaches as far right as it can: `λx.x y` means `λx.(x y)`.', load: '-- the identity function\nλx.x', focus: '.editor-panel' },
      { text: 'Several parameters can share one λ: `λf x.f (f x)` is short for `λf.λx.f (f x)`. Names in capitals such as `PLUS` or `TRUE` come from the **Library** on the left; you can define your own with `NAME = term`.', load: 'TWICE = λf x.f (f x)\nTWICE TWICE', focus: '.library' },
    ],
  },
  {
    id: 'beta', title: '2. β-reduction', steps: [
      { text: 'Computation is one rule, **β-reduction**: `(λx.M) N` → M with N substituted for x. The part `(λx.M) N` is a **redex**.\n\nPress **Step** (or Alt+→). The next redex is highlighted: the function in pink, the argument in blue.', load: '(λx.x x) (λy.y)', focus: '.controls', goal: { text: 'Take a step', check: (s) => s.history.length > 1 } },
      { text: 'Keep stepping until no redex is left: the term is then in **normal form**. You can also double-click any redex (in the text or the diagram) to reduce that one instead, and drag the timeline to go back.', goal: { text: 'Reach the normal form', check: isNormal } },
    ],
  },
  {
    id: 'diagrams', title: '3. Tromp diagrams', steps: [
      { text: "John Tromp's diagrams draw a term with lines: each **λ is a horizontal bar**, each **variable a vertical line** hanging from the bar of the λ that binds it, and each **application a horizontal link** joining the leftmost lines of the function and the argument.\n\nHover over the diagram: the matching part of the term lights up, and the other way round.", load: 'λf x.f (f x)', focus: '.diagram-panel', goal: { text: 'Hover over a line of the diagram', check: (s) => s.hover !== null && s.hoverSource === 'diagram' } },
      { text: 'Step through a reduction with the diagram in view: each β-step is animated, and you can watch the argument flow into the places where the variable was. Try the **Alternative** style and the colour modes in the diagram toolbar.', load: '(λx.x x) (λf y.f (f y))', focus: '.diagram-panel', goal: { text: 'Reach the normal form', check: isNormal } },
    ],
  },
  {
    id: 'numerals', title: '4. Numbers', steps: [
      { text: '**Church numerals** represent n as "apply f n times": `2 = λf x.f (f x)`. Digits in the source are Church numerals, and results are recognised and shown as numbers.\n\nPress **Run** to reduce to normal form.', load: 'PLUS 2 3', focus: '.controls', goal: { text: 'Compute 2 + 3', check: (s) => num(s) === 5 } },
      { text: 'Multiplication is composition, and exponentiation is plain application: `EXP 2 3 = 3 2`. Try `MULT 3 4` or `EXP 2 5`. The **Number table** tool shows a function on 0, 1, 2, … and guesses a formula.', load: 'λn.MULT n n', tool: 'table', focus: '.side-panel' },
    ],
  },
  {
    id: 'booleans', title: '5. Truth values', steps: [
      { text: '`TRUE = λt f.t` and `FALSE = λt f.f` choose between two arguments, so `IF b x y` is just `b x y`. AND, OR and NOT are short terms built on that.', load: 'AND TRUE (NOT FALSE)', goal: { text: 'Evaluate it to TRUE', check: (s) => { const t = currentTerm(s); return !!t && decodeBool(t) === true; } } },
      { text: 'The **Truth table** tool applies a term to every combination of TRUE and FALSE and finds a minimal formula. In **Expression → λ** you can type a formula like `(a ∧ ¬b) ∨ c` and get its λ-term.', load: 'XOR', tool: 'truth', focus: '.side-panel' },
    ],
  },
  {
    id: 'recursion', title: '6. Recursion', steps: [
      { text: 'A λ-term cannot refer to itself by name, but a **fixed-point combinator** makes recursion possible: `Y f = f (Y f)`. When a definition mentions its own name, the studio compiles it with Y for you, as in `FACT`.\n\nRun it.', load: 'FACT 3', focus: '.controls', goal: { text: 'Compute 3!', check: (s) => num(s) === 6 } },
    ],
  },
  {
    id: 'strategies', title: '7. Order matters', steps: [
      { text: '`Ω = (λx.x x) (λx.x x)` reduces to itself forever. `K I Ω` throws Ω away, but only if the outer redex is reduced first. **Normal order** (leftmost-outermost) always finds a normal form when one exists.\n\nRun it with normal order, then switch the Strategy to **Applicative order** and run again.', load: 'K I Ω', focus: '.header', goal: { text: 'Reach the normal form', check: isNormal } },
    ],
  },
  {
    id: 'notations', title: '8. Other notations', steps: [
      { text: 'The **Notations** panel shows the current term in every notation the studio knows: de Bruijn indices, binary λ-calculus, SKI combinators, Iota, Jot, and code in Haskell, JavaScript, Python and more. Each can also be typed into the editor; the input format is detected automatically.', load: 'λx y.y x', focus: '.col-right' },
      { text: 'Any term can be written with just S and K. Paste this SKI term into the editor and run it: it is the same function as `λx y.y x`.', load: 'S (K (S I)) K' },
    ],
  },
  {
    id: 'creator', title: '9. Building terms', steps: [
      { text: 'Click a line of the diagram or a part of the current term to **select** it. The edit bar then offers actions: wrap in λ, apply to something, η-expand, give it a name, and more. Each action rewrites the source.\n\nYou can also drag a name from the Library onto a line of the diagram to put it there.', load: 'λx.x', focus: '.current', goal: { text: 'Select a subterm', check: (s) => s.selected !== null } },
    ],
  },
  {
    id: 'types', title: '10. Types', steps: [
      { text: 'Many terms have a **simple type**: `K = λx y.x` has type `a → b → a`. The Inspector shows the principal type. Read as logic (Curry–Howard), a type is a proposition and the term is its proof: K proves A ⇒ B ⇒ A.\n\nSelf-application `λx.x x` has no simple type: x would need a type a = a → b.', load: 'K', focus: '.inspector' },
    ],
  },
];
