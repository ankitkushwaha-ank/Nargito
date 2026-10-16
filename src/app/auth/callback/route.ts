import { NextResponse, type NextRequest } from "next/server";
import { finishOAuth } from "@/server/auth/oauth";
import { rateLimitKey } from "@/server/ratelimit";
import { logSystem } from "@/server/log";
import { safeRedirectPath } from "@/server/util";

export const dynamic = "force-dynamic";

/** Single OAuth redirect URI for Google and Facebook: https://<host>/auth/callback */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "local";
  if (!rateLimitKey(`oauth-cb:${ip}`, 30, 600).allowed) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Too many attempts. Try again later.")}`);
  try {
    const sp = req.nextUrl.searchParams;
    const r = await finishOAuth(sp.get("code"), sp.get("state"), sp.get("error"));
    if (!r.ok) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(r.error)}`);
    return NextResponse.redirect(`${origin}${safeRedirectPath(r.next, "/home")}`);
  } catch (e) {
    await logSystem("error", "app", "oauth-callback", e instanceof Error ? e.message : "oauth failure");
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Sign-in failed. Please try again.")}`);
  }
}
