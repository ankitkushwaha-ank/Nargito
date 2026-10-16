import "server-only";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { getPermissionsFor } from "@/server/auth/guard";
import { isFeatureEnabled } from "@/server/features";

export type VisibleGroup = { label: string; items: { label: string; href: string }[] };

/** The admin menu entries this user may see (permission + feature filtered). Shared by the layout and the dashboard. */
export async function visibleAdminGroups(userId: string): Promise<VisibleGroup[]> {
  const perms = await getPermissionsFor(userId);
  const groups: VisibleGroup[] = [];
  for (const g of ADMIN_NAV) {
    const items: VisibleGroup["items"] = [];
    for (const i of g.items) {
      if (!perms.has(i.perm)) continue;
      if (i.feature && !(await isFeatureEnabled(i.feature))) continue;
      items.push({ label: i.label, href: i.href });
    }
    if (items.length) groups.push({ label: g.label, items });
  }
  return groups;
}
