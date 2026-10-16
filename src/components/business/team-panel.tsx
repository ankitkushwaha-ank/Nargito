import Link from "next/link";
import { desc, eq, and } from "drizzle-orm";
import { useDb, schema } from "@/server/db";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Avatar, Badge } from "@/components/ui/kit";
import { addMemberAction, removeMemberAction, verificationRequestAction } from "@/app/(site)/my/actions";
import { canManageMembers } from "@/server/services/business";
import { ImagesField } from "@/components/ui/images-field";

export async function TeamPanel({ kind, entityId, role, members }: { kind: "company" | "shop"; entityId: string; role: string | null; members: { id: string; username: string; displayName: string; avatarUrl: string | null; role: string }[] }) {
  const manage = canManageMembers(role);
  return (
    <section className="card space-y-3 p-5" aria-labelledby="team-h">
      <h2 id="team-h" className="text-lg">Team & roles</h2>
      <p className="text-sm text-muted">Owners and admins manage the team. Editors can edit the page and listings. Viewers can only see private inbox items.</p>
      <ul className="divide-y divide-line">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2"><Avatar name={m.displayName} src={m.avatarUrl} size={36} /><div className="min-w-0 flex-1"><Link href={`/profile/${m.username}`} className="text-sm font-medium hover:underline">{m.displayName}</Link></div><Badge tone={m.role === "owner" ? "primary" : "muted"}>{m.role}</Badge>
            {manage && m.role !== "owner" && <form action={removeMemberAction}><input type="hidden" name="kind" value={kind} /><input type="hidden" name="entityId" value={entityId} /><input type="hidden" name="userId" value={m.id} /><button className="btn-ghost !min-h-[32px] text-danger">Remove</button></form>}</li>
        ))}
      </ul>
      {manage && (
        <ActionForm action={addMemberAction} className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end" resetOnSuccess>
          <input type="hidden" name="kind" value={kind} /><input type="hidden" name="entityId" value={entityId} />
          <Field label="Username" name="username" required placeholder="@username" />
          <Field label="Role" name="role" as="select" defaultValue="editor" options={[{ value: "viewer", label: "Viewer" }, { value: "editor", label: "Editor" }, { value: "admin", label: "Admin" }]} />
          <SubmitButton variant="secondary">Add member</SubmitButton>
        </ActionForm>
      )}
    </section>
  );
}

export async function VerificationPanel({ kind, entityId, verified, canRequest }: { kind: "company" | "shop"; entityId: string; verified: boolean; canRequest: boolean }) {
  const db = await useDb();
  const reqs = await db.select().from(schema.verificationRequests).where(and(eq(schema.verificationRequests.kind, kind), eq(schema.verificationRequests.entityId, entityId))).orderBy(desc(schema.verificationRequests.createdAt)).limit(3);
  const open = reqs.find((r) => r.status === "pending" || r.status === "more_info");
  return (
    <section className="card space-y-3 p-5" aria-labelledby="ver-h">
      <h2 id="ver-h" className="text-lg">Verification</h2>
      {verified ? <p className="text-sm"><Badge tone="success">Verified</Badge> This page shows a verified badge.</p> : <p className="text-sm text-muted">Verified pages build trust. Submit documents that show the business exists (registration, licence or utility bill). Only authorised reviewers can see them.</p>}
      {reqs.length > 0 && <ul className="space-y-1 text-sm">{reqs.map((r) => <li key={r.id}><Badge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warn"}>{r.status.replace("_", " ")}</Badge>{r.reviewerNote && <span className="ml-2 text-muted">{r.reviewerNote}</span>}</li>)}</ul>}
      {!verified && canRequest && !open && (
        <ActionForm action={verificationRequestAction} className="space-y-3">
          <input type="hidden" name="kind" value={kind} /><input type="hidden" name="entityId" value={entityId} />
          <Field label="Notes for the reviewer" name="note" as="textarea" rows={3} maxLength={1000} />
          <EvidenceUploader />
          <SubmitButton>Submit for review</SubmitButton>
        </ActionForm>
      )}
    </section>
  );
}

import { EvidenceUploader } from "@/components/business/evidence-uploader";
void ImagesField;
