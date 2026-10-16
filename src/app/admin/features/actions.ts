"use server";
import { revalidatePath } from "next/cache";
import { adminUser } from "@/server/admin";
import { FEATURES, invalidateFeatures } from "@/server/features";
import { useDb, schema } from "@/server/db";
import { audit } from "@/server/log";

export async function toggleFeatureAction(fd: FormData) {
  const user = await adminUser("features.manage");
  const key = String(fd.get("key"));
  const f = FEATURES.find((x) => x.key === key);
  if (!f || f.critical) return; // critical features can never be switched off
  const enabled = String(fd.get("enabled")) === "true";
  const db = await useDb();
  await db.insert(schema.featureFlags).values({ key, enabled, critical: false, description: f.description, updatedBy: user.id })
    .onConflictDoUpdate({ target: schema.featureFlags.key, set: { enabled, updatedBy: user.id, updatedAt: new Date() } });
  invalidateFeatures();
  await audit(user.id, enabled ? "feature.enable" : "feature.disable", "feature", key);
  revalidatePath("/", "layout");
}
