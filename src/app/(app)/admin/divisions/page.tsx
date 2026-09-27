import { eq } from "drizzle-orm";
import { db } from "@/db";
import { divisions, companies } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function AdminDivisionsPage() {
  const ctx = await requireAuthContext();
  if (!ctx.capabilities.has("admin:manage")) return <EmptyState message="You don't have permission to view this." />;

  const rows = await db
    .select({
      id: divisions.id,
      name: divisions.name,
      code: divisions.code,
      isActive: divisions.isActive,
      companyName: companies.name,
    })
    .from(divisions)
    .innerJoin(companies, eq(divisions.companyId, companies.id));

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink mb-4">Divisions</h1>
      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">All divisions</span>
        </PanelHeader>
        <div className="px-5 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-graphite">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Code</th>
                <th className="py-2 pr-4 font-medium">Company</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-4 text-ink">{d.name}</td>
                  <td className="py-2.5 pr-4 text-ink font-mono text-xs">{d.code}</td>
                  <td className="py-2.5 pr-4 text-ink">{d.companyName}</td>
                  <td className="py-2.5 pr-4 text-ink">{d.isActive ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
