import Link from "next/link";
import { Search, Tag, SlidersHorizontal } from "lucide-react";
import { FeatureGate } from "@/components/ui/feature-gate";
import { EmptyState, Pager } from "@/components/ui/kit";
import { SaveButton } from "@/components/social/save-button";
import { listProducts, categoryNames } from "@/server/services/listings";
import { getSessionUser } from "@/server/auth/session";
import { formatMoney } from "@/lib/format";
import { getLocale } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { useDb, schema } from "@/server/db";
import { and, eq, inArray } from "drizzle-orm";

export const metadata = { title: "Products", description: "Discover unique products, handmade items, and local shops on Nargito." };

const CAT_TONE: Record<string, string> = { Electronics: "bg-blue-50 text-blue-700", Fashion: "bg-pink-50 text-pink-700", Home: "bg-emerald-50 text-emerald-700", Craft: "bg-amber-50 text-amber-700", Sports: "bg-sky-50 text-sky-700", Books: "bg-orange-50 text-orange-700", Beauty: "bg-purple-50 text-purple-700" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const viewer = await getSessionUser();
  const page = Math.max(1, Number(sp.page) || 1);
  const num = (v?: string) => (v && Number.isFinite(Number(v)) ? Number(v) : undefined);
  const sort = (["new", "price_asc", "price_desc"] as const).find((s) => s === sp.sort);

  const [{ items, hasMore }, dbCats] = await Promise.all([
    listProducts({ q: sp.q?.slice(0, 100), category: sp.category, min: num(sp.min), max: num(sp.max), sort, page }),
    categoryNames("product")
  ]);
  const cats = [...new Set([...dbCats, "Electronics", "Fashion", "Home", "Craft"])];

  let savedIds = new Set<string>();
  if (viewer && items.length) {
    const db = await useDb();
    const rows = await db
      .select({ id: schema.savedItems.entityId })
      .from(schema.savedItems)
      .where(and(eq(schema.savedItems.userId, viewer.id), eq(schema.savedItems.entityType, "product"), inArray(schema.savedItems.entityId, items.map((p) => p.id))));
    savedIds = new Set(rows.map((r) => r.id));
  }

  const chip = (label: string, value?: string) => {
    const q = new URLSearchParams(); 
    for (const k of ["q", "min", "max", "sort"] as const) if (sp[k]) q.set(k, sp[k]!); 
    if (value) q.set("category", value);
    return (
      <Link 
        key={label} 
        href={`/products${q.size ? `?${q}` : ""}`} 
        scroll={false} 
        aria-current={(sp.category ?? "") === (value ?? "") ? "page" : undefined} 
        className={cn("chip", (sp.category ?? "") === (value ?? "") && "chip-active")}
      >
        {label}
      </Link>
    );
  };

  return (
    <FeatureGate feature="products">
      {/* Hero Banner Section matching Trips */}
      <section className="relative isolate overflow-hidden bg-white text-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/brand/banner-marketplace" alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover object-[80%_30%]" fetchPriority="high" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-white via-white/85 to-white/10 sm:via-white/70" aria-hidden />
        <div className="mx-auto max-w-shell px-4 pb-20 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
          <p className="eyebrow flex items-center gap-2"><span className="h-px w-5 bg-primary" />Marketplace</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] sm:text-5xl">Buy Local,<br /><span className="text-primary">Support Real People.</span></h1>
          <p className="mt-4 max-w-md text-base text-slate-600 sm:text-lg">Discover unique products, handmade items, local shops and services from people around you.</p>
        </div>
      </section>

      {/* Main Container & Filter Form */}
      <div className="relative z-10 mx-auto -mt-12 max-w-shell px-4 sm:px-6">
        <form action="/products" method="get" role="search" className="card grid grid-cols-2 gap-3 p-4 lg:grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr_0.9fr_auto_auto] lg:items-end">
          <div className="col-span-2 lg:col-span-1">
            <label htmlFor="p-q" className="label flex items-center gap-1.5"><Search size={14} className="text-primary" aria-hidden />Search</label>
            <input id="p-q" name="q" defaultValue={sp.q} className="input" placeholder="Search products..." maxLength={100} />
          </div>
          <div className="col-span-2 lg:col-span-1">
            <label htmlFor="p-c" className="label">Category</label>
            <select id="p-c" name="category" defaultValue={sp.category ?? ""} className="input">
              <option value="">Any</option>
              {cats.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="p-min" className="label">Min price</label>
            <input id="p-min" name="min" type="number" defaultValue={sp.min} className="input" placeholder="0" />
          </div>
          <div>
            <label htmlFor="p-max" className="label">Max price</label>
            <input id="p-max" name="max" type="number" defaultValue={sp.max} className="input" placeholder="Any" />
          </div>
          <div>
            <label htmlFor="p-sort" className="label flex items-center gap-1.5"><SlidersHorizontal size={14} className="text-primary" aria-hidden />Sort</label>
            <select id="p-sort" name="sort" defaultValue={sp.sort ?? "new"} className="input">
              <option value="new">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
          <button className="btn-primary">Search</button>
          <Link href="/products" className="btn-secondary">Reset</Link>
        </form>

        {/* Category Horizontal Chips Scroller */}
        <div className="no-scrollbar -mx-4 mt-5 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {chip("All products")}
          {cats.slice(0, 9).map((c) => chip(c, c))}
        </div>

        {/* Count Bar & Action Button */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted">{items.length ? `Showing ${items.length} product${items.length === 1 ? "" : "s"}` : ""}</p>
          <Link href="/my/listings/product/new" className="btn-primary btn-sm">List a product</Link>
        </div>

        {/* Product Cards Grid */}
        <div className="mt-4 pb-24 md:pb-10">
          {items.length === 0 ? (
            <EmptyState title="No products found" description="Try a different filter or search term, or be the first to list one." action={<Link href="/my/listings/product/new" className="btn-primary">List a product</Link>} />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((p) => {
                const coverImg = p.images?.[0];
                const priceFormatted = p.price ? formatMoney(p.price, p.currency, locale) : "Price on enquiry";
                const badgeText = p.condition ? p.condition.replace("_", " ") : undefined;

                return (
                  <li key={p.id} className="card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-lg">
                    <Link href={`/products/${p.id}`} className="relative block overflow-hidden" aria-label={p.title}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {coverImg ? (
                        <img src={coverImg} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="aspect-[16/10] bg-gradient-to-br from-primary-tint to-sky-100 flex items-center justify-center text-primary/40">
                          <Tag size={32} />
                        </div>
                      )}
                      {p.category && (
                        <span className={cn("absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold shadow-sm", CAT_TONE[p.category] ?? "bg-white text-primary")}>
                          {p.category}
                        </span>
                      )}
                    </Link>

                    {viewer && (
                      <div className="absolute right-2 top-2 rounded-full bg-white/90 text-rose-500 shadow-sm backdrop-blur">
                        <SaveButton entityType="product" entityId={p.id} initial={savedIds.has(p.id)} compact className="!min-h-[36px] !rounded-full !px-2 !text-slate-700" />
                      </div>
                    )}

                    <div className="flex flex-1 flex-col p-4">
                      <h2 className="line-clamp-1 text-lg font-extrabold">
                        <Link href={`/products/${p.id}`} className="hover:text-primary">{p.title}</Link>
                      </h2>
                      <p className="mt-0.5 text-sm font-medium text-primary">{priceFormatted}</p>
                      
                      {badgeText && (
                        <div className="mt-2">
                          <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 capitalize">
                            {badgeText}
                          </span>
                        </div>
                      )}

                      <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs font-semibold text-ink/75 border-t border-slate-100 mt-3">
                        <span className="truncate text-muted">{p.locationLabel ?? "Local Seller"}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Pager page={page} hasMore={hasMore} basePath="/products" params={{ q: sp.q, category: sp.category, min: sp.min, max: sp.max, sort: sp.sort }} />
        </div>
      </div>
    </FeatureGate>
  );
}