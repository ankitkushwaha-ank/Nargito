import Link from "next/link";
import { forgotAction } from "../actions";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { getT } from "@/i18n/server";
import { DevLink } from "./dev-link";

export const metadata = { title: "Forgot password" };

export default async function ForgotPage() {
  const t = await getT();
  return (
    <div>
      <h1 className="text-2xl">{t("auth.forgotTitle")}</h1>
      <p className="mt-1 text-sm text-muted">{t("auth.forgotSubtitle")}</p>
      <ActionForm action={forgotAction} className="mt-6 space-y-4">
        <Field label={t("auth.email")} name="email" type="email" required autoComplete="email" />
        <SubmitButton className="w-full">{t("auth.sendLink")}</SubmitButton>
        <DevLink />
      </ActionForm>
      <p className="mt-6 text-center text-sm"><Link href="/login" className="link">{t("auth.signInButton")}</Link></p>
    </div>
  );
}
