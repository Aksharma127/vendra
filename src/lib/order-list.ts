import "server-only";
import { and, count, desc, eq, ilike, inArray, lt, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { purchaseOrders, purchaseRequests, vendors } from "@/db/schema";
import type { AuthContext } from "@/lib/auth-context";

type POStatus = (typeof purchaseOrders.$inferSelect)["status"];
export type OrderTab = { key: string; label: string; statuses: POStatus[] | null };

export const ORDER_TABS: OrderTab[] = [
  { key: "all", label: "All", statuses: null },
  { key: "issued", label: "Awaiting delivery", statuses: ["ISSUED"] },
  { key: "delivered", label: "Delivered", statuses: ["DELIVERED"] },
  { key: "closed", label: "Closed", statuses: ["CLOSED"] },
];
export const ORDER_PAGE_SIZE = 25;

/** Same scope as the PO pages: company-wide roles see all, others only orders on their own requests. */
function baseScope(ctx: AuthContext): SQL | null {
  if (!ctx.activeCompanyId) return null;
  const inCompany = eq(purchaseOrders.companyId, ctx.activeCompanyId);
  const canViewAny = ctx.capabilities.has("pr:view-all") || ctx.capabilities.has("po:issue");
  return canViewAny ? inCompany : and(inCompany, eq(purchaseRequests.requesterId, ctx.userId))!;
}

export function parseOrderParams(sp: Record<string, string | string[] | undefined>) {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tab = ORDER_TABS.find((t) => t.key === first(sp.status)) ?? ORDER_TABS[0];
  const q = first(sp.q).trim().slice(0, 100);
  const n = Number(first(sp.page));
  return { tab, q, page: Number.isInteger(n) && n > 0 ? n : 1 };
}

export async function loadOrderList(ctx: AuthContext, params: { tab: OrderTab; q: string; page: number }, opts: { all?: boolean } = {}) {
  const base = baseScope(ctx);
  if (!base) return null;
  const like = `%${params.q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  const search = params.q
    ? or(ilike(purchaseOrders.poNumber, like), ilike(vendors.name, like), ilike(purchaseRequests.prNumber, like), ilike(purchaseRequests.itemDescription, like))
    : undefined;
  const where = and(base, search, params.tab.statuses ? inArray(purchaseOrders.status, params.tab.statuses) : undefined);

  const rowsQuery = db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      amount: purchaseOrders.amount,
      status: purchaseOrders.status,
      deliveryDate: purchaseOrders.deliveryDate,
      paymentTerms: purchaseOrders.paymentTerms,
      createdAt: purchaseOrders.createdAt,
      vendorName: vendors.name,
      prId: purchaseRequests.id,
      prNumber: purchaseRequests.prNumber,
      itemDescription: purchaseRequests.itemDescription,
    })
    .from(purchaseOrders)
    .innerJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
    .innerJoin(purchaseRequests, eq(purchaseOrders.prId, purchaseRequests.id))
    .where(where)
    .orderBy(desc(purchaseOrders.createdAt));

  const [rows, byStatus, [late]] = await Promise.all([
    opts.all ? rowsQuery.limit(5000) : rowsQuery.limit(ORDER_PAGE_SIZE).offset((params.page - 1) * ORDER_PAGE_SIZE),
    db
      .select({ status: purchaseOrders.status, n: count() })
      .from(purchaseOrders)
      .innerJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
      .innerJoin(purchaseRequests, eq(purchaseOrders.prId, purchaseRequests.id))
      .where(and(base, search))
      .groupBy(purchaseOrders.status),
    // Across everything in scope, not just this page.
    db
      .select({ n: count() })
      .from(purchaseOrders)
      .innerJoin(purchaseRequests, eq(purchaseOrders.prId, purchaseRequests.id))
      .where(and(base, eq(purchaseOrders.status, "ISSUED"), lt(purchaseOrders.deliveryDate, indianToday()))),
  ]);
  const countFor = (t: OrderTab) => byStatus.filter((r) => !t.statuses || t.statuses.includes(r.status)).reduce((s, r) => s + r.n, 0);
  return {
    rows,
    counts: Object.fromEntries(ORDER_TABS.map((t) => [t.key, countFor(t)])) as Record<string, number>,
    total: countFor(params.tab),
    overdue: late?.n ?? 0,
  };
}

/** Today's date in India as YYYY-MM-DD (delivery dates are plain dates). */
function indianToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/** An issued order whose delivery date has passed. */
export function isOverdue(status: string, deliveryDate: string) {
  return status === "ISSUED" && deliveryDate < indianToday();
}
