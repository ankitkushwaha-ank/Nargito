import Link from "next/link";
import { requireUserPage } from "@/server/auth/guard";
import { ThreeColumn } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { myTrips } from "@/server/services/listings";
import { EmptyState, PageHeader, Badge } from "@/components/ui/kit";
import { formatDate } from "@/lib/format";
import { getLocale } from "@/i18n/server";

export const metadata = { title: "My trips" };

export default async function MyTripsPage() {
  const user = await requireUserPage("/my/trips");
  const trips = await myTrips(user.id);
  const locale = await getLocale();
  return (
    <FeatureGate feature="trips">
      <ThreeColumn user={user} right={false}>
        <PageHeader title="My trips" actions={<Link href="/my/trips/new" className="btn-primary">Share a trip</Link>} />
        {trips.length === 0 ? <EmptyState title="You haven't shared a trip yet" /> : (
          <ul className="card divide-y divide-line">{trips.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 p-3"><div className="min-w-0 flex-1"><Link href={`/trips/${t.id}`} className="font-medium hover:underline">{t.title}</Link><p className="text-sm text-muted">{t.destination}{t.startDate ? ` · ${formatDate(t.startDate, locale)}` : ""} · {t.viewCount} views</p></div><Badge tone={t.status === "published" ? "success" : "muted"}>{t.status}</Badge><Link href={`/my/trips/${t.id}`} className="btn-secondary !min-h-[32px]">Edit</Link></li>
          ))}</ul>
        )}
      </ThreeColumn>
    </FeatureGate>
  );
}
