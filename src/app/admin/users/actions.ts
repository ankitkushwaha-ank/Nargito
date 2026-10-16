"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { run, type SAResult } from "@/server/action";
import { adminUser, adminUserStepUp } from "@/server/admin";
import { moderateUser, type UserAction } from "@/server/services/moderation";
import { useDb, schema } from "@/server/db";
import { fail, ok, isUuid } from "@/server/util";
import { audit } from "@/server/log";
import { revokeAllSessions } from "@/server/auth/session";

const ACTIONS: UserAction[] = ["warn", "restrict", "suspend", "ban", "reinstate"];

export async function moderateUserAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const action = String(fd.get("action")) as UserAction;
    if (!ACTIONS.includes(action)) return fail("Choose an action.");
    const userId = String(fd.get("userId"));
    // banning needs a fresh confirmation; other actions need the suspend permission
    const admin = action === "ban" ? await adminUserStepUp("users.suspend", `/admin/users/${userId}`) : await adminUser("users.suspend");
    await moderateUser(admin.id, userId, action, String(fd.get("reason") ?? ""), Number(fd.get("days")) || 7);
    revalidatePath(`/admin/users/${userId}`); revalidatePath("/admin/users");
    return ok(undefined, `Action applied: ${action}.`);
  });
}

export async function bulkUserAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const admin = await adminUserStepUp("users.suspend", "/admin/users");
    const ids = fd.getAll("ids").map(String).filter(isUuid).slice(0, 100);
    const action = String(fd.get("action")) as UserAction;
    if (!ids.length) return fail("Select at least one user.");
    if (!["warn", "restrict", "suspend", "reinstate"].includes(action)) return fail("Choose a bulk action.");
    if (fd.get("confirm") !== "on") return fail("Tick the confirmation box to apply this to the selected users.");
    let done = 0; const errors: string[] = [];
    for (const id of ids) { try { await moderateUser(admin.id, id, action, String(fd.get("reason") ?? ""), 7); done++; } catch (e) { errors.push(e instanceof Error ? e.message : "error"); } }
    await audit(admin.id, "user.bulk", "user", undefined, { action, count: done, failed: errors.length });
    revalidatePath("/admin/users");
    return done ? ok(undefined, `Applied to ${done} user(s).${errors.length ? ` ${errors.length} skipped: ${errors[0]}` : ""}`) : fail(errors[0] ?? "Nothing applied.");
  });
}

export async function addNoteAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const admin = await adminUser("users.manage");
    const userId = String(fd.get("userId")); const note = String(fd.get("note") ?? "").trim().slice(0, 1000);
    if (!isUuid(userId) || !note) return fail("Write a note.");
    const db = await useDb();
    await db.insert(schema.adminNotes).values({ userId, adminId: admin.id, note });
    await audit(admin.id, "user.note", "user", userId);
    revalidatePath(`/admin/users/${userId}`);
    return ok(undefined, "Note added.");
  });
}

export async function setUserRoleAction(fd: FormData) {
  const admin = await adminUserStepUp("roles.manage", "/admin/users");
  const userId = String(fd.get("userId")); const roleId = String(fd.get("roleId")); const op = String(fd.get("op"));
  if (!isUuid(userId) || !isUuid(roleId)) return;
  const db = await useDb();
  const [role] = await db.select().from(schema.roles).where(eq(schema.roles.id, roleId));
  if (!role) return;
  if (op === "revoke") {
    // never allow the platform to be left without a super administrator
    if (role.name === "superadmin") {
      const holders = await db.select().from(schema.userRoles).where(eq(schema.userRoles.roleId, roleId));
      if (holders.length <= 1) return;
    }
    if (userId === admin.id && role.name === "superadmin") return;
    await db.delete(schema.userRoles).where(and(eq(schema.userRoles.userId, userId), eq(schema.userRoles.roleId, roleId)));
  } else {
    if (role.name === "superadmin") { /* only another super administrator may grant it */
      const { getPermissionsFor } = await import("@/server/auth/guard");
      const myRoles = await db.select({ n: schema.roles.name }).from(schema.userRoles).innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId)).where(eq(schema.userRoles.userId, admin.id));
      if (!myRoles.some((r) => r.n === "superadmin")) return;
      void getPermissionsFor;
    }
    await db.insert(schema.userRoles).values({ userId, roleId, grantedBy: admin.id }).onConflictDoNothing();
  }
  await audit(admin.id, `role.${op === "revoke" ? "revoke" : "grant"}`, "user", userId, { role: role.name });
  revalidatePath(`/admin/users/${userId}`);
}

export async function revokeUserSessionsAction(fd: FormData) {
  const admin = await adminUser("users.suspend");
  const userId = String(fd.get("userId"));
  if (!isUuid(userId)) return;
  await revokeAllSessions(userId);
  await audit(admin.id, "user.sessions_revoked", "user", userId);
  revalidatePath(`/admin/users/${userId}`);
}

export async function manualVerifyAction(fd: FormData) {
  const admin = await adminUser("verification.manage");
  const userId = String(fd.get("userId")); const v = String(fd.get("verified")) === "true";
  if (!isUuid(userId)) return;
  const db = await useDb();
  await db.update(schema.users).set({ verified: v }).where(eq(schema.users.id, userId));
  await audit(admin.id, v ? "user.verify" : "user.unverify", "user", userId);
  revalidatePath(`/admin/users/${userId}`);
}
