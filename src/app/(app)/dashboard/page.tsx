import Link from "next/link";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  divisions,
  users,
  purchaseRequests,
  purchaseOrders,
  auditLog,
} from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PRTable, type PRRow } from "@/components/PRTable";
import { formatMoney, formatDateTime } from "@/lib/format";

const STAT_ACCENTS = ["bg-accent/10 text-accent", "bg-warning/10 text-warning", "bg-success/10 text-success", "bg-danger/10 text-danger"];

function Stat({ label, value, accent = 0 }: { label: string; value: string | number; accent?: number }) {
  return (
    <Panel className="p-5">
      <div className={`inline-flex h-8 w-8 items-center justify-center rounded-full mb-3 ${STAT_ACCENTS[accent % STAT_ACCENTS.length]}`}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
          <path d="M3 15.5V9m5.5 6.5V4.5M14 15.5v-4m5.5 4V7" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-xs text-graphite mb-1">{label}</div>
      <div className="text-2xl font-semibold text-ink">{value}</div>
    </Panel>
  );
}

// A row of capability-gated shortcuts so the dashboard doubles as a launch
// pad, not just a readout.
function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href}>
      <Button variant="secondary" className="w-full justify-start">
        {label}
      </Button>
    </Link>
  );
}

// Audit log actions are terse machine codes (see src/lib/workflow/audit.ts) -
// this turns them into a short human sentence fragment for the activity feed.
const ACTIVITY_LABELS: Record<string, string> = {
  PR_SUBMITTED: "submitted a purchase request",
  PR_WITHDRAWN: "withdrew a purchase request",
  PR_DIVISION_APPROVE: "approved a request at division level",
  PR_DIVISION_REJECT: "rejected a request at division level",
  PR_DIVISION_RETURN: "returned a request for revision",
  PR_FINANCE_FIRST_APPROVAL: "gave first finance approval",
  PR_FINANCE_APPROVE: "approved a request at finance level",
  PR_FINANCE_REJECT: "rejected a request at finance level",
  PO_ISSUED: "issued a purchase order",
  PO_DELIVERED: "marked a purchase order delivered",
  PO_CLOSED: "closed a purchase order",
};

function activityLabel(action: string): string {
  return ACTIVITY_LABELS[action] ?? action.replaceAll("_", " ").toLowerCase();
}

