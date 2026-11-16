// The header: File menu, examples, input format and evaluation options on the left; settings,
// tutorial, help and theme on the right. On a phone the options move into a "more" menu.

import {
  File as FileIcon, FilePlus, FolderOpen, Save, Share2, Download, Settings as SettingsIcon, GraduationCap, CircleHelp,
  Sun, Moon, Monitor, Ellipsis, RotateCcw, Check, BookOpen,
} from 'lucide-react';
import { useStore, shareLink, DEFAULT_SETTINGS, type Theme } from './store';
import { useExport } from './ExportDialog';
import { STRATEGIES, type Strategy } from '../core/reduce';
import { FORMATS, type FormatId } from '../core/program';
import { EXAMPLES, EXAMPLE_GROUPS } from '../core/prelude';
import { useTutorial } from './Tutorial';
import { useHelp } from './Help';
import { IconButton } from './IconButton';
import { Popover, MenuItem, MenuGroup } from './Popover';
import { NumberField } from './NumberField';
import { pickWorkspace, saveWorkspace } from './workspace';
import { useToast } from './Toast';
import { useMedia } from './useMedia';

/**
 * Copy a share link. The page URL is left alone (a link written into the address bar would bring
 * this snapshot back over later work on reload). Without clipboard access (e.g. plain http) the
 * link is shown for copying by hand.
 */
export async function copyShareLink() {
  const { source, format } = useStore.getState();
  let url: string;
  try { url = await shareLink(source, format); }
  catch { useStore.setState({ message: { text: 'Could not create a share link in this browser.', tone: 'error' } }); return; }
  try {
    if (!navigator.clipboard) throw new Error('no clipboard');
    await navigator.clipboard.writeText(url);
    useToast.getState().show('Share link copied');
    return;
  } catch { /* no clipboard access: show the link instead */ }
  try { window.prompt('Copy this link:', url); }
  catch { useStore.setState({ message: { text: `Copy this link: ${url}`, tone: 'info' } }); } // embedded pages may not allow prompt()
}

const NEW_SOURCE = '-- New term\n';

function FileMenu() {
  return (
    <Popover icon={FileIcon} label="File" text="File" menu>
      {(close) => (
        <>
          <MenuItem icon={FilePlus} close={close} onSelect={() => {
            const st = useStore.getState();
            const prev = { source: st.source, format: st.format };
            st.setSource(NEW_SOURCE, 'auto');
            useStore.setState({ message: { text: 'Started a new term.', tone: 'info', action: { label: 'Undo', run: () => useStore.getState().setSource(prev.source, prev.format) } } });
          }}>New</MenuItem>
          <MenuItem icon={FolderOpen} close={close} onSelect={pickWorkspace}>Open workspace…</MenuItem>
          <MenuItem icon={Save} close={close} onSelect={saveWorkspace}>Save workspace</MenuItem>
          <div className="menu-sep" role="separator" />
          <MenuItem icon={Share2} close={close} onSelect={copyShareLink}>Copy share link</MenuItem>
          <MenuItem icon={Download} close={close} onSelect={() => useExport.getState().show()}>Export…</MenuItem>
        </>
      )}
    </Popover>
  );
}

function ExamplesSelect() {
  // a menu, not a <select>: on Windows a select acts on every arrow-key press, loading each example
  return (
    <Popover icon={BookOpen} label="Load an example" text="Examples" menu className="examples-menu">
      {(close) => EXAMPLE_GROUPS.map((g) => (
        <MenuGroup key={g} label={g}>
          {EXAMPLES.map((ex) => (ex.group === g ? (
            <MenuItem key={ex.name} close={close} onSelect={() => {
              useStore.getState().setSource(ex.src, ex.format ?? 'auto');
              if (ex.note) useStore.setState({ message: { text: `${ex.name}: ${ex.note}`, tone: 'info' } });
            }}>{ex.name}</MenuItem>
          ) : null))}
        </MenuGroup>
      ))}
    </Popover>
  );
}

