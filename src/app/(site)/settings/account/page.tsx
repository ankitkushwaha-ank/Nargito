import { and, eq } from "drizzle-orm";
import { requireUserPage } from "@/server/auth/guard";
import { ActionForm, Field, SubmitButton, ConfirmSubmit } from "@/components/ui/form";
import { Badge } from "@/components/ui/kit";
import { changePasswordAction, requestDataAction, cancelDeletionAction } from "../actions";
import { useDb, schema } from "@/server/db";
import { formatDate } from "@/lib/format";
import { getLocale } from "@/i18n/server";

export const metadata = { title: "Account settings" };

export default async function AccountSettings() {
  const u = await requireUserPage("/settings/account");
  const db = await useDb();
  const reqs = await db.select().from(schema.dataRequests).where(eq(schema.dataRequests.userId, u.id)).orderBy(schema.dataRequests.createdAt);
  const deletion = reqs.find((r) => r.type === "deletion" && r.status === "pending");
  const locale = await getLocale();
  void and;
  return (
    <>
      <section className="card space-y-2 p-5"><h2 className="text-lg">Account</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted">Email</dt><dd>{u.email} {u.emailVerifiedAt ? <Badge tone="success">verified</Badge> : <Badge tone="warn">unverified</Badge>}</dd></div><div><dt className="text-muted">Username</dt><dd>@{u.username}</dd></div><div><dt className="text-muted">Member since</dt><dd>{formatDate(u.createdAt, locale)}</dd></div><div><dt className="text-muted">Status</dt><dd className="capitalize">{u.status}</dd></div></dl>
      </section>
      {u.passwordHash ? (
        <ActionForm action={changePasswordAction} className="card space-y-4 p-5">
          <h2 className="text-lg">Change password</h2>
          <Field label="Current password" name="current" type="password" required autoComplete="current-password" />
          <Field label="New password" name="password" type="password" required autoComplete="new-password" help="At least 10 characters with letters and a number." />
          <Field label="Confirm new password" name="confirm" type="password" required autoComplete="new-password" />
          <SubmitButton>Update password</SubmitButton>
        </ActionForm>
      ) : <section className="card p-5 text-sm text-muted">Your account uses social sign-in. Use “Forgot password” on the login page to set a password.</section>}
      <section className="card space-y-3 p-5"><h2 className="text-lg">Your data</h2>
        <p className="text-sm text-muted">Request a copy of your data, or permanently delete your account. Deletion starts a 7-day grace period; you can cancel any time before it completes.</p>
        <div className="flex flex-wrap gap-2">
          <form action={requestDataAction}><input type="hidden" name="type" value="export" /><button className="btn-secondary">Request data export</button></form>
          {deletion ? <form action={cancelDeletionAction}><button className="btn-secondary">Cancel deletion request</button></form> : <form action={requestDataAction}><input type="hidden" name="type" value="deletion" /><ConfirmSubmit message="Request permanent deletion of your account? You have 7 days to cancel.">Delete my account</ConfirmSubmit></form>}
        </div>
        {reqs.length > 0 && <ul className="text-sm text-muted">{reqs.slice(-4).map((r) => <li key={r.id}>{r.type} request · {r.status} · {formatDate(r.createdAt, locale)}{r.status === "done" && r.type === "export" && r.resultPath ? <> · <a className="link" href="/api/account/export">Download</a></> : null}</li>)}</ul>}
      </section>
    </>
  );
}
