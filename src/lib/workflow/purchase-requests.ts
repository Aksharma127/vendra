import "server-only";
import { and, eq, sql as sqlRaw } from "drizzle-orm";
import { db } from "@/db";
import {
  purchaseRequests,
  divisions,
  companies,
  config,
} from "@/db/schema";
import type { AuthContext } from "@/lib/auth-context";
import { getAuthorizedDivisionIds } from "@/lib/auth-context";
import { allocateNumber } from "./numbering";
import { recordAudit, recordWorkflowHistory } from "./audit";

export class WorkflowError extends Error {
  constructor(
    message: string,
    public code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION"
  ) {
    super(message);
  }
}

async function getConfigNumber(key: string, companyId: string | null, fallback: number) {
  const rows = await db.select().from(config).where(eq(config.key, key));
  const override = rows.find((r) => r.companyId === companyId);
  const global = rows.find((r) => r.companyId === null);
  const raw = override?.value ?? global?.value;
  return raw ? Number(raw) : fallback;
}

interface CreateInput {
  divisionId: string;
  category: string;
  itemDescription: string;
  quantity: number;
  estimatedUnitCost: number;
  justification?: string;
}

/** Create a DRAFT. companyId is ALWAYS derived server-side from divisionId -
 * the client can never supply it, so a manipulated companyId in the request
 * body has nothing to attach to. */
export async function createDraft(ctx: AuthContext, input: CreateInput) {
  if (!ctx.capabilities.has("pr:create")) throw new WorkflowError("Not permitted", "FORBIDDEN");

  const [division] = await db
    .select()
    .from(divisions)
    .innerJoin(companies, eq(divisions.companyId, companies.id))
    .where(eq(divisions.id, input.divisionId))
    .limit(1);

  if (!division) throw new WorkflowError("Division not found", "NOT_FOUND");

  // Company-first gate, then division re-check, exactly as the scoping algorithm requires.
  if (!ctx.authorizedDivisionIds.includes(input.divisionId)) {
    throw new WorkflowError("You are not authorized to raise requests for this division", "FORBIDDEN");
  }
  if (!division.divisions.isActive || !division.companies.isActive) {
    throw new WorkflowError("This division or company is currently inactive", "VALIDATION");
  }
  if (input.quantity <= 0 || input.estimatedUnitCost <= 0) {
    throw new WorkflowError("Quantity and cost must be greater than zero", "VALIDATION");
  }

  const amount = input.quantity * input.estimatedUnitCost;
  const threshold = await getConfigNumber("justificationThreshold", division.divisions.companyId, 50000);
  if (amount > threshold && !input.justification?.trim()) {
    throw new WorkflowError("Justification is required for requests above the threshold", "VALIDATION");
  }

  const [pr] = await db
    .insert(purchaseRequests)
    .values({
      companyId: division.divisions.companyId,
      divisionId: input.divisionId,
      requesterId: ctx.userId,
      category: input.category,
      itemDescription: input.itemDescription,
      quantity: String(input.quantity),
      estimatedUnitCost: String(input.estimatedUnitCost),
      amount: String(amount),
      justification: input.justification ?? null,
      status: "DRAFT",
    })
    .returning();

  return pr;
}

