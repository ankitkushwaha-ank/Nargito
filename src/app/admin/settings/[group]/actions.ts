"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { run, type SAResult } from "@/server/action";
import { adminUser, adminUserStepUp } from "@/server/admin";
import { getSettings, saveSettings, coerce } from "@/server/settings";
import { SETTINGS, SETTING_GROUPS } from "@/server/settings-registry";
import { sendEmail, sendSms } from "@/server/mail";
import { enforceRateLimit } from "@/server/ratelimit";
import { fail, ok } from "@/server/util";
import { formToObject } from "@/server/validation";

export async function saveGroupAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const group = String(fd.get("__group"));
    const def = SETTING_GROUPS.find((g) => g.id === group);
    if (!def) return fail("Unknown settings group.");
    const next = `/admin/settings/${group}`;
    let user = await adminUser(def.permission);
    const input = formToObject(fd);
    const current = await getSettings();
    // Sensitive keys (registration, maintenance, indexing, custom CSS, account linking) need a fresh re-authentication.
    const touchesSensitive = SETTINGS.filter((s) => s.group === group && s.sensitive).some((s) => {
      const submitted = s.type === "boolean" ? coerce(s, input[s.key] ?? "false") : coerce(s, input[s.key]);
      return JSON.stringify(submitted) !== JSON.stringify(current[s.key]);
    });
    if (touchesSensitive) user = await adminUserStepUp(def.permission, next);
    const changed = await saveSettings(user.id, group, input);
    revalidatePath("/", "layout");
    return ok(undefined, changed.length ? `Saved ${changed.length} setting${changed.length === 1 ? "" : "s"}. Changes apply immediately.` : "No changes to save.");
  });
}

export async function testEmailAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const user = await adminUser("settings.integrations");
    await enforceRateLimit("test-email", 5, 600, user.id);
    const to = String(fd.get("to") ?? user.email).trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return fail("Enter a valid address.");
    const r = await sendEmail(to, "Nargito test email", "<p>This is a test email from the Nargito admin panel.</p>", "This is a test email from the Nargito admin panel.");
    return r.delivered ? ok(undefined, `Test email sent to ${to}.`) : fail(r.reason ?? "Delivery failed. See the delivery log below.");
  });
}
export async function testSmsAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const user = await adminUser("settings.integrations");
    await enforceRateLimit("test-sms", 3, 600, user.id);
    const to = String(fd.get("to") ?? "").trim();
    if (!/^\+?[0-9]{8,15}$/.test(to)) return fail("Enter a phone number in international format, e.g. +919876543210.");
    const r = await sendSms(to, "Nargito test message");
    return r.delivered ? ok(undefined, "Test SMS sent.") : fail(r.reason ?? "Delivery failed.");
  });
}

export async function gotoStepUp(next: string) {
  redirect(`/admin/step-up?next=${encodeURIComponent(next)}`);
}
