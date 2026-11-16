// A button that opens a small panel (a menu or a settings sheet). Closes on Escape, on a click
// outside, and when an item asks for it; focus returns to the button.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { BookOpen, type LucideIcon } from 'lucide-react';
import { IconButton } from './IconButton';

export function Popover({ icon, label, text, children, align = 'left', className = '', menu = false }: {
  icon: LucideIcon; label: string; text?: string; align?: 'left' | 'right'; className?: string;
  /** menu: the panel is a list of actions (arrow keys move between them). */
  menu?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = () => {
    setOpen(false);
    (root.current?.querySelector('button') as HTMLButtonElement | null)?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    // move focus into the panel
    const first = panel.current?.querySelector<HTMLElement>('button, select, input, [tabindex="0"]');
    first?.focus();
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (!menu || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    const items = [...(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const j = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[j]?.focus();
    e.preventDefault();
  };
  return (
    <div className={`popover ${className}`} ref={root} onKeyDown={onKey}>
      <IconButton icon={icon} label={label} text={text} aria-haspopup={menu ? 'menu' : 'dialog'} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className={open ? 'open' : ''} />
      {open && (
        <div id={id} ref={panel} className={`popover-panel ${align}`} role={menu ? 'menu' : 'dialog'} aria-label={label}>
          {children(close)}
        </div>
      )}
    </div>
  );
}

/** One action in a Popover menu. */
export function MenuItem({ icon: Icon, children, onSelect, close, disabled, hint }: {
  icon?: LucideIcon; children: ReactNode; onSelect(): void; close(): void; disabled?: boolean; hint?: string;
}) {
  return (
    <button type="button" role="menuitem" className="menu-item" disabled={disabled} onClick={() => { close(); onSelect(); }}>
      {Icon && <Icon size={16} aria-hidden />}<span>{children}</span>{hint && <kbd>{hint}</kbd>}
    </button>
  );
}

/** A labelled group of items in a Popover menu. */
export function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="menu-group">
      <div id={id} className="menu-group-label" role="presentation">{label}</div>
      {children}
    </div>
  );
}

/** "Examples" as a menu (a <select> that acts on change loads an item with each arrow key on Windows). */
export function ExampleMenu<T>({ label, items, name, onPick }: { label: string; items: readonly T[]; name: (x: T) => string; onPick: (x: T) => void }) {
  return (
    <Popover icon={BookOpen} label={label} text="Examples" menu className="examples-menu">
      {(close) => items.map((x) => <MenuItem key={name(x)} close={close} onSelect={() => onPick(x)}>{name(x)}</MenuItem>)}
    </Popover>
  );
}
