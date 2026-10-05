import Link from "next/link";
import { and, count, desc, eq, ilike, inArray, ne, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { purchaseRequests, divisions, users } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PRTable } from "@/components/PRTable";
import { Pager, pageParam } from "@/components/ui/Pager";

const PAGE_SIZE = 25;

// Tabs group the workflow states the way people actually ask about them.
const TABS = [
  { key: "all", label: "All", statuses: null },
  { key: "review", label: "In review", statuses: ["PENDING_DIVISION_APPROVAL", "PENDING_FINANCE_APPROVAL"] },
  { key: "awaiting-po", label: "Awaiting PO", statuses: ["APPROVED_PENDING_PO"] },
  { key: "ordered", label: "Ordered", statuses: ["PO_ISSUED", "CLOSED"] },
  { key: "returned", label: "Returned", statuses: ["RETURNED_FOR_REVISION"] },
  { key: "rejected", label: "Rejected / withdrawn", statuses: ["REJECTED", "WITHDRAWN"] },
] as const;

type Status = (typeof purchaseRequests.$inferSelect)["status"];
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AllRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAuthContext();
  if (!ctx.capabilities.has("pr:view-all") || !ctx.activeCompanyId) {
    return <div className="text-sm text-graphite">You don&apos;t have permission to view this.</div>;
  }

  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === first(sp.status)) ?? TABS[0];
  const q = first(sp.q).trim().slice(0, 100);
  const page = pageParam(sp.page);

  // Drafts stay private to their author until submitted.
  const base = and(
    eq(purchaseRequests.companyId, ctx.activeCompanyId),
    or(ne(purchaseRequests.status, "DRAFT"), eq(purchaseRequests.requesterId, ctx.userId))
  );
  const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  const search: SQL | undefined = q
    ? or(ilike(purchaseRequests.prNumber, like), ilike(purchaseRequests.itemDescription, like), ilike(users.name, like), ilike(divisions.name, like))
    : undefined;
  const where = and(base, search, tab.statuses ? inArray(purchaseRequests.status, tab.statuses as unknown as Status[]) : undefined);

  const [rows, byStatus] = await Promise.all([
    db
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
      .where(where)
      .orderBy(desc(purchaseRequests.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    // Tab counts honour the search box, so the numbers match what you'd see.
    db
      .select({ status: purchaseRequests.status, n: count() })
      .from(purchaseRequests)
      .innerJoin(divisions, eq(purchaseRequests.divisionId, divisions.id))
      .innerJoin(users, eq(purchaseRequests.requesterId, users.id))
      .where(and(base, search))
      .groupBy(purchaseRequests.status),
  ]);

  const countFor = (t: (typeof TABS)[number]) =>
    byStatus.filter((r) => !t.statuses || (t.statuses as readonly string[]).includes(r.status)).reduce((s, r) => s + r.n, 0);
  const total = countFor(tab);

  const href = (o: { status?: string; page?: number }) => {
    const p = new URLSearchParams();
    const status = o.status ?? tab.key;
    if (status !== "all") p.set("status", status);
    if (q) p.set("q", q);
    if (o.page && o.page > 1) p.set("page", String(o.page));
    const s = p.toString();
    return `/purchase-requests/all${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink mb-4">All Requests</h1>
      <Panel>
        <PanelHeader>
          <div className="flex flex-col gap-3 w-full sm:flex-row sm:items-center sm:justify-between">
            <nav className="flex gap-1 overflow-x-auto -mx-1 px-1" aria-label="Filter by status">
              {TABS.map((t) => {
                const active = t.key === tab.key;
                return (
                  <Link
                    key={t.key}
                    href={href({ status: t.key })}
                    aria-current={active ? "page" : undefined}
                    className={`shrink-0 rounded px-2.5 py-1 text-xs whitespace-nowrap transition-colors ${
                      active ? "bg-accent text-white" : "text-graphite hover:bg-page-bg hover:text-ink"
                    }`}
                  >
                    {t.label} <span className={active ? "text-white/75" : "text-graphite/70"}>{countFor(t)}</span>
                  </Link>
                );
              })}
            </nav>
            <form action="/purchase-requests/all" className="flex gap-2 sm:w-64">
              {tab.key !== "all" && <input type="hidden" name="status" value={tab.key} />}
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search PR, item, person..."
                className="w-full text-sm border border-line rounded px-3 py-1.5 bg-surface text-ink placeholder:text-graphite focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </form>
          </div>
        </PanelHeader>
        <div className="px-5 py-4 overflow-x-auto">
          <PRTable
            rows={rows}
            emptyMessage={q ? `No requests match “${q}”.` : tab.key === "all" ? "No purchase requests in this company yet." : `Nothing in “${tab.label}”.`}
          />
        </div>
        <Pager page={page} pageSize={PAGE_SIZE} total={total} href={(p) => href({ page: p })} />
      </Panel>
    </div>
  );
}
