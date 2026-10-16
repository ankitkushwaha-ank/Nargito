import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import en, { type MessageKey } from "./en";
import hi from "./hi";
import { useDb, schema } from "@/server/db";
import { getSetting } from "@/server/settings";
import { getSessionUser } from "@/server/auth/session";

export const BUILTIN_LOCALES = ["en", "hi"] as const;
export const LOCALE_COOKIE = "nargito_locale";
const files: Record<string, Record<string, string>> = { en, hi };

type OverrideCache = { at: number; map: Record<string, Record<string, string>> };
const g = globalThis as unknown as { __i18nOverrides?: OverrideCache };

async function overrides() {
  const c = g.__i18nOverrides;
  if (c && Date.now() - c.at < 10_000) return c.map;
  const db = await useDb();
  const rows = await db.select().from(schema.translations);
  const map: Record<string, Record<string, string>> = {};
  for (const r of rows) (map[r.locale] ??= {})[r.key] = r.value;
  g.__i18nOverrides = { at: Date.now(), map };
  return map;
}
export function invalidateTranslations() {
  g.__i18nOverrides = undefined;
}

export async function enabledLocales() {
  const db = await useDb();
  const rows = await db.select().from(schema.languages);
  const enabled = rows.filter((r) => r.enabled);
  return enabled.length ? enabled : [{ code: "en", name: "English", nativeName: "English", enabled: true, isDefault: true, fallback: null }];
}

export const getLocale = cache(async (): Promise<string> => {
  const langs = (await enabledLocales()).map((l) => l.code);
  const jar = await cookies();
  const c = jar.get(LOCALE_COOKIE)?.value;
  if (c && langs.includes(c)) return c;
  const u = await getSessionUser();
  if (u?.locale && langs.includes(u.locale)) return u.locale;
  const def = await getSetting<string>("site.defaultLocale");
  return langs.includes(def) ? def : langs[0]!;
});

export async function getMessages(locale?: string): Promise<Record<string, string>> {
  const l = locale ?? (await getLocale());
  const ov = await overrides();
  const db = await useDb();
  const [lang] = await db.select().from(schema.languages).limit(50).then((rs) => rs.filter((r) => r.code === l));
  const fallback = lang?.fallback ?? "en";
  return { ...en, ...(files[fallback] ?? {}), ...(ov[fallback] ?? {}), ...(files[l] ?? {}), ...(ov[l] ?? {}) };
}

export type TFn = (key: MessageKey | (string & {}), vars?: Record<string, string | number>) => string;

export function makeT(messages: Record<string, string>): TFn {
  return (key, vars) => {
    let s = messages[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

export const getT = cache(async () => makeT(await getMessages()));

export { files as builtinMessages };
