import Link from "next/link";
import { CalendarDays, MapPin, Search, Users } from "lucide-react";
import { FeatureGate } from "@/components/ui/feature-gate";
import { EmptyState, Pager } from "@/components/ui/kit";
import { SaveButton } from "@/components/social/save-button";
import { listTrips, categoryNames } from "@/server/services/listings";
import { getSessionUser } from "@/server/auth/session";
import { formatDate } from "@/lib/format";
import { getLocale } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { useDb, schema } from "@/server/db";
import { and, eq, inArray } from "drizzle-orm";

export const metadata = { title: "Trips", description: "Discover and join upcoming trips shared by the Nargito community." };

const CAT_TONE: Record<string, string> = { "Road trip": "bg-blue-50 text-blue-700", Beach: "bg-emerald-50 text-emerald-700", Spiritual: "bg-orange-50 text-orange-700", Trekking: "bg-sky-50 text-sky-700", "Hill station": "bg-green-50 text-green-700", Adventure: "bg-rose-50 text-rose-700", Culture: "bg-amber-50 text-amber-700", Wildlife: "bg-lime-50 text-lime-700" };

export default async function TripsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const viewer = await getSessionUser();
  const page = Math.max(1, Number(sp.page) || 1);
  const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const [{ items, hasMore }, dbCats] = await Promise.all([listTrips({ q: sp.q?.slice(0, 100), category: sp.category, destination: sp.destination?.slice(0, 80), from: date(sp.from), to: date(sp.to), page }), categoryNames("trip")]);
  const cats = [...new Set([...dbCats, "Trekking", "Hill station"])];
  let savedIds = new Set<string>();
  if (viewer && items.length) {
    const db = await useDb();
    const rows = await db.select({ id: schema.savedItems.entityId }).from(schema.savedItems).where(and(eq(schema.savedItems.userId, viewer.id), eq(schema.savedItems.entityType, "trip"), inArray(schema.savedItems.entityId, items.map((t) => t.id))));
    savedIds = new Set(rows.map((r) => r.id));
  }
  const chip = (label: string, value?: string) => {
    const q = new URLSearchParams(); for (const k of ["q", "destination", "from", "to"] as const) if (sp[k]) q.set(k, sp[k]!); if (value) q.set("category", value);
    return <Link key={label} href={`/trips${q.size ? `?${q}` : ""}`} scroll={false} aria-current={(sp.category ?? "") === (value ?? "") ? "page" : undefined} className={cn("chip", (sp.category ?? "") === (value ?? "") && "chip-active")}>{label}</Link>;
  };
  return (
    <FeatureGate feature="trips">
      <section className="relative isolate overflow-hidden bg-white text-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/brand/hero-mobile" alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover object-[80%_30%]" fetchPriority="high" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-white via-white/85 to-white/10 sm:via-white/70" aria-hidden />
        <div className="mx-auto max-w-shell px-4 pb-20 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
          <p className="eyebrow flex items-center gap-2"><span className="h-px w-5 bg-primary" />Trips</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] sm:text-5xl">Plan. Explore.<br /><span className="text-primary">Travel Together.</span></h1>
          <p className="mt-4 max-w-md text-base text-slate-600 sm:text-lg">Discover trips shared by travellers, request to join, or ask the organiser a question.</p>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-12 max-w-shell px-4 sm:px-6">
        <form action="/trips" method="get" role="search" className="card grid grid-cols-2 gap-3 p-4 lg:grid-cols-[1.2fr_1fr_0.7fr_0.8fr_0.8fr_auto_auto] lg:items-end">
          <div className="col-span-2 lg:col-span-1"><label htmlFor="t-q" className="label flex items-center gap-1.5"><Search size={14} className="text-primary" aria-hidden />Search</label><input id="t-q" name="q" defaultValue={sp.q} className="input" placeholder="Keywords (trekking, beach...)" maxLength={100} /></div>
          <div className="col-span-2 lg:col-span-1"><label htmlFor="t-d" className="label flex items-center gap-1.5"><MapPin size={14} className="text-primary" aria-hidden />Destination</label><input id="t-d" name="destination" defaultValue={sp.destination} className="input" placeholder="Where to?" maxLength={80} /></div>
          <div className="col-span-2 lg:col-span-1"><label htmlFor="t-c" className="label">Type</label><select id="t-c" name="category" defaultValue={sp.category ?? ""} className="input"><option value="">Any</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label htmlFor="t-f" className="label">Starts after</label><input id="t-f" name="from" type="date" defaultValue={sp.from} className="input" /></div>
          <div><label htmlFor="t-t" className="label">Starts before</label><input id="t-t" name="to" type="date" defaultValue={sp.to} className="input" /></div>
          <button className="btn-primary">Search</button>
          <Link href="/trips" className="btn-secondary">Reset</Link>
        </form>

        <div className="no-scrollbar -mx-4 mt-5 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {chip("All trips")}
          {cats.slice(0, 9).map((c) => chip(c, c))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted">{items.length ? `Showing ${items.length} trip${items.length === 1 ? "" : "s"}` : ""}</p>
          <Link href="/my/trips/new" className="btn-primary btn-sm">Share a trip</Link>
        </div>

        <div className="mt-4 pb-24 md:pb-10">
          {items.length === 0 ? <EmptyState title="No trips found" description="Try a different search, or be the first to share one." action={<Link href="/my/trips/new" className="btn-primary">Share a trip</Link>} /> : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((t) => {
                const spots = t.slots ?? null;
                return (
                  <li key={t.id} className="card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-lg">
                    <Link href={`/trips/${t.id}`} className="relative block overflow-hidden" aria-label={t.title}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {t.coverUrl ? <img src={t.coverUrl} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="aspect-[16/10] bg-gradient-to-br from-primary-tint to-sky-100" aria-hidden />}
                      {t.category && <span className={cn("absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold shadow-sm", CAT_TONE[t.category] ?? "bg-white text-primary")}>{t.category}</span>}
                    </Link>
                    {viewer && <div className="absolute right-2 top-2 rounded-full bg-white/90 text-rose-500 shadow-sm backdrop-blur"><SaveButton entityType="trip" entityId={t.id} initial={savedIds.has(t.id)} compact className="!min-h-[36px] !rounded-full !px-2 !text-slate-700" /></div>}
                    <div className="flex flex-1 flex-col p-4">
                      <h2 className="line-clamp-1 text-lg font-extrabold"><Link href={`/trips/${t.id}`} className="hover:text-primary">{t.title}</Link></h2>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted"><MapPin size={14} className="shrink-0 text-primary" aria-hidden /><span className="truncate">{t.destination}</span></p>
                      {t.description && <p className="mt-2 line-clamp-2 text-sm text-ink/70">{t.description}</p>}
                      <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs font-semibold text-ink/75">
                        <span className="flex items-center gap-1.5"><CalendarDays size={14} className="text-primary" aria-hidden />{t.startDate ? `${formatDate(t.startDate, locale, { day: "numeric", month: "short" })}${t.endDate && t.endDate !== t.startDate ? ` – ${formatDate(t.endDate, locale, { day: "numeric", month: "short", year: "numeric" })}` : ""}` : "Dates TBA"}</span>
                        {spots !== null && <span className="flex items-center gap-1.5 text-primary"><Users size={14} aria-hidden />{spots} spots</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Pager page={page} hasMore={hasMore} basePath="/trips" params={{ q: sp.q, category: sp.category, destination: sp.destination, from: sp.from, to: sp.to }} />
        </div>
      </div>
    </FeatureGate>
  );
}
