import type { MetadataRoute } from "next";
import { and, eq } from "drizzle-orm";
import { useDb, schema } from "@/server/db";
import { getSettings } from "@/server/settings";
import { isFeatureEnabled } from "@/server/features";

export const dynamic = "force-dynamic";

/** Public content only: private/connection-only profiles, drafts, restricted listings and private groups are never listed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const s = await getSettings(["site.baseUrl", "seo.allowIndexing"]);
  if (!s["seo.allowIndexing"]) return [];
  const base = (process.env.APP_URL || String(s["site.baseUrl"])).replace(/\/$/, "");
  const db = await useDb();
  const out: MetadataRoute.Sitemap = [{ url: `${base}/`, changeFrequency: "daily", priority: 1 }];
  for (const p of ["explore", "trips", "shops", "companies", "products", "services", "groups", "people", "pricing"]) out.push({ url: `${base}/${p}`, changeFrequency: "daily", priority: 0.7 });
  const pages = await db.select().from(schema.cmsPages).where(and(eq(schema.cmsPages.status, "published"), eq(schema.cmsPages.noindex, false)));
  for (const p of pages) out.push({ url: `${base}/${p.slug}`, lastModified: p.updatedAt, priority: 0.4 });
  const [trips, shops, companies, products, services, groups, users] = await Promise.all([
    (await isFeatureEnabled("trips")) ? db.select({ id: schema.trips.id, u: schema.trips.updatedAt }).from(schema.trips).where(and(eq(schema.trips.status, "published"), eq(schema.trips.visibility, "public"))).limit(5000) : [],
    (await isFeatureEnabled("shops")) ? db.select({ id: schema.shops.slug, u: schema.shops.updatedAt }).from(schema.shops).where(eq(schema.shops.status, "active")).limit(5000) : [],
    (await isFeatureEnabled("companies")) ? db.select({ id: schema.companies.slug, u: schema.companies.updatedAt }).from(schema.companies).where(eq(schema.companies.status, "active")).limit(5000) : [],
    (await isFeatureEnabled("products")) ? db.select({ id: schema.products.id, u: schema.products.updatedAt }).from(schema.products).where(eq(schema.products.status, "active")).limit(5000) : [],
    (await isFeatureEnabled("services")) ? db.select({ id: schema.services.id, u: schema.services.updatedAt }).from(schema.services).where(eq(schema.services.status, "active")).limit(5000) : [],
    (await isFeatureEnabled("groups")) ? db.select({ id: schema.groups.slug, u: schema.groups.createdAt }).from(schema.groups).where(and(eq(schema.groups.status, "active"), eq(schema.groups.visibility, "public"))).limit(5000) : [],
    (await isFeatureEnabled("profiles")) ? db.select({ id: schema.users.username, u: schema.users.updatedAt }).from(schema.users).where(and(eq(schema.users.status, "active"), eq(schema.users.profileVisibility, "public"), eq(schema.users.discoverable, true))).limit(5000) : [],
  ]);
  const add = (prefix: string, rows: { id: string; u: Date }[]) => rows.forEach((r) => out.push({ url: `${base}/${prefix}/${r.id}`, lastModified: r.u }));
  add("trips", trips); add("shops", shops); add("companies", companies); add("products", products); add("services", services); add("groups", groups); add("profile", users);
  return out;
}
