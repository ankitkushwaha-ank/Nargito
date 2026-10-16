"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Trash2, Reply } from "lucide-react";
import { Avatar, Skeleton } from "@/components/ui/kit";
import { RichText } from "./rich-text";
import { callApi } from "@/lib/client-api";
import { timeAgo } from "@/lib/format";
import { useLocale, useT } from "@/i18n/client";

type C = { id: string; parentId: string | null; body: string; createdAt: string; edited: boolean; mine: boolean; author: { id: string; username: string; displayName: string; avatarUrl: string | null } };

export function Comments({ postId, onCount }: { postId: string; onCount?: (delta: number) => void }) {
  const [items, setItems] = useState<C[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locale = useLocale();
  const t = useT();

  const load = useCallback(async () => {
    setError(null);
    const r = await callApi<{ items: C[] }>(`/api/posts/${postId}/comments`, "GET");
    if (r.ok) setItems(r.items); else setError(r.error);
  }, [postId]);
  useEffect(() => { void load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const r = await callApi(`/api/posts/${postId}/comments`, "POST", { body: text, parentId: replyTo });
    setBusy(false);
    if (r.ok) { setText(""); setReplyTo(null); onCount?.(1); await load(); } else setError(r.error);
  }
  async function remove(id: string) {
    if (!confirm("Delete this comment?")) return;
    const r = await callApi(`/api/comments/${id}`, "DELETE");
    if (r.ok) { onCount?.(-1); await load(); } else setError(r.error);
  }

  const roots = (items ?? []).filter((c) => !c.parentId);
  const kids = (id: string) => (items ?? []).filter((c) => c.parentId === id);
  const render = (c: C, depth = 0) => (
    <li key={c.id} className={depth ? "ml-8" : ""}>
      <div className="flex gap-2">
        <Link href={`/profile/${c.author.username}`}><Avatar name={c.author.displayName} src={c.author.avatarUrl} size={32} /></Link>
        <div className="min-w-0 flex-1 rounded-lg bg-bg px-3 py-2">
          <div className="flex items-baseline gap-2"><Link href={`/profile/${c.author.username}`} className="text-sm font-medium hover:underline">{c.author.displayName}</Link><span className="text-xs text-muted">{timeAgo(c.createdAt, locale)}{c.edited ? " · edited" : ""}</span></div>
          <div className="text-sm"><RichText text={c.body} /></div>
          <div className="mt-1 flex gap-3 text-xs text-muted">
            {depth === 0 && <button type="button" onClick={() => setReplyTo(c.id)} className="inline-flex items-center gap-1 hover:text-ink"><Reply size={12} aria-hidden />Reply</button>}
            {c.mine && <button type="button" onClick={() => remove(c.id)} className="inline-flex items-center gap-1 hover:text-danger"><Trash2 size={12} aria-hidden />Delete</button>}
          </div>
        </div>
      </div>
      {kids(c.id).length > 0 && <ul className="mt-2 space-y-2">{kids(c.id).map((k) => render(k, 1))}</ul>}
    </li>
  );

  return (
    <section className="mt-3 border-t border-line pt-3" aria-label={t("post.comments")}>
      <form onSubmit={submit} className="flex items-start gap-2">
        <label className="sr-only" htmlFor={`c-${postId}`}>{t("post.writeComment")}</label>
        <textarea id={`c-${postId}`} className="input min-h-[40px] flex-1" rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder={replyTo ? "Write a reply…" : t("post.writeComment")} maxLength={1000} />
        <button type="submit" className="btn-primary" disabled={busy || !text.trim()}>{t("composer.post")}</button>
      </form>
      {replyTo && <p className="mt-1 text-xs text-muted">Replying to a comment. <button type="button" className="link" onClick={() => setReplyTo(null)}>Cancel</button></p>}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error} <button type="button" className="link" onClick={load}>{t("common.retry")}</button></p>}
      {items === null && !error && <div className="mt-3 space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-2/3" /></div>}
      {items && <ul className="mt-3 space-y-3">{roots.map((c) => render(c))}</ul>}
      {items && items.length === 0 && <p className="mt-3 text-sm text-muted">Be the first to comment.</p>}
    </section>
  );
}
