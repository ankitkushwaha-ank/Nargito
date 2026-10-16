"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Avatar } from "@/components/ui/kit";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import { useLocale } from "@/i18n/client";

export type ConvItem = { id: string; last_message_at: string; other_name: string; other_username: string; other_avatar: string | null; last_body: string | null; last_kind: string | null; unread: number; context_title: string | null };

export function ConversationList({ items, activeId, empty }: { items: ConvItem[]; activeId: string | null; empty: string }) {
  const [q, setQ] = useState("");
  const locale = useLocale();
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((c) => [c.other_name, c.other_username, c.context_title, c.last_body].some((v) => v?.toLowerCase().includes(s)));
  }, [items, q]);
  return (
    <>
      <div className="border-b border-line p-3">
        <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden /><label className="sr-only" htmlFor="mq">Search conversations</label><input id="mq" value={q} onChange={(e) => setQ(e.target.value)} className="input !pl-8 text-sm" placeholder="Search conversations" /></div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 && <li className="p-6 text-center text-sm text-muted">{q ? "No matching conversations." : empty}</li>}
        {shown.map((c) => (
          <li key={c.id}>
            <Link href={`/messages/${c.id}`} aria-current={activeId === c.id ? "page" : undefined} className={cn("flex items-center gap-3 border-b border-line/60 p-3 hover:bg-primary-tint", activeId === c.id && "bg-primary-tint")}>
              <Avatar name={c.other_name} src={c.other_avatar} size={44} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2"><span className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{c.other_name}</span><span className="shrink-0 text-xs text-muted">{timeAgo(c.last_message_at, locale)}</span></span>
                {c.context_title && <span className="block truncate text-xs text-primary">Re: {c.context_title}</span>}
                <span className={cn("block truncate text-sm", c.unread ? "text-ink" : "text-muted")}>{c.last_kind === "image" ? "Photo" : c.last_kind === "file" ? "Attachment" : c.last_body}</span>
              </span>
              {c.unread > 0 && <span className="min-w-[20px] rounded-full bg-primary px-1.5 text-center text-xs font-semibold leading-5 text-white"><span className="sr-only">{c.unread} unread</span><span aria-hidden>{c.unread}</span></span>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
