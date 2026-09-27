import { db } from "@/db";
import { config, companies } from "@/db/schema";
import { requireAuthContext, canOnMenu } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfigRow } from "./ConfigRow";
import { CreateConfigForm } from "./CreateConfigForm";

export default async function AdminConfigPage() {
  const ctx = await requireAuthContext();
  if (!canOnMenu(ctx, "/admin/config", "view")) {
    return <EmptyState message="You don't have permission to view this." />;
  }
  const canCreate = canOnMenu(ctx, "/admin/config", "create");
  const canEdit = canOnMenu(ctx, "/admin/config", "edit");

  const [allConfig, allCompanies] = await Promise.all([
    db.select().from(config),
    db.select({ id: companies.id, name: companies.name }).from(companies),
  ]);
  const companyById = new Map(allCompanies.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-ink">Configuration</h1>

      {canCreate && (
        <Panel className="p-5">
          <div className="text-sm font-medium text-ink mb-3">Add a configuration value</div>
          <CreateConfigForm companies={allCompanies} />
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">Lookup values</span>
        </PanelHeader>
        <div className="px-5 py-4">
          {allConfig.length === 0 ? (
            <EmptyState message="No configuration values yet." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-graphite">
                  <th className="py-2 pr-4 font-medium">Key</th>
                  <th className="py-2 pr-4 font-medium">Scope</th>
                  <th className="py-2 pr-4 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {allConfig.map((c) => (
                  <ConfigRow
                    key={c.id}
                    configId={c.id}
                    configKey={c.key}
                    companyLabel={c.companyId ? companyById.get(c.companyId) ?? "Unknown" : "Global"}
                    value={c.value}
                    readOnly={!canEdit}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}
