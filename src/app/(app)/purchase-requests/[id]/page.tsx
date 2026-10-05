import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { purchaseRequests, divisions, users, workflowHistory, purchaseOrders, vendors } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { StatusTag } from "@/components/ui/StatusTag";
import { UserAvatar } from "@/components/UserAvatar";
import { ApprovalRoute } from "@/components/ApprovalRoute";
import { Timeline } from "@/components/Timeline";
import { formatMoney, formatDate, formatShortDate, formatWaiting } from "@/lib/format";
import { buildRoute, buildTimeline, type HistoryEvent } from "@/lib/workflow/route";
import { currentHolders } from "@/lib/workflow/holders";
import { getApprovalThresholds } from "@/lib/workflow/purchase-requests";
import { OwnerActions, DivisionApprovalActions, FinanceApprovalActions } from "./PRActions";
import { IssuePOForm } from "./IssuePOForm";

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="border-t border-line px-5 py-5 sm:px-6">
      <h2 id={id} className="mb-4 text-sm font-semibold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

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
      financeFirstApproverId: purchaseRequests.financeFirstApproverId,
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
  // A draft is private to its author until it's submitted.
  if (!isOwner && pr.status === "DRAFT") notFound();

  const [po] = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      status: purchaseOrders.status,
      deliveryDate: purchaseOrders.deliveryDate,
      paymentTerms: purchaseOrders.paymentTerms,
      vendorName: vendors.name,
    })
    .from(purchaseOrders)
    .innerJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
    .where(eq(purchaseOrders.prId, id))
    .limit(1);

  const canIssuePO = ctx.capabilities.has("po:issue") && pr.status === "APPROVED_PENDING_PO";
  const [historyRows, thresholds, holders, activeVendors, firstApprover] = await Promise.all([
    db
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
      .where(po ? or(eq(workflowHistory.entityId, id), eq(workflowHistory.entityId, po.id)) : eq(workflowHistory.entityId, id))
      .orderBy(workflowHistory.createdAt),
    getApprovalThresholds(pr.companyId),
    currentHolders({ ...pr, poStatus: po?.status ?? null }),
    canIssuePO
      ? db
          .select({ id: vendors.id, name: vendors.name, category: vendors.category })
          .from(vendors)
          .where(and(eq(vendors.companyId, pr.companyId), eq(vendors.isActive, true)))
          .orderBy(vendors.name)
      : Promise.resolve([]),
    pr.financeFirstApproverId
      ? db.select({ name: users.name }).from(users).where(inArray(users.id, [pr.financeFirstApproverId])).limit(1)
      : Promise.resolve([]),
  ]);

  const history = historyRows as HistoryEvent[];
  const needsTwoFinance = Number(pr.amount) > thresholds.financeSecondary;
  const firstApproverName = firstApprover[0]?.name ?? null;
  const route = buildRoute({
    status: pr.status,
    history,
    poStatus: po?.status ?? null,
    poNumber: po?.poNumber ?? null,
    needsTwoFinance,
    financeFirstApproverName: firstApproverName,
  });
  const timeline = buildTimeline(history, po?.poNumber ?? null);
  const lastEvent = history.at(-1);
  const waitingSince = lastEvent?.createdAt ?? pr.createdAt;

  // Who may act here (the server re-checks every one of these on submit).
  const canDivision =
    !isOwner && pr.status === "PENDING_DIVISION_APPROVAL" && ctx.capabilities.has("pr:approve-division") && ctx.authorizedDivisionIds.includes(pr.divisionId);
  const canFinance = !isOwner && pr.status === "PENDING_FINANCE_APPROVAL" && ctx.capabilities.has("pr:approve-finance");
  const iGaveFirstApproval = canFinance && pr.financeFirstApproverId === ctx.userId;
  const skipsDivision = isOwner && ctx.capabilities.has("pr:approve-division") && ctx.authorizedDivisionIds.includes(pr.divisionId);

  const back = isOwner
    ? { href: "/purchase-requests/mine", label: "My requests" }
    : canDivision || canFinance
      ? { href: "/purchase-requests/queue", label: "Approval queue" }
      : { href: "/purchase-requests/all", label: "All requests" };

  const qty = Number(pr.quantity);
  // A request's own status stops at "PO issued"; delivery and closing are
  // recorded on the order. Show whichever is further along.
  const displayStatus = pr.status === "PO_ISSUED" && po && (po.status === "DELIVERED" || po.status === "CLOSED") ? po.status : pr.status;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href={back.href} className="mb-4 inline-flex items-center gap-1 text-sm text-graphite hover:text-ink">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5l-5 5 5 5" />
        </svg>
        {back.label}
      </Link>

      <div className="grid items-start gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-y-0">
        {/* The requisition itself */}
        <header className="rounded-lg border border-line bg-surface px-5 pt-5 pb-5 shadow-card sm:px-6 lg:col-start-1 lg:row-start-1 lg:rounded-b-none lg:border-b-0 lg:shadow-none">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-sm text-graphite">{pr.prNumber ?? "Draft"}</span>
            <StatusTag status={displayStatus} variant="pill" />
          </div>
          <h1 className="mt-2 text-xl font-semibold leading-snug text-ink sm:text-[22px]">{pr.itemDescription}</h1>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="flex items-center gap-2.5 text-sm text-graphite">
              <UserAvatar name={pr.requesterName} size="md" />
              <span>
                Raised by <span className="font-medium text-ink">{isOwner ? "you" : pr.requesterName}</span> for {pr.divisionName}
                <br className="sm:hidden" />
                <span className="hidden sm:inline">, </span>
                {formatDate(pr.createdAt)}
              </span>
            </div>
            <div className="sm:text-right">
              <div className="text-2xl font-semibold tabular-nums text-ink">{formatMoney(pr.amount)}</div>
              <div className="text-xs tabular-nums text-graphite">
                {qty % 1 === 0 ? qty : qty.toFixed(2)} × {formatMoney(pr.estimatedUnitCost)}
              </div>
            </div>
          </div>
        </header>

        {/* Decisions and the current holder: right rail on desktop, straight under the header on phones */}
        <aside className="space-y-4 lg:sticky lg:top-[4.5rem] lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <NowCard
            status={pr.status}
            currentUserId={ctx.userId}
            holders={holders}
            waitingSince={waitingSince}
            lastEvent={lastEvent}
            isOwner={isOwner}
            iGaveFirstApproval={iGaveFirstApproval}
            firstApproverName={firstApproverName}
            needsTwoFinance={needsTwoFinance}
            thresholdLabel={formatMoney(thresholds.financeSecondary)}
          />

          {isOwner && ["DRAFT", "RETURNED_FOR_REVISION", "PENDING_DIVISION_APPROVAL"].includes(pr.status) && (
            <RailCard title={pr.status === "RETURNED_FOR_REVISION" ? "Revise and resubmit" : pr.status === "DRAFT" ? "Ready to send?" : "Your request"}>
              <OwnerActions prId={pr.id} status={pr.status} skipsDivision={skipsDivision} />
            </RailCard>
          )}

          {canDivision && (
            <RailCard title="Your decision">
              <DivisionApprovalActions prId={pr.id} />
            </RailCard>
          )}

          {canFinance && !iGaveFirstApproval && (
            <RailCard title="Your decision">
              {needsTwoFinance && (
                <p className="mb-3 rounded border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-ink">
                  {pr.financeFirstApproverId
                    ? `${firstApproverName ?? "Another approver"} gave the first approval. Yours completes it.`
                    : `Over ${formatMoney(thresholds.financeSecondary)}, so two different finance approvers have to sign off. Yours will be the first.`}
                </p>
              )}
              <FinanceApprovalActions
                prId={pr.id}
                approveLabel={needsTwoFinance ? (pr.financeFirstApproverId ? "Give final approval" : "Give first approval") : "Approve"}
              />
            </RailCard>
          )}

          {canIssuePO && (
            <RailCard title="Issue the purchase order">
              <IssuePOForm prId={pr.id} vendors={activeVendors} amountLabel={formatMoney(pr.amount)} />
            </RailCard>
          )}

          {po && (
            <RailCard title="Purchase order">
              <Link href={`/purchase-orders/${po.id}`} className="group block rounded-md border border-line p-3 transition-colors hover:border-accent/40 hover:bg-page-bg/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm text-accent group-hover:underline">{po.poNumber}</span>
                  <StatusTag status={po.status} />
                </div>
                <div className="mt-2 text-sm text-ink">{po.vendorName}</div>
                <div className="mt-0.5 text-xs text-graphite">
                  Delivery by {formatDate(po.deliveryDate)}. {po.paymentTerms}.
                </div>
              </Link>
            </RailCard>
          )}
        </aside>

        <article className="overflow-hidden rounded-lg border border-line bg-surface shadow-card lg:col-start-1 lg:row-start-2 lg:rounded-t-none">
          <Section title="Approval route" id="route-heading">
            <ApprovalRoute stages={route} />
          </Section>
          <Section title="Details" id="details-heading">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Fact label="Category">{pr.category}</Fact>
              <Fact label="Quantity">
                <span className="tabular-nums">{qty % 1 === 0 ? qty : qty.toFixed(2)}</span>
              </Fact>
              <Fact label="Estimated unit cost">
                <span className="tabular-nums">{formatMoney(pr.estimatedUnitCost)}</span>
              </Fact>
              <Fact label="Division">{pr.divisionName}</Fact>
              <Fact label="Requester">{pr.requesterName}</Fact>
              <Fact label="Total">
                <span className="font-medium tabular-nums">{formatMoney(pr.amount)}</span>
              </Fact>
              <Fact label="Justification" wide>
                {pr.justification ? (
                  <span className="whitespace-pre-line">{pr.justification}</span>
                ) : (
                  <span className="text-graphite">None given{Number(pr.amount) <= thresholds.justification ? ` (not needed under ${formatMoney(thresholds.justification)})` : ""}.</span>
                )}
              </Fact>
            </dl>
          </Section>
          <Section title="Activity" id="activity-heading">
            <Timeline entries={timeline} />
          </Section>
        </article>
      </div>
    </div>
  );
}

