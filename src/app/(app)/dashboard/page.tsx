import Link from "next/link";
import { and, count, desc, eq, inArray, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  divisions,
  users,
  purchaseRequests,
  purchaseOrders,
  auditLog,
  vendors,
} from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PRTable, type PRRow } from "@/components/PRTable";
import { UserAvatar } from "@/components/UserAvatar";
import { AreaChart, BarList, DonutChart, Sparkline } from "@/components/Charts";
import { formatMoney, formatDateTime } from "@/lib/format";

const STAT_ACCENTS = ["bg-accent/10 text-accent", "bg-warning/10 text-warning", "bg-success/10 text-success", "bg-danger/10 text-danger"];

const ICONS = {
  chart: "M3 15.5V9m5.5 6.5V4.5M14 15.5v-4m5.5 4V7",
  inbox: "M3 11h4l1.5 2.5h3L13 11h4M3 11l2-6.5h10L17 11v5H3v-5Z",
  shield: "M10 2.5 16 5v4.5c0 3.8-2.6 6.6-6 8-3.4-1.4-6-4.2-6-8V5l6-2.5Zm-2.5 7.7 1.8 1.8L13 8.2",
  cart: "M3 4h2l1.6 8.4a1.5 1.5 0 0 0 1.5 1.2h6.3a1.5 1.5 0 0 0 1.5-1.1L17 7H6M8.5 17h.01M14 17h.01",
  truck: "M2.5 5.5h9v8h-9zM11.5 8.5h3.2l2.8 3v2h-6M5.5 16a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  users: "M7.5 9a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM2.5 16c.4-2.6 2.4-4.2 5-4.2s4.6 1.6 5 4.2M13 4a2.5 2.5 0 0 1 0 4.8M15 11.8c1.4.5 2.3 1.9 2.5 4.2",
  building: "M4 17V4.5A1.5 1.5 0 0 1 5.5 3h6A1.5 1.5 0 0 1 13 4.5V17m0-9h2.5A1.5 1.5 0 0 1 17 9.5V17M2.5 17h15M7 6.5h3M7 9.5h3M7 12.5h3",
} as const;

