// Creator toolbar: actions on the selected subterm (click a line in the diagram or a part of
// the current term to select it). Results are written back to the source.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, currentTerm } from './store';
import { useFolder } from './panels';
import { ACTIONS, applicable, freshName, type EditAction } from '../core/edit';
import { getAt, size, type Path } from '../core/term';
import { parseProgram } from '../core/program';
import { printNamed } from '../core/formats/named';
import { X, CornerLeftUp } from 'lucide-react';
import { IconButton } from './IconButton';

function describePath(p: Path): string {
  if (p === '') return 'the whole term';
  return `${p.length} step${p.length === 1 ? '' : 's'} down`;
}

export function EditBar() {
  const term = useStore(currentTerm);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const edit = useStore((s) => s.edit);
  const eta = useStore((s) => s.settings.eta);
  const source = useStore((s) => s.source);
  const program = useStore((s) => s.program);
  const { fold, avoid } = useFolder();
  const [pending, setPending] = useState<EditAction | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const sub = useMemo(() => { if (!term || selected === null) return null; try { return getAt(term, selected); } catch { return null; } }, [term, selected]);
  const ok = useMemo(() => (term && selected !== null && sub ? applicable(term, selected, eta) : new Set<EditAction>()), [term, selected, sub, eta]);
  useEffect(() => { setPending(null); setError(null); }, [selected, term]);
  useEffect(() => { if (pending) { input.current?.focus(); input.current?.select(); } }, [pending]);
  if (!term || selected === null || !sub) return null;

  const taken = new Set<string>([...program.foldTable.names, ...program.defs.map((d) => d.name)]);
  const start = (a: EditAction) => {
    const info = ACTIONS.find((x) => x.id === a)!;
    setError(null);
    if (info.needsTerm) { setPending(a); setText(a === 'replace' ? printNamed(sub, { fold, avoid }).text : ''); return; }
    if (info.needsName) { setPending(a); setText(freshName('MY', taken)); return; }
    const err = edit(a, selected);
    if (err) setError(err);
  };
  const finish = () => {
    if (!pending) return;
    const info = ACTIONS.find((x) => x.id === pending)!;
    if (info.needsName) {
      const name = text.trim();
      if (!/^\p{L}[\p{L}0-9_']*$/u.test(name)) { setError('A name starts with a letter'); return; }
      if (taken.has(name)) { setError(`${name} is already defined`); return; }
      const err = edit('fold', selected, undefined, name);
      if (err) setError(err); else setPending(null);
      return;
    }
    // parse the argument with the prelude and the source's own definitions
    const named = program.format === 'named' || program.format === 'haskell';
    const p = parseProgram(named ? `${source}\n${text}` : text, 'named');
    const own = parseProgram(text, 'named');
    if (!text.trim() || !p.term || own.diagnostics.some((d) => d.severity === 'error')) { setError(own.diagnostics[0]?.message ?? 'Type a term'); return; }
    const err = edit(pending, selected, p.term);
    if (err) setError(err); else setPending(null);
  };

  const shown = size(sub) < 400 ? printNamed(sub, { fold, avoid }).text : `(${size(sub)} nodes)`;
  return (
    <div className="edit-bar" role="toolbar" aria-label="Edit the selected subterm">
      <div className="edit-sel">
        <span className="muted">Selected:</span> <code title={describePath(selected)}>{shown}</code>
        <IconButton icon={X} className="small" label="Clear the selection" shortcut="Esc" tip="above" onClick={() => select(null)} />
      </div>
      <div className="edit-actions">
        {ACTIONS.map((a) => (
          <button key={a.id} className={pending === a.id ? 'on' : ''} disabled={!ok.has(a.id)} title={a.title} onClick={() => start(a.id)}>{a.label}</button>
        ))}
        {selected !== '' && <IconButton icon={CornerLeftUp} text="Parent" label="Select the enclosing term" shortcut="↑" tip="above" onClick={() => select(selected.slice(0, -1))} />}
      </div>
      {pending && (
        <form className="edit-input" onSubmit={(e) => { e.preventDefault(); finish(); }}>
          <label>{pending === 'fold' ? 'Name' : pending === 'apply' ? `(${shown.length > 30 ? 'M' : shown}) applied to` : pending === 'pass' ? 'Function to pass it to' : 'Replace with'}
            <input ref={input} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} onKeyDown={(e) => { if (e.key === 'Escape') setPending(null); }} />
          </label>
          <button type="submit" className="primary">OK</button>
          <button type="button" onClick={() => setPending(null)}>Cancel</button>
        </form>
      )}
      {error && <p className="err">{error}</p>}
    </div>
  );
}
