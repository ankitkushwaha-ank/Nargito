"use client";
import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { callApi } from "@/lib/client-api";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/cn";

export function SaveButton({ entityType, entityId, initial, compact, className }: { entityType: string; entityId: string; initial: boolean; compact?: boolean; className?: string }) {
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const t = useT();
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={compact ? (saved ? t("common.saved") : t("common.save_item")) : undefined}
      disabled={pending}
      onClick={() => start(async () => {
        setSaved((s) => !s);
        const r = await callApi<{ saved: boolean }>("/api/save", "POST", { entityType, entityId });
        if (r.ok) setSaved(r.saved); else setSaved((s) => !s);
      })}
      className={cn("btn-ghost", saved && "text-primary", className)}
    >
      <Bookmark size={compact ? 24 : 18} className={saved ? "fill-current" : ""} aria-hidden />
      {!compact && <span>{saved ? t("common.saved") : t("common.save_item")}</span>}
    </button>
  );
}
