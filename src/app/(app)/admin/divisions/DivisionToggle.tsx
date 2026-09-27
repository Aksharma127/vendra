"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleDivisionActiveAction } from "@/lib/actions/admin";

export function DivisionToggle({ divisionId, isActive }: { divisionId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleDivisionActiveAction(divisionId, !isActive);
          router.refresh();
        })
      }
      className="text-xs text-accent hover:underline disabled:opacity-50"
    >
      {isActive ? "Deactivate" : "Activate"}
    </button>
  );
}
