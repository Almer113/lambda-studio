import { useEffect, useRef } from 'react';
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, Decoration, type DecorationSet, highlightActiveLine, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting, HighlightStyle, bracketMatching } from '@codemirror/language';
import { setDiagnostics } from '@codemirror/lint';
import { tags } from '@lezer/highlight';
import { useStore } from './store';
import { autoLambdaEdit } from './autoLambda';

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

  useEffect(() => {
    const autoLambda = EditorView.inputHandler.of((v, from, to, text) => {
      const st = useStore.getState();
      if (!st.settings.autoLambda) return false;
      const e = autoLambdaEdit(v.state.doc.toString(), from, to, text, st.format === 'latex');
      if (!e) return false;
      v.dispatch({ changes: { from: e.from, to: e.to, insert: e.insert }, selection: { anchor: e.anchor } });
      return true;
    });
    const runKeys = keymap.of([
      { key: 'Mod-Enter', run: () => { useStore.getState().runToNormal(); return true; } },
      { key: 'Alt-ArrowRight', run: () => { useStore.getState().stepForward(); return true; } },
      { key: 'Alt-ArrowLeft', run: () => { useStore.getState().stepBack(); return true; } },
    ]);
    let timer: number | undefined;
    const onChange = EditorView.updateListener.of((u) => {
      if (!u.docChanged) return;
      window.clearTimeout(timer);
      const text = u.state.doc.toString();
      timer = window.setTimeout(() => useStore.getState().setSource(text), 150);
    });
    const exts: Extension[] = [
      lineNumbers(), history(), drawSelection(), highlightActiveLine(), bracketMatching(),
      lambdaLang, syntaxHighlighting(highlight), markField,
      autoLambda, runKeys, keymap.of([...defaultKeymap, ...historyKeymap]), onChange,
      EditorView.lineWrapping,
    ];
    const v = new EditorView({ state: EditorState.create({ doc: useStore.getState().source, extensions: exts }), parent: host.current! });
    view.current = v;
    useStore.getState().registerInsert((s: string) => {
      const sel = v.state.selection.main;
      v.dispatch({ changes: { from: sel.from, to: sel.to, insert: s }, selection: { anchor: sel.from + s.length } });
      v.focus();
    });
    return () => { useStore.getState().registerInsert(null); v.destroy(); };
  }, []);

  // external source changes (examples menu, share links)
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== source) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: source } });
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

  return <div className="editor" ref={host} />;
}
