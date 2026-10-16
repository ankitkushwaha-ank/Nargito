"use server";
import { revalidatePath } from "next/cache";
import { run, type SAResult } from "@/server/action";
import { adminUser } from "@/server/admin";
import { audit } from "@/server/log";
import { fail, ok } from "@/server/util";
import { isBrandKind, resetBrandImage, saveBrandImage } from "@/server/brand";

export async function uploadBrandAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const user = await adminUser("settings.general");
    const kind = String(fd.get("kind"));
    if (!isBrandKind(kind)) return fail("Unknown image slot.");
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return fail("Choose an image first.");
    try { await saveBrandImage(kind, Buffer.from(await file.arrayBuffer())); } catch (e) { return fail(e instanceof Error ? e.message : "Upload failed."); }
    await audit(user.id, "brand.update", "brand", kind, { size: file.size });
    revalidatePath("/", "layout");
    return ok(undefined, "Image updated. It is live now (browsers may take a few minutes to refresh cached copies).");
  });
}

export async function resetBrandAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const user = await adminUser("settings.general");
    const kind = String(fd.get("kind"));
    if (!isBrandKind(kind)) return fail("Unknown image slot.");
    await resetBrandImage(kind);
    await audit(user.id, "brand.reset", "brand", kind, {});
    revalidatePath("/", "layout");
    return ok(undefined, "Restored the default image.");
  });
}
