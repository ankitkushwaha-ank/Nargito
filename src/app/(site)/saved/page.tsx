import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { requireUserPage } from "@/server/auth/guard";
import { ThreeColumn } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { useDb, schema } from "@/server/db";
import { resolveEntity } from "@/server/services/entities";
import { EmptyState, PageHeader, Badge } from "@/components/ui/kit";
import { SaveButton } from "@/components/social/save-button";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import { getLocale } from "@/i18n/server";

export const metadata = { title: "Saved items" };
const TYPES = ["all", "post", "trip", "product", "service", "company", "shop", "group"];

export default async function SavedPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUserPage("/saved");
  const sp = await searchParams;
  const type = TYPES.includes(sp.type ?? "") ? sp.type! : "all";
  const locale = await getLocale();
  const db = await useDb();
  const conds = [eq(schema.savedItems.userId, user.id)];
  if (type !== "all") conds.push(eq(schema.savedItems.entityType, type));
  const rows = await db.select().from(schema.savedItems).where(and(...conds)).orderBy(desc(schema.savedItems.createdAt)).limit(60);
  const resolved = await Promise.all(rows.map(async (r) => ({ r, e: await resolveEntity(r.entityType, r.entityId) })));
  return (
    <FeatureGate feature="saved">
      <ThreeColumn user={user} right={false}>
        <PageHeader title="Saved items" description="Only you can see what you save." />
        <nav className="flex flex-wrap gap-2" aria-label="Filter saved items">
          {TYPES.map((t) => <Link key={t} href={`/saved?type=${t}`} aria-current={type === t ? "page" : undefined} className={cn("rounded-full border border-line px-3 py-1.5 text-sm capitalize", type === t ? "bg-primary text-white" : "bg-surface text-muted")}>{t === "all" ? "All" : t + "s"}</Link>)}
        </nav>
        {resolved.length === 0 ? <EmptyState title="Nothing saved yet" description="Use the bookmark button on posts, trips and listings to keep them here." /> : (
          <ul className="space-y-3">
            {resolved.map(({ r, e }) => (
              <li key={r.entityType + r.entityId} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <Badge>{r.entityType}</Badge>
                  {e && (e.public || e.ownerId === user.id) ? <Link href={e.href} className="mt-1 block truncate font-medium hover:underline">{e.title}</Link> : <p className="mt-1 text-sm text-muted">This item is no longer available.</p>}
                  <p className="text-xs text-muted">Saved {timeAgo(r.createdAt, locale)}</p>
                </div>
                <SaveButton entityType={r.entityType} entityId={r.entityId} initial compact />
              </li>
            ))}
          </ul>
        )}
      </ThreeColumn>
    </FeatureGate>
  );
}
