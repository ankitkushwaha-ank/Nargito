"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Loader2, Paperclip, Send } from "lucide-react";
import type { MessageView } from "@/server/services/messaging";
import { callApi, uploadFiles } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/i18n/client";
import { formatDate } from "@/lib/format";

export function ChatPane({ conversationId, initial, initialHasMore, pollMs, maxLen, allowAttachments, disabled, disabledReason }: {
  conversationId: string; initial: MessageView[]; initialHasMore: boolean; pollMs: number; maxLen: number; allowAttachments: boolean; disabled?: boolean; disabledReason?: string;
}) {
  const [msgs, setMsgs] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const bottom = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const locale = useLocale();
  const t = useT();

  const mergeNew = useCallback((incoming: MessageView[]) => {
    setMsgs((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !ids.has(m.id));
      // refresh read receipts on existing messages
      const updated = prev.map((m) => incoming.find((n) => n.id === m.id) ?? m);
      return fresh.length || updated.some((u, i) => u.read !== prev[i]!.read) ? [...updated, ...fresh] : prev;
    });
  }, []);

  // Polling transport with reconnect: pauses when the tab is hidden, resumes and refreshes on focus / reconnect.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") {
        const last = msgs.length ? msgs[msgs.length - 1]!.createdAt : null;
        const r = await callApi<{ items: MessageView[] }>(`/api/conversations/${conversationId}/messages?after=${encodeURIComponent(last ?? new Date(0).toISOString())}`, "GET");
        if (!stopped) { setOnline(r.ok); if (r.ok) mergeNew(r.items); }
      }
      timer = setTimeout(tick, pollMs);
    };
    timer = setTimeout(tick, pollMs);
    const onVis = () => { if (document.visibilityState === "visible") { clearTimeout(timer); void tick(); } };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("online", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, pollMs, msgs.length]);

  useEffect(() => { if (stick.current) bottom.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  async function loadOlder() {
    const oldest = msgs[0]?.createdAt;
    if (!oldest) return;
    const r = await callApi<{ items: MessageView[]; hasMore: boolean }>(`/api/conversations/${conversationId}/messages?before=${encodeURIComponent(oldest)}`, "GET");
    if (r.ok) { stick.current = false; setMsgs((p) => [...r.items, ...p]); setHasMore(r.hasMore); }
  }

  async function send(e?: React.FormEvent, attachmentId?: string) {
    e?.preventDefault();
    if ((!text.trim() && !attachmentId) || busy) return;
    setBusy(true); setError(null);
    const r = await callApi(`/api/conversations/${conversationId}/messages`, "POST", { body: text, attachmentId });
    if (r.ok) {
      setText(""); stick.current = true;
      const last = msgs.length ? msgs[msgs.length - 1]!.createdAt : new Date(0).toISOString();
      const n = await callApi<{ items: MessageView[] }>(`/api/conversations/${conversationId}/messages?after=${encodeURIComponent(last)}`, "GET");
      if (n.ok) mergeNew(n.items);
    } else setError(r.error);
    setBusy(false);
  }
  async function attach(files: FileList | null) {
    if (!files?.[0]) return;
    setBusy(true); setError(null);
    const up = await uploadFiles([files[0]], "message");
    setBusy(false);
    if (up.ok && up.files?.[0]) await send(undefined, up.files[0].id); else setError(up.error ?? "Upload failed.");
  }

  let lastDay = "";
  return (
    <div className="flex h-[calc(100%-0px)] min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4" onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} role="log" aria-live="polite" aria-label="Messages">
        {hasMore && <div className="text-center"><button type="button" className="link text-sm" onClick={loadOlder}>Load earlier messages</button></div>}
        {msgs.length === 0 && <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello.</p>}
        {msgs.map((m) => {
          const day = m.createdAt.slice(0, 10);
          const sep = day !== lastDay ? ((lastDay = day), <p key={`d-${m.id}`} className="py-2 text-center text-xs text-muted">{formatDate(m.createdAt, locale, { dateStyle: "medium" })}</p>) : null;
          return (
            <div key={m.id}>
              {sep}
              <div className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[78%] rounded-2xl px-3 py-2 text-sm", m.mine ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm bg-bg")}>
                  {m.attachment && (m.attachment.kind === "image" ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.attachment.url} data-zoom={m.attachment.url} alt="Shared image" className="mb-1 max-h-60 cursor-zoom-in rounded-lg" loading="lazy" /> : <a href={m.attachment.url} className="mb-1 block underline">Download attachment</a>)}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[11px]", m.mine ? "text-white/80" : "text-muted")}>
                    {new Date(m.createdAt).toLocaleTimeString(locale === "hi" ? "hi-IN" : "en-IN", { hour: "2-digit", minute: "2-digit" })}
                    {m.mine && (m.read ? <CheckCheck size={12} aria-label="Read" /> : <Check size={12} aria-label="Sent" />)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {!online && <p role="status" className="bg-warn/10 px-4 py-1 text-center text-xs text-warn">Reconnecting…</p>}
      {disabled ? (
        <p className="border-t border-line p-4 text-center text-sm text-muted">{disabledReason}</p>
      ) : (
        <form onSubmit={send} className="border-t border-line p-3">
          {error && <p role="alert" className="mb-2 text-sm text-danger">{error}</p>}
          <div className="flex items-end gap-2">
            {allowAttachments && (<><input id="chat-file" type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => attach(e.target.files)} /><label htmlFor="chat-file" className="btn-ghost cursor-pointer !px-2" aria-label="Attach a file"><Paperclip size={18} /></label></>)}
            <label htmlFor="chat-input" className="sr-only">{t("msg.placeholder")}</label>
            <textarea id="chat-input" className="input max-h-32 min-h-[40px] flex-1" rows={1} value={text} maxLength={maxLen} placeholder={t("msg.placeholder")} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
            <button type="submit" className="btn-primary" disabled={busy || !text.trim()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} aria-hidden />}<span className="sr-only sm:not-sr-only">{t("msg.send")}</span></button>
          </div>
        </form>
      )}
    </div>
  );
}
