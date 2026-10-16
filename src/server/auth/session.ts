import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { useDb, schema } from "../db";
import { randomToken, sha256 } from "../util";
import { requestMeta } from "../log";

export const SESSION_COOKIE = "nargito_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string) {
  const db = await useDb();
  const token = randomToken(32);
  const rm = await requestMeta();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(schema.sessions).values({ userId, tokenHash: sha256(token), expiresAt, ip: rm.ip, userAgent: rm.userAgent });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await useDb();
    await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.tokenHash, sha256(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function revokeAllSessions(userId: string, exceptTokenHash?: string) {
  const db = await useDb();
  const rows = await db.select({ id: schema.sessions.id, h: schema.sessions.tokenHash }).from(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
  for (const r of rows) {
    if (r.h === exceptTokenHash) continue;
    await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.id, r.id));
  }
}

export type SessionUser = typeof schema.users.$inferSelect & { sessionId: string; sessionHash: string; stepUpAt: Date | null };

/** Resolve the signed-in user (once per request). Returns null for anonymous, banned or suspended-out sessions. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await useDb();
  const hash = sha256(token);
  const rows = await db
    .select({ s: schema.sessions, u: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, hash), isNull(schema.sessions.revokedAt), gt(schema.sessions.expiresAt, new Date()), isNull(schema.users.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.u.status === "banned") return null;
  const last = row.s.lastUsedAt?.getTime() ?? 0;
  if (Date.now() - last > 60_000) {
    await db.update(schema.sessions).set({ lastUsedAt: new Date() }).where(eq(schema.sessions.id, row.s.id));
    await db.update(schema.users).set({ lastSeenAt: new Date() }).where(eq(schema.users.id, row.u.id));
  }
  return { ...row.u, sessionId: row.s.id, sessionHash: hash, stepUpAt: row.s.stepUpAt };
});

export async function markStepUp(sessionId: string) {
  const db = await useDb();
  await db.update(schema.sessions).set({ stepUpAt: new Date() }).where(eq(schema.sessions.id, sessionId));
}

export async function cleanupExpiredSessions() {
  const db = await useDb();
  const r = await db.delete(schema.sessions).where(sql`${schema.sessions.expiresAt} < now() - interval '7 days'`);
  return r;
}
