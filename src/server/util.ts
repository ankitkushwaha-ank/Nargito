import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const randomCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function slugify(input: string, max = 48) {
  const s = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return s || "item";
}

export function uniqueSuffix() {
  return randomBytes(3).toString("hex");
}

/** Only allow same-site relative redirects (prevents open redirects). */
export function safeRedirectPath(p: unknown, fallback = "/home") {
  if (typeof p !== "string") return fallback;
  if (!p.startsWith("/") || p.startsWith("//") || p.includes("\\") || /[\r\n]/.test(p)) return fallback;
  return p;
}

export function pairKey(a: string, b: string) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function clampInt(v: unknown, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function isUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/** Escape LIKE wildcards in user-provided search text. */
export function likeEscape(s: string) {
  return s.replace(/[\\%_]/g, (c) => "\\" + c);
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const ok = <T = undefined>(data?: T, message?: string): ActionResult<T> => ({ ok: true, data, message });
export const fail = (error: string, fieldErrors?: Record<string, string>): ActionResult<never> => ({ ok: false, error, fieldErrors });

export class AppError extends Error {
  constructor(public status: number, message: string, public code = "error") {
    super(message);
  }
}
