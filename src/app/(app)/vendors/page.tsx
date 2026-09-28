import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vendors } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorForm } from "./VendorForm";
import { VendorToggle } from "./VendorToggle";

export default async function VendorsPage() {
  const ctx = await requireAuthContext();
  if (!ctx.activeCompanyId) return <EmptyState message="No active company." />;

  const rows = await db.select().from(vendors).where(eq(vendors.companyId, ctx.activeCompanyId));
  const canManage = ctx.capabilities.has("vendor:manage");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-ink">Vendors</h1>

      {canManage && (
        <Panel className="p-5">
          <div className="text-sm font-medium text-ink mb-3">Add a vendor</div>
          <VendorForm />
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">Vendors for the active company</span>
        </PanelHeader>
        <div className="px-5 py-4 overflow-x-auto">
          {rows.length === 0 ? (
            <EmptyState message="No vendors yet." />
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-graphite">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Contact</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  {canManage && <th className="py-2 pr-4 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-4 text-ink">{v.name}</td>
                    <td className="py-2.5 pr-4 text-graphite">{v.category ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-graphite">{v.contactEmail ?? v.contactName ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-ink">{v.isActive ? "Active" : "Inactive"}</td>
                    {canManage && (
                      <td className="py-2.5 pr-4">
                        <VendorToggle vendorId={v.id} isActive={v.isActive} />
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
