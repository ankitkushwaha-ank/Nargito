"use client";
import { useState } from "react";
import { ImagePlus, RotateCcw } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Badge } from "@/components/ui/kit";
import { uploadBrandAction, resetBrandAction } from "@/app/admin/branding/actions";

export function BrandSlot({ kind, label, help, url, custom, dark }: { kind: string; label: string; help: string; url: string; custom: boolean; dark?: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <section className="card flex flex-col gap-4 p-5" aria-label={label}>
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-bold">{label}</h2><p className="mt-0.5 text-sm text-muted">{help}</p></div>
        <Badge tone={custom ? "success" : "muted"}>{custom ? "Custom" : "Default"}</Badge>
      </div>
      <div className={`flex min-h-[140px] items-center justify-center overflow-hidden rounded-xl border border-line p-3 ${dark ? "bg-slate-900" : "bg-[repeating-conic-gradient(#f1f4fb_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview ?? url} alt={`Current ${label}`} className="max-h-40 max-w-full object-contain" />
      </div>
      <ActionForm action={uploadBrandAction} className="space-y-3">
        <input type="hidden" name="kind" value={kind} />
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-3 text-sm font-semibold text-primary transition-colors hover:border-primary/50 hover:bg-primary-tint/50">
          <ImagePlus size={18} aria-hidden />Choose a new image
          <input type="file" name="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }} />
        </label>
        <SubmitButton className="w-full">Upload &amp; publish</SubmitButton>
      </ActionForm>
      {custom && (
        <ActionForm action={resetBrandAction}>
          <input type="hidden" name="kind" value={kind} />
          <SubmitButton variant="ghost" className="w-full"><RotateCcw size={15} aria-hidden />Restore default</SubmitButton>
        </ActionForm>
      )}
    </section>
  );
}
