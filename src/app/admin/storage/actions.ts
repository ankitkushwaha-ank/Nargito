"use server";
import { revalidatePath } from "next/cache";
import { run, type SAResult } from "@/server/action";
import { adminUser } from "@/server/admin";
import { audit } from "@/server/log";
import { fail, ok } from "@/server/util";
import { getStorageConfig, saveStorageConfig, testStorage, type StorageConfig } from "@/server/storage";

export async function storageAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const user = await adminUser("settings.uploads");
    const s = (k: string) => String(fd.get(k) ?? "").trim();
    const cur = await getStorageConfig();
    const input: StorageConfig = {
      provider: s("provider") === "r2" ? "r2" : "local",
      accountId: s("accountId"), accessKeyId: s("accessKeyId"),
      secretAccessKey: s("secretAccessKey") || cur.secretAccessKey,
      bucket: s("bucket"), publicUrl: s("publicUrl"), prefix: s("prefix"),
    };
    if (s("intent") === "test") {
      const r = await testStorage(input);
      return r.ok ? ok(undefined, r.message) : fail(r.message);
    }
    if (input.provider === "r2") {
      const t = await testStorage(input);
      if (!t.ok) return fail(`Not saved. ${t.message}`);
    }
    await saveStorageConfig(user.id, input);
    await audit(user.id, "storage.update", "settings", "storage", { provider: input.provider, bucket: input.bucket, secretChanged: !!s("secretAccessKey") });
    revalidatePath("/admin/storage");
    return ok(undefined, input.provider === "r2" ? "Saved. New uploads now go to Cloudflare R2." : "Saved. New uploads are stored on this server.");
  });
}
