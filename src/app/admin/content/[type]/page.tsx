import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { hasPermission } from "@/server/auth/guard";
import { useDb, schema } from "@/server/db";
import { AdminTitle, Table, Td, ViewToggle } from "@/components/admin/admin-ui";
import { Badge, Pager } from "@/components/ui/kit";
import { formatDate } from "@/lib/format";
import { likeEscape } from "@/server/util";
import { contentAction } from "./actions";
import { FeatureGate } from "@/components/ui/feature-gate";

export const metadata = { title: "Content" };
const PAGE = 25;

type Cfg = { feature: string; label: string; singular: "post" | "trip" | "product" | "service" | "company" | "shop" | "group"; href: (r: Row) => string };
type Row = { id: string; title: string; status: string; owner: string; created: Date; slug?: string; image: string | null };

function Thumb({ src, alt, className }: { src: string | null; alt: string; className: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt={alt} loading="lazy" data-zoom={src} className={`${className} shrink-0 cursor-zoom-in rounded-xl border border-line bg-bg object-cover`} />;
  return <div aria-hidden className={`${className} flex shrink-0 items-center justify-center rounded-xl border border-dashed border-line bg-bg text-[11px] text-muted`}>No image</div>;
}
const CFG: Record<string, Cfg> = {
  posts: { feature: "posts", label: "Posts", singular: "post", href: (r) => `/posts/${r.id}` }, trips: { feature: "trips", label: "Trips", singular: "trip", href: (r) => `/trips/${r.id}` },
  products: { feature: "products", label: "Products", singular: "product", href: (r) => `/products/${r.id}` }, services: { feature: "services", label: "Services", singular: "service", href: (r) => `/services/${r.id}` },
  companies: { feature: "companies", label: "Companies", singular: "company", href: (r) => `/companies/${r.slug}` }, shops: { feature: "shops", label: "Shops", singular: "shop", href: (r) => `/shops/${r.slug}` },
  groups: { feature: "groups", label: "Groups", singular: "group", href: (r) => `/groups/${r.slug}` },
};

async function load(type: string, q: string | undefined, status: string | undefined, page: number): Promise<Row[]> {
  const db = await useDb();
  const like = q ? `%${likeEscape(q.slice(0, 80))}%` : null;
  const off = (page - 1) * PAGE;
  const c = <T,>(...xs: (SQL | undefined)[]) => and(...(xs.filter(Boolean) as SQL[]));
  switch (type) {
    case "posts": return (await db.select({ id: schema.posts.id, title: schema.posts.body, status: schema.posts.status, owner: schema.users.username, created: schema.posts.createdAt, image: sql<string | null>`(select '/api/media/' || pm.media_id::text || '?thumb=1' from post_media pm join media m on m.id = pm.media_id where pm.post_id = ${schema.posts.id} and m.kind = 'image' order by pm.position limit 1)` }).from(schema.posts).innerJoin(schema.users, eq(schema.users.id, schema.posts.authorId)).where(c(like ? ilike(schema.posts.body, like) : undefined, status ? eq(schema.posts.status, status) : undefined)).orderBy(desc(schema.posts.createdAt)).limit(PAGE + 1).offset(off)).map((r) => ({ ...r, title: r.title.slice(0, 100) || "(media post)" }));
    case "trips": return db.select({ id: schema.trips.id, title: schema.trips.title, status: schema.trips.status, owner: schema.users.username, created: schema.trips.createdAt, image: schema.trips.coverUrl }).from(schema.trips).innerJoin(schema.users, eq(schema.users.id, schema.trips.ownerId)).where(c(like ? or(ilike(schema.trips.title, like), ilike(schema.trips.destination, like)) : undefined, status ? eq(schema.trips.status, status) : undefined)).orderBy(desc(schema.trips.createdAt)).limit(PAGE + 1).offset(off);
    case "products": return db.select({ id: schema.products.id, title: schema.products.title, status: schema.products.status, owner: schema.users.username, created: schema.products.createdAt, image: sql<string | null>`${schema.products.images}[1]` }).from(schema.products).innerJoin(schema.users, eq(schema.users.id, schema.products.sellerId)).where(c(like ? ilike(schema.products.title, like) : undefined, status ? eq(schema.products.status, status) : undefined)).orderBy(desc(schema.products.createdAt)).limit(PAGE + 1).offset(off);
    case "services": return db.select({ id: schema.services.id, title: schema.services.title, status: schema.services.status, owner: schema.users.username, created: schema.services.createdAt, image: sql<string | null>`${schema.services.images}[1]` }).from(schema.services).innerJoin(schema.users, eq(schema.users.id, schema.services.providerId)).where(c(like ? ilike(schema.services.title, like) : undefined, status ? eq(schema.services.status, status) : undefined)).orderBy(desc(schema.services.createdAt)).limit(PAGE + 1).offset(off);
    case "companies": return db.select({ id: schema.companies.id, title: schema.companies.name, status: schema.companies.status, owner: schema.users.username, created: schema.companies.createdAt, slug: schema.companies.slug, image: sql<string | null>`coalesce(${schema.companies.coverUrl}, ${schema.companies.logoUrl})` }).from(schema.companies).innerJoin(schema.users, eq(schema.users.id, schema.companies.ownerId)).where(c(like ? ilike(schema.companies.name, like) : undefined, status ? eq(schema.companies.status, status) : undefined)).orderBy(desc(schema.companies.createdAt)).limit(PAGE + 1).offset(off);
    case "shops": return db.select({ id: schema.shops.id, title: schema.shops.name, status: schema.shops.status, owner: schema.users.username, created: schema.shops.createdAt, slug: schema.shops.slug, image: sql<string | null>`coalesce(${schema.shops.coverUrl}, ${schema.shops.logoUrl})` }).from(schema.shops).innerJoin(schema.users, eq(schema.users.id, schema.shops.ownerId)).where(c(like ? ilike(schema.shops.name, like) : undefined, status ? eq(schema.shops.status, status) : undefined)).orderBy(desc(schema.shops.createdAt)).limit(PAGE + 1).offset(off);
    default: return db.select({ id: schema.groups.id, title: schema.groups.name, status: schema.groups.status, owner: schema.users.username, created: schema.groups.createdAt, slug: schema.groups.slug, image: schema.groups.coverUrl }).from(schema.groups).innerJoin(schema.users, eq(schema.users.id, schema.groups.ownerId)).where(c(like ? ilike(schema.groups.name, like) : undefined, status ? eq(schema.groups.status, status) : undefined)).orderBy(desc(schema.groups.createdAt)).limit(PAGE + 1).offset(off);
  }
}

export default async function ContentAdmin({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await adminPage("content.read");
  const { type } = await params;
  const cfg = CFG[type];
  if (!cfg) notFound();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const rows = await load(type, sp.q, sp.status, page);
  const canMod = await hasPermission(admin, "content.moderate");
  void sql;
  const view = sp.view === "grid" ? "grid" : "list";
  return (
    <FeatureGate feature={cfg.feature}>
      <AdminTitle title={cfg.label} description="Hide or remove content that breaks the guidelines. Owners are notified with your reason. Removed content can be restored." actions={<ViewToggle basePath={`/admin/content/${type}`} params={{ q: sp.q, status: sp.status }} view={view} />} />
      <form className="card mb-4 flex flex-wrap items-end gap-3 p-3" role="search"><input type="hidden" name="view" value={view} /><div className="min-w-[220px] flex-1"><label className="label" htmlFor="cq">Search</label><input id="cq" name="q" defaultValue={sp.q} className="input" /></div><div><label className="label" htmlFor="cs">Status</label><select id="cs" name="status" defaultValue={sp.status ?? ""} className="input"><option value="">All statuses</option><option value="published">Published</option><option value="active">Active</option><option value="hidden">Hidden</option><option value="removed">Removed</option><option value="draft">Draft</option></select></div><button className="btn-primary">Filter</button></form>
      {view === "grid" ? (
        rows.length === 0 ? <p className="card p-8 text-center text-sm text-muted">Nothing found.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.slice(0, PAGE).map((r) => (
              <li key={r.id} className="card flex flex-col p-4">
                <Thumb src={r.image} alt={r.title} className="mb-3 h-36 w-full" /><div className="flex items-start justify-between gap-2"><Badge tone={r.status === "removed" ? "danger" : r.status === "draft" ? "muted" : "success"}>{r.status}</Badge><span className="text-xs text-muted">{formatDate(r.created, "en")}</span></div>
                <Link className="mt-2 line-clamp-3 font-bold hover:text-primary" target="_blank" href={cfg.href(r)}>{r.title}</Link>
                <p className="mt-1 text-sm text-muted">by @{r.owner}</p>
                {canMod && (
                <form action={contentAction} className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3"><input type="hidden" name="type" value={cfg.singular} /><input type="hidden" name="id" value={r.id} />
                  {r.status === "removed" ? <button name="op" value="restore" className="btn-secondary btn-sm">Restore</button> : <><label className="sr-only" htmlFor={`gr-${r.id}`}>Reason</label><input id={`gr-${r.id}`} name="reason" placeholder="Reason to remove" required maxLength={300} className="input !min-h-[34px] !w-full flex-1 !py-1 text-sm" /><button name="op" value="remove" className="btn-danger btn-sm">Remove</button></>}
                </form>)}
              </li>
            ))}
          </ul>
        )
      ) : (
      <>
      <ul className="space-y-3 md:hidden">
        {rows.slice(0, PAGE).map((r) => (
          <li key={r.id} className="card p-4">
            <Thumb src={r.image} alt={r.title} className="mb-3 h-36 w-full" /><div className="flex items-start justify-between gap-2"><Badge tone={r.status === "removed" ? "danger" : r.status === "draft" ? "muted" : "success"}>{r.status}</Badge><span className="text-xs text-muted">{formatDate(r.created, "en")}</span></div>
            <Link className="mt-2 line-clamp-3 font-bold hover:text-primary" target="_blank" href={cfg.href(r)}>{r.title}</Link>
            <p className="mt-1 text-sm text-muted">by @{r.owner}</p>
            {canMod && (
                <form action={contentAction} className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3"><input type="hidden" name="type" value={cfg.singular} /><input type="hidden" name="id" value={r.id} />
                  {r.status === "removed" ? <button name="op" value="restore" className="btn-secondary btn-sm">Restore</button> : <><label className="sr-only" htmlFor={`gr-${r.id}`}>Reason</label><input id={`gr-${r.id}`} name="reason" placeholder="Reason to remove" required maxLength={300} className="input !min-h-[34px] !w-full flex-1 !py-1 text-sm" /><button name="op" value="remove" className="btn-danger btn-sm">Remove</button></>}
                </form>)}
          </li>
        ))}
        {rows.length === 0 && <li className="card p-8 text-center text-sm text-muted">Nothing found.</li>}
      </ul>
      <div className="hidden md:block">      <Table head={["Image", "Item", "Owner", "Status", "Created", ...(canMod ? ["Moderate"] : [])]} empty={rows.length ? undefined : "Nothing found."}>
        {rows.slice(0, PAGE).map((r) => (
          <tr key={r.id}><Td className="w-16"><Thumb src={r.image} alt="" className="h-12 w-12" /></Td><Td className="max-w-md"><Link className="link" target="_blank" href={cfg.href(r)}>{r.title}</Link></Td><Td>@{r.owner}</Td><Td><Badge tone={r.status === "removed" ? "danger" : r.status === "draft" ? "muted" : "success"}>{r.status}</Badge></Td><Td>{formatDate(r.created, "en")}</Td>
            {canMod && <Td>
              <form action={contentAction} className="flex items-center gap-1"><input type="hidden" name="type" value={cfg.singular} /><input type="hidden" name="id" value={r.id} />
                {r.status === "removed" ? <button name="op" value="restore" className="btn-secondary !min-h-[30px]">Restore</button> : <><label className="sr-only" htmlFor={`rs-${r.id}`}>Reason</label><input id={`rs-${r.id}`} name="reason" placeholder="Reason" required maxLength={300} className="input !w-40 !py-1" /><button name="op" value="remove" className="btn-danger !min-h-[30px]">Remove</button></>}
              </form></Td>}
          </tr>
        ))}
      </Table>
      </div>
      </>
      )}
      <Pager page={page} hasMore={rows.length > PAGE} basePath={`/admin/content/${type}`} params={{ q: sp.q, status: sp.status, view }} />
    </FeatureGate>
  );
}
