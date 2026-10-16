"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Plane, ShoppingBag, Wrench, Store, X, BarChart3, Link as LinkIcon, FileText, Loader2, MoreHorizontal } from "lucide-react";
import { Avatar } from "@/components/ui/kit";
import { callApi, uploadFiles } from "@/lib/client-api";
import { useT } from "@/i18n/client";

type Att = { id: string; url: string; thumbUrl: string | null; kind: string; alt: string };
type Limits = { maxLength: number; maxMedia: number; allowPolls: boolean; allowVideo: boolean; allowDocs: boolean; defaultVisibility: string };

export function Composer({ user, limits, enabled = { trips: true, products: true, services: true, companies: true }, groupId, companyId, shopId, onPosted }: {
  user: { displayName: string; avatarUrl: string | null }; limits: Limits; enabled?: { trips: boolean; products: boolean; services: boolean; companies: boolean };
  groupId?: string; companyId?: string; shopId?: string; onPosted?: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState(limits.defaultVisibility);
  const [atts, setAtts] = useState<Att[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [link, setLink] = useState("");
  const [poll, setPoll] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setError(null);
    const r = await uploadFiles(Array.from(files));
    setUploading(false);
    if (r.ok && r.files) setAtts((a) => [...a, ...r.files!.map((f) => ({ ...f, alt: "" }))].slice(0, limits.maxMedia));
    else setError(r.error ?? "Upload failed.");
    if (file.current) file.current.value = "";
  }

  async function submit(status: "published" | "draft") {
    setBusy(true); setError(null); setOk(null);
    const payload: Record<string, unknown> = { body, visibility, status, mediaIds: atts.map((a) => a.id), alt: atts.find((a) => a.alt)?.alt || undefined, groupId, companyId, shopId };
    if (showLink && link.trim()) payload.linkUrl = link.trim();
    if (poll) payload.pollOptions = poll.map((p) => p.trim()).filter(Boolean);
    const r = await callApi<{ message?: string }>("/api/posts", "POST", payload);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setOk(r.message ?? "Posted."); setBody(""); setAtts([]); setLink(""); setShowLink(false); setPoll(null); setOpen(false);
    onPosted?.();
    router.refresh();
  }

  const accept = ["image/jpeg", "image/png", "image/webp", "image/gif", ...(limits.allowVideo ? ["video/mp4", "video/webm"] : []), ...(limits.allowDocs ? ["application/pdf"] : [])].join(",");

  return (
    <section className="card p-4 sm:p-5" aria-label="Create a post">
      <div className="flex items-center gap-3">
        <Avatar name={user.displayName} src={user.avatarUrl} size={48} />
        {open ? (
          <div className="flex-1">
            <label htmlFor="composer-body" className="sr-only">{t("composer.placeholder")}</label>
            <textarea id="composer-body" autoFocus className="input min-h-[96px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("composer.placeholder")} maxLength={limits.maxLength} />
            <p className="mt-1 text-right text-xs text-muted">{body.length}/{limits.maxLength}</p>
          </div>
        ) : (
          <button type="button" aria-label={t("composer.start")} onClick={() => setOpen(true)} className="flex min-h-[48px] flex-1 items-center justify-between rounded-full border border-line bg-surface px-5 text-left text-[15px] text-muted transition-colors hover:border-primary/40 hover:bg-primary-tint/50"><span>What&apos;s on your mind?</span><ImagePlus size={22} className="text-muted" aria-hidden /></button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          {atts.length > 0 && (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {atts.map((a) => (
                <li key={a.id} className="relative rounded-lg border border-line p-1">
                  {a.kind === "image" ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={a.thumbUrl ?? a.url} alt="" className="h-24 w-full rounded object-cover" /> : <div className="flex h-24 items-center justify-center text-sm text-muted">{a.kind === "video" ? "Video" : <><FileText size={16} className="mr-1" />PDF</>}</div>}
                  {a.kind === "image" && <input aria-label={t("composer.alt")} placeholder={t("composer.alt")} className="input mt-1 !py-1 text-xs" value={a.alt} maxLength={300} onChange={(e) => setAtts((x) => x.map((y) => (y.id === a.id ? { ...y, alt: e.target.value } : y)))} />}
                  <button type="button" aria-label="Remove attachment" onClick={() => setAtts((x) => x.filter((y) => y.id !== a.id))} className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"><X size={12} /></button>
                </li>
              ))}
            </ul>
          )}
          {showLink && <div><label className="label" htmlFor="composer-link">Link</label><input id="composer-link" type="url" className="input" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} /></div>}
          {poll && (
            <fieldset className="space-y-2"><legend className="label">Poll options</legend>
              {poll.map((p, i) => <input key={i} className="input" aria-label={`Option ${i + 1}`} placeholder={`Option ${i + 1}`} value={p} maxLength={80} onChange={(e) => setPoll((x) => x!.map((y, j) => (j === i ? e.target.value : y)))} />)}
              {poll.length < 6 && <button type="button" className="link text-sm" onClick={() => setPoll((x) => [...x!, ""])}>Add option</button>}
            </fieldset>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input ref={file} type="file" multiple accept={accept} className="sr-only" id="composer-file" onChange={(e) => onFiles(e.target.files)} />
            <label htmlFor="composer-file" className="btn-ghost cursor-pointer">{uploading ? <Loader2 className="animate-spin" size={18} /> : <ImagePlus size={18} aria-hidden />}{t("composer.photo")}</label>
            <button type="button" className="btn-ghost" onClick={() => setShowLink((s) => !s)}><LinkIcon size={18} aria-hidden />Link</button>
            {limits.allowPolls && <button type="button" className="btn-ghost" onClick={() => setPoll((p) => (p ? null : ["", ""]))}><BarChart3 size={18} aria-hidden />Poll</button>}
            <div className="ml-auto flex items-center gap-2">
              <label className="sr-only" htmlFor="composer-aud">{t("composer.audience")}</label>
              <select id="composer-aud" className="input !w-auto !py-1.5" value={visibility} onChange={(e) => setVisibility(e.target.value)} disabled={!!groupId}>
                <option value="public">{t("composer.public")}</option><option value="connections">{t("composer.connections")}</option><option value="private">{t("composer.private")}</option>
              </select>
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => submit("draft")}>{t("composer.draft")}</button>
            <button type="button" className="btn-primary" disabled={busy || uploading} onClick={() => submit("published")}>{busy && <Loader2 size={16} className="animate-spin" />}{t("composer.post")}</button>
          </div>
        </div>
      )}
      {ok && !open && <p role="status" className="mt-2 text-sm text-success">{ok}</p>}

      {!open && !groupId && (
        <div className="mt-3 grid grid-cols-4 gap-x-1 gap-y-2">
          <button type="button" className="quick" onClick={() => { setOpen(true); setTimeout(() => file.current?.click(), 50); }}><span className="quick-ic bg-rose-50 text-rose-500 dark:bg-rose-500/15"><ImagePlus size={20} aria-hidden /></span>Post</button>
          {enabled.trips && <Link href="/my/trips/new" className="quick"><span className="quick-ic bg-blue-50 text-primary dark:bg-primary/15"><Plane size={20} aria-hidden /></span>{t("composer.trip")}</Link>}
          {enabled.products && <Link href="/my/listings/product/new" className="quick"><span className="quick-ic bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15"><ShoppingBag size={20} aria-hidden /></span>{t("composer.product")}</Link>}
          <button type="button" className="quick" aria-expanded={more} onClick={() => setMore((m) => !m)}><span className="quick-ic bg-slate-100 text-slate-500 dark:bg-slate-500/15"><MoreHorizontal size={20} aria-hidden /></span>More</button>
          {more && enabled.services && <Link href="/my/listings/service/new" className="quick"><span className="quick-ic bg-orange-50 text-orange-500 dark:bg-orange-500/15"><Wrench size={20} aria-hidden /></span>{t("composer.service")}</Link>}
          {more && enabled.companies && <Link href="/my/businesses" className="quick"><span className="quick-ic bg-violet-50 text-violet-600 dark:bg-violet-500/15"><Store size={20} aria-hidden /></span>{t("composer.business")}</Link>}
          {more && <button type="button" className="quick" onClick={() => { setOpen(true); setPoll(["", ""]); }}><span className="quick-ic bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15"><BarChart3 size={20} aria-hidden /></span>Poll</button>}
        </div>
      )}    </section>
  );
}
