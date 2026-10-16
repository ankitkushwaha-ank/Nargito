"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";

/** Native share sheet when available, otherwise copies the canonical link. */
export function ShareButton({ path, title }: { path: string; title: string }) {
  const [msg, setMsg] = useState("");
  async function share() {
    const url = `${location.origin}${path}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); setMsg("Link copied"); setTimeout(() => setMsg(""), 2000); }
    } catch { /* user cancelled */ }
  }
  return (<><button type="button" className="btn-ghost" onClick={share}><Share2 size={16} aria-hidden />Share</button><span role="status" className="text-xs text-muted">{msg}</span></>);
}
