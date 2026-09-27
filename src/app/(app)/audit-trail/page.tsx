import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";

export default async function AuditTrailPage() {
  const ctx = await requireAuthContext();
  if (!ctx.capabilities.has("audit:view") || !ctx.activeCompanyId) {
    return <EmptyState message="You don't have permission to view this." />;
  }

  const rows = await db
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
    .where(eq(auditLog.companyId, ctx.activeCompanyId))
    .orderBy(desc(auditLog.createdAt))
    .limit(200);

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink mb-4">Audit Trail</h1>
      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">Recent activity (most recent 200)</span>
        </PanelHeader>
        <div className="px-5 py-4">
          {rows.length === 0 ? (
            <EmptyState message="No audit activity yet." />
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="text-sm border-b border-line last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-ink font-medium">{r.action}</span>
                    <span className="text-xs text-graphite">{formatDateTime(r.createdAt)}</span>
                  </div>
                  <div className="text-xs text-graphite mt-0.5">
                    {r.actorName ?? "System"} · {r.entityType} · {r.entityId.slice(0, 8)}
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
      </Panel>
    </div>
  );
}
