import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUserPage } from "@/server/auth/guard";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { PageHeader } from "@/components/ui/kit";
import { ActionForm, Field, SubmitButton, ConfirmSubmit } from "@/components/ui/form";
import { ImageField } from "@/components/ui/image-field";
import { saveShopAction, deleteBusinessAction } from "../../../actions";
import { categoryNames, memberRole } from "@/server/services/listings";
import { canEdit, canManageMembers, myBusinesses } from "@/server/services/business";
import { useDb, schema } from "@/server/db";
import { TeamPanel, VerificationPanel } from "@/components/business/team-panel";

export const metadata = { title: "Shop" };

export default async function ShopEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserPage(`/my/businesses/shop/${id}`);
  const isNew = id === "new";
  const db = await useDb();
  const s = isNew ? null : (await db.select().from(schema.shops).where(eq(schema.shops.id, /^[0-9a-f-]{36}$/i.test(id) ? id : "00000000-0000-0000-0000-000000000000")))[0];
  const role = s ? await memberRole("shop", s.id, user.id) : null;
  if (!isNew && (!s || !canEdit(role) || s.status === "removed")) notFound();
  const [cats, biz, members] = await Promise.all([
    categoryNames("shop"), myBusinesses(user.id),
    s ? db.select({ id: schema.users.id, username: schema.users.username, displayName: schema.users.displayName, avatarUrl: schema.users.avatarUrl, role: schema.shopMembers.role }).from(schema.shopMembers).innerJoin(schema.users, eq(schema.users.id, schema.shopMembers.userId)).where(eq(schema.shopMembers.shopId, s.id)) : Promise.resolve([]),
  ]);
  return (
    <FeatureGate feature="shops">
      <Container width="max-w-3xl">
        <PageHeader title={isNew ? "Open a shop" : `Manage ${s!.name}`} actions={s && <><Link href="/my/listings/product/new" className="btn-primary">Add product</Link><Link href="/my/listings" className="btn-secondary">Catalogue</Link></>} />
        <div className="space-y-5">
          <ActionForm action={saveShopAction} className="card space-y-4 p-5">
            {s && <input type="hidden" name="id" value={s.id} />}
            <div className="grid gap-4 sm:grid-cols-2"><ImageField name="logoUrl" label="Logo" initial={s?.logoUrl} /><ImageField name="coverUrl" label="Cover" shape="wide" initial={s?.coverUrl} /></div>
            <Field label="Shop name" name="name" required defaultValue={s?.name} maxLength={100} />
            <Field label="Description" name="description" as="textarea" rows={5} defaultValue={s?.description} maxLength={5000} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business category" name="category" as="select" defaultValue={s?.category ?? ""} options={[{ value: "", label: "Select…" }, ...cats.map((x) => ({ value: x, label: x }))]} />
              <Field label="General location" name="locationLabel" defaultValue={s?.locationLabel} maxLength={100} />
              <Field label="Service area" name="serviceArea" defaultValue={s?.serviceArea} maxLength={120} />
              <Field label="Contact preference" name="contactPreference" as="select" defaultValue={s?.contactPreference ?? "enquiry"} options={[{ value: "enquiry", label: "Through Nargito enquiries" }, { value: "phone", label: "Phone" }, { value: "email", label: "Email" }]} />
              {biz.companies.length > 0 && <Field label="Part of company" name="companyId" as="select" defaultValue={s?.companyId ?? ""} options={[{ value: "", label: "None" }, ...biz.companies.filter((c) => c.role !== "viewer").map(({ c }) => ({ value: c.id, label: c.name }))]} />}
            </div>
            <Field label="Operating hours" name="hours" as="textarea" rows={3} defaultValue={s?.hours} maxLength={300} placeholder={"Mon-Sat 9:00-18:00\nSun closed"} />
            <SubmitButton>{isNew ? "Open shop" : "Save changes"}</SubmitButton>
          </ActionForm>
          {s && (<>
            <TeamPanel kind="shop" entityId={s.id} role={role} members={members} />
            <VerificationPanel kind="shop" entityId={s.id} verified={s.verified} canRequest={canManageMembers(role)} />
            {role === "owner" && <form action={deleteBusinessAction} className="card flex items-center justify-between gap-3 p-5"><div><h2 className="text-base">Hide this shop</h2><p className="text-sm text-muted">Removes it from public view.</p></div><input type="hidden" name="kind" value="shop" /><input type="hidden" name="id" value={s.id} /><ConfirmSubmit message="Hide this shop from public view?">Hide shop</ConfirmSubmit></form>}
          </>)}
        </div>
      </Container>
    </FeatureGate>
  );
}
