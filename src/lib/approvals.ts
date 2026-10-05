import "server-only";
import { and, count, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { purchaseRequests } from "@/db/schema";
import type { AuthContext } from "@/lib/auth-context";

/**
 * Number of purchase requests currently sitting in a queue this user
 * is authorized to act on (division approval or finance approval).
 * Used for the header notification badge. Excludes the user's own requests
 * (nobody approves their own) and ones where they already gave the first of
 * two finance approvals (those wait on someone else).
 */
export async function getPendingApprovalCount(ctx: AuthContext): Promise<number> {
  const canDivision = ctx.capabilities.has("pr:approve-division") && ctx.authorizedDivisionIds.length > 0;
  const canFinance = ctx.capabilities.has("pr:approve-finance") && !!ctx.activeCompanyId;

  const [divisionRow, financeRow] = await Promise.all([
    canDivision
      ? db
          .select({ n: count() })
          .from(purchaseRequests)
          .where(
            and(
              eq(purchaseRequests.status, "PENDING_DIVISION_APPROVAL"),
              inArray(purchaseRequests.divisionId, ctx.authorizedDivisionIds),
              ne(purchaseRequests.requesterId, ctx.userId)
            )
          )
      : Promise.resolve([{ n: 0 }]),
    canFinance
      ? db
          .select({ n: count() })
          .from(purchaseRequests)
          .where(
            and(
              eq(purchaseRequests.status, "PENDING_FINANCE_APPROVAL"),
              eq(purchaseRequests.companyId, ctx.activeCompanyId!),
              ne(purchaseRequests.requesterId, ctx.userId),
              or(isNull(purchaseRequests.financeFirstApproverId), ne(purchaseRequests.financeFirstApproverId, ctx.userId))
            )
          )
      : Promise.resolve([{ n: 0 }]),
  ]);

  return (divisionRow[0]?.n ?? 0) + (financeRow[0]?.n ?? 0);
}
