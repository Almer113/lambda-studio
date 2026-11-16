// Accessible tab lists: roles, aria-selected/controls, and arrow-key / Home / End navigation.

import { type ReactNode, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface TabDef<T extends string> { id: T; label: string; icon?: LucideIcon; title?: string }

export function TabList<T extends string>({ tabs, value, onChange, label, idPrefix, className = '' }: {
  tabs: TabDef<T>[]; value: T; onChange(v: T): void; label: string; idPrefix: string; className?: string;
}) {
  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === value);
    let j = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabs.length - 1;
    if (j < 0) return;
    e.preventDefault();
    onChange(tabs[j].id);
    (document.getElementById(`${idPrefix}-tab-${tabs[j].id}`) as HTMLElement | null)?.focus();
  };
  return (
    <div className={`tablist ${className}`} role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map((t) => {
        const Icon = t.icon;
        const on = t.id === value;
        return (
          <button key={t.id} id={`${idPrefix}-tab-${t.id}`} type="button" role="tab" aria-selected={on} aria-controls={`${idPrefix}-panel`}
            tabIndex={on ? 0 : -1} className={on ? 'on' : ''} title={t.title} onClick={() => onChange(t.id)}>
            {Icon && <Icon size={15} aria-hidden />}<span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idPrefix, value, children, className = '' }: { idPrefix: string; value: string; children: ReactNode; className?: string }) {
  return <div id={`${idPrefix}-panel`} role="tabpanel" aria-labelledby={`${idPrefix}-tab-${value}`} className={className}>{children}</div>;
}
