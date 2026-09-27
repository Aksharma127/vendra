import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { purchaseOrders, vendors, purchaseRequests } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusTag } from "@/components/ui/StatusTag";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney, formatDate } from "@/lib/format";

export default async function PurchaseOrdersPage() {
  const ctx = await requireAuthContext();
  if (!ctx.activeCompanyId) return <EmptyState message="No active company." />;

  const rows = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      amount: purchaseOrders.amount,
      status: purchaseOrders.status,
      deliveryDate: purchaseOrders.deliveryDate,
      createdAt: purchaseOrders.createdAt,
      vendorName: vendors.name,
      prNumber: purchaseRequests.prNumber,
    })
    .from(purchaseOrders)
    .innerJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
    .innerJoin(purchaseRequests, eq(purchaseOrders.prId, purchaseRequests.id))
    .where(eq(purchaseOrders.companyId, ctx.activeCompanyId))
    .orderBy(purchaseOrders.createdAt);

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink mb-4">Purchase Orders</h1>
      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">Issued purchase orders</span>
        </PanelHeader>
        <div className="px-5 py-4 overflow-x-auto">
          {rows.length === 0 ? (
            <EmptyState message="No purchase orders issued yet." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-graphite">
                  <th className="py-2 pr-4 font-medium">PO Number</th>
                  <th className="py-2 pr-4 font-medium">PR Number</th>
                  <th className="py-2 pr-4 font-medium">Vendor</th>
                  <th className="py-2 pr-4 font-medium">Amount</th>
                  <th className="py-2 pr-4 font-medium">Delivery</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.reverse().map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-page-bg">
                    <td className="py-2.5 pr-4">
                      <Link href={`/purchase-orders/${r.id}`} className="text-accent hover:underline font-mono text-xs">
                        {r.poNumber}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-ink font-mono text-xs">{r.prNumber}</td>
                    <td className="py-2.5 pr-4 text-ink">{r.vendorName}</td>
                    <td className="py-2.5 pr-4 text-ink">{formatMoney(r.amount)}</td>
                    <td className="py-2.5 pr-4 text-graphite">{formatDate(r.deliveryDate)}</td>
                    <td className="py-2.5 pr-4">
                      <StatusTag status={r.status} />
                    </td>
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
