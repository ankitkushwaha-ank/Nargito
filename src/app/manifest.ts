import type { MetadataRoute } from "next";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

/** Web app manifest generated from Admin > PWA settings. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  const display = ["standalone", "minimal-ui", "browser", "fullscreen"].includes(String(s["pwa.display"])) ? (String(s["pwa.display"]) as "standalone") : "standalone";
  const start = String(s["pwa.startUrl"]).startsWith("/") ? String(s["pwa.startUrl"]) : "/home";
  return {
    name: String(s["pwa.name"]), short_name: String(s["pwa.shortName"]), description: String(s["site.description"]),
    start_url: start, scope: "/", id: "/", display, orientation: "portrait-primary", lang: String(s["site.defaultLocale"]),
    theme_color: String(s["pwa.themeColor"]), background_color: String(s["pwa.backgroundColor"]), categories: ["social", "travel", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Messages", url: "/messages" }, { name: "Explore", url: "/explore" }],
  };
}
