import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { useDb, schema } from "./db";
import { audit } from "./log";
import { AppError } from "./util";

/**
 * Two-person rule for critical operations.
 * The first administrator "requests" an action key; a DIFFERENT administrator with approvals.decide approves it;
 * only then does the original operation proceed (and the approval is consumed).
 */
export async function checkApproval(requesterId: string, key: string, payload?: Record<string, unknown>): Promise<"approved" | "pending"> {
  const db = await useDb();
  const [approved] = await db.select().from(schema.adminApprovals).where(and(eq(schema.adminApprovals.action, key), eq(schema.adminApprovals.status, "approved"))).orderBy(desc(schema.adminApprovals.createdAt)).limit(1);
  if (approved && approved.approvedBy && approved.approvedBy !== requesterId) {
    await db.update(schema.adminApprovals).set({ status: "executed" }).where(eq(schema.adminApprovals.id, approved.id));
    return "approved";
  }
  const [pending] = await db.select().from(schema.adminApprovals).where(and(eq(schema.adminApprovals.action, key), eq(schema.adminApprovals.status, "pending"))).limit(1);
  if (!pending) {
    await db.insert(schema.adminApprovals).values({ action: key, payload: payload ?? null, requestedBy: requesterId });
    await audit(requesterId, "approval.requested", "approval", key);
  }
  return "pending";
}

export async function decideApproval(approverId: string, id: string, approve: boolean) {
  const db = await useDb();
  const [a] = await db.select().from(schema.adminApprovals).where(eq(schema.adminApprovals.id, id));
  if (!a || a.status !== "pending") throw new AppError(404, "Approval request not found.");
  if (a.requestedBy === approverId) throw new AppError(403, "You cannot approve your own request. Ask another administrator.");
  await db.update(schema.adminApprovals).set({ status: approve ? "approved" : "rejected", approvedBy: approverId, decidedAt: new Date() }).where(eq(schema.adminApprovals.id, id));
  await audit(approverId, approve ? "approval.approved" : "approval.rejected", "approval", a.action);
}
