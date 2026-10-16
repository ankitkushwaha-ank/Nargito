"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { run, type SAResult } from "@/server/action";
import { requireUser } from "@/server/auth/guard";
import { formToObject } from "@/server/validation";
import { updateProfile, updatePrivacy, unblockUser } from "@/server/services/social";
import { changePassword } from "@/server/auth/service";
import { revokeAllSessions, markStepUp } from "@/server/auth/session";
import { generateSecret, verifyTotp } from "@/server/auth/totp";
import { verifyPassword } from "@/server/auth/password";
import { useDb, schema } from "@/server/db";
import { fail, ok, isUuid } from "@/server/util";
import { audit, securityEvent } from "@/server/log";
import { NOTIFICATION_TYPES } from "@/server/services/notify";

export async function updateProfileAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireUser();
    const r = await updateProfile(u.id, formToObject(fd));
    revalidatePath(`/profile/${u.username}`);
    return r;
  });
}

export async function updatePrivacyAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireUser();
    await updatePrivacy(u.id, { profileVisibility: String(fd.get("profileVisibility")), discoverable: fd.get("discoverable") === "on" });
    const cv = String(fd.get("contactVisibility") ?? "private");
    const db = await useDb();
    await db.update(schema.users).set({ contactVisibility: ["private", "connections", "public"].includes(cv) ? cv : "private" }).where(eq(schema.users.id, u.id));
    return ok(undefined, "Privacy settings saved.");
  });
}

export async function unblockAction(fd: FormData) {
  const u = await requireUser();
  const id = String(fd.get("userId"));
  if (isUuid(id)) await unblockUser(u.id, id);
  revalidatePath("/settings/privacy");
}

export async function changePasswordAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireUser();
    const next = String(fd.get("password") ?? "");
    if (next !== String(fd.get("confirm") ?? "")) return fail("Passwords do not match.", { confirm: "Passwords do not match." });
    return changePassword(u.id, String(fd.get("current") ?? ""), next, u.sessionHash);
  });
}

export async function revokeSessionAction(fd: FormData) {
  const u = await requireUser();
  const id = String(fd.get("id"));
  if (!isUuid(id)) return;
  const db = await useDb();
  await db.update(schema.sessions).set({ revokedAt: new Date() }).where(and(eq(schema.sessions.id, id), eq(schema.sessions.userId, u.id)));
  await securityEvent("session.revoked", u.id);
  revalidatePath("/settings/security");
}
export async function revokeOtherSessionsAction() {
  const u = await requireUser();
  await revokeAllSessions(u.id, u.sessionHash);
  revalidatePath("/settings/security");
}

export async function startMfaAction() {
  const u = await requireUser();
  const db = await useDb();
  if (u.mfaEnabled) return;
  await db.update(schema.users).set({ mfaSecret: generateSecret() }).where(eq(schema.users.id, u.id));
  revalidatePath("/settings/security");
}
export async function enableMfaAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireUser();
    if (!u.mfaSecret || !verifyTotp(u.mfaSecret, String(fd.get("code") ?? ""))) return fail("That code is not valid. Check the time on your device and try again.", { code: "Invalid code" });
    const db = await useDb();
    await db.update(schema.users).set({ mfaEnabled: true }).where(eq(schema.users.id, u.id));
    await securityEvent("mfa.enabled", u.id);
    revalidatePath("/settings/security");
    return ok(undefined, "Two-factor authentication is on.");
  });
}
export async function disableMfaAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireUser();
    const db = await useDb();
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    if (!row?.passwordHash || !(await verifyPassword(String(fd.get("password") ?? ""), row.passwordHash))) return fail("Password is incorrect.", { password: "Incorrect" });
    await db.update(schema.users).set({ mfaEnabled: false, mfaSecret: null }).where(eq(schema.users.id, u.id));
    await securityEvent("mfa.disabled", u.id);
    revalidatePath("/settings/security");
    return ok(undefined, "Two-factor authentication is off.");
  });
}

/** Re-authentication for sensitive admin actions: password (and TOTP when enabled). */
export async function stepUpAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireUser();
    const db = await useDb();
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    if (!row?.passwordHash || !(await verifyPassword(String(fd.get("password") ?? ""), row.passwordHash))) { await securityEvent("stepup.failed", u.id); return fail("Password is incorrect.", { password: "Incorrect" }); }
    if (row.mfaEnabled && row.mfaSecret && !verifyTotp(row.mfaSecret, String(fd.get("code") ?? ""))) return fail("Authentication code is invalid.", { code: "Invalid" });
    await markStepUp(u.sessionId);
    await audit(u.id, "auth.step_up", "user", u.id);
    const next = String(fd.get("next") ?? "/admin");
    redirect(next.startsWith("/admin") ? next : "/admin");
  });
}

export async function saveNotificationPrefsAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireUser();
    const db = await useDb();
    for (const t of NOTIFICATION_TYPES) {
      for (const ch of ["in_app", "email"] as const) {
        const enabled = fd.get(`${t.key}.${ch}`) === "on";
        await db.insert(schema.notificationPrefs).values({ userId: u.id, type: t.key, channel: ch, enabled }).onConflictDoUpdate({ target: [schema.notificationPrefs.userId, schema.notificationPrefs.type, schema.notificationPrefs.channel], set: { enabled } });
      }
    }
    return ok(undefined, "Notification preferences saved.");
  });
}

export async function requestDataAction(fd: FormData) {
  const u = await requireUser();
  const type = String(fd.get("type")) === "deletion" ? "deletion" : "export";
  const db = await useDb();
  const open = await db.select().from(schema.dataRequests).where(and(eq(schema.dataRequests.userId, u.id), eq(schema.dataRequests.type, type), eq(schema.dataRequests.status, "pending"))).limit(1);
  // Exports are generated on demand (see /api/account/export); deletions wait out a 7-day grace period.
  if (!open.length) await db.insert(schema.dataRequests).values(type === "export" ? { userId: u.id, type, status: "done", resultPath: "inline", processedAt: new Date() } : { userId: u.id, type });
  await audit(u.id, `data.${type}_request`, "user", u.id);
  revalidatePath("/settings/account");
}
export async function cancelDeletionAction() {
  const u = await requireUser();
  const db = await useDb();
  await db.update(schema.dataRequests).set({ status: "rejected", processedAt: new Date() }).where(and(eq(schema.dataRequests.userId, u.id), eq(schema.dataRequests.type, "deletion"), eq(schema.dataRequests.status, "pending")));
  revalidatePath("/settings/account");
}

