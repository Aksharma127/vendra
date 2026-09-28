import { db } from "@/db";
import { companies } from "@/db/schema";
import { requireAuthContext, canOnMenu } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { CompanyForm } from "./CompanyForm";
import { CompanyToggle } from "./CompanyToggle";

export default async function AdminCompaniesPage() {
  const ctx = await requireAuthContext();
  if (!canOnMenu(ctx, "/admin/companies", "view")) {
    return <EmptyState message="You don't have permission to view this." />;
  }
  const canEdit = canOnMenu(ctx, "/admin/companies", "edit");
  const canCreate = canOnMenu(ctx, "/admin/companies", "create");

  const rows = await db.select().from(companies);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-ink">Companies</h1>

      {canCreate && (
        <Panel className="p-5">
          <div className="text-sm font-medium text-ink mb-3">Add a company</div>
          <CompanyForm />
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">All companies</span>
        </PanelHeader>
        <div className="px-5 py-4 overflow-x-auto">
          {rows.length === 0 ? (
            <EmptyState message="No companies yet." />
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-graphite">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Code</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  {canEdit && <th className="py-2 pr-4 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-4 text-ink">{c.name}</td>
                    <td className="py-2.5 pr-4 text-ink font-mono text-xs">{c.code}</td>
                    <td className="py-2.5 pr-4 text-ink">{c.isActive ? "Active" : "Inactive"}</td>
                    {canEdit && (
                      <td className="py-2.5 pr-4">
                        <CompanyToggle companyId={c.id} isActive={c.isActive} />
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
