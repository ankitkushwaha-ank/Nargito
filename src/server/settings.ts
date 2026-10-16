import "server-only";
import { eq } from "drizzle-orm";
import { useDb, schema } from "./db";
import { SETTINGS, SETTING_MAP, type SettingDef } from "./settings-registry";
import { audit } from "./log";

type Cache = { at: number; values: Map<string, unknown> };
const g = globalThis as unknown as { __settingsCache?: Cache };
const TTL = 5000;

async function load(): Promise<Map<string, unknown>> {
  const c = g.__settingsCache;
  if (c && Date.now() - c.at < TTL) return c.values;
  const db = await useDb();
  const rows = await db.select().from(schema.siteSettings);
  const values = new Map<string, unknown>(rows.map((r) => [r.key, r.value]));
  g.__settingsCache = { at: Date.now(), values };
  return values;
}

export function invalidateSettings() {
  g.__settingsCache = undefined;
}

export function coerce(def: SettingDef, raw: unknown): unknown {
  switch (def.type) {
    case "boolean":
      return typeof raw === "boolean" ? raw : raw === "true" || raw === "on" || raw === "1";
    case "number": {
      const n = Number(raw);
      if (!Number.isFinite(n)) return def.default;
      return Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, n));
    }
    case "list":
      if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
      return String(raw ?? "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    case "select": {
      const s = String(raw ?? "");
      return def.options?.includes(s) ? s : def.default;
    }
    case "color": {
      const s = String(raw ?? "").trim();
      return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : def.default;
    }
    default:
      return String(raw ?? "").trim().slice(0, def.type === "text" ? 5000 : 500);
  }
}

export async function getSetting<T = unknown>(key: string): Promise<T> {
  const def = SETTING_MAP.get(key);
  if (!def) throw new Error(`Unknown setting: ${key}`);
  const values = await load();
  return (values.has(key) ? coerce(def, values.get(key)) : def.default) as T;
}

export async function getSettings(keys?: string[]): Promise<Record<string, unknown>> {
  const values = await load();
  const out: Record<string, unknown> = {};
  for (const def of SETTINGS) {
    if (keys && !keys.includes(def.key)) continue;
    out[def.key] = values.has(def.key) ? coerce(def, values.get(def.key)) : def.default;
  }
  return out;
}

/** Strip anything in custom CSS that can load remote resources or execute behaviour. */
export function sanitizeCss(css: string) {
  return css
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/behavior\s*:[^;]*;?/gi, "")
    .replace(/-moz-binding\s*:[^;]*;?/gi, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .slice(0, 5000);
}

export async function saveSettings(actorId: string, group: string, input: Record<string, unknown>) {
  const db = await useDb();
  const changed: Record<string, unknown> = {};
  const defs = SETTINGS.filter((s) => s.group === group);
  const current = await getSettings();
  for (const def of defs) {
    if (!(def.key in input)) {
      if (def.type !== "boolean") continue; // unchecked checkboxes are absent from form posts
    }
    if (def.key === "chat.callsEnabled") continue; // not implemented
    let next = coerce(def, input[def.key]);
    if (def.key === "design.customCss") next = sanitizeCss(String(next));
    if (JSON.stringify(next) === JSON.stringify(current[def.key])) continue;
    await db
      .insert(schema.siteSettings)
      .values({ key: def.key, value: next as never, updatedBy: actorId })
      .onConflictDoUpdate({ target: schema.siteSettings.key, set: { value: next as never, updatedBy: actorId, updatedAt: new Date() } });
    changed[def.key] = def.sensitive ? "[changed]" : next;
  }
  invalidateSettings();
  if (Object.keys(changed).length) await audit(actorId, "settings.update", "settings", group, changed);
  return Object.keys(changed);
}

/** Set exactly one registered setting (never touches the others in its group). */
export async function setSettingValue(actorId: string, key: string, raw: unknown) {
  const def = SETTING_MAP.get(key);
  if (!def) throw new Error(`Unknown setting: ${key}`);
  const value = coerce(def, raw);
  const db = await useDb();
  await db.insert(schema.siteSettings).values({ key, value: value as never, updatedBy: actorId })
    .onConflictDoUpdate({ target: schema.siteSettings.key, set: { value: value as never, updatedBy: actorId, updatedAt: new Date() } });
  invalidateSettings();
  await audit(actorId, "settings.update", "settings", key, { [key]: def.sensitive ? "[changed]" : value });
}

export async function deleteSetting(key: string) {
  const db = await useDb();
  await db.delete(schema.siteSettings).where(eq(schema.siteSettings.key, key));
  invalidateSettings();
}
