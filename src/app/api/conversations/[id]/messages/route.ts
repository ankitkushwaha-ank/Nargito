import { z } from "zod";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { requireActiveUser, requireUser } from "@/server/auth/guard";
import { getMessages, markConversationRead, sendMessage } from "@/server/services/messaging";
import { requireFeature } from "@/server/features";

export const dynamic = "force-dynamic";

export const GET = api<{ id: string }>(async (req, ctx) => {
  await requireFeature("messaging");
  const user = await requireUser();
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const r = await getMessages(user.id, id, { before: sp.get("before"), after: sp.get("after") });
  if (r.items.some((m) => !m.mine)) await markConversationRead(user.id, id);
  return { ok: true, ...r };
}, { limitPerMinute: 120 });

export const POST = api<{ id: string }>(async (req, ctx) => {
  const user = await requireActiveUser();
  const { id } = await ctx.params;
  const b = await readJson(req, z.object({ body: z.string().max(10000).default(""), attachmentId: z.string().uuid().nullish() }));
  const r = await sendMessage(user.id, id, b.body, b.attachmentId);
  return r.ok ? { ok: true, id: r.data?.id } : Response.json({ ok: false, error: r.error }, { status: 400 });
});
