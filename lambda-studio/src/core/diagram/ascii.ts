// Text renderings of a Tromp diagram: pixel art and Unicode box-drawing characters.

import { type Diagram, rasterize } from './layout';

export function toPixelArt(d: Diagram, on = '█', off = ' '): string {
  const g = rasterize(d);
  const rows: string[] = [];
  for (let y = 0; y < g.h; y++) {
    let line = '';
    for (let x = 0; x < g.w; x++) line += g.cells[y * g.w + x] ? on : off;
    rows.push(line.replace(/\s+$/, ''));
  }
  return rows.join('\n');
}

const U = 1, R = 2, D = 4, L = 8;
const BOX: Record<number, string> = {
  0: ' ', [U]: '╵', [D]: '╷', [L]: '╴', [R]: '╶',
  [U | D]: '│', [L | R]: '─',
  [D | R]: '┌', [D | L]: '┐', [U | R]: '└', [U | L]: '┘',
  [U | D | R]: '├', [U | D | L]: '┤', [L | R | D]: '┬', [L | R | U]: '┴', [U | D | L | R]: '┼',
};

/**
 * Box-drawing rendering: one character per pixel column, one text line per two pixel rows
 * (λ bars sit on even rows and application links on odd rows, so nothing collides).
 */
export function toBoxChars(d: Diagram): string {
  const top = d.top;
  const cols = d.width;
  const rows = Math.floor((d.height - 1 - top) / 2) + 1;
  const g: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  const cy = (py: number) => Math.floor((py - top) / 2);
  const add = (r: number, c: number, bits: number) => { if (r >= 0 && r < rows && c >= 0 && c < cols) g[r][c] |= bits; };
  for (const s of d.segments) {
    if (s.kind === 'var') {
      const r1 = cy(s.y1), r2 = cy(s.y2);
      const open = s.y2 === d.height - 1; // the diagram's output line continues downward
      for (let r = r1; r <= r2; r++) add(r, s.x1, (r > r1 || s.y1 < 0 ? U : 0) | (r < r2 || open ? D : 0));
    } else {
      const r = cy(s.y1);
      for (let c = s.x1; c <= s.x2; c++) {
        if (s.kind === 'lam') add(r, c, L | R);
        else add(r, c, (c > s.x1 ? L : 0) | (c < s.x2 ? R : 0));
      }
    }
  }
  const lines = g.map((row) => row.map((b) => BOX[b] ?? '+').join('').replace(/\s+$/, ''));
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}
