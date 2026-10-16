import { cookies } from "next/headers";
import { verifyAction, verifyTokenAction, resendAction } from "../actions";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { getT } from "@/i18n/server";
import { Notice } from "@/components/ui/kit";
import { devOutboxEnabled } from "@/server/devbox";

export const metadata = { title: "Verify email" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const t = await getT();
  if (sp.token) {
    return (
      <div>
        <h1 className="text-2xl">{t("auth.verifyTitle")}</h1>
        <p className="mt-1 text-sm text-muted">Confirm to finish verifying your email address.</p>
        <ActionForm action={verifyTokenAction} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={sp.token} />
          <SubmitButton className="w-full">{t("auth.verifyButton")}</SubmitButton>
        </ActionForm>
      </div>
    );
  }
  const email = (sp.email ?? "").slice(0, 254);
  const devCode = devOutboxEnabled() ? (await cookies()).get("nargito_devcode")?.value : undefined;
  return (
    <div>
      <h1 className="text-2xl">{t("auth.verifyTitle")}</h1>
      <p className="mt-1 text-sm text-muted">{t("auth.verifySubtitle")} <b className="text-ink">{email || "your email"}</b></p>
      {devCode && (
        <div className="mt-4"><Notice tone="warn">Development mode: no email provider is configured, so the code is shown here: <b className="tracking-widest">{devCode}</b></Notice></div>
      )}
      <ActionForm action={verifyAction} className="mt-6 space-y-4">
        <input type="hidden" name="email" value={email} />
        <Field label={t("auth.code")} name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" />
        <SubmitButton className="w-full">{t("auth.verifyButton")}</SubmitButton>
      </ActionForm>
      <ActionForm action={resendAction} className="mt-4">
        <input type="hidden" name="email" value={email} />
        <SubmitButton variant="ghost" className="w-full">{t("auth.resend")}</SubmitButton>
      </ActionForm>
    </div>
  );
}
