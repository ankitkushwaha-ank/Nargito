import "server-only";
import { eq } from "drizzle-orm";
import { useDb, schema } from "../db";
import { isUuid } from "../util";
import { formatMoney } from "@/lib/format";

export type EntityType = "post" | "product" | "service" | "trip" | "company" | "shop" | "group";
export type EntityInfo = { type: EntityType; id: string; title: string; href: string; image: string | null; ownerId: string; subtitle: string | null; status: string; public: boolean };

/** Resolves any listable entity to a uniform shape (used by enquiries, promotions, saved items, reports). */
export async function resolveEntity(type: string, id: string): Promise<EntityInfo | null> {
  if (!isUuid(id)) return null;
  const db = await useDb();
  switch (type) {
    case "product": {
      const [r] = await db.select().from(schema.products).where(eq(schema.products.id, id));
      return r ? { type, id, title: r.title, href: `/products/${id}`, image: r.images[0] ?? null, ownerId: r.sellerId, subtitle: r.price ? formatMoney(r.price, r.currency) : null, status: r.status, public: r.status === "active" } : null;
    }
    case "service": {
      const [r] = await db.select().from(schema.services).where(eq(schema.services.id, id));
      return r ? { type, id, title: r.title, href: `/services/${id}`, image: r.images[0] ?? null, ownerId: r.providerId, subtitle: r.category, status: r.status, public: r.status === "active" } : null;
    }
    case "trip": {
      const [r] = await db.select().from(schema.trips).where(eq(schema.trips.id, id));
      return r ? { type, id, title: r.title, href: `/trips/${id}`, image: r.coverUrl, ownerId: r.ownerId, subtitle: r.destination, status: r.status, public: r.status === "published" && r.visibility === "public" } : null;
    }
    case "company": {
      const [r] = await db.select().from(schema.companies).where(eq(schema.companies.id, id));
      return r ? { type, id, title: r.name, href: `/companies/${r.slug}`, image: r.logoUrl, ownerId: r.ownerId, subtitle: r.industry, status: r.status, public: r.status === "active" } : null;
    }
    case "shop": {
      const [r] = await db.select().from(schema.shops).where(eq(schema.shops.id, id));
      return r ? { type, id, title: r.name, href: `/shops/${r.slug}`, image: r.logoUrl, ownerId: r.ownerId, subtitle: r.category, status: r.status, public: r.status === "active" } : null;
    }
    case "post": {
      const [r] = await db.select().from(schema.posts).where(eq(schema.posts.id, id));
      return r ? { type, id, title: r.body.slice(0, 80) || "Post", href: `/posts/${id}`, image: null, ownerId: r.authorId, subtitle: null, status: r.status, public: r.status === "published" && r.visibility === "public" } : null;
    }
    case "group": {
      const [r] = await db.select().from(schema.groups).where(eq(schema.groups.id, id));
      return r ? { type, id, title: r.name, href: `/groups/${r.slug}`, image: r.coverUrl, ownerId: r.ownerId, subtitle: r.category, status: r.status, public: r.status === "active" && r.visibility === "public" } : null;
    }
    default:
      return null;
  }
}
