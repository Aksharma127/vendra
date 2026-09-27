import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { purchaseRequests, divisions } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { PRTable } from "@/components/PRTable";

export default async function MyRequestsPage() {
  const ctx = await requireAuthContext();

  const rows = await db
    .select({
      id: purchaseRequests.id,
      prNumber: purchaseRequests.prNumber,
      itemDescription: purchaseRequests.itemDescription,
      amount: purchaseRequests.amount,
      status: purchaseRequests.status,
      createdAt: purchaseRequests.createdAt,
      divisionName: divisions.name,
    })
    .from(purchaseRequests)
    .innerJoin(divisions, eq(purchaseRequests.divisionId, divisions.id))
    .where(eq(purchaseRequests.requesterId, ctx.userId))
    .orderBy(purchaseRequests.createdAt);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-ink">My Requests</h1>
        <Link href="/purchase-requests/new">
          <Button>New Request</Button>
        </Link>
      </div>
      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">All requests you have raised</span>
        </PanelHeader>
        <div className="px-5 py-4 overflow-x-auto">
          <PRTable rows={rows.reverse()} emptyMessage="You haven't raised any purchase requests yet." />
        </div>
      </Panel>
    </div>
  );
}
