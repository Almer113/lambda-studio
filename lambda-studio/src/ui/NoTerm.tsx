// Source problems where people look: the first one in the Source panel's header (click to go to
// it), and the reason in every panel that has no term to show.

import { useStore } from './store';
import { EXAMPLES } from '../core/prelude';

const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** The Source panel's header hint, or the first error (else warning) in the source. */
export function SourceStatus() {
  const program = useStore((s) => s.program);
  const source = useStore((s) => s.source);
  const reveal = useStore((s) => s.revealSource);
  const errors = program.diagnostics.filter((d) => d.severity === 'error');
  const list = errors.length ? errors : program.diagnostics.filter((d) => d.severity === 'warning');
  if (list.length === 0) return COARSE ? <span className="sub">λ and brackets: the bar under the source</span> : <span className="sub">Type <kbd>\</kbd> for λ · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs</span>;
  const d = list[0];
  const from = Math.min(d.from, source.length);
  const line = source.slice(0, from).split('\n').length;
  const more = list.length > 1 ? ` (+${list.length - 1} more)` : '';
  return (
    <button type="button" className={`source-problem ${d.severity}`} onClick={() => reveal?.(d.from, d.to)} title={`${d.message}${more}. Click to go there.`}>
      {d.severity === 'error' ? 'Error' : 'Warning'}, line {line}: {d.message}{more}
    </button>
  );
}

/** When the source has an error and no expression parsed, the last definition is shown instead: say so. */
export function FallbackNotice() {
  const program = useStore((s) => s.program);
  const source = useStore((s) => s.source);
  const reveal = useStore((s) => s.revealSource);
  const error = program.diagnostics.find((d) => d.severity === 'error');
  if (!program.term || !program.mainName || !error) return null;
  const line = source.slice(0, Math.min(error.from, source.length)).split('\n').length;
  return (
    <div className="fallback-notice" role="status">
      Showing <b>{program.mainName}</b>, the last definition: line {line} has an error.{' '}
      <button type="button" className="linklike" onClick={() => reveal?.(error.from, error.to)}>Go to the error</button>
    </div>
  );
}

const STARTERS = ['2 + 3', 'Boolean logic', 'Definitions', 'Factorial 3', 'Y combinator', 'Omega (loops)'];

/** A few examples to click when the source is empty. */
function Starters() {
  const items = STARTERS.map((n) => EXAMPLES.find((e) => e.name === n)).filter((e) => e !== undefined);
  return (
    <div className="starters">
      <p className="empty">Type a λ-term as the source, or start from an example:</p>
      <div className="chips">
        {items.map((ex) => (
          <button key={ex.name} type="button" className="chip" title={ex.src} onClick={() => {
            useStore.getState().setSource(ex.src, ex.format ?? 'auto');
            if (ex.note) useStore.setState({ message: { text: `${ex.name}: ${ex.note}`, tone: 'info' } });
          }}>{ex.name}</button>
        ))}
      </div>
    </div>
  );
}

/** Empty state for a panel that needs a term: says why there is none. */
export function NoTerm({ text = 'Nothing to show yet.', brief = false, starters = false }: { text?: string; brief?: boolean; starters?: boolean }) {
  const error = useStore((s) => s.program.diagnostics.find((d) => d.severity === 'error'));
  const blank = useStore((s) => s.source.trim() === '');
  if (!error) return starters && blank ? <Starters /> : <div className="empty">{text}</div>;
  if (brief) return <div className="empty">No term: the source has an error.</div>;
  return <div className="empty no-term">The source has an error: <span className="err-text">{error.message}</span></div>;
}
