"use client";
import Link from "next/link";
import { loginAction } from "../actions";
import { ActionForm, Field, SubmitButton, useFormState } from "@/components/ui/form";
import { useT } from "@/i18n/client";

function MfaField() {
  const s = useFormState();
  const t = useT();
  if (!(s?.data as { mfa?: boolean } | undefined)?.mfa) return null;
  return <Field label={t("auth.mfaCode")} name="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />;
}

export function LoginForm({ next }: { next?: string }) {
  const t = useT();
  return (
    <ActionForm action={loginAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label={t("auth.email")} name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
      <Field label={t("auth.password")} name="password" type="password" required autoComplete="current-password" placeholder="Enter your password" />
      <MfaField />
      <div className="flex justify-end"><Link href="/forgot-password" className="link text-sm">{t("auth.forgot")}</Link></div>
      <SubmitButton className="w-full !min-h-[50px] text-base" pendingLabel={t("common.loading")}>{t("auth.signInButton")}</SubmitButton>
    </ActionForm>
  );
}
