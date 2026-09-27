"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleCompanyActiveAction } from "@/lib/actions/admin";

export function CompanyToggle({ companyId, isActive }: { companyId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleCompanyActiveAction(companyId, !isActive);
          router.refresh();
        })
      }
      className="text-xs text-accent hover:underline disabled:opacity-50"
    >
      {isActive ? "Deactivate" : "Activate"}
    </button>
  );
}
