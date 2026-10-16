import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { useDb, schema } from "../db";
import { getSessionUser, type SessionUser } from "./session";
import { ALL_PERMISSION_KEYS } from "../permissions-def";
import { AppError } from "../util";
import { getSetting } from "../settings";

/** Effective permissions = union of role permissions, plus per-user allow overrides, minus deny overrides. */
export const getPermissionsFor = cache(async (userId: string): Promise<Set<string>> => {
  const db = await useDb();
  const roleRows = await db
    .select({ role: schema.roles.name, perm: schema.rolePermissions.permissionKey })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .leftJoin(schema.rolePermissions, eq(schema.rolePermissions.roleId, schema.roles.id))
    .where(eq(schema.userRoles.userId, userId));
  const set = new Set<string>();
  for (const r of roleRows) {
    if (r.role === "superadmin") return new Set(ALL_PERMISSION_KEYS);
    if (r.perm) set.add(r.perm);
  }
  const overrides = await db.select().from(schema.userPermissionOverrides).where(eq(schema.userPermissionOverrides.userId, userId));
  for (const o of overrides) o.allow ? set.add(o.permissionKey) : set.delete(o.permissionKey);
  return set;
});

export async function getCurrentUser() {
  return getSessionUser();
}

export async function hasPermission(user: { id: string } | null, perm: string) {
  if (!user) return false;
  return (await getPermissionsFor(user.id)).has(perm);
}

/** Page guard: redirects anonymous users to /login. */
export async function requireUserPage(nextPath?: string): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect(`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  return u;
}

/** Action / API guard: throws AppError(401). */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new AppError(401, "Please sign in to continue.", "unauthenticated");
  return u;
}

/** Actions that create content: requires an active account, and verified email when policy demands it. */
export async function requireActiveUser(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.status === "suspended") throw new AppError(403, "Your account is suspended.", "suspended");
  if (u.status === "restricted" && (!u.restrictedUntil || u.restrictedUntil > new Date()))
    throw new AppError(403, "Your account is temporarily restricted.", "restricted");
  if (!u.emailVerifiedAt && (await getSetting<boolean>("registration.requireEmailVerification")))
    throw new AppError(403, "Please verify your email address first.", "unverified");
  return u;
}

export async function requirePermission(perm: string): Promise<SessionUser> {
  const u = await requireUser();
  if (u.status !== "active") throw new AppError(403, "Forbidden", "forbidden");
  if (!(await hasPermission(u, perm))) throw new AppError(403, "You do not have permission to do that.", "forbidden");
  return u;
}

/** Page guard for admin routes: unauthenticated -> /login, authenticated without permission -> 404 look-alike. */
export async function requireAdminPage(perm = "admin.access"): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login?next=/admin");
  const perms = await getPermissionsFor(u.id);
  if (!perms.has("admin.access") || !perms.has(perm)) redirect("/home?denied=1");
  return u;
}

const STEP_UP_MS = 10 * 60_000;
export function hasRecentStepUp(u: SessionUser) {
  return !!u.stepUpAt && Date.now() - u.stepUpAt.getTime() < STEP_UP_MS;
}
