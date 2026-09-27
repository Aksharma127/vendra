"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { updatePOStatusAction } from "@/lib/actions/purchase-orders";

export function PODetailActions({ poId, status }: { poId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function advance(target: "DELIVERED" | "CLOSED") {
    setError(null);
    startTransition(async () => {
      try {
        await updatePOStatusAction(poId, target);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (status === "CLOSED") return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {status === "ISSUED" && (
          <Button disabled={pending} onClick={() => advance("DELIVERED")}>
            Mark Delivered
          </Button>
        )}
        {status === "DELIVERED" && (
          <Button disabled={pending} onClick={() => advance("CLOSED")}>
            Close Order
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
