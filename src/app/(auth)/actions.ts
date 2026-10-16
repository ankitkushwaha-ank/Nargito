"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { run, type SAResult } from "@/server/action";
import { loginUser, registerUser, resendVerification, requestPasswordReset, resetPassword, verifyEmailCode, verifyEmailToken } from "@/server/auth/service";
import { destroyCurrentSession } from "@/server/auth/session";
import { formToObject } from "@/server/validation";
import { safeRedirectPath, fail } from "@/server/util";
import { audit } from "@/server/log";
import { getSessionUser } from "@/server/auth/session";

export async function loginAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const r = await loginUser({ email: String(fd.get("email") ?? ""), password: String(fd.get("password") ?? ""), totp: String(fd.get("totp") ?? "") || undefined });
    if (!r.ok) return r;
    if (r.data?.mfaRequired) return { ok: false, error: "Enter the 6-digit code from your authenticator app.", fieldErrors: { totp: "Required" }, data: { mfa: true } };
    redirect(safeRedirectPath(fd.get("next"), "/home"));
  });
}

export async function registerAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const r = await registerUser(formToObject(fd));
    if (!r.ok) return r;
    if (r.data?.instant) redirect(r.data.business ? "/onboarding?type=business" : "/onboarding");
    const jar = await cookies();
    if (r.data?.devCode) jar.set("nargito_devcode", r.data.devCode, { httpOnly: true, maxAge: 900, path: "/verify-otp", sameSite: "lax" });
    redirect(`/verify-otp?email=${encodeURIComponent(r.data!.email)}`);
  });
}

export async function verifyAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const r = await verifyEmailCode(String(fd.get("email") ?? ""), String(fd.get("code") ?? ""));
    if (!r.ok) return r;
    redirect("/onboarding");
  });
}

export async function verifyTokenAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const r = await verifyEmailToken(String(fd.get("token") ?? ""));
    if (!r.ok) return r;
    redirect("/onboarding");
  });
}

export async function resendAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const r = await resendVerification(String(fd.get("email") ?? ""));
    if (r.ok && r.data?.devCode) (await cookies()).set("nargito_devcode", r.data.devCode, { httpOnly: true, maxAge: 900, path: "/verify-otp", sameSite: "lax" });
    return r.ok ? { ok: true, message: r.message } : r;
  });
}

export async function forgotAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const r = await requestPasswordReset(String(fd.get("email") ?? ""));
    if (!r.ok) return r;
    return { ok: true, message: r.message, data: r.data?.devLink ? { devLink: r.data.devLink } : undefined };
  });
}

export async function resetAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const pw = String(fd.get("password") ?? "");
    if (pw !== String(fd.get("confirm") ?? "")) return fail("Passwords do not match.", { confirm: "Passwords do not match." });
    const r = await resetPassword(String(fd.get("token") ?? ""), pw);
    if (!r.ok) return r;
    redirect("/login?reset=1");
  });
}

export async function logoutAction() {
  const u = await getSessionUser();
  await destroyCurrentSession();
  if (u) await audit(u.id, "auth.logout", "user", u.id);
  redirect("/login?signedout=1");
}
