import { eq } from "drizzle-orm";
import { db } from "@/db";
import { purchaseRequests, divisions, users } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PRTable } from "@/components/PRTable";

export default async function AllRequestsPage() {
  const ctx = await requireAuthContext();
  if (!ctx.capabilities.has("pr:view-all") || !ctx.activeCompanyId) {
    return <div className="text-sm text-graphite">You don&apos;t have permission to view this.</div>;
  }

  const rows = await db
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
    .where(eq(purchaseRequests.companyId, ctx.activeCompanyId))
    .orderBy(purchaseRequests.createdAt);

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink mb-4">All Requests</h1>
      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">All requests in the active company</span>
        </PanelHeader>
        <div className="px-5 py-4 overflow-x-auto">
          <PRTable rows={rows.reverse()} emptyMessage="No purchase requests in this company yet." />
        </div>
      </Panel>
    </div>
  );
}
