"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { run, type SAResult } from "@/server/action";
import { requireUser } from "@/server/auth/guard";
import { updateProfile } from "@/server/services/social";
import { formToObject } from "@/server/validation";
import { useDb, schema } from "@/server/db";
import { safeRedirectPath } from "@/server/util";

export async function completeOnboardingAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const user = await requireUser();
    const r = await updateProfile(user.id, formToObject(fd));
    if (!r.ok) return r;
    const db = await useDb();
    await db.update(schema.users).set({ onboardingDone: true }).where(eq(schema.users.id, user.id));
    redirect(safeRedirectPath(fd.get("next"), "/home"));
  });
}
