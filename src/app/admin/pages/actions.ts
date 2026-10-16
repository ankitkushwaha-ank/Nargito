"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { run, type SAResult } from "@/server/action";
import { adminUser, adminUserStepUp } from "@/server/admin";
import { hasPermission } from "@/server/auth/guard";
import { useDb, schema } from "@/server/db";
import { fail, ok, isUuid, slugify } from "@/server/util";
import { audit } from "@/server/log";

const RESERVED = new Set(["admin", "api", "login", "register", "home", "feed", "explore", "search", "people", "companies", "shops", "products", "services", "trips", "groups", "settings", "my", "messages", "notifications", "saved", "profile", "posts", "connections", "pricing", "offline", "onboarding", "auth", "verify-otp", "forgot-password", "reset-password", "sitemap.xml", "robots.txt", "manifest.webmanifest"]);

export async function savePageAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    let user = await adminUser("cms.manage");
    const id = String(fd.get("id") ?? "");
    const title = String(fd.get("title") ?? "").trim().slice(0, 150);
    const body = String(fd.get("body") ?? "").slice(0, 100_000);
    if (!title) return fail("Enter a title.", { title: "Required" });
    const db = await useDb();
    const status = fd.get("status") === "draft" ? "draft" : "published";
    const seo = { seoTitle: String(fd.get("seoTitle") ?? "").trim().slice(0, 150) || null, seoDescription: String(fd.get("seoDescription") ?? "").trim().slice(0, 300) || null, noindex: fd.get("noindex") === "on" };
    if (isUuid(id)) {
      const [cur] = await db.select().from(schema.cmsPages).where(eq(schema.cmsPages.id, id));
      if (!cur) return fail("Page not found.");
      if (cur.isLegal) {
        // Legal pages: dedicated permission + fresh re-authentication, and they can never be unpublished.
        if (!(await hasPermission(user, "cms.legal"))) return fail("Legal pages can only be edited by administrators with legal-page access.");
        user = await adminUserStepUp("cms.legal", `/admin/pages/${id}`);
      }
      await db.insert(schema.cmsRevisions).values({ pageId: id, title: cur.title, body: cur.body, createdBy: user.id });
      await db.update(schema.cmsPages).set({ title, body, status: cur.isLegal ? "published" : status, ...seo, updatedBy: user.id, updatedAt: new Date() }).where(eq(schema.cmsPages.id, id));
      await audit(user.id, "cms.update", "page", cur.slug, { legal: cur.isLegal });
      revalidatePath("/", "layout");
      return ok(undefined, "Page saved. The previous version is kept in the revision history.");
    }
    const slug = slugify(String(fd.get("slug") || title), 60);
    if (RESERVED.has(slug)) return fail("That address is reserved by the application.", { slug: "Reserved" });
    const [dup] = await db.select({ id: schema.cmsPages.id }).from(schema.cmsPages).where(eq(schema.cmsPages.slug, slug));
    if (dup) return fail("A page with that address already exists.", { slug: "Taken" });
    const [p] = await db.insert(schema.cmsPages).values({ slug, title, body, status, ...seo, updatedBy: user.id }).returning();
    await db.insert(schema.cmsRevisions).values({ pageId: p!.id, title, body, createdBy: user.id });
    await audit(user.id, "cms.create", "page", slug);
    redirect(`/admin/pages/${p!.id}`);
  });
}

export async function restoreRevisionAction(fd: FormData) {
  let user = await adminUser("cms.manage");
  const revId = String(fd.get("revId"));
  if (!isUuid(revId)) return;
  const db = await useDb();
  const [rev] = await db.select().from(schema.cmsRevisions).where(eq(schema.cmsRevisions.id, revId));
  if (!rev) return;
  const [page] = await db.select().from(schema.cmsPages).where(eq(schema.cmsPages.id, rev.pageId));
  if (!page) return;
  if (page.isLegal) user = await adminUserStepUp("cms.legal", `/admin/pages/${page.id}`);
  await db.insert(schema.cmsRevisions).values({ pageId: page.id, title: page.title, body: page.body, createdBy: user.id });
  await db.update(schema.cmsPages).set({ title: rev.title, body: rev.body, updatedBy: user.id, updatedAt: new Date() }).where(eq(schema.cmsPages.id, page.id));
  await audit(user.id, "cms.restore", "page", page.slug, { revision: revId });
  revalidatePath("/", "layout");
  redirect(`/admin/pages/${page.id}`);
  void desc;
}

export async function deletePageAction(fd: FormData) {
  const user = await adminUserStepUp("cms.manage", "/admin/pages");
  const id = String(fd.get("id"));
  const db = await useDb();
  const [p] = await db.select().from(schema.cmsPages).where(eq(schema.cmsPages.id, id));
  if (!p || p.isLegal) return; // legal pages cannot be deleted
  await db.delete(schema.cmsPages).where(eq(schema.cmsPages.id, id));
  await audit(user.id, "cms.delete", "page", p.slug);
  revalidatePath("/admin/pages");
  redirect("/admin/pages");
}
