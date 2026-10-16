import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminPage, adminUserStepUp } from "@/server/admin";
import { getSettings, setSettingValue } from "@/server/settings";
import { isFeatureEnabled, invalidateFeatures, FEATURES } from "@/server/features";
import { checkApproval } from "@/server/approvals";
import { useDb, schema } from "@/server/db";
import { audit, securityEvent } from "@/server/log";
import { AdminTitle } from "@/components/admin/admin-ui";
import { Badge, Notice } from "@/components/ui/kit";

export const metadata = { title: "Emergency controls" };

type Switch = { key: string; label: string; description: string; critical: boolean; isPaused: () => Promise<boolean>; pause: (uid: string) => Promise<void>; resume: (uid: string) => Promise<void> };
const feature = (k: string) => ({
  isPaused: async () => !(await isFeatureEnabled(k)),
  pause: async (uid: string) => setFlag(k, false, uid),
  resume: async (uid: string) => setFlag(k, true, uid),
});
async function setFlag(key: string, enabled: boolean, uid: string) {
  const f = FEATURES.find((x) => x.key === key);
  if (!f || f.critical) return;
  const db = await useDb();
  await db.insert(schema.featureFlags).values({ key, enabled, critical: false, description: f.description, updatedBy: uid }).onConflictDoUpdate({ target: schema.featureFlags.key, set: { enabled, updatedBy: uid, updatedAt: new Date() } });
  invalidateFeatures();
}
const setting = (k: string, pausedValue: boolean) => ({
  isPaused: async () => Boolean((await getSettings([k]))[k]) === pausedValue,
  pause: async (uid: string) => setSettingValue(uid, k, pausedValue),
  resume: async (uid: string) => setSettingValue(uid, k, !pausedValue),
});

// Authentication, audit logging and this page itself can never be switched off from here.
const SWITCHES: Switch[] = [
  { key: "registrations", label: "Pause new registrations", description: "Blocks sign-ups (email and social) while existing members keep working.", critical: false, ...setting("registration.enabled", false) },
  { key: "uploads", label: "Pause all uploads", description: "Rejects every media upload on the server (use during abuse or storage incidents).", critical: false, ...setting("upload.enabled", false) },
  { key: "posting", label: "Pause posting", description: "Disables the Posts feature: publishing, feed and post APIs.", critical: false, ...feature("posts") },
  { key: "comments", label: "Pause comments", description: "Disables commenting everywhere.", critical: false, ...feature("comments") },
  { key: "ads", label: "Pause advertising", description: "Stops serving sponsored content and new promotions.", critical: false, ...setting("ads.enabled", false) },
  { key: "messaging", label: "Pause private messaging", description: "Disables conversations and enquiries. Requires a second approver.", critical: true, ...feature("messaging") },
  { key: "maintenance", label: "Enable maintenance mode", description: "Takes the public site offline (administrators keep access). Requires a second approver.", critical: true, ...setting("maintenance.enabled", true) },
];

async function toggle(fd: FormData) {
  "use server";
  const key = String(fd.get("key")); const op = String(fd.get("op"));
  const sw = SWITCHES.find((s) => s.key === key);
  if (!sw) return;
  const admin = await adminUserStepUp("security.manage", "/admin/emergency");
  if (op === "pause") {
    if (sw.critical && (await checkApproval(admin.id, `emergency:${key}`)) === "pending") redirect("/admin/emergency?notice=awaiting-approval");
    await sw.pause(admin.id);
  } else await sw.resume(admin.id); // recovery never needs a second person
  await audit(admin.id, `emergency.${op}`, "emergency", key);
  await securityEvent(`emergency.${op}`, admin.id, { key });
  revalidatePath("/", "layout");
  redirect("/admin/emergency");
}

export default async function Emergency({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await adminPage("security.manage");
  const sp = await searchParams;
  const states = await Promise.all(SWITCHES.map(async (s) => ({ s, paused: await s.isPaused() })));
  return (
    <>
      <AdminTitle title="Emergency controls" description="Fast, reversible switches for incidents. Each use needs re-authentication and is written to the audit and security logs. Authentication, audit logging and these controls cannot be disabled." />
      {sp.notice === "awaiting-approval" && <div className="mb-4"><Notice tone="warn">Request recorded. Another administrator with approval rights must approve it in Security &gt; Approvals; then press the button again.</Notice></div>}
      <ul className="card divide-y divide-line">
        {states.map(({ s, paused }) => (
          <li key={s.key} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="flex items-center gap-2 font-medium">{s.label} {s.critical && <Badge tone="warn">two-person</Badge>}</p><p className="text-sm text-muted">{s.description}</p></div>
            <Badge tone={paused ? "danger" : "success"}>{paused ? "ACTIVE (paused)" : "normal"}</Badge>
            <form action={toggle}><input type="hidden" name="key" value={s.key} />{paused ? <button name="op" value="resume" className="btn-primary">Restore normal operation</button> : <button name="op" value="pause" className="btn-danger">Activate</button>}</form>
          </li>
        ))}
      </ul>
      <section className="card mt-5 space-y-2 p-5 text-sm"><h2 className="text-lg">Recovery</h2><p>Every switch above can be reverted here. If you lose admin access, set <code>maintenance.enabled</code> / feature flags directly in the database (<code>site_settings</code>, <code>feature_flags</code>) and run <b>Tools &gt; Clear caches</b>, or restart the app.</p></section>
    </>
  );
}
