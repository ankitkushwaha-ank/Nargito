import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUserPage } from "@/server/auth/guard";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { PageHeader } from "@/components/ui/kit";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { ImagesField } from "@/components/ui/images-field";
import { saveServiceAction } from "../../../actions";
import { canManageService, categoryNames } from "@/server/services/listings";
import { myBusinesses } from "@/server/services/business";
import { useDb, schema } from "@/server/db";
import { CURRENCIES } from "@/lib/constants";

export const metadata = { title: "Service listing" };

export default async function ServiceForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserPage(`/my/listings/service/${id}`);
  const isNew = id === "new";
  const db = await useDb();
  const s = isNew ? null : (await db.select().from(schema.services).where(eq(schema.services.id, /^[0-9a-f-]{36}$/i.test(id) ? id : "00000000-0000-0000-0000-000000000000")))[0];
  if (!isNew && (!s || s.status === "removed" || !(await canManageService(user.id, s)))) notFound();
  const [cats, biz] = await Promise.all([categoryNames("service"), myBusinesses(user.id)]);
  return (
    <FeatureGate feature="services">
      <Container width="max-w-2xl">
        <PageHeader title={isNew ? "Offer a service" : "Edit service"} />
        <ActionForm action={saveServiceAction} className="card space-y-4 p-5">
          {s && <input type="hidden" name="id" value={s.id} />}
          <Field label="Title" name="title" required defaultValue={s?.title} maxLength={120} />
          <Field label="Description" name="description" as="textarea" rows={6} defaultValue={s?.description} maxLength={5000} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" name="category" as="select" defaultValue={s?.category ?? ""} options={[{ value: "", label: "Select…" }, ...cats.map((c) => ({ value: c, label: c }))]} />
            <Field label="Service area" name="serviceArea" defaultValue={s?.serviceArea} maxLength={120} placeholder="e.g. Pune and online" />
            <Field label="Pricing model" name="pricingModel" as="select" defaultValue={s?.pricingModel ?? "fixed"} options={[{ value: "fixed", label: "Fixed price" }, { value: "hourly", label: "Per hour" }, { value: "quote", label: "Quote on request" }]} />
            <Field label="Starting price" name="startingPrice" type="number" min={0} step="0.01" defaultValue={s?.startingPrice} />
            <Field label="Currency" name="currency" as="select" defaultValue={s?.currency ?? "INR"} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
            <Field label="Status" name="status" as="select" defaultValue={s?.status ?? "active"} options={[{ value: "active", label: "Published" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }]} />
          </div>
          <Field label="Availability" name="availability" defaultValue={s?.availability} maxLength={200} placeholder="e.g. Weekdays 10:00-18:00" />
          {biz.companies.length > 0 && <Field label="Link to company" name="companyId" as="select" defaultValue={s?.companyId ?? ""} options={[{ value: "", label: "None" }, ...biz.companies.filter((c) => c.role !== "viewer").map(({ c }) => ({ value: c.id, label: c.name }))]} />}
          <ImagesField label="Portfolio images" initial={s?.images ?? []} />
          <SubmitButton>{isNew ? "Create service" : "Save changes"}</SubmitButton>
        </ActionForm>
      </Container>
    </FeatureGate>
  );
}
