"use client";

import { useActionState } from "react";
import { createVendorAction } from "@/lib/actions/vendors";
import { Button } from "@/components/ui/Button";

const inputClass =
  "w-full text-sm border border-line rounded px-3 py-2 bg-surface text-ink placeholder:text-graphite focus:outline-none focus:ring-1 focus:ring-accent";
const labelClass = "block text-xs text-graphite mb-1";

export function VendorForm() {
  const [state, formAction, pending] = useActionState(createVendorAction, undefined);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-4">
      <div>
        <label className={labelClass}>Vendor name</label>
        <input name="name" required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Category</label>
        <input name="category" className={inputClass} placeholder="e.g. Raw Materials" />
      </div>
      <div>
        <label className={labelClass}>Contact name</label>
        <input name="contactName" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Contact email</label>
        <input name="contactEmail" type="email" className={inputClass} />
      </div>
      <div className="col-span-2 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding..." : "Add Vendor"}
        </Button>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        {state?.success && <p className="text-sm text-success">Vendor added.</p>}
      </div>
    </form>
  );
}
