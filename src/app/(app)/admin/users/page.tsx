import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, userRoles, roles } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function AdminUsersPage() {
  const ctx = await requireAuthContext();
  if (!ctx.capabilities.has("admin:manage")) return <EmptyState message="You don't have permission to view this." />;

  const allUsers = await db.select().from(users);
  const roleRows = await db
    .select({ userId: userRoles.userId, roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id));

  const rolesByUser = new Map<string, string[]>();
  for (const r of roleRows) {
    const list = rolesByUser.get(r.userId) ?? [];
    if (!list.includes(r.roleName)) list.push(r.roleName);
    rolesByUser.set(r.userId, list);
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink mb-4">Users</h1>
      <Panel>
        <PanelHeader>
          <span className="text-sm font-medium text-ink">All users</span>
        </PanelHeader>
        <div className="px-5 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-graphite">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Roles</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-4 text-ink">{u.name}</td>
                  <td className="py-2.5 pr-4 text-graphite">{u.email}</td>
                  <td className="py-2.5 pr-4 text-ink">{(rolesByUser.get(u.id) ?? []).join(", ") || "—"}</td>
                  <td className="py-2.5 pr-4 text-ink">{u.isActive ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
