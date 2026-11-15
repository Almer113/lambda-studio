// Built-in library of definitions, written in the named notation.

export interface PreludeEntry { name: string; src: string; group: string; doc: string; fold?: boolean }

export const PRELUDE: PreludeEntry[] = [
  // Combinators
  { group: 'Combinators', name: 'I', src: 'λx.x', doc: 'Identity: I x = x', fold: true },
  { group: 'Combinators', name: 'K', src: 'λx y.x', doc: 'Constant (Kestrel): K x y = x. Same term as TRUE.' },
  { group: 'Combinators', name: 'S', src: 'λx y z.x z (y z)', doc: 'Substitution (Starling): S x y z = x z (y z)', fold: true },
  { group: 'Combinators', name: 'B', src: 'λf g x.f (g x)', doc: 'Composition (Bluebird): B f g x = f (g x). Same term as MULT.', fold: false },
  { group: 'Combinators', name: 'C', src: 'λf x y.f y x', doc: 'Flip (Cardinal): C f x y = f y x', fold: true },
  { group: 'Combinators', name: 'W', src: 'λf x.f x x', doc: 'Duplication (Warbler): W f x = f x x', fold: true },
  { group: 'Combinators', name: 'T', src: 'λx f.f x', doc: 'Thrush: T x f = f x', fold: true },
  { group: 'Combinators', name: 'ω', src: 'λx.x x', doc: 'Self-application (Mockingbird): ω x = x x', fold: true },
  { group: 'Combinators', name: 'Ω', src: 'ω ω', doc: 'Ω = ω ω reduces to itself forever: no normal form.', fold: true },
  { group: 'Combinators', name: 'Y', src: 'λf.(λx.f (x x)) (λx.f (x x))', doc: "Curry's fixed-point combinator: Y f = f (Y f)", fold: true },
  { group: 'Combinators', name: 'Θ', src: '(λx y.y (x x y)) (λx y.y (x x y))', doc: "Turing's fixed-point combinator: Θ f →* f (Θ f)", fold: true },
  { group: 'Combinators', name: 'Z', src: 'λf.(λx.f (λv.x x v)) (λx.f (λv.x x v))', doc: 'Fixed-point combinator for call-by-value', fold: true },

  // Booleans
  { group: 'Booleans', name: 'TRUE', src: 'λt f.t', doc: 'Church true: choose the first argument', fold: true },
  { group: 'Booleans', name: 'FALSE', src: 'λt f.f', doc: 'Church false: choose the second argument (same term as 0)', fold: true },
  { group: 'Booleans', name: 'IF', src: 'λb t e.b t e', doc: 'IF b t e = b t e (booleans already choose)' },
  { group: 'Booleans', name: 'NOT', src: 'λp.p FALSE TRUE', doc: 'Negation', fold: true },
  { group: 'Booleans', name: 'AND', src: 'λp q.p q p', doc: 'Conjunction', fold: true },
  { group: 'Booleans', name: 'OR', src: 'λp q.p p q', doc: 'Disjunction', fold: true },
  { group: 'Booleans', name: 'XOR', src: 'λp q.p (NOT q) q', doc: 'Exclusive or', fold: true },

  // Numerals
  { group: 'Numerals', name: 'SUCC', src: 'λn f x.f (n f x)', doc: 'Successor', fold: true },
  { group: 'Numerals', name: 'PLUS', src: 'λm n f x.m f (n f x)', doc: 'Addition: f applied n times, then m more', fold: true },
  { group: 'Numerals', name: 'MULT', src: 'λm n f.m (n f)', doc: 'Multiplication is composition (MULT = B)', fold: true },
  { group: 'Numerals', name: 'EXP', src: 'λb e.e b', doc: 'Exponentiation is application: EXP b e = b^e', fold: true },
  { group: 'Numerals', name: 'PRED', src: 'λn f x.n (λg h.h (g f)) (λu.x) (λu.u)', doc: "Predecessor (Kleene's trick); PRED 0 = 0", fold: true },
  { group: 'Numerals', name: 'SUB', src: 'λm n.n PRED m', doc: 'Truncated subtraction', fold: true },
  { group: 'Numerals', name: 'ISZERO', src: 'λn.n (λx.FALSE) TRUE', doc: 'Zero test', fold: true },
  { group: 'Numerals', name: 'LEQ', src: 'λm n.ISZERO (SUB m n)', doc: 'Less than or equal', fold: true },
  { group: 'Numerals', name: 'EQ', src: 'λm n.AND (LEQ m n) (LEQ n m)', doc: 'Equality of numerals', fold: true },
  { group: 'Numerals', name: 'FACT', src: 'λn.ISZERO n 1 (MULT n (FACT (PRED n)))', doc: 'Factorial (recursive definition, compiled with Y)', fold: true },
  { group: 'Numerals', name: 'FIB', src: 'λn.LEQ n 1 n (PLUS (FIB (PRED n)) (FIB (PRED (PRED n))))', doc: 'Fibonacci (recursive, slow!)', fold: true },

  // Pairs
  { group: 'Pairs & lists', name: 'PAIR', src: 'λa b s.s a b', doc: 'Pair constructor', fold: true },
  { group: 'Pairs & lists', name: 'FST', src: 'λp.p TRUE', doc: 'First component', fold: true },
  { group: 'Pairs & lists', name: 'SND', src: 'λp.p FALSE', doc: 'Second component', fold: true },
  { group: 'Pairs & lists', name: 'NIL', src: 'λc n.n', doc: 'Empty Church list (same term as FALSE and 0)' },
  { group: 'Pairs & lists', name: 'CONS', src: 'λh t c n.c h (t c n)', doc: 'Prepend to a Church list', fold: true },
  { group: 'Pairs & lists', name: 'ISNIL', src: 'λl.l (λh t.FALSE) TRUE', doc: 'Empty-list test', fold: true },
  { group: 'Pairs & lists', name: 'HEAD', src: 'λl.l (λh t.h) FALSE', doc: 'First element (FALSE for the empty list)', fold: true },
  { group: 'Pairs & lists', name: 'TAIL', src: 'λl c n.l (λh t g.g h (t c)) (λt.n) (λh t.t)', doc: 'All but the first element', fold: true },
  { group: 'Pairs & lists', name: 'FOLDR', src: 'λf z l.l f z', doc: 'A Church list is its own right fold', fold: true },
  { group: 'Pairs & lists', name: 'MAP', src: 'λf l c n.l (λh t.c (f h) t) n', doc: 'Apply f to every element', fold: true },
  { group: 'Pairs & lists', name: 'LENGTH', src: 'λl.l (λh t.SUCC t) 0', doc: 'Number of elements', fold: true },
  { group: 'Pairs & lists', name: 'APPEND', src: 'λa b c n.a c (b c n)', doc: 'Concatenate two lists', fold: true },
  { group: 'Pairs & lists', name: 'SUM', src: 'λl.l PLUS 0', doc: 'Sum of a list of numerals', fold: true },
];

