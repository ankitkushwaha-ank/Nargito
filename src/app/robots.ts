import type { MetadataRoute } from "next";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getSettings(["seo.allowIndexing", "site.baseUrl"]);
  const base = (process.env.APP_URL || String(s["site.baseUrl"])).replace(/\/$/, "");
  if (!s["seo.allowIndexing"]) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/messages", "/settings", "/my/", "/notifications", "/saved", "/onboarding", "/login", "/register", "/verify-otp", "/reset-password", "/forgot-password", "/search"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
