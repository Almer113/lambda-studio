// Source problems where people look: the first one in the Source panel's header (click to go to
// it), and the reason in every panel that has no term to show.

import { useStore } from './store';

/** The Source panel's header hint, or the first error (else warning) in the source. */
export function SourceStatus() {
  const program = useStore((s) => s.program);
  const source = useStore((s) => s.source);
  const reveal = useStore((s) => s.revealSource);
  const errors = program.diagnostics.filter((d) => d.severity === 'error');
  const list = errors.length ? errors : program.diagnostics.filter((d) => d.severity === 'warning');
  if (list.length === 0) return <span className="sub">Type <kbd>\</kbd> for λ · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs</span>;
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

/** Empty state for a panel that needs a term: says why there is none. */
export function NoTerm({ text = 'Nothing to show yet.', brief = false }: { text?: string; brief?: boolean }) {
  const error = useStore((s) => s.program.diagnostics.find((d) => d.severity === 'error'));
  if (!error) return <div className="empty">{text}</div>;
  if (brief) return <div className="empty">No term: the source has an error.</div>;
  return <div className="empty no-term">The source has an error: <span className="err-text">{error.message}</span></div>;
}
