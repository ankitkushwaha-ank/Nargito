import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUserPage } from "@/server/auth/guard";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { PageHeader } from "@/components/ui/kit";
import { ActionForm, Field, SubmitButton, ConfirmSubmit } from "@/components/ui/form";
import { ImageField } from "@/components/ui/image-field";
import { saveCompanyAction, deleteBusinessAction } from "../../../actions";
import { categoryNames, memberRole } from "@/server/services/listings";
import { canEdit, canManageMembers } from "@/server/services/business";
import { useDb, schema } from "@/server/db";
import { TeamPanel, VerificationPanel } from "@/components/business/team-panel";

export const metadata = { title: "Company" };

export default async function CompanyEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserPage(`/my/businesses/company/${id}`);
  const isNew = id === "new";
  const db = await useDb();
  const c = isNew ? null : (await db.select().from(schema.companies).where(eq(schema.companies.id, /^[0-9a-f-]{36}$/i.test(id) ? id : "00000000-0000-0000-0000-000000000000")))[0];
  const role = c ? await memberRole("company", c.id, user.id) : null;
  if (!isNew && (!c || !canEdit(role) || c.status === "removed")) notFound();
  const [cats, members] = await Promise.all([
    categoryNames("company"),
    c ? db.select({ id: schema.users.id, username: schema.users.username, displayName: schema.users.displayName, avatarUrl: schema.users.avatarUrl, role: schema.companyMembers.role }).from(schema.companyMembers).innerJoin(schema.users, eq(schema.users.id, schema.companyMembers.userId)).where(eq(schema.companyMembers.companyId, c.id)) : Promise.resolve([]),
  ]);
  return (
    <FeatureGate feature="companies">
      <Container width="max-w-3xl">
        <PageHeader title={isNew ? "Create a company page" : `Manage ${c!.name}`} />
        <div className="space-y-5">
          <ActionForm action={saveCompanyAction} className="card space-y-4 p-5">
            {c && <input type="hidden" name="id" value={c.id} />}
            <div className="grid gap-4 sm:grid-cols-2"><ImageField name="logoUrl" label="Logo" initial={c?.logoUrl} /><ImageField name="coverUrl" label="Cover" shape="wide" initial={c?.coverUrl} /></div>
            <Field label="Company name" name="name" required defaultValue={c?.name} maxLength={100} />
            <Field label="Tagline" name="tagline" defaultValue={c?.tagline} maxLength={140} />
            <Field label="Description" name="description" as="textarea" rows={5} defaultValue={c?.description} maxLength={5000} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Industry" name="industry" as="select" defaultValue={c?.industry ?? ""} options={[{ value: "", label: "Select…" }, ...cats.map((x) => ({ value: x, label: x }))]} />
              <Field label="General location" name="locationLabel" defaultValue={c?.locationLabel} maxLength={100} placeholder="City, State" />
              <Field label="Website" name="website" type="url" defaultValue={c?.website} placeholder="https://" />
              <Field label="Public email" name="publicEmail" type="email" defaultValue={c?.publicEmail} />
              <Field label="Public phone" name="publicPhone" defaultValue={c?.publicPhone} maxLength={30} />
            </div>
            <p className="text-xs text-muted">Only the contact details you enter here are shown publicly.</p>
            <SubmitButton>{isNew ? "Create company" : "Save changes"}</SubmitButton>
          </ActionForm>
          {c && (<>
            <TeamPanel kind="company" entityId={c.id} role={role} members={members} />
            <VerificationPanel kind="company" entityId={c.id} verified={c.verified} canRequest={canManageMembers(role)} />
            {role === "owner" && <form action={deleteBusinessAction} className="card flex items-center justify-between gap-3 p-5"><div><h2 className="text-base">Hide this page</h2><p className="text-sm text-muted">Removes it from public view. Contact support to restore.</p></div><input type="hidden" name="kind" value="company" /><input type="hidden" name="id" value={c.id} /><ConfirmSubmit message="Hide this company page from public view?">Hide page</ConfirmSubmit></form>}
          </>)}
        </div>
      </Container>
    </FeatureGate>
  );
}
