import Link from "next/link";

const TOKEN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])|(?:^|(?<=\s))@([a-z0-9_]{3,30})|(?:^|(?<=\s))#([\p{L}\p{N}_]{2,40})/giu;

/** Renders user text safely as React nodes (no HTML injection): links, @mentions and #tags are linkified. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(text.slice(last, idx));
    if (m[1]) nodes.push(<a key={i++} href={m[1]} target="_blank" rel="noopener noreferrer nofollow ugc" className="link break-all">{m[1]}</a>);
    else if (m[2]) nodes.push(<Link key={i++} href={`/profile/${m[2].toLowerCase()}`} className="link">@{m[2]}</Link>);
    else if (m[3]) nodes.push(<Link key={i++} href={`/search?q=${encodeURIComponent("#" + m[3])}`} className="link">#{m[3]}</Link>);
    last = idx + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <p className={className ?? "whitespace-pre-wrap break-words"}>{nodes}</p>;
}
