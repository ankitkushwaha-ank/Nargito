import { requireAdminPage } from "@/server/auth/guard";
import { visibleAdminGroups } from "@/server/admin-nav";
import { getSetting } from "@/server/settings";
import { AdminShell } from "./shell";
export const metadata = { title: { default: "Admin", template: "%s | Nargito Admin" }, robots: { index: false, follow: false } };
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage();
  const groups = await visibleAdminGroups(user.id);
  const siteName = String(await getSetting("site.name"));
  return <AdminShell groups={groups} user={{ displayName: user.displayName, avatarUrl: user.avatarUrl }} siteName={siteName} wordmarkText={String(await getSetting("brand.wordmarkText"))}>{children}</AdminShell>;
}
