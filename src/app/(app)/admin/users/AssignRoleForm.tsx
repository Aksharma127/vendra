"use client";

import { useActionState } from "react";
import { assignRoleAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";

const inputClass =
  "w-full text-sm border border-line rounded px-2.5 py-1.5 bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent";

export function AssignRoleForm({
  users,
  roles,
  companies,
  divisions,
}: {
  users: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  divisions: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(assignRoleAction, undefined);

  return (
    <form action={formAction} className="grid grid-cols-5 gap-3 items-end">
      <div>
        <label className="block text-xs text-graphite mb-1">User</label>
        <select name="userId" required className={inputClass}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-graphite mb-1">Role</label>
        <select name="roleId" required className={inputClass}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-graphite mb-1">Scope: Company (optional)</label>
        <select name="companyId" className={inputClass} defaultValue="">
          <option value="">Unscoped</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-graphite mb-1">Scope: Division (optional)</label>
        <select name="divisionId" className={inputClass} defaultValue="">
          <option value="">Unscoped</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Assigning..." : "Assign Role"}
        </Button>
      </div>
      {state?.error && <p className="col-span-5 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
