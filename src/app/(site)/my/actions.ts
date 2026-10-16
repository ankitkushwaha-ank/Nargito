"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { run, type SAResult } from "@/server/action";
import { requireActiveUser, requireUser } from "@/server/auth/guard";
import { formToObject } from "@/server/validation";
import { saveProduct, saveService, saveTrip, decideParticipant } from "@/server/services/listings";
import { saveCompany, saveShop, createGroup, addMember, removeMember, submitVerification, joinGroup, leaveGroup, decideGroupRequest } from "@/server/services/business";
import { createPromotion, setPromotionStatus } from "@/server/services/promotions";
import { requestToJoin } from "@/server/services/listings";
import { isUuid, fail } from "@/server/util";
import { useDb, schema } from "@/server/db";
import { and, eq } from "drizzle-orm";
import { audit } from "@/server/log";

const idOf = (fd: FormData) => { const v = String(fd.get("id") ?? ""); return isUuid(v) ? v : null; };

export async function saveProductAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireActiveUser();
    const r = await saveProduct(u.id, idOf(fd), formToObject(fd));
    if (!r.ok) return r;
    revalidatePath("/my/listings");
    redirect(`/products/${r.data!.id}`);
  });
}
export async function saveServiceAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireActiveUser();
    const r = await saveService(u.id, idOf(fd), formToObject(fd));
    if (!r.ok) return r;
    revalidatePath("/my/listings");
    redirect(`/services/${r.data!.id}`);
  });
}
export async function saveTripAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireActiveUser();
    const r = await saveTrip(u.id, idOf(fd), formToObject(fd));
    if (!r.ok) return r;
    revalidatePath("/my/trips");
    redirect(`/trips/${r.data!.id}`);
  });
}
export async function saveCompanyAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireActiveUser();
    const r = await saveCompany(u.id, idOf(fd), formToObject(fd));
    if (!r.ok) return r;
    revalidatePath("/my/businesses");
    redirect(`/companies/${r.data!.slug}`);
  });
}
export async function saveShopAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireActiveUser();
    const r = await saveShop(u.id, idOf(fd), formToObject(fd));
    if (!r.ok) return r;
    revalidatePath("/my/businesses");
    redirect(`/shops/${r.data!.slug}`);
  });
}
export async function createGroupAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireActiveUser();
    const r = await createGroup(u.id, formToObject(fd));
    if (!r.ok) return r;
    redirect(`/groups/${r.data!.slug}`);
  });
}

export async function setListingStatusAction(fd: FormData) {
  const u = await requireUser();
  const type = String(fd.get("type")); const id = String(fd.get("id")); const status = String(fd.get("status"));
  if (!isUuid(id)) return;
  const db = await useDb();
  const { canManageProduct, canManageService } = await import("@/server/services/listings");
  if (type === "product" && ["active", "sold", "archived", "draft"].includes(status)) {
    const [p] = await db.select().from(schema.products).where(eq(schema.products.id, id));
    if (p && p.status !== "removed" && (await canManageProduct(u.id, p))) {
      await db.update(schema.products).set({ status, updatedAt: new Date() }).where(eq(schema.products.id, id));
      await db.insert(schema.listingStatusHistory).values({ listingType: "product", listingId: id, fromStatus: p.status, toStatus: status, changedBy: u.id });
    }
  } else if (type === "service" && ["active", "archived", "draft"].includes(status)) {
    const [s] = await db.select().from(schema.services).where(eq(schema.services.id, id));
    if (s && s.status !== "removed" && (await canManageService(u.id, s))) {
      await db.update(schema.services).set({ status, updatedAt: new Date() }).where(eq(schema.services.id, id));
      await db.insert(schema.listingStatusHistory).values({ listingType: "service", listingId: id, fromStatus: s.status, toStatus: status, changedBy: u.id });
    }
  } else if (type === "trip" && ["published", "completed", "cancelled", "draft"].includes(status)) {
    const [t] = await db.select().from(schema.trips).where(and(eq(schema.trips.id, id), eq(schema.trips.ownerId, u.id)));
    if (t && t.status !== "removed") await db.update(schema.trips).set({ status, updatedAt: new Date() }).where(eq(schema.trips.id, id));
  }
  revalidatePath("/my/listings"); revalidatePath("/my/trips");
}

export async function joinTripAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireActiveUser();
    const r = await requestToJoin(u.id, String(fd.get("tripId")), String(fd.get("message") ?? ""));
    revalidatePath(`/trips/${fd.get("tripId")}`);
    return r;
  });
}
export async function decideParticipantAction(fd: FormData) {
  const u = await requireUser();
  const decision = String(fd.get("decision")) === "approved" ? "approved" : "declined";
  await decideParticipant(u.id, String(fd.get("tripId")), String(fd.get("userId")), decision);
  revalidatePath(`/trips/${fd.get("tripId")}`);
}

export async function addMemberAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireActiveUser();
    const kind = fd.get("kind") === "shop" ? "shop" : "company";
    const entityId = String(fd.get("entityId"));
    if (!isUuid(entityId)) return fail("Invalid business.");
    const r = await addMember(u.id, kind, entityId, String(fd.get("username") ?? ""), String(fd.get("role") ?? "editor"));
    revalidatePath("/my/businesses");
    return r;
  });
}
export async function removeMemberAction(fd: FormData) {
  const u = await requireUser();
  const kind = fd.get("kind") === "shop" ? "shop" : "company";
  await removeMember(u.id, kind, String(fd.get("entityId")), String(fd.get("userId")));
  revalidatePath("/my/businesses");
}

export async function verificationRequestAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireActiveUser();
    const kindRaw = String(fd.get("kind"));
    const kind = kindRaw === "company" || kindRaw === "shop" ? kindRaw : "user";
    const evidence = fd.getAll("evidence").map(String).filter(isUuid);
    const r = await submitVerification(u.id, kind, kind === "user" ? null : String(fd.get("entityId")), String(fd.get("note") ?? ""), evidence);
    revalidatePath("/my/businesses");
    return r;
  });
}

export async function createPromotionAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    const u = await requireActiveUser();
    const r = await createPromotion(u.id, formToObject(fd));
    revalidatePath("/my/ads");
    return r;
  });
}
export async function promotionStatusAction(fd: FormData) {
  const u = await requireUser();
  const status = String(fd.get("status"));
  if (status === "paused" || status === "active" || status === "ended") await setPromotionStatus(u, String(fd.get("id")), status);
  revalidatePath("/my/ads");
}

export async function groupMembershipAction(fd: FormData) {
  const u = await requireActiveUser();
  const groupId = String(fd.get("groupId"));
  const intent = String(fd.get("intent"));
  if (intent === "join") await joinGroup(u.id, groupId);
  else if (intent === "leave") await leaveGroup(u.id, groupId);
  else if (intent === "approve" || intent === "decline") await decideGroupRequest(u.id, groupId, String(fd.get("userId")), intent === "approve");
  revalidatePath(`/groups`);
}

export async function deleteBusinessAction(fd: FormData) {
  const u = await requireUser();
  const kind = fd.get("kind") === "shop" ? "shop" : "company";
  const id = String(fd.get("id"));
  if (!isUuid(id)) return;
  const db = await useDb();
  if (kind === "company") await db.update(schema.companies).set({ status: "hidden" }).where(and(eq(schema.companies.id, id), eq(schema.companies.ownerId, u.id)));
  else await db.update(schema.shops).set({ status: "hidden" }).where(and(eq(schema.shops.id, id), eq(schema.shops.ownerId, u.id)));
  await audit(u.id, `${kind}.hide`, kind, id);
  redirect("/my/businesses");
}
