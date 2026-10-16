import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { adminPage, adminUser, adminUserStepUp } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { AdminTitle, MetricCard } from "@/components/admin/admin-ui";
import { SettingsForm } from "@/components/admin/settings-form";
import { getSettings } from "@/server/settings";
import { SETTINGS } from "@/server/settings-registry";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { run, type SAResult } from "@/server/action";
import { fail, ok } from "@/server/util";
import { audit } from "@/server/log";
import { notify } from "@/server/services/notify";
import { rowsOf } from "@/server/db";

export const metadata = { title: "Notifications & announcements" };

async function broadcast(_: SAResult, fd: FormData): Promise<SAResult> {
  "use server";
  return run(async () => {
    const admin = await adminUserStepUp("settings.general", "/admin/notifications");
    const title = String(fd.get("title") ?? "").trim().slice(0, 120); const body = String(fd.get("body") ?? "").trim().slice(0, 300);
    if (!title) return fail("Enter a title.", { title: "Required" });
    const db = await useDb();
    const users = rowsOf<{ id: string }>(await db.execute(sql`select id::text from users where status = 'active' and deleted_at is null limit 5000`));
    const stamp = Date.now();
    for (const u of users) await notify({ userId: u.id, type: "announcement", title, body, link: "/home", dedupeKey: `announce:${stamp}` });
    await audit(admin.id, "notification.broadcast", "notification", undefined, { recipients: users.length });
    revalidatePath("/admin/notifications");
    return ok(undefined, `Sent to ${users.length} active users (respecting their preferences).`);
  });
}

export default async function NotificationsAdmin() {
  await adminPage("settings.general");
  const db = await useDb();
  const vals = await getSettings();
  const stats = rowsOf<{ total: number; unread: number; last7: number }>(await db.execute(sql`select count(*)::int total, count(*) filter (where read_at is null)::int unread, count(*) filter (where created_at > now() - interval '7 days')::int last7 from notifications`))[0]!;
  const fields = SETTINGS.filter((s) => s.key.startsWith("announcement.")).map((s) => ({ key: s.key, label: s.label, type: s.type, value: vals[s.key] }));
  void adminUser;
  return (
    <>
      <AdminTitle title="Notifications & announcements" description="In-app notifications are created by platform events. Email, SMS and push follow each user's preferences and the configured providers; SMS and push are not enabled in this release." />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <MetricCard m={{ key: "t", label: "Notifications stored", value: stats.total, kind: "actual" }} /><MetricCard m={{ key: "u", label: "Unread", value: stats.unread, kind: "actual" }} /><MetricCard m={{ key: "l", label: "Created in last 7 days", value: stats.last7, kind: "actual" }} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div><h2 className="mb-2 text-lg">Sidebar announcement</h2><SettingsForm group="website" fields={fields} /></div>
        <ActionForm action={broadcast} className="card h-fit space-y-3 p-5" resetOnSuccess><h2 className="text-lg">Send a notification to all active users</h2><Field label="Title" name="title" required maxLength={120} /><Field label="Message" name="body" as="textarea" rows={3} maxLength={300} /><p className="text-xs text-muted">Requires re-authentication. Limited to the first 5,000 active users per send.</p><SubmitButton variant="danger">Send to everyone</SubmitButton></ActionForm>
      </div>
    </>
  );
}
