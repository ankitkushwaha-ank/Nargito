import { eq } from "drizzle-orm";
import { requireUserPage } from "@/server/auth/guard";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { saveNotificationPrefsAction } from "../actions";
import { NOTIFICATION_TYPES } from "@/server/services/notify";
import { useDb, schema } from "@/server/db";

export const metadata = { title: "Notification settings" };
const EMAIL_DEFAULT = new Set(["verification", "announcement"]);

export default async function NotificationSettings() {
  const u = await requireUserPage("/settings/notifications");
  const db = await useDb();
  const prefs = await db.select().from(schema.notificationPrefs).where(eq(schema.notificationPrefs.userId, u.id));
  const get = (type: string, ch: string, def: boolean) => prefs.find((p) => p.type === type && p.channel === ch)?.enabled ?? def;
  return (
    <ActionForm action={saveNotificationPrefsAction} className="card space-y-4 p-5">
      <h2 className="text-lg">Notifications</h2>
      <table className="w-full text-sm">
        <caption className="sr-only">Notification channels per event type</caption>
        <thead><tr className="text-left text-muted"><th scope="col" className="py-2 font-medium">Event</th><th scope="col" className="w-20 text-center font-medium">In-app</th><th scope="col" className="w-20 text-center font-medium">Email</th></tr></thead>
        <tbody>{NOTIFICATION_TYPES.map((t) => (
          <tr key={t.key} className="border-t border-line"><th scope="row" className="py-3 text-left font-normal">{t.label}</th>
            <td className="text-center"><input type="checkbox" name={`${t.key}.in_app`} defaultChecked={get(t.key, "in_app", true)} aria-label={`${t.label}: in-app`} className="h-4 w-4 accent-primary" /></td>
            <td className="text-center"><input type="checkbox" name={`${t.key}.email`} defaultChecked={get(t.key, "email", EMAIL_DEFAULT.has(t.key))} aria-label={`${t.label}: email`} className="h-4 w-4 accent-primary" /></td></tr>
        ))}</tbody>
      </table>
      <p className="text-xs text-muted">We never send marketing messages without your consent.</p>
      <SubmitButton>Save preferences</SubmitButton>
    </ActionForm>
  );
}
