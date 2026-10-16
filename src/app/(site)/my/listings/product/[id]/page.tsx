import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUserPage } from "@/server/auth/guard";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { PageHeader } from "@/components/ui/kit";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { ImagesField } from "@/components/ui/images-field";
import { saveProductAction } from "../../../actions";
import { canManageProduct, categoryNames } from "@/server/services/listings";
import { myBusinesses } from "@/server/services/business";
import { useDb, schema } from "@/server/db";
import { CURRENCIES } from "@/lib/constants";

export const metadata = { title: "Product listing" };

export default async function ProductForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserPage(`/my/listings/product/${id}`);
  const isNew = id === "new";
  const db = await useDb();
  const p = isNew ? null : (await db.select().from(schema.products).where(eq(schema.products.id, /^[0-9a-f-]{36}$/i.test(id) ? id : "00000000-0000-0000-0000-000000000000")))[0];
  if (!isNew && (!p || p.status === "removed" || !(await canManageProduct(user.id, p)))) notFound();
  const [cats, biz] = await Promise.all([categoryNames("product"), myBusinesses(user.id)]);
  return (
    <FeatureGate feature="products">
      <Container width="max-w-2xl">
        <PageHeader title={isNew ? "List a product" : "Edit product"} description="Buyers contact you through enquiries. Nargito does not process payments." />
        <ActionForm action={saveProductAction} className="card space-y-4 p-5">
          {p && <input type="hidden" name="id" value={p.id} />}
          <Field label="Title" name="title" required defaultValue={p?.title} maxLength={120} />
          <Field label="Description" name="description" as="textarea" rows={6} defaultValue={p?.description} maxLength={5000} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" name="category" as="select" defaultValue={p?.category ?? ""} options={[{ value: "", label: "Select…" }, ...cats.map((c) => ({ value: c, label: c }))]} />
            <Field label="Condition" name="condition" as="select" defaultValue={p?.condition ?? ""} options={[{ value: "", label: "Not applicable" }, { value: "new", label: "New" }, { value: "like_new", label: "Like new" }, { value: "used", label: "Used" }]} />
            <Field label="Price" name="price" type="number" min={0} step="0.01" defaultValue={p?.price} help="Leave empty for price on enquiry" />
            <Field label="Currency" name="currency" as="select" defaultValue={p?.currency ?? "INR"} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
            <Field label="Availability" name="availability" as="select" defaultValue={p?.availability ?? "in_stock"} options={[{ value: "in_stock", label: "In stock" }, { value: "limited", label: "Limited" }, { value: "out_of_stock", label: "Out of stock" }]} />
            <Field label="Status" name="status" as="select" defaultValue={p?.status ?? "active"} options={[{ value: "active", label: "Published" }, { value: "draft", label: "Draft" }, { value: "sold", label: "Sold" }, { value: "archived", label: "Archived" }]} />
          </div>
          <Field label="Approximate location (city or area)" name="locationLabel" defaultValue={p?.locationLabel} maxLength={80} help="Shown publicly. Never your exact address." />
          {biz.shops.length > 0 && <Field label="Sell as shop" name="shopId" as="select" defaultValue={p?.shopId ?? ""} options={[{ value: "", label: "Myself" }, ...biz.shops.filter((s) => s.role !== "viewer").map(({ s }) => ({ value: s.id, label: s.name }))]} />}
          {biz.companies.length > 0 && <Field label="Link to company" name="companyId" as="select" defaultValue={p?.companyId ?? ""} options={[{ value: "", label: "None" }, ...biz.companies.filter((c) => c.role !== "viewer").map(({ c }) => ({ value: c.id, label: c.name }))]} />}
          <ImagesField initial={p?.images ?? []} />
          <SubmitButton>{isNew ? "Create listing" : "Save changes"}</SubmitButton>
        </ActionForm>
      </Container>
    </FeatureGate>
  );
}
