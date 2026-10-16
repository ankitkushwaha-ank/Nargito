import Link from "next/link";
import { getSessionUser } from "@/server/auth/session";
import { search, recordSearch, recentSearches, SEARCH_TYPES, type SearchHit } from "@/server/services/search";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { Avatar, EmptyState, ErrorState, Pager, PageHeader, Badge } from "@/components/ui/kit";
import { SearchBox } from "@/components/shell/search-box";
import { cn } from "@/lib/cn";
import { AppError } from "@/server/util";
import { categoryNames } from "@/server/services/listings";
import { clearRecentAction } from "./actions";
import { redirect } from "next/navigation";

export const metadata = { title: "Search", robots: { index: false, follow: true } };

function Hit({ h }: { h: SearchHit }) {
  return (
    <li><Link href={h.href} className="flex items-center gap-3 p-3 hover:bg-primary-tint">
      {h.image || h.type === "people" ? <Avatar name={h.title} src={h.image} size={44} className={h.type !== "people" ? "!rounded-lg" : ""} /> : <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-tint text-xs capitalize text-primary" aria-hidden>{h.type.slice(0, 2)}</span>}
      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{h.title}</span>{h.subtitle && <span className="block truncate text-sm text-muted">{h.subtitle}</span>}</span>
      <span className="shrink-0 text-right text-xs text-muted">{h.meta && <span className="block">{h.meta}</span>}{h.distance && <Badge tone="muted">{h.distance}</Badge>}</span>
    </Link></li>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const type = (SEARCH_TYPES as readonly string[]).includes(sp.type ?? "") ? (sp.type as (typeof SEARCH_TYPES)[number]) : "all";
  const sort = sp.sort === "newest" ? "newest" : "relevance";
  const page = Math.max(1, Number(sp.page) || 1);
  const viewer = await getSessionUser();
  let result: Awaited<ReturnType<typeof search>> | null = null;
  let error: string | null = null;
  if (q) {
    try { result = await search(viewer?.id ?? null, { q, type, sort, category: sp.category, near: sp.near === "1", page }); if (viewer && page === 1) await recordSearch(viewer.id, q); }
    catch (e) { error = e instanceof AppError ? e.message : "Search is temporarily unavailable."; }
  }
  const recent = viewer && !q ? await recentSearches(viewer.id) : [];
  const cats = type === "products" ? await categoryNames("product") : type === "services" ? await categoryNames("service") : type === "trips" ? await categoryNames("trip") : [];
  const href = (t: string) => `/search?q=${encodeURIComponent(q)}&type=${t}${sort !== "relevance" ? `&sort=${sort}` : ""}`;
  void redirect;
  const total = result ? result.hits.length + Object.values(result.grouped).reduce((n, a) => n + a.length, 0) : 0;
  return (
    <FeatureGate feature="search">
      <Container width="max-w-4xl">
        <PageHeader title="Search" />
        <SearchBox defaultValue={q} className="mb-4" />
        {q && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <nav aria-label="Result types" className="flex flex-wrap gap-1">
              {["all", ...SEARCH_TYPES].map((t) => <Link key={t} href={href(t)} aria-current={type === t ? "page" : undefined} className={cn("rounded-full border border-line px-3 py-1 text-sm capitalize", type === t ? "bg-primary text-white" : "bg-surface text-muted")}>{t}</Link>)}
            </nav>
            <form className="ml-auto flex flex-wrap items-center gap-2 text-sm" action="/search">
              <input type="hidden" name="q" value={q} /><input type="hidden" name="type" value={type} />
              {cats.length > 0 && <select name="category" defaultValue={sp.category ?? ""} className="input !w-auto !py-1" aria-label="Category"><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>}
              <select name="sort" defaultValue={sort} className="input !w-auto !py-1" aria-label="Sort"><option value="relevance">Most relevant</option><option value="newest">Newest</option></select>
              {viewer && <label className="flex items-center gap-1"><input type="checkbox" name="near" value="1" defaultChecked={sp.near === "1"} className="accent-primary" />Near me</label>}
              <button className="btn-secondary !min-h-[32px]">Apply</button>
            </form>
          </div>
        )}
        {!q && (
          <div className="card p-5"><p className="text-sm text-muted">Search people, posts, companies, shops, products, services, trips and groups.</p>
            {recent.length > 0 && <div className="mt-3"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Recent searches</h2><form action={clearRecentAction}><button className="link text-xs">Clear</button></form></div><ul className="mt-2 flex flex-wrap gap-2">{recent.map((r) => <li key={r.id}><Link className="badge" href={`/search?q=${encodeURIComponent(r.query)}`}>{r.query}</Link></li>)}</ul></div>}
          </div>
        )}
        {error && <ErrorState title="Search failed" description={error} action={<Link href={href(type)} className="btn-secondary">Try again</Link>} />}
        {q && result && !error && (total === 0 ? <EmptyState title={`No results for “${q}”`} description="Check the spelling or try a broader term." /> : type === "all" ? (
          <div className="space-y-5">{Object.entries(result.grouped).map(([t, hits]) => (
            <section key={t} className="card" aria-label={t}><div className="flex items-center justify-between border-b border-line px-4 py-2"><h2 className="text-sm font-semibold capitalize">{t}</h2><Link className="link text-sm" href={href(t)}>See all</Link></div><ul className="divide-y divide-line">{hits.map((h) => <Hit key={h.type + h.id} h={h} />)}</ul></section>
          ))}</div>
        ) : (
          <><ul className="card divide-y divide-line">{result.hits.map((h) => <Hit key={h.type + h.id} h={h} />)}</ul><Pager page={page} hasMore={result.hasMore} basePath="/search" params={{ q, type, sort, category: sp.category, near: sp.near }} /></>
        ))}
      </Container>
    </FeatureGate>
  );
}
