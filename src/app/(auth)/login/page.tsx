import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import { getT } from "@/i18n/server";
import { getSessionUser } from "@/server/auth/session";
import { safeRedirectPath } from "@/server/util";
import { Notice } from "@/components/ui/kit";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = sp.next ? safeRedirectPath(sp.next, "") : "";
  if (await getSessionUser()) redirect(next || "/home");
  const t = await getT();
  return (
    <div>
      <h1 className="text-2xl">{t("auth.signInTitle")}</h1>
      <p className="mt-1 text-sm text-muted">{t("auth.signInSubtitle")}</p>
      <div className="mt-5 space-y-3">
        {sp.reset && <Notice tone="success">Password updated. Sign in with your new password.</Notice>}
        {sp.signedout && <Notice>You have been signed out.</Notice>}
        {sp.error && <Notice tone="danger">{sp.error.slice(0, 200)}</Notice>}
      </div>
      <div className="mt-6"><LoginForm next={next} /></div>
      <SocialButtons next={next} />
      <p className="mt-6 text-center text-sm text-muted">{t("auth.noAccount")} <Link href="/register" className="link font-medium">{t("nav.join")}</Link></p>
      <p className="mt-6 text-center text-xs text-muted">
        <Link href="/terms" className="hover:underline">{t("footer.terms")}</Link> · <Link href="/privacy" className="hover:underline">{t("footer.privacy")}</Link>
      </p>
    </div>
  );
}
