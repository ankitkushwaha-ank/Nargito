import { z } from "zod";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { api } from "@/server/api";
import { readJson } from "@/server/api-helpers";
import { getSessionUser } from "@/server/auth/session";
import { useDb, schema } from "@/server/db";
import { enabledLocales, LOCALE_COOKIE } from "@/i18n/server";
import { AppError } from "@/server/util";

export const dynamic = "force-dynamic";

export const POST = api(async (req) => {
  const { locale, theme } = await readJson(req, z.object({ locale: z.string().max(10).optional(), theme: z.enum(["light", "dark", "system"]).optional() }));
  const jar = await cookies();
  const user = await getSessionUser();
  const db = await useDb();
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };
  if (locale) {
    const allowed = (await enabledLocales()).map((l) => l.code);
    if (!allowed.includes(locale)) throw new AppError(400, "Unsupported language.");
    jar.set(LOCALE_COOKIE, locale, opts);
    if (user) await db.update(schema.users).set({ locale }).where(eq(schema.users.id, user.id));
  }
  if (theme) {
    jar.set("nargito_theme", theme, { ...opts, httpOnly: false });
    if (user) await db.update(schema.users).set({ theme }).where(eq(schema.users.id, user.id));
  }
  return { ok: true };
});
