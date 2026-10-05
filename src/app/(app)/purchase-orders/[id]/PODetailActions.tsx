"use client";

import { Button } from "@/components/ui/Button";
import { updatePOStatusAction } from "@/lib/actions/purchase-orders";
import { useWorkflowAction } from "@/lib/use-workflow-action";

export function PODetailActions({ poId, status }: { poId: string; status: string }) {
  const { run, pending, error } = useWorkflowAction();

  if (status === "CLOSED") return null;

  return (
    <div className="space-y-2">
      {status === "ISSUED" && (
        <>
          <Button className="w-full" disabled={pending} onClick={() => run(() => updatePOStatusAction(poId, "DELIVERED"))}>
            Mark delivered
          </Button>
          <p className="text-xs text-graphite">Once the goods or service have been received in full.</p>
        </>
      )}
      {status === "DELIVERED" && (
        <>
          <Button className="w-full" disabled={pending} onClick={() => run(() => updatePOStatusAction(poId, "CLOSED"))}>
            Close order
          </Button>
          <p className="text-xs text-graphite">After the invoice is settled. A closed order can&apos;t be changed.</p>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
