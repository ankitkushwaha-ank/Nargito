"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { SponsoredItem } from "@/server/services/promotions";
import { Badge } from "@/components/ui/kit";
import { useT } from "@/i18n/client";

function send(id: string, type: "impression" | "click") {
  void fetch(`/api/promotions/${id}/event`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }), keepalive: true }).catch(() => {});
}

/** Always labelled. Impressions fire once when the card is actually visible; clicks fire on navigation. */
export function SponsoredCard({ item, compact }: { item: SponsoredItem; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) { send(item.promotionId, "impression"); io.disconnect(); } }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [item.promotionId]);
  return (
    <div ref={ref} className="card overflow-hidden" aria-label={t("common.sponsored")}>
      <Link href={item.href} onClick={() => send(item.promotionId, "click")} className="flex items-center gap-3 p-3 hover:bg-primary-tint">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {item.image ? <img src={item.image} alt="" loading="lazy" className={compact ? "h-12 w-12 rounded-lg object-cover" : "h-20 w-20 rounded-lg object-cover"} /> : <div className={compact ? "h-12 w-12 rounded-lg bg-primary-tint" : "h-20 w-20 rounded-lg bg-primary-tint"} aria-hidden />}
        <div className="min-w-0"><Badge tone="muted">{t("common.sponsored")}</Badge><p className="truncate font-medium">{item.title}</p>{item.subtitle && <p className="truncate text-sm text-muted">{item.subtitle}</p>}</div>
      </Link>
    </div>
  );
}
