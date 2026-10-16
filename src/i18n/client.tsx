"use client";
import { createContext, useContext, useMemo } from "react";

type Ctx = { locale: string; messages: Record<string, string> };
const I18nContext = createContext<Ctx>({ locale: "en", messages: {} });

export function I18nProvider({ locale, messages, children }: Ctx & { children: React.ReactNode }) {
  const v = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <I18nContext.Provider value={v}>{children}</I18nContext.Provider>;
}

export function useT() {
  const { messages } = useContext(I18nContext);
  return (key: string, vars?: Record<string, string | number>) => {
    let s = messages[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}
export function useLocale() {
  return useContext(I18nContext).locale;
}
