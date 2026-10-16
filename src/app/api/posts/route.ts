import { api } from "@/server/api";
import { requireActiveUser } from "@/server/auth/guard";
import { createPost } from "@/server/services/posts";
import { AppError } from "@/server/util";

export const dynamic = "force-dynamic";

export const POST = api(async (req) => {
  const user = await requireActiveUser();
  let body: unknown;
  try { body = await req.json(); } catch { throw new AppError(400, "Invalid JSON body."); }
  const r = await createPost(user.id, body);
  return r.ok ? { ok: true, id: r.data?.id, message: r.message } : Response.json({ ok: false, error: r.error, fieldErrors: r.fieldErrors }, { status: 400 });
});
