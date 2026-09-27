import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { purchaseOrders, vendors, purchaseRequests, divisions, users } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel } from "@/components/ui/Panel";
import { StatusTag } from "@/components/ui/StatusTag";
import { formatMoney, formatDate } from "@/lib/format";
import { PODetailActions } from "./PODetailActions";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-graphite mb-0.5">{label}</div>
      <div className="text-sm text-ink">{value}</div>
    </div>
  );
}

export default async function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuthContext();

  const [po] = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      companyId: purchaseOrders.companyId,
      amount: purchaseOrders.amount,
      deliveryDate: purchaseOrders.deliveryDate,
      paymentTerms: purchaseOrders.paymentTerms,
      status: purchaseOrders.status,
      vendorName: vendors.name,
      prNumber: purchaseRequests.prNumber,
      prId: purchaseRequests.id,
      divisionName: divisions.name,
      requesterName: users.name,
    })
    .from(purchaseOrders)
    .innerJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
    .innerJoin(purchaseRequests, eq(purchaseOrders.prId, purchaseRequests.id))
    .innerJoin(divisions, eq(purchaseRequests.divisionId, divisions.id))
    .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
    .where(eq(purchaseOrders.id, id))
    .limit(1);

  if (!po || !ctx.authorizedCompanyIds.includes(po.companyId)) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-ink font-mono">{po.poNumber}</h1>
        <StatusTag status={po.status} />
      </div>

      <Panel className="p-5 grid grid-cols-3 gap-5">
        <Field label="Vendor" value={po.vendorName} />
        <Field
          label="Purchase Request"
          value={
            <a href={`/purchase-requests/${po.prId}`} className="text-accent hover:underline font-mono text-xs">
              {po.prNumber}
            </a>
          }
        />
        <Field label="Division" value={po.divisionName} />
        <Field label="Requester" value={po.requesterName} />
        <Field label="Amount" value={formatMoney(po.amount)} />
        <Field label="Delivery date" value={formatDate(po.deliveryDate)} />
        <Field label="Payment terms" value={po.paymentTerms} />
      </Panel>

      {ctx.capabilities.has("po:issue") && (
        <Panel className="p-5">
          <div className="text-sm font-medium text-ink mb-3">Actions</div>
          <PODetailActions poId={po.id} status={po.status} />
        </Panel>
      )}
    </div>
  );
}
