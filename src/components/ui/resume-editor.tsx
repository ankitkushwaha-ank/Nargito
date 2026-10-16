"use client";
import { useState } from "react";
import { Briefcase, GraduationCap, Award, Plus, Trash2, UploadCloud, FileText, Loader2 } from "lucide-react";
import { uploadFiles } from "@/lib/client-api";

export type ResumeItem = { kind: "experience" | "education" | "certification" | "file"; title: string; org: string; from: string; to: string; description: string };
const KINDS = [
  { v: "experience" as const, label: "Experience", icon: Briefcase },
  { v: "education" as const, label: "Education", icon: GraduationCap },
  { v: "certification" as const, label: "Certification", icon: Award },
];

/** Adds, edits and removes resume entries. Serialised into a hidden `resumeJson` field for the profile form. */
export function ResumeEditor({ initial }: { initial: ResumeItem[] }) {
  const [items, setItems] = useState<ResumeItem[]>(initial);
  const set = (i: number, patch: Partial<ResumeItem>) => setItems((x) => x.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileItem = items.find((x) => x.kind === "file");
  async function attach(files: FileList | File[] | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") { setErr("Please attach a PDF file."); return; }
    setBusy(true); setErr(null);
    const r = await uploadFiles([f], "resume");
    setBusy(false);
    if (r.ok && r.files?.[0]) setItems((x) => [...x.filter((i) => i.kind !== "file"), { kind: "file", title: f.name.slice(0, 120), org: r.files![0]!.url, from: "", to: "", description: "" }]);
    else setErr(r.error ?? "Upload failed.");
  }
  const add = (kind: Exclude<ResumeItem["kind"], "file">) => setItems((x) => (x.length >= 20 ? x : [...x, { kind, title: "", org: "", from: "", to: "", description: "" }]));
  return (
    <div className="space-y-3">
      <input type="hidden" name="resumeJson" value={JSON.stringify(items.filter((i) => i.title.trim()))} />
      {items.filter((x) => x.kind !== "file").length === 0 && <p className="rounded-xl bg-bg p-4 text-sm text-muted">Add your work, education or certificates. They appear on your profile under the Resume tab.</p>}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void attach(e.dataTransfer.files); }}
        className={`rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${drag ? "border-primary bg-primary-tint" : "border-line bg-bg"}`}>
        {fileItem ? (
          <div className="flex items-center justify-between gap-3 text-left">
            <span className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary"><FileText size={20} aria-hidden /></span><span className="min-w-0"><span className="block truncate font-bold">{fileItem.title}</span><a href={fileItem.org} target="_blank" rel="noopener noreferrer" className="link text-xs">Preview</a></span></span>
            <button type="button" onClick={() => setItems((x) => x.filter((i) => i.kind !== "file"))} className="btn-ghost btn-sm text-rose-600"><Trash2 size={15} aria-hidden />Remove</button>
          </div>
        ) : (
          <>
            {busy ? <Loader2 className="mx-auto animate-spin text-primary" aria-hidden /> : <UploadCloud className="mx-auto text-primary" size={30} aria-hidden />}
            <p className="mt-2 text-sm font-semibold">Drag and drop your resume here</p>
            <p className="text-xs text-muted">PDF only. Or</p>
            <label className="btn-secondary btn-sm mt-2 cursor-pointer">Choose file<input type="file" accept="application/pdf" className="sr-only" onChange={(e) => { void attach(e.target.files); e.target.value = ""; }} /></label>
          </>
        )}
        {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
      </div>
      <ul className="space-y-3">
        {items.map((it, i) => {
          if (it.kind === "file") return null;
          const K = KINDS.find((k) => k.v === it.kind)!;
          return (
            <li key={i} className="rounded-2xl border border-line p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-primary"><K.icon size={16} aria-hidden />{K.label}</span>
                <button type="button" onClick={() => setItems((x) => x.filter((_, j) => j !== i))} className="btn-ghost btn-sm text-rose-600" aria-label={`Remove ${K.label} entry ${i + 1}`}><Trash2 size={15} aria-hidden />Remove</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor={`r-t-${i}`}>{it.kind === "education" ? "Course / degree" : it.kind === "certification" ? "Certificate" : "Role"}</label><input id={`r-t-${i}`} className="input" maxLength={120} value={it.title} onChange={(e) => set(i, { title: e.target.value })} /></div>
                <div><label className="label" htmlFor={`r-o-${i}`}>{it.kind === "education" ? "School / college" : it.kind === "certification" ? "Issued by" : "Company"}</label><input id={`r-o-${i}`} className="input" maxLength={120} value={it.org} onChange={(e) => set(i, { org: e.target.value })} /></div>
                <div><label className="label" htmlFor={`r-f-${i}`}>From</label><input id={`r-f-${i}`} type="month" className="input" value={it.from} onChange={(e) => set(i, { from: e.target.value })} /></div>
                <div><label className="label" htmlFor={`r-e-${i}`}>To <span className="font-normal text-muted">(leave empty if current)</span></label><input id={`r-e-${i}`} type="month" className="input" value={it.to} onChange={(e) => set(i, { to: e.target.value })} /></div>
              </div>
              <div className="mt-3"><label className="label" htmlFor={`r-d-${i}`}>Details <span className="font-normal text-muted">(optional)</span></label><textarea id={`r-d-${i}`} className="input" rows={2} maxLength={600} value={it.description} onChange={(e) => set(i, { description: e.target.value })} /></div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => <button key={k.v} type="button" onClick={() => add(k.v)} className="btn-secondary btn-sm"><Plus size={14} aria-hidden /><k.icon size={14} aria-hidden />Add {k.label.toLowerCase()}</button>)}
      </div>
    </div>
  );
}
