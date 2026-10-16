import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/server/auth/guard";
import { useDb, schema } from "@/server/db";
import { audit } from "@/server/log";
import { AppError } from "@/server/util";
import { rateLimitKey } from "@/server/ratelimit";

export const dynamic = "force-dynamic";

/** Machine-readable copy of the signed-in user's own data. Never includes other people's private data or credentials. */
export async function GET() {
  try {
    const u = await requireUser();
    if (!rateLimitKey(`export:${u.id}`, 3, 3600).allowed) return NextResponse.json({ ok: false, error: "Too many exports. Try later." }, { status: 429 });
    const db = await useDb();
    const [profile] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    const { passwordHash: _p, mfaSecret: _m, ...safe } = profile!;
    void _p; void _m;
    const data = {
      exportedAt: new Date().toISOString(),
      profile: safe,
      posts: await db.select().from(schema.posts).where(eq(schema.posts.authorId, u.id)),
      comments: await db.select().from(schema.comments).where(eq(schema.comments.authorId, u.id)),
      trips: await db.select().from(schema.trips).where(eq(schema.trips.ownerId, u.id)),
      products: await db.select().from(schema.products).where(eq(schema.products.sellerId, u.id)),
      services: await db.select().from(schema.services).where(eq(schema.services.providerId, u.id)),
      savedItems: await db.select().from(schema.savedItems).where(eq(schema.savedItems.userId, u.id)),
      following: await db.select().from(schema.follows).where(eq(schema.follows.followerId, u.id)),
      messagesSent: (await db.select({ conversationId: schema.messages.conversationId, body: schema.messages.body, createdAt: schema.messages.createdAt }).from(schema.messages).where(eq(schema.messages.senderId, u.id))),
    };
    await audit(u.id, "data.export_download", "user", u.id);
    return new NextResponse(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="nargito-export-${u.username}.json"`, "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    return NextResponse.json({ ok: false, error: "Export failed." }, { status: 500 });
  }
}
