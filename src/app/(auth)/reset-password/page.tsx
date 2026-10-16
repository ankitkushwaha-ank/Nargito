import Link from "next/link";
import { resetAction } from "../actions";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { getT } from "@/i18n/server";
import { Notice } from "@/components/ui/kit";

export const metadata = { title: "Reset password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { token } = await searchParams;
  const t = await getT();
  if (!token) return <div className="space-y-4"><Notice tone="danger">This reset link is missing or invalid.</Notice><Link className="link" href="/forgot-password">Request a new link</Link></div>;
  return (
    <div>
      <h1 className="text-2xl">{t("auth.resetTitle")}</h1>
      <ActionForm action={resetAction} className="mt-6 space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label={t("auth.newPassword")} name="password" type="password" required autoComplete="new-password" help="At least 10 characters with letters and a number." />
        <Field label="Confirm password" name="confirm" type="password" required autoComplete="new-password" />
        <SubmitButton className="w-full">{t("auth.resetButton")}</SubmitButton>
      </ActionForm>
    </div>
  );
}
