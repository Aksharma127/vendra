import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { divisions, purchaseRequests } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PRTable } from "@/components/PRTable";
import { NewPRForm } from "./NewPRForm";
import { aiConfigured } from "@/lib/ai/draft";

export default async function NewPRPage() {
  const ctx = await requireAuthContext();

  const [availableDivisions, existingRows] = await Promise.all([
    ctx.authorizedDivisionIds.length > 0
      ? db.select().from(divisions).where(inArray(divisions.id, ctx.authorizedDivisionIds))
      : Promise.resolve([]),
    db
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
      .orderBy(desc(purchaseRequests.createdAt))
      .limit(8),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">New Purchase Request</h1>
        {/* Not committed to anything by opening this form - a way back to
            the list, matching every other "Add" screen in the app, which
            all show the form above the existing list rather than hiding it
            behind a separate page. */}
        <Link href="/purchase-requests/mine" className="text-sm text-graphite hover:text-ink transition-colors">
          Cancel
        </Link>
      </div>
      <Panel className="p-6">
        <NewPRForm divisions={availableDivisions.map((d) => ({ id: d.id, name: d.name }))} aiEnabled={aiConfigured()} />
      </Panel>

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">Your recent requests</span>
          <Link href="/purchase-requests/mine" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </PanelHeader>
        <div className="px-5 py-4 overflow-x-auto">
          <PRTable rows={existingRows} emptyMessage="You haven't raised any purchase requests yet." />
        </div>
      </Panel>
    </div>
  );
}
