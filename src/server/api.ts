import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { AppError } from "./util";
import { logSystem } from "./log";
import { rateLimitKey } from "./ratelimit";
import { getSetting } from "./settings";

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients / same-origin GET navigations; cookies are SameSite=Lax
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return o.host === host;
  } catch {
    return false;
  }
}

export type Ctx<P = Record<string, string>> = { params: Promise<P> };

/** Wraps a route handler: CSRF origin check for mutations, global rate limit, uniform JSON errors, request logging. */
export function api<P = Record<string, string>>(
  handler: (req: NextRequest, ctx: Ctx<P>) => Promise<Response | unknown>,
  opts: { limitPerMinute?: number } = {},
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    const started = Date.now();
    let status = 200;
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !sameOrigin(req)) throw new AppError(403, "Cross-origin request blocked.", "csrf");
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "local";
      const limit = opts.limitPerMinute ?? (await getSetting<number>("runtime.maxRequestsPerMinute"));
      const rl = rateLimitKey(`api:${ip}`, limit, 60);
      if (!rl.allowed) throw new AppError(429, "Too many requests.", "rate_limited");
      const out = await handler(req, ctx);
      if (out instanceof Response) {
        status = out.status;
        return out;
      }
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof AppError) {
        status = e.status;
        return NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: e.status });
      }
      status = 500;
      await logSystem("error", "api", req.nextUrl.pathname, e instanceof Error ? e.message : "Unhandled error", { method: req.method });
      return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
    } finally {
      if (status >= 500 || Math.random() < 0.02) {
        await logSystem(status >= 500 ? "error" : "info", "api", req.nextUrl.pathname, `${req.method} ${status}`, undefined, { status, durationMs: Date.now() - started });
      }
    }
  };
}
