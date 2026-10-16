"use client";
import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadFiles } from "@/lib/client-api";

/** Multi-image uploader. Emits one hidden `name` input per uploaded image URL. */
export function ImagesField({ name = "images", label = "Photos", initial = [], max = 8 }: { name?: string; label?: string; initial?: string[]; max?: number }) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setErr(null);
    const r = await uploadFiles(Array.from(files).slice(0, max - urls.length), "listing");
    setBusy(false);
    if (r.ok && r.files) setUrls((u) => [...u, ...r.files!.filter((f) => f.kind === "image").map((f) => f.url)].slice(0, max)); else setErr(r.error ?? "Upload failed.");
  }
  return (
    <div>
      <span className="label">{label} <span className="font-normal text-muted">(up to {max})</span></span>
      <ul className="flex flex-wrap gap-2">
        {urls.map((u) => (
          <li key={u} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="h-20 w-20 rounded-lg border border-line object-cover" />
            <button type="button" aria-label="Remove photo" onClick={() => setUrls((x) => x.filter((y) => y !== u))} className="absolute -right-1.5 -top-1.5 rounded-full bg-black/70 p-1 text-white"><X size={12} /></button>
            <input type="hidden" name={name} value={u} />
          </li>
        ))}
        {urls.length < max && (
          <li>
            <input id={`imgs-${name}`} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => pick(e.target.files)} />
            <label htmlFor={`imgs-${name}`} className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-xs text-muted hover:bg-primary-tint">{busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} aria-hidden />}Add</label>
          </li>
        )}
      </ul>
      {err && <p role="alert" className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  );
}