export async function editDraft(ctx: AuthContext, prId: string, input: Partial<CreateInput>) {
  const [pr] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, prId)).limit(1);
  if (!pr) throw new WorkflowError("Not found", "NOT_FOUND");
  if (pr.requesterId !== ctx.userId) throw new WorkflowError("Not your request", "FORBIDDEN");
  if (pr.status !== "DRAFT") throw new WorkflowError("Only drafts can be edited", "CONFLICT");

  let divisionId = pr.divisionId;
  let companyId = pr.companyId;
  if (input.divisionId && input.divisionId !== pr.divisionId) {
    if (!ctx.authorizedDivisionIds.includes(input.divisionId)) {
      throw new WorkflowError("You are not authorized to raise requests for this division", "FORBIDDEN");
    }
    const [division] = await db.select().from(divisions).where(eq(divisions.id, input.divisionId)).limit(1);
    if (!division) throw new WorkflowError("Division not found", "NOT_FOUND");
    divisionId = division.id;
    companyId = division.companyId;
  }

  const quantity = input.quantity ?? Number(pr.quantity);
  const estimatedUnitCost = input.estimatedUnitCost ?? Number(pr.estimatedUnitCost);
  const amount = quantity * estimatedUnitCost;

  const [updated] = await db
    .update(purchaseRequests)
    .set({
      divisionId,
      companyId,
      category: input.category ?? pr.category,
      itemDescription: input.itemDescription ?? pr.itemDescription,
      quantity: String(quantity),
      estimatedUnitCost: String(estimatedUnitCost),
      amount: String(amount),
      justification: input.justification ?? pr.justification,
      updatedAt: new Date(),
    })
    .where(and(eq(purchaseRequests.id, prId), eq(purchaseRequests.status, "DRAFT")))
    .returning();

  if (!updated) throw new WorkflowError("This request is no longer a draft", "CONFLICT");
  return updated;
}

async function loadCompanyCode(companyId: string) {
  const [c] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  return c?.code ?? "CO";
}

/** DRAFT or RETURNED_FOR_REVISION -> PENDING_DIVISION_APPROVAL. Allocates the
 * PR number on first submission only (prNumber stays null while DRAFT). */
export async function submitPR(ctx: AuthContext, prId: string) {
  const [pr] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, prId)).limit(1);
  if (!pr) throw new WorkflowError("Not found", "NOT_FOUND");
  if (pr.requesterId !== ctx.userId) throw new WorkflowError("Not your request", "FORBIDDEN");
  if (pr.status !== "DRAFT" && pr.status !== "RETURNED_FOR_REVISION") {
    throw new WorkflowError("This request cannot be submitted from its current state", "CONFLICT");
  }

  const [division] = await db
    .select()
    .from(divisions)
    .innerJoin(companies, eq(divisions.companyId, companies.id))
    .where(eq(divisions.id, pr.divisionId))
    .limit(1);
  if (!division?.divisions.isActive || !division?.companies.isActive) {
    throw new WorkflowError("This division or company is currently inactive", "VALIDATION");
  }

  return db.transaction(async (tx) => {
    let prNumber = pr.prNumber;
    if (!prNumber) {
      const companyCode = await loadCompanyCode(pr.companyId);
      prNumber = await allocateNumber(tx, pr.companyId, companyCode, "PR");
    }

    const [updated] = await tx
      .update(purchaseRequests)
      .set({ status: "PENDING_DIVISION_APPROVAL", prNumber, updatedAt: new Date() })
      .where(
        and(
          eq(purchaseRequests.id, prId),
          // CAS: only succeeds if status hasn't moved since we read it above
          eq(purchaseRequests.status, pr.status)
        )
      )
      .returning();

    if (!updated) throw new WorkflowError("This request was already actioned", "CONFLICT");

    await recordWorkflowHistory(tx, {
      entityType: "PURCHASE_REQUEST",
      entityId: prId,
      actorId: ctx.userId,
      roleActedAs: "Employee",
      fromStatus: pr.status,
      toStatus: "PENDING_DIVISION_APPROVAL",
    });
    await recordAudit(tx, {
      actorId: ctx.userId,
      action: "PR_SUBMITTED",
      entityType: "purchase_requests",
      entityId: prId,
      companyId: pr.companyId,
      divisionId: pr.divisionId,
      afterState: { status: "PENDING_DIVISION_APPROVAL", amount: pr.amount },
    });

    return updated;
  });
}

/** DRAFT or PENDING_DIVISION_APPROVAL only - narrower than earlier drafts of
 * this design, per the approved final decision: once Division Approval has
 * occurred, the employee can no longer withdraw. */
