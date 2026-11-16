import { useEffect, useRef } from 'react';
import { Annotation, Compartment, EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, Decoration, type DecorationSet, highlightActiveLine, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting, HighlightStyle, bracketMatching } from '@codemirror/language';
import { setDiagnostics, lintGutter } from '@codemirror/lint';
import { tags } from '@lezer/highlight';
import { useStore } from './store';
import { autoLambdaEdit } from './autoLambda';
import { useIsDark } from './theme';

/** Marks changes that come from the store (examples, edits, share links), not from typing. */
const External = Annotation.define<boolean>();

// Colours from the page's CSS variables, so the editor follows the light and dark themes. The
// dark flag (a compartment) also switches CodeMirror's own base theme.
const darkMode = new Compartment();
const editorTheme = EditorView.theme({
  '.cm-selectionBackground': { background: 'color-mix(in srgb, var(--accent) 22%, transparent)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': { background: 'color-mix(in srgb, var(--accent) 34%, transparent)' },
  '.cm-tooltip': { background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', boxShadow: '0 6px 18px rgb(0 0 0 / 0.25)' },
  '.cm-tooltip.cm-tooltip-lint': { maxWidth: '420px' },
  '.cm-diagnostic': { padding: '4px 8px', fontFamily: 'inherit', fontSize: '13px' },
  '.cm-diagnostic-error': { borderLeft: '4px solid var(--danger)' },
  '.cm-diagnostic-warning': { borderLeft: '4px solid var(--warn)' },
  '.cm-matchingBracket': { background: 'color-mix(in srgb, var(--accent) 25%, transparent)', outline: 'none' },
});

const lambdaLang = StreamLanguage.define<{ defLine: boolean }>({
  startState: () => ({ defLine: false }),
  token(stream, state) {
    if (stream.sol()) state.defLine = false;
    if (stream.eatSpace()) return null;
    if (stream.match('--') || stream.match('//') || stream.match('#')) { stream.skipToEnd(); return 'comment'; }
    if (stream.match(/^[λ\\]/)) return 'keyword';
    if (stream.match(/^(->|→|\.)/)) return 'punctuation';
    if (stream.match(/^(:=|=|≡)/)) return 'operator';
    if (stream.match(/^[0-9]+/)) return 'number';
    if (stream.match(/^"[^"\n]*"?/)) return 'string';
    if (stream.match(/^(let|in)\b/)) return 'keyword';
    if (stream.match(/^[\p{Lu}Ωω][\p{L}\p{N}_'₀-₉]*/u)) return 'typeName';
    if (stream.match(/^[\p{L}_][\p{L}\p{N}_'₀-₉]*/u)) return 'variableName';
    stream.next();
    return 'bracket';
  },
});

const highlight = HighlightStyle.define([
  { tag: tags.comment, color: 'var(--muted)', fontStyle: 'italic' },
  { tag: tags.keyword, color: 'var(--accent)', fontWeight: '600' },
  { tag: tags.number, color: 'var(--num)' },
  { tag: tags.string, color: 'var(--num)' },
  { tag: tags.typeName, color: 'var(--def)' },
  { tag: tags.operator, color: 'var(--accent)' },
  { tag: tags.punctuation, color: 'var(--muted)' },
]);

// Highlight a source range (from diagram / term hover)
const setMark = StateEffect.define<{ from: number; to: number } | null>();
const markField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) if (e.is(setMark)) {
      deco = e.value && e.value.to > e.value.from ? Decoration.set([Decoration.mark({ class: 'cm-linked' }).range(e.value.from, e.value.to)]) : Decoration.none;
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function Editor() {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const source = useStore((s) => s.source);
  const program = useStore((s) => s.program);
  const hover = useStore((s) => s.hover);
  const index = useStore((s) => s.index);
  const dark = useIsDark();
  /** Typed text waits briefly before it is compiled; this is the pending commit. */
  const pending = useRef<number | undefined>(undefined);

  useEffect(() => {
    const commit = (v: EditorView) => {
      window.clearTimeout(pending.current);
      pending.current = undefined;
      const text = v.state.doc.toString();
      if (text !== useStore.getState().source) useStore.getState().setSource(text);
    };
    const autoLambda = EditorView.inputHandler.of((v, from, to, text) => {
      const st = useStore.getState();
      if (!st.settings.autoLambda) return false;
      const e = autoLambdaEdit(v.state.doc.toString(), from, to, text, st.format === 'latex');
      if (!e) return false;
      v.dispatch({ changes: { from: e.from, to: e.to, insert: e.insert }, selection: { anchor: e.anchor } });
      return true;
    });
    // these act on what was just typed, so a pending commit goes through first
    const runKeys = keymap.of([
      { key: 'Mod-Enter', run: (v) => { commit(v); useStore.getState().runToNormal(); return true; } },
      { key: 'Alt-ArrowRight', mac: 'Ctrl-Alt-ArrowRight', run: (v) => { commit(v); useStore.getState().stepForward(); return true; } },
      { key: 'Alt-ArrowLeft', mac: 'Ctrl-Alt-ArrowLeft', run: (v) => { commit(v); useStore.getState().stepBack(); return true; } },
    ]);
    const onChange = EditorView.updateListener.of((u) => {
      // changes pushed in from the store are already there; echoing them back would reset the
      // timeline, the selection and the status message
      if (!u.transactions.some((tr) => tr.docChanged && !tr.annotation(External))) return;
      window.clearTimeout(pending.current);
      pending.current = window.setTimeout(() => commit(u.view), 150);
    });
    const exts: Extension[] = [
      lineNumbers(), lintGutter(), history(), drawSelection(), highlightActiveLine(), bracketMatching(),
      lambdaLang, syntaxHighlighting(highlight), markField,
      autoLambda, runKeys, keymap.of([...defaultKeymap, ...historyKeymap]), onChange,
      EditorView.lineWrapping, editorTheme, darkMode.of(EditorView.darkTheme.of(dark)),
      EditorView.contentAttributes.of({ 'aria-label': 'Source' }),
    ];
    const v = new EditorView({ state: EditorState.create({ doc: useStore.getState().source, extensions: exts }), parent: host.current! });
    view.current = v;
    // Until the user has placed the cursor, insertions go at the end of the main expression (the
    // cursor would otherwise sit at the very start, and `K` would land before `PLUS 2 3`).
    let placed = false;
    v.contentDOM.addEventListener('pointerdown', () => { placed = true; });
    v.contentDOM.addEventListener('keydown', () => { placed = true; });
    useStore.getState().registerInsert((s: string) => {
      const doc = v.state.doc;
      const sel = placed ? v.state.selection.main : { from: doc.length, to: doc.length };
      let from = sel.from;
      const to = sel.to;
      if (!placed) { while (from > 0 && /\s/.test(doc.sliceString(from - 1, from))) from--; }
      // keep tokens apart: a space on either side unless there is one (or a bracket) already
      const before = doc.sliceString(Math.max(0, from - 1), from), after = doc.sliceString(to, to + 1);
      const text = (from > 0 && !/[\s(\[]/.test(before) ? ' ' : '') + s + (after && !/[\s)\],]/.test(after) ? ' ' : '');
      v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, scrollIntoView: true });
      placed = true;
      v.focus();
    });
    useStore.getState().registerReveal((from, to) => {
      const len = v.state.doc.length;
      const a = Math.min(from, len), b = Math.min(Math.max(to, from), len);
      v.dispatch({ selection: { anchor: a, head: b }, scrollIntoView: true });
      v.focus();
    });
    return () => {
      window.clearTimeout(pending.current);
      useStore.getState().registerInsert(null);
      useStore.getState().registerReveal(null);
      v.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { view.current?.dispatch({ effects: darkMode.reconfigure(EditorView.darkTheme.of(dark)) }); }, [dark]);

  // external source changes (examples menu, edits, share links)
  useEffect(() => {
    const v = view.current;
    if (!v || v.state.doc.toString() === source) return;
    window.clearTimeout(pending.current); // the store's text wins over anything not yet committed
    pending.current = undefined;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: source }, annotations: External.of(true) });
  }, [source]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const len = v.state.doc.length;
    const diags = program.diagnostics.map((d) => ({ from: Math.min(d.from, len), to: Math.min(Math.max(d.to, d.from), len), message: d.message, severity: d.severity }));
    v.dispatch(setDiagnostics(v.state, diags));
  }, [program]);

  // link hover to source spans (only meaningful for the original, unreduced term)
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    let span = null as { from: number; to: number } | null;
    if (hover !== null && index === 0) {
      for (let p = hover; ; p = p.slice(0, -1)) {
        const s = program.spans.get(p);
        if (s) { span = s; break; }
        if (p === '') break;
      }
    }
    const len = v.state.doc.length;
    v.dispatch({ effects: setMark.of(span && span.to <= len ? span : null) });
  }, [hover, index, program]);

  /** Type a symbol at the cursor (touch screens have no easy λ, dot or brackets). */
  const typeSymbol = (s: string) => {
    const v = view.current;
    if (!v) return;
    const { from, to } = v.state.selection.main;
    const text = s === '( )' ? '()' : s;
    v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + (s === '( )' ? 1 : text.length) }, userEvent: 'input.type' });
    v.focus();
  };
  return (
    <>
      <div className="editor" ref={host} />
      <div className="symbol-bar" role="toolbar" aria-label="Type a symbol">
        {SYMBOLS.map(([s, name]) => (
          // keep the editor focused (and the on-screen keyboard up) while tapping
          <button key={s} type="button" aria-label={name} onPointerDown={(e) => e.preventDefault()} onClick={() => typeSymbol(s)}>{s}</button>
        ))}
      </div>
    </>
  );
}

const SYMBOLS: [string, string][] = [['λ', 'lambda'], ['.', 'dot'], ['( )', 'brackets'], ['(', 'open bracket'], [')', 'close bracket'], ['=', 'equals'], ['_', 'underscore']];
