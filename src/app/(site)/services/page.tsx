import Link from "next/link";
import { Search, Wrench, SlidersHorizontal, MapPin } from "lucide-react";
import { FeatureGate } from "@/components/ui/feature-gate";
import { EmptyState, Pager } from "@/components/ui/kit";
import { SaveButton } from "@/components/social/save-button";
import { listServices, categoryNames } from "@/server/services/listings";
import { getSessionUser } from "@/server/auth/session";
import { formatMoney } from "@/lib/format";
import { getLocale } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { useDb, schema } from "@/server/db";
import { and, eq, inArray } from "drizzle-orm";

export const metadata = {
  title: "Services",
  description: "Find trusted local service providers on Nargito.",
};

const CAT_TONE: Record<string, string> = {
  Photography: "bg-purple-50 text-purple-700",
  Tutoring: "bg-blue-50 text-blue-700",
  Guiding: "bg-emerald-50 text-emerald-700",
  Maintenance: "bg-amber-50 text-amber-700",
  Fitness: "bg-rose-50 text-rose-700",
  Design: "bg-sky-50 text-sky-700",
};

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const viewer = await getSessionUser();
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ items, hasMore }, dbCats] = await Promise.all([
    listServices({
      q: sp.q?.slice(0, 100),
      category: sp.category,
      sort: sp.sort === "price_asc" ? "price_asc" : "new",
      page,
    }),
    categoryNames("service"),
  ]);

  const cats = [...new Set([...dbCats, "Photography", "Tutoring", "Guiding", "Maintenance"])];

  let savedIds = new Set<string>();
  if (viewer && items.length) {
    const db = await useDb();
    const rows = await db
      .select({ id: schema.savedItems.entityId })
      .from(schema.savedItems)
      .where(
        and(
          eq(schema.savedItems.userId, viewer.id),
          eq(schema.savedItems.entityType, "service"),
          inArray(
            schema.savedItems.entityId,
            items.map((s) => s.id)
          )
        )
      );
    savedIds = new Set(rows.map((r) => r.id));
  }

  const chip = (label: string, value?: string) => {
    const q = new URLSearchParams();
    for (const k of ["q", "sort"] as const) if (sp[k]) q.set(k, sp[k]!);
    if (value) q.set("category", value);
    return (
      <Link
        key={label}
        href={`/services${q.size ? `?${q}` : ""}`}
        scroll={false}
        aria-current={(sp.category ?? "") === (value ?? "") ? "page" : undefined}
        className={cn("chip", (sp.category ?? "") === (value ?? "") && "chip-active")}
      >
        {label}
      </Link>
    );
  };

  return (
    <FeatureGate feature="services">
      {/* Hero Banner Section matching Trips & Explore */}
      <section className="relative isolate overflow-hidden bg-white text-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/brand/banner-services"
          alt=""
          aria-hidden
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[80%_30%]"
          fetchPriority="high"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-r from-white via-white/85 to-white/10 sm:via-white/70"
          aria-hidden
        />
        <div className="mx-auto max-w-shell px-4 pb-20 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
          <p className="eyebrow flex items-center gap-2">
            <span className="h-px w-5 bg-primary" />
            Services
          </p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] sm:text-5xl">
            Trusted <br />
            <span className="text-primary">Local Services.</span>
          </h1>
          <p className="mt-4 max-w-md text-base text-slate-600 sm:text-lg">
            Photographers, tutors, guides and more skilled professionals from people near you.
          </p>
        </div>
      </section>

      {/* Main Container & Filter Form */}
      <div className="relative z-10 mx-auto -mt-12 max-w-shell px-4 sm:px-6">
        <form
          action="/services"
          method="get"
          role="search"
          className="card grid grid-cols-2 gap-3 p-4 lg:grid-cols-[1.5fr_1fr_1fr_auto_auto] lg:items-end"
        >
          <div className="col-span-2 lg:col-span-1">
            <label htmlFor="s-q" className="label flex items-center gap-1.5">
              <Search size={14} className="text-primary" aria-hidden />
              Search
            </label>
            <input
              id="s-q"
              name="q"
              defaultValue={sp.q}
              className="input"
              placeholder="Search services..."
              maxLength={100}
            />
          </div>
          <div className="col-span-2 lg:col-span-1">
            <label htmlFor="s-c" className="label">
              Category
            </label>
            <select id="s-c" name="category" defaultValue={sp.category ?? ""} className="input">
              <option value="">Any</option>
              {cats.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 lg:col-span-1">
            <label htmlFor="s-sort" className="label flex items-center gap-1.5">
              <SlidersHorizontal size={14} className="text-primary" aria-hidden />
              Sort
            </label>
            <select id="s-sort" name="sort" defaultValue={sp.sort ?? "new"} className="input">
              <option value="new">Newest</option>
              <option value="price_asc">Lowest starting price</option>
            </select>
          </div>
          <button className="btn-primary">Search</button>
          <Link href="/services" className="btn-secondary">
            Reset
          </Link>
        </form>

        {/* Category Horizontal Chips Scroller */}
        <div className="no-scrollbar -mx-4 mt-5 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {chip("All services")}
          {cats.slice(0, 9).map((c) => chip(c, c))}
        </div>

        {/* Count Bar & Action Button */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted">
            {items.length ? `Showing ${items.length} service${items.length === 1 ? "" : "s"}` : ""}
          </p>
          <Link href="/my/listings/service/new" className="btn-primary btn-sm">
            Offer a service
          </Link>
        </div>

        {/* Services Card Grid */}
        <div className="mt-4 pb-24 md:pb-10">
          {items.length === 0 ? (
            <EmptyState
              title="No services found"
              description="Try a different filter or search term, or be the first to offer one."
              action={
                <Link href="/my/listings/service/new" className="btn-primary">
                  Offer a service
                </Link>
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((s) => {
                const coverImg = s.images?.[0];
                const priceFormatted = s.startingPrice
                  ? `From ${formatMoney(s.startingPrice, s.currency, locale)}${s.pricingModel === "hourly" ? "/hr" : ""}`
                  : "Quote on request";

                return (
                  <li
                    key={s.id}
                    className="card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-lg"
                  >
                    <Link href={`/services/${s.id}`} className="relative block overflow-hidden" aria-label={s.title}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {coverImg ? (
                        <img
                          src={coverImg}
                          alt=""
                          loading="lazy"
                          className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="aspect-[16/10] bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center text-indigo-600/40">
                          <Wrench size={32} />
                        </div>
                      )}
                      {s.category && (
                        <span
                          className={cn(
                            "absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold shadow-sm",
                            CAT_TONE[s.category] ?? "bg-white text-indigo-700"
                          )}
                        >
                          {s.category}
                        </span>
                      )}
                    </Link>

                    {viewer && (
                      <div className="absolute right-2 top-2 rounded-full bg-white/90 text-rose-500 shadow-sm backdrop-blur">
                        <SaveButton
                          entityType="service"
                          entityId={s.id}
                          initial={savedIds.has(s.id)}
                          compact
                          className="!min-h-[36px] !rounded-full !px-2 !text-slate-700"
                        />
                      </div>
                    )}

                    <div className="flex flex-1 flex-col p-4">
                      <h2 className="line-clamp-1 text-lg font-extrabold">
                        <Link href={`/services/${s.id}`} className="hover:text-primary">
                          {s.title}
                        </Link>
                      </h2>
                      <p className="mt-0.5 text-sm font-semibold text-primary">{priceFormatted}</p>

                      <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs font-semibold text-ink/75 border-t border-slate-100 mt-3">
                        <span className="flex items-center gap-1 text-muted truncate">
                          <MapPin size={14} className="shrink-0 text-primary" aria-hidden />
                          <span className="truncate">{s.serviceArea ?? "Local Service"}</span>
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Pager
            page={page}
            hasMore={hasMore}
            basePath="/services"
            params={{ q: sp.q, category: sp.category, sort: sp.sort }}
          />
        </div>
      </div>
    </FeatureGate>
  );
}