import { getAuthContext } from "@/lib/auth-context";
import { isOverdue, loadOrderList, parseOrderParams } from "@/lib/order-list";
import { csvResponse, toCsv, todayStamp } from "@/lib/csv";
import { statusLabel } from "@/components/ui/StatusTag";

/** CSV of the purchase-order list, with the page's own filters and permissions. */
export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return new Response("Please sign in again.", { status: 401 });
  const params = parseOrderParams(Object.fromEntries(new URL(request.url).searchParams));
  const list = await loadOrderList(ctx, params, { all: true });
  if (!list) return new Response("Pick a company first.", { status: 403 });

  const csv = toCsv(
    ["PO number", "PR number", "Item", "Vendor", "Amount (INR)", "Status", "Delivery date", "Overdue", "Payment terms", "Issued (UTC)"],
    list.rows.map((r) => [
      r.poNumber,
      r.prNumber,
      r.itemDescription,
      r.vendorName,
      Number(r.amount),
      statusLabel(r.status),
      r.deliveryDate,
      isOverdue(r.status, r.deliveryDate) ? "Yes" : "No",
      r.paymentTerms,
      r.createdAt,
    ])
  );
  return csvResponse(`vendra-purchase-orders${params.tab.key === "all" ? "" : `-${params.tab.key}`}-${todayStamp()}.csv`, csv);
}
