import Link from "next/link";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { adminPage, adminUser, adminUserStepUp } from "@/server/admin";
import { useDb, schema, rowsOf } from "@/server/db";
import { invalidateSettings } from "@/server/settings";
import { invalidateFeatures } from "@/server/features";
import { invalidateTranslations } from "@/i18n/server";
import { runJob } from "@/server/jobs/runner";
import { audit } from "@/server/log";
import { AdminTitle } from "@/components/admin/admin-ui";
import { Badge, Notice } from "@/components/ui/kit";
import { redirect } from "next/navigation";

export const metadata = { title: "Tools" };

async function clearCaches() {
  "use server";
  const u = await adminUser("tools.run");
  invalidateSettings(); invalidateFeatures(); invalidateTranslations();
  await audit(u.id, "tool.cache_clear");
  revalidatePath("/", "layout");
  redirect("/admin/tools?done=Caches%20cleared");
}
async function retryFailed() {
  "use server";
  const u = await adminUser("tools.run");
  const db = await useDb();
  const failed = await db.select().from(schema.scheduledJobs).where(eq(schema.scheduledJobs.lastStatus, "failed"));
  let ok = 0;
  for (const j of failed) if (j.safeManual && (await runJob(j.key, { manual: true, actorId: u.id })).ok) ok++;
  redirect(`/admin/tools?done=${encodeURIComponent(`Retried ${failed.length} failed job(s); ${ok} succeeded`)}`);
}
async function mediaCheck() {
  "use server";
  const u = await adminUser("tools.run");
  const r = await runJob("media_orphans", { manual: true, actorId: u.id });
  redirect(`/admin/tools?done=${encodeURIComponent(r.ok ? r.summary : r.error)}`);
}
async function processDeletions() {
  "use server";
  const u = await adminUserStepUp("tools.run", "/admin/tools");
  const r = await runJob("process_deletions", { manual: false, actorId: u.id });
  await audit(u.id, "tool.process_deletions", "job", "process_deletions");
  redirect(`/admin/tools?done=${encodeURIComponent(r.ok ? r.summary : r.error)}`);
}
async function analyze() {
  "use server";
  const u = await adminUser("tools.run");
  const db = await useDb();
  await db.execute(sql`ANALYZE`);
  await audit(u.id, "tool.analyze");
  redirect("/admin/tools?done=Search%20and%20query%20statistics%20refreshed%20(ANALYZE)");
}

export default async function ToolsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await adminPage("tools.run");
  const sp = await searchParams;
  const db = await useDb();
  const dupEmail = rowsOf<{ e: string; n: number }>(await db.execute(sql`select lower(email) e, count(*)::int n from users group by lower(email) having count(*) > 1 limit 10`));
  const dupUser = rowsOf<{ e: string; n: number }>(await db.execute(sql`select lower(username) e, count(*)::int n from users group by lower(username) having count(*) > 1 limit 10`));
  const orphanMsgs = rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int n from posts where shared_post_id is not null and not exists (select 1 from posts o where o.id = posts.shared_post_id)`))[0]?.n ?? 0;
  const pendingDel = rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int n from data_requests where type='deletion' and status='pending'`))[0]?.n ?? 0;
  const urls = rowsOf<{ n: number }>(await db.execute(sql`select (select count(*) from trips where status='published' and visibility='public') + (select count(*) from products where status='active') + (select count(*) from services where status='active') + (select count(*) from shops where status='active') + (select count(*) from companies where status='active') as n`))[0]?.n ?? 0;
  const Tool = ({ title, body, action, label, danger }: { title: string; body: React.ReactNode; action?: () => Promise<void>; label?: string; danger?: boolean }) => (
    <section className="card flex flex-col gap-2 p-5"><h2 className="text-base">{title}</h2><div className="flex-1 text-sm text-muted">{body}</div>{action && <form action={action}><button className={danger ? "btn-danger" : "btn-secondary"}>{label}</button></form>}</section>
  );
  return (
    <>
      <AdminTitle title="Tools" description="Operational utilities. Every run is audited. Destructive tools require re-authentication." />
      {sp.done && <div className="mb-4"><Notice tone="success">{sp.done.slice(0, 200)}</Notice></div>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Tool title="Clear caches" body="Clears the in-process settings, feature-flag and translation caches and revalidates pages. Needed only if you edited the database directly." action={clearCaches} label="Clear caches" />
        <Tool title="Retry failed jobs" body="Re-runs every scheduled job whose last run failed (only jobs marked safe for manual runs)." action={retryFailed} label="Retry failed jobs" />
        <Tool title="Broken media references" body="Scans media rows and reports files that are missing on disk (read-only)." action={mediaCheck} label="Run check" />
        <Tool title="Refresh search statistics" body="Runs ANALYZE so the PostgreSQL planner uses the full-text indexes efficiently. The GIN indexes themselves are maintained automatically by PostgreSQL." action={analyze} label="Run ANALYZE" />
        <Tool title="Process deletion requests" body={<>Anonymises accounts whose deletion request is older than 7 days. {pendingDel} request(s) pending. The scheduled job does this automatically.</>} action={processDeletions} label="Process now" danger />
        <Tool title="Sitemap" body={<>The sitemap is generated on request from live data (~{urls} public URLs + CMS pages). <Link className="link" href="/sitemap.xml" target="_blank">Open sitemap.xml</Link> · <Link className="link" href="/robots.txt" target="_blank">robots.txt</Link></>} />
        <Tool title="Duplicate-record diagnostics" body={<>{dupEmail.length === 0 && dupUser.length === 0 ? <Badge tone="success">No duplicate emails or usernames</Badge> : <ul>{[...dupEmail, ...dupUser].map((d) => <li key={d.e}><Badge tone="danger">{d.n}×</Badge> {d.e}</li>)}</ul>}<p className="mt-1">Shared posts pointing to missing originals: <b>{orphanMsgs}</b></p></>} />
        <Tool title="Database migrations" body={<>See migration status in <Link className="link" href="/admin/debugger">Debugger & health</Link>. Apply with <code>npm run db:migrate</code> on the server.</>} />
        <Tool title="Data export" body={<>User directory CSV (email, username, status) requires re-authentication. <a className="link" href="/api/admin/export?metric=users">Download users.csv</a>. Per-user exports are available to members in Settings &gt; Account.</>} />
        <Tool title="Backups" body={<>Backup guidance and last-run status: <Link className="link" href="/admin/backups">Backup status</Link></>} />
      </div>
    </>
  );
}
