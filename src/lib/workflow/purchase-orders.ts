import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { purchaseRequests, purchaseOrders, vendors, companies } from "@/db/schema";
import type { AuthContext } from "@/lib/auth-context";
import { allocateNumber } from "./numbering";
import { recordAudit, recordWorkflowHistory } from "./audit";
import { WorkflowError } from "./purchase-requests";

interface IssuePOInput {
  vendorId: string;
  deliveryDate: string;
  paymentTerms: string;
}

export async function issuePO(ctx: AuthContext, prId: string, input: IssuePOInput) {
  if (!ctx.capabilities.has("po:issue")) throw new WorkflowError("Not permitted", "FORBIDDEN");

  const [pr] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, prId)).limit(1);
  if (!pr) throw new WorkflowError("Not found", "NOT_FOUND");
  if (!ctx.authorizedCompanyIds.includes(pr.companyId)) throw new WorkflowError("Not found", "NOT_FOUND");
  if (pr.status !== "APPROVED_PENDING_PO") {
    throw new WorkflowError("This request is not ready for a purchase order", "CONFLICT");
  }

  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, input.vendorId)).limit(1);
  if (!vendor) throw new WorkflowError("Vendor not found", "NOT_FOUND");
  // Application-level enforcement of vendor/PR company match. The database's
  // composite FK (fk_po_vendor_company / fk_po_pr_company) is the backstop -
  // this check fails cleanly with a clear message before it ever gets there.
  if (vendor.companyId !== pr.companyId) {
    throw new WorkflowError("This vendor does not belong to the request's company", "VALIDATION");
  }
  if (!vendor.isActive) {
    throw new WorkflowError("This vendor is inactive", "VALIDATION");
  }

  const deliveryDate = new Date(input.deliveryDate);
  if (isNaN(deliveryDate.getTime()) || deliveryDate <= new Date()) {
    throw new WorkflowError("Delivery date must be in the future", "VALIDATION");
  }

  const [company] = await db.select().from(companies).where(eq(companies.id, pr.companyId)).limit(1);

  return db.transaction(async (tx) => {
    const poNumber = await allocateNumber(tx, pr.companyId, company?.code ?? "CO", "PO");

    const [po] = await tx
      .insert(purchaseOrders)
      .values({
        poNumber,
        prId: pr.id,
        vendorId: vendor.id,
        companyId: pr.companyId,
        amount: pr.amount,
        deliveryDate: input.deliveryDate,
        paymentTerms: input.paymentTerms,
        status: "ISSUED",
        issuedBy: ctx.userId,
      })
      .returning();

    const [updatedPR] = await tx
      .update(purchaseRequests)
      .set({ status: "PO_ISSUED", updatedAt: new Date() })
      .where(and(eq(purchaseRequests.id, prId), eq(purchaseRequests.status, "APPROVED_PENDING_PO")))
      .returning();

    if (!updatedPR) throw new WorkflowError("This request was already actioned", "CONFLICT");

    await recordWorkflowHistory(tx, {
      entityType: "PURCHASE_ORDER",
      entityId: po.id,
      actorId: ctx.userId,
      roleActedAs: "Procurement Officer",
      fromStatus: "APPROVED_PENDING_PO",
      toStatus: "PO_ISSUED",
    });
    await recordAudit(tx, {
      actorId: ctx.userId,
      action: "PO_ISSUED",
      entityType: "purchase_orders",
      entityId: po.id,
      companyId: pr.companyId,
      divisionId: pr.divisionId,
      afterState: { status: "ISSUED", vendorId: vendor.id, amount: pr.amount },
    });

    return po;
  });
}

export async function updatePOStatus(ctx: AuthContext, poId: string, targetStatus: "DELIVERED" | "CLOSED") {
  if (!ctx.capabilities.has("po:issue")) throw new WorkflowError("Not permitted", "FORBIDDEN");

  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
  if (!po) throw new WorkflowError("Not found", "NOT_FOUND");
  if (!ctx.authorizedCompanyIds.includes(po.companyId)) throw new WorkflowError("Not found", "NOT_FOUND");

  const validFrom = targetStatus === "DELIVERED" ? "ISSUED" : "DELIVERED";
  if (po.status !== validFrom) {
    throw new WorkflowError(`This purchase order must be ${validFrom} first`, "CONFLICT");
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(purchaseOrders)
      .set({ status: targetStatus, updatedAt: new Date() })
      .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.status, validFrom)))
      .returning();
    if (!updated) throw new WorkflowError("This purchase order was already actioned", "CONFLICT");

    await recordWorkflowHistory(tx, {
      entityType: "PURCHASE_ORDER",
      entityId: poId,
      actorId: ctx.userId,
      roleActedAs: "Procurement Officer",
      fromStatus: validFrom,
      toStatus: targetStatus,
    });
    await recordAudit(tx, {
      actorId: ctx.userId,
      action: `PO_${targetStatus}`,
      entityType: "purchase_orders",
      entityId: poId,
      companyId: po.companyId,
      afterState: { status: targetStatus },
    });
    return updated;
  });
}
