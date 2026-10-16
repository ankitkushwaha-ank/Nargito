import Link from "next/link";
import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { adminPage, adminUser } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { getSettings } from "@/server/settings";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Badge, Notice } from "@/components/ui/kit";
import { audit } from "@/server/log";
import { redirect } from "next/navigation";

export const metadata = { title: "SEO & redirects" };

async function addRedirect(fd: FormData) {
  "use server";
  const u = await adminUser("settings.seo");
  const from = String(fd.get("from") ?? "").trim(); const to = String(fd.get("to") ?? "").trim();
  const ok = (p: string) => /^\/[A-Za-z0-9/_\-.~%]*$/.test(p) && !p.startsWith("//") && p.length < 200;
  if (!ok(from) || !ok(to) || from === to || /^\/(admin|api|_next)/.test(from)) redirect("/admin/seo?error=Use%20simple%20internal%20paths%20starting%20with%20%2F%20(not%20%2Fadmin%20or%20%2Fapi)");
  const db = await useDb();
  // reject direct loops: a -> b while b -> a exists
  const [loop] = await db.select().from(schema.redirects).where(eq(schema.redirects.fromPath, to));
  if (loop && loop.toPath === from) redirect("/admin/seo?error=That%20would%20create%20a%20redirect%20loop");
  await db.insert(schema.redirects).values({ fromPath: from, toPath: to, permanent: fd.get("permanent") === "on" }).onConflictDoUpdate({ target: schema.redirects.fromPath, set: { toPath: to, permanent: fd.get("permanent") === "on" } });
  await audit(u.id, "redirect.save", "redirect", from, { to });
  revalidatePath("/admin/seo");
}
async function delRedirect(fd: FormData) {
  "use server";
  const u = await adminUser("settings.seo");
  const db = await useDb();
  await db.delete(schema.redirects).where(eq(schema.redirects.id, String(fd.get("id"))));
  await audit(u.id, "redirect.delete", "redirect", String(fd.get("id")));
  revalidatePath("/admin/seo");
}

export default async function SeoAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await adminPage("settings.seo");
  const sp = await searchParams;
  const db = await useDb();
  const [reds, noindex, s] = await Promise.all([db.select().from(schema.redirects).orderBy(desc(schema.redirects.createdAt)), db.select().from(schema.cmsPages).where(eq(schema.cmsPages.noindex, true)), getSettings(["seo.allowIndexing", "site.baseUrl"])]);
  return (
    <>
      <AdminTitle title="SEO & redirects" description="Titles, descriptions, canonical URLs and Open Graph tags are generated per page. Private profiles, conversations, drafts, private groups, admin and account pages are never indexed or listed in the sitemap." actions={<Link href="/admin/settings/seo" className="btn-secondary">Global SEO settings</Link>} />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <section className="card p-4 text-sm"><p className="text-xs uppercase text-muted">Indexing</p><p className="mt-1">{s["seo.allowIndexing"] ? <Badge tone="success">Allowed</Badge> : <Badge tone="danger">Blocked for all crawlers</Badge>}</p></section>
        <section className="card p-4 text-sm"><p className="text-xs uppercase text-muted">Sitemap</p><p className="mt-1"><Link className="link" href="/sitemap.xml" target="_blank">sitemap.xml</Link> · <Link className="link" href="/robots.txt" target="_blank">robots.txt</Link></p><p className="text-xs text-muted">Generated live from public content.</p></section>
        <section className="card p-4 text-sm"><p className="text-xs uppercase text-muted">Pages set to noindex</p><p className="mt-1">{noindex.length ? noindex.map((p) => p.slug).join(", ") : "None"}</p></section>
      </div>
      {sp.error && <div className="mb-4"><Notice tone="danger">{sp.error.slice(0, 200)}</Notice></div>}
      <form action={addRedirect} className="card mb-4 flex flex-wrap items-end gap-3 p-4"><div><label className="label" htmlFor="rf">From path</label><input id="rf" name="from" required placeholder="/old-page" className="input" /></div><div><label className="label" htmlFor="rt2">To path</label><input id="rt2" name="to" required placeholder="/new-page" className="input" /></div><label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="permanent" defaultChecked className="accent-primary" />Permanent (301)</label><button className="btn-primary">Save redirect</button></form>
      <Table head={["From", "To", "Type", "Hits", ""]} empty={reds.length ? undefined : "No redirects."}>{reds.map((r) => <tr key={r.id}><Td><code>{r.fromPath}</code></Td><Td><code>{r.toPath}</code></Td><Td>{r.permanent ? "301" : "307"}</Td><Td>{r.hits}</Td><Td><form action={delRedirect}><input type="hidden" name="id" value={r.id} /><button className="btn-ghost !min-h-[28px] text-danger">Delete</button></form></Td></tr>)}</Table>
      <p className="mt-2 text-xs text-muted">Redirects apply to paths that are not handled by an existing page. Only internal paths are accepted, so open redirects are not possible.</p>
    </>
  );
}
