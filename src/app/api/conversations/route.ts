import { z } from "zod";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { requireActiveUser } from "@/server/auth/guard";
import { startDirectConversation } from "@/server/services/messaging";

export const dynamic = "force-dynamic";

export const POST = api(async (req) => {
  const user = await requireActiveUser();
  const { userId } = await readJson(req, z.object({ userId: z.string().uuid() }));
  return { ok: true, conversationId: await startDirectConversation(user.id, userId) };
});
