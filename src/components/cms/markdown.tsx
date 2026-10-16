import Link from "next/link";

/** Minimal, safe markdown renderer (headings, paragraphs, lists, tables, bold, italics, links). Never emits raw HTML. */
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0; let i = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={`${key}b${i++}`}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("*")) out.push(<em key={`${key}e${i++}`}>{tok.slice(1, -1)}</em>);
    else {
      const mm = tok.match(/\[([^\]]+)\]\(([^)\s]+)\)/)!;
      const href = mm[2]!;
      const safe = /^(\/(?!\/)|https?:\/\/|mailto:)/i.test(href);
      out.push(safe ? (href.startsWith("/") ? <Link key={`${key}l${i++}`} href={href}>{mm[1]}</Link> : <a key={`${key}l${i++}`} href={href} rel="noopener noreferrer" target="_blank">{mm[1]}</a>) : mm[1]);
    }
    last = idx + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0; let k = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) { i++; continue; }
    if (/^###\s+/.test(line)) { blocks.push(<h3 key={k++}>{inline(line.replace(/^###\s+/, ""), `h${k}`)}</h3>); i++; continue; }
    if (/^##\s+/.test(line)) { blocks.push(<h2 key={k++}>{inline(line.replace(/^##\s+/, ""), `h${k}`)}</h2>); i++; continue; }
    if (/^#\s+/.test(line)) { blocks.push(<h2 key={k++}>{inline(line.replace(/^#\s+/, ""), `h${k}`)}</h2>); i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*[-*]\s+/, ""));
      blocks.push(<ul key={k++}>{items.map((t, j) => <li key={j}>{inline(t, `u${k}${j}`)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*\d+\.\s+/, ""));
      blocks.push(<ol key={k++}>{items.map((t, j) => <li key={j}>{inline(t, `o${k}${j}`)}</li>)}</ol>);
      continue;
    }
    if (/^\|.*\|$/.test(line.trim())) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i]!.trim())) {
        const cells = lines[i]!.trim().slice(1, -1).split("|").map((c) => c.trim());
        if (!cells.every((c) => /^-+$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(<div key={k++} className="my-3 overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr>{head?.map((c, j) => <th key={j} scope="col" className="border-b border-line px-3 py-2 text-left">{c}</th>)}</tr></thead><tbody>{body.map((r, j) => <tr key={j}>{r.map((c, n) => <td key={n} className="border-b border-line px-3 py-2">{inline(c, `t${k}${j}${n}`)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,3}\s|\s*[-*]\s|\s*\d+\.\s|\|)/.test(lines[i]!)) para.push(lines[i++]!);
    blocks.push(<p key={k++}>{inline(para.join(" "), `p${k}`)}</p>);
  }
  return <div className="prose-n">{blocks}</div>;
}
