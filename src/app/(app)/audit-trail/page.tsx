import Link from "next/link";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusTag } from "@/components/ui/StatusTag";
import { UserAvatar } from "@/components/UserAvatar";
import { Pager } from "@/components/ui/Pager";
import { formatDate, formatTime, zonedParts } from "@/lib/format";
import { AUDIT_PAGE_SIZE, AUDIT_TABS, loadAudit, parseAuditParams } from "@/lib/audit-view";

const TONE = { neutral: "text-ink", good: "text-success", warn: "text-warning", bad: "text-danger" } as const;

function dayLabel(d: Date) {
  const key = (x: Date) => {
    const p = zonedParts(x);
    return Date.UTC(p.y, p.m - 1, p.day);
  };
  const diff = Math.round((key(new Date()) - key(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return formatDate(d);
}

function href(kind: string, page = 1) {
  const p = new URLSearchParams();
  if (kind !== "all") p.set("kind", kind);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return `/audit-trail${s ? `?${s}` : ""}`;
}

export default async function AuditTrailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAuthContext();
  const params = parseAuditParams(await searchParams);
  const data = await loadAudit(ctx, params);
  if (!data) return <EmptyState message="The audit trail is for auditors. Ask an admin if you need access." />;
  const { tab, page } = params;

  return (
    <div>
      <PageHeader title="Audit trail" description="Every change in the active company, newest first. Each entry is written in the same transaction as the change itself." />
      <Panel>
        <PanelHeader className="flex-col !items-stretch gap-3 lg:flex-row lg:!items-center">
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5" aria-label="Filter by kind">
            {AUDIT_TABS.map((t) => {
              const active = t.key === tab.key;
              return (
                <Link
                  key={t.key}
                  href={href(t.key)}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors ${active ? "bg-accent text-on-accent" : "text-graphite hover:bg-page-bg hover:text-ink"}`}
                >
                  {t.label} <span className={`tabular-nums ${active ? "text-white/75" : "text-graphite/70"}`}>{data.counts[t.key].toLocaleString("en-IN")}</span>
                </Link>
              );
            })}
          </nav>
          <a
            href={`/api/export/audit${tab.key === "all" ? "" : `?kind=${tab.key}`}`}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-line px-2.5 py-1.5 text-xs text-ink transition-colors hover:bg-page-bg lg:ml-auto lg:self-auto"
          >
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5M4 15.5h12" />
            </svg>
            CSV
          </a>
        </PanelHeader>

        <div className="px-5 py-2">
          {data.entries.length === 0 ? (
            <EmptyState message="Nothing recorded under this filter yet." />
          ) : (
            <ol>
              {data.entries.map((e, i) => {
                const label = dayLabel(e.at);
                const showDay = i === 0 || dayLabel(data.entries[i - 1].at) !== label;
                return (
                  <li key={e.id}>
                    {showDay && <div className="sticky top-14 z-[1] -mx-5 border-b border-line bg-surface/95 px-5 py-2 text-xs font-medium text-graphite backdrop-blur">{label}</div>}
                    <div className="flex gap-3 border-b border-line py-3 last:border-0">
                      <UserAvatar name={e.actorName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <p className="text-sm text-ink">
                            <span className="font-medium">{e.actorName}</span>{" "}
                            <span className={TONE[e.tone]}>{e.before}</span>{" "}
                            {e.doc ? (
                              <Link href={e.doc.href} className="font-mono text-xs text-accent hover:underline">
                                {e.doc.label}
                              </Link>
                            ) : (
                              <span className="text-graphite">a record that no longer exists</span>
                            )}{" "}
                            {e.after && <span className={TONE[e.tone]}>{e.after}</span>}
                          </p>
                          <time dateTime={e.at.toISOString()} className="shrink-0 text-xs tabular-nums text-graphite">
                            {formatTime(e.at)}
                          </time>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {e.statusAfter && (
                            <span className="text-xs text-graphite">
                              Now: <StatusTag status={e.statusAfter} />
                            </span>
                          )}
                          {e.detail && <span className="text-xs text-graphite">{e.detail}</span>}
                          {e.raw && (
                            <details className="text-xs text-graphite">
                              <summary className="cursor-pointer select-none hover:text-ink">Raw record</summary>
                              <pre className="mt-1 overflow-x-auto rounded bg-page-bg px-2 py-1 font-mono text-[11px] text-graphite">{`${e.action}\n${e.raw}`}</pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <Pager page={page} pageSize={AUDIT_PAGE_SIZE} total={data.counts[tab.key]} href={(p) => href(tab.key, p)} />
      </Panel>
    </div>
  );
}
