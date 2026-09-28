"use client";

import { useActionState } from "react";
import { createDivisionAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";

const inputClass =
  "w-full text-sm border border-line rounded px-3 py-2 bg-surface text-ink placeholder:text-graphite focus:outline-none focus:ring-1 focus:ring-accent";
const labelClass = "block text-xs text-graphite mb-1";

export function DivisionForm({ companies }: { companies: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createDivisionAction, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div>
        <label className={labelClass}>Company</label>
        <select name="companyId" required className={inputClass}>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Division name</label>
        <input name="name" required className={inputClass} placeholder="e.g. Logistics" />
      </div>
      <div>
        <label className={labelClass}>Code</label>
        <input name="code" required maxLength={10} className={inputClass} placeholder="e.g. LOG" />
      </div>
      <div className="col-span-3 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding..." : "Add Division"}
        </Button>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        {state?.success && <p className="text-sm text-success">Division added.</p>}
      </div>
    </form>
  );
}
