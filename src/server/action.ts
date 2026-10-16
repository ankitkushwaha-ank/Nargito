import "server-only";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { AppError, fail } from "./util";
import { logSystem } from "./log";

export type SAResult = { ok: boolean; error?: string; message?: string; fieldErrors?: Record<string, string>; data?: unknown } | null;

/** Run a server action body, translating AppError into a user-safe failure and never leaking internals. */
export async function run(fn: () => Promise<SAResult | undefined | void>): Promise<SAResult> {
  try {
    const r = await fn();
    return (r as SAResult) ?? { ok: true };
  } catch (e) {
    if (isRedirectError(e)) throw e;
    if (e instanceof AppError) return fail(e.message);
    // Next.js control-flow errors (notFound etc.) carry a digest
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    await logSystem("error", "app", "server-action", e instanceof Error ? e.message : "Unhandled action error");
    return fail("Something went wrong. Please try again.");
  }
}
