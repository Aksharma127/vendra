import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { purchaseRequests, divisions, users, companies, workflowHistory } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/lib/format";

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  if (rows.length === 0) return <EmptyState message="No data yet." />;
  return (
    <table className="w-full min-w-[640px] text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-graphite">
          {headers.map((h) => (
            <th key={h} className="py-2 pr-4 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-line last:border-0">
            {r.map((c, j) => (
              <td key={j} className="py-2.5 pr-4 text-ink">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function ReportsPage() {
  const ctx = await requireAuthContext();
  if (!ctx.capabilities.has("reports:view")) {
    return <EmptyState message="You don't have permission to view this." />;
  }

  // allPRs, companyRows and divisionRows only depend on ctx, not on each
  // other - fetch together instead of one round trip at a time.
  const [allPRs, companyRows, divisionRows] = await Promise.all([
    ctx.authorizedCompanyIds.length > 0
      ? db.select().from(purchaseRequests).where(inArray(purchaseRequests.companyId, ctx.authorizedCompanyIds))
      : Promise.resolve([]),
    db.select().from(companies).where(inArray(companies.id, ctx.authorizedCompanyIds)),
    ctx.activeCompanyId
      ? db.select().from(divisions).where(eq(divisions.companyId, ctx.activeCompanyId))
      : Promise.resolve([]),
  ]);

  // Company-wise
  const companyWise = companyRows.map((c) => {
    const prs = allPRs.filter((p) => p.companyId === c.id);
    const total = prs.reduce((s, p) => s + Number(p.amount), 0);
    return [c.name, prs.length, formatMoney(total)];
  });

  // Division-wise (active company only)
  const divisionWise = divisionRows.map((d) => {
    const prs = allPRs.filter((p) => p.divisionId === d.id);
    const total = prs.reduce((s, p) => s + Number(p.amount), 0);
    return [d.name, prs.length, formatMoney(total)];
  });

  const companyPRs = allPRs.filter((p) => p.companyId === ctx.activeCompanyId);
  const requesterIds = [...new Set(companyPRs.map((p) => p.requesterId))];
  const prIds = companyPRs.map((p) => p.id);

  // User-wise and activity rows both depend on companyPRs but not on each
  // other - fetch together.
  const [requesterRows, activityRows] = await Promise.all([
    requesterIds.length > 0 ? db.select().from(users).where(inArray(users.id, requesterIds)) : Promise.resolve([]),
    prIds.length > 0 ? db.select().from(workflowHistory).where(inArray(workflowHistory.entityId, prIds)) : Promise.resolve([]),
  ]);
  const userWise = requesterRows.map((u) => {
    const prs = companyPRs.filter((p) => p.requesterId === u.id);
    const total = prs.reduce((s, p) => s + Number(p.amount), 0);
    return [u.name, prs.length, formatMoney(total)];
  });
  const activityByStatus = new Map<string, number>();
  for (const a of activityRows) {
    activityByStatus.set(a.toStatus, (activityByStatus.get(a.toStatus) ?? 0) + 1);
  }
  const activityWise = [...activityByStatus.entries()].map(([status, n]) => [status, n]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-ink">Reports</h1>

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">Company-wise</span>
        </PanelHeader>
        <div className="px-5 py-4 overflow-x-auto">
          <Table headers={["Company", "Requests", "Total Amount"]} rows={companyWise} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">Division-wise (active company)</span>
        </PanelHeader>
        <div className="px-5 py-4 overflow-x-auto">
          <Table headers={["Division", "Requests", "Total Amount"]} rows={divisionWise} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">User-wise (active company)</span>
        </PanelHeader>
        <div className="px-5 py-4 overflow-x-auto">
          <Table headers={["User", "Requests", "Total Amount"]} rows={userWise} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">Activity (by transition, active company)</span>
        </PanelHeader>
        <div className="px-5 py-4 overflow-x-auto">
          <Table headers={["Transitioned To", "Count"]} rows={activityWise} />
        </div>
      </Panel>
    </div>
  );
}
