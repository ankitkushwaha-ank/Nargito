import { NextResponse, type NextRequest } from "next/server";
import { readMedia } from "@/server/media";
import { getSessionUser } from "@/server/auth/session";
import { hasPermission } from "@/server/auth/guard";
import { isUuid } from "@/server/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return new NextResponse("Not found", { status: 404 });
  const thumb = req.nextUrl.searchParams.get("thumb") === "1";
  const r = await readMedia(id, thumb);
  if (!r) return new NextResponse("Not found", { status: 404 });
  if (r.m.isPrivate) {
    const u = await getSessionUser();
    const allowed = u && (u.id === r.m.ownerId || (await hasPermission(u, "verification.manage")));
    if (!allowed) return new NextResponse("Not found", { status: 404 });
  }
  if (r.redirect || !r.data) return NextResponse.redirect(r.redirect!, 302);
  const isDoc = r.m.kind === "document";
  return new NextResponse(new Uint8Array(r.data), {
    headers: {
      "Content-Type": r.mime,
      "Content-Length": String(r.data.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": isDoc ? `attachment; filename="document-${id.slice(0, 8)}.pdf"` : "inline",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
      "Cache-Control": r.m.isPrivate ? "private, no-store" : "public, max-age=31536000, immutable",
    },
  });
}
