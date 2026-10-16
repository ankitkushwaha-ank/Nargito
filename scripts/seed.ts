import "./env";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { useDb, schema } from "../src/server/db";
import { hashPassword } from "../src/server/auth/password";
import { PERMISSIONS, DEFAULT_ROLES } from "../src/server/permissions-def";
import { FEATURES } from "../src/server/features";
import { CMS_DEFAULTS } from "../src/server/cms-defaults";
import { JOB_DEFS } from "../src/server/jobs/defs";
import { seedDemo, DEMO_PASSWORD, MODERATOR } from "./seed-demo";

async function main() {
  const db = await useDb();

  // permissions + roles
  for (const p of PERMISSIONS) {
    await db.insert(schema.permissions).values({ key: p.key, description: p.description, groupName: p.group })
      .onConflictDoUpdate({ target: schema.permissions.key, set: { description: p.description, groupName: p.group } });
  }
  for (const r of DEFAULT_ROLES) {
    const [role] = await db.insert(schema.roles).values({ name: r.name, description: r.description, isSystem: true })
      .onConflictDoUpdate({ target: schema.roles.name, set: { description: r.description } }).returning();
    // Only seed permissions for brand-new roles so later admin edits are never overwritten.
    const existing = await db.select().from(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, role!.id)).limit(1);
    if (!existing.length || r.name === "superadmin") {
      for (const key of r.permissions) await db.insert(schema.rolePermissions).values({ roleId: role!.id, permissionKey: key }).onConflictDoNothing();
    }
  }

  // feature flags (insert-only so admin choices persist)
  for (const f of FEATURES) {
    await db.insert(schema.featureFlags).values({ key: f.key, enabled: true, critical: !!f.critical, description: f.description }).onConflictDoNothing();
  }

  // languages
  await db.insert(schema.languages).values([
    { code: "en", name: "English", nativeName: "English", enabled: true, isDefault: true, fallback: null },
    { code: "hi", name: "Hindi", nativeName: "हिन्दी", enabled: true, isDefault: false, fallback: "en" },
  ]).onConflictDoNothing();

  // categories
  const cats: Record<string, string[]> = {
    product: ["Electronics", "Fashion", "Home & Garden", "Books & Media", "Sports & Outdoors", "Vehicles", "Handmade", "Food & Groceries"],
    service: ["Photography", "Tutoring", "Repairs", "Design & Creative", "Travel & Guides", "Health & Wellness", "Legal & Finance", "Events"],
    trip: ["Adventure", "Culture", "Pilgrimage", "Road trip", "Wildlife", "Beach", "Mountains", "City break"],
    company: ["Technology", "Hospitality", "Retail", "Education", "Healthcare", "Manufacturing", "Travel", "Media"],
    shop: ["Grocery", "Clothing", "Electronics", "Home", "Gifts", "Food & Drink", "Books", "Services"],
    group: ["Travel", "Technology", "Business", "Photography", "Local community", "Food", "Fitness", "Learning"],
  };
  for (const [type, names] of Object.entries(cats)) {
    for (const [i, name] of names.entries()) {
      await db.insert(schema.categories).values({ type, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), sortOrder: i }).onConflictDoNothing();
    }
  }

  // CMS pages
  for (const p of CMS_DEFAULTS) {
    const [page] = await db.insert(schema.cmsPages).values({ slug: p.slug, title: p.title, body: p.body, isLegal: p.isLegal, status: "published" }).onConflictDoNothing().returning();
    if (page) await db.insert(schema.cmsRevisions).values({ pageId: page.id, title: page.title, body: page.body });
  }

  // plans
  await db.insert(schema.subscriptionPlans).values([
    { key: "free", name: "Free", description: "Everything you need to connect and trade.", priceCents: 0, features: [] },
    { key: "pro", name: "Pro", description: "For creators and small businesses.", priceCents: 49900, features: ["pro.badge", "pro.analytics", "pro.extra_listings", "pro.priority_support"] },
    { key: "business", name: "Business", description: "For teams and growing shops.", priceCents: 149900, features: ["pro.badge", "pro.analytics", "pro.extra_listings", "pro.priority_support", "pro.team_seats"] },
  ]).onConflictDoNothing();

  // scheduled jobs
  for (const j of JOB_DEFS) {
    await db.insert(schema.scheduledJobs).values({ key: j.key, name: j.name, description: j.description, intervalMinutes: j.intervalMinutes, safeManual: j.safeManual, nextRunAt: new Date(Date.now() + j.intervalMinutes * 60_000) }).onConflictDoNothing();
  }

  // super administrator
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@nargito.local").toLowerCase();
  const [existingAdmin] = await db.select().from(schema.users).where(eq(schema.users.email, adminEmail)).limit(1);
  let generated: string | null = null;
  if (!existingAdmin) {
    const pw = process.env.SEED_ADMIN_PASSWORD ?? (generated = randomBytes(9).toString("base64url") + "9a");
    const [u] = await db.insert(schema.users).values({
      email: adminEmail, username: "nargito_admin", displayName: "Nargito Admin", headline: "Platform administrator", passwordHash: await hashPassword(pw),
      emailVerifiedAt: new Date(), verified: true, onboardingDone: true, discoverable: false,
    }).returning();
    const [sa] = await db.select().from(schema.roles).where(eq(schema.roles.name, "superadmin"));
    await db.insert(schema.userRoles).values({ userId: u!.id, roleId: sa!.id });
    console.log(`Created super administrator ${adminEmail}${generated ? ` with generated password: ${generated}` : " (password from SEED_ADMIN_PASSWORD)"}`);
  }

  const wantSample = process.env.NODE_ENV !== "production" || process.env.SEED_SAMPLE === "1";
  const [{ n: sampleCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.users).where(eq(schema.users.isSeed, true));
  if (wantSample && sampleCount === 0) {
    await seedDemo(db);
    console.log("");
    console.log("Demo logins");
    console.log("  member     demo@nargito.local         " + DEMO_PASSWORD);
    console.log("  seller     rohan_mehta@nargito.demo   " + DEMO_PASSWORD);
    console.log("  moderator  " + MODERATOR.email + "     " + MODERATOR.password);
  }
  console.log("seed complete");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
