import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { purchaseRequests, divisions, users, companies, workflowHistory } from "@/db/schema";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/lib/format";
import { StatusTag } from "@/components/ui/StatusTag";

type Row = { name: string; count: number; total: number };

/** One breakdown: biggest first, figures right-aligned, and each row's share of the whole as a bar. */
function ReportTable({ nameHeader, rows }: { nameHeader: string; rows: Row[] }) {
  if (rows.length === 0) return <EmptyState message="Nothing to report yet." />;
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const sum = sorted.reduce((s, r) => s + r.total, 0);
  return (
    <table className="w-full min-w-[560px] text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-graphite">
          <th className="py-2 pr-4 font-medium">{nameHeader}</th>
          <th className="py-2 pr-6 text-right font-medium">Requests</th>
          <th className="py-2 pr-6 text-right font-medium">Total value</th>
          <th className="w-[32%] py-2 font-medium">Share of value</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const pct = sum > 0 ? (r.total / sum) * 100 : 0;
          return (
            <tr key={r.name} className="border-b border-line last:border-0">
              <td className="py-2.5 pr-4 text-ink">{r.name}</td>
              <td className="py-2.5 pr-6 text-right tabular-nums text-ink">{r.count.toLocaleString("en-IN")}</td>
              <td className="whitespace-nowrap py-2.5 pr-6 text-right tabular-nums text-ink">{formatMoney(r.total)}</td>
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-page-bg">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${pct > 0 ? Math.max(pct, 0.5) : 0}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-graphite">{pct < 1 && pct > 0 ? "<1" : Math.round(pct)}%</span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="border-t border-line text-ink">
          <td className="py-2.5 pr-4 font-medium">Total</td>
          <td className="py-2.5 pr-6 text-right font-medium tabular-nums">{sorted.reduce((s, r) => s + r.count, 0).toLocaleString("en-IN")}</td>
          <td className="whitespace-nowrap py-2.5 pr-6 text-right font-medium tabular-nums">{formatMoney(sum)}</td>
          <td />
        </tr>
      </tfoot>
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
      ? // Drafts aren't requests yet (and are private to their author), so reports skip them.
        db
          .select()
          .from(purchaseRequests)
          .where(and(inArray(purchaseRequests.companyId, ctx.authorizedCompanyIds), ne(purchaseRequests.status, "DRAFT")))
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
    return { name: c.name, count: prs.length, total };
  });

  // Division-wise (active company only)
  const divisionWise = divisionRows.map((d) => {
    const prs = allPRs.filter((p) => p.divisionId === d.id);
    const total = prs.reduce((s, p) => s + Number(p.amount), 0);
    return { name: d.name, count: prs.length, total };
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
    return { name: u.name, count: prs.length, total };
  });
  const activityByStatus = new Map<string, number>();
  for (const a of activityRows) {
    activityByStatus.set(a.toStatus, (activityByStatus.get(a.toStatus) ?? 0) + 1);
  }
  const activityWise = [...activityByStatus.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Request volume and value by company, division and person. Drafts aren't counted." className="" />

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">By company</span>
        </PanelHeader>
        <div className="overflow-x-auto px-5 py-4">
          <ReportTable nameHeader="Company" rows={companyWise} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">By division</span>
          <span className="text-xs text-graphite">Active company</span>
        </PanelHeader>
        <div className="overflow-x-auto px-5 py-4">
          <ReportTable nameHeader="Division" rows={divisionWise} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">By requester</span>
          <span className="text-xs text-graphite">Active company</span>
        </PanelHeader>
        <div className="overflow-x-auto px-5 py-4">
          <ReportTable nameHeader="Requester" rows={userWise} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">Workflow steps recorded</span>
          <span className="text-xs text-graphite">Active company</span>
        </PanelHeader>
        <div className="overflow-x-auto px-5 py-4">
          {activityWise.length === 0 ? (
            <EmptyState message="No workflow steps recorded yet." />
          ) : (
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-graphite">
                  <th className="py-2 pr-4 font-medium">Moved to</th>
                  <th className="py-2 text-right font-medium">Times</th>
                </tr>
              </thead>
              <tbody>
                {activityWise.map(([status, n]) => (
                  <tr key={status} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-4">
                      <StatusTag status={status} />
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-ink">{n.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}
