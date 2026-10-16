import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { getSettings } from "@/server/settings";
import { getLocale, getMessages } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";

import { getSessionUser } from "@/server/auth/session";
import { hasPermission } from "@/server/auth/guard";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { Logo } from "@/components/brand/logo";
import { LightboxRoot } from "@/components/ui/lightbox";
import { isFeatureEnabled } from "@/server/features";
import { brandUrl } from "@/server/brand";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const base = (process.env.APP_URL || String(s["site.baseUrl"]) || "").replace(/\/$/, "").replace("http://localhost:3000","");
  const [favicon, ogImg] = await Promise.all([brandUrl("favicon"), brandUrl("og")]);
  const customOg = String(s["seo.ogImage"] || ""); const og = customOg && customOg !== "/icons/icon-512.png" ? customOg : ogImg;
  let metadataBase: URL | undefined;
  try { metadataBase = new URL(base); } catch { /* invalid URL in settings; ignore */ }
  return {
    metadataBase,
    title: { default: `${s["site.name"]} - ${s["brand.tagline"]}`, template: String(s["seo.titleTemplate"]) },
    description: String(s["seo.defaultDescription"]),
    keywords: String(s["brand.metaKeywords"]),
    applicationName: String(s["site.name"]),
    manifest: "/manifest.webmanifest",
    icons: { icon: [{ url: favicon, type: "image/png" }], shortcut: favicon, apple: "/icons/apple-touch-icon.png" },
    openGraph: { siteName: String(s["site.name"]), type: "website", title: `${s["site.name"]} - ${s["brand.tagline"]}`, description: String(s["seo.defaultDescription"]), images: [{ url: og, width: 1200, height: 630, alt: String(s["site.name"]) }] },
    twitter: { card: "summary_large_image", images: [og] },
    robots: s["seo.allowIndexing"] ? undefined : { index: false, follow: false },
    appleWebApp: { capable: true, title: String(s["pwa.shortName"]), statusBarStyle: "default" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const s = await getSettings(["pwa.themeColor"]);
  return { themeColor: String(s["pwa.themeColor"]), width: "device-width", initialScale: 1 };
}

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

const OPEN_DURING_MAINTENANCE = ["/login", "/auth", "/api/auth", "/api/health", "/offline", "/verify-otp", "/forgot-password", "/reset-password"];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [s, locale, messages, pathHeader] = await Promise.all([getSettings(), getLocale(), getMessages(), headers().then((h) => h.get("x-pathname") ?? "/")]);
  let maintenance = false;
  if (s["maintenance.enabled"] && !OPEN_DURING_MAINTENANCE.some((p) => pathHeader.startsWith(p)) && !pathHeader.startsWith("/admin")) {
    const u = await getSessionUser();
    maintenance = !(u && (await hasPermission(u, "admin.access")));
  }
  const pwaOn = await isFeatureEnabled("pwa");
  const tokens = `:root{--c-primary:${hexToRgb(String(s["design.primary"]))};--c-primary-hover:${hexToRgb(String(s["design.primaryHover"]))};--radius:${Number(s["design.radius"])}px}:root:not(.dark){--c-tint:${hexToRgb(String(s["design.tint"]))}}`;
  const customCss = String(s["design.customCss"] ?? "");
  const themeScript = `(function(){try{var d=document.documentElement;var m=document.cookie.match(/(?:^|; )nargito_theme=(light|dark|system)/);var t=m?m[1]:${JSON.stringify(String(s["design.defaultTheme"]))};var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);d.classList.toggle('dark',dark);if(sessionStorage.getItem('ns')){d.classList.add('no-splash')}else{sessionStorage.setItem('ns','1')}}catch(e){}})();`;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <style dangerouslySetInnerHTML={{ __html: `${tokens}.no-splash #splash{display:none}${customCss}` }} />
      </head>
      <body>
        
        <I18nProvider locale={locale} messages={messages}>
          {maintenance ? (
            <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
              <Logo />
              <h1 className="text-2xl">{String(s["maintenance.title"])}</h1>
              <p className="max-w-md text-muted">{String(s["maintenance.message"])}</p>
              <a className="link text-sm" href="/login">Administrator sign in</a>
            </main>
          ) : (
            children
          )}
        </I18nProvider>
        <LightboxRoot />
        {pwaOn && <ServiceWorkerRegister />}
      </body>
    </html>
  );
}
