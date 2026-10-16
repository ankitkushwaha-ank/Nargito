import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUserPage } from "@/server/auth/guard";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { PageHeader } from "@/components/ui/kit";
import { ActionForm, Checkbox, Field, SubmitButton } from "@/components/ui/form";
import { ImageField } from "@/components/ui/image-field";
import { ItineraryField } from "@/components/ui/itinerary-field";
import { saveTripAction } from "../../actions";
import { categoryNames } from "@/server/services/listings";
import { useDb, schema } from "@/server/db";
import { CURRENCIES } from "@/lib/constants";

export const metadata = { title: "Trip" };

export default async function TripForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserPage(`/my/trips/${id}`);
  const isNew = id === "new";
  const db = await useDb();
  const t = isNew ? null : (await db.select().from(schema.trips).where(and(eq(schema.trips.id, /^[0-9a-f-]{36}$/i.test(id) ? id : "00000000-0000-0000-0000-000000000000"), eq(schema.trips.ownerId, user.id))))[0];
  if (!isNew && (!t || t.status === "removed")) notFound();
  const items = t ? await db.select().from(schema.tripItinerary).where(eq(schema.tripItinerary.tripId, t.id)).orderBy(schema.tripItinerary.day, schema.tripItinerary.position) : [];
  const cats = await categoryNames("trip");
  const statuses = t?.status === "completed" ? ["completed"] : ["draft", "published", "cancelled", ...(t?.status === "published" ? ["completed"] : [])];
  return (
    <FeatureGate feature="trips">
      <Container width="max-w-2xl">
        <PageHeader title={isNew ? "Share a trip" : "Edit trip"} description="Private itinerary items are only shown to participants you confirm. Your live location is never shared." />
        <ActionForm action={saveTripAction} className="card space-y-4 p-5">
          {t && <input type="hidden" name="id" value={t.id} />}
          <Field label="Title" name="title" required defaultValue={t?.title} maxLength={120} />
          <Field label="Description" name="description" as="textarea" rows={5} defaultValue={t?.description} maxLength={5000} />
          <ImageField name="coverUrl" label="Cover image" shape="wide" initial={t?.coverUrl} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starting area" name="originArea" defaultValue={t?.originArea} maxLength={80} />
            <Field label="Destination" name="destination" required defaultValue={t?.destination} maxLength={120} />
            <Field label="Start date" name="startDate" type="date" defaultValue={t?.startDate} />
            <Field label="End date" name="endDate" type="date" defaultValue={t?.endDate} />
            <Field label="Trip type" name="category" as="select" defaultValue={t?.category ?? ""} options={[{ value: "", label: "Select…" }, ...cats.map((c) => ({ value: c, label: c }))]} />
            <Field label="Participant slots" name="slots" type="number" min={1} defaultValue={t?.slots} help="Leave empty for unlimited" />
            <Field label="Approx. budget from" name="budgetMin" type="number" min={0} defaultValue={t?.budgetMin} />
            <Field label="Approx. budget to" name="budgetMax" type="number" min={0} defaultValue={t?.budgetMax} />
            <Field label="Currency" name="currency" as="select" defaultValue={t?.currency ?? "INR"} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
            <Field label="Visibility" name="visibility" as="select" defaultValue={t?.visibility ?? "public"} options={[{ value: "public", label: "Public" }, { value: "connections", label: "Connections only" }, { value: "private", label: "Only me" }]} />
          </div>
          <Field label="Travel preferences" name="preferences" as="textarea" rows={2} defaultValue={t?.preferences} maxLength={1000} placeholder="Pace, accommodation, fitness level…" />
          <Checkbox name="requireApproval" label="I approve each participant request" defaultChecked={t?.requireApproval ?? true} />
          <ItineraryField initial={items.map((i) => ({ day: i.day, title: i.title, details: i.details ?? "", isPrivate: i.isPrivate }))} />
          <Field label="Status" name="status" as="select" defaultValue={t?.status ?? "draft"} options={statuses.map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))} />
          <SubmitButton>{isNew ? "Save trip" : "Save changes"}</SubmitButton>
        </ActionForm>
      </Container>
    </FeatureGate>
  );
}
