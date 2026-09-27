"use client";

import { useActionState } from "react";
import { issuePOAction } from "@/lib/actions/purchase-orders";
import { Button } from "@/components/ui/Button";

const inputClass =
  "w-full text-sm border border-line rounded px-3 py-2 bg-surface text-ink placeholder:text-graphite focus:outline-none focus:ring-1 focus:ring-accent";
const labelClass = "block text-xs text-graphite mb-1";

export function IssuePOForm({
  prId,
  vendors,
}: {
  prId: string;
  vendors: { id: string; name: string }[];
}) {
  const action = issuePOAction.bind(null, prId);
  const [state, formAction, pending] = useActionState(action, undefined);

  if (vendors.length === 0) {
    return <p className="text-sm text-graphite">No active vendors for this company yet. Add one under Vendors.</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className={labelClass}>Vendor</label>
        <select name="vendorId" required className={inputClass}>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Delivery date</label>
        <input name="deliveryDate" type="date" required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Payment terms</label>
        <input name="paymentTerms" required placeholder="e.g. Net 30" className={inputClass} />
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">Purchase order issued.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Issuing..." : "Issue Purchase Order"}
      </Button>
    </form>
  );
}
