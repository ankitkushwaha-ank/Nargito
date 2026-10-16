"use server";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { run, type SAResult } from "@/server/action";
import { adminUser } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { fail, ok } from "@/server/util";
import { audit } from "@/server/log";
import { invalidateTranslations } from "@/i18n/server";
import { setSettingValue } from "@/server/settings";

const CODE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

export async function addLanguageAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await adminUser("languages.manage");
    const code = String(fd.get("code") ?? "").trim();
    const name = String(fd.get("name") ?? "").trim().slice(0, 60);
    const nativeName = String(fd.get("nativeName") ?? "").trim().slice(0, 60) || name;
    if (!CODE.test(code)) return fail("Use a language code such as fr or pt-BR.", { code: "Invalid code" });
    if (!name) return fail("Enter a name.", { name: "Required" });
    const db = await useDb();
    const r = await db.insert(schema.languages).values({ code, name, nativeName, enabled: false, fallback: "en" }).onConflictDoNothing().returning();
    if (!r.length) return fail("That language already exists.", { code: "Exists" });
    await audit(u.id, "language.add", "language", code);
    revalidatePath("/admin/languages");
    return ok(undefined, "Language added (disabled). Translate it, then enable it.");
  });
}

export async function languageAction(fd: FormData) {
  const u = await adminUser("languages.manage");
  const code = String(fd.get("code"));
  const intent = String(fd.get("intent"));
  const db = await useDb();
  const [lang] = await db.select().from(schema.languages).where(eq(schema.languages.code, code));
  if (!lang) return;
  if (intent === "enable" || intent === "disable") {
    if (intent === "disable" && (lang.isDefault || lang.code === "en")) return; // default / base language stays on
    await db.update(schema.languages).set({ enabled: intent === "enable" }).where(eq(schema.languages.code, code));
  } else if (intent === "default" && lang.enabled) {
    await db.update(schema.languages).set({ isDefault: false });
    await db.update(schema.languages).set({ isDefault: true }).where(eq(schema.languages.code, code));
    await setSettingValue(u.id, "site.defaultLocale", code);
  } else if (intent === "fallback") {
    const fb = String(fd.get("fallback") || "");
    await db.update(schema.languages).set({ fallback: fb && fb !== code ? fb : null }).where(eq(schema.languages.code, code));
  }
  invalidateTranslations();
  await audit(u.id, `language.${intent}`, "language", code);
  revalidatePath("/", "layout");
}

export async function saveTranslationsAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await adminUser("languages.manage");
    const locale = String(fd.get("locale"));
    if (!CODE.test(locale)) return fail("Invalid locale.");
    const db = await useDb();
    let n = 0;
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith("k:") || typeof v !== "string") continue;
      const key = k.slice(2);
      const base = String(fd.get(`b:${key}`) ?? "");
      const value = v.trim();
      if (value === base.trim()) continue; // unchanged from the built-in/current text
      if (!value) { await db.delete(schema.translations).where(and(eq(schema.translations.locale, locale), eq(schema.translations.key, key))); n++; continue; }
      await db.insert(schema.translations).values({ locale, key, value: value.slice(0, 2000) }).onConflictDoUpdate({ target: [schema.translations.locale, schema.translations.key], set: { value: value.slice(0, 2000) } });
      n++;
    }
    invalidateTranslations();
    await audit(u.id, "translations.save", "language", locale, { changed: n });
    revalidatePath("/", "layout");
    return ok(undefined, n ? `Saved ${n} translation${n === 1 ? "" : "s"}.` : "Nothing changed.");
  });
}

export async function addKeyAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await adminUser("languages.manage");
    const key = String(fd.get("key") ?? "").trim();
    const en = String(fd.get("en") ?? "").trim();
    if (!/^[a-z0-9_.-]{3,80}$/i.test(key)) return fail("Keys may contain letters, numbers, dots, dashes and underscores.", { key: "Invalid key" });
    if (!en) return fail("Provide the English text.", { en: "Required" });
    const db = await useDb();
    await db.insert(schema.translations).values({ locale: "en", key, value: en.slice(0, 2000) }).onConflictDoUpdate({ target: [schema.translations.locale, schema.translations.key], set: { value: en.slice(0, 2000) } });
    const hi = String(fd.get("hi") ?? "").trim();
    if (hi) await db.insert(schema.translations).values({ locale: "hi", key, value: hi.slice(0, 2000) }).onConflictDoUpdate({ target: [schema.translations.locale, schema.translations.key], set: { value: hi.slice(0, 2000) } });
    invalidateTranslations();
    await audit(u.id, "translations.add_key", "translation", key);
    revalidatePath("/admin/languages");
    return ok(undefined, "Key saved.");
  });
}
