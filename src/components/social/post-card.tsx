"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Share2, Link2, Trash2, Pencil, Lock, Users, Globe2, FileText, ExternalLink } from "lucide-react";
import type { PostView } from "@/server/services/posts";
import { Avatar, VerifiedBadge, Badge } from "@/components/ui/kit";
import { RichText } from "./rich-text";
import { SaveButton } from "./save-button";
import { ReportButton } from "./report-button";
import { Comments } from "./comments";
import { callApi } from "@/lib/client-api";
import { openLightbox } from "@/components/ui/lightbox";
import { timeAgo } from "@/lib/format";
import { useLocale, useT } from "@/i18n/client";
import { cn } from "@/lib/cn";

function Gallery({ imgs }: { imgs: PostView["media"] }) {
  const [i, setI] = useState(0);
  const cur = imgs[i] ?? imgs[0]!;
  const THUMBS = 5;
  const extra = imgs.length - THUMBS;
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => openLightbox(imgs.map((m) => m.url), i, imgs.map((m) => m.alt ?? ""))} className="relative block w-full cursor-zoom-in overflow-hidden rounded-2xl bg-line/40" aria-label={`View photo ${i + 1} larger`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cur.url} alt={cur.alt ?? ""} loading="lazy" className={cn("w-full object-cover", imgs.length === 1 ? "aspect-[16/10]" : "aspect-[4/3] sm:aspect-[16/10]")} />
        {imgs.length > 1 && <span className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">{i + 1}/{imgs.length}</span>}
      </button>
      {imgs.length > 1 && (
        <ul className="grid grid-cols-5 gap-2" aria-label="Photos in this post">
          {imgs.slice(0, THUMBS).map((m, idx) => (
            <li key={m.id}>
              <button type="button" onClick={() => setI(idx)} aria-label={`Show photo ${idx + 1}`} aria-current={idx === i ? "true" : undefined}
                className={cn("relative block aspect-[4/3] w-full overflow-hidden rounded-xl ring-offset-2 ring-offset-surface transition", idx === i ? "ring-2 ring-primary" : "opacity-90 hover:opacity-100")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.thumbUrl ?? m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                {idx === THUMBS - 1 && extra > 0 && <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-bold text-white">+{extra}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Media({ media }: { media: PostView["media"] }) {
  const imgs = media.filter((m) => m.kind === "image");
  const vids = media.filter((m) => m.kind === "video");
  const docs = media.filter((m) => m.kind === "document");
  return (
    <div className="mt-3 space-y-2">
      {imgs.length > 0 && <Gallery imgs={imgs} />}
      {vids.map((m) => (
        <video key={m.id} src={m.url} controls preload="metadata" className="max-h-[520px] w-full rounded-2xl bg-black" aria-label={m.alt ?? "Video"} />
      ))}
      {docs.map((m) => (
        <a key={m.id} href={m.url} className="card flex items-center gap-3 p-3 hover:bg-primary-tint"><FileText size={20} className="text-primary" aria-hidden /><span className="text-sm">PDF document</span><ExternalLink size={14} className="ml-auto text-muted" aria-hidden /></a>
      ))}
    </div>
  );
}
function Poll({ post }: { post: PostView }) {
  const [poll, setPoll] = useState(post.poll!);
  const [busy, setBusy] = useState(false);
  async function vote(i: number) {
    if (poll.myVote !== null || busy) return;
    setBusy(true);
    const r = await callApi(`/api/posts/${post.id}/vote`, "POST", { option: i });
    setBusy(false);
    if (r.ok) setPoll((p) => ({ myVote: i, total: p.total + 1, options: p.options.map((o, j) => (j === i ? { ...o, votes: o.votes + 1 } : o)) }));
  }
  return (
    <div className="mt-3 space-y-2" role="group" aria-label="Poll">
      {poll.options.map((o, i) => {
        const pct = poll.total ? Math.round((o.votes / poll.total) * 100) : 0;
        return poll.myVote === null ? (
          <button key={i} type="button" onClick={() => vote(i)} className="btn-secondary w-full justify-start">{o.label}</button>
        ) : (
          <div key={i} className="relative overflow-hidden rounded-lg border border-line px-3 py-2 text-sm">
            <div className={cn("absolute inset-y-0 left-0", poll.myVote === i ? "bg-primary/25" : "bg-line/60")} style={{ width: `${pct}%` }} />
            <div className="relative flex justify-between"><span>{o.label}</span><span className="text-muted">{pct}%</span></div>
          </div>
        );
      })}
      <p className="text-xs text-muted">{poll.total} vote{poll.total === 1 ? "" : "s"}</p>
    </div>
  );
}

export function PostCard({ post: initial, onDeleted, full }: { post: PostView; onDeleted?: (id: string) => void; full?: boolean }) {
  const [post, setPost] = useState(initial);
  const [showComments, setShowComments] = useState(!!full);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareText, setShareText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [pending, start] = useTransition();
  const router = useRouter();
  const locale = useLocale();
  const t = useT();

  const vis = post.visibility === "public" ? <Globe2 size={14} aria-label="Public" /> : post.visibility === "connections" ? <Users size={14} aria-label="Connections" /> : <Lock size={14} aria-label="Only me" />;

  function like() {
    start(async () => {
      setPost((p) => ({ ...p, liked: !p.liked, likeCount: p.likeCount + (p.liked ? -1 : 1) }));
      const r = await callApi<{ liked: boolean; likeCount: number }>(`/api/posts/${post.id}/like`);
      if (r.ok) setPost((p) => ({ ...p, liked: r.liked, likeCount: r.likeCount }));
      else { setPost((p) => ({ ...p, liked: !p.liked, likeCount: p.likeCount + (p.liked ? -1 : 1) })); setMsg(r.error); }
    });
  }
  async function share() {
    const r = await callApi<{ message?: string }>(`/api/posts/${post.id}/share`, "POST", { comment: shareText });
    setMsg(r.ok ? (r.message ?? "Shared.") : r.error);
    if (r.ok) { setPost((p) => ({ ...p, shareCount: p.shareCount + 1 })); setShareOpen(false); setShareText(""); }
  }
  async function copyLink() {
    const url = `${location.origin}/posts/${post.id}`;
    try { await navigator.clipboard.writeText(url); setMsg("Link copied."); return; } catch { /* fall back below (insecure origins, older browsers) */ }
    try {
      const ta = document.createElement("textarea"); ta.value = url; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
      const okc = document.execCommand("copy"); ta.remove();
      if (okc) { setMsg("Link copied."); return; }
    } catch { /* ignore */ }
    if (navigator.share) { try { await navigator.share({ url }); return; } catch { /* cancelled */ } }
    setMsg(`Copy this link: ${url}`);
  }
  async function remove() {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    const r = await callApi(`/api/posts/${post.id}`, "DELETE");
    if (r.ok) { onDeleted?.(post.id); if (full) router.push("/home"); } else setMsg(r.error);
  }
  async function saveEdit() {
    const r = await callApi(`/api/posts/${post.id}`, "PATCH", { body: draft });
    if (r.ok) { setPost((p) => ({ ...p, body: draft.trim(), editedAt: new Date().toISOString() })); setEditing(false); } else setMsg(r.error);
  }

  return (
    <article className="card p-4 sm:p-5" aria-label={`Post by ${post.author.displayName}`}>
      <header className="flex items-start gap-3.5">
        <Link href={`/profile/${post.author.username}`}><Avatar name={post.author.displayName} src={post.author.avatarUrl} size={56} /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5">
            <Link href={`/profile/${post.author.username}`} className="text-[17px] font-bold hover:underline">{post.author.displayName}</Link>
            {post.author.verified && <VerifiedBadge label={t("common.verified")} />}
            {post.sponsored && <Badge tone="muted">{t("common.sponsored")}</Badge>}
          </div>
          {post.author.headline && <p className="truncate text-sm text-muted">{post.author.headline}</p>}
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Link href={`/posts/${post.id}`} className="hover:underline"><time dateTime={post.createdAt}>{timeAgo(post.createdAt, locale)}</time></Link>
            {post.editedAt && <span>· {t("post.edited")}</span>}<span aria-hidden>·</span>{vis}<span>{post.visibility === "public" ? "Public" : post.visibility === "connections" ? "Connections" : "Only me"}</span>
            {post.context && <><span aria-hidden>·</span><Link href={post.context.href} className="link">{post.context.name}</Link></>}
          </p>
        </div>
        {post.status === "draft" && <Badge tone="warn">Draft</Badge>}
      </header>
      {editing ? (
        <div className="mt-3 space-y-2">
          <label className="sr-only" htmlFor={`edit-${post.id}`}>Edit post</label>
          <textarea id={`edit-${post.id}`} className="input" rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex gap-2"><button className="btn-primary" onClick={saveEdit}>{t("common.save")}</button><button className="btn-secondary" onClick={() => { setEditing(false); setDraft(post.body); }}>{t("common.cancel")}</button></div>
        </div>
      ) : (
        post.body && <div className="mt-4 text-[17px] leading-relaxed"><RichText text={post.body} /></div>
      )}

      {post.media.length > 0 && <Media media={post.media} />}
      {post.poll && <Poll post={post} />}
      {post.link && (
        <a href={post.link.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="card mt-3 flex overflow-hidden hover:bg-primary-tint">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {post.link.image && <img src={post.link.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-24 w-24 shrink-0 object-cover" />}
          <div className="min-w-0 p-3"><p className="truncate font-medium">{post.link.title || post.link.url}</p>{post.link.description && <p className="line-clamp-2 text-sm text-muted">{post.link.description}</p>}<p className="truncate text-xs text-muted">{new URL(post.link.url).hostname}</p></div>
        </a>
      )}
      {post.ref && (
        <Link href={post.ref.href} className="card mt-3 flex items-center gap-3 overflow-hidden p-0 hover:bg-primary-tint">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {post.ref.image ? <img src={post.ref.image} alt="" loading="lazy" className="h-20 w-20 object-cover" /> : <div className="h-20 w-20 bg-primary-tint" aria-hidden />}
          <div className="min-w-0 py-2 pr-3"><Badge>{post.ref.type}</Badge><p className="truncate font-medium">{post.ref.title}</p>{post.ref.price && <p className="text-sm text-muted">{post.ref.price}</p>}</div>
        </Link>
      )}
      {post.shared && (
        <div className="card mt-3 p-3">
          <div className="flex items-center gap-2"><Avatar name={post.shared.author.displayName} src={post.shared.author.avatarUrl} size={28} /><Link href={`/profile/${post.shared.author.username}`} className="text-sm font-medium hover:underline">{post.shared.author.displayName}</Link><Link href={`/posts/${post.shared.id}`} className="text-xs text-muted hover:underline">{timeAgo(post.shared.createdAt, locale)}</Link></div>
          {post.shared.body && <div className="mt-2 text-sm"><RichText text={post.shared.body} /></div>}
          {post.shared.media.length > 0 && <Media media={post.shared.media} />}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1">
        <button type="button" onClick={like} disabled={pending} aria-pressed={post.liked} aria-label={t("post.like")} className={cn("group flex min-h-[40px] items-center gap-2 text-[15px] font-medium", post.liked ? "text-rose-500" : "text-muted hover:text-rose-500")}><Heart size={26} className={post.liked ? "fill-rose-500 text-rose-500" : ""} aria-hidden /><span className="tabular-nums">{post.likeCount}</span></button>
        {post.commentsEnabled && <button type="button" onClick={() => setShowComments((s) => !s)} aria-expanded={showComments} aria-label={t("post.comment")} className="flex min-h-[40px] items-center gap-2 text-[15px] font-medium text-muted hover:text-primary"><MessageCircle size={24} aria-hidden /><span className="tabular-nums">{post.commentCount}</span></button>}
        {post.visibility === "public" && post.status === "published" && <button type="button" onClick={() => setShareOpen((s) => !s)} aria-expanded={shareOpen} aria-label={t("post.share")} className="flex min-h-[40px] items-center gap-2 text-[15px] font-medium text-muted hover:text-primary"><Share2 size={22} aria-hidden /><span className="tabular-nums">{post.shareCount}</span></button>}
        <button type="button" onClick={copyLink} className="flex min-h-[40px] items-center text-muted hover:text-primary" aria-label={t("post.copyLink")}><Link2 size={20} aria-hidden /></button>
        <div className="ml-auto flex items-center gap-1">
          {post.mine ? (
            <>
              {post.type === "text" && <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(true)} aria-label={t("common.edit")}><Pencil size={16} aria-hidden /></button>}
              <button type="button" className="btn-ghost btn-sm" onClick={remove} aria-label={t("post.delete")}><Trash2 size={16} aria-hidden /></button>
            </>
          ) : (
            <ReportButton entityType="post" entityId={post.id} label="" className="btn-ghost btn-sm" />
          )}
          <SaveButton entityType="post" entityId={post.id} initial={post.saved} compact className="!px-2" />
        </div>
      </div>      {shareOpen && (
        <div className="mt-2 space-y-2 rounded-lg bg-bg p-3">
          <label className="label" htmlFor={`share-${post.id}`}>Add a comment (optional)</label>
          <textarea id={`share-${post.id}`} className="input" rows={2} maxLength={1000} value={shareText} onChange={(e) => setShareText(e.target.value)} />
          <button type="button" className="btn-primary" onClick={share}>Share to my profile</button>
        </div>
      )}
      {msg && <p role="status" className="mt-2 text-xs text-muted">{msg}</p>}
      {showComments && post.commentsEnabled && <Comments postId={post.id} onCount={(d) => setPost((p) => ({ ...p, commentCount: Math.max(0, p.commentCount + d) }))} />}
    </article>
  );
}
