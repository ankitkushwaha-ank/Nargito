"use client";
import { useState } from "react";
import { Loader2, FileUp } from "lucide-react";
import { uploadFiles } from "@/lib/client-api";

/** Uploads verification evidence as PRIVATE media (visible only to the owner and authorised reviewers). */
export function EvidenceUploader() {
  const [ids, setIds] = useState<{ id: string; kind: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setErr(null);
    const r = await uploadFiles(Array.from(files).slice(0, 4), "evidence");
    setBusy(false);
    if (r.ok && r.files) setIds((x) => [...x, ...r.files!.map((f) => ({ id: f.id, kind: f.kind }))].slice(0, 4)); else setErr(r.error ?? "Upload failed.");
  }
  return (
    <div>
      <span className="label">Evidence (images or PDF, up to 4)</span>
      <input id="evidence" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => pick(e.target.files)} />
      <label htmlFor="evidence" className="btn-secondary cursor-pointer">{busy ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} aria-hidden />}Upload files</label>
      <span className="ml-3 text-sm text-muted" role="status">{ids.length} file{ids.length === 1 ? "" : "s"} attached</span>
      {ids.map((i) => <input key={i.id} type="hidden" name="evidence" value={i.id} />)}
      {err && <p role="alert" className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  );
}