export async function withdrawPR(ctx: AuthContext, prId: string) {
  const [pr] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, prId)).limit(1);
  if (!pr) throw new WorkflowError("Not found", "NOT_FOUND");
  if (pr.requesterId !== ctx.userId) throw new WorkflowError("Not your request", "FORBIDDEN");
  if (pr.status !== "DRAFT" && pr.status !== "PENDING_DIVISION_APPROVAL") {
    throw new WorkflowError("This request can no longer be withdrawn", "CONFLICT");
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(purchaseRequests)
      .set({ status: "WITHDRAWN", updatedAt: new Date() })
      .where(and(eq(purchaseRequests.id, prId), eq(purchaseRequests.status, pr.status)))
      .returning();
    if (!updated) throw new WorkflowError("This request was already actioned", "CONFLICT");

    await recordWorkflowHistory(tx, {
      entityType: "PURCHASE_REQUEST",
      entityId: prId,
      actorId: ctx.userId,
      roleActedAs: "Employee",
      fromStatus: pr.status,
      toStatus: "WITHDRAWN",
    });
    await recordAudit(tx, {
      actorId: ctx.userId,
      action: "PR_WITHDRAWN",
      entityType: "purchase_requests",
      entityId: prId,
      companyId: pr.companyId,
      divisionId: pr.divisionId,
      afterState: { status: "WITHDRAWN" },
    });
    return updated;
  });
}

type DivisionAction = "approve" | "reject" | "return";

export async function actOnDivisionApproval(
  ctx: AuthContext,
  prId: string,
  action: DivisionAction,
  comment?: string
) {
  if (!ctx.capabilities.has("pr:approve-division")) throw new WorkflowError("Not permitted", "FORBIDDEN");
  const [pr] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, prId)).limit(1);
  if (!pr) throw new WorkflowError("Not found", "NOT_FOUND");
  if (!ctx.authorizedDivisionIds.includes(pr.divisionId)) throw new WorkflowError("Not found", "NOT_FOUND");
  if (pr.status !== "PENDING_DIVISION_APPROVAL") {
    throw new WorkflowError("This request is not awaiting division approval", "CONFLICT");
  }
  if (action !== "approve" && !comment?.trim()) {
    throw new WorkflowError("A comment is required to reject or return a request", "VALIDATION");
  }

  const targetStatus =
    action === "approve" ? "PENDING_FINANCE_APPROVAL" : action === "reject" ? "REJECTED" : "RETURNED_FOR_REVISION";

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(purchaseRequests)
      .set({ status: targetStatus, updatedAt: new Date() })
      .where(and(eq(purchaseRequests.id, prId), eq(purchaseRequests.status, "PENDING_DIVISION_APPROVAL")))
      .returning();
    if (!updated) throw new WorkflowError("This request was already actioned", "CONFLICT");

    await recordWorkflowHistory(tx, {
      entityType: "PURCHASE_REQUEST",
      entityId: prId,
      actorId: ctx.userId,
      roleActedAs: "Division Manager",
      fromStatus: "PENDING_DIVISION_APPROVAL",
      toStatus: targetStatus,
      comment,
    });
    await recordAudit(tx, {
      actorId: ctx.userId,
      action: `PR_DIVISION_${action.toUpperCase()}`,
      entityType: "purchase_requests",
      entityId: prId,
      companyId: pr.companyId,
      divisionId: pr.divisionId,
      afterState: { status: targetStatus },
    });
    return updated;
  });
}

/**
 * Finance approval. Below threshold: single approver completes the
 * transition. Above threshold: requires two DISTINCT approvers.
 *
 * Concurrency note: the first-approver claim is its own atomic operation
 * (WHERE finance_first_approver_id IS NULL), never a same-value CAS - two
 * simultaneous claims can only ever let one of them succeed, and the loser
 * re-reads the row to see if it can complete as the (different) second
 * approver instead of erroring outright.
 */