function NowCard({
  status,
  currentUserId,
  holders,
  waitingSince,
  lastEvent,
  isOwner,
  iGaveFirstApproval,
  firstApproverName,
  needsTwoFinance,
  thresholdLabel,
}: {
  status: string;
  currentUserId: string;
  holders: { desk: string; people: { id: string; name: string }[] } | null;
  waitingSince: Date;
  lastEvent: HistoryEvent | undefined;
  isOwner: boolean;
  iGaveFirstApproval: boolean;
  firstApproverName: string | null;
  needsTwoFinance: boolean;
  thresholdLabel: string;
}) {
  let title: string;
  let body: React.ReactNode = null;
  const waiting = formatWaiting(waitingSince);

  switch (status) {
    case "DRAFT":
      title = "Draft";
      body = <p className="text-sm text-graphite">Only you can see it. Nothing happens until you submit it.</p>;
      break;
    case "RETURNED_FOR_REVISION":
      title = isOwner ? "Back with you for changes" : "Back with the requester";
      body = (
        <p className="text-sm text-graphite">
          {lastEvent ? `${lastEvent.actorName} returned it ${formatShortDate(lastEvent.createdAt)}.` : "Returned for changes."} See the comment in Activity.
        </p>
      );
      break;
    case "REJECTED":
      title = "Rejected";
      body = <p className="text-sm text-graphite">{lastEvent ? `By ${lastEvent.actorName} on ${formatShortDate(lastEvent.createdAt)}.` : null} This request is closed.</p>;
      break;
    case "WITHDRAWN":
      title = "Withdrawn";
      body = <p className="text-sm text-graphite">{lastEvent ? `By ${lastEvent.actorName} on ${formatShortDate(lastEvent.createdAt)}.` : null} No further action.</p>;
      break;
    default:
      if (!holders) {
        title = "Complete";
        body = <p className="text-sm text-graphite">Ordered, delivered and closed. Nothing left to do.</p>;
        break;
      }
      title = `Waiting on ${holders.desk.toLowerCase()}`;
      body = (
        <div className="space-y-3">
          {iGaveFirstApproval ? (
            <p className="text-sm text-ink">
              You gave the first approval. A different finance approver has to give the second
              {holders.people.length ? `: ${holders.people.map((p) => p.name).join(" or ")}.` : "."}
            </p>
          ) : holders.people.length > 0 ? (
            <ul className="space-y-2">
              {holders.people.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm text-ink">
                  <UserAvatar name={p.name} size="sm" />
                  {p.name}
                  {p.id === currentUserId && <span className="text-graphite">(you)</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-warning">No one can act on this at the moment. An admin needs to assign the role.</p>
          )}
          {status === "PENDING_FINANCE_APPROVAL" && needsTwoFinance && !iGaveFirstApproval && (
            <p className="text-xs text-graphite">
              {firstApproverName ? `${firstApproverName} gave the first of two approvals.` : `Needs two finance approvals (over ${thresholdLabel}).`}
            </p>
          )}
        </div>
      );
  }

  const live = !["DRAFT", "REJECTED", "WITHDRAWN"].includes(status) && holders;
  return (
    <section className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {live && <span className="shrink-0 text-xs tabular-nums text-graphite">{waiting}</span>}
      </div>
      {body}
    </section>
  );
}
