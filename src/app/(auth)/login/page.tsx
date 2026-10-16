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
      <h1 className="text-center text-3xl font-extrabold">{t("auth.signInTitle")}</h1>
      <p className="mt-1 text-center text-[15px] text-muted">Sign in to continue to Nargito</p>
      <div className="mt-5 space-y-3">
        {sp.reset && <Notice tone="success">Password updated. Sign in with your new password.</Notice>}
        {sp.signedout && <Notice>You have been signed out.</Notice>}
        {sp.error && <Notice tone="danger">{sp.error.slice(0, 200)}</Notice>}
      </div>
      <div className="mt-6"><LoginForm next={next} /></div>
      <SocialButtons next={next} />
      <p className="mt-6 text-center text-sm text-muted lg:hidden">{t("auth.noAccount")} <Link href="/register" className="link font-medium">{t("nav.join")}</Link></p>
      <p className="mt-5 text-center text-xs text-muted">By continuing, you agree to our <Link href="/terms" className="link">Terms of Service</Link> and <Link href="/privacy" className="link">Privacy Policy</Link>.</p>
    </div>
  );
}
