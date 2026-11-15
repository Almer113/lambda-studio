import { useState } from 'react';
import { Editor } from './Editor';
import { DiagramView } from './DiagramView';
import { Header, Library, CurrentTerm, Controls, Inspector } from './panels';
import { Conversions, DataPanel } from './convert';
import { useApplyTheme } from './theme';
import { SourcePreview } from './SourcePreview';
import { useStore } from './store';
import { ExportDialog } from './ExportDialog';

type Tab = 'edit' | 'diagram' | 'convert' | 'library';

export function App() {
  useApplyTheme();
  const [tab, setTab] = useState<Tab>('diagram');
  const preview = useStore((s) => s.settings.sourcePreview);
  const setSetting = useStore((s) => s.setSetting);
  return (
    <div className="app" data-tab={tab}>
      <Header />
      <nav className="tabs" aria-label="Sections">
        {(['edit', 'diagram', 'convert', 'library'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </nav>
      <main className="layout">
        <aside className="col-left"><Library /><DataPanel /></aside>
        <section className="col-center">
          <div className="panel editor-panel">
            <div className="panel-head">
              <h2>Source</h2>
              <span className="head-tools">
                <span className="sub">Type <kbd>\</kbd> for λ · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs</span>
                <label className="check" title="Typeset preview of the source"><input type="checkbox" checked={preview} onChange={(e) => setSetting('sourcePreview', e.target.checked)} /> Preview</label>
              </span>
            </div>
            <Editor />
            {preview && <SourcePreview />}
          </div>
          <CurrentTerm />
          <Controls />
          <DiagramView />
        </section>
        <aside className="col-right">
          <Inspector />
          <Conversions />
        </aside>
      </main>
      <ExportDialog />
    </div>
  );
}
