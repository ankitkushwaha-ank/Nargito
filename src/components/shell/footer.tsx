import Link from "next/link";
import { Globe } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { getT, enabledLocales } from "@/i18n/server";
import { getSettings } from "@/server/settings";
import { InstallButton } from "@/components/pwa/install-button";
import { isFeatureEnabled } from "@/server/features";
import { LocaleSwitch } from "./prefs-switchers";

const PATHS: Record<string, string> = {
  Instagram: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.351-.2 6.78-2.618 6.98-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  X: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  YouTube: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  LinkedIn: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  Facebook: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
};
const BRAND_BG: Record<string, string> = { Instagram: "hover:bg-[#E4405F]", X: "hover:bg-black", YouTube: "hover:bg-[#FF0000]", LinkedIn: "hover:bg-[#0A66C2]", Facebook: "hover:bg-[#1877F2]" };
function BrandIcon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden><path d={PATHS[name]} /></svg>;
}
export async function Footer() {
  const [t, s, pwa, locales] = await Promise.all([getT(), getSettings(), isFeatureEnabled("pwa"), enabledLocales()]);
  const cols: { title: string; links: [string, string][] }[] = [
    { title: "Explore", links: [["/people", "People"], ["/trips", "Trips"], ["/shops", "Shops"], ["/products", "Products"], ["/services", "Services"], ["/groups", "Groups"]] },
    { title: "Nargito", links: [["/about", t("footer.about")], ["/contact", t("footer.contact")], ["/help", t("footer.help")], ["/faq", "FAQ"], ["/pricing", "Plans"]] },
    { title: "Trust & legal", links: [["/safety", t("footer.safety")], ["/community-guidelines", t("footer.guidelines")], ["/privacy", t("footer.privacy")], ["/terms", t("footer.terms")], ["/cookies", t("footer.cookies")], ["/accessibility", t("footer.accessibility")]] },
  ];
  const socials = [["Instagram", "social.instagram"], ["X", "social.twitter"], ["YouTube", "social.youtube"], ["LinkedIn", "social.linkedin"], ["Facebook", "social.facebook"]] as const;
  const norm = (v: unknown) => { const x = String(v ?? "").trim(); return !x ? "" : /^https?:\/\//i.test(x) ? x : `https://${x.replace(/^\/+/, "")}`; };
  const live = socials.filter(([, k]) => norm(s[k]));
  return (
    <footer className="relative mt-10 border-t border-line bg-surface pb-28 md:pb-0">
      <div className="mx-auto grid max-w-shell grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:gap-10 md:py-12">
        <div className="col-span-2 space-y-4 md:col-span-1">
          <Logo size={40} />
          <p className="max-w-xs text-sm leading-relaxed text-muted">{String(s["brand.footerText"])}</p>
          {live.length > 0 && (
            <ul className="flex flex-wrap gap-2.5">
              {live.map(([n, k]) => <li key={n}><a href={norm(s[k])} target="_blank" rel="noopener noreferrer" aria-label={n} title={n} className={`flex h-10 w-10 items-center justify-center rounded-full bg-primary-tint text-primary transition-all hover:-translate-y-0.5 hover:text-white ${BRAND_BG[n]}`}><BrandIcon name={n} /></a></li>)}
            </ul>
          )}
          {pwa && Boolean(s["pwa.installPrompt"]) && <InstallButton />}
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-sm font-bold">{c.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">{c.links.map(([href, label]) => <li key={href}><Link href={href} className="text-muted transition-colors hover:text-primary">{label}</Link></li>)}</ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-muted sm:px-6">
          <p>© {new Date().getFullYear()} {String(s["site.name"])}. {t("footer.rights")}</p>
          <div className="flex items-center gap-3"><Globe size={14} aria-hidden /><LocaleSwitch locales={locales} /></div>
        </div>
      </div>
    </footer>
  );
}
