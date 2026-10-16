import "server-only";
import { redirect } from "next/navigation";
import { requirePermission, hasRecentStepUp, getPermissionsFor } from "./auth/guard";
import { requireAdminPage } from "./auth/guard";
import type { SessionUser } from "./auth/session";
import { AppError } from "./util";

/** Server action / handler guard: admin.access + the specific permission. */
export async function adminUser(perm: string): Promise<SessionUser> {
  const u = await requirePermission("admin.access");
  const perms = await getPermissionsFor(u.id);
  if (!perms.has(perm)) throw new AppError(403, "You do not have permission to do that.", "forbidden");
  return u;
}

/** Sensitive actions require a recent password (and TOTP) confirmation. */
export async function adminUserStepUp(perm: string, nextPath = "/admin"): Promise<SessionUser> {
  const u = await adminUser(perm);
  if (!hasRecentStepUp(u)) redirect(`/admin/step-up?next=${encodeURIComponent(nextPath)}`);
  return u;
}

export const adminPage = requireAdminPage;

/** Server-side description of the effective permission set (used by the admin shell to build navigation). */
export async function adminPermissions(userId: string) {
  return getPermissionsFor(userId);
}
