// Segment colours for diagrams (screen, exports and animation share these).

import { type Segment } from './layout';
import { depthAt } from '../term';

export type ColorMode = 'mono' | 'binder' | 'depth' | 'kind';

export const COLOR_MODES: { id: ColorMode; name: string }[] = [
  { id: 'binder', name: 'Colour by binder' },
  { id: 'depth', name: 'Colour by depth' },
  { id: 'kind', name: 'Colour by kind' },
  { id: 'mono', name: 'Monochrome' },
];

function hueOf(path: string): number {
  let h = 2166136261;
  for (let k = 0; k < path.length; k++) h = Math.imul(h ^ path.charCodeAt(k), 16777619);
  return (h >>> 0) % 360;
}

/** HSL (h in degrees, s and l in percent) to #rrggbb. */
export function hsl(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

export function foreground(dark: boolean): string { return dark ? '#e8e6e3' : '#1d1d1f'; }

/** Colour of a segment as #rrggbb. */
export function segmentColor(s: Segment, mode: ColorMode, dark: boolean): string {
  if (mode === 'mono') return foreground(dark);
  const L = dark ? 68 : 42, S = dark ? 70 : 65;
  if (mode === 'kind') {
    if (s.kind === 'lam') return dark ? '#a497ff' : '#5b4bd6';
    if (s.kind === 'app') return dark ? '#f0a35e' : '#b4540a';
    return s.binder == null ? (dark ? '#f87171' : '#dc2626') : (dark ? '#4fd1b5' : '#0f7b6c');
  }
  if (mode === 'binder') {
    if (s.kind === 'app') return dark ? '#8a8f98' : '#6b7280';
    const key = s.kind === 'lam' ? s.path : s.binder;
    if (key === null || key === undefined) return dark ? '#f87171' : '#dc2626';
    return hsl(hueOf(key + '#'), S, L);
  }
  const d = s.kind === 'lam' ? depthAt(s.path) : s.kind === 'var' && s.binder != null ? depthAt(s.binder) : depthAt(s.path);
  return hsl((200 + d * 37) % 360, S, L);
}

/** Redex highlight colours (function λ and its variables, argument, application link). */
export const HIGHLIGHT = {
  light: { fn: '#d6336c', arg: '#1c7ed6', link: '#f59f00' },
  dark: { fn: '#ff6b9d', arg: '#4dabf7', link: '#ffd43b' },
};