function InputSelect() {
  const format = useStore((s) => s.format);
  const detected = useStore((s) => s.program.format);
  const setFormat = useStore((s) => s.setFormat);
  const phone = useMedia('(max-width: 639px)');
  return (
    <label className="field">Input
      <select value={format} onChange={(e) => setFormat(e.target.value as FormatId | 'auto')}>
        <option value="auto">{phone ? 'Auto' : 'Auto-detect'}{format === 'auto' ? ` (${FORMATS.find((f) => f.id === detected)?.name})` : ''}</option>
        {(['λ', 'Combinators', 'Code', 'Bits & data'] as const).map((g) => (
          <optgroup key={g} label={g}>
            {FORMATS.filter((f) => f.group === g).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** Strategy, η and single-letter reading: they change what the term means or how it reduces. */
function EvalOptions() {
  const strategy = useStore((s) => s.settings.strategy);
  const eta = useStore((s) => s.settings.eta);
  const single = useStore((s) => s.settings.singleLetter);
  const setSetting = useStore((s) => s.setSetting);
  return (
    <>
      <label className="field">Strategy
        <select value={strategy} onChange={(e) => setSetting('strategy', e.target.value as Strategy)}>
          {STRATEGIES.map((st) => <option key={st.id} value={st.id} title={st.description}>{st.name}</option>)}
        </select>
      </label>
      <label className="check" title="Also contract η-redexes λx.M x → M"><input type="checkbox" checked={eta} onChange={(e) => setSetting('eta', e.target.checked)} aria-label="η-reduction: also contract λx.M x to M" /> η</label>
      <label className="check" title="Read λxy.xy as λx.λy.x y"><input type="checkbox" checked={single} onChange={(e) => setSetting('singleLetter', e.target.checked)} /> Single-letter vars</label>
    </>
  );
}

const THEMES: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: 'system', label: 'System theme', icon: Monitor },
  { id: 'light', label: 'Light theme', icon: Sun },
  { id: 'dark', label: 'Dark theme', icon: Moon },
];

function ThemeButton() {
  const theme = useStore((s) => s.settings.theme);
  const setSetting = useStore((s) => s.setSetting);
  const cur = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
  return <IconButton icon={cur.icon} label={`${cur.label} (switch to ${next.label.toLowerCase()})`} onClick={() => setSetting('theme', next.id)} />;
}

function SettingsPanel({ close }: { close(): void }) {
  const s = useStore((st) => st.settings);
  const setSetting = useStore((st) => st.setSetting);
  return (
    <div className="settings-panel">
      <h3>Settings</h3>
      <fieldset>
        <legend>Display</legend>
        <label className="check"><input type="checkbox" checked={s.numerals} onChange={(e) => setSetting('numerals', e.target.checked)} /> Show Church numerals as digits</label>
        <label className="field">λt f.f is shown as
          <select value={s.zeroAs} onChange={(e) => setSetting('zeroAs', e.target.value as '0' | 'FALSE')}>
            <option value="0">0</option><option value="FALSE">FALSE</option>
          </select>
        </label>
      </fieldset>
      <fieldset>
        <legend>Editor</legend>
        <label className="check"><input type="checkbox" checked={s.autoLambda} onChange={(e) => setSetting('autoLambda', e.target.checked)} /> Type \ to get λ</label>
      </fieldset>
      <fieldset>
        <legend>Limits for Run</legend>
        <label className="field">Steps <NumberField min={1} max={10_000_000} value={s.maxSteps} onChange={(v) => setSetting('maxSteps', v)} /></label>
        <label className="field">Term size (nodes) <NumberField min={100} max={50_000_000} value={s.maxSize} onChange={(v) => setSetting('maxSize', v)} /></label>
        <p className="muted small">Defaults: {DEFAULT_SETTINGS.maxSteps.toLocaleString('en')} steps, {DEFAULT_SETTINGS.maxSize.toLocaleString('en')} nodes. Normalize allows 100× the step limit.</p>
      </fieldset>
      <div className="settings-actions">
        <IconButton icon={RotateCcw} text="Reset all settings" label="Reset all settings to their defaults (the source is kept)" onClick={() => { useStore.getState().replaceSettings(); useToast.getState().show('Settings reset'); }} />
        <IconButton icon={Check} className="primary" text="Done" label="Close the settings" onClick={close} />
      </div>
    </div>
  );
}

export function Header() {
  const tutorialOpen = useTutorial((t) => t.open);
  return (
    <header className="header">
      <div className="brand"><span className="logo" aria-hidden>λ</span> <span className="brand-name">Lambda Studio</span></div>
      <div className="header-group">
        <FileMenu />
        <ExamplesSelect />
        <InputSelect />
      </div>
      <div className="header-group wide-only">
        <EvalOptions />
      </div>
      <div className="header-group header-end">
        <Popover icon={SettingsIcon} label="Settings" align="right">{(close) => <SettingsPanel close={close} />}</Popover>
        <span className="wide-only header-icons">
          <IconButton icon={GraduationCap} label="Tutorial" pressed={tutorialOpen} onClick={() => useTutorial.getState().set({ open: !tutorialOpen })} />
          <IconButton icon={CircleHelp} label="Help and keyboard shortcuts" shortcut="?" onClick={() => useHelp.getState().set(true)} />
          <ThemeButton />
        </span>
        <Popover icon={Ellipsis} label="More options" align="right" className="narrow-only">
          {(close) => (
            <div className="more-panel">
              <EvalOptions />
              <div className="more-actions">
                <IconButton icon={GraduationCap} text="Tutorial" label="Tutorial" pressed={tutorialOpen} onClick={() => { close(); useTutorial.getState().set({ open: !tutorialOpen }); }} />
                <IconButton icon={CircleHelp} text="Help" label="Help and keyboard shortcuts" onClick={() => { close(); useHelp.getState().set(true); }} />
                <ThemeButton />
              </div>
            </div>
          )}
        </Popover>
      </div>
    </header>
  );
}
