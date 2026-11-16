// Buttons with an icon: one component sets the accessible name and a tooltip that also shows on
// keyboard focus. A copy button with uniform feedback lives here too.

import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Check, Copy, type LucideIcon } from 'lucide-react';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  /** Accessible name and tooltip. */
  label: string;
  /** Shown in the tooltip, e.g. "Alt+→". */
  shortcut?: string;
  /** Visible text next to the icon (the label is then usually the same or longer). */
  text?: ReactNode;
  /** Tooltip placement. */
  tip?: 'below' | 'above';
  pressed?: boolean;
}

export function IconButton({ icon: Icon, label, shortcut, text, tip = 'below', pressed, className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      className={`icon-btn${text !== undefined ? ' with-text' : ''} ${className}`.trim()}
      aria-label={label}
      aria-pressed={pressed}
      data-tip={shortcut ? `${label} (${shortcut})` : label}
      data-tip-pos={tip}
    >
      <Icon size={16} strokeWidth={2} aria-hidden focusable={false} />
      {text !== undefined && <span>{text}</span>}
    </button>
  );
}

/** Copy text to the clipboard; the icon turns into a tick, or the label reports a failure.
 *  caption: short visible text (e.g. "TeX" for the LaTeX copy next to the plain one). */
export function CopyButton({ text, what, className = '', showText = false, caption }: { text: string | (() => string); what: string; className?: string; showText?: boolean; caption?: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(typeof text === 'function' ? text() : text);
      setState('ok');
    } catch { setState('fail'); }
    setTimeout(() => setState('idle'), 1400);
  };
  const label = state === 'ok' ? `Copied ${what}` : state === 'fail' ? 'Copying is not allowed here' : `Copy ${what}`;
  return (
    <IconButton
      icon={state === 'ok' ? Check : Copy}
      label={label}
      text={showText ? (state === 'ok' ? 'Copied' : state === 'fail' ? 'Not allowed' : 'Copy') : caption}
      className={`copy ${state === 'ok' ? 'copied' : ''} ${className}`}
      onClick={copy}
    />
  );
}
