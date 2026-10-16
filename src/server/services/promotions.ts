import "server-only";
import { and, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { useDb, schema } from "../db";
import { getSettings } from "../settings";
import { isFeatureEnabled, requireFeature } from "../features";
import { AppError, ok, fail, type ActionResult } from "../util";
import { parseInput, optStr } from "../validation";
import { resolveEntity } from "./entities";
import { audit } from "../log";
import { notify } from "./notify";

export type SponsoredItem = { promotionId: string; title: string; entityType: string; entityId: string; href: string; image: string | null; subtitle: string | null };

export async function adsAvailable() {
  const s = await getSettings(["ads.enabled"]);
  return Boolean(s["ads.enabled"]) && (await isFeatureEnabled("promotions"));
}

/** Active, approved, in-window promotions for a placement. Always labelled "Sponsored" by the UI. */
export async function getSponsored(viewerId: string | null, placement: "feed" | "sidebar", limit = 2): Promise<SponsoredItem[]> {
  if (!(await adsAvailable())) return [];
  const db = await useDb();
  const now = new Date();
  const rows = await db.select().from(schema.promotions).where(and(
    eq(schema.promotions.status, "active"), eq(schema.promotions.placement, placement),
    or(isNull(schema.promotions.startsAt), lte(schema.promotions.startsAt, now)), or(isNull(schema.promotions.endsAt), gt(schema.promotions.endsAt, now)),
    sql`exists (select 1 from users u where u.id = ${schema.promotions.ownerId} and u.status = 'active')`,
    viewerId ? sql`${schema.promotions.ownerId} <> ${viewerId}::uuid` : sql`true`,
  )).orderBy(sql`random()`).limit(limit * 3);
  const out: SponsoredItem[] = [];
  for (const p of rows) {
    const e = await resolveEntity(p.entityType, p.entityId);
    if (!e || !e.public) continue;
    out.push({ promotionId: p.id, title: p.title || e.title, entityType: p.entityType, entityId: p.entityId, href: e.href, image: e.image, subtitle: e.subtitle });
    if (out.length >= limit) break;
  }
  return out;
}

export async function recordPromotionEvent(promotionId: string, type: "impression" | "click", viewerKey: string) {
  const db = await useDb();
  const [p] = await db.select({ id: schema.promotions.id, status: schema.promotions.status }).from(schema.promotions).where(eq(schema.promotions.id, promotionId));
  if (!p || p.status !== "active") return;
  const day = new Date().toISOString().slice(0, 10);
  await db.insert(schema.promotionEvents).values({ promotionId, type, viewerKey: viewerKey.slice(0, 64), day }).onConflictDoNothing();
}

const createSchema = z.object({
  entityType: z.enum(["post", "product", "service", "shop", "company", "trip"]),
  entityId: z.string().uuid(),
  title: optStr(100),
  placement: z.enum(["feed", "sidebar"]).default("feed"),
  audienceLocation: optStr(80),
  budget: z.coerce.number().min(0).max(10_000_000).default(0),
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export async function createPromotion(userId: string, input: unknown): Promise<ActionResult> {
  await requireFeature("promotions");
  const s = await getSettings();
  if (!s["ads.enabled"]) return fail("Advertising is currently disabled.");
  const p = parseInput(createSchema, input);
  if (!p.ok) return p.result;
  const d = p.data;
  if (!(s["ads.allowedTypes"] as string[]).includes(d.entityType)) return fail("That content type cannot be promoted.");
  const e = await resolveEntity(d.entityType, d.entityId);
  if (!e || e.ownerId !== userId) return fail("You can only promote your own content.");
  if (!e.public) return fail("Only public, published content can be promoted.");
  const db = await useDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.promotions).where(and(eq(schema.promotions.ownerId, userId), sql`${schema.promotions.status} in ('pending','active','paused')`));
  if (n! >= Number(s["ads.maxActivePerUser"])) return fail("You have reached the limit of active promotions.");
  const status = s["ads.requireApproval"] ? "pending" : "active";
  const startsAt = new Date();
  await db.insert(schema.promotions).values({
    ownerId: userId, entityType: d.entityType, entityId: d.entityId, title: d.title ?? e.title, placement: d.placement, audienceLocation: d.audienceLocation ?? null,
    budgetCents: Math.round(d.budget * 100), startsAt, endsAt: new Date(startsAt.getTime() + d.days * 86400_000), status,
  });
  return ok(undefined, status === "pending" ? "Submitted for review. It will go live once approved." : "Promotion is live.");
}

export async function setPromotionStatus(actor: { id: string }, promotionId: string, status: "paused" | "active" | "ended", asAdmin = false) {
  const db = await useDb();
  const [p] = await db.select().from(schema.promotions).where(eq(schema.promotions.id, promotionId));
  if (!p || (!asAdmin && p.ownerId !== actor.id)) throw new AppError(404, "Promotion not found.");
  if (!asAdmin && ["rejected", "suspended"].includes(p.status)) throw new AppError(403, "This promotion was blocked by moderation.");
  if (!asAdmin && status === "active" && p.status !== "paused") throw new AppError(400, "Only paused promotions can be resumed.");
  await db.update(schema.promotions).set({ status }).where(eq(schema.promotions.id, promotionId));
}

export async function moderatePromotion(adminId: string, promotionId: string, decision: "approve" | "reject" | "suspend", reason?: string) {
  const db = await useDb();
  const [p] = await db.select().from(schema.promotions).where(eq(schema.promotions.id, promotionId));
  if (!p) throw new AppError(404, "Promotion not found.");
  const status = decision === "approve" ? "active" : decision === "reject" ? "rejected" : "suspended";
  await db.update(schema.promotions).set({ status, rejectionReason: decision === "approve" ? null : reason?.slice(0, 300) ?? null }).where(eq(schema.promotions.id, promotionId));
  await audit(adminId, `promotion.${decision}`, "promotion", promotionId, { reason });
  await notify({ userId: p.ownerId, type: "announcement", title: decision === "approve" ? "Your promotion was approved" : `Your promotion was ${decision}ed`, body: reason, link: "/my/ads", dedupeKey: `promo:${promotionId}:${status}` });
}

export async function promotionStats(promotionIds: string[]) {
  const out = new Map<string, { impressions: number; clicks: number }>();
  if (!promotionIds.length) return out;
  const db = await useDb();
  const rows = await db.select({ id: schema.promotionEvents.promotionId, type: schema.promotionEvents.type, n: sql<number>`count(*)::int` }).from(schema.promotionEvents)
    .where(sql`${schema.promotionEvents.promotionId} in (${sql.join(promotionIds.map((i) => sql`${i}::uuid`), sql`, `)})`).groupBy(schema.promotionEvents.promotionId, schema.promotionEvents.type);
  for (const r of rows) {
    const cur = out.get(r.id) ?? { impressions: 0, clicks: 0 };
    if (r.type === "impression") cur.impressions = r.n; else cur.clicks = r.n;
    out.set(r.id, cur);
  }
  return out;
}

export async function adminAdsSummary() {
  const db = await useDb();
  const [a] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.promotions).where(eq(schema.promotions.status, "active"));
  const [p] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.promotions).where(eq(schema.promotions.status, "pending"));
  const [i] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.promotionEvents).where(eq(schema.promotionEvents.type, "impression"));
  const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.promotionEvents).where(eq(schema.promotionEvents.type, "click"));
  return { active: a!.n, pending: p!.n, impressions: i!.n, clicks: c!.n };
}

export async function myPromotions(userId: string) {
  const db = await useDb();
  const rows = await db.select().from(schema.promotions).where(eq(schema.promotions.ownerId, userId)).orderBy(desc(schema.promotions.createdAt));
  const stats = await promotionStats(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, stats: stats.get(r.id) ?? { impressions: 0, clicks: 0 } }));
}
