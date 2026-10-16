import { requireUserPage } from "@/server/auth/guard";
import { Container } from "@/components/shell/frames";
import { FeatureGate } from "@/components/ui/feature-gate";
import { PageHeader } from "@/components/ui/kit";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { ImageField } from "@/components/ui/image-field";
import { createGroupAction } from "../../my/actions";
import { categoryNames } from "@/server/services/listings";

export const metadata = { title: "Create a group" };

export default async function NewGroup() {
  await requireUserPage("/groups/new");
  const cats = await categoryNames("group");
  return (
    <FeatureGate feature="groups">
      <Container width="max-w-xl">
        <PageHeader title="Create a group" />
        <ActionForm action={createGroupAction} className="card space-y-4 p-5">
          <Field label="Group name" name="name" required maxLength={80} />
          <Field label="Description" name="description" as="textarea" rows={4} maxLength={2000} />
          <Field label="Category" name="category" as="select" options={[{ value: "", label: "Select…" }, ...cats.map((c) => ({ value: c, label: c }))]} />
          <Field label="Visibility" name="visibility" as="select" defaultValue="public" options={[{ value: "public", label: "Public: anyone can join and read" }, { value: "private", label: "Private: members approved by admins" }]} />
          <ImageField name="coverUrl" label="Cover image" shape="wide" />
          <SubmitButton>Create group</SubmitButton>
        </ActionForm>
      </Container>
    </FeatureGate>
  );
}
