// Checking equations between λ-terms: normalize both sides (β, then η) and compare.
// Equal normal forms prove the equation; different normal forms disprove it (Böhm's theorem
// for βη-normal forms); no normal form within the limit leaves it open.

import { type Term, app, lam, equal } from '../term';
import { normalize } from '../nbe';
import { isEtaRedex, etaContract } from '../debruijn';

export function etaNormal(t: Term): Term {
  switch (t.tag) {
    case 'var': case 'free': return t;
    case 'app': return app(etaNormal(t.fn), etaNormal(t.arg));
    case 'lam': {
      const l = lam(etaNormal(t.body), t.hint);
      return l.tag === 'lam' && isEtaRedex(l) ? etaContract(l) : l;
    }
  }
}

export type Verdict = 'equal' | 'different' | 'unknown';
export interface LawResult { verdict: Verdict; left: Term | null; right: Term | null; note: string; byEta: boolean }

export function checkLaw(a: Term, b: Term, fuel = 500_000): LawResult {
  const ra = normalize(a, fuel), rb = normalize(b, fuel);
  if (ra.status !== 'normal' || rb.status !== 'normal' || !ra.term || !rb.term) {
    const which = ra.status !== 'normal' && rb.status !== 'normal' ? 'Neither side' : ra.status !== 'normal' ? 'The left side' : 'The right side';
    return { verdict: 'unknown', left: ra.term, right: rb.term, byEta: false, note: `${which} has no normal form within ${fuel.toLocaleString('en')} β-steps, so this check cannot decide.` };
  }
  if (equal(ra.term, rb.term)) return { verdict: 'equal', left: ra.term, right: rb.term, byEta: false, note: 'Both sides have the same β-normal form.' };
  const ea = etaNormal(ra.term), eb = etaNormal(rb.term);
  if (equal(ea, eb)) return { verdict: 'equal', left: ea, right: eb, byEta: true, note: 'Equal after η-reduction (βη-equal, not β-equal).' };
  return { verdict: 'different', left: ea, right: eb, byEta: false, note: 'The βη-normal forms differ, so the two sides are not βη-equal (Böhm).' };
}

/** Classic equations to try (written in the named notation; definitions from the prelude). */
export const LAWS: { name: string; left: string; right: string; note?: string }[] = [
  { name: 'S K K = I', left: 'S K K', right: 'I' },
  { name: 'MULT is B', left: 'MULT', right: 'B' },
  { name: 'EXP is flipped application', left: 'λm n.EXP m n', right: 'λm n.n m' },
  { name: '2 + 3 = 5', left: 'PLUS 2 3', right: '5' },
  { name: '2 · 3 = 3 · 2', left: 'MULT 2 3', right: 'MULT 3 2' },
  { name: 'Addition commutes (open terms)', left: 'λm n.PLUS m n', right: 'λm n.PLUS n m', note: 'True for numerals, but not as λ-terms: the normal forms differ.' },
  { name: 'SUCC = PLUS 1', left: 'SUCC', right: 'PLUS 1' },
  { name: 'SUCC n = PLUS n 1', left: 'SUCC', right: 'λn.PLUS n 1', note: 'Equal on every numeral, but different λ-terms.' },
  { name: 'PRED (SUCC 4) = 4', left: 'PRED (SUCC 4)', right: '4' },
  { name: 'NOT (NOT b) = b', left: 'λb.NOT (NOT b)', right: 'λb.b', note: 'Equal on TRUE and FALSE only.' },
  { name: 'De Morgan on booleans', left: 'NOT (AND TRUE FALSE)', right: 'OR (NOT TRUE) (NOT FALSE)' },
  { name: 'η: λx.f x = f', left: 'λf x.f x', right: 'λf.f' },
  { name: 'Y f = f (Y f)', left: 'λf.Y f', right: 'λf.f (Y f)', note: 'True up to β-conversion, but neither side has a normal form.' },
  { name: 'FALSE is 0', left: 'FALSE', right: '0' },
];
