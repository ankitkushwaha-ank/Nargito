"use client";
import { useState } from "react";
import { Loader2, ImagePlus, X } from "lucide-react";
import { uploadFiles } from "@/lib/client-api";
import { Avatar } from "./kit";

/** Uploads an image through /api/uploads and exposes the resulting URL via a hidden input named `name`. */
export function ImageField({ name, label, initial, shape = "square", purpose = "cover", displayName }: { name: string; label: string; initial?: string | null; shape?: "round" | "square" | "wide"; purpose?: string; displayName?: string }) {
  const [url, setUrl] = useState<string>(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function pick(files: FileList | null) {
    if (!files?.[0]) return;
    setBusy(true); setErr(null);
    const r = await uploadFiles([files[0]], purpose);
    setBusy(false);
    if (r.ok && r.files?.[0]) setUrl(r.files[0].url); else setErr(r.error ?? "Upload failed.");
  }
  const id = `img-${name}`;
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        {shape === "round" ? <Avatar name={displayName ?? label} src={url || null} size={72} /> : url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt="" className={shape === "wide" ? "h-20 w-40 rounded-lg object-cover" : "h-20 w-20 rounded-lg object-cover"} /> : <div className={`${shape === "wide" ? "h-20 w-40" : "h-20 w-20"} rounded-lg bg-primary-tint`} aria-hidden />}
        <div className="space-y-1">
          <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files)} />
          <label htmlFor={id} className="btn-secondary cursor-pointer">{busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} aria-hidden />}{url ? "Change" : "Upload"}</label>
          {url && <button type="button" className="btn-ghost" onClick={() => setUrl("")}><X size={16} aria-hidden />Remove</button>}
          {err && <p role="alert" className="text-xs text-danger">{err}</p>}
        </div>
      </div>
      <input type="hidden" name={name} value={url} />
    </div>
  );
}
