"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  submitPRAction,
  withdrawPRAction,
  divisionApprovalAction,
  financeApprovalAction,
} from "@/lib/actions/purchase-requests";

function useRunner() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return { run, pending, error };
}

export function OwnerActions({ prId, status }: { prId: string; status: string }) {
  const { run, pending, error } = useRunner();
  const canSubmit = status === "DRAFT" || status === "RETURNED_FOR_REVISION";
  const canWithdraw = status === "DRAFT" || status === "PENDING_DIVISION_APPROVAL";

  if (!canSubmit && !canWithdraw) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {canSubmit && (
          <Button disabled={pending} onClick={() => run(() => submitPRAction(prId))}>
            {status === "RETURNED_FOR_REVISION" ? "Resubmit" : "Submit for Approval"}
          </Button>
        )}
        {canWithdraw && (
          <Button variant="secondary" disabled={pending} onClick={() => run(() => withdrawPRAction(prId))}>
            Withdraw
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function DivisionApprovalActions({ prId }: { prId: string }) {
  const { run, pending, error } = useRunner();
  const [comment, setComment] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <textarea
        placeholder="Comment (required for reject/return)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        className="w-full text-sm border border-line rounded px-3 py-2 bg-surface text-ink placeholder:text-graphite focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <div className="flex gap-2">
        <Button disabled={pending} onClick={() => run(() => divisionApprovalAction(prId, "approve", comment))}>
          Approve
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => divisionApprovalAction(prId, "return", comment))}
        >
          Return for Revision
        </Button>
        <Button
          variant="danger"
          disabled={pending}
          onClick={() => run(() => divisionApprovalAction(prId, "reject", comment))}
        >
          Reject
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function FinanceApprovalActions({ prId }: { prId: string }) {
  const { run, pending, error } = useRunner();
  const [comment, setComment] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <textarea
        placeholder="Comment (required for reject)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        className="w-full text-sm border border-line rounded px-3 py-2 bg-surface text-ink placeholder:text-graphite focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <div className="flex gap-2">
        <Button disabled={pending} onClick={() => run(() => financeApprovalAction(prId, "approve", comment))}>
          Approve
        </Button>
        <Button
          variant="danger"
          disabled={pending}
          onClick={() => run(() => financeApprovalAction(prId, "reject", comment))}
        >
          Reject
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
