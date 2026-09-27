"use client";

import { useActionState } from "react";
import { createConfigAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";

export function CreateConfigForm({ companies }: { companies: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createConfigAction, undefined);

  return (
    <form action={formAction} className="flex items-end gap-3 flex-wrap">
      <div>
        <label className="block text-xs text-graphite mb-1">Key</label>
        <input
          name="key"
          required
          className="text-sm border border-line rounded px-3 py-2 bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="e.g. default_currency"
        />
      </div>
      <div>
        <label className="block text-xs text-graphite mb-1">Scope</label>
        <select
          name="companyId"
          className="text-sm border border-line rounded px-3 py-2 bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Global</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-graphite mb-1">Value</label>
        <input
          name="value"
          required
          className="text-sm border border-line rounded px-3 py-2 bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add"}
      </Button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">Added</p>}
    </form>
  );
}
