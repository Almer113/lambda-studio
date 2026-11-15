# Lambda Calculus: A Comprehensive Research Report

*How it works, how it relates to ordinary algebra, its notations and visualizations (including John Tromp's lambda diagrams), and the ideas around it.*

Compiled 15 November 2026.

---

## Table of Contents

1. [TL;DR](#1-tldr)
2. [History and Origins](#2-history-and-origins)
3. [Syntax: The Whole Language in Three Rules](#3-syntax-the-whole-language-in-three-rules)
4. [Computation: Substitution and Reduction](#4-computation-substitution-and-reduction)
5. [Programming with Nothing but Functions (Church Encodings)](#5-programming-with-nothing-but-functions-church-encodings)
6. [Recursion and Fixed-Point Combinators](#6-recursion-and-fixed-point-combinators)
7. [Computability, Undecidability and Key Theorems](#7-computability-undecidability-and-key-theorems)
8. [Combinatory Logic: Lambda Calculus without Variables](#8-combinatory-logic-lambda-calculus-without-variables)
9. [How Lambda Calculus Relates to Traditional Algebra](#9-how-lambda-calculus-relates-to-traditional-algebra)
10. [Typed Lambda Calculi and the Curry–Howard Correspondence](#10-typed-lambda-calculi-and-the-curryhoward-correspondence)
11. [Notations](#11-notations)
12. [Visualizations, Including John Tromp's Lambda Diagrams](#12-visualizations-including-john-tromps-lambda-diagrams)
13. [John Tromp's Wider Work: BLC, Kolmogorov Complexity, Busy Beavers](#13-john-tromps-wider-work-blc-kolmogorov-complexity-busy-beavers)
14. [Implementing Lambda Calculus: Machines and Evaluation](#14-implementing-lambda-calculus-machines-and-evaluation)
15. [Influence: Programming Languages, Logic, Linguistics and More](#15-influence-programming-languages-logic-linguistics-and-more)
16. [Variants and Extensions](#16-variants-and-extensions)
17. [Glossary](#17-glossary)
18. [Further Reading and Sources](#18-further-reading-and-sources)

---

## 1. TL;DR

- **Lambda calculus (λ-calculus)** is a formal system made by Alonzo Church in the early 1930s. It has three kinds of expression: *variables*, *function definitions* (abstractions, `λx.M`) and *function applications* (`M N`). It has one main computation rule, **β-reduction**, which substitutes an argument into a function body.
- Even with nothing but anonymous one-argument functions, it is **Turing-complete**. Numbers, booleans, pairs, lists and recursion can all be *encoded* as functions.
- It is one of the three founding models of computation, with Turing machines and Gödel–Herbrand–Kleene recursive functions. All three compute exactly the same functions, which is the basis of the **Church–Turing thesis**.
- Its relationship to **algebra** goes deep. β-reduction is the same "plug the value into the formula" substitution you learn in school, made precise. Bound variables behave like the `x` in `∫ f(x) dx` or `Σᵢ`. The calculus can be presented as an *equational theory*, and its variable-free form, **combinatory logic**, is literally a first-order algebra (a *combinatory algebra*). Church-numeral arithmetic turns algebra into structure: multiplication *is* function composition, and exponentiation *is* function application.
- **Typed** λ-calculi correspond exactly to systems of logic (**Curry–Howard**: propositions are types, proofs are programs) and to **cartesian closed categories** (Lambek). They underlie the proof assistants Rocq (Coq), Lean and Agda, and the languages Haskell and ML.
- **Notations** range from Church's original, through **de Bruijn indices** (nameless, numeric), to **Binary Lambda Calculus**, Unlambda, Iota and modern `x => …` arrow syntax.
- **John Tromp's lambda diagrams** are a graphical notation. Each **λ is a horizontal line**, each **variable is a vertical line** hanging down from its binding λ, and each **application is a horizontal link** joining the leftmost variables of function and argument. Other visual systems include Dave Keenan's *To Dissect a Mockingbird*, Bret Victor's *Alligator Eggs*, Massalõgin's bubble notation, and graph/interaction-net representations.

---

## 2. History and Origins

### 2.1 Pre-history: functions as objects

| Year | Event |
|---|---|
| 1879–1893 | **Gottlob Frege** treats functions as mathematical objects and introduces "course-of-values" notation for the extension of a function. He already notes that multi-argument functions can be reduced to single-argument ones, an early form of what became *currying*. |
| 1910–13 | **Whitehead & Russell**, *Principia Mathematica*, use a circumflex, `x̂`, for class abstraction (`x̂ φ(x)`, "the class of x such that φx"). This is the usual explanation of where Church's λ came from. |
| 1924 | **Moses Schönfinkel**, *Über die Bausteine der mathematischen Logik*, introduces **combinators** (including what we now call S and K) and shows that bound variables can be eliminated entirely. He also uses the currying trick. |
| 1927–30 | **Haskell Curry** independently rediscovers combinators and develops **combinatory logic** (dissertation 1930). "Currying" is named after him, though Schönfinkel (and Frege before him) had the idea first. |

### 2.2 Church and the birth of λ

| Year | Event |
|---|---|
| 1932–33 | **Alonzo Church** (Princeton), *A Set of Postulates for the Foundation of Logic*. λ-notation first appears as part of a broader system meant as a foundation for logic and mathematics. |
| ~1932 | **Stephen Kleene**, Church's student, finds the predecessor function on Church numerals. Supposedly the idea came to him at the dentist's while under anaesthetic (an anecdote retold by Barendregt and Crossley). Before this, Church doubted that predecessor could be defined at all. |
| 1935 | **Kleene–Rosser paradox**: Kleene and J. B. Rosser show that Church's original logical system is *inconsistent*. Church keeps the purely functional core, the **untyped λ-calculus**, which is consistent. |
| 1936 | **Church–Rosser theorem** (confluence): the result of a computation does not depend on the order of reductions. |
| 1936 | Church, *An Unsolvable Problem of Elementary Number Theory*. He proposes that "effectively calculable" means "λ-definable" (Church's thesis) and proves that β-equivalence is undecidable. This is the first explicit undecidable problem, and with it he settles Hilbert's *Entscheidungsproblem* in the negative, shortly before Turing. |
| 1936–37 | **Alan Turing**, *On Computable Numbers*. Turing machines are introduced, and in a 1937 paper Turing proves that Turing-computability equals λ-definability. Turing then does his PhD under Church at Princeton. |
| 1937 | Turing gives the fixed-point combinator **Θ**. |
| 1940 | Church, *A Formulation of the Simple Theory of Types*: the **simply typed λ-calculus**. |
| 1941 | Church, *The Calculi of Lambda-Conversion* (monograph). |

**Why "λ"?** The standard story is typographical: Russell's `x̂` became `∧x` (the hat moved in front of the letter because printers could not easily put it over), and that was then read as the Greek capital and then lowercase lambda, `λx`. Church himself gave inconsistent accounts. In a late letter he reportedly said the choice was more or less arbitrary ("eeny, meeny, miny, moe"). Cardone and Hindley's history discusses both versions.

### 2.3 Revival and computer science (1950s–1970s)

| Year | Event |
|---|---|
| 1958 | **John McCarthy** designs **LISP**, borrowing `LAMBDA` from Church. He later admitted he "had not understood" all of the λ-calculus, and early LISP used dynamic rather than lexical scope. |
| 1958 | Curry & Feys, *Combinatory Logic, Vol. I*. Curry also notices the correspondence between combinator types and axioms of implicational logic. |
| 1964–66 | **Peter Landin**: the **SECD machine** (*The Mechanical Evaluation of Expressions*, 1964) and ISWIM (*The Next 700 Programming Languages*, 1966). He argues that λ-calculus is a model of programming languages. |
| 1968 | **Corrado Böhm**: Böhm's separability theorem. |
| 1969 | **Dana Scott** builds **D∞**, the first mathematical *model* of the untyped λ-calculus, which starts **domain theory** and **denotational semantics** (with Christopher Strachey). Ironically, Scott had set out to show that no such model could exist. |
| 1969 | **William Howard** circulates the manuscript describing the "formulae-as-types" correspondence (published 1980). This is the **Curry–Howard correspondence**. **Roger Hindley** gives principal type schemes. |
| 1971 | **Christopher Wadsworth**: graph reduction and call-by-need ("lazy") evaluation. |
| 1972 | **N. G. de Bruijn**: nameless representation with indices, developed for the AUTOMATH proof checker. **Jean-Yves Girard**: **System F** (polymorphic λ-calculus), discovered independently by **John Reynolds** in 1974. **Per Martin-Löf** develops intuitionistic type theory through the 1970s. |
| 1975 | **Gordon Plotkin**, *Call-by-name, call-by-value and the λ-calculus*. **Sussman & Steele** create **Scheme**, a lexically scoped Lisp explicitly modelled on λ-calculus (the "Lambda Papers"). |
| 1978 | **Robin Milner**: type inference for ML (Hindley–Milner). **Jean-Jacques Lévy**: theory of optimal reduction. |

### 2.4 Maturity (1980s–today)

- **1981/1984**: Henk Barendregt, *The Lambda Calculus: Its Syntax and Semantics*, the standard reference.
- **1985**: Raymond Smullyan, *To Mock a Mockingbird*, which explains combinators as songbirds.
- **1988**: Coquand & Huet, the **Calculus of Constructions**, which grew into Coq (now Rocq).
- **1990**: John Lamping's optimal reduction algorithm. **1991**: Barendregt's **λ-cube**. Haskell 1.0 appears the same year.
- **1997**: Yves Lafont, *Interaction Combinators*.
- **2004**: John Tromp, **Binary Lambda Calculus**.
- **2007**: Bret Victor, *Alligator Eggs*.
- **2010s–2020s**: lambdas become standard in mainstream languages (C# 3.0 2007, C++11, Java 8 2014, JavaScript arrow functions 2015). Lean, Agda and Rocq formalize large areas of mathematics. Accattoli & Dal Lago (2016) show that β-step counting is a "reasonable" time cost model. Interaction-net runtimes such as HVM appear.

---

## 3. Syntax: The Whole Language in Three Rules

### 3.1 Grammar

```
M, N ::= x          variable
       | λx. M      abstraction   ("the function that takes x and returns M")
       | M N        application   ("apply M to N")
```

There is nothing else: no numbers, no `+`, no `if`, no loops. Everything is built from these three forms.

### 3.2 Conventions for leaving out brackets

1. **Application is left-associative**: `M N P` means `(M N) P`.
2. **The body of a λ extends as far right as possible**: `λx. M N` means `λx. (M N)`, not `(λx. M) N`.
3. **Several λs can be merged**: `λx y z. M` means `λx. λy. λz. M`.

So `λf. λx. f (f x)` is the function that takes `f` and returns a function taking `x` and returning `f(f(x))`.

### 3.3 Free and bound variables

- In `λx. M`, the λ **binds** `x` in `M`. `M` is the binder's **scope**.
- A variable occurrence that is not inside any λ for it is **free**.

```
FV(x)      = {x}
FV(λx. M)  = FV(M) \ {x}
FV(M N)    = FV(M) ∪ FV(N)
```

Example: in `λx. x y`, `x` is bound and `y` is free.

A term with no free variables is **closed**, and a closed term is called a **combinator**. Examples: `I = λx.x`, `K = λx.λy.x`, `S = λx.λy.λz. x z (y z)`.

### 3.4 Currying

λ-functions take exactly one argument. A two-argument function `f(x, y)` is represented as `λx. λy. …`, a function that returns a function. Applying it to one argument gives a *partial application*: `(λx.λy. x + y) 3` is "the function that adds 3". This is why multi-argument application is written `f a b` rather than `f(a, b)`.

---

## 4. Computation: Substitution and Reduction

### 4.1 The three conversions

| Name | Rule | Meaning |
|---|---|---|
| **α-conversion** | `λx. M  ≡  λy. M[x := y]` (if `y` is not free in `M`) | Renaming bound variables changes nothing. `λx.x` and `λy.y` are the same function. |
| **β-reduction** | `(λx. M) N  →  M[x := N]` | **Function application**: replace the parameter with the argument. This is the computation step. |
| **η-conversion** | `λx. M x  →  M` (if `x` is not free in `M`) | **Extensionality**: a function that just passes its argument to `M` *is* `M`. |

A term of the form `(λx. M) N` is called a **β-redex** ("reducible expression").

### 4.2 Capture-avoiding substitution

`M[x := N]` ("M with N substituted for x") must not let a free variable of `N` be *captured* by a λ in `M`.

```
x[x := N]        = N
y[x := N]        = y                      (y ≠ x)
(P Q)[x := N]    = P[x := N] Q[x := N]
(λx. P)[x := N]  = λx. P                  (x is shadowed; stop)
(λy. P)[x := N]  = λy. P[x := N]          if y ∉ FV(N)
                 = rename y first (α) otherwise
```

**Why this matters**: naively, `(λx. λy. x) y` would become `λy. y`, the identity, which is wrong: the free `y` got captured. The correct answer is `λz. y`, a constant function that returns `y`. Getting this right is the main subtlety of the λ-calculus, and the motivation for de Bruijn indices (section 11).

### 4.3 Worked example

```
(λx. λy. x) a b
→ (λy. a) b         β: substitute a for x
→ a                 β: y is unused, so b is discarded
```

So `K a b = a`: K takes two arguments and keeps the first.

### 4.4 Normal forms

- A term with no β-redexes is in **β-normal form**. That is the "answer".
- Some terms have **no normal form**. The classic case is **Ω**:

```
ω = λx. x x
Ω = ω ω = (λx. x x)(λx. x x) → (λx. x x)(λx. x x) → …   (forever)
```

- Some terms have a normal form, but reduction can still loop if you pick badly:
  `K I Ω = (λx.λy.x) I Ω`. Reducing the outer redex first gives `I`. Reducing `Ω` first loops forever.

Weaker notions used in practice:
- **Weak head normal form (WHNF)**: the term is a λ (do not look inside), or a variable applied to arguments. This is what lazy languages like Haskell evaluate to.
- **Head normal form (HNF)**: `λx₁…xₙ. y M₁ … Mₖ`. A term is **solvable** if and only if it has an HNF. Unsolvable terms (like Ω) are the "meaningless" terms in Barendregt's semantics.

### 4.5 Church–Rosser theorem (confluence)

> If `M →* N₁` and `M →* N₂`, then there is a `P` with `N₁ →* P` and `N₂ →* P`.

Consequences:
- **Normal forms are unique** (up to α). A term cannot evaluate to two different answers.
- The calculus is **consistent**: distinct normal forms, such as `λx.λy.x` and `λx.λy.y`, are never equal. This is what rescued Church's system after the Kleene–Rosser paradox.
- Order of evaluation can affect *whether* you get an answer, but never *which* answer.

### 4.6 Evaluation strategies

| Strategy | Rule | Programming analogue | Notes |
|---|---|---|---|
| **Normal order** | Leftmost-outermost redex first, including under λ | — | **Standardization / normalization theorem**: if a normal form exists, normal order will find it. |
| **Applicative order** | Leftmost-innermost redex first (arguments before the call) | Strict languages | Can loop when normal order wouldn't (`K I Ω`). |
| **Call-by-name** | Like normal order, but never reduce under λ | Algol 60 by-name parameters | Arguments may be evaluated many times. |
| **Call-by-value** | Reduce arguments to *values* (λs) first, never under λ | Lisp, Scheme, ML, JavaScript, Python | Plotkin 1975. |
| **Call-by-need** | Call-by-name plus sharing/memoization | Haskell ("lazy evaluation") | Wadsworth 1971. Each argument is evaluated at most once. |
| **Optimal** (Lévy) | Shares even *redexes inside function bodies* | HVM, BOHM | Lamping's algorithm, interaction nets. |

---

## 5. Programming with Nothing but Functions (Church Encodings)

In pure λ-calculus data is represented by *behaviour*: a value is defined by what it does when you use it.

### 5.1 Booleans and conditionals

```
TRUE  = λt. λf. t          (choose the first)
FALSE = λt. λf. f          (choose the second)
IF    = λb. λx. λy. b x y  (in fact IF b x y = b x y, so IF is optional)

AND = λp. λq. p q p
OR  = λp. λq. p p q
NOT = λp. p FALSE TRUE
```

Check: `AND TRUE FALSE = TRUE FALSE TRUE = FALSE` ✓. Note that `TRUE = K`, and `FALSE = K I = λx.λy.y`, which is the same term as the Church numeral 0.

### 5.2 Pairs

```
PAIR   = λa. λb. λs. s a b
FIRST  = λp. p TRUE
SECOND = λp. p FALSE
```

A pair is a function waiting for a "selector".

### 5.3 Church numerals

The number *n* is "apply a function *n* times":

```
0 = λf. λx. x
1 = λf. λx. f x
2 = λf. λx. f (f x)
3 = λf. λx. f (f (f x))
n = λf. λx. fⁿ x
```

Arithmetic:

```
SUCC  = λn. λf. λx. f (n f x)
PLUS  = λm. λn. λf. λx. m f (n f x)        -- f applied n times, then m more
MULT  = λm. λn. λf. m (n f)                -- = composition: MULT = B
EXP   = λb. λe. e b                         -- b^e: just apply e to b!
ISZERO= λn. n (λ_. FALSE) TRUE
PRED  = λn. λf. λx. n (λg. λh. h (g f)) (λu. x) (λu. u)    -- Kleene's trick
SUB   = λm. λn. n PRED m
LEQ   = λm. λn. ISZERO (SUB m n)
```

Worked example, `PLUS 1 1`:

```
PLUS 1 1
→ λf. λx. 1 f (1 f x)
→ λf. λx. 1 f (f x)        (1 f x → f x)
→ λf. λx. f (f x)          (1 f (f x) → f (f x))
= 2  ✓
```

Why `PRED` is hard: a Church numeral can only "go forward". Kleene's solution steps through pairs `(0,0) → (0,1) → (1,2) → … → (n−1, n)` and keeps the first component. The compact version above does the same with continuations.

### 5.4 Lists and other data

- **Church-encoded lists** are a list's *fold*: `[a, b, c] = λc. λn. c a (c b (c c' n))`. `NIL = λc. λn. n`, `CONS = λh. λt. λc. λn. c h (t c n)`.
- **Scott encodings** represent data by *pattern matching* instead of folding (`NIL = λn. λc. n`, `CONS h t = λn. λc. c h t`). These make predecessor and tail O(1) but need recursion to fold.
- **Mogensen–Scott encoding** represents λ-terms *inside* λ-calculus, which allows very short self-interpreters (Mogensen 1992).
- Lists in Binary Lambda Calculus are nested pairs ending in `FALSE` (= nil), as in section 13.

In general, any algebraic data type can be encoded this way (**Böhm–Berarducci encoding**, 1985, for System F).

---

## 6. Recursion and Fixed-Point Combinators

λ-functions are anonymous, so a function cannot simply call itself by name. Fixed-point combinators solve this.

A **fixed point** of `f` is `x` with `f x = x`. A fixed-point combinator `Y` satisfies `Y f = f (Y f)` for *every* `f`.

```
Y (Curry)  = λf. (λx. f (x x)) (λx. f (x x))
Θ (Turing) = (λx. λy. y (x x y)) (λx. λy. y (x x y))
Z (strict) = λf. (λx. f (λv. x x v)) (λx. f (λv. x x v))   -- works under call-by-value
```

Check for Y:

```
Y g → (λx. g (x x)) (λx. g (x x))
    → g ((λx. g (x x)) (λx. g (x x)))
    = g (Y g)          (up to β-equality)
```

Turing's Θ has the stronger property `Θ f →* f (Θ f)` by reduction, not just by equality.

**Factorial:**

```
FACT = Y (λfact. λn. IF (ISZERO n) 1 (MULT n (fact (PRED n))))
```

`Y` "ties the knot": the function receives itself as `fact`.

The **fixed-point theorem**: *every* λ-term `F` has a fixed point (namely `Y F`). This is the λ-version of the diagonal arguments of Cantor, Gödel and Kleene's recursion theorem. It also shows that λ-calculus has no "set-theoretic" model in which terms are ordinary functions on a set *D* with *D* ≅ *D* → *D*, which is impossible by Cantor unless *D* is a singleton. Scott's domains get around this by using only *continuous* functions.

---

## 7. Computability, Undecidability and Key Theorems

| Result | Statement |
|---|---|
| **Equivalence of models** (Kleene 1936, Turing 1937) | λ-definable functions on numerals = general recursive functions = Turing-computable functions. |
| **Church–Turing thesis** | Every effectively calculable function is λ-definable (equivalently, Turing-computable). This is a thesis, not a theorem. |
| **Undecidability** (Church 1936) | Whether two terms are β-equivalent, or whether a term has a normal form, is undecidable. This was the first undecidable problem published. |
| **Scott–Curry theorem** | Any non-trivial set of terms that is closed under β-equality is undecidable. This is the λ-analogue of Rice's theorem. |
| **Church–Rosser** | Confluence (section 4.5). |
| **Standardization** (Curry–Feys) | Any reduction can be rearranged into leftmost-outermost order. Hence normal order is normalizing. |
| **Böhm's theorem** (1968) | If `M` and `N` have *different* βη-normal forms, there is a context `C[ ]` with `C[M] = TRUE` and `C[N] = FALSE`. Distinct normal forms can always be told apart by a program. Adding any such equation as an axiom collapses the theory. |
| **Fixed-point theorem** | Every term has a fixed point (section 6). |
| **Second recursion theorem** | There is a term that can access its own code (Gödel number). This is the λ version of quines. |
| **Strong normalization of typed λ** | In simply typed λ-calculus (and System F) every reduction sequence terminates (Tait 1967, Girard 1972). |
| **Statman 1979** | Deciding β-equality for *simply typed* terms is decidable but **not elementary-recursive**. No tower of exponentials bounds its complexity. |
| **Invariance thesis** (Accattoli & Dal Lago 2016) | Counting leftmost-outermost β-steps is a *reasonable* time cost model. It is polynomially related to Turing machine time, even though a single β-step can copy huge terms. |

---

## 8. Combinatory Logic: Lambda Calculus without Variables

### 8.1 S, K and I

Combinatory logic (CL) removes variables and λ entirely. Terms are built by *application only*, from constants:

```
I x     = x
K x y   = x
S x y z = x z (y z)
```

`I` is redundant: `I = S K K` (check: `S K K x = K x (K x) = x`). So **S and K alone are Turing-complete**.

### 8.2 Bracket abstraction (λ → SK compilation)

Any λ-term can be translated into S and K using **bracket abstraction** `[x]M` (an operation that "simulates" `λx.M`):

```
[x] x       = I
[x] M       = K M            (if x not free in M)
[x] (M N)   = S ([x]M) ([x]N)
```

Optimized versions add `B` and `C` (Turner 1979) to avoid size blow-up. David Turner used SK-combinator graph reduction to implement SASL and Miranda, which were predecessors of Haskell.

### 8.3 The combinator "zoo" (Smullyan's birds)

| Combinator | Definition | Smullyan bird | Role |
|---|---|---|---|
| I | `I x = x` | Idiot (Identity bird) | identity |
| K | `K x y = x` | Kestrel | constant / TRUE |
| S | `S x y z = x z (y z)` | Starling | substitution / "apply in an environment" |
| B | `B x y z = x (y z)` | Bluebird | composition (`∘`) |
| C | `C x y z = x z y` | Cardinal | argument flip |
| W | `W x y = x y y` | Warbler | duplication |
| M | `M x = x x` | Mockingbird | self-application (ω) |
| T | `T x y = y x` | Thrush | reverse application (`x \|> y`) |
| Y | `Y f = f (Y f)` | Sage bird / Why bird | fixed point |
| V | `V x y z = z x y` | Vireo | pairing |

### 8.4 Single-combinator and esoteric languages

- **ι (Iota)**, Chris Barker 2001: one combinator `ι = λx. x S K`. Then `ι ι = I`, `ι (ι (ι ι)) = K`, `ι (ι (ι (ι ι))) = S`.
- **Jot**: every binary string is a valid program.
- **Unlambda** (David Madore, 1999): SK plus I/O, written with backtick prefix application (`` `skk ``).
- **Lazy K** (Ben Rudiak-Gould, 2002): a pure lazy SKI language.
- **Binary combinatory logic** (Tromp): `00 = K`, `01 = S`, `1 = application`.

### 8.5 Algebraic flavour

CL is a **first-order equational theory** with no binders. That makes it an algebra in the ordinary universal-algebra sense: a set with one binary operation (application, often written `·`) and two constants `S` and `K` satisfying the two equations above. Such a structure is a **combinatory algebra**. See section 9.4.

---

## 9. How Lambda Calculus Relates to Traditional Algebra

This is one of the most illuminating angles, because a lot of λ-calculus is a precise version of things you already do in school algebra.

### 9.1 Functions as formulas vs. functions as graphs

In school algebra a function is usually given by a **formula**, `f(x) = x² + 1`. Set theory defines a function as a **graph**, a set of pairs `{(x, x²+1)}`. λ-calculus takes the *formula* view seriously:

| School algebra | λ-calculus |
|---|---|
| `f(x) = x² + 1` | `f = λx. x² + 1` (an anonymous function, then given a name) |
| "the function `x ↦ x² + 1`" | `λx. x² + 1`. The arrow notation `↦` is essentially λ. |
| `f(3)` | `f 3` |
| "plug in 3": `3² + 1 = 10` | **β-reduction**: `(λx. x² + 1) 3 → 3² + 1` |
| `f(x, y) = x + y` | `λx. λy. x + y` (curried) |
| `g ∘ f` | `λx. g (f x)`, or the combinator `B g f` |
| "Let `u = x+1`. Then `u² …`" | `(λu. u² …) (x + 1)`. A `let` is just a β-redex. |

Key insight: in school algebra, the *expression* `x² + 1` and the *function* `f` are often blurred together ("the function x² + 1"). λ-notation separates them: `x² + 1` is an expression with a free variable `x`, and `λx. x² + 1` is the function. This removes real ambiguities. For example, in "the derivative of `xy` with respect to `x`", which letter is the variable? In λ-notation you would write `λx. x·y` vs `λy. x·y`.

### 9.2 Bound variables appear everywhere in mathematics

λ is a **variable-binding operator**, like many familiar ones:

| Notation | Binds | λ-analogue |
|---|---|---|
| `∫₀¹ x² dx` | `x` | `integral 0 1 (λx. x²)` |
| `Σᵢ₌₁ⁿ i²` | `i` | `sum 1 n (λi. i²)` |
| `lim_{x→0} sin x / x` | `x` | `limit 0 (λx. sin x / x)` |
| `{x ∈ ℝ \| x > 0}` | `x` | `setOf (λx. x > 0)` (Russell's `x̂`) |
| `∀x. P(x)` | `x` | `forall (λx. P x)` (Church's 1940 type theory does exactly this) |
| `dy/dx` | (implicitly `x`) | `derivative (λx. y)` |

In each case, **renaming the bound variable changes nothing**: `∫ x² dx = ∫ t² dt`. That is **α-equivalence**. And the "don't let a variable get captured" rule is the same one that forbids writing `∫₀ˣ x dx` with two different meanings of `x`. λ-calculus says: *there is really only one binder, λ*. All the others are ordinary higher-order functions applied to a λ. This idea is called **higher-order abstract syntax**, and it is how Church's simple theory of types, Isabelle and Lean treat quantifiers.

### 9.3 λ-calculus as an equational theory

Algebra is mostly about *equations* and *rewriting* them: `(a + b)² = a² + 2ab + b²`. λ-calculus can be presented the same way:

- **Theory λβ**: equality is the smallest congruence (reflexive, symmetric, transitive, compatible with application and abstraction) that contains `(λx. M) N = M[x := N]`.
- **Theory λβη**: add `λx. M x = M`, which is equivalent to **extensionality**: `(∀x. M x = N x) ⇒ M = N`, the same principle as "two functions are equal if they agree on all inputs".
- A **λ-theory** is any consistent extension that is closed under the rules. These form a lattice with 2^ℵ₀ members, studied as an algebraic object in its own right ("lambda theories", Salibra, Manzonetto and others).

Reduction (`→`) is like *simplifying* an algebraic expression, and equality (`=`) is like *the equation holds*. The Church–Rosser theorem says that simplification never leads you astray. That is the property that makes "simplify both sides and compare" a valid strategy.

**Important difference from ordinary algebra**: the λ-binder makes the calculus *not* a plain first-order algebra. Substitution under binders is not a simple algebraic operation. This is why:

- **Combinatory algebras** (S, K, application) give a first-order algebraic version.
- **λ-algebras** and **λ-models** (Barendregt, Meyer, Scott) add axioms that make a combinatory algebra behave like λ-calculus.
- **Binding algebras / nominal algebra** (Fiore–Plotkin–Turi 1999; Gabbay–Pitts nominal sets) extend universal algebra to handle binders directly.
- **Lambda-abstraction algebras** (Pigozzi & Salibra) and Lawvere-style algebraic theories treat it categorically.

### 9.4 Combinatory algebras

A **combinatory algebra** is an algebraic structure `(A, ·, S, K)` where `·` is a binary operation and

```
K · x · y = x
S · x · y · z = (x · z) · (y · z)
```

Properties that make these strange compared with familiar algebra:
- **Combinatory completeness**: every "polynomial" over `A` (any expression built from variables, constants and `·`) can be represented by a single element. This is the algebraic form of λ-abstraction, and it is what bracket abstraction proves.
- A nontrivial combinatory algebra is **never commutative** and **never associative**. (If `·` were commutative, `K x y = K y x` would force `x = y` for all `x, y`.)
- Application is a *non-associative magma operation*: `(x·y)·z ≠ x·(y·z)` in general. This is why λ-calculus needs its left-association convention.
- Examples: closed terms modulo β, Scott's D∞, Plotkin–Scott's **Pω** (the graph model), Engeler models, and **Kleene's first algebra** (natural numbers with `n · m = φₙ(m)`, a *partial* combinatory algebra). The latter is the basis of **realizability**, which connects computation to constructive mathematics.

### 9.5 Arithmetic becomes structure: Church numerals and algebraic laws

Church numerals reveal how arithmetic operations come from function structure:

| Arithmetic | Church-numeral meaning |
|---|---|
| `n` | "iterate `n` times": `f ↦ fⁿ` |
| `m + n` | `fᵐ ∘ fⁿ = fᵐ⁺ⁿ`. Addition is *concatenating iterations*. |
| `m × n` | `(fⁿ)ᵐ = fᵐⁿ`. Multiplication **is** composition: `MULT m n = m ∘ n = B m n`. |
| `mⁿ` | `n m`. **Exponentiation is just application** (note the reversed order). |
| `0` | `λf.λx.x = FALSE = K I` |
| `1` | `λf.λx.f x`, which η-reduces to `λf.f = I` |

Laws you know from algebra become identities about iteration: `fᵐ ∘ fⁿ = fᵐ⁺ⁿ`, `(fⁿ)ᵐ = fᵐⁿ`. These are the *laws of exponents* for function powers, the same laws that hold for powers of a matrix or for repeated transformations in group theory.

**Schwichtenberg's theorem (1975)**: in the *simply typed* λ-calculus, the functions on Church numerals you can define are exactly the **extended polynomials**: polynomials with natural-number coefficients, combined with a case split on zero. So simply typed λ-calculus "knows" exactly school-level polynomial algebra and no more. It cannot even define predecessor or exponentiation with a uniform type. More types (System F) or recursion give you everything.

### 9.6 Boolean algebra

Church booleans with `AND`, `OR` and `NOT` satisfy the laws of Boolean algebra (De Morgan, distributivity and so on) when applied to `TRUE`/`FALSE` arguments. This is extensional equality on the two-element domain, not necessarily syntactic equality of the λ-terms.

### 9.7 Category theory: "algebra of functions"

- **Lambek (1970s–80)**: the simply typed λ-calculus (with products) is the **internal language of cartesian closed categories (CCCs)**. Types are objects, terms are morphisms, `λ` is *currying* (`Hom(A×B, C) ≅ Hom(A, C^B)`), and application is the evaluation morphism `C^B × B → C`.
- The notation `C^B` for the function space is exactly why `|A → B| = |B|^|A|` for finite sets. The algebra of exponents (`C^(A×B) = (C^B)^A`, which is *currying*!) is literally the algebraic law `c^(ab) = (c^b)^a`.
- This gives an "algebra of types": `A + B` (sum), `A × B` (product), `B^A` (function). It is used in the "algebra of algebraic data types" (for example, the derivative of a type gives its zipper, McBride 2001).
- **Untyped λ-calculus** corresponds to a **reflexive object** `D` in a CCC with `D ≅ D^D`, or at least a retraction `D^D ◁ D`. This is Scott's insight.
- Diagrams for CCCs (string diagrams) are another way of *visualizing* λ-terms, closely tied to some graphical notations in section 12.

### 9.8 Differential λ-calculus (calculus meets λ)

**Ehrhard & Regnier (2003)** added a *differentiation* operator to λ-calculus, giving the **differential λ-calculus**. Programs get a **Taylor expansion** into infinite sums of linear (resource) terms, mirroring Taylor series for analytic functions. This is a genuinely algebraic/analytic view of computation, and it is linked to linear logic, where `!A` behaves like `e^A` ("exponential modality") and the Taylor formula `!A ≅ Σₙ Aⁿ/n!` has a categorical meaning.

---

## 10. Typed Lambda Calculi and the Curry–Howard Correspondence

### 10.1 Simply typed λ-calculus (STLC)

Types: `τ ::= ι | τ → τ` (base types and function types).

```
Γ, x:A ⊢ x : A
Γ, x:A ⊢ M : B           ⟹   Γ ⊢ λx. M : A → B          (→ introduction)
Γ ⊢ M : A → B,  Γ ⊢ N : A ⟹   Γ ⊢ M N : B               (→ elimination)
```

- **Church style** (types written on binders: `λx:A. M`) vs **Curry style** (untyped terms, with types assigned afterwards).
- **Strongly normalizing**: every well-typed term terminates. So `Ω` and `Y` *cannot* be typed. STLC is not Turing-complete; you add a fixed-point constant (as in PCF, Plotkin 1977) to get recursion back.

### 10.2 The landscape

| System | Adds | Notes |
|---|---|---|
| **STLC** (Church 1940) | `A → B` | CCCs; propositional intuitionistic logic |
| **Hindley–Milner** | let-polymorphism, type inference | ML, OCaml, Haskell's core; decidable, principal types |
| **System F** (Girard 1972, Reynolds 1974) | `∀α. A` (terms depend on types) | Polymorphism; type inference undecidable (Wells 1994); still strongly normalizing |
| **System Fω** | type operators (types depend on types) | Haskell's kind system resembles it |
| **λP / LF** | dependent types (types depend on terms) | Edinburgh Logical Framework, AUTOMATH |
| **Calculus of Constructions** (Coquand–Huet 1988) | all three dimensions | Top corner of the λ-cube; basis of Rocq (with inductive types: CIC) |
| **Martin-Löf type theory** | dependent Π/Σ, identity types, universes | Agda, NuPRL; foundation of HoTT |
| **Linear / affine λ** | resources used exactly / at most once | Rust's ownership has affine flavour; quantum λ-calculi |
| **Intersection types** (Coppo–Dezani) | `A ∧ B` | Characterize exactly the strongly normalizing terms |
| **Gradual / refinement / effect types** | various | Modern practical extensions |

**Barendregt's λ-cube (1991)**: three independent axes (terms depending on types, types depending on types, types depending on terms) generate 8 systems, from STLC (λ→) up to CoC (λC). They are unified by **Pure Type Systems**.

### 10.3 Curry–Howard: proofs are programs

| Logic | λ-calculus / programming |
|---|---|
| Proposition | Type |
| Proof | Term (program) |
| Implication `A ⇒ B` | Function type `A → B` |
| Conjunction `A ∧ B` | Product / pair `A × B` |
| Disjunction `A ∨ B` | Sum / tagged union `A + B` |
| True `⊤` | Unit type |
| False `⊥` | Empty type |
| `∀x. P(x)` | Dependent function `Π(x:A). P x` |
| `∃x. P(x)` | Dependent pair `Σ(x:A). P x` |
| Modus ponens | Application |
| Implication introduction (assume A, prove B) | λ-abstraction |
| Proof normalization (cut elimination) | β-reduction (running the program) |
| Natural deduction | Typed λ-calculus |
| Hilbert axioms `A→B→A`, `(A→B→C)→(A→B)→A→C` | Types of **K** and **S** |
| Classical logic (Peirce's law) | Control operators, `call/cc` (Griffin 1990; Parigot's λμ) |

This is why proof assistants work: checking a proof is type-checking a λ-term. Lean's mathlib, Rocq's Four Color Theorem proof (Gonthier 2005) and the Feit–Thompson formalization (2012) are, at bottom, very large typed λ-terms.

---

## 11. Notations

### 11.1 Standard and historical notations

| Notation | Identity | K (true) | Church 2 | Notes |
|---|---|---|---|---|
| Russell / Whitehead | `x̂ x` (class, not function) | — | — | Origin of the "hat" |
| Church (1930s–41) | `λx[x]` or `λx x` | `λxλy x` | `λfλx f(f(x))` | Brackets for bodies, juxtaposition |
| Modern textbook | `λx.x` | `λx.λy.x` / `λxy.x` | `λf.λx.f (f x)` | Dot separates binder and body |
| Mathematical "maps to" | `x ↦ x` | `x ↦ (y ↦ x)` | `f ↦ (x ↦ f(f(x)))` | Bourbaki-style; same idea |
| Curry–Feys | `[x]x` | `[x][y]x` | — | Bracket abstraction notation |
| De Bruijn (0-based) | `λ 0` | `λ λ 1` | `λ λ 1 (1 0)` | Indices count binders outward |
| De Bruijn (1-based, Tromp) | `λ 1` | `λ λ 2` | `λ λ 2 (2 1)` | Used in BLC |
| Binary λ-calculus | `0010` | `0000110` | `0000011100111010` | Bit string (see §13) |
| Combinatory logic | `I` = `SKK` | `K` | `SBI` = `S(S(KS)K)I` | Variable-free |
| Unlambda | `i`, `` ``skk `` | `k` | — | Backtick = application |
| Iota | `*ii` | — | — | `*` = application, `i` = ι |

### 11.2 De Bruijn indices in detail

N. G. de Bruijn (1972) replaced names with numbers. A variable is written as **the number of λs between it and its binder**.

```
λx. x               →  λ 0          (or λ 1 in 1-based)
λx. λy. x           →  λ λ 1
λx. λy. y           →  λ λ 0
λx. λy. λz. x z (y z)  →  λ λ λ 2 0 (1 0)       (S combinator)
λf. (λx. f (x x)) (λx. f (x x))  →  λ (λ 1 (0 0)) (λ 1 (0 0))   (Y)
```

Advantages:
- **α-equivalence becomes syntactic equality**. `λx.x` and `λy.y` are both `λ 0`.
- **No variable capture**. Substitution is done by *shifting* indices.
- Ideal for implementations, proof assistants and encoding (BLC).

Disadvantages: hard for humans to read, and substitution requires careful index arithmetic ("lifting").

Variants:
- **De Bruijn levels**: count *from the outside in*. Indices then don't change when you go under a binder, but they do change when you substitute. Common in normalization-by-evaluation.
- **Locally nameless**: bound variables as indices, free variables as names. Used in Coq/Rocq developments and in Lean 4's kernel.
- **Nominal techniques** (Gabbay–Pitts): names, made precise using permutations. Used in Nominal Isabelle.
- **Higher-order abstract syntax (HOAS)**: use the *host language's* λ to represent binders (Pfenning & Elliott 1988; the Twelf / LF approach).
- **Explicit substitutions** (λσ, Abadi–Cardelli–Curien–Lévy 1991): substitution itself becomes part of the calculus, which bridges the theory and abstract machines.

### 11.3 Lambdas in programming languages

| Language | Identity | Constant / K |
|---|---|---|
| Lisp / Scheme | `(lambda (x) x)` | `(lambda (x) (lambda (y) x))` |
| Haskell | `\x -> x` (backslash looks like λ) | `\x y -> x` (= `const`) |
| ML / OCaml | `fun x -> x` | `fun x y -> x` |
| Python | `lambda x: x` | `lambda x: lambda y: x` |
| JavaScript | `x => x` | `x => y => x` |
| C# | `x => x` | `x => y => x` |
| Java | `x -> x` | `x -> y -> x` (needs functional interfaces) |
| C++ | `[](auto x){ return x; }` | nested captures `[=]` |
| Rust | `\|x\| x` | `move \|x\| move \|y\| x` |
| Mathematica / Wolfram | `#&`, `Function[x, x]` | `Function[x, Function[y, x]]` |
| Lean / Coq | `fun x => x` / `fun x => x` | `fun x _ => x` |
| APL / J / BQN | `{⍵}` (dfns, with implicit parameters) | tacit "trains" are combinator-based (B, S-like forks) |

Notably, **tacit / point-free programming** (APL trains, Haskell's `.`, Forth/concatenative languages, Joy) is combinatory logic in disguise. A J "fork" `(f g h) y = (f y) g (h y)` is essentially the S-like combinator **S'**/Φ.

---

## 12. Visualizations, Including John Tromp's Lambda Diagrams

λ-terms are trees with *back-pointers* (each variable points to its binder), so they are naturally *graphs*. Many visual notations exploit this.

### 12.1 Abstract syntax trees (AST)

The simplest picture: λ-nodes have one child, application (@) nodes have two, and variables are leaves. Add an arrow from each variable to its λ and you get a **λ-graph**. With de Bruijn indices the arrows are implicit (count up). This is the basis of **graph reduction** (Wadsworth 1971), where shared subterms are drawn once.

```
     @                 (λx. x x)(λy. y)
   /   \
  λx    λy
  |     |
  @     y
 / \
x   x
```

### 12.2 John Tromp's Lambda Diagrams

**John Tromp** (Dutch computer scientist, CWI Amsterdam; known also for Binary Lambda Calculus, the counting of legal Go positions, and his solution of Connect Four) devised a very compact graphical notation. It is described on his page *Lambda Diagrams* (tromp.github.io/cl/diagrams.html).

#### The three rules

1. **Abstraction**: each **λ is a horizontal line**, drawn at a height matching its nesting depth and spanning the width of its body.
2. **Variable**: each variable occurrence is a **vertical line** that hangs down *from the horizontal line of the λ that binds it*. Variables are spread left to right in the order they appear in the term.
3. **Application**: an application `M N` is a **horizontal link** that joins the **leftmost variable line of `M`** to the **leftmost variable line of `N`**, at a level below both. The function's line then continues downward, representing the result.

The diagram has no names at all: binding is shown by *where a vertical line starts*. So Tromp diagrams are a **2-D picture of de Bruijn notation**. The de Bruijn index of a variable is the number of λ-lines its vertical line crosses before reaching its binder.

#### Sketches (ASCII approximations)

Identity, `I = λx. x`:
```
───        λx
 │         x
```

`K = TRUE = λx. λy. x` (the x line crosses the y line; nothing hangs from y):
```
───        λx
─┼─        λy
 │         x
```

`FALSE = 0 = λx. λy. y` (the line hangs from the second λ):
```
───        λx
───        λy
 │         y
```

Church numeral `2 = λf. λx. f (f x)`:
```
───────────     λf
─┼───┼───┬─     λx        (f-lines cross the λx bar; the x-line starts at it)
 │   │   │
 │   ├───┘      application  f x
 ├───┘          application  f (f x)
 │
```

`ω = λx. x x` and `Ω = ω ω`:
```
─────    ─────     λx        λx
 │ │      │ │
 ├─┘      ├─┘      x x       x x
 │        │
 ├────────┘        (ω)(ω)
 │
```

Tromp notes that in the **alternative style** the diagram for Ω "somewhat resembles an (upside-down) Omega".

#### Two styles

- **Standard style**: applications link the *leftmost* variables. The result is very uniform and regular.
- **Alternative style**: applications link the **nearest deepest variables**. This gives a "more stylistic, if less uniform, look", with more compact and often more iconic shapes. The title image on Tromp's page is "a slightly deformed alternative Y diagram made to look like a Y".

#### Metrics: the geometry encodes the term

From Tromp's page:
- **Width** (in pixels, at his scale) = `4 × (number of variable occurrences) − 1`.
- **Height** = `2 × (maximum nesting depth of abstractions and applications) + 1` (one less for alternative diagrams with several variables).
- The **size of the term in Binary Lambda Calculus** is "exactly twice the number of lines plus the number of (4-way) intersections". So a diagram's visual complexity *is* its information content.

#### Free variables

For an open term `t`, imagine the missing binders above the diagram. The variable lines then simply stick out of the top. Formally, you draw `λⁿ t` (for the smallest `n` that closes it) with the top `n` λ-lines omitted.

#### Beta reduction, visualized

Tromp's page shows reduction as a six-frame animation, using `Y` reducing to `λf.(λx. f (x x))(λx. f (x x))`:
1. Highlight the **application of an abstraction** (the redex).
2. Show the abstraction's **bound variables** and the **argument**.
3. Expand the function body.
4. Make room for the copies.
5. **Substitute**: a copy of the argument diagram replaces each vertical line that hung from the consumed λ (and the λ-line itself disappears).
6. Show the resulting term.

Because substitution copies subdiagrams into place, the diagram can grow or shrink a lot, which makes non-termination (Ω) and explosive growth visible.

#### Examples on Tromp's page

I, K/true, false/0, S, Y, Church numerals 2–4, `pred`, `fac` (factorial), `fib`, Ω, and a large **prime-number sieve** diagram (in alternative style) that reduces to an infinite list of booleans marking the primes.

#### The ecosystem around Tromp diagrams

- **Paul Brauner**: software that renders videos of β-reductions in Tromp-diagram style.
- **2swap** (YouTube): *What is PLUS times PLUS?*, an animated explainer using Tromp diagrams.
- **Cruz Godar**: a web app for animating colored lambda diagrams.
- Tromp credits **Dave Keenan's** *To Dissect a Mockingbird* as a partial inspiration.

### 12.3 Dave Keenan: *To Dissect a Mockingbird* (1996–)

A graphical notation built on Smullyan's bird metaphor (first written August 1996 and updated since):
- An **abstraction** is a dotted **box** ("a bird"). On the left is a filled half-circle, the **ear** (where the argument enters). On the right is the **throat** (output). Labels like `I` and `K` are memory aids only.
- **Variables are pipes**. Instead of names, a pipe runs from the ear to each place the variable is used, so binding is shown by plumbing.
- **Application** is a filled circle, the **applicator**. The operator arrives from above, the operand from the left, and the result exits to the right.
- **β-reduction**: when a "song" enters the ear, the box dissolves and the operand is copied along the pipes.
- Diagrams split into a **"rhyme"** (where pipes fan out or cross: the copying/permuting structure) and a **"rhythm"** (where applicators pair pipes up). This anticipates the separation into structural and logical parts found in interaction nets.
- It covers the Mockingbird / Ω loop, Turing's Θ and Curry's "Why bird" (Y), and is designed with animation and teaching in mind.

### 12.4 Bret Victor: *Alligator Eggs* (2007)

A puzzle game that teaches λ-calculus to children:
- **Hungry alligators** are λ-abstractions (the colour is the variable name), and they guard **families** below them.
- **Eggs** are variables (an egg of colour *c* is a variable bound by the alligator of colour *c*).
- **Old alligators** (white) are parentheses.
- **Eating rule** (β): an alligator eats the family to its right, then dies, and each of its eggs of the same colour hatches into a copy of what it ate.
- **Colour rule** (α): if a family would end up next to alligators of a conflicting colour, recolour it first (capture avoidance).
- **Old age rule**: an old alligator guarding only one family dies (bracket removal).

### 12.5 Other graphical notations

| Notation | Author / Year | Idea |
|---|---|---|
| **VEX** (Visual Expressions) | Citrin, Hall & Zorn, 1995 | Circles for λs, lines connecting variable uses to binders; meant for teaching |
| **Bubble notation** | Viktor Massalõgin (master's thesis) | Surveys four existing notations and proposes nested "bubbles" for scopes |
| **Lamping graphs / sharing graphs** | Lamping 1990; Gonthier, Abadi & Lévy 1992 | Fan nodes and brackets for *optimal* reduction; the reduction rules are local graph rewrites |
| **Interaction nets / interaction combinators** | Lafont 1990/1997 | Graphs of agents with principal ports; γ, δ, ε combinators are *universal*. Basis of HVM (Victor Taelin) |
| **Proof nets** | Girard 1987 (linear logic) | Graphical proofs; via Curry–Howard, graphical λ-terms |
| **String diagrams for CCCs** | Joyal–Street, Baez–Stay, many | Wires for types, boxes for terms, "bubbles" for currying |
| **λ-2D** | MIT project | Canvas-based editor where code lives on a 2-D grid and runs graphically |
| **Catalogue of graphical notations** | Prathyush Pramod | Survey collecting many λ-calculus visual systems |
| **Online reduction visualizers** | various hobbyist tools | Web tools that animate reduction on trees or diagrams |

### 12.6 Comparison of visualization styles

| Style | Binding shown by | Shows sharing? | Animation of β | Best for |
|---|---|---|---|---|
| AST + pointers | arrows | optional (DAG) | moderate | implementers |
| **Tromp diagrams** | where vertical lines start | no (copies) | very clear | compact, artistic, de Bruijn intuition, information size |
| Keenan's birds | pipes from ears | via pipe fan-out | designed for it | intuition about combinators |
| Alligator Eggs | colour | no | playful | children, beginners |
| Bubble / VEX | enclosure, lines | no | yes | teaching scope |
| Lamping / interaction nets | wires + fan nodes | **yes** (optimal) | local rewrites | efficient evaluation, parallelism |

---

## 13. John Tromp's Wider Work: BLC, Kolmogorov Complexity, Busy Beavers

### 13.1 Binary Lambda Calculus (BLC, 2004)

Tromp designed BLC to give a *concrete*, minimal definition of **Kolmogorov complexity** (the length of the shortest program that outputs a string). It is a self-delimiting bit encoding of de Bruijn terms (1-based indices):

```
λ M      →  00 ⟨M⟩
M N      →  01 ⟨M⟩ ⟨N⟩
variable i  →  1ⁱ 0       (i ones followed by a zero)
```

Examples:
- `I = λ1` → `00 10` = **`0010`** (4 bits).
- `K = λλ2` → `00 00 110` = `0000110` (7 bits).
- `2 = λλ 2 (2 1)` → `00 00 01 110 01 110 10` (16 bits).

Because it is **prefix-free**, the program and the input can just be concatenated, which is essential for prefix complexity.

**I/O**: input bits become a λ-list. Bit 0 is `TRUE` and bit 1 is `FALSE`, as nested pairs, ending in `NIL` (`FALSE`) for delimited input or Ω for self-delimiting input.

**Results from Tromp's page:**
- A **universal machine** `U` (it parses an encoded λ-term from the input and runs it on the rest) of **232 bits (29 bytes)**. A byte-oriented variant `U8` (BLC8) is 355 bits.
- Kolmogorov complexity bounds with tiny constants: `K_S(x) ≤ ℓ(x) + 4`, `K_P(x) ≤ ℓ(code(x)) + 338`, and **symmetry of information** `K_P(x, y) ≤ K_P(x) + K_P(y | x*) + 657`. These are explicit constants that are normally hidden behind "+O(1)".
- A **132-bit quine**.
- The **set of primes** (as an infinite characteristic sequence) in 167 bits (simple) / 176 bits (prefix), smaller than a 23-byte Haskell program.
- A 55-bit program printing 2¹⁶ ones (gzip and bzip2 need 344/352 bits for the same output).
- A **Brainfuck interpreter** in 829 bits (under 104 bytes).
- An entry in the **2012 IOCCC** (International Obfuscated C Code Contest): a BLC interpreter in C.
- **Binary combinatory logic** for comparison: `00` = K, `01` = S, `1` = application.

Bit size also links directly to Tromp diagrams: BLC size = 2 × lines + 4-way intersections.

### 13.2 The Busy Beaver for λ-calculus (BBλ)

The classic Busy Beaver function asks for the most output from an *n*-state Turing machine that halts. Tromp's λ-version:

> **BBλ(n)** = the maximum *size of the normal form* of any closed λ-term of size *n* bits (in BLC), among terms that have a normal form.

It is uncomputable and grows faster than any computable function. Known values (from the bbchallenge wiki, credited to Tromp and Bertram Felgenhauer among others):

| n (bits) | BBλ(n) |
|---|---|
| 4 | 4 |
| 6–20 | n |
| 21 | 22 |
| 24 | 30 |
| 29 | 223 |
| 33 | 1812 |
| 34 | 327 686 |
| 35 | 5·3³³ + 6 (> 3.8 × 10¹³) |
| 36 | 5·2²²³ + 6 (> 5.7 × 10⁷⁷) |
| 38 | > 10^19 729 |
| 40 | ≈ 10↑↑↑16 |
| 49 | > f_{ω+1}(2↑↑62): **first value known to exceed Graham's number** |
| 94 | > TREE(G64) (lower bound) |
| 201 | > q(5), beyond every function provably total in Peano Arithmetic |
| 1797 | > D⁵(99) = **Loader's number** |

Curiously, the function is *not monotone* at small sizes (for example BBλ(26) = 52 but BBλ(27) = 44), because of parity constraints in the encoding. A Church numeral *n* has size 5n + 6 bits, which explains the "5·…+6" shape of many entries.

### 13.3 The largest number in 64 bits

In a 2023 blog post (and a later preprint), Tromp presents **"wCubed"**, a 63-bit BLC program:

```
(λt. t t (λh λf λn. n h f n) t t t) (λf λx. f (f x))
```

It reduces to `2 2 H 2 2 2`, which he shows corresponds to level **ω³** in a fast-growing hierarchy. That vastly exceeds **Graham's number** (which lies below level ω+1 applied to 64). The point: λ-calculus is a *far* more concise "number language" than Turing machines or conventional notation, and it is a natural setting for "largest number in N bits" questions.

---

## 14. Implementing Lambda Calculus: Machines and Evaluation

| Technique | Who / when | Idea |
|---|---|---|
| **Substitution-based interpreters** | — | Follow the rules literally. Simple but slow (copying, renaming). |
| **Environments and closures** | Landin 1964 | Instead of substituting, keep a map from variables to values. A function value is a **closure** (code + environment). |
| **SECD machine** | Landin 1964 | Stack, Environment, Control, Dump: the first abstract machine for λ, call-by-value. |
| **CEK machine** | Felleisen & Friedman 1986 | Control, Environment, Kontinuation: clean call-by-value machine, used in teaching. |
| **Krivine machine** | Krivine ~1985 (published 2007) | Very simple call-by-name machine on de Bruijn terms: push arguments, grab with λ. |
| **ZINC / OCaml** | Leroy 1990 | Efficient strict implementation. |
| **Graph reduction** | Wadsworth 1971 | Share subterms in a graph to implement call-by-need. |
| **SK-combinator reduction** | Turner 1979 | Compile to combinators, reduce the graph (SASL, Miranda). |
| **G-machine, STG machine** | Johnsson / Augustsson 1984; Peyton Jones 1992 | Compiled graph reduction; GHC uses STG. |
| **CPS (continuation-passing style)** | Steele (Rabbit, 1978), Appel | Make evaluation order explicit; standard in compilers. |
| **Lambda lifting, closure conversion** | Johnsson 1985 | Turn nested λs into top-level functions. |
| **Normalization by evaluation (NbE)** | Berger & Schwichtenberg 1991 | Evaluate into the host language, then read back a normal form. Used in type checkers (Agda, Lean). |
| **Optimal reduction** | Lévy 1978, Lamping 1990 | Share redexes inside bodies too. Can be exponentially faster than lazy evaluation, but bookkeeping overhead is large. Asperti & Mairson (1998): the *cost* of optimal reduction is not bounded by any elementary function in the number of steps. |
| **Interaction-net runtimes** | Lafont; HVM (Taelin, 2022+) | Massively parallel, optimal-ish evaluation on GPUs/CPUs. |

---

## 15. Influence: Programming Languages, Logic, Linguistics and More

### 15.1 Programming

- **Functional languages**: Lisp (1958), ISWIM (1966), Scheme (1975), ML (1973), Miranda (1985), Haskell (1990), OCaml, F#, Clojure, Elm, PureScript, Idris, Agda, Lean.
- **Mainstream lambdas and closures**: JavaScript, Python, Ruby, C#, Java 8+, C++11+, Swift, Kotlin, Rust and Go all have first-class anonymous functions.
- **Concepts derived from λ**: closures, higher-order functions (`map`, `filter`, `reduce`), currying / partial application, lexical scope, continuations, CPS, monads (Moggi 1989 computational λ-calculus), type inference, generics (System F → Java/C# generics), lazy evaluation.
- **"Serverless lambda"** (AWS Lambda) and "lambda architecture" borrow the name only loosely ("anonymous unit of computation").
- **Compiler intermediate representations**: GHC Core (System FC), CPS / ANF IRs in many compilers.

### 15.2 Logic and foundations of mathematics

- Church's simple type theory is the basis of **HOL** (HOL4, HOL Light, Isabelle/HOL).
- Dependent type theory (Martin-Löf, CoC) underlies **Rocq, Lean, Agda, Idris**.
- **Homotopy type theory** (2013 HoTT book) gives a new foundation of mathematics built on typed λ-calculus.
- **Realizability** (Kleene 1945) interprets constructive proofs as computable functions (partial combinatory algebras).

### 15.3 Semantics of programming languages

- **Denotational semantics** (Scott & Strachey) gives meaning to programs as mathematical objects in domains. It was born from the quest for λ-models.
- **Full abstraction** problem for PCF (Plotkin 1977, Milner 1977), solved via **game semantics** (Abramsky–Jagadeesan–Malacaria, Hyland–Ong, Nickau, 1994).
- **Operational semantics** and contextual equivalence are standard tools in programming language research.

### 15.4 Linguistics: Montague semantics

**Richard Montague** (around 1970) used typed λ-calculus to give a *compositional* semantics for English. Word meanings are λ-terms, and combining words is function application. For example:

```
"every"  = λP. λQ. ∀x. P x → Q x
"every dog barks"  = every dog barks  →β  ∀x. dog x → barks x
```

λ-calculus and **categorial grammar** (Lambek calculus, 1958) are central to formal semantics and computational linguistics.

### 15.5 Other fields

- **Concurrency**: Milner's **π-calculus** (1992) can encode the λ-calculus. Process calculi grew out of the same tradition.
- **Quantum computing**: quantum λ-calculi (van Tonder 2004; Selinger & Valiron 2006) and the Quipper language.
- **Probabilistic programming**: probabilistic λ-calculi.
- **Biology / chemistry**: Fontana & Buss's "AlChemy" (1994) uses λ-terms as artificial chemistry molecules.
- **Philosophy of mathematics**: debates about intensional vs extensional functions, and constructive mathematics.

---

## 16. Variants and Extensions

| Variant | Description |
|---|---|
| **λI-calculus** | Church's original preference: every bound variable must be used (`λx. M` only if `x ∈ FV(M)`), so no K. |
| **Affine / linear λ** | Variables used at most / exactly once. Reduction is then polynomial or linear, connected to linear logic and to resource-aware languages. |
| **λμ-calculus** (Parigot 1992) | Adds control (`call/cc`-like). Curry–Howard for classical logic. |
| **λ-calculus with explicit substitutions** (λσ, λυ, λx) | Substitution becomes a stepwise process. |
| **Call-by-push-value** (Levy 2001) | Unifies call-by-name and call-by-value. |
| **Infinitary λ-calculus** | Infinite terms and transfinite reductions; Böhm trees. |
| **Böhm trees** | The "infinite normal form" of a term; the basis for theories like 𝓑 and 𝓗*. |
| **Resource / differential λ-calculus** | Ehrhard–Regnier: Taylor expansion of programs. |
| **Lambda-mu, lambda-bar-mu-mu-tilde** (Curien–Herbelin) | Sequent-calculus λ-calculi. |
| **Pure type systems** | General framework covering the λ-cube. |
| **Light / soft linear λ** | Capture complexity classes (polynomial time), used in implicit computational complexity. |
| **Nominal / contextual / modal λ** | For metaprogramming and staged computation (MetaOCaml, Template Haskell). |

---

## 17. Glossary

| Term | Meaning |
|---|---|
| **Abstraction** | `λx. M`, a function definition. |
| **Application** | `M N`, a function call. |
| **α-conversion** | Renaming bound variables. |
| **β-reduction** | `(λx. M) N → M[x := N]`. |
| **η-conversion** | `λx. M x ↔ M` (when `x ∉ FV(M)`). |
| **Bound / free variable** | Captured by an enclosing λ or not. |
| **Closed term / combinator** | Term with no free variables. |
| **Redex** | A reducible subterm, `(λx. M) N`. |
| **Normal form** | A term with no redexes. |
| **Confluence (Church–Rosser)** | Different reduction paths can always rejoin. |
| **Church numeral** | `n = λf. λx. fⁿ x`. |
| **Fixed-point combinator** | A term `Y` with `Y f = f (Y f)`. |
| **Currying** | Representing an n-argument function as nested one-argument functions. |
| **De Bruijn index** | Variable written as the distance to its binder. |
| **Combinatory logic** | Variable-free system based on S and K. |
| **Combinatory algebra** | An algebraic structure (A, ·, S, K) satisfying the S/K equations. |
| **λ-theory** | A consistent equational extension of β-conversion. |
| **WHNF / HNF** | Weak head normal form / head normal form. |
| **Solvable** | A term that has an HNF (it can be made to produce output). |
| **Curry–Howard** | Correspondence between proofs and programs, propositions and types. |
| **CCC** | Cartesian closed category; models of typed λ. |
| **BLC** | Binary Lambda Calculus (Tromp). |
| **BBλ** | Busy Beaver function for λ-calculus. |
| **Tromp diagram** | Graphical λ-term: λ = horizontal line, variable = vertical line, application = horizontal link. |

---

## 18. Further Reading and Sources

### Primary sources consulted for this report
- John Tromp, *Lambda Diagrams*: https://tromp.github.io/cl/diagrams.html
- John Tromp, *Binary Lambda Calculus*: https://tromp.github.io/cl/Binary_lambda_calculus.html
- John Tromp, *The largest number representable in 64 bits* (blog, 2023): https://tromp.github.io/blog/2023/11/24/largest-number
- BusyBeaverWiki, *Busy Beaver for lambda calculus*: https://wiki.bbchallenge.org/wiki/Busy_Beaver_for_lambda_calculus
- Dave Keenan, *To Dissect a Mockingbird: A Graphical Notation for the Lambda Calculus with Animated Reduction*: https://dkeenan.com/Lambda/
- Wikipedia, *John Tromp*: https://en.wikipedia.org/wiki/John_Tromp

### Classic texts
- H. P. Barendregt, *The Lambda Calculus: Its Syntax and Semantics* (1981, rev. 1984). The standard reference.
- J. R. Hindley & J. P. Seldin, *Lambda-Calculus and Combinators: An Introduction* (2008). The best first textbook.
- H. Barendregt, W. Dekkers, R. Statman, *Lambda Calculus with Types* (2013).
- F. Cardone & J. R. Hindley, *History of Lambda-calculus and Combinatory Logic* (2006). Source for the history and the "why λ" question.
- A. Church, *The Calculi of Lambda-Conversion* (1941).
- R. Smullyan, *To Mock a Mockingbird* (1985). A puzzle book about combinators.
- B. Pierce, *Types and Programming Languages* (2002). Typed λ-calculi for programmers.
- M. H. Sørensen & P. Urzyczyn, *Lectures on the Curry–Howard Isomorphism* (2006).
- R. Rojas, *A Tutorial Introduction to the Lambda Calculus* (free PDF). A short beginner introduction.
- J. Lambek & P. J. Scott, *Introduction to Higher-Order Categorical Logic* (1986). λ-calculus and CCCs.
- Stanford Encyclopedia of Philosophy, *The Lambda Calculus* and *Combinatory Logic* entries.

### Visual and interactive resources
- Bret Victor, *Alligator Eggs!* (worrydream.com, 2007)
- 2swap, *What is PLUS times PLUS?* (YouTube), animated Tromp diagrams
- Cruz Godar, lambda-diagram animation web app (linked from Tromp's page)
- Paul Brauner, β-reduction videos in Tromp style (linked from Tromp's page)
- Viktor Massalõgin, master's thesis on graphical λ-notations (bubble notation)
- Prathyush Pramod, catalogue of graphical λ-calculus notations
- Y. Lafont, *Interaction Combinators* (1997); HVM (Higher-order Virtual Machine) documentation

### Caveats on accuracy
- Numerical results about BLC (universal machine size, complexity constants) and BBλ values are taken from Tromp's pages and the bbchallenge wiki *as published in November 2026*. These are actively refined, so sizes and bounds may change.
- The ASCII Tromp diagrams in section 12.2 are hand-drawn approximations of the real pixel diagrams. See Tromp's page for exact renderings.
- The etymology of "λ" is disputed. Both the typographic and the "arbitrary" accounts are reported by Cardone & Hindley.
