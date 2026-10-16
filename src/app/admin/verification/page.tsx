import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { AdminTitle } from "@/components/admin/admin-ui";
import { Badge, EmptyState } from "@/components/ui/kit";
import { formatDate } from "@/lib/format";
import { decideVerificationAction } from "./actions";
import { cn } from "@/lib/cn";
import { FeatureGate } from "@/components/ui/feature-gate";

export const metadata = { title: "Verification" };

export default async function VerificationAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await adminPage("verification.manage");
  const sp = await searchParams;
  const status = ["pending", "more_info", "approved", "rejected"].includes(sp.status ?? "") ? sp.status! : "pending";
  const db = await useDb();
  const rows = await db.select({ r: schema.verificationRequests, u: schema.users }).from(schema.verificationRequests).innerJoin(schema.users, eq(schema.users.id, schema.verificationRequests.userId)).where(eq(schema.verificationRequests.status, status)).orderBy(desc(schema.verificationRequests.createdAt)).limit(50);
  const media = rows.flatMap(({ r }) => r.evidenceMediaIds);
  const mrows = media.length ? await db.select().from(schema.media).where(inArray(schema.media.id, media)) : [];
  const names = new Map<string, string>();
  for (const { r } of rows) {
    if (r.kind === "company" && r.entityId) { const [c] = await db.select({ n: schema.companies.name }).from(schema.companies).where(eq(schema.companies.id, r.entityId)); if (c) names.set(r.id, c.n); }
    if (r.kind === "shop" && r.entityId) { const [c] = await db.select({ n: schema.shops.name }).from(schema.shops).where(eq(schema.shops.id, r.entityId)); if (c) names.set(r.id, c.n); }
  }
  return (
    <FeatureGate feature="verification">
      <AdminTitle title="Verification requests" description="Evidence files are private: they are served only to the requester and to reviewers with this permission. Decisions are audited and the requester is notified." />
      <nav className="mb-4 flex gap-1" aria-label="Status">{["pending", "more_info", "approved", "rejected"].map((s) => <Link key={s} href={`/admin/verification?status=${s}`} className={cn("rounded-full border border-line px-3 py-1 text-sm capitalize", status === s ? "bg-primary text-white" : "bg-surface text-muted")}>{s.replace("_", " ")}</Link>)}</nav>
      {rows.length === 0 ? <EmptyState title={`No ${status.replace("_", " ")} requests`} /> : (
        <ul className="space-y-4">{rows.map(({ r, u }) => (
          <li key={r.id} className="card space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium"><Badge>{r.kind}</Badge> {names.get(r.id) ?? u.displayName}</p><p className="text-sm text-muted">Requested by <Link className="link" href={`/admin/users/${u.id}`}>{u.displayName}</Link> · {formatDate(r.createdAt, "en", { dateStyle: "medium", timeStyle: "short" })}</p></div><Badge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warn"}>{r.status.replace("_", " ")}</Badge></div>
            {r.note && <p className="rounded-lg bg-bg p-3 text-sm">{r.note}</p>}
            <div className="flex flex-wrap gap-2">{r.evidenceMediaIds.map((id, i) => { const m = mrows.find((x) => x.id === id); return <a key={id} href={`/api/media/${id}`} target="_blank" rel="noopener noreferrer" className="btn-secondary !min-h-[32px]">Evidence {i + 1}{m ? ` (${m.kind})` : ""}</a>; })}{r.evidenceMediaIds.length === 0 && <span className="text-sm text-muted">No files attached.</span>}</div>
            {(r.status === "pending" || r.status === "more_info") && (
              <form action={decideVerificationAction} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-[1fr_1fr_auto]"><input type="hidden" name="id" value={r.id} />
                <div><label className="label" htmlFor={`rc-${r.id}`}>Reason code (for rejections / info requests)</label><select id={`rc-${r.id}`} name="reasonCode" className="input"><option value="">None</option><option value="document_unclear">Document unclear</option><option value="document_mismatch">Document does not match</option><option value="insufficient_evidence">Insufficient evidence</option><option value="suspected_fraud">Suspected fraud</option><option value="other">Other</option></select></div>
                <div><label className="label" htmlFor={`rn-${r.id}`}>Message to requester</label><input id={`rn-${r.id}`} name="note" className="input" maxLength={500} /></div>
                <div className="flex items-end gap-1"><button name="decision" value="approved" className="btn-primary">Approve</button><button name="decision" value="more_info" className="btn-secondary">Ask for info</button><button name="decision" value="rejected" className="btn-danger">Reject</button></div>
              </form>
            )}
            {r.decidedAt && <p className="text-xs text-muted">Decided {formatDate(r.decidedAt, "en", { dateStyle: "medium", timeStyle: "short" })}{r.reasonCode ? ` · ${r.reasonCode}` : ""}{r.reviewerNote ? ` · ${r.reviewerNote}` : ""}</p>}
          </li>
        ))}</ul>
      )}
    </FeatureGate>
  );
}
