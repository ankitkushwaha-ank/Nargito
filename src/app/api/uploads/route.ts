import { api } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { saveUpload } from "@/server/media";
import { AppError } from "@/server/util";
import { enforceRateLimit } from "@/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api(async (req) => {
  const user = await requireUser();
  if (user.status === "suspended") throw new AppError(403, "Your account is suspended.");
  await enforceRateLimit("upload", 60, 3600, user.id);
  const form = await req.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!files.length) throw new AppError(400, "No file received.");
  if (files.length > 10) throw new AppError(400, "Too many files in one request.");
  const alt = typeof form.get("alt") === "string" ? String(form.get("alt")) : undefined;
  const purpose = String(form.get("purpose") ?? "post");
  const results = [];
  for (const f of files) {
    results.push(await saveUpload(user.id, f, { alt, only: purpose === "avatar" || purpose === "cover" ? ["image"] : purpose === "resume" ? ["document"] : undefined, isPrivate: purpose === "evidence" }));
  }
  return { ok: true, files: results };
});
