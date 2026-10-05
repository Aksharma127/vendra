import Link from "next/link";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PRTable } from "@/components/PRTable";
import { Pager } from "@/components/ui/Pager";
import { PAGE_SIZE, TABS, type RequestScope, type Tab } from "@/lib/request-list";

const BASE: Record<RequestScope, string> = { all: "/purchase-requests/all", mine: "/purchase-requests/mine" };

export function listHref(scope: RequestScope, o: { status?: string; q?: string; page?: number }) {
  const p = new URLSearchParams();
  if (o.status && o.status !== "all") p.set("status", o.status);
  if (o.q) p.set("q", o.q);
  if (o.page && o.page > 1) p.set("page", String(o.page));
  const s = p.toString();
  return `${BASE[scope]}${s ? `?${s}` : ""}`;
}

/** Status tabs + search + table + pager, all as plain links and a GET form, so it works before JS loads and every view is shareable. */
export function RequestListView({
  scope,
  tab,
  q,
  page,
  rows,
  counts,
  total,
  emptyMessage,
}: {
  scope: RequestScope;
  tab: Tab;
  q: string;
  page: number;
  rows: Parameters<typeof PRTable>[0]["rows"];
  counts: Record<string, number>;
  total: number;
  emptyMessage: string;
}) {
  const exportParams = new URLSearchParams({ scope });
  if (tab.key !== "all") exportParams.set("status", tab.key);
  if (q) exportParams.set("q", q);

  return (
    <Panel>
      <PanelHeader className="flex-col !items-stretch gap-3 lg:flex-row lg:!items-center">
        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5" aria-label="Filter by status">
          {TABS[scope].map((t) => {
            const active = t.key === tab.key;
            return (
              <Link
                key={t.key}
                href={listHref(scope, { status: t.key, q })}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors ${
                  active ? "bg-accent text-on-accent" : "text-graphite hover:bg-page-bg hover:text-ink"
                }`}
              >
                {t.label} <span className={`tabular-nums ${active ? "text-on-accent/75" : "text-graphite/70"}`}>{counts[t.key] ?? 0}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 lg:ml-auto">
          <form action={BASE[scope]} className="flex-1 lg:w-64 lg:flex-none" role="search">
            {tab.key !== "all" && <input type="hidden" name="status" value={tab.key} />}
            <label className="sr-only" htmlFor={`search-${scope}`}>
              Search these requests
            </label>
            <input
              id={`search-${scope}`}
              type="search"
              name="q"
              defaultValue={q}
              placeholder="PR number, item, person…"
              className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-graphite/80 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </form>
          <a
            href={`/api/export/requests?${exportParams}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-ink transition-colors hover:bg-page-bg"
            title="Download these requests as a CSV file"
          >
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5M4 15.5h12" />
            </svg>
            CSV
          </a>
        </div>
      </PanelHeader>
      <div className="overflow-x-auto px-5 py-4">
        <PRTable
          rows={rows}
          emptyMessage={q ? `No requests match “${q}”. Try a PR number, an item or a name.` : tab.key === "all" ? emptyMessage : `Nothing under “${tab.label}”.`}
        />
      </div>
      <Pager page={page} pageSize={PAGE_SIZE} total={total} href={(p) => listHref(scope, { status: tab.key, q, page: p })} />
    </Panel>
  );
}
