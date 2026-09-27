import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { purchaseRequests, divisions, users } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PRTable } from "@/components/PRTable";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function ApprovalQueuePage() {
  const ctx = await requireAuthContext();

  const canDivision = ctx.capabilities.has("pr:approve-division");
  const canFinance = ctx.capabilities.has("pr:approve-finance");

  const divisionQueue =
    canDivision && ctx.authorizedDivisionIds.length > 0
      ? await db
          .select({
            id: purchaseRequests.id,
            prNumber: purchaseRequests.prNumber,
            itemDescription: purchaseRequests.itemDescription,
            amount: purchaseRequests.amount,
            status: purchaseRequests.status,
            createdAt: purchaseRequests.createdAt,
            divisionName: divisions.name,
            requesterName: users.name,
          })
          .from(purchaseRequests)
          .innerJoin(divisions, eq(purchaseRequests.divisionId, divisions.id))
          .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
          .where(
            and(
              eq(purchaseRequests.status, "PENDING_DIVISION_APPROVAL"),
              inArray(purchaseRequests.divisionId, ctx.authorizedDivisionIds)
            )
          )
      : [];

  const financeQueue =
    canFinance && ctx.activeCompanyId
      ? await db
          .select({
            id: purchaseRequests.id,
            prNumber: purchaseRequests.prNumber,
            itemDescription: purchaseRequests.itemDescription,
            amount: purchaseRequests.amount,
            status: purchaseRequests.status,
            createdAt: purchaseRequests.createdAt,
            divisionName: divisions.name,
            requesterName: users.name,
          })
          .from(purchaseRequests)
          .innerJoin(divisions, eq(purchaseRequests.divisionId, divisions.id))
          .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
          .where(
            and(
              eq(purchaseRequests.status, "PENDING_FINANCE_APPROVAL"),
              eq(purchaseRequests.companyId, ctx.activeCompanyId)
            )
          )
      : [];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-ink">Approval Queue</h1>

      {canDivision && (
        <Panel>
          <PanelHeader>
            <span className="text-sm font-medium text-ink">Awaiting your division approval</span>
          </PanelHeader>
          <div className="px-5 py-4 overflow-x-auto">
            <PRTable rows={divisionQueue} emptyMessage="Nothing awaiting division approval right now." />
          </div>
        </Panel>
      )}

      {canFinance && (
        <Panel>
          <PanelHeader>
            <span className="text-sm font-medium text-ink">Awaiting finance approval</span>
          </PanelHeader>
          <div className="px-5 py-4 overflow-x-auto">
            <PRTable rows={financeQueue} emptyMessage="Nothing awaiting finance approval right now." />
          </div>
        </Panel>
      )}

      {!canDivision && !canFinance && <EmptyState message="You don't have any approval responsibilities." />}
    </div>
  );
}
