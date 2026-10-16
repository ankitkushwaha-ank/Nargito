"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages, Monitor, Moon, Sun } from "lucide-react";
import { callApi } from "@/lib/client-api";
import { useLocale, useT } from "@/i18n/client";

export function LocaleSwitch({ locales }: { locales: { code: string; nativeName: string }[] }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useT();
  const [pending, start] = useTransition();
  if (locales.length < 2) return null;
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t("nav.language")}</span>
      <Languages size={16} className="pointer-events-none absolute left-2 text-muted" aria-hidden />
      <select
        value={locale} disabled={pending}
        onChange={(e) => start(async () => { await callApi("/api/preferences", "POST", { locale: e.target.value }); router.refresh(); })}
        className="input !w-auto !py-1.5 !pl-7 !pr-2 text-sm"
      >
        {locales.map((l) => <option key={l.code} value={l.code}>{l.nativeName}</option>)}
      </select>
    </label>
  );
}

export function ThemeSwitch({ initial }: { initial: "light" | "dark" | "system" }) {
  const t = useT();
  const apply = (v: "light" | "dark" | "system") => {
    const dark = v === "dark" || (v === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.cookie = `nargito_theme=${v}; path=/; max-age=31536000; samesite=lax`;
    void callApi("/api/preferences", "POST", { theme: v });
  };
  const items = [{ v: "light" as const, icon: Sun, label: t("theme.light") }, { v: "dark" as const, icon: Moon, label: t("theme.dark") }, { v: "system" as const, icon: Monitor, label: t("theme.system") }];
  return (
    <div role="radiogroup" aria-label={t("nav.theme")} className="inline-flex rounded-lg border border-line p-0.5">
      {items.map(({ v, icon: I, label }) => (
        <button key={v} type="button" role="radio" aria-checked={initial === v} aria-label={label} title={label}
          onClick={() => { apply(v); const group = document.querySelectorAll<HTMLButtonElement>('[data-theme-btn]'); group.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.themeBtn === v))); }}
          data-theme-btn={v}
          className="rounded-md p-1.5 text-muted hover:text-ink aria-checked:bg-primary-tint aria-checked:text-primary">
          <I size={16} aria-hidden />
        </button>
      ))}
    </div>
  );
}

/** Single round sun/moon button for the header. Flips between light and dark. */
export function ThemeToggle() {
  const t = useT();
  const flip = () => {
    const el = document.documentElement;
    const next = el.classList.contains("dark") ? "light" : "dark";
    el.classList.toggle("dark", next === "dark");
    document.cookie = `nargito_theme=${next}; path=/; max-age=31536000; samesite=lax`;
    void callApi("/api/preferences", "POST", { theme: next });
  };
  return (
    <button type="button" onClick={flip} aria-label={t("nav.theme")} title={t("nav.theme")} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink/80 transition-colors hover:border-primary/40 hover:text-primary">
      <Sun size={18} className="dark:hidden" aria-hidden />
      <Moon size={18} className="hidden dark:block" aria-hidden />
    </button>
  );
}
