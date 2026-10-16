import { promises as fs } from "node:fs";
import { NextResponse, type NextRequest } from "next/server";
import { BRAND_SLOTS, brandFile, isBrandKind } from "@/server/brand";

export const dynamic = "force-dynamic";

/** Public brand images (logo, favicon, share banner, home banners). Serves the admin upload or the bundled default. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!isBrandKind(kind)) return new NextResponse("Not found", { status: 404 });
  const { file, mtime } = await brandFile(kind);
  try {
    const data = await fs.readFile(file);
    const type = file.endsWith(".png") ? "image/png" : "image/jpeg";
    return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400", ETag: `"${Math.round(mtime)}-${data.length}"` } });
  } catch {
    // Hosts that do not ship the public/ folder next to the server (serverless, standalone): send the browser to the static copy.
    const url = "/" + BRAND_SLOTS[kind].fallback.replace(/^public\//, "");
    return NextResponse.redirect(new URL(url, _req.nextUrl.origin), 307);
  }
}
