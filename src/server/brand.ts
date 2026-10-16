import "server-only";
import path from "node:path";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import { UPLOAD_ROOT } from "./media";

/** Replaceable brand images. Uploaded overrides live in UPLOAD_DIR/brand; the bundled file is the fallback. */
export const BRAND_SLOTS = {
  logo: { label: "App logo (icon mark)", help: "Square PNG with a transparent background, at least 256 px. Shown in the header, login and installed app.", fallback: "public/brand/nargito-mark.png", out: "png", w: 512, h: 512, fit: "inside" },
  wordmark: { label: "Wordmark - for light theme", help: "The word “Nargito” in dark colour on a transparent PNG.", fallback: "public/brand/wordmark.png", out: "png", w: 800, h: 240, fit: "inside" },
  "wordmark-light": { label: "Wordmark - for dark theme", help: "The same wordmark in white on a transparent PNG.", fallback: "public/brand/wordmark-light.png", out: "png", w: 800, h: 240, fit: "inside" },
  favicon: { label: "Favicon (browser tab icon)", help: "Square PNG, at least 128 px. Shown in browser tabs and bookmarks.", fallback: "public/icons/icon-64.png", out: "png", w: 256, h: 256, fit: "cover" },
  og: { label: "Share banner (link preview image)", help: "1200 × 630 px works best. This is the picture people see when your link is shared on WhatsApp, Facebook, X, LinkedIn and others.", fallback: "public/images/og-default.jpg", out: "jpg", w: 1200, h: 630, fit: "cover" },
  hero: { label: "Home page banner (desktop)", help: "Wide landscape photo, at least 1600 px wide. The left side should be light or calm so the headline stays readable.", fallback: "public/images/hero-landing.jpg", out: "jpg", w: 2000, h: 900, fit: "inside" },
  "hero-mobile": { label: "Home page banner (mobile)", help: "Landscape or square photo, at least 1000 px wide.", fallback: "public/images/hero-trips.jpg", out: "jpg", w: 1400, h: 1000, fit: "inside" },
  "login-banner": { label: "Login & register banner (desktop)", help: "Tall or landscape photo shown on the left of the sign in and register pages. 1400 px or wider.", fallback: "public/images/hero-landing.jpg", out: "jpg", w: 1600, h: 1200, fit: "inside" },
  "login-banner-mobile": { label: "Login & register banner (mobile)", help: "Shown at the top of sign in and register on phones. Landscape, 1000 px or wider.", fallback: "public/images/hero-trips.jpg", out: "jpg", w: 1400, h: 1000, fit: "inside" },
  "banner-explore": { label: "Explore page banner", help: "Wide photo, 1600 × 600 px. Shown at the top of Explore.", fallback: "public/images/hero-landing.jpg", out: "jpg", w: 1800, h: 700, fit: "cover" },
  "banner-marketplace": { label: "Marketplace banner", help: "Wide photo, 1600 × 600 px. Shown at the top of Marketplace (products).", fallback: "public/images/product-festive-cookie-hamper.jpg", out: "jpg", w: 1800, h: 700, fit: "cover" },
  "banner-trips": { label: "Trips banner", help: "Wide photo, 1600 × 600 px. Shown at the top of Trips.", fallback: "public/images/hero-trips.jpg", out: "jpg", w: 1800, h: 700, fit: "cover" },
  "banner-services": { label: "Services banner", help: "Wide photo, 1600 × 600 px. Shown at the top of Services.", fallback: "public/images/hero-landing.jpg", out: "jpg", w: 1800, h: 700, fit: "cover" },
  "banner-shops": { label: "Shops banner", help: "Wide photo, 1600 × 600 px. Shown at the top of Shops.", fallback: "public/images/shop-bakery-cover.jpg", out: "jpg", w: 1800, h: 700, fit: "cover" },
  "banner-groups": { label: "Groups banner", help: "Wide photo, 1600 × 600 px. Shown at the top of Groups.", fallback: "public/images/hero-trips.jpg", out: "jpg", w: 1800, h: 700, fit: "cover" },
  "banner-people": { label: "People banner", help: "Wide photo, 1600 × 600 px. Shown at the top of People.", fallback: "public/images/hero-landing.jpg", out: "jpg", w: 1800, h: 700, fit: "cover" },  cover: { label: "Default profile cover", help: "Used on profiles that have not chosen their own cover image. 1600 × 500 px.", fallback: "public/images/hero-trips.jpg", out: "jpg", w: 1600, h: 600, fit: "cover" },
} as const;
export type BrandKind = keyof typeof BRAND_SLOTS;
export const BRAND_KINDS = Object.keys(BRAND_SLOTS) as BrandKind[];
export const isBrandKind = (k: string): k is BrandKind => k in BRAND_SLOTS;

const dir = () => path.join(UPLOAD_ROOT, "brand");
const overridePath = (k: BrandKind) => path.join(dir(), `${k}.${BRAND_SLOTS[k].out}`);

export async function brandFile(kind: BrandKind): Promise<{ file: string; custom: boolean; mtime: number }> {
  try {
    const st = await fs.stat(overridePath(kind));
    return { file: overridePath(kind), custom: true, mtime: st.mtimeMs };
  } catch {
    const file = path.resolve(BRAND_SLOTS[kind].fallback);
    const st = await fs.stat(file).catch(() => null);
    return { file, custom: false, mtime: st?.mtimeMs ?? 0 };
  }
}

/** Public URL for a brand image. The version query busts caches whenever the image is replaced. */
export async function brandUrl(kind: BrandKind) {
  const b = await brandFile(kind);
  return `/api/brand/${kind}?v=${Math.round(b.mtime / 1000)}`;
}

export async function saveBrandImage(kind: BrandKind, input: Buffer) {
  const slot = BRAND_SLOTS[kind];
  if (input.length > 8 * 1024 * 1024) throw new Error("That file is larger than 8 MB.");
  let img: ReturnType<typeof sharp>;
  try { img = sharp(input, { failOn: "error" }); await img.metadata(); } catch { throw new Error("That file is not a valid image. Use PNG, JPG or WebP."); }
  const meta = await img.metadata();
  if (!["png", "jpeg", "webp"].includes(meta.format ?? "")) throw new Error("Use a PNG, JPG or WebP image.");
  if ((meta.width ?? 0) < 64 || (meta.height ?? 0) < 64) throw new Error("The image is too small. Use at least 64 × 64 px.");
  const pipeline = sharp(input).rotate().resize({ width: slot.w, height: slot.h, fit: slot.fit as "inside" | "cover", withoutEnlargement: slot.fit === "inside" });
  const out = slot.out === "png" ? await pipeline.png({ compressionLevel: 9 }).toBuffer() : await pipeline.jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  await fs.mkdir(dir(), { recursive: true });
  await fs.writeFile(overridePath(kind), out);
}

export async function resetBrandImage(kind: BrandKind) {
  await fs.rm(overridePath(kind), { force: true });
}
