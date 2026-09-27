import { db } from "@/db";
import { roles, menuItems, roleMenuPermissions } from "@/db/schema";
import { requireAuthContext, canOnMenu } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateRoleForm } from "./CreateRoleForm";
import { MenuPermissionMatrix } from "./MenuPermissionMatrix";

export default async function AdminRolesPage() {
  const ctx = await requireAuthContext();
  if (!canOnMenu(ctx, "/admin/roles", "view")) {
    return <EmptyState message="You don't have permission to view this." />;
  }
  const canCreate = canOnMenu(ctx, "/admin/roles", "create");
  const canEdit = canOnMenu(ctx, "/admin/roles", "edit");

  const [allRoles, allMenuItems, allPermissions] = await Promise.all([
    db.select().from(roles),
    db.select().from(menuItems),
    db.select().from(roleMenuPermissions),
  ]);

  const groupById = new Map(allMenuItems.map((m) => [m.id, m]));
  const leafItems = allMenuItems
    .filter((m) => m.path !== null)
    .map((m) => ({
      id: m.id,
      label: m.label,
      groupLabel: m.parentId ? groupById.get(m.parentId)?.label ?? "" : "General",
    }));

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-ink">Roles</h1>

      {canCreate && (
        <Panel className="p-5">
          <div className="text-sm font-medium text-ink mb-3">Create a role</div>
          <CreateRoleForm />
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">All roles</span>
        </PanelHeader>
        <div className="px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {allRoles.map((r) => (
              <span key={r.id} className="text-sm border border-line rounded px-2.5 py-1 text-ink">
                {r.name}
              </span>
            ))}
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">Menu & action permissions</span>
        </PanelHeader>
        <div className="px-5 py-4">
          {!canEdit && <p className="text-sm text-graphite mb-3">Read-only — you can view but not change permissions.</p>}
          <MenuPermissionMatrix roles={allRoles} menuItems={leafItems} permissions={allPermissions} readOnly={!canEdit} />
        </div>
      </Panel>
    </div>
  );
}
