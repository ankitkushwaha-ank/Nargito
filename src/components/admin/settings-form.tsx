"use client";
import { useState } from "react";
import { ActionForm, SubmitButton, useFormState } from "@/components/ui/form";
import { saveGroupAction } from "@/app/admin/settings/[group]/actions";
import { cn } from "@/lib/cn";
import { ShieldAlert } from "lucide-react";

export type FieldDef = { key: string; label: string; help?: string; type: string; value: unknown; options?: string[]; min?: number; max?: number; sensitive?: boolean; readOnly?: boolean };

function FieldRow({ f, onChange }: { f: FieldDef; onChange?: (key: string, v: string) => void }) {
  const state = useFormState();
  const id = `s-${f.key}`;
  const err = state?.fieldErrors?.[f.key];
  const base = "input";
  const hint = (
    <>
      {f.help && <p className="mt-1 text-xs text-muted">{f.help}</p>}
      {f.sensitive && <p className="mt-1 flex items-center gap-1 text-xs text-warn"><ShieldAlert size={12} aria-hidden />Changing this requires re-entering your password.</p>}
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
    </>
  );
  if (f.type === "boolean") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-line p-3">
        <input id={id} type="checkbox" name={f.key} defaultChecked={Boolean(f.value)} disabled={f.readOnly} className="mt-1 h-4 w-4 accent-primary" />
        <div><label htmlFor={id} className="text-sm font-medium">{f.label}</label>{hint}</div>
      </div>
    );
  }
  return (
    <div>
      <label htmlFor={id} className="label">{f.label}</label>
      {f.type === "select" ? (
        <select id={id} name={f.key} defaultValue={String(f.value)} className={base} onChange={(e) => onChange?.(f.key, e.target.value)}>{f.options?.map((o) => <option key={o} value={o}>{o}</option>)}</select>
      ) : f.type === "text" ? (
        <textarea id={id} name={f.key} defaultValue={String(f.value ?? "")} rows={4} className={base} maxLength={5000} />
      ) : f.type === "list" ? (
        <textarea id={id} name={f.key} defaultValue={(f.value as string[]).join("\n")} rows={Math.min(8, Math.max(3, (f.value as string[]).length))} className={cn(base, "font-mono text-xs")} />
      ) : f.type === "color" ? (
        <div className="flex items-center gap-2"><input id={id} type="color" name={f.key} defaultValue={String(f.value)} className="h-10 w-14 cursor-pointer rounded border border-line bg-surface" onChange={(e) => onChange?.(f.key, e.target.value)} /><code className="text-xs text-muted">{String(f.value)}</code></div>
      ) : (
        <input id={id} name={f.key} type={f.type === "number" ? "number" : "text"} defaultValue={String(f.value ?? "")} min={f.min} max={f.max} className={base} onChange={(e) => onChange?.(f.key, e.target.value)} />
      )}
      {f.type === "list" && <p className="mt-1 text-xs text-muted">One value per line.</p>}
      {hint}
    </div>
  );
}

export function SettingsForm({ group, fields, preview }: { group: string; fields: FieldDef[]; preview?: boolean }) {
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(fields.map((f) => [f.key, String(f.value)])));
  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));
  return (
    <ActionForm action={saveGroupAction} className="space-y-4">
      <input type="hidden" name="__group" value={group} />
      <div className="card space-y-4 p-5">{fields.map((f) => <FieldRow key={f.key} f={f} onChange={set} />)}</div>
      {preview && <DesignPreview vals={vals} />}
      <SubmitButton>Save changes</SubmitButton>
    </ActionForm>
  );
}

function DesignPreview({ vals }: { vals: Record<string, string> }) {
  const hex = (h: string | undefined, fb: string) => (/^#[0-9a-f]{6}$/i.test(h ?? "") ? h! : fb);
  const style = { "--p": hex(vals["design.primary"], "#315EFB"), "--ph": hex(vals["design.primaryHover"], "#2448CC"), "--t": hex(vals["design.tint"], "#EAF0FF"), "--r": `${Number(vals["design.radius"] ?? 12)}px` } as React.CSSProperties;
  return (
    <section aria-label="Live preview" className="card p-5" style={style}>
      <p className="mb-3 text-sm font-medium">Preview (not published until you save)</p>
      <div className="space-y-3 border border-line p-4" style={{ borderRadius: "var(--r)", background: "var(--t)" }}>
        <p className="text-lg font-semibold">Sample card</p>
        <p className="text-sm text-muted">Buttons, tints and corner radius update as you edit.</p>
        <div className="flex gap-2">
          <span className="inline-flex px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--p)", borderRadius: "var(--r)" }}>Primary</span>
          <span className="inline-flex px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--ph)", borderRadius: "var(--r)" }}>Hover</span>
          <span className="inline-flex border px-4 py-2 text-sm" style={{ borderColor: "var(--p)", color: "var(--p)", borderRadius: "var(--r)" }}>Outline</span>
        </div>
      </div>
    </section>
  );
}
