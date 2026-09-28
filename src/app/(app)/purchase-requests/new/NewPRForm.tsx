"use client";

import { useActionState } from "react";
import { createDraftAction } from "@/lib/actions/purchase-requests-create";
import { Button } from "@/components/ui/Button";

const inputClass =
  "w-full text-sm border border-line rounded px-3 py-2 bg-surface text-ink placeholder:text-graphite focus:outline-none focus:ring-1 focus:ring-accent";
const labelClass = "block text-xs text-graphite mb-1";

export function NewPRForm({ divisions }: { divisions: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createDraftAction, undefined);

  if (divisions.length === 0) {
    return (
      <p className="text-sm text-graphite">
        You don&apos;t have access to any division that can raise requests. Contact your administrator.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className={labelClass}>Division</label>
        <select name="divisionId" required className={inputClass}>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Category</label>
        <input name="category" required className={inputClass} placeholder="e.g. Raw Materials, IT Equipment" />
      </div>
      <div>
        <label className={labelClass}>Item description</label>
        <textarea name="itemDescription" required rows={3} className={inputClass} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Quantity</label>
          <input name="quantity" type="number" min="0.01" step="0.01" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Estimated unit cost (₹)</label>
          <input name="estimatedUnitCost" type="number" min="0.01" step="0.01" required className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Justification (required above threshold)</label>
        <textarea name="justification" rows={2} className={inputClass} />
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save as Draft"}
      </Button>
    </form>
  );
}
