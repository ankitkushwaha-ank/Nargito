import Link from "next/link";
import { CalendarDays, ChevronRight, Megaphone } from "lucide-react";
import { getDiscovery, myNextTrip, pendingRequestPeople } from "@/server/services/discovery";
import { getSponsored } from "@/server/services/promotions";
import { getSettings } from "@/server/settings";
import { isFeatureEnabled } from "@/server/features";
import { Avatar, VerifiedBadge } from "@/components/ui/kit";
import { FollowButton } from "@/components/social/relationship-buttons";
import { SponsoredCard } from "@/components/social/sponsored-card";
import { getT, getLocale } from "@/i18n/server";
import { formatDate } from "@/lib/format";

function Widget({ title, children, icon, action }: { title: string; children: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card p-5" aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-bold">{icon}{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stack({ people }: { people: { id?: string; name: string; avatar: string | null }[] }) {
  return (
    <div className="flex -space-x-2">
      {people.map((p, i) => <Avatar key={(p.id ?? "") + i} name={p.name} src={p.avatar} size={36} className="ring-2 ring-surface" />)}
    </div>
  );
}

export async function RightSidebar({ userId }: { userId: string | null }) {
  const t = await getT();
  const locale = await getLocale();
  const [d, sponsored, s, connectionsOn, tripsOn, requests, nextTrip] = await Promise.all([
    getDiscovery(userId), getSponsored(userId, "sidebar", 1), getSettings(["announcement.enabled", "announcement.title", "announcement.body", "announcement.link"]),
    isFeatureEnabled("connections"), isFeatureEnabled("trips"),
    userId ? pendingRequestPeople(userId) : Promise.resolve(null),
    userId ? myNextTrip(userId) : Promise.resolve(null),
  ]);
  return (
    <div className="space-y-4">
      {Boolean(s["announcement.enabled"]) && Boolean(s["announcement.title"]) && (
        <Widget title={t("right.announcements")} icon={<Megaphone size={16} className="text-primary" aria-hidden />}>
          <p className="text-sm font-medium">{String(s["announcement.title"])}</p>
          {Boolean(s["announcement.body"]) && <p className="mt-1 text-sm text-muted">{String(s["announcement.body"])}</p>}
          {Boolean(s["announcement.link"]) && /^(\/|https?:\/\/)/.test(String(s["announcement.link"])) && <Link href={String(s["announcement.link"])} className="link mt-2 inline-block text-sm">Learn more</Link>}
        </Widget>
      )}
      {requests && requests.total > 0 && (
        <section className="card p-5" aria-label="Let's connect">
          <h2 className="text-[15px] font-bold">Let&apos;s connect</h2>
          <Link href="/connections" className="mt-3 flex items-center gap-3 rounded-xl hover:bg-primary-tint/50">
            <Stack people={requests.people} />
            <ChevronRight size={18} className="ml-auto text-muted" aria-hidden />
          </Link>
          <p className="mt-2 text-sm text-muted">You have {requests.total} new connection request{requests.total === 1 ? "" : "s"}.</p>
        </section>
      )}
      {tripsOn && nextTrip && (
        <Widget title="My next trip" action={<Link href="/my/trips" className="text-xs font-semibold text-primary hover:underline">{t("common.viewAll")}</Link>}>
          <Link href={`/trips/${nextTrip.id}`} className="group block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {nextTrip.cover ? <img src={nextTrip.cover} alt="" loading="lazy" className="aspect-[16/8] w-full rounded-xl object-cover" /> : <div className="aspect-[16/8] w-full rounded-xl bg-gradient-to-br from-primary/80 to-sky-300" aria-hidden />}
            <p className="mt-3 font-bold group-hover:underline">{nextTrip.title}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted"><CalendarDays size={14} aria-hidden />{formatDate(nextTrip.startDate, locale)}{nextTrip.endDate && nextTrip.endDate !== nextTrip.startDate ? ` – ${formatDate(nextTrip.endDate, locale)}` : ""}</p>
          </Link>
          {nextTrip.going.length > 0 && <div className="mt-3 flex items-center gap-2"><Stack people={nextTrip.going.slice(0, 4)} /><span className="text-sm text-muted">{nextTrip.going.length} going</span></div>}
        </Widget>
      )}
      {connectionsOn && d.people.length > 0 && (
        <Widget title={t("right.pymk")} action={<Link href="/people" className="text-xs font-semibold text-primary hover:underline">See all</Link>}>
          <ul className="space-y-3.5">
            {d.people.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <Link href={`/profile/${p.username}`}><Avatar name={p.displayName} src={p.avatarUrl} size={44} /></Link>
                <div className="min-w-0 flex-1"><Link href={`/profile/${p.username}`} className="flex items-center gap-1 truncate text-sm font-bold hover:underline">{p.displayName}{p.verified && <VerifiedBadge />}</Link><p className="truncate text-xs text-muted">{p.headline}</p></div>
                {userId && <FollowButton userId={p.id} initialFollowing={false} size="sm" />}
              </li>
            ))}
          </ul>
        </Widget>
      )}
      {sponsored[0] && <SponsoredCard item={sponsored[0]} compact />}
      {tripsOn && !nextTrip && d.trips.length > 0 && (
        <Widget title={t("right.trips")} action={<Link href="/trips" className="text-xs font-semibold text-primary hover:underline">{t("common.viewAll")}</Link>}>
          <ul className="space-y-2.5">{d.trips.map((tr) => <li key={tr.id}><Link href={`/trips/${tr.id}`} className="block text-sm hover:underline"><span className="font-semibold">{tr.title}</span><span className="block text-xs text-muted">{tr.destination} · {formatDate(tr.startDate, locale)}</span></Link></li>)}</ul>
        </Widget>
      )}
    </div>
  );
}
