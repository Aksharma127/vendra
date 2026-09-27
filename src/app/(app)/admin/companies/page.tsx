import { db } from "@/db";
import { companies } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function AdminCompaniesPage() {
  const ctx = await requireAuthContext();
  if (!ctx.capabilities.has("admin:manage")) return <EmptyState message="You don't have permission to view this." />;

  const rows = await db.select().from(companies);

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink mb-4">Companies</h1>
      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">All companies</span>
        </PanelHeader>
        <div className="px-5 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-graphite">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Code</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-4 text-ink">{c.name}</td>
                  <td className="py-2.5 pr-4 text-ink font-mono text-xs">{c.code}</td>
                  <td className="py-2.5 pr-4 text-ink">{c.isActive ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
