import Link from "next/link";
import { requireUserPage } from "@/server/auth/guard";
import { ThreeColumn } from "@/components/shell/frames";
import { myListings, listingStats } from "@/server/services/listings";
import { EmptyState, PageHeader, Badge, Stat } from "@/components/ui/kit";
import { formatMoney } from "@/lib/format";
import { getLocale } from "@/i18n/server";
import { setListingStatusAction } from "../actions";

export const metadata = { title: "My products & services" };

export default async function MyListings() {
  const user = await requireUserPage("/my/listings");
  const [{ products, services }, stats] = await Promise.all([myListings(user.id), listingStats(user.id)]);
  const locale = await getLocale();
  const tone = (s: string) => (s === "active" ? "success" : s === "sold" ? "primary" : "muted") as "success" | "primary" | "muted";
  return (
    <ThreeColumn user={user} right={false}>
      <PageHeader title="My products & services" actions={<><Link href="/my/listings/product/new" className="btn-primary">List a product</Link><Link href="/my/listings/service/new" className="btn-secondary">Offer a service</Link></>} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Product views" value={stats.products.views} hint="Unique viewers per day" /><Stat label="Service views" value={stats.services.views} />
        <Stat label="Enquiries received" value={stats.enquiries} /><Stat label="Times saved" value={stats.saves} />
      </div>
      <section aria-labelledby="mp-h"><h2 id="mp-h" className="mb-2 text-lg">Products ({products.length})</h2>
        {products.length === 0 ? <EmptyState title="No products yet" /> : (
          <ul className="card divide-y divide-line">{products.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.images[0] ? <img src={p.images[0]} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="h-12 w-12 rounded-lg bg-primary-tint" aria-hidden />}
              <div className="min-w-0 flex-1"><Link href={`/products/${p.id}`} className="font-medium hover:underline">{p.title}</Link><p className="text-sm text-muted">{p.price ? formatMoney(p.price, p.currency, locale) : "Price on enquiry"} · {p.viewCount} views</p></div>
              <Badge tone={tone(p.status)}>{p.status}</Badge>
              <form action={setListingStatusAction} className="flex gap-1"><input type="hidden" name="type" value="product" /><input type="hidden" name="id" value={p.id} />
                {p.status !== "active" && <button name="status" value="active" className="btn-secondary !min-h-[32px]">Publish</button>}
                {p.status === "active" && <button name="status" value="sold" className="btn-secondary !min-h-[32px]">Mark sold</button>}
                {p.status !== "archived" && <button name="status" value="archived" className="btn-ghost !min-h-[32px]">Archive</button>}</form>
              <Link href={`/my/listings/product/${p.id}`} className="btn-secondary !min-h-[32px]">Edit</Link>
            </li>))}</ul>
        )}
      </section>
      <section aria-labelledby="ms-h"><h2 id="ms-h" className="mb-2 text-lg">Services ({services.length})</h2>
        {services.length === 0 ? <EmptyState title="No services yet" /> : (
          <ul className="card divide-y divide-line">{services.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1"><Link href={`/services/${s.id}`} className="font-medium hover:underline">{s.title}</Link><p className="text-sm text-muted">{s.serviceArea ?? s.category} · {s.viewCount} views</p></div>
              <Badge tone={tone(s.status)}>{s.status}</Badge>
              <form action={setListingStatusAction} className="flex gap-1"><input type="hidden" name="type" value="service" /><input type="hidden" name="id" value={s.id} />
                {s.status !== "active" && <button name="status" value="active" className="btn-secondary !min-h-[32px]">Publish</button>}
                {s.status !== "archived" && <button name="status" value="archived" className="btn-ghost !min-h-[32px]">Archive</button>}</form>
              <Link href={`/my/listings/service/${s.id}`} className="btn-secondary !min-h-[32px]">Edit</Link>
            </li>))}</ul>
        )}
      </section>
    </ThreeColumn>
  );
}