export const EXAMPLES: { name: string; src: string; note: string }[] = [
  { name: 'Identity', src: 'λx.x', note: 'The simplest Tromp diagram.' },
  { name: 'K (TRUE)', src: 'λx y.x', note: 'The x line crosses the y bar.' },
  { name: 'S combinator', src: 'λx y z.x z (y z)', note: '' },
  { name: 'Church numeral 3', src: '3', note: 'Numbers are sugar for Church numerals.' },
  { name: '2 + 3', src: 'PLUS 2 3', note: 'Step through to watch addition happen.' },
  { name: '2 × 3', src: 'MULT 2 3', note: 'Multiplication is composition.' },
  { name: '2 ^ 3', src: 'EXP 2 3', note: 'Exponentiation is application.' },
  { name: 'Predecessor', src: 'PRED 3', note: "Kleene's trick." },
  { name: 'Factorial 3', src: 'FACT 3', note: 'Recursion through Y.' },
  { name: 'Boolean logic', src: 'AND TRUE (NOT FALSE)', note: '' },
  { name: 'List sum', src: 'SUM [1, 2, 3]', note: 'Lists are sugar for Church lists.' },
  { name: 'Omega (loops)', src: '(λx.x x) (λx.x x)', note: 'Reduces to itself: no normal form.' },
  { name: 'K I Ω', src: 'K I Ω', note: 'Normal order succeeds; applicative order loops.' },
  { name: 'Y combinator', src: 'λf.(λx.f (x x)) (λx.f (x x))', note: "Tromp's title diagram is a deformed Y." },
  { name: 'Definitions', src: 'TWICE = λf x.f (f x)\nSQUARE = λn.MULT n n\n\nTWICE SQUARE 2', note: 'Define your own names, one per line.' },
];
