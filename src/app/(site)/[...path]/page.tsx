import { notFound, permanentRedirect, redirect } from "next/navigation";
import type { Metadata } from "next";
import { eq, sql } from "drizzle-orm";
import { useDb, schema } from "@/server/db";
import { Container } from "@/components/shell/frames";
import { Markdown } from "@/components/cms/markdown";
import { ContactForm } from "./contact-form";
import { formatDate } from "@/lib/format";
import { getLocale } from "@/i18n/server";
import { getSettings } from "@/server/settings";

/**
 * Catch-all for single-segment CMS pages (about, privacy, ...) and admin-managed redirects.
 * Specific routes always win over this segment.
 */
async function resolve(path: string[]) {
  const db = await useDb();
  const full = "/" + path.join("/");
  const [redir] = await db.select().from(schema.redirects).where(eq(schema.redirects.fromPath, full)).limit(1);
  if (redir) return { redirect: redir };
  if (path.length !== 1) return null;
  const [page] = await db.select().from(schema.cmsPages).where(eq(schema.cmsPages.slug, path[0]!)).limit(1);
  return page && page.status === "published" ? { page } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
  const { path } = await params;
  const r = await resolve(path);
  if (!r?.page) return { title: "Not found", robots: { index: false } };
  const p = r.page;
  const s = await getSettings(["seo.defaultDescription"]);
  return { title: p.seoTitle || p.title, description: p.seoDescription || String(s["seo.defaultDescription"]), robots: p.noindex ? { index: false, follow: false } : undefined, alternates: { canonical: `/${p.slug}` }, openGraph: { title: p.seoTitle || p.title, type: "article" } };
}

export default async function CmsPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const r = await resolve(path);
  if (!r) notFound();
  if (r.redirect) {
    const db = await useDb();
    await db.update(schema.redirects).set({ hits: sql`${schema.redirects.hits} + 1` }).where(eq(schema.redirects.id, r.redirect.id));
    const to = r.redirect.toPath;
    if (!to.startsWith("/") || to.startsWith("//")) notFound();
    if (r.redirect.permanent) permanentRedirect(to); else redirect(to);
  }
  const p = r.page!;
  const locale = await getLocale();
  return (
    <Container width="max-w-3xl">
      <article>
        <h1 className="text-3xl">{p.title}</h1>
        {p.isLegal && <p className="mt-1 text-xs text-muted">Last updated {formatDate(p.updatedAt, locale)}</p>}
        <div className="mt-5"><Markdown source={p.body} /></div>
        {p.slug === "contact" && <ContactForm />}
      </article>
    </Container>
  );
}
