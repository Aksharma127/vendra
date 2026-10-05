"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issuePOAction } from "@/lib/actions/purchase-orders";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toaster";

const inputClass =
  "w-full text-sm border border-line rounded px-3 py-2 bg-surface text-ink placeholder:text-graphite/80 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent";
const labelClass = "block text-xs text-graphite mb-1";
const TERMS = ["Net 15", "Net 30", "Net 45", "Net 60", "50% advance, 50% on delivery"];

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  // Local date, not UTC: toISOString() would be a day behind before 05:30 IST.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function IssuePOForm({
  prId,
  vendors,
  amountLabel,
}: {
  prId: string;
  vendors: { id: string; name: string; category: string | null }[];
  amountLabel: string;
}) {
  // Submitted by hand rather than through useActionState: issuing the PO
  // re-renders the page WITHOUT this form, so a confirmation fired from an
  // effect in here would be lost with it. Toasting right after the await
  // works because the toast provider lives in the layout.
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof issuePOAction>>;
      try {
        res = await issuePOAction(prId, undefined, fd);
      } catch {
        res = { error: "Couldn't reach the server. Check your connection and try again." };
      }
      if (res.success) {
        toast(res.message ?? "Purchase order issued.");
        router.refresh();
      } else {
        setError(res.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  if (vendors.length === 0) {
    return <p className="text-sm text-graphite">No active vendors for this company yet. Add one under Vendors first.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="po-vendor" className={labelClass}>
          Vendor
        </label>
        <select id="po-vendor" name="vendorId" required className={inputClass}>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.category ? ` (${v.category})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="po-delivery" className={labelClass}>
          Delivery date
        </label>
        <input id="po-delivery" name="deliveryDate" type="date" required min={tomorrow()} className={inputClass} />
      </div>
      <div>
        <label htmlFor="po-terms" className={labelClass}>
          Payment terms
        </label>
        <input id="po-terms" name="paymentTerms" required list="po-terms-list" placeholder="e.g. Net 30" maxLength={120} className={inputClass} />
        <datalist id="po-terms-list">
          {TERMS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Issuing…" : "Issue purchase order"}
      </Button>
      <p className="text-xs text-graphite">Commits {amountLabel} to the vendor.</p>
    </form>
  );
}
