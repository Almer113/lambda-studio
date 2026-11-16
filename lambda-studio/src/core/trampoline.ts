// Deep recursion without the call stack. A recursive function is written as a generator that
// `yield*`s `call(...)` where it would call itself; `run` keeps the pending calls on a heap stack.
//
//   function* expr(): Rec<Node> { const body = yield* call(expr()); … return node; }
//   const node = run(expr());
//
// Parsers use this so that deeply nested input (thousands of brackets) parses like shallow input.

/** A suspended computation returning T. It yields the sub-computations it waits for. */
export type Rec<T> = Generator<Rec<unknown>, T, unknown>;

/** Run `g` (and everything it calls) on an explicit stack. Exceptions propagate to the callers as usual. */
export function run<T>(g: Rec<T>): T {
  const stack: Rec<unknown>[] = [g];
  let input: unknown = undefined;
  let error: unknown = undefined;
  let failing = false;
  for (;;) {
    const top = stack[stack.length - 1];
    let r: IteratorResult<Rec<unknown>, unknown>;
    try {
      if (failing) { failing = false; r = top.throw(error); }
      else r = top.next(input);
    } catch (e) {
      stack.pop();
      if (!stack.length) throw e;
      error = e; failing = true;
      continue;
    }
    if (r.done) {
      stack.pop();
      if (!stack.length) return r.value as T;
      input = r.value;
    } else {
      stack.push(r.value);
      input = undefined;
    }
  }
}

/** Inside a generator: `const x = yield* call(f())` runs f() and gives its result. */
export function* call<T>(g: Rec<T>): Generator<Rec<unknown>, T, unknown> {
  return (yield g) as T;
}
