import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  purchaseRequests,
  divisions,
  users,
  workflowHistory,
  purchaseOrders,
  vendors,
} from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusTag } from "@/components/ui/StatusTag";
import { formatMoney, formatDateTime } from "@/lib/format";
import { OwnerActions, DivisionApprovalActions, FinanceApprovalActions } from "./PRActions";
import { IssuePOForm } from "./IssuePOForm";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-graphite mb-0.5">{label}</div>
      <div className="text-sm text-ink">{value}</div>
    </div>
  );
}

export default async function PRDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuthContext();

  const [pr] = await db
    .select({
      id: purchaseRequests.id,
      prNumber: purchaseRequests.prNumber,
      companyId: purchaseRequests.companyId,
      divisionId: purchaseRequests.divisionId,
      requesterId: purchaseRequests.requesterId,
      category: purchaseRequests.category,
      itemDescription: purchaseRequests.itemDescription,
      quantity: purchaseRequests.quantity,
      estimatedUnitCost: purchaseRequests.estimatedUnitCost,
      amount: purchaseRequests.amount,
      justification: purchaseRequests.justification,
      status: purchaseRequests.status,
      createdAt: purchaseRequests.createdAt,
      divisionName: divisions.name,
      requesterName: users.name,
    })
    .from(purchaseRequests)
    .innerJoin(divisions, eq(purchaseRequests.divisionId, divisions.id))
    .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
    .where(eq(purchaseRequests.id, id))
    .limit(1);

  if (!pr || !ctx.authorizedCompanyIds.includes(pr.companyId)) notFound();

  const isOwner = pr.requesterId === ctx.userId;
  const canSeeAsQueue =
    (ctx.capabilities.has("pr:approve-division") && ctx.authorizedDivisionIds.includes(pr.divisionId)) ||
    ctx.capabilities.has("pr:approve-finance") ||
    ctx.capabilities.has("pr:view-all");
  if (!isOwner && !canSeeAsQueue) notFound();

  const history = await db
    .select({
      id: workflowHistory.id,
      fromStatus: workflowHistory.fromStatus,
      toStatus: workflowHistory.toStatus,
      comment: workflowHistory.comment,
      createdAt: workflowHistory.createdAt,
      actorName: users.name,
      roleActedAs: workflowHistory.roleActedAs,
    })
    .from(workflowHistory)
    .innerJoin(users, eq(workflowHistory.actorId, users.id))
    .where(eq(workflowHistory.entityId, id))
    .orderBy(workflowHistory.createdAt);

  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.prId, id)).limit(1);

  const activeVendors =
    pr.status === "APPROVED_PENDING_PO" && ctx.capabilities.has("po:issue")
      ? await db
          .select({ id: vendors.id, name: vendors.name })
          .from(vendors)
          .where(eq(vendors.companyId, pr.companyId))
      : [];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-lg font-semibold text-ink font-mono">{pr.prNumber ?? "DRAFT"}</h1>
          <StatusTag status={pr.status} />
        </div>
        <p className="text-sm text-graphite">{pr.itemDescription}</p>
      </div>

      <Panel className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Field label="Division" value={pr.divisionName} />
        <Field label="Requester" value={pr.requesterName} />
        <Field label="Category" value={pr.category} />
        <Field label="Quantity" value={pr.quantity} />
        <Field label="Est. unit cost" value={formatMoney(pr.estimatedUnitCost)} />
        <Field label="Total amount" value={formatMoney(pr.amount)} />
        {pr.justification && (
          <div className="col-span-3">
            <Field label="Justification" value={pr.justification} />
          </div>
        )}
      </Panel>

      {isOwner && (
        <Panel className="p-5">
          <div className="text-sm font-medium text-ink mb-3">Actions</div>
          <OwnerActions prId={pr.id} status={pr.status} />
        </Panel>
      )}

      {ctx.capabilities.has("pr:approve-division") &&
        ctx.authorizedDivisionIds.includes(pr.divisionId) &&
        pr.status === "PENDING_DIVISION_APPROVAL" && (
          <Panel className="p-5">
            <div className="text-sm font-medium text-ink mb-3">Division Approval</div>
            <DivisionApprovalActions prId={pr.id} />
          </Panel>
        )}

      {ctx.capabilities.has("pr:approve-finance") && pr.status === "PENDING_FINANCE_APPROVAL" && (
        <Panel className="p-5">
          <div className="text-sm font-medium text-ink mb-3">Finance Approval</div>
          <FinanceApprovalActions prId={pr.id} />
        </Panel>
      )}

      {ctx.capabilities.has("po:issue") && pr.status === "APPROVED_PENDING_PO" && (
        <Panel className="p-5">
          <div className="text-sm font-medium text-ink mb-3">Issue Purchase Order</div>
          <IssuePOForm prId={pr.id} vendors={activeVendors} />
        </Panel>
      )}

      {po && (
        <Panel className="p-5">
          <div className="text-sm font-medium text-ink mb-3">Purchase Order</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Field label="PO Number" value={po.poNumber ?? "—"} />
            <Field label="Status" value={<StatusTag status={po.status} />} />
            <Field label="Delivery date" value={po.deliveryDate} />
          </div>
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">History</span>
        </PanelHeader>
        <div className="px-5 py-4 space-y-3">
          {history.length === 0 && <p className="text-sm text-graphite">No activity yet.</p>}
          {history.map((h) => (
            <div key={h.id} className="text-sm border-b border-line last:border-0 pb-3 last:pb-0">
              <div className="flex items-center justify-between">
                <span className="text-ink">
                  {h.actorName} ({h.roleActedAs}): {h.fromStatus} → {h.toStatus}
                </span>
                <span className="text-xs text-graphite">{formatDateTime(h.createdAt)}</span>
              </div>
              {h.comment && <p className="text-xs text-graphite mt-1">{h.comment}</p>}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
