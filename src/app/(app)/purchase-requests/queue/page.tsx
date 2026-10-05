import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { purchaseRequests, divisions, users } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueueList, type QueueRow } from "@/components/QueueList";
import { EmptyState } from "@/components/ui/EmptyState";
import { getApprovalThresholds } from "@/lib/workflow/purchase-requests";
import { formatMoney } from "@/lib/format";

const firstApprover = alias(users, "first_approver");

export default async function ApprovalQueuePage() {
  const ctx = await requireAuthContext();

  const canDivision = ctx.capabilities.has("pr:approve-division");
  const canFinance = ctx.capabilities.has("pr:approve-finance");

  const columns = {
    id: purchaseRequests.id,
    prNumber: purchaseRequests.prNumber,
    itemDescription: purchaseRequests.itemDescription,
    amount: purchaseRequests.amount,
    since: purchaseRequests.updatedAt,
    divisionName: divisions.name,
    requesterName: users.name,
  };

  const [divisionQueue, financeRows, thresholds] = await Promise.all([
    canDivision && ctx.authorizedDivisionIds.length > 0
      ? db
          .select(columns)
          .from(purchaseRequests)
          .innerJoin(divisions, eq(purchaseRequests.divisionId, divisions.id))
          .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
          .where(
            and(
              eq(purchaseRequests.status, "PENDING_DIVISION_APPROVAL"),
              inArray(purchaseRequests.divisionId, ctx.authorizedDivisionIds),
              // Nobody approves their own request.
              ne(purchaseRequests.requesterId, ctx.userId)
            )
          )
          .orderBy(asc(purchaseRequests.updatedAt))
      : Promise.resolve([]),
    canFinance && ctx.activeCompanyId
      ? db
          .select({ ...columns, firstApproverId: purchaseRequests.financeFirstApproverId, firstApproverName: firstApprover.name })
          .from(purchaseRequests)
          .innerJoin(divisions, eq(purchaseRequests.divisionId, divisions.id))
          .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
          .leftJoin(firstApprover, eq(purchaseRequests.financeFirstApproverId, firstApprover.id))
          .where(
            and(
              eq(purchaseRequests.status, "PENDING_FINANCE_APPROVAL"),
              eq(purchaseRequests.companyId, ctx.activeCompanyId),
              ne(purchaseRequests.requesterId, ctx.userId)
            )
          )
          .orderBy(asc(purchaseRequests.updatedAt))
      : Promise.resolve([]),
    ctx.activeCompanyId ? getApprovalThresholds(ctx.activeCompanyId) : Promise.resolve(null),
  ]);

  const twoNeeded = (amount: string) => thresholds !== null && Number(amount) > thresholds.financeSecondary;
  const financeQueue: QueueRow[] = financeRows
    .filter((r) => r.firstApproverId !== ctx.userId)
    .map((r) => ({
      ...r,
      marker: r.firstApproverName
        ? `${r.firstApproverName} gave the first approval. Yours completes it.`
        : twoNeeded(r.amount)
          ? "Needs two finance approvals"
          : null,
    }));
  // Ones I've already given the first approval to: waiting on a colleague.
  const waitingOnOthers: QueueRow[] = financeRows
    .filter((r) => r.firstApproverId === ctx.userId)
    .map((r) => ({ ...r, marker: "You gave the first approval. Needs a second finance approver." }));

  const total = divisionQueue.length + financeQueue.length;

  return (
    <div className="space-y-6">
      <PageHeader
        className=""
        title="Approval queue"
        description={
          total === 0
            ? "Nothing is waiting on you."
            : `${total} request${total === 1 ? "" : "s"} waiting on you, oldest first.`
        }
      />

      {canDivision && (
        <Panel>
          <PanelHeader>
            <span className="text-sm font-medium text-ink">Division approval</span>
            <span className="text-xs tabular-nums text-graphite">{divisionQueue.length}</span>
          </PanelHeader>
          <div className="px-5 py-3">
            <QueueList rows={divisionQueue} emptyMessage="Nothing waiting for division approval. Requests from your division appear here when they're submitted." />
          </div>
        </Panel>
      )}

      {canFinance && (
        <Panel>
          <PanelHeader>
            <span className="text-sm font-medium text-ink">Finance approval</span>
            <span className="text-xs tabular-nums text-graphite">{financeQueue.length}</span>
          </PanelHeader>
          <div className="px-5 py-3">
            <QueueList rows={financeQueue} emptyMessage="Nothing waiting for finance approval. Requests arrive here once a division approves them." />
          </div>
          {thresholds && (
            <p className="border-t border-line px-5 py-3 text-xs text-graphite">
              Requests over {formatMoney(thresholds.financeSecondary)} need two different finance approvers.
            </p>
          )}
        </Panel>
      )}

      {canFinance && waitingOnOthers.length > 0 && (
        <Panel>
          <PanelHeader>
            <span className="text-sm font-medium text-ink">Waiting on a second approver</span>
            <span className="text-xs tabular-nums text-graphite">{waitingOnOthers.length}</span>
          </PanelHeader>
          <div className="px-5 py-3">
            <QueueList rows={waitingOnOthers} emptyMessage="" />
          </div>
        </Panel>
      )}

      {!canDivision && !canFinance && <EmptyState message="Approvals aren't part of your role. Requests you raise are under My Requests." />}
    </div>
  );
}
