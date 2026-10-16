"use client";
import { useState } from "react";
import { Briefcase, GraduationCap, Award, Plus, Trash2 } from "lucide-react";

export type ResumeItem = { kind: "experience" | "education" | "certification"; title: string; org: string; from: string; to: string; description: string };
const KINDS = [
  { v: "experience" as const, label: "Experience", icon: Briefcase },
  { v: "education" as const, label: "Education", icon: GraduationCap },
  { v: "certification" as const, label: "Certification", icon: Award },
];

/** Adds, edits and removes resume entries. Serialised into a hidden `resumeJson` field for the profile form. */
export function ResumeEditor({ initial }: { initial: ResumeItem[] }) {
  const [items, setItems] = useState<ResumeItem[]>(initial);
  const set = (i: number, patch: Partial<ResumeItem>) => setItems((x) => x.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const add = (kind: ResumeItem["kind"]) => setItems((x) => (x.length >= 20 ? x : [...x, { kind, title: "", org: "", from: "", to: "", description: "" }]));
  return (
    <div className="space-y-3">
      <input type="hidden" name="resumeJson" value={JSON.stringify(items.filter((i) => i.title.trim()))} />
      {items.length === 0 && <p className="rounded-xl bg-bg p-4 text-sm text-muted">Add your work, education or certificates. They appear on your profile under the Resume tab.</p>}
      <ul className="space-y-3">
        {items.map((it, i) => {
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
