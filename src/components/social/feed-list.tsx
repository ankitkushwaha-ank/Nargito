"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PostView } from "@/server/services/posts";
import type { SponsoredItem } from "@/server/services/promotions";
import { PostCard } from "./post-card";
import { SponsoredCard } from "./sponsored-card";
import { CardSkeleton, EmptyState } from "@/components/ui/kit";
import { callApi } from "@/lib/client-api";
import { useT } from "@/i18n/client";

export function FeedList({ initialItems, initialCursor, query, sponsored = [], sponsoredEvery = 6, emptyText }: {
  initialItems: PostView[]; initialCursor: string | null; query: string; sponsored?: SponsoredItem[]; sponsoredEvery?: number; emptyText?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const t = useT();

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    const r = await callApi<{ items: PostView[]; nextCursor: string | null }>(`/api/feed?${query}&cursor=${encodeURIComponent(cursor)}`, "GET");
    setLoading(false);
    if (r.ok) { setItems((p) => [...p, ...r.items.filter((n) => !p.some((x) => x.id === n.id))]); setCursor(r.nextCursor); } else setError(r.error);
  }, [cursor, loading, query]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || error) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) void loadMore(); }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore, error]);

  if (!items.length && !sponsored.length) return <EmptyState title={emptyText ?? t("feed.empty")} />;
  return (
    <div className="space-y-4">
      {items.map((p, i) => (
        <div key={p.id} className="space-y-4">
          {sponsoredEvery > 0 && i > 0 && i % sponsoredEvery === 0 && sponsored[Math.floor(i / sponsoredEvery) - 1] && <SponsoredCard item={sponsored[Math.floor(i / sponsoredEvery) - 1]!} />}
          <PostCard post={p} onDeleted={(id) => setItems((prev) => prev.filter((x) => x.id !== id))} />
        </div>
      ))}
      {sponsoredEvery > 0 && items.length > 0 && items.length < sponsoredEvery && sponsored[0] && <SponsoredCard item={sponsored[0]} />}
      {loading && <CardSkeleton />}
      {error && (
        <div role="alert" className="card p-4 text-center text-sm"><p className="text-danger">{error}</p><button type="button" className="btn-secondary mt-2" onClick={loadMore}>{t("common.retry")}</button></div>
      )}
      {cursor && !loading && !error && <div ref={sentinel} className="flex justify-center"><button type="button" className="btn-secondary" onClick={loadMore}>{t("common.loadMore")}</button></div>}
    </div>
  );
}