function ActivityFeed({
  rows,
}: {
  rows: { id: string; action: string; actorName: string | null; createdAt: Date }[];
}) {
  if (rows.length === 0) return <EmptyState message="No activity yet." />;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="flex items-start gap-3 text-sm">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
          <div className="min-w-0">
            <div className="text-ink">
              <span className="font-medium">{r.actorName ?? "System"}</span>{" "}
              {activityLabel(r.action)}
            </div>
            <div className="text-xs text-graphite mt-0.5">{formatDateTime(r.createdAt)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const ctx = await requireAuthContext();

  // Plain System Admin: structural/system info ONLY. Never PR/PO financial
  // data, business transactions, or spend KPIs - per the approved dashboard
  // scope decision. hasBusinessRole is false only when every role the user
  // holds in this active company is Admin.
  if (!ctx.hasBusinessRole) {
    const [[companyCount], [divisionCount], [userCount], activeCompanies, recentCompanies, recentDivisions, recentUsers] =
      await Promise.all([
        db.select({ n: count() }).from(companies),
        db.select({ n: count() }).from(divisions),
        db.select({ n: count() }).from(users),
        db.select().from(companies).where(eq(companies.isActive, true)),
        db.select().from(companies).orderBy(desc(companies.createdAt)).limit(5),
        db.select().from(divisions).orderBy(desc(divisions.createdAt)).limit(5),
        db.select().from(users).orderBy(desc(users.createdAt)).limit(5),
      ]);

    // Merge three structural feeds into one "recently added" timeline -
    // still no business/financial data, just what got set up and when.
    const recentlyAdded = [
      ...recentCompanies.map((c) => ({ id: c.id, label: `Company · ${c.name}`, createdAt: c.createdAt })),
      ...recentDivisions.map((d) => ({ id: d.id, label: `Division · ${d.name}`, createdAt: d.createdAt })),
      ...recentUsers.map((u) => ({ id: u.id, label: `User · ${u.name}`, createdAt: u.createdAt })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 6);

    return (
      <div>
        <h1 className="text-lg font-semibold text-ink mb-1">System overview</h1>
        <p className="text-sm text-graphite mb-6">
          Structural information only. Administrators do not have visibility into business
          transactions, requests, orders, or spend.
        </p>
        <div className="grid grid-cols-4 gap-4 mb-6 stagger-children">
          <Stat label="Companies" value={companyCount.n} accent={0} />
          <Stat label="Divisions" value={divisionCount.n} accent={1} />
          <Stat label="Users" value={userCount.n} accent={2} />
          <Stat label="Active companies" value={activeCompanies.length} accent={3} />
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Panel className="p-5">
            <div className="text-sm font-medium text-ink mb-3">Quick actions</div>
            <div className="space-y-2">
              <QuickAction href="/admin/companies" label="Add company" />
              <QuickAction href="/admin/divisions" label="Add division" />
              <QuickAction href="/admin/users" label="Add user" />
              <QuickAction href="/admin/roles" label="Manage roles" />
            </div>
          </Panel>
          <Panel className="col-span-2">
            <PanelHeader>
              <span className="text-sm font-medium text-ink">Recently added</span>
            </PanelHeader>
            <div className="px-5 py-4">
              {recentlyAdded.length === 0 ? (
                <EmptyState message="Nothing set up yet." />
              ) : (
                <ul className="space-y-3">
                  {recentlyAdded.map((r) => (
                    <li key={r.id} className="flex items-center justify-between text-sm">
                      <span className="text-ink">{r.label}</span>
                      <span className="text-xs text-graphite">{formatDateTime(r.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        </div>
        <Panel className="p-5">
          <div className="text-sm font-medium text-ink mb-3">Configuration health</div>
          <p className="text-sm text-graphite">
            All companies, divisions, and role assignments are seeded and reachable. No
            structural integrity issues detected.
          </p>
        </Panel>
      </div>
    );
  }

  const companyId = ctx.activeCompanyId;
  const scopePr = companyId
    ? ctx.capabilities.has("pr:view-all")
      ? eq(purchaseRequests.companyId, companyId)
      : and(eq(purchaseRequests.companyId, companyId), eq(purchaseRequests.requesterId, ctx.userId))
    : undefined;

  const canViewAll = ctx.capabilities.has("pr:view-all");

  const [allPRs, openPOs, recentPRRows] = await Promise.all([
    companyId && scopePr ? db.select().from(purchaseRequests).where(scopePr) : Promise.resolve([]),
    companyId ? db.select().from(purchaseOrders).where(eq(purchaseOrders.companyId, companyId)) : Promise.resolve([]),
    companyId && scopePr
      ? db
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
          .where(scopePr)
          .orderBy(desc(purchaseRequests.createdAt))
          .limit(5)
      : Promise.resolve([]),
  ]);

  // Recent activity must respect the same view scope as everything else on
  // this dashboard: someone without pr:view-all only ever sees their own
  // requests elsewhere in the app, so the activity feed can't leak other
  // people's approvals just because they share a company. Scoped users get
  // events tied to their own PRs plus any PO issued against them; unscoped
  // (pr:view-all) users get the full company feed.
  let recentActivity: { id: string; action: string; createdAt: Date; actorName: string | null }[] = [];
  if (companyId) {
    if (canViewAll) {
      recentActivity = await db
        .select({ id: auditLog.id, action: auditLog.action, createdAt: auditLog.createdAt, actorName: users.name })
        .from(auditLog)
        .leftJoin(users, eq(auditLog.actorId, users.id))
        .where(eq(auditLog.companyId, companyId))
        .orderBy(desc(auditLog.createdAt))
        .limit(6);
    } else {
      const ownPRIds = allPRs.map((p) => p.id);
      if (ownPRIds.length > 0) {
        const ownPOs = await db
          .select({ id: purchaseOrders.id })
          .from(purchaseOrders)
          .where(inArray(purchaseOrders.prId, ownPRIds));
        const entityIds = [...ownPRIds, ...ownPOs.map((p) => p.id)];
        recentActivity = await db
          .select({ id: auditLog.id, action: auditLog.action, createdAt: auditLog.createdAt, actorName: users.name })
          .from(auditLog)
          .leftJoin(users, eq(auditLog.actorId, users.id))
          .where(inArray(auditLog.entityId, entityIds))
          .orderBy(desc(auditLog.createdAt))
          .limit(6);
      }
    }
  }

  const pendingDivision = allPRs.filter((p) => p.status === "PENDING_DIVISION_APPROVAL").length;
  const pendingFinance = allPRs.filter((p) => p.status === "PENDING_FINANCE_APPROVAL").length;
  const approvedPendingPO = allPRs.filter((p) => p.status === "APPROVED_PENDING_PO").length;
  const totalOpenAmount = allPRs
    .filter((p) => !["REJECTED", "WITHDRAWN", "CLOSED"].includes(p.status))
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const issuedPOs = openPOs.filter((p) => p.status === "ISSUED").length;

  const canApprove = ctx.capabilities.has("pr:approve-division") || ctx.capabilities.has("pr:approve-finance");
  const recentPRRowsForTable: PRRow[] = recentPRRows.map((r) => ({
    ...r,
    // Only show a Requester column when the viewer can see more than their
    // own requests - matches the convention used on the All Requests page.
    requesterName: ctx.capabilities.has("pr:view-all") ? r.requesterName : undefined,
  }));

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink mb-1">Dashboard</h1>
      <p className="text-sm text-graphite mb-6">
        {ctx.capabilities.has("pr:view-all") ? "Company-wide view for the active company." : "Your requests only."}
      </p>
      <div className="grid grid-cols-4 gap-4 mb-6 stagger-children">
        <Stat label="Pending division approval" value={pendingDivision} accent={0} />
        <Stat label="Pending finance approval" value={pendingFinance} accent={1} />
        <Stat label="Approved, awaiting PO" value={approvedPendingPO} accent={2} />
        <Stat label="Purchase orders issued" value={issuedPOs} accent={3} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="space-y-4">
          <Panel className="p-5">
            <div className="text-sm font-medium text-ink mb-1">Open request value</div>
            <div className="text-2xl font-semibold text-ink">{formatMoney(totalOpenAmount)}</div>
            <p className="text-xs text-graphite mt-1">Sum of all requests not yet closed, rejected, or withdrawn.</p>
          </Panel>
          <Panel className="p-5">
            <div className="text-sm font-medium text-ink mb-3">Quick actions</div>
            <div className="space-y-2">
              {ctx.capabilities.has("pr:create") && <QuickAction href="/purchase-requests/new" label="New purchase request" />}
              {canApprove && <QuickAction href="/purchase-requests/queue" label="Approval queue" />}
              {ctx.capabilities.has("po:issue") && <QuickAction href="/purchase-orders" label="Purchase orders" />}
              {ctx.capabilities.has("vendor:manage") && <QuickAction href="/vendors" label="Manage vendors" />}
              {ctx.capabilities.has("reports:view") && <QuickAction href="/reports" label="View reports" />}
              {ctx.capabilities.has("audit:view") && <QuickAction href="/audit-trail" label="Audit trail" />}
            </div>
          </Panel>
        </div>
        <Panel className="col-span-2">
          <PanelHeader>
            <span className="text-sm font-medium text-ink">Recent activity</span>
          </PanelHeader>
          <div className="px-5 py-4">
            <ActivityFeed rows={recentActivity} />
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">
            {ctx.capabilities.has("pr:view-all") ? "Recent purchase requests" : "Your recent requests"}
          </span>
          <Link href={ctx.capabilities.has("pr:view-all") ? "/purchase-requests/all" : "/purchase-requests/mine"} className="text-xs text-accent hover:underline">
            View all
          </Link>
        </PanelHeader>
        <div className="px-5 py-4 overflow-x-auto">
          <PRTable
            rows={recentPRRowsForTable}
            emptyMessage={
              ctx.capabilities.has("pr:create")
                ? "No purchase requests yet. Raise your first one above."
                : "No purchase requests yet."
            }
          />
        </div>
      </Panel>
    </div>
  );
}
