import { and, desc, eq, ilike, inArray, ne, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { purchaseOrders, purchaseRequests, users, vendors } from "@/db/schema";
import { getAuthContext } from "@/lib/auth-context";
import { formatMoney } from "@/lib/format";
import { statusLabel } from "@/components/ui/StatusTag";

export type SearchResult = {
  kind: "request" | "order";
  id: string;
  title: string;
  number: string;
  meta: string;
  href: string;
};

/**
 * Quick search behind Ctrl/Cmd+K. Returns only what the signed-in user could
 * open anyway - the same visibility rules as the request and order pages:
 * - requests: your own (drafts included); otherwise only submitted ones, and
 *   only if your role can see them (company-wide viewers, finance, or the
 *   division approver for that division), in the active company.
 * - orders: company-wide roles see all; everyone else only orders raised
 *   against their own requests.
 */
export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return Response.json({ error: "Please sign in again." }, { status: 401 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2 || !ctx.hasBusinessRole) return Response.json({ results: [] });
  const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;

  // ---- requests ----
  const own = eq(purchaseRequests.requesterId, ctx.userId);
  const others: SQL[] = [];
  if (ctx.activeCompanyId) {
    const inCompanySubmitted = and(eq(purchaseRequests.companyId, ctx.activeCompanyId), ne(purchaseRequests.status, "DRAFT"));
    if (ctx.capabilities.has("pr:view-all") || ctx.capabilities.has("pr:approve-finance")) others.push(inCompanySubmitted!);
    else if (ctx.capabilities.has("pr:approve-division") && ctx.authorizedDivisionIds.length) {
      others.push(and(inCompanySubmitted, inArray(purchaseRequests.divisionId, ctx.authorizedDivisionIds))!);
    }
  }
  const visible = others.length ? or(own, ...others)! : own;
  const matches = or(ilike(purchaseRequests.prNumber, like), ilike(purchaseRequests.itemDescription, like), ilike(users.name, like))!;

  const canSeeAllOrders = ctx.capabilities.has("pr:view-all") || ctx.capabilities.has("po:issue");
  const orderScope = canSeeAllOrders
    ? ctx.activeCompanyId
      ? eq(purchaseOrders.companyId, ctx.activeCompanyId)
      : undefined
    : own;

  const [requests, orders] = await Promise.all([
    db
      .select({
        id: purchaseRequests.id,
        prNumber: purchaseRequests.prNumber,
        item: purchaseRequests.itemDescription,
        amount: purchaseRequests.amount,
        status: purchaseRequests.status,
        requester: users.name,
      })
      .from(purchaseRequests)
      .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(and(visible, matches))
      .orderBy(desc(purchaseRequests.createdAt))
      .limit(6),
    orderScope
      ? db
          .select({
            id: purchaseOrders.id,
            poNumber: purchaseOrders.poNumber,
            status: purchaseOrders.status,
            amount: purchaseOrders.amount,
            vendor: vendors.name,
            item: purchaseRequests.itemDescription,
          })
          .from(purchaseOrders)
          .innerJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
          .innerJoin(purchaseRequests, eq(purchaseOrders.prId, purchaseRequests.id))
          .where(
            and(
              orderScope,
              or(ilike(purchaseOrders.poNumber, like), ilike(vendors.name, like), ilike(purchaseRequests.itemDescription, like), ilike(purchaseRequests.prNumber, like))
            )
          )
          .orderBy(desc(purchaseOrders.createdAt))
          .limit(5)
      : Promise.resolve([]),
  ]);

  const results: SearchResult[] = [
    ...requests.map((r) => ({
      kind: "request" as const,
      id: r.id,
      title: r.item,
      number: r.prNumber ?? "Draft",
      meta: `${r.requester}, ${formatMoney(r.amount)}, ${statusLabel(r.status)}`,
      href: `/purchase-requests/${r.id}`,
    })),
    ...orders.map((o) => ({
      kind: "order" as const,
      id: o.id,
      title: o.item,
      number: o.poNumber ?? "PO",
      meta: `${o.vendor}, ${formatMoney(o.amount)}, ${statusLabel(o.status)}`,
      href: `/purchase-orders/${o.id}`,
    })),
  ];
  return Response.json({ results });
}
