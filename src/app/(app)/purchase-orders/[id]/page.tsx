import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { purchaseOrders, vendors, purchaseRequests, divisions, users, workflowHistory } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { StatusTag } from "@/components/ui/StatusTag";
import { UserAvatar } from "@/components/UserAvatar";
import { ApprovalRoute } from "@/components/ApprovalRoute";
import { Timeline } from "@/components/Timeline";
import { formatMoney, formatDate, formatWaiting } from "@/lib/format";
import { buildRoute, buildTimeline, type HistoryEvent } from "@/lib/workflow/route";
import { isOverdue } from "@/lib/order-list";
import { PODetailActions } from "./PODetailActions";

const issuer = alias(users, "issuer");
const requester = alias(users, "requester");

function RailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-3" : ""}>
      <dt className="text-xs text-graphite">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}

export default async function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuthContext();

  const [po] = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      companyId: purchaseOrders.companyId,
      amount: purchaseOrders.amount,
      deliveryDate: purchaseOrders.deliveryDate,
      paymentTerms: purchaseOrders.paymentTerms,
      status: purchaseOrders.status,
      createdAt: purchaseOrders.createdAt,
      vendorName: vendors.name,
      vendorCategory: vendors.category,
      vendorContact: vendors.contactName,
      vendorEmail: vendors.contactEmail,
      prId: purchaseRequests.id,
      prNumber: purchaseRequests.prNumber,
      prStatus: purchaseRequests.status,
      itemDescription: purchaseRequests.itemDescription,
      quantity: purchaseRequests.quantity,
      estimatedUnitCost: purchaseRequests.estimatedUnitCost,
      category: purchaseRequests.category,
      divisionName: divisions.name,
      requesterId: purchaseRequests.requesterId,
      requesterName: requester.name,
      issuedByName: issuer.name,
    })
    .from(purchaseOrders)
    .innerJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
    .innerJoin(purchaseRequests, eq(purchaseOrders.prId, purchaseRequests.id))
    .innerJoin(divisions, eq(purchaseRequests.divisionId, divisions.id))
    .innerJoin(requester, eq(purchaseRequests.requesterId, requester.id))
    .leftJoin(issuer, eq(purchaseOrders.issuedBy, issuer.id))
    .where(eq(purchaseOrders.id, id))
    .limit(1);

  if (!po || !ctx.authorizedCompanyIds.includes(po.companyId)) notFound();
  // Same scope as the list: company-wide roles see every PO, everyone else
  // only the PO raised against their own request. Without this, anyone could
  // open any PO by guessing the URL even though the sidebar hides the page.
  const canViewAny = ctx.capabilities.has("pr:view-all") || ctx.capabilities.has("po:issue");
  if (!canViewAny && po.requesterId !== ctx.userId) notFound();

  const history = (await db
    .select({
      id: workflowHistory.id,
      entityType: workflowHistory.entityType,
      fromStatus: workflowHistory.fromStatus,
      toStatus: workflowHistory.toStatus,
      comment: workflowHistory.comment,
      createdAt: workflowHistory.createdAt,
      actorName: users.name,
      roleActedAs: workflowHistory.roleActedAs,
    })
    .from(workflowHistory)
    .innerJoin(users, eq(workflowHistory.actorId, users.id))
    .where(or(eq(workflowHistory.entityId, po.id), eq(workflowHistory.entityId, po.prId)))
    .orderBy(workflowHistory.createdAt)) as HistoryEvent[];

  // The order continues its request's route, so show the whole thing.
  const route = buildRoute({ status: po.prStatus, history, poStatus: po.status, poNumber: po.poNumber, needsTwoFinance: false, financeFirstApproverName: null });
  const timeline = buildTimeline(history, po.poNumber);
  const late = isOverdue(po.status, po.deliveryDate);
  const lastEvent = history.at(-1);
  const canAct = ctx.capabilities.has("po:issue") && po.status !== "CLOSED";
  const qty = Number(po.quantity);

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/purchase-orders" className="mb-4 inline-flex items-center gap-1 text-sm text-graphite hover:text-ink">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5l-5 5 5 5" />
        </svg>
        Purchase orders
      </Link>

      <div className="grid items-start gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-y-0">
        <header className="rounded-lg border border-line bg-surface p-5 shadow-card sm:px-6 lg:col-start-1 lg:row-start-1 lg:rounded-b-none lg:border-b-0 lg:shadow-none">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-sm text-graphite">{po.poNumber}</span>
            <StatusTag status={po.status} variant="pill" />
            {late && <StatusTag status="OVERDUE" variant="pill" />}
          </div>
          <h1 className="mt-2 text-xl font-semibold leading-snug text-ink sm:text-[22px]">{po.itemDescription}</h1>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="text-sm text-graphite">
              Ordered from <span className="font-medium text-ink">{po.vendorName}</span>
              {po.issuedByName ? ` by ${po.issuedByName}` : ""}, {formatDate(po.createdAt)}
            </div>
            <div className="sm:text-right">
              <div className="text-2xl font-semibold tabular-nums text-ink">{formatMoney(po.amount)}</div>
              <div className="text-xs tabular-nums text-graphite">
                {qty % 1 === 0 ? qty : qty.toFixed(2)} × {formatMoney(po.estimatedUnitCost)}
              </div>
            </div>
          </div>
        </header>

        <aside className="space-y-4 lg:sticky lg:top-[4.5rem] lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <section className="rounded-lg border border-line bg-surface p-4 shadow-card">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">
                {po.status === "ISSUED" ? "Awaiting delivery" : po.status === "DELIVERED" ? "Delivered, waiting to close" : "Closed"}
              </h2>
              {po.status !== "CLOSED" && lastEvent && <span className="shrink-0 text-xs tabular-nums text-graphite">{formatWaiting(lastEvent.createdAt)}</span>}
            </div>
            <p className={`text-sm ${late ? "text-danger" : "text-graphite"}`}>
              {po.status === "ISSUED"
                ? late
                  ? `Due ${formatDate(po.deliveryDate)} and not marked delivered yet. Worth a call to ${po.vendorContact ?? "the vendor"}.`
                  : `Due ${formatDate(po.deliveryDate)}.`
                : po.status === "DELIVERED"
                  ? "Close it once the invoice is settled."
                  : "Nothing left to do on this order."}
            </p>
            {canAct && (
              <div className="mt-4">
                <PODetailActions poId={po.id} status={po.status} />
              </div>
            )}
          </section>

          <RailCard title="Requested by">
            <Link href={`/purchase-requests/${po.prId}`} className="group block rounded-md border border-line p-3 transition-colors hover:border-accent/40 hover:bg-page-bg/60">
              <div className="font-mono text-sm text-accent group-hover:underline">{po.prNumber}</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-ink">
                <UserAvatar name={po.requesterName} size="sm" />
                {po.requesterName}
              </div>
              <div className="mt-1 text-xs text-graphite">{po.divisionName}</div>
            </Link>
          </RailCard>
        </aside>

        <article className="overflow-hidden rounded-lg border border-line bg-surface shadow-card lg:col-start-1 lg:row-start-2 lg:rounded-t-none">
          <section aria-labelledby="po-route" className="border-t border-line px-5 py-5 sm:px-6">
            <h2 id="po-route" className="mb-4 text-sm font-semibold text-ink">
              Approval route
            </h2>
            <ApprovalRoute stages={route} />
          </section>
          <section aria-labelledby="po-details" className="border-t border-line px-5 py-5 sm:px-6">
            <h2 id="po-details" className="mb-4 text-sm font-semibold text-ink">
              Order details
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Fact label="Vendor">{po.vendorName}</Fact>
              <Fact label="Vendor contact">
                {po.vendorContact ?? <span className="text-graphite">Not recorded</span>}
                {po.vendorEmail && (
                  <a href={`mailto:${po.vendorEmail}`} className="block text-xs text-accent hover:underline">
                    {po.vendorEmail}
                  </a>
                )}
              </Fact>
              <Fact label="Category">{po.category}</Fact>
              <Fact label="Delivery date">
                <span className={`tabular-nums ${late ? "font-medium text-danger" : ""}`}>{formatDate(po.deliveryDate)}</span>
              </Fact>
              <Fact label="Payment terms">{po.paymentTerms}</Fact>
              <Fact label="Amount">
                <span className="font-medium tabular-nums">{formatMoney(po.amount)}</span>
              </Fact>
            </dl>
          </section>
          <section aria-labelledby="po-activity" className="border-t border-line px-5 py-5 sm:px-6">
            <h2 id="po-activity" className="mb-4 text-sm font-semibold text-ink">
              Activity
            </h2>
            <Timeline entries={timeline} />
          </section>
        </article>
      </div>
    </div>
  );
}
