// Pixel-exact comparison against John Tromp's reference implementation.
// Fixtures come from `blc pbm` in github.com/tromp/AIT; regenerate with
//   node scripts/make-golden.mjs ../tools/AIT/blc.exe > tests/golden/tromp.json
import { describe, it, expect } from 'vitest';
import golden from './golden/tromp.json';
import { decodeBLC } from '../src/core/formats/blc';
import { layout, rasterize } from '../src/core/diagram/layout';

interface Golden { name: string; lam: string; blc: string; width: number; height: number; rows: string[] }

function ourRows(bits: string): { w: number; h: number; rows: string[] } {
  const t = decodeBLC(bits).term!;
  const r = rasterize(layout(t));
  const rows: string[] = [];
  for (let y = 0; y < r.h; y++) {
    let s = '';
    for (let x = 0; x < r.w; x++) s += r.cells[y * r.w + x] ? '1' : '0';
    rows.push(s);
  }
  return { w: r.w, h: r.h, rows };
}

describe('Tromp diagrams match the reference AIT implementation', () => {
  for (const g of golden as Golden[]) {
    it(`${g.name}: ${g.lam}`, () => {
      const ours = ourRows(g.blc);
      expect([ours.w, ours.h]).toEqual([g.width, g.height]);
      expect(ours.rows.join('\n')).toBe(g.rows.join('\n'));
    });
  }
});
