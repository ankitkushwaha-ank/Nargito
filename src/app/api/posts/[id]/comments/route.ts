import { z } from "zod";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { requireActiveUser } from "@/server/auth/guard";
import { getSessionUser } from "@/server/auth/session";
import { addComment, listComments } from "@/server/services/posts";
import { requireFeature } from "@/server/features";
import { AppError } from "@/server/util";

export const dynamic = "force-dynamic";

export const GET = api<{ id: string }>(async (req, ctx) => {
  await requireFeature("comments");
  const { id } = await ctx.params;
  const user = await getSessionUser();
  const { getPostView } = await import("@/server/services/posts");
  if (!(await getPostView(user?.id ?? null, id))) throw new AppError(404, "Post not found.");
  const r = await listComments(user?.id ?? null, id, req.nextUrl.searchParams.get("cursor"));
  return { ok: true, ...r };
});

export const POST = api<{ id: string }>(async (req, ctx) => {
  const user = await requireActiveUser();
  const { id } = await ctx.params;
  const { body, parentId } = await readJson(req, z.object({ body: z.string().max(10000), parentId: z.string().uuid().nullish() }));
  const r = await addComment(user.id, id, body, parentId);
  return r.ok ? { ok: true, id: r.data?.id } : Response.json({ ok: false, error: r.error }, { status: 400 });
});
