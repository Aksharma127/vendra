import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, userRoles, roles, companies, divisions } from "@/db/schema";
import { requireAuthContext, canOnMenu } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateUserForm } from "./CreateUserForm";
import { AssignRoleForm } from "./AssignRoleForm";
import { UserToggle, RevokeRoleButton } from "./UserActions";

export default async function AdminUsersPage() {
  const ctx = await requireAuthContext();
  if (!canOnMenu(ctx, "/admin/users", "view")) {
    return <EmptyState message="You don't have permission to view this." />;
  }
  const canCreate = canOnMenu(ctx, "/admin/users", "create");
  const canEdit = canOnMenu(ctx, "/admin/users", "edit");
  const canDelete = canOnMenu(ctx, "/admin/users", "delete");

  // None of these depend on each other - fetch in parallel rather than
  // round-tripping to the database one at a time.
  const [allUsers, allCompanies, allDivisions, allRoles, assignments] = await Promise.all([
    db.select().from(users),
    db.select({ id: companies.id, name: companies.name }).from(companies),
    db.select({ id: divisions.id, name: divisions.name }).from(divisions),
    db.select().from(roles),
    db
      .select({
        id: userRoles.id,
        userId: userRoles.userId,
        userName: users.name,
        roleName: roles.name,
        companyName: companies.name,
        divisionName: divisions.name,
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .leftJoin(companies, eq(userRoles.companyId, companies.id))
      .leftJoin(divisions, eq(userRoles.divisionId, divisions.id)),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-ink">Users</h1>

      {canCreate && (
        <Panel className="p-5">
          <div className="text-sm font-medium text-ink mb-3">Create a user</div>
          <CreateUserForm companies={allCompanies} />
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">All users</span>
        </PanelHeader>
        <div className="px-5 py-4">
          {allUsers.length === 0 ? (
            <EmptyState message="No users yet." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-graphite">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  {canEdit && <th className="py-2 pr-4 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u) => (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-4 text-ink">{u.name}</td>
                    <td className="py-2.5 pr-4 text-graphite">{u.email}</td>
                    <td className="py-2.5 pr-4 text-ink">{u.isActive ? "Active" : "Inactive"}</td>
                    {canEdit && (
                      <td className="py-2.5 pr-4">
                        <UserToggle userId={u.id} isActive={u.isActive} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">User Role Assignment</span>
        </PanelHeader>
        <div className="px-5 py-4 space-y-4">
          {canEdit && (
            <AssignRoleForm users={allUsers} roles={allRoles} companies={allCompanies} divisions={allDivisions} />
          )}
          {assignments.length === 0 ? (
            <EmptyState message="No role assignments yet." />
          ) : (
            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="border-b border-line text-left text-xs text-graphite">
                  <th className="py-2 pr-4 font-medium">User</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Company scope</th>
                  <th className="py-2 pr-4 font-medium">Division scope</th>
                  {canDelete && <th className="py-2 pr-4 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-4 text-ink">{a.userName}</td>
                    <td className="py-2.5 pr-4 text-ink">{a.roleName}</td>
                    <td className="py-2.5 pr-4 text-graphite">{a.companyName ?? "Unscoped"}</td>
                    <td className="py-2.5 pr-4 text-graphite">{a.divisionName ?? "Unscoped"}</td>
                    {canDelete && (
                      <td className="py-2.5 pr-4">
                        <RevokeRoleButton userRoleId={a.id} />
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
