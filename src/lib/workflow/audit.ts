import type { Tx } from "./tx";
import { auditLog, workflowHistory } from "@/db/schema";

// Whitelist, not blocklist: a field not listed here is never eligible to be
// written to the audit log, so a future sensitive column added to any table
// is excluded by default rather than needing someone to remember to redact it.
const AUDIT_WHITELISTS: Record<string, string[]> = {
  purchase_requests: ["status", "amount", "divisionId", "companyId", "category"],
  purchase_orders: ["status", "vendorId", "amount", "companyId"],
  users: ["name", "email", "isActive"], // explicitly excludes passwordHash
};

function redact(entityType: string, state: Record<string, unknown> | null): string | null {
  if (!state) return null;
  const whitelist = AUDIT_WHITELISTS[entityType] ?? [];
  const redacted: Record<string, unknown> = {};
  for (const key of whitelist) {
    if (key in state) redacted[key] = state[key];
  }
  return JSON.stringify(redacted);
}

export async function recordAudit(
  tx: Tx,
  params: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    companyId?: string | null;
    divisionId?: string | null;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
  }
) {
  await tx.insert(auditLog).values({
    actorId: params.actorId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    companyId: params.companyId ?? null,
    divisionId: params.divisionId ?? null,
    beforeState: redact(params.entityType, params.beforeState ?? null),
    afterState: redact(params.entityType, params.afterState ?? null),
  });
}

export async function recordWorkflowHistory(
  tx: Tx,
  params: {
    entityType: "PURCHASE_REQUEST" | "PURCHASE_ORDER";
    entityId: string;
    actorId: string;
    roleActedAs: string;
    fromStatus: string;
    toStatus: string;
    comment?: string | null;
  }
) {
  await tx.insert(workflowHistory).values(params);
}
