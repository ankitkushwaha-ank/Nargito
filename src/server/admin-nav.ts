import "server-only";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { getPermissionsFor } from "@/server/auth/guard";
import { isFeatureEnabled } from "@/server/features";

export type VisibleGroup = { label: string; items: { label: string; href: string }[] };

/** The admin menu entries this user may see (permission + feature filtered). Shared by the layout and the dashboard. */
export async function visibleAdminGroups(userId: string): Promise<VisibleGroup[]> {
  const perms = await getPermissionsFor(userId);
  const groups: VisibleGroup[] = [];
  for (const g of ADMIN_NAV) {
    const items: VisibleGroup["items"] = [];
    for (const i of g.items) {
      if (!perms.has(i.perm)) continue;
      if (i.feature && !(await isFeatureEnabled(i.feature))) continue;
      items.push({ label: i.label, href: i.href });
    }
    if (items.length) groups.push({ label: g.label, items });
  }
  return groups;
}

/** Live numbers shown on the phone dashboard tiles. Keys are the tile hrefs. */
export async function adminTileCounts(): Promise<Record<string, string>> {
  const { useDb, schema } = await import("@/server/db");
  const { sql } = await import("drizzle-orm");
  const db = await useDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const n = async (table: any, label: string, where?: any) => {
    try { const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(where); return `${(r?.n ?? 0).toLocaleString("en-IN")} ${label}`; } catch { return ""; }
  };
  const [posts, trips, products, services, companies, shops, groups, cats, users, reports, verif, contact, promos] = await Promise.all([
    n(schema.posts, "published", sql`${schema.posts.status} = 'published'`),
    n(schema.trips, "published", sql`${schema.trips.status} = 'published'`),
    n(schema.products, "active", sql`${schema.products.status} = 'active'`),
    n(schema.services, "active", sql`${schema.services.status} = 'active'`),
    n(schema.companies, "active", sql`${schema.companies.status} = 'active'`),
    n(schema.shops, "active", sql`${schema.shops.status} = 'active'`),
    n(schema.groups, "active", sql`${schema.groups.status} = 'active'`),
    n(schema.categories, "categories"),
    n(schema.users, "members"),
    n(schema.reports, "open", sql`${schema.reports.status} = 'open'`),
    n(schema.verificationRequests, "pending", sql`${schema.verificationRequests.status} = 'pending'`),
    n(schema.contactMessages, "messages"),
    n(schema.promotions, "promotions"),
  ]);
  return {
    "/admin/content/posts": posts, "/admin/content/trips": trips, "/admin/content/products": products, "/admin/content/services": services,
    "/admin/content/companies": companies, "/admin/content/shops": shops, "/admin/content/groups": groups, "/admin/categories": cats,
    "/admin/users": users, "/admin/reports": reports, "/admin/verification": verif, "/admin/contact": contact, "/admin/promotions": promos,
  };
}
