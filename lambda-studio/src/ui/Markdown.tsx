// A small Markdown renderer for the bundled user guide: headings, paragraphs, lists, tables,
// fenced code, **bold**, `code` and [links](…). No HTML is passed through.

import { type ReactNode } from 'react';

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('`')) out.push(<code key={`${key}-${k++}`}>{t.slice(1, -1)}</code>);
    else if (t.startsWith('**')) out.push(<b key={`${key}-${k++}`}>{t.slice(2, -2)}</b>);
    else {
      const [, label, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)!;
      // links to other docs files cannot be opened from the app: show the name only
      out.push(/^https?:\/\//.test(href) ? <a key={`${key}-${k++}`} href={href} target="_blank" rel="noreferrer">{label}</a> : <span key={`${key}-${k++}`}>{label}</span>);
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export function Markdown({ text, skipTitle = false }: { text: string; skipTitle?: boolean }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0, n = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${n++}`;
    if (line.startsWith('```')) {
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) body.push(lines[i]);
      i++;
      blocks.push(<pre key={key} className="md-code">{body.join('\n')}</pre>);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      i++;
      if (h[1].length === 1 && skipTitle) continue;
      const level = Math.min(4, h[1].length + 2);
      const Tag = `h${level}` as 'h3' | 'h4';
      blocks.push(<Tag key={key}>{inline(h[2], key)}</Tag>);
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[] = [];
      for (; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i]);
      const [head, , ...body] = rows;
      blocks.push(
        <table key={key} className="md-table">
          <thead><tr>{cells(head).map((c, k) => <th key={k}>{inline(c, `${key}h${k}`)}</th>)}</tr></thead>
          <tbody>{body.map((r, j) => <tr key={j}>{cells(r).map((c, k) => <td key={k}>{inline(c, `${key}r${j}c${k}`)}</td>)}</tr>)}</tbody>
        </table>,
      );
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      for (; i < lines.length && /^\s*([-*]\s+|\s{2,}\S)/.test(lines[i]); i++) {
        if (/^\s*[-*]\s+/.test(lines[i])) items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        else items[items.length - 1] += ' ' + lines[i].trim();
      }
      blocks.push(<ul key={key}>{items.map((it, k) => <li key={k}>{inline(it, `${key}-${k}`)}</li>)}</ul>);
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    const para: string[] = [];
    for (; i < lines.length && lines[i].trim() !== '' && !/^(#|```|\||\s*[-*]\s)/.test(lines[i]); i++) para.push(lines[i]);
    blocks.push(<p key={key}>{inline(para.join(' '), key)}</p>);
  }
  return <div className="markdown">{blocks}</div>;
}
