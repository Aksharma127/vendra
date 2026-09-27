import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, divisions, users, purchaseRequests, purchaseOrders } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel } from "@/components/ui/Panel";
import { formatMoney } from "@/lib/format";

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

export default async function DashboardPage() {
  const ctx = await requireAuthContext();

  // Plain System Admin: structural/system info ONLY. Never PR/PO financial
  // data, business transactions, or spend KPIs - per the approved dashboard
  // scope decision. hasBusinessRole is false only when every role the user
  // holds in this active company is Admin.
  if (!ctx.hasBusinessRole) {
    const [[companyCount], [divisionCount], [userCount], activeCompanies] = await Promise.all([
      db.select({ n: count() }).from(companies),
      db.select({ n: count() }).from(divisions),
      db.select({ n: count() }).from(users),
      db.select().from(companies).where(eq(companies.isActive, true)),
    ]);

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

  const [allPRs, openPOs] = await Promise.all([
    companyId && scopePr ? db.select().from(purchaseRequests).where(scopePr) : Promise.resolve([]),
    companyId ? db.select().from(purchaseOrders).where(eq(purchaseOrders.companyId, companyId)) : Promise.resolve([]),
  ]);

  const pendingDivision = allPRs.filter((p) => p.status === "PENDING_DIVISION_APPROVAL").length;
  const pendingFinance = allPRs.filter((p) => p.status === "PENDING_FINANCE_APPROVAL").length;
  const approvedPendingPO = allPRs.filter((p) => p.status === "APPROVED_PENDING_PO").length;
  const totalOpenAmount = allPRs
    .filter((p) => !["REJECTED", "WITHDRAWN", "CLOSED"].includes(p.status))
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const issuedPOs = openPOs.filter((p) => p.status === "ISSUED").length;

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
      <Panel className="p-5">
        <div className="text-sm font-medium text-ink mb-1">Open request value</div>
        <div className="text-2xl font-semibold text-ink">{formatMoney(totalOpenAmount)}</div>
        <p className="text-xs text-graphite mt-1">Sum of all requests not yet closed, rejected, or withdrawn.</p>
      </Panel>
    </div>
  );
}
