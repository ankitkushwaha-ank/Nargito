import { and, desc, eq } from "drizzle-orm";
import { requireUserPage } from "@/server/auth/guard";
import { ThreeColumn } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { Badge, EmptyState, Notice, PageHeader } from "@/components/ui/kit";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { adsAvailable, myPromotions } from "@/server/services/promotions";
import { getSettings } from "@/server/settings";
import { useDb, schema } from "@/server/db";
import { myBusinesses } from "@/server/services/business";
import { createPromotionAction, promotionStatusAction } from "../actions";
import { formatDate } from "@/lib/format";
import { getLocale } from "@/i18n/server";

export const metadata = { title: "My promotions" };

export default async function MyAds() {
  const user = await requireUserPage("/my/ads");
  const [on, s, promos, biz] = await Promise.all([adsAvailable(), getSettings(["ads.allowedTypes", "ads.requireApproval", "ads.maxActivePerUser"]), myPromotions(user.id), myBusinesses(user.id)]);
  const db = await useDb();
  const allowed = s["ads.allowedTypes"] as string[];
  const [posts, products, services, trips] = await Promise.all([
    db.select({ id: schema.posts.id, t: schema.posts.body }).from(schema.posts).where(and(eq(schema.posts.authorId, user.id), eq(schema.posts.status, "published"), eq(schema.posts.visibility, "public"))).orderBy(desc(schema.posts.createdAt)).limit(15),
    db.select({ id: schema.products.id, t: schema.products.title }).from(schema.products).where(and(eq(schema.products.sellerId, user.id), eq(schema.products.status, "active"))).limit(30),
    db.select({ id: schema.services.id, t: schema.services.title }).from(schema.services).where(and(eq(schema.services.providerId, user.id), eq(schema.services.status, "active"))).limit(30),
    db.select({ id: schema.trips.id, t: schema.trips.title }).from(schema.trips).where(and(eq(schema.trips.ownerId, user.id), eq(schema.trips.status, "published"), eq(schema.trips.visibility, "public"))).limit(30),
  ]);
  const options = [
    ...posts.map((p) => ({ v: `post:${p.id}`, l: `Post: ${p.t.slice(0, 50) || "(media post)"}`, type: "post" })), ...products.map((p) => ({ v: `product:${p.id}`, l: `Product: ${p.t}`, type: "product" })),
    ...services.map((p) => ({ v: `service:${p.id}`, l: `Service: ${p.t}`, type: "service" })), ...trips.map((p) => ({ v: `trip:${p.id}`, l: `Trip: ${p.t}`, type: "trip" })),
    ...biz.shops.filter((x) => x.s.ownerId === user.id && x.s.status === "active").map(({ s: x }) => ({ v: `shop:${x.id}`, l: `Shop: ${x.name}`, type: "shop" })),
    ...biz.companies.filter((x) => x.c.ownerId === user.id && x.c.status === "active").map(({ c: x }) => ({ v: `company:${x.id}`, l: `Company: ${x.name}`, type: "company" })),
  ].filter((o) => allowed.includes(o.type));
  const locale = await getLocale();
  const tone = (st: string) => (st === "active" ? "success" : st === "pending" ? "warn" : st === "rejected" || st === "suspended" ? "danger" : "muted") as "success" | "warn" | "danger" | "muted";
  return (
    <FeatureGate feature="promotions">
      <ThreeColumn user={user} right={false}>
        <PageHeader title="Promotions" description="Reach more people with clearly labelled sponsored placements." />
        {!on && <Notice tone="warn">Advertising is currently disabled by the platform.</Notice>}
        {on && (
          <section className="card p-5" aria-labelledby="np-h">
            <h2 id="np-h" className="text-lg">New promotion</h2>
            {options.length === 0 ? <p className="mt-2 text-sm text-muted">You need public content to promote: publish a post, product, service, trip or business page first.</p> : (
              <ActionForm action={createPromotionActionWrapper} className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field className="sm:col-span-2" label="What do you want to promote?" name="target" as="select" required options={options.map((o) => ({ value: o.v, label: o.l }))} />
                <Field label="Headline (optional)" name="title" maxLength={100} />
                <Field label="Placement" name="placement" as="select" options={[{ value: "feed", label: "Home feed" }, { value: "sidebar", label: "Right sidebar" }]} />
                <Field label="Duration (days)" name="days" type="number" min={1} max={90} defaultValue={7} />
                <Field label="Budget (optional, for your records)" name="budget" type="number" min={0} defaultValue={0} help="Billing is not enabled yet; no charges are made." />
                <Field className="sm:col-span-2" label="Audience area (optional)" name="audienceLocation" maxLength={80} help="Targeting uses broad areas only, never individual locations." />
                <div className="sm:col-span-2"><SubmitButton>{s["ads.requireApproval"] ? "Submit for review" : "Start promotion"}</SubmitButton></div>
              </ActionForm>
            )}
          </section>
        )}
        <section aria-labelledby="yp-h"><h2 id="yp-h" className="mb-2 text-lg">Your promotions</h2>
          {promos.length === 0 ? <EmptyState title="No promotions yet" /> : (
            <ul className="card divide-y divide-line">{promos.map((p) => (
              <li key={p.id} className="space-y-1 p-4">
                <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{p.title}</p><Badge>{p.entityType}</Badge><Badge tone={tone(p.status)}>{p.status}</Badge></div>
                {p.rejectionReason && <p className="text-sm text-danger">Reason: {p.rejectionReason}</p>}
                <p className="text-sm text-muted">{p.stats.impressions} impressions · {p.stats.clicks} clicks{p.stats.impressions ? ` · ${((p.stats.clicks / p.stats.impressions) * 100).toFixed(1)}% CTR` : ""} · ends {p.endsAt ? formatDate(p.endsAt, locale) : "-"}</p>
                <p className="text-xs text-muted">Counts are de-duplicated per viewer per day and measured from real events.</p>
                {(p.status === "active" || p.status === "paused") && (
                  <form action={promotionStatusAction} className="flex gap-2 pt-1"><input type="hidden" name="id" value={p.id} />
                    {p.status === "active" ? <button name="status" value="paused" className="btn-secondary !min-h-[32px]">Pause</button> : <button name="status" value="active" className="btn-secondary !min-h-[32px]">Resume</button>}
                    <button name="status" value="ended" className="btn-ghost !min-h-[32px]">End</button></form>
                )}
              </li>))}</ul>
          )}
        </section>
      </ThreeColumn>
    </FeatureGate>
  );
}

async function createPromotionActionWrapper(prev: Parameters<typeof createPromotionAction>[0], fd: FormData) {
  "use server";
  const [entityType, entityId] = String(fd.get("target") ?? "").split(":");
  fd.set("entityType", entityType ?? "");
  fd.set("entityId", entityId ?? "");
  return createPromotionAction(prev, fd);
}
