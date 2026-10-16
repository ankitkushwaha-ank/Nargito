import { z } from "zod";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { requireUser } from "@/server/auth/guard";
import { setLocationPreference } from "@/server/services/social";
import { CITIES } from "@/server/cities";
import { AppError } from "@/server/util";
import { getSetting } from "@/server/settings";
import { enforceRateLimit } from "@/server/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Accepts either browser coordinates or a manually selected city.
 * Coordinates are snapped to a coarse cell in memory and are never stored, logged or returned.
 */
export const POST = api(async (req) => {
  const user = await requireUser();
  await enforceRateLimit("location", 20, 3600, user.id);
  if (!(await getSetting<boolean>("location.enabled"))) throw new AppError(403, "Nearby discovery is disabled.");
  const b = await readJson(req, z.object({ enabled: z.boolean(), lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional(), city: z.string().max(80).optional() }));
  if (!b.enabled) { await setLocationPreference(user.id, false); return { ok: true, enabled: false }; }
  if (b.city) {
    const c = CITIES.find((x) => x.name === b.city);
    if (!c) throw new AppError(400, "Unknown city.");
    await setLocationPreference(user.id, true, { lat: c.lat, lng: c.lng }, c.name);
    return { ok: true, enabled: true, label: c.name };
  }
  if (b.lat === undefined || b.lng === undefined) throw new AppError(400, "Location missing.");
  await setLocationPreference(user.id, true, { lat: b.lat, lng: b.lng });
  return { ok: true, enabled: true };
});
