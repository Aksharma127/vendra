"use client";

import { useActionState } from "react";
import { createCompanyAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";

const inputClass =
  "w-full text-sm border border-line rounded px-3 py-2 bg-surface text-ink placeholder:text-graphite focus:outline-none focus:ring-1 focus:ring-accent";
const labelClass = "block text-xs text-graphite mb-1";

export function CompanyForm() {
  const [state, formAction, pending] = useActionState(createCompanyAction, undefined);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-4">
      <div>
        <label className={labelClass}>Company name</label>
        <input name="name" required className={inputClass} placeholder="e.g. KIG Logistics" />
      </div>
      <div>
        <label className={labelClass}>Code</label>
        <input name="code" required maxLength={10} className={inputClass} placeholder="e.g. KIGL" />
      </div>
      <div className="col-span-2 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding..." : "Add Company"}
        </Button>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        {state?.success && <p className="text-sm text-success">Company added.</p>}
      </div>
    </form>
  );
}
