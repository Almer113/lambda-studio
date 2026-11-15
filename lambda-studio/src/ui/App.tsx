import { useState } from 'react';
import { Editor } from './Editor';
import { DiagramView } from './DiagramView';
import { Header, Library, CurrentTerm, Controls, Conversions, Inspector } from './panels';
import { useApplyTheme } from './theme';

type Tab = 'edit' | 'diagram' | 'convert' | 'library';

export function App() {
  useApplyTheme();
  const [tab, setTab] = useState<Tab>('diagram');
  return (
    <div className="app" data-tab={tab}>
      <Header />
      <nav className="tabs" aria-label="Sections">
        {(['edit', 'diagram', 'convert', 'library'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </nav>
      <main className="layout">
        <aside className="col-left"><Library /></aside>
        <section className="col-center">
          <div className="panel editor-panel"><div className="panel-head"><h2>Source</h2><span className="sub">Type <kbd>\</kbd> for λ · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs</span></div><Editor /></div>
          <CurrentTerm />
          <Controls />
          <DiagramView />
        </section>
        <aside className="col-right">
          <Inspector />
          <Conversions />
        </aside>
      </main>
    </div>
  );
}
