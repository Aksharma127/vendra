"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleVendorActiveAction } from "@/lib/actions/vendors";

export function VendorToggle({ vendorId, isActive }: { vendorId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleVendorActiveAction(vendorId, !isActive);
          router.refresh();
        })
      }
      className="text-xs text-accent hover:underline disabled:opacity-50"
    >
      {isActive ? "Deactivate" : "Activate"}
    </button>
  );
}
