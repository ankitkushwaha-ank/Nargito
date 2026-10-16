import { requireAdminPage } from "@/server/auth/guard";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { stepUpAction } from "@/app/(site)/settings/actions";
import { AdminTitle } from "@/components/admin/admin-ui";

export const metadata = { title: "Confirm your identity" };

export default async function StepUp({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireAdminPage();
  const next = (await searchParams).next ?? "/admin";
  return (
    <div className="mx-auto max-w-md">
      <AdminTitle title="Confirm your identity" description="This action is sensitive. Re-enter your password to continue. The confirmation lasts 10 minutes." />
      <ActionForm action={stepUpAction} className="card space-y-4 p-5">
        <input type="hidden" name="next" value={next.startsWith("/admin") ? next : "/admin"} />
        <Field label="Password" name="password" type="password" required autoComplete="current-password" />
        {user.mfaEnabled && <Field label="Authentication code" name="code" inputMode="numeric" maxLength={6} required autoComplete="one-time-code" />}
        {!user.mfaEnabled && <p className="text-xs text-warn">Tip: turn on two-factor authentication in Settings &gt; Security to protect this account.</p>}
        <SubmitButton>Confirm</SubmitButton>
      </ActionForm>
    </div>
  );
}
