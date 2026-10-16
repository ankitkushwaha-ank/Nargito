import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "./register-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import { getT } from "@/i18n/server";
import { getSessionUser } from "@/server/auth/session";
import { getSetting } from "@/server/settings";
import { Notice } from "@/components/ui/kit";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await getSessionUser()) redirect("/home");
  const t = await getT();
  const open = await getSetting<boolean>("registration.enabled");
  return (
    <div>
      <h1 className="text-center text-3xl font-extrabold">{t("auth.registerTitle")}</h1>
      <p className="mt-1 text-center text-[15px] text-muted">{t("auth.registerSubtitle")}</p>
      {!open ? (
        <div className="mt-6"><Notice tone="warn">Registration is currently closed. Please check back later.</Notice></div>
      ) : (
        <>
          <div className="mt-6"><RegisterForm /></div>
          <SocialButtons />
        </>
      )}
      <p className="mt-6 text-center text-sm text-muted">{t("auth.haveAccount")} <Link href="/login" className="link font-medium">{t("auth.signInButton")}</Link></p>
    </div>
  );
}
