import { eq } from "drizzle-orm";
import { requireUserPage } from "@/server/auth/guard";
import { ActionForm, Checkbox, Field, SubmitButton } from "@/components/ui/form";
import { Avatar } from "@/components/ui/kit";
import { updatePrivacyAction, unblockAction } from "../actions";
import { useDb, schema } from "@/server/db";

export const metadata = { title: "Privacy settings" };

export default async function PrivacySettings() {
  const u = await requireUserPage("/settings/privacy");
  const db = await useDb();
  const blocked = await db.select({ u: schema.users }).from(schema.blocks).innerJoin(schema.users, eq(schema.users.id, schema.blocks.blockedId)).where(eq(schema.blocks.blockerId, u.id));
  return (
    <>
      <ActionForm action={updatePrivacyAction} className="card space-y-4 p-5">
        <h2 className="text-lg">Profile privacy</h2>
        <Field label="Who can see my profile" name="profileVisibility" as="select" defaultValue={u.profileVisibility} options={[{ value: "public", label: "Everyone (searchable and indexable)" }, { value: "connections", label: "My connections only" }, { value: "private", label: "Only me" }]} />
        <Field label="Who can see my contact details" name="contactVisibility" as="select" defaultValue={u.contactVisibility} options={[{ value: "private", label: "Only me" }, { value: "connections", label: "My connections" }, { value: "public", label: "Anyone who can view my profile" }]} />
        <Checkbox name="discoverable" label="Suggest my profile to other people and show me in People search" defaultChecked={u.discoverable} />
        <p className="text-xs text-muted">Private and connections-only profiles are never listed in search engines or sitemaps.</p>
        <SubmitButton>Save</SubmitButton>
      </ActionForm>
      <section className="card p-5"><h2 className="text-lg">Blocked people</h2>
        {blocked.length === 0 ? <p className="mt-2 text-sm text-muted">You haven't blocked anyone.</p> : <ul className="mt-2 divide-y divide-line">{blocked.map(({ u: b }) => <li key={b.id} className="flex items-center gap-3 py-2"><Avatar name={b.displayName} src={b.avatarUrl} size={36} /><span className="flex-1 text-sm">{b.displayName}</span><form action={unblockAction}><input type="hidden" name="userId" value={b.id} /><button className="btn-secondary !min-h-[32px]">Unblock</button></form></li>)}</ul>}
      </section>
    </>
  );
}
