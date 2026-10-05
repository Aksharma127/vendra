import "server-only";
import { and, count, desc, eq, ilike, inArray, ne, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { divisions, purchaseRequests, users } from "@/db/schema";
import type { AuthContext } from "@/lib/auth-context";

// One definition of "which requests does this list show" for both the pages
// (/purchase-requests/all, /mine) and their CSV export, so a download always
// matches the screen - and can never include rows the screen wouldn't.

type Status = (typeof purchaseRequests.$inferSelect)["status"];
export type RequestScope = "all" | "mine";
export type Tab = { key: string; label: string; statuses: Status[] | null };

export const TABS: Record<RequestScope, Tab[]> = {
  all: [
    { key: "all", label: "All", statuses: null },
    { key: "review", label: "In review", statuses: ["PENDING_DIVISION_APPROVAL", "PENDING_FINANCE_APPROVAL"] },
    { key: "awaiting-po", label: "Awaiting PO", statuses: ["APPROVED_PENDING_PO"] },
    { key: "ordered", label: "Ordered", statuses: ["PO_ISSUED", "CLOSED"] },
    { key: "returned", label: "Returned", statuses: ["RETURNED_FOR_REVISION"] },
    { key: "rejected", label: "Rejected or withdrawn", statuses: ["REJECTED", "WITHDRAWN"] },
  ],
  mine: [
    { key: "all", label: "All", statuses: null },
    { key: "drafts", label: "Drafts", statuses: ["DRAFT"] },
    { key: "returned", label: "Needs changes", statuses: ["RETURNED_FOR_REVISION"] },
    { key: "review", label: "In review", statuses: ["PENDING_DIVISION_APPROVAL", "PENDING_FINANCE_APPROVAL"] },
    { key: "approved", label: "Approved or ordered", statuses: ["APPROVED_PENDING_PO", "PO_ISSUED", "CLOSED"] },
    { key: "rejected", label: "Rejected or withdrawn", statuses: ["REJECTED", "WITHDRAWN"] },
  ],
};

export const PAGE_SIZE = 25;

/** null when this user may not see the list at all. */
function baseScope(ctx: AuthContext, scope: RequestScope): SQL | null {
  if (scope === "mine") return eq(purchaseRequests.requesterId, ctx.userId);
  if (!ctx.capabilities.has("pr:view-all") || !ctx.activeCompanyId) return null;
  // Drafts stay private to their author until submitted.
  return and(
    eq(purchaseRequests.companyId, ctx.activeCompanyId),
    or(ne(purchaseRequests.status, "DRAFT"), eq(purchaseRequests.requesterId, ctx.userId))
  )!;
}

export function parseListParams(scope: RequestScope, sp: Record<string, string | string[] | undefined>) {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tab = TABS[scope].find((t) => t.key === first(sp.status)) ?? TABS[scope][0];
  const q = first(sp.q).trim().slice(0, 100);
  const n = Number(first(sp.page));
  const page = Number.isInteger(n) && n > 0 ? n : 1;
  return { tab, q, page };
}

const columns = {
  id: purchaseRequests.id,
  prNumber: purchaseRequests.prNumber,
  itemDescription: purchaseRequests.itemDescription,
  category: purchaseRequests.category,
  quantity: purchaseRequests.quantity,
  estimatedUnitCost: purchaseRequests.estimatedUnitCost,
  amount: purchaseRequests.amount,
  status: purchaseRequests.status,
  createdAt: purchaseRequests.createdAt,
  updatedAt: purchaseRequests.updatedAt,
  divisionName: divisions.name,
  requesterName: users.name,
};

export async function loadRequestList(
  ctx: AuthContext,
  scope: RequestScope,
  params: { tab: Tab; q: string; page: number },
  opts: { all?: boolean } = {}
) {
  const base = baseScope(ctx, scope);
  if (!base) return null;
  const like = `%${params.q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  const search = params.q
    ? or(ilike(purchaseRequests.prNumber, like), ilike(purchaseRequests.itemDescription, like), ilike(users.name, like), ilike(divisions.name, like))
    : undefined;
  const where = and(base, search, params.tab.statuses ? inArray(purchaseRequests.status, params.tab.statuses) : undefined);

  const rowsQuery = db
    .select(columns)
    .from(purchaseRequests)
    .innerJoin(divisions, eq(purchaseRequests.divisionId, divisions.id))
    .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
    .where(where)
    .orderBy(desc(purchaseRequests.createdAt));

  const [rows, byStatus] = await Promise.all([
    // Exports take everything that matches (capped), pages take one page.
    opts.all ? rowsQuery.limit(5000) : rowsQuery.limit(PAGE_SIZE).offset((params.page - 1) * PAGE_SIZE),
    db
      .select({ status: purchaseRequests.status, n: count() })
      .from(purchaseRequests)
      .innerJoin(divisions, eq(purchaseRequests.divisionId, divisions.id))
      .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(and(base, search))
      .groupBy(purchaseRequests.status),
  ]);

  const countFor = (t: Tab) => byStatus.filter((r) => !t.statuses || t.statuses.includes(r.status)).reduce((s, r) => s + r.n, 0);
  return { rows, counts: Object.fromEntries(TABS[scope].map((t) => [t.key, countFor(t)])) as Record<string, number>, total: countFor(params.tab) };
}
