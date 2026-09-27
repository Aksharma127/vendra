"use client";

import { useActionState } from "react";
import { createRoleAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";

export function CreateRoleForm() {
  const [state, formAction, pending] = useActionState(createRoleAction, undefined);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <div>
        <label className="block text-xs text-graphite mb-1">Role name</label>
        <input
          name="name"
          required
          className="text-sm border border-line rounded px-3 py-2 bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="e.g. Compliance Reviewer"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create Role"}
      </Button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-success">
          Role created — starts with zero menu/business permissions until granted below.
        </p>
      )}
    </form>
  );
}
