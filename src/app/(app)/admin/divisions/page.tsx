import { eq } from "drizzle-orm";
import { db } from "@/db";
import { divisions, companies } from "@/db/schema";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireAuthContext, canOnMenu } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { DivisionForm } from "./DivisionForm";
import { DivisionToggle } from "./DivisionToggle";

export default async function AdminDivisionsPage() {
  const ctx = await requireAuthContext();
  if (!canOnMenu(ctx, "/admin/divisions", "view")) {
    return <EmptyState message="You don't have permission to view this." />;
  }
  const canEdit = canOnMenu(ctx, "/admin/divisions", "edit");
  const canCreate = canOnMenu(ctx, "/admin/divisions", "create");

  const [rows, allCompanies] = await Promise.all([
    db
      .select({
        id: divisions.id,
        name: divisions.name,
        code: divisions.code,
        isActive: divisions.isActive,
        companyName: companies.name,
      })
      .from(divisions)
      .innerJoin(companies, eq(divisions.companyId, companies.id)),
    db.select({ id: companies.id, name: companies.name }).from(companies),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Divisions" description="Divisions within each company. Every request is raised for one." className="" />

      {canCreate && (
        <Panel className="p-5">
          <div className="text-sm font-medium text-ink mb-3">Add a division</div>
          {allCompanies.length === 0 ? (
            <p className="text-sm text-graphite">Add a company first.</p>
          ) : (
            <DivisionForm companies={allCompanies} />
          )}
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">All divisions</span>
        </PanelHeader>
        <div className="px-5 py-4 overflow-x-auto">
          {rows.length === 0 ? (
            <EmptyState message="No divisions yet." />
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-graphite">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Code</th>
                  <th className="py-2 pr-4 font-medium">Company</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  {canEdit && <th className="py-2 pr-4 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-4 text-ink">{d.name}</td>
                    <td className="py-2.5 pr-4 text-ink font-mono text-xs">{d.code}</td>
                    <td className="py-2.5 pr-4 text-ink">{d.companyName}</td>
                    <td className="py-2.5 pr-4 text-ink">{d.isActive ? "Active" : "Inactive"}</td>
                    {canEdit && (
                      <td className="py-2.5 pr-4">
                        <DivisionToggle divisionId={d.id} isActive={d.isActive} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}
