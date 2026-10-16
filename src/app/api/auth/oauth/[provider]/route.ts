import { NextResponse, type NextRequest } from "next/server";
import { beginOAuth, providerStatus, type Provider } from "@/server/auth/oauth";
import { getSessionUser } from "@/server/auth/session";
import { safeRedirectPath } from "@/server/util";
import { rateLimitKey } from "@/server/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const origin = req.nextUrl.origin;
  if (provider !== "google" && provider !== "facebook") return NextResponse.json({ ok: false, error: "Unknown provider" }, { status: 404 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "local";
  if (!rateLimitKey(`oauth-start:${ip}`, 20, 600).allowed) return NextResponse.json({ ok: false, error: "Too many attempts" }, { status: 429 });
  const st = await providerStatus(provider as Provider);
  if (!st.available) {
    const msg = st.configured ? "This sign-in method is disabled." : "This sign-in method is not configured yet.";
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);
  }
  const link = req.nextUrl.searchParams.get("link") === "1";
  const user = link ? await getSessionUser() : null;
  if (link && !user) return NextResponse.redirect(`${origin}/login`);
  const url = await beginOAuth(provider as Provider, { link: user?.id, next: safeRedirectPath(req.nextUrl.searchParams.get("next"), "/home") });
  return NextResponse.redirect(url);
}
