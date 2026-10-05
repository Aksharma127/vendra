"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMenuPermissionAction } from "@/lib/actions/admin";

interface Perm {
  roleId: string;
  menuItemId: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

const FIELDS = [
  { key: "canView" as const, label: "View" },
  { key: "canCreate" as const, label: "Create" },
  { key: "canEdit" as const, label: "Edit" },
  { key: "canDelete" as const, label: "Delete" },
];

export function MenuPermissionMatrix({
  roles,
  menuItems,
  permissions,
  readOnly = false,
}: {
  roles: { id: string; name: string }[];
  menuItems: { id: string; label: string; groupLabel: string }[];
  permissions: Perm[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  const permByItem = new Map(permissions.filter((p) => p.roleId === selectedRoleId).map((p) => [p.menuItemId, p]));

  function toggle(menuItemId: string, field: (typeof FIELDS)[number]["key"], current: boolean) {
    startTransition(async () => {
      await setMenuPermissionAction(selectedRoleId, menuItemId, field, !current);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedRoleId(r.id)}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              r.id === selectedRoleId ? "bg-accent text-on-accent" : "border border-line text-ink hover:bg-page-bg"
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-graphite">
            <th className="py-2 pr-4 font-medium">Menu item</th>
            {FIELDS.map((f) => (
              <th key={f.key} className="py-2 pr-4 font-medium text-center">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {menuItems.map((item) => {
            const perm = permByItem.get(item.id);
            return (
              <tr key={item.id} className="border-b border-line last:border-0">
                <td className="py-2 pr-4 text-ink">
                  {item.label}
                  <span className="text-graphite text-xs"> · {item.groupLabel}</span>
                </td>
                {FIELDS.map((f) => (
                  <td key={f.key} className="py-2 pr-4 text-center">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      disabled={pending || readOnly}
                      checked={perm?.[f.key] ?? false}
                      onChange={() => toggle(item.id, f.key, perm?.[f.key] ?? false)}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
