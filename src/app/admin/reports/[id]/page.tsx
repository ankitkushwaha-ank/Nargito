import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { hasPermission } from "@/server/auth/guard";
import { useDb, schema } from "@/server/db";
import { AdminTitle } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/kit";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { reportAction } from "../actions";
import { resolveEntity } from "@/server/services/entities";
import { formatDate } from "@/lib/format";
import { isUuid } from "@/server/util";

export const metadata = { title: "Report" };

export default async function ReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await adminPage("reports.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = await useDb();
  const [r] = await db.select().from(schema.reports).where(eq(schema.reports.id, id));
  if (!r) notFound();
  const [reporter] = r.reporterId ? await db.select().from(schema.users).where(eq(schema.users.id, r.reporterId)) : [];
  const history = await db.select({ a: schema.reportActions, who: schema.users.displayName }).from(schema.reportActions).leftJoin(schema.users, eq(schema.users.id, schema.reportActions.adminId)).where(eq(schema.reportActions.reportId, id)).orderBy(desc(schema.reportActions.createdAt));
  let preview: { title: string; href: string | null; body?: string } | null = null;
  if (r.entityType === "user") { const [u] = await db.select().from(schema.users).where(eq(schema.users.id, r.entityId)); if (u) preview = { title: `${u.displayName} (@${u.username})`, href: `/admin/users/${u.id}` }; }
  else if (r.entityType === "post") { const [p] = await db.select().from(schema.posts).where(eq(schema.posts.id, r.entityId)); if (p) preview = { title: `Post (${p.status})`, href: `/posts/${p.id}`, body: p.body.slice(0, 600) }; }
  else if (r.entityType === "comment") { const [c] = await db.select().from(schema.comments).where(eq(schema.comments.id, r.entityId)); if (c) preview = { title: `Comment (${c.status})`, href: `/posts/${c.postId}`, body: c.body.slice(0, 600) }; }
  else if (r.entityType === "message") preview = { title: "A private message", href: null, body: "Message contents are not shown to reviewers. Use account actions on the sender if the report is credible." };
  else { const e = await resolveEntity(r.entityType, r.entityId); if (e) preview = { title: e.title, href: e.href }; }
  const [canContent, canUsers] = await Promise.all([hasPermission(admin, "content.moderate"), hasPermission(admin, "users.suspend")]);
  const closed = r.status === "resolved" || r.status === "dismissed";
  return (
    <>
      <AdminTitle title={`${r.entityType} report: ${r.reason}`} description={`Opened ${formatDate(r.createdAt, "en", { dateStyle: "medium", timeStyle: "short" })} by ${reporter ? "@" + reporter.username : "unknown"}`} actions={<Link href="/admin/reports" className="btn-secondary">All reports</Link>} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <section className="card space-y-2 p-5"><div className="flex flex-wrap gap-2"><Badge tone={r.severity === "high" || r.severity === "critical" ? "danger" : "warn"}>{r.severity}</Badge><Badge>{r.status}</Badge></div>
            {r.details && <p className="rounded-lg bg-bg p-3 text-sm">“{r.details}”</p>}
            <h2 className="pt-2 text-base">Reported item</h2>
            {preview ? <div className="text-sm"><p className="font-medium">{preview.href ? <Link className="link" href={preview.href} target="_blank">{preview.title}</Link> : preview.title}</p>{preview.body && <p className="mt-1 whitespace-pre-wrap rounded-lg bg-bg p-3">{preview.body}</p>}</div> : <p className="text-sm text-muted">The item no longer exists.</p>}
            {r.resolution && <p className="text-sm"><b>Resolution:</b> {r.resolution}</p>}
          </section>
          <section className="card p-5"><h2 className="text-base">Action history</h2>
            {history.length === 0 ? <p className="mt-1 text-sm text-muted">No actions yet.</p> : <ol className="mt-2 space-y-2 text-sm">{history.map(({ a, who }) => <li key={a.id}><b>{a.action}</b> by {who ?? "admin"} · <span className="text-muted">{formatDate(a.createdAt, "en", { dateStyle: "short", timeStyle: "short" })}</span>{a.note && <p className="text-muted">{a.note}</p>}</li>)}</ol>}
          </section>
        </div>
        <ActionForm action={reportAction} className="card h-fit space-y-3 p-5"><h2 className="text-lg">Take action</h2>
          <input type="hidden" name="id" value={r.id} />
          <Field label="Action" name="action" as="select" options={[
            { value: "reviewing", label: "Mark as reviewing (assign to me)" }, { value: "note", label: "Add a note only" },
            ...(canContent ? [{ value: "remove_content", label: "Remove the content" }] : []),
            ...(canUsers ? [{ value: "warn", label: "Warn the owner" }, { value: "restrict", label: "Restrict the owner (7 days)" }, { value: "suspend", label: "Suspend the owner" }, { value: "ban", label: "Ban the owner (re-authenticate)" }] : []),
            { value: "appealed", label: "Mark as appealed / follow-up" }, { value: "dismiss", label: "Dismiss: no violation" },
          ]} />
          <Field label="Notes / reason (shown to the user for content removals and account actions)" name="notes" as="textarea" rows={3} maxLength={500} />
          <SubmitButton variant={closed ? "secondary" : "primary"}>Apply</SubmitButton>
          <p className="text-xs text-muted">Consequential actions are audited with your name. Banning requires re-entering your password.</p>
        </ActionForm>
      </div>
    </>
  );
}
