import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";
import { Pager, pageParam } from "@/components/ui/Pager";

const PAGE_SIZE = 50;
const ENTITY_LINK: Record<string, string> = { purchase_requests: "/purchase-requests/", purchase_orders: "/purchase-orders/" };

export default async function AuditTrailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAuthContext();
  if (!ctx.capabilities.has("audit:view") || !ctx.activeCompanyId) {
    return <EmptyState message="You don't have permission to view this." />;
  }

  const page = pageParam((await searchParams).page);
  const where = eq(auditLog.companyId, ctx.activeCompanyId);
  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(auditLog).where(where),
    db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      beforeState: auditLog.beforeState,
      afterState: auditLog.afterState,
      createdAt: auditLog.createdAt,
      actorName: users.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .where(where)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE),
  ]);

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink mb-4">Audit Trail</h1>
      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">Every change in the active company, newest first</span>
        </PanelHeader>
        <div className="px-5 py-4">
          {rows.length === 0 ? (
            <EmptyState message="No audit activity yet." />
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="text-sm border-b border-line last:border-0 pb-3 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-ink font-medium">{r.action}</span>
                    <span className="text-xs text-graphite">{formatDateTime(r.createdAt)}</span>
                  </div>
                  <div className="text-xs text-graphite mt-0.5">
                    {r.actorName ?? "System"} · {r.entityType.replace("_", " ")} ·{" "}
                    {ENTITY_LINK[r.entityType] ? (
                      <Link href={ENTITY_LINK[r.entityType] + r.entityId} className="text-accent hover:underline font-mono">
                        {r.entityId.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="font-mono">{r.entityId.slice(0, 8)}</span>
                    )}
                  </div>
                  {r.afterState && (
                    <pre className="text-xs text-graphite mt-1 bg-page-bg rounded px-2 py-1 overflow-x-auto font-mono">
                      {r.afterState}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <Pager page={page} pageSize={PAGE_SIZE} total={total} href={(p) => (p > 1 ? `/audit-trail?page=${p}` : "/audit-trail")} />
      </Panel>
    </div>
  );
}
