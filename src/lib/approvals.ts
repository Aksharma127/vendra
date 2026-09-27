import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { purchaseRequests } from "@/db/schema";
import type { AuthContext } from "@/lib/auth-context";

/**
 * Number of purchase requests currently sitting in a queue this user
 * is authorized to act on (division approval or finance approval).
 * Used for the header notification badge.
 */
export async function getPendingApprovalCount(ctx: AuthContext): Promise<number> {
  const canDivision = ctx.capabilities.has("pr:approve-division");
  const canFinance = ctx.capabilities.has("pr:approve-finance");

  let total = 0;

  if (canDivision && ctx.authorizedDivisionIds.length > 0) {
    const [row] = await db
      .select({ n: count() })
      .from(purchaseRequests)
      .where(
        and(
          eq(purchaseRequests.status, "PENDING_DIVISION_APPROVAL"),
          inArray(purchaseRequests.divisionId, ctx.authorizedDivisionIds)
        )
      );
    total += row?.n ?? 0;
  }

  if (canFinance && ctx.activeCompanyId) {
    const [row] = await db
      .select({ n: count() })
      .from(purchaseRequests)
      .where(
        and(
          eq(purchaseRequests.status, "PENDING_FINANCE_APPROVAL"),
          eq(purchaseRequests.companyId, ctx.activeCompanyId)
        )
      );
    total += row?.n ?? 0;
  }

  return total;
}
