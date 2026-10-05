import { getAuthContext } from "@/lib/auth-context";
import { loadRequestList, parseListParams, type RequestScope } from "@/lib/request-list";
import { csvResponse, toCsv, todayStamp } from "@/lib/csv";
import { statusLabel } from "@/components/ui/StatusTag";

/** CSV of a request list, with exactly the filters (and permissions) of the page it came from. */
export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return new Response("Please sign in again.", { status: 401 });

  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const scope: RequestScope = sp.scope === "mine" ? "mine" : "all";
  const params = parseListParams(scope, sp);
  const list = await loadRequestList(ctx, scope, params, { all: true });
  if (!list) return new Response("You don't have access to this list.", { status: 403 });

  const csv = toCsv(
    ["PR number", "Item", "Category", "Requester", "Division", "Quantity", "Unit cost (INR)", "Amount (INR)", "Status", "Raised (UTC)", "Last updated (UTC)"],
    list.rows.map((r) => [
      r.prNumber ?? "Draft",
      r.itemDescription,
      r.category,
      r.requesterName,
      r.divisionName,
      Number(r.quantity),
      Number(r.estimatedUnitCost),
      Number(r.amount),
      statusLabel(r.status),
      r.createdAt,
      r.updatedAt,
    ])
  );
  const suffix = params.tab.key === "all" ? "" : `-${params.tab.key}`;
  return csvResponse(`vendra-${scope === "mine" ? "my-requests" : "requests"}${suffix}-${todayStamp()}.csv`, csv);
}
