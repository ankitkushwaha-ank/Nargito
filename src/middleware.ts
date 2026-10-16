import { NextResponse, type NextRequest } from "next/server";

/**
 * Request-level concerns only: propagate the pathname and a request id to server components / logs.
 * Authorization is NEVER decided here - every page, action and route handler re-checks on the server.
 */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  headers.set("x-request-id", crypto.randomUUID());
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|brand/|sw.js|favicon.ico).*)"],
};
