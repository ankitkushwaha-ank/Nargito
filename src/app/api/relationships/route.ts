import { z } from "zod";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { requireActiveUser, requireUser } from "@/server/auth/guard";
import { acceptConnection, blockUser, followUser, removeConnection, sendConnectionRequest, toggleMute, unblockUser, unfollowUser } from "@/server/services/social";
import { enforceRateLimit } from "@/server/ratelimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["follow", "unfollow", "connect", "accept", "remove", "block", "unblock", "mute"]),
  userId: z.string().uuid().optional(),
  connectionId: z.string().uuid().optional(),
});

export const POST = api(async (req) => {
  const { action, userId, connectionId } = await readJson(req, schema);
  const user = action === "connect" || action === "follow" ? await requireActiveUser() : await requireUser();
  await enforceRateLimit("relationship", 60, 600, user.id);
  const need = <T,>(v: T | undefined) => { if (!v) throw new Error("Missing id"); return v; };
  switch (action) {
    case "follow": await followUser(user.id, need(userId)); break;
    case "unfollow": await unfollowUser(user.id, need(userId)); break;
    case "connect": await sendConnectionRequest(user.id, need(userId)); break;
    case "accept": await acceptConnection(user.id, need(connectionId)); break;
    case "remove": await removeConnection(user.id, need(connectionId)); break;
    case "block": await blockUser(user.id, need(userId)); break;
    case "unblock": await unblockUser(user.id, need(userId)); break;
    case "mute": return { ok: true, muted: await toggleMute(user.id, need(userId)) };
  }
  return { ok: true };
});