export async function actOnFinanceApproval(
  ctx: AuthContext,
  prId: string,
  action: "approve" | "reject",
  comment?: string
) {
  if (!ctx.capabilities.has("pr:approve-finance")) throw new WorkflowError("Not permitted", "FORBIDDEN");
  const [pr] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, prId)).limit(1);
  if (!pr) throw new WorkflowError("Not found", "NOT_FOUND");
  if (!ctx.authorizedCompanyIds.includes(pr.companyId)) throw new WorkflowError("Not found", "NOT_FOUND");
  if (pr.status !== "PENDING_FINANCE_APPROVAL") {
    throw new WorkflowError("This request is not awaiting finance approval", "CONFLICT");
  }
  if (action === "reject" && !comment?.trim()) {
    throw new WorkflowError("A comment is required to reject a request", "VALIDATION");
  }

  if (action === "reject") {
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(purchaseRequests)
        .set({ status: "REJECTED", updatedAt: new Date() })
        .where(and(eq(purchaseRequests.id, prId), eq(purchaseRequests.status, "PENDING_FINANCE_APPROVAL")))
        .returning();
      if (!updated) throw new WorkflowError("This request was already actioned", "CONFLICT");
      await recordWorkflowHistory(tx, {
        entityType: "PURCHASE_REQUEST",
        entityId: prId,
        actorId: ctx.userId,
        roleActedAs: "Finance Approver",
        fromStatus: "PENDING_FINANCE_APPROVAL",
        toStatus: "REJECTED",
        comment,
      });
      await recordAudit(tx, {
        actorId: ctx.userId,
        action: "PR_FINANCE_REJECT",
        entityType: "purchase_requests",
        entityId: prId,
        companyId: pr.companyId,
        divisionId: pr.divisionId,
        afterState: { status: "REJECTED" },
      });
      return updated;
    });
  }

  const threshold = await getConfigNumber("financeSecondaryThreshold", pr.companyId, 500000);
  const needsSecondApprover = Number(pr.amount) > threshold;

  if (!needsSecondApprover) {
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(purchaseRequests)
        .set({ status: "APPROVED_PENDING_PO", updatedAt: new Date() })
        .where(and(eq(purchaseRequests.id, prId), eq(purchaseRequests.status, "PENDING_FINANCE_APPROVAL")))
        .returning();
      if (!updated) throw new WorkflowError("This request was already actioned", "CONFLICT");
      await recordWorkflowHistory(tx, {
        entityType: "PURCHASE_REQUEST",
        entityId: prId,
        actorId: ctx.userId,
        roleActedAs: "Finance Approver",
        fromStatus: "PENDING_FINANCE_APPROVAL",
        toStatus: "APPROVED_PENDING_PO",
        comment,
      });
      await recordAudit(tx, {
        actorId: ctx.userId,
        action: "PR_FINANCE_APPROVE",
        entityType: "purchase_requests",
        entityId: prId,
        companyId: pr.companyId,
        divisionId: pr.divisionId,
        afterState: { status: "APPROVED_PENDING_PO" },
      });
      return updated;
    });
  }

  // Threshold exceeded: two-step atomic claim.
  if (pr.financeFirstApproverId === ctx.userId) {
    throw new WorkflowError("This request needs a second, different approver", "FORBIDDEN");
  }

  if (!pr.financeFirstApproverId) {
    // Attempt to claim the first-approver slot atomically. Drizzle's builder
    // can't express "SET x = ? WHERE x IS NULL" cleanly, so this one atomic
    // statement is raw SQL - it's the load-bearing guard for the whole
    // concurrency story, so it's written explicitly rather than through a
    // generic helper.
    return claimFirstApprover(ctx, pr, comment);
  }

  return completeSecondApproval(ctx, pr, comment);
}