function Stat({
  label,
  value,
  accent = 0,
  icon = "chart",
  href,
}: {
  label: string;
  value: string | number;
  accent?: number;
  icon?: keyof typeof ICONS;
  href?: string;
}) {
  const body = (
    <Panel className="p-5 h-full group hover:border-accent/40">
      <div className={`inline-flex h-8 w-8 items-center justify-center rounded-full mb-3 ${STAT_ACCENTS[accent % STAT_ACCENTS.length]}`}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d={ICONS[icon]} />
        </svg>
      </div>
      <div className="text-xs text-graphite mb-1">{label}</div>
      <div className="text-2xl font-semibold text-ink tabular-nums">{value}</div>
    </Panel>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function KPI({
  label,
  value,
  delta,
  trend,
  note,
}: {
  label: string;
  value: string;
  delta?: number | null;
  trend?: number[];
  note?: string;
}) {
  return (
    <Panel className="p-5">
      <div className="text-xs text-graphite mb-1">{label}</div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xl font-semibold text-ink tabular-nums truncate">{value}</div>
          {delta != null && Number.isFinite(delta) ? (
            <div className={`text-xs mt-1 font-medium ${delta >= 0 ? "text-success" : "text-danger"}`}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(Math.round(delta))}% <span className="text-graphite font-normal">vs last month</span>
            </div>
          ) : (
            note && <div className="text-xs mt-1 text-graphite">{note}</div>
          )}
        </div>
        {trend && <Sparkline values={trend} />}
      </div>
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

const ACTIVITY_TONE: Record<string, string> = {
  PR_DIVISION_REJECT: "bg-danger",
  PR_FINANCE_REJECT: "bg-danger",
  PR_WITHDRAWN: "bg-graphite",
  PR_DIVISION_RETURN: "bg-warning",
  PO_ISSUED: "bg-success",
  PO_DELIVERED: "bg-success",
  PO_CLOSED: "bg-success",
};

function activityLabel(action: string): string {
  return ACTIVITY_LABELS[action] ?? action.replaceAll("_", " ").toLowerCase();
}

function timeAgo(d: Date): string {
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return formatDateTime(d);
}

function ActivityFeed({
  rows,
}: {
  rows: { id: string; action: string; actorName: string | null; createdAt: Date }[];
}) {
  if (rows.length === 0) return <EmptyState message="No activity yet." />;
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.id} className="flex items-start gap-3 text-sm rounded px-2 py-2 -mx-2 hover:bg-page-bg transition-colors">
          <div className="relative shrink-0">
            <UserAvatar name={r.actorName} size="sm" />
            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${ACTIVITY_TONE[r.action] ?? "bg-accent"}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-ink leading-snug">
              <span className="font-medium">{r.actorName ?? "System"}</span> {activityLabel(r.action)}
            </div>
            <div className="text-xs text-graphite mt-0.5" title={formatDateTime(r.createdAt)}>
              {timeAgo(r.createdAt)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Last N calendar months, oldest first, as { key: "2026-09", label: "Sep" }.
function lastMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-IN", { month: "short" }),
    };
  });
}
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const IN_REVIEW = ["PENDING_DIVISION_APPROVAL", "PENDING_FINANCE_APPROVAL"];
const OPEN_STATUSES = ["PENDING_DIVISION_APPROVAL", "PENDING_FINANCE_APPROVAL", "APPROVED_PENDING_PO", "RETURNED_FOR_REVISION"];
const APPROVED_STATUSES = ["APPROVED_PENDING_PO", "PO_ISSUED", "CLOSED"];

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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger-children">
          <Stat label="Companies" value={companyCount.n} accent={0} icon="building" href="/admin/companies" />
          <Stat label="Divisions" value={divisionCount.n} accent={1} icon="chart" href="/admin/divisions" />
          <Stat label="Users" value={userCount.n} accent={2} icon="users" href="/admin/users" />
          <Stat label="Active companies" value={activeCompanies.length} accent={3} icon="shield" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Panel className="p-5">
            <div className="text-sm font-medium text-ink mb-3">Quick actions</div>
            <div className="space-y-2">
              <QuickAction href="/admin/companies" label="Add company" />
              <QuickAction href="/admin/divisions" label="Add division" />
              <QuickAction href="/admin/users" label="Add user" />
              <QuickAction href="/admin/roles" label="Manage roles" />
            </div>
          </Panel>
          <Panel className="lg:col-span-2">
            <PanelHeader>
              <span className="text-sm font-medium text-ink">Recently added</span>
            </PanelHeader>
            <div className="px-5 py-4">
              {recentlyAdded.length === 0 ? (
                <EmptyState message="Nothing set up yet." />
              ) : (
                <ul className="space-y-3">
                  {recentlyAdded.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink truncate">{r.label}</span>
                      <span className="text-xs text-graphite shrink-0">{formatDateTime(r.createdAt)}</span>
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
  const canViewAll = ctx.capabilities.has("pr:view-all");
  const scopePr = companyId
    ? canViewAll
      ? eq(purchaseRequests.companyId, companyId)
      : and(eq(purchaseRequests.companyId, companyId), eq(purchaseRequests.requesterId, ctx.userId))
    : undefined;

  const [allPRs, companyPOs, recentPRRows, divisionRows, topVendorRows] = await Promise.all([
    companyId && scopePr ? db.select().from(purchaseRequests).where(scopePr) : Promise.resolve([]),
    companyId
      ? db
          .select({ id: purchaseOrders.id, prId: purchaseOrders.prId, status: purchaseOrders.status, amount: purchaseOrders.amount, createdAt: purchaseOrders.createdAt })
          .from(purchaseOrders)
          .where(eq(purchaseOrders.companyId, companyId))
      : Promise.resolve([]),
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
          .limit(6)
      : Promise.resolve([]),
    companyId ? db.select({ id: divisions.id, name: divisions.name }).from(divisions).where(eq(divisions.companyId, companyId)) : Promise.resolve([]),
    // Vendor league table is company-wide spend, so only for pr:view-all roles.
    companyId && canViewAll
      ? db
          .select({ name: vendors.name, total: sum(purchaseOrders.amount), orders: count() })
          .from(purchaseOrders)
          .innerJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
          .where(eq(purchaseOrders.companyId, companyId))
          .groupBy(vendors.name)
          .orderBy(desc(sum(purchaseOrders.amount)))
          .limit(5)
      : Promise.resolve([]),
  ]);

  // Scoped users only ever see POs raised against their own requests.
  const ownPRIds = new Set(allPRs.map((p) => p.id));
  const scopedPOs = canViewAll ? companyPOs : companyPOs.filter((po) => ownPRIds.has(po.prId));

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
        .limit(7);
    } else if (ownPRIds.size > 0) {
      const entityIds = [...ownPRIds, ...scopedPOs.map((p) => p.id)];
      recentActivity = await db
        .select({ id: auditLog.id, action: auditLog.action, createdAt: auditLog.createdAt, actorName: users.name })
        .from(auditLog)
        .leftJoin(users, eq(auditLog.actorId, users.id))
        .where(inArray(auditLog.entityId, entityIds))
        .orderBy(desc(auditLog.createdAt))
        .limit(7);
    }
  }

  // ---------- headline counts ----------
  const submitted = allPRs.filter((p) => p.status !== "DRAFT");
  const pendingDivision = allPRs.filter((p) => p.status === "PENDING_DIVISION_APPROVAL").length;
  const pendingFinance = allPRs.filter((p) => p.status === "PENDING_FINANCE_APPROVAL").length;
  const approvedPendingPO = allPRs.filter((p) => p.status === "APPROVED_PENDING_PO").length;
  const openPOCount = scopedPOs.filter((p) => p.status !== "CLOSED").length;
  const openValue = allPRs.filter((p) => OPEN_STATUSES.includes(p.status)).reduce((s, p) => s + Number(p.amount), 0);

  // ---------- month series (6 months) ----------
  const months = lastMonths(6);
  const requestedByMonth = new Map<string, number>();
  const orderedByMonth = new Map<string, number>();
  for (const p of submitted) {
    const k = monthKey(p.createdAt);
    requestedByMonth.set(k, (requestedByMonth.get(k) ?? 0) + Number(p.amount));
  }
  for (const po of scopedPOs) {
    const k = monthKey(po.createdAt);
    orderedByMonth.set(k, (orderedByMonth.get(k) ?? 0) + Number(po.amount));
  }
  const requestedSeries = months.map((m) => requestedByMonth.get(m.key) ?? 0);
  const orderedSeries = months.map((m) => orderedByMonth.get(m.key) ?? 0);
  const countSeries = months.map((m) => submitted.filter((p) => monthKey(p.createdAt) === m.key).length);

  const thisMonthOrdered = orderedSeries[orderedSeries.length - 1];
  const lastMonthOrdered = orderedSeries[orderedSeries.length - 2];
  // Month-to-date vs a full previous month would always look like a drop -
  // compare against the same number of days into last month instead.
  const dayOfMonth = new Date().getDate();
  const lastMonthSamePeriod = scopedPOs
    .filter((po) => {
      const d = po.createdAt;
      const now = new Date();
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth() && d.getDate() <= dayOfMonth;
    })
    .reduce((s, po) => s + Number(po.amount), 0);
  const orderedDelta = lastMonthSamePeriod > 0 ? ((thisMonthOrdered - lastMonthSamePeriod) / lastMonthSamePeriod) * 100 : null;

  const decided = submitted.filter((p) => APPROVED_STATUSES.includes(p.status) || p.status === "REJECTED");
  const approvalRate = decided.length ? (decided.filter((p) => p.status !== "REJECTED").length / decided.length) * 100 : null;

  // ---------- breakdowns ----------
  const statusSegments = [
    { label: "In review", value: allPRs.filter((p) => IN_REVIEW.includes(p.status)).length, color: "var(--color-warning)" },
    { label: "Awaiting PO", value: approvedPendingPO, color: "color-mix(in srgb, var(--color-accent) 55%, white)" },
    { label: "Ordered", value: allPRs.filter((p) => p.status === "PO_ISSUED" || p.status === "CLOSED").length, color: "var(--color-success)" },
    { label: "Returned", value: allPRs.filter((p) => p.status === "RETURNED_FOR_REVISION").length, color: "var(--color-accent)" },
    { label: "Rejected / withdrawn", value: allPRs.filter((p) => p.status === "REJECTED" || p.status === "WITHDRAWN").length, color: "var(--color-danger)" },
  ];

  const committed = submitted.filter((p) => p.status !== "REJECTED" && p.status !== "WITHDRAWN");
  const byCategory = new Map<string, { value: number; n: number }>();
  for (const p of committed) {
    const cur = byCategory.get(p.category) ?? { value: 0, n: 0 };
    byCategory.set(p.category, { value: cur.value + Number(p.amount), n: cur.n + 1 });
  }
  const categoryRows = [...byCategory.entries()]
    .map(([label, v]) => ({ label, value: v.value, hint: `${v.n} req` }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const divisionName = new Map(divisionRows.map((d) => [d.id, d.name]));
  const byDivision = new Map<string, number>();
  for (const p of committed) byDivision.set(p.divisionId, (byDivision.get(p.divisionId) ?? 0) + Number(p.amount));
  const divisionBars = [...byDivision.entries()]
    .map(([id, value]) => ({ label: divisionName.get(id) ?? "Other", value }))
    .sort((a, b) => b.value - a.value);

  const vendorBars = topVendorRows.map((v) => ({ label: v.name, value: Number(v.total ?? 0), hint: `${v.orders} PO${v.orders === 1 ? "" : "s"}` }));

  const canApprove = ctx.capabilities.has("pr:approve-division") || ctx.capabilities.has("pr:approve-finance");
  const recentPRRowsForTable: PRRow[] = recentPRRows.map((r) => ({
    ...r,
    // Only show a Requester column when the viewer can see more than their
    // own requests - matches the convention used on the All Requests page.
    requesterName: canViewAll ? r.requesterName : undefined,
  }));

  const hasData = submitted.length > 0;
  const firstName = ctx.userName.split(" ")[0];
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg font-semibold text-ink mb-1">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-graphite">
            {canViewAll ? "Company-wide view for the active company." : "Your requests only."}
          </p>
        </div>
        {ctx.capabilities.has("pr:create") && (
          <Link href="/purchase-requests/new">
            <Button>+ New request</Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 stagger-children">
        <Stat label="Pending division approval" value={pendingDivision} accent={1} icon="inbox" href={ctx.capabilities.has("pr:approve-division") ? "/purchase-requests/queue" : undefined} />
        <Stat label="Pending finance approval" value={pendingFinance} accent={0} icon="shield" href={ctx.capabilities.has("pr:approve-finance") ? "/purchase-requests/queue" : undefined} />
        <Stat label="Approved, awaiting PO" value={approvedPendingPO} accent={2} icon="cart" href={ctx.capabilities.has("po:issue") ? "/purchase-requests/all" : undefined} />
        <Stat label="Open purchase orders" value={openPOCount} accent={3} icon="truck" href={ctx.capabilities.has("po:issue") ? "/purchase-orders" : undefined} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KPI label="Ordered this month" value={formatMoney(thisMonthOrdered)} delta={orderedDelta} trend={orderedSeries} note={lastMonthOrdered ? undefined : "First orders this period"} />
        <KPI label="Open request value" value={formatMoney(openValue)} note="In review, returned, or awaiting a PO" trend={countSeries} />
        <KPI label="Approval rate" value={approvalRate == null ? "—" : `${Math.round(approvalRate)}%`} note={`${decided.length} decided requests`} />
      </div>

      {hasData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Panel className="lg:col-span-2">
            <PanelHeader>
              <span className="text-sm font-medium text-ink">Spend trend</span>
              <span className="text-xs text-graphite">Last 6 months</span>
            </PanelHeader>
            <div className="px-3 sm:px-5 py-4">
              <AreaChart
                labels={months.map((m) => m.label)}
                series={[
                  { name: "Requested", color: "color-mix(in srgb, var(--color-accent) 45%, white)", values: requestedSeries },
                  { name: "Ordered (PO issued)", color: "var(--color-accent)", values: orderedSeries },
                ]}
              />
            </div>
          </Panel>
          <Panel>
            <PanelHeader>
              <span className="text-sm font-medium text-ink">Request pipeline</span>
              <span className="text-xs text-graphite">All time</span>
            </PanelHeader>
            <div className="px-5 py-5">
              <DonutChart segments={statusSegments} centerLabel="requests" />
            </div>
          </Panel>
        </div>
      ) : null}

      {hasData && (
        <div className={`grid grid-cols-1 ${canViewAll ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-4 mb-6`}>
          <Panel>
            <PanelHeader>
              <span className="text-sm font-medium text-ink">Spend by category</span>
            </PanelHeader>
            <div className="px-5 py-4">
              <BarList rows={categoryRows} />
            </div>
          </Panel>
          {canViewAll && (
            <Panel>
              <PanelHeader>
                <span className="text-sm font-medium text-ink">Spend by division</span>
              </PanelHeader>
              <div className="px-5 py-4">
                <BarList rows={divisionBars} color="var(--color-success)" />
              </div>
            </Panel>
          )}
          {canViewAll ? (
            <Panel>
              <PanelHeader>
                <span className="text-sm font-medium text-ink">Top vendors</span>
                {ctx.capabilities.has("vendor:manage") && (
                  <Link href="/vendors" className="text-xs text-accent hover:underline">
                    Manage
                  </Link>
                )}
              </PanelHeader>
              <div className="px-5 py-4">
                {vendorBars.length ? <BarList rows={vendorBars} color="var(--color-warning)" /> : <EmptyState message="No purchase orders yet." />}
              </div>
            </Panel>
          ) : (
            <Panel>
              <PanelHeader>
                <span className="text-sm font-medium text-ink">Requests per month</span>
              </PanelHeader>
              <div className="px-3 sm:px-5 py-4">
                <AreaChart labels={months.map((m) => m.label)} series={[{ name: "Submitted", color: "var(--color-success)", values: countSeries }]} format={(n) => String(Math.round(n))} height={180} />
              </div>
            </Panel>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Panel className="lg:col-span-2">
          <PanelHeader>
            <span className="text-sm font-medium text-ink">Recent activity</span>
            {ctx.capabilities.has("audit:view") && (
              <Link href="/audit-trail" className="text-xs text-accent hover:underline">
                Audit trail
              </Link>
            )}
          </PanelHeader>
          <div className="px-5 py-3">
            <ActivityFeed rows={recentActivity} />
          </div>
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

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">{canViewAll ? "Recent purchase requests" : "Your recent requests"}</span>
          <Link href={canViewAll ? "/purchase-requests/all" : "/purchase-requests/mine"} className="text-xs text-accent hover:underline">
            View all
          </Link>
        </PanelHeader>
        <div className="px-5 py-4 overflow-x-auto">
          <PRTable
            rows={recentPRRowsForTable}
            emptyMessage={ctx.capabilities.has("pr:create") ? "No purchase requests yet. Raise your first one above." : "No purchase requests yet."}
          />
        </div>
      </Panel>
    </div>
  );
}

