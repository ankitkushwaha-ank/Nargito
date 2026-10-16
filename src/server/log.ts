import "server-only";
import { headers } from "next/headers";
import { useDb, schema } from "./db";

const SENSITIVE = /(pass(word)?|token|secret|otp|code|authorization|cookie|api[-_]?key|card|lat|lng|latitude|longitude|body)/i;

/** Redact obviously sensitive keys from structured metadata before persisting. */
export function redact(value: unknown, depth = 0): unknown {
  if (value == null || depth > 4) return value ?? null;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") return value.length > 500 ? value.slice(0, 500) + "…" : value;
  return value;
}

export async function requestMeta() {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "local";
    return { ip, userAgent: h.get("user-agent")?.slice(0, 200) ?? null, correlationId: h.get("x-request-id") ?? undefined };
  } catch {
    return { ip: "local", userAgent: null, correlationId: undefined };
  }
}

export async function logSystem(
  level: "debug" | "info" | "warn" | "error",
  category: string,
  component: string,
  message: string,
  meta?: Record<string, unknown>,
  extra?: { userId?: string; status?: number; durationMs?: number },
) {
  try {
    const db = await useDb();
    const rm = await requestMeta();
    await db.insert(schema.systemLogs).values({
      level, category, component,
      message: message.slice(0, 1000),
      correlationId: rm.correlationId ?? null,
      userId: extra?.userId ?? null,
      status: extra?.status ?? null,
      durationMs: extra?.durationMs ?? null,
      meta: (redact(meta) as Record<string, unknown>) ?? null,
    });
  } catch {
    // logging must never break a request
  }
  if (level === "error") console.error(`[${component}] ${message}`);
}

export async function audit(actorId: string | null, action: string, entityType?: string, entityId?: string, meta?: Record<string, unknown>) {
  try {
    const db = await useDb();
    const rm = await requestMeta();
    await db.insert(schema.auditLogs).values({
      actorId, action, entityType: entityType ?? null, entityId: entityId ?? null,
      meta: (redact(meta) as Record<string, unknown>) ?? null, ip: rm.ip,
    });
  } catch (e) {
    console.error("audit failed", e);
  }
}

export async function securityEvent(type: string, userId: string | null, meta?: Record<string, unknown>) {
  try {
    const db = await useDb();
    const rm = await requestMeta();
    await db.insert(schema.securityEvents).values({
      type, userId, ip: rm.ip, userAgent: rm.userAgent, meta: (redact(meta) as Record<string, unknown>) ?? null,
    });
  } catch {
    /* ignore */
  }
}
