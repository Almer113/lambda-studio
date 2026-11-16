import { useState } from 'react';
import { Pencil, Workflow, Wrench, Languages, Library as LibraryIcon, Eye } from 'lucide-react';
import { Editor } from './Editor';
import { DiagramView } from './DiagramView';
import { Library, CurrentTerm, Controls, Inspector } from './panels';
import { Header } from './Header';
import { Conversions, DataPanel } from './convert';
import { useApplyTheme } from './theme';
import { SourcePreview } from './SourcePreview';
import { useStore, type SideTab } from './store';
import { ExportDialog } from './ExportDialog';
import { ToolsPanel } from './tools';
import { Tutorial } from './Tutorial';
import { Help, useShortcuts } from './Help';
import { Guard } from './Boundary';
import { SourceStatus } from './NoTerm';
import { IconButton } from './IconButton';
import { TabList, TabPanel, type TabDef } from './Tabs';
import { Toast } from './Toast';

/** Phone layout: one area at a time. */
export type MobileTab = 'edit' | 'diagram' | 'tools' | 'convert' | 'library';

const MOBILE_TABS: TabDef<MobileTab>[] = [
  { id: 'edit', label: 'Edit', icon: Pencil },
  { id: 'diagram', label: 'Diagram', icon: Workflow },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'convert', label: 'Notations', icon: Languages },
  { id: 'library', label: 'Library', icon: LibraryIcon },
];

const SIDE_TABS: TabDef<SideTab>[] = [
  { id: 'notations', label: 'Notations', icon: Languages, title: 'The current term in every notation' },
  { id: 'tools', label: 'Tools', icon: Wrench, title: 'Expressions, truth and number tables, laws, data types, generators' },
];

/** Notations and Tools share the right-hand column, as tabs. */
function SidePanel() {
  const tab = useStore((s) => s.settings.sideTab);
  const setSetting = useStore((s) => s.setSetting);
  return (
    <div className="panel side-panel">
      <TabList tabs={SIDE_TABS} value={tab} onChange={(t) => setSetting('sideTab', t)} label="Notations and tools" idPrefix="side" className="side-tabs" />
      <TabPanel idPrefix="side" value={tab}>
        {tab === 'tools' ? <Guard name="Tools"><ToolsPanel /></Guard> : <Guard name="Notations"><Conversions /></Guard>}
      </TabPanel>
    </div>
  );
}

export function App() {
  useApplyTheme();
  useShortcuts();
  const [tab, setTabState] = useState<MobileTab>('diagram');
  const preview = useStore((s) => s.settings.sourcePreview);
  const setSetting = useStore((s) => s.setSetting);
  const setTab = (t: MobileTab) => {
    setTabState(t);
    if (t === 'tools') setSetting('sideTab', 'tools');
    if (t === 'convert') setSetting('sideTab', 'notations');
  };
  return (
    <div className="app" data-tab={tab}>
      <Header />
      <TabList tabs={MOBILE_TABS} value={tab} onChange={setTab} label="Sections" idPrefix="mobile" className="tabs" />
      <main className="layout" id="mobile-panel">
        <aside className="col-left"><Guard name="Library"><Library /></Guard><Guard name="Encode data"><DataPanel /></Guard></aside>
        <section className="col-center">
          <div className="panel editor-panel">
            <div className="panel-head">
              <h2>Source</h2>
              <span className="head-tools">
                <SourceStatus />
                <IconButton icon={Eye} className="toggle" label="Typeset preview of the source" pressed={preview} onClick={() => setSetting('sourcePreview', !preview)} />
              </span>
            </div>
            <Editor />
            {preview && <Guard name="Preview"><SourcePreview /></Guard>}
          </div>
          <Guard name="Controls"><Controls /></Guard>
          <Guard name="Current term"><CurrentTerm /></Guard>
          <Guard name="Tromp diagram"><DiagramView /></Guard>
        </section>
        <aside className="col-right">
          <Guard name="Inspector"><Inspector /></Guard>
          <SidePanel />
        </aside>
      </main>
      <Guard name="Export"><ExportDialog /></Guard>
      <Tutorial />
      <Help />
      <Toast />
    </div>
  );
}