// Real implementation of the atomic first-approver claim (WHERE ... IS NULL).
// This raw UPDATE is the load-bearing concurrency guard: Drizzle's query
// builder can't express "SET x = ? WHERE x IS NULL" in one atomic statement
// alongside other AND conditions cleanly, so it's written directly. The
// affected-row COUNT (not the returned columns) is what we trust; the row is
// re-fetched through the typed Drizzle select afterward so field names/types
// are never a guessing game against the driver's raw result shape.
async function claimFirstApprover(ctx: AuthContext, pr: typeof purchaseRequests.$inferSelect, comment?: string) {
  return db.transaction(async (tx) => {
    const rawResult = await tx.execute(sqlRaw`
      UPDATE purchase_requests
      SET finance_first_approver_id = ${ctx.userId}, updated_at = now()
      WHERE id = ${pr.id} AND status = 'PENDING_FINANCE_APPROVAL' AND finance_first_approver_id IS NULL
    `);
    const affectedCount = (rawResult as unknown as { count?: number }).count ?? (rawResult as unknown[]).length;
    const claimSucceeded = affectedCount > 0;

    if (claimSucceeded) {
      await recordWorkflowHistory(tx, {
        entityType: "PURCHASE_REQUEST",
        entityId: pr.id,
        actorId: ctx.userId,
        roleActedAs: "Finance Approver",
        fromStatus: "PENDING_FINANCE_APPROVAL",
        toStatus: "PENDING_FINANCE_APPROVAL",
        comment: comment ?? "First finance approval recorded; awaiting a second, different approver",
      });
      await recordAudit(tx, {
        actorId: ctx.userId,
        action: "PR_FINANCE_FIRST_APPROVAL",
        entityType: "purchase_requests",
        entityId: pr.id,
        companyId: pr.companyId,
        divisionId: pr.divisionId,
        afterState: { financeFirstApproverId: ctx.userId },
      });
      const [claimedRow] = await tx.select().from(purchaseRequests).where(eq(purchaseRequests.id, pr.id)).limit(1);
      return claimedRow;
    }

    // Someone else claimed the slot first - re-read and try to complete as
    // the second, distinct approver instead of failing outright.
    const [fresh] = await tx.select().from(purchaseRequests).where(eq(purchaseRequests.id, pr.id)).limit(1);
    if (!fresh) throw new WorkflowError("Not found", "NOT_FOUND");
    if (fresh.financeFirstApproverId === ctx.userId) {
      throw new WorkflowError("This request needs a second, different approver", "FORBIDDEN");
    }
    return completeSecondApprovalInTx(tx, ctx, fresh, comment);
  });
}

async function completeSecondApproval(
  ctx: AuthContext,
  pr: typeof purchaseRequests.$inferSelect,
  comment?: string
) {
  return db.transaction(async (tx) => completeSecondApprovalInTx(tx, ctx, pr, comment));
}

async function completeSecondApprovalInTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ctx: AuthContext,
  pr: typeof purchaseRequests.$inferSelect,
  comment?: string
) {
  const [updated] = await tx
    .update(purchaseRequests)
    .set({ status: "APPROVED_PENDING_PO", updatedAt: new Date() })
    .where(and(eq(purchaseRequests.id, pr.id), eq(purchaseRequests.status, "PENDING_FINANCE_APPROVAL")))
    .returning();
  if (!updated) throw new WorkflowError("This request was already actioned", "CONFLICT");

  await recordWorkflowHistory(tx, {
    entityType: "PURCHASE_REQUEST",
    entityId: pr.id,
    actorId: ctx.userId,
    roleActedAs: "Finance Approver",
    fromStatus: "PENDING_FINANCE_APPROVAL",
    toStatus: "APPROVED_PENDING_PO",
    comment,
  });
  await recordAudit(tx, {
    actorId: ctx.userId,
    action: "PR_FINANCE_APPROVE",
    entityType: "purchase_requests",
    entityId: pr.id,
    companyId: pr.companyId,
    divisionId: pr.divisionId,
    afterState: { status: "APPROVED_PENDING_PO" },
  });
  return updated;
}
