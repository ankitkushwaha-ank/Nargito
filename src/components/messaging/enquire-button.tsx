"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { callApi } from "@/lib/client-api";

/** Opens a small form to send a contextual enquiry about a listing, then jumps into the conversation. */
export function EnquireButton({ listingType, listingId, title, signedIn, label = "Enquire with seller" }: { listingType: string; listingId: string; title: string; signedIn: boolean; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState(`Hi, I'm interested in "${title}". Is it still available?`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await callApi<{ conversationId: string }>("/api/enquiries", "POST", { listingType, listingId, message: msg });
    setBusy(false);
    if (r.ok) router.push(`/messages/${r.conversationId}`); else setErr(r.error);
  }
  if (!signedIn) return <a className="btn-primary" href={`/login?next=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`}><MessageSquare size={16} aria-hidden />Sign in to enquire</a>;
  return (
    <div>
      {!open ? (
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}><MessageSquare size={16} aria-hidden />{label}</button>
      ) : (
        <form onSubmit={send} className="card space-y-2 p-4">
          <label className="label" htmlFor={`enq-${listingId}`}>Your message</label>
          <textarea id={`enq-${listingId}`} className="input" rows={3} maxLength={2000} value={msg} onChange={(e) => setMsg(e.target.value)} />
          <div className="flex flex-wrap gap-2 text-xs">
            {["Is this still available?", "What is the best price?", "Can you share more details?"].map((q) => <button key={q} type="button" className="rounded-full border border-line px-2 py-1 hover:bg-primary-tint" onClick={() => setMsg(`${q} (re: "${title}")`)}>{q}</button>)}
          </div>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <div className="flex gap-2"><button type="submit" className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}Send enquiry</button><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button></div>
        </form>
      )}
    </div>
  );
}
