import Link from "next/link";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusTag } from "@/components/ui/StatusTag";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pager } from "@/components/ui/Pager";
import { POTable } from "@/components/POTable";
import { formatMoney, formatDate } from "@/lib/format";
import { ORDER_PAGE_SIZE, ORDER_TABS, isOverdue, loadOrderList, parseOrderParams } from "@/lib/order-list";

function href(o: { status?: string; q?: string; page?: number }) {
  const p = new URLSearchParams();
  if (o.status && o.status !== "all") p.set("status", o.status);
  if (o.q) p.set("q", o.q);
  if (o.page && o.page > 1) p.set("page", String(o.page));
  const s = p.toString();
  return `/purchase-orders${s ? `?${s}` : ""}`;
}

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAuthContext();
  const params = parseOrderParams(await searchParams);
  const list = await loadOrderList(ctx, params);
  if (!list) return <EmptyState message="Pick a company first." />;
  const { tab, q, page } = params;
  const canViewAny = ctx.capabilities.has("pr:view-all") || ctx.capabilities.has("po:issue");
  const overdue = list.overdue;

  const exportParams = new URLSearchParams();
  if (tab.key !== "all") exportParams.set("status", tab.key);
  if (q) exportParams.set("q", q);

  return (
    <div>
      <PageHeader
        title="Purchase orders"
        description={canViewAny ? "Every order issued in the active company, newest first." : "Orders raised against your own requests."}
      />
      <Panel>
        <PanelHeader className="flex-col !items-stretch gap-3 lg:flex-row lg:!items-center">
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5" aria-label="Filter by status">
            {ORDER_TABS.map((t) => {
              const active = t.key === tab.key;
              return (
                <Link
                  key={t.key}
                  href={href({ status: t.key, q })}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors ${
                    active ? "bg-accent text-on-accent" : "text-graphite hover:bg-page-bg hover:text-ink"
                  }`}
                >
                  {t.label} <span className={`tabular-nums ${active ? "text-white/75" : "text-graphite/70"}`}>{list.counts[t.key] ?? 0}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 lg:ml-auto">
            <form action="/purchase-orders" className="flex-1 lg:w-64 lg:flex-none" role="search">
              {tab.key !== "all" && <input type="hidden" name="status" value={tab.key} />}
              <label className="sr-only" htmlFor="search-orders">
                Search orders
              </label>
              <input
                id="search-orders"
                type="search"
                name="q"
                defaultValue={q}
                placeholder="PO or PR number, vendor, item…"
                className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-graphite/80 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </form>
            <a
              href={`/api/export/orders?${exportParams}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-ink transition-colors hover:bg-page-bg"
              title="Download these orders as a CSV file"
            >
              <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5M4 15.5h12" />
              </svg>
              CSV
            </a>
          </div>
        </PanelHeader>
        {overdue > 0 && (
          <p className="border-b border-line bg-danger/5 px-5 py-2 text-xs text-danger">
            {overdue} order{overdue === 1 ? " is" : "s are"} past {overdue === 1 ? "its" : "their"} delivery date and not marked delivered.{" "}
            {tab.key !== "issued" && (
              <Link href={href({ status: "issued" })} className="font-medium underline underline-offset-2">
                Show orders awaiting delivery
              </Link>
            )}
          </p>
        )}
        <div className="overflow-x-auto px-5 py-4">
          {list.rows.length === 0 ? (
            <EmptyState message={q ? `No orders match “${q}”.` : tab.key === "all" ? "No purchase orders yet. They appear here once procurement issues one." : `Nothing under “${tab.label}”.`} />
          ) : (
            <POTable rows={list.rows} isOverdue={isOverdue} />
          )}
        </div>
        <Pager page={page} pageSize={ORDER_PAGE_SIZE} total={list.total} href={(p) => href({ status: tab.key, q, page: p })} />
      </Panel>
    </div>
  );
}
