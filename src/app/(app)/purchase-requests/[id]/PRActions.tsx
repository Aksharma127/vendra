"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useWorkflowAction } from "@/lib/use-workflow-action";
import {
  submitPRAction,
  withdrawPRAction,
  divisionApprovalAction,
  financeApprovalAction,
} from "@/lib/actions/purchase-requests";

const textareaClass =
  "w-full text-sm border border-line rounded px-3 py-2 bg-surface text-ink placeholder:text-graphite/80 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent aria-[invalid=true]:border-danger/60";

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {text}
    </p>
  );
}

/** Requester's own controls: submit / resubmit / edit / withdraw. */
export function OwnerActions({
  prId,
  status,
  skipsDivision,
}: {
  prId: string;
  status: string;
  /** The requester approves this division themselves, so it goes straight to finance. */
  skipsDivision: boolean;
}) {
  const { run, pending, error } = useWorkflowAction();
  const [confirming, setConfirming] = useState(false);
  const isDraft = status === "DRAFT";
  const isReturned = status === "RETURNED_FOR_REVISION";
  const canWithdraw = isDraft || status === "PENDING_DIVISION_APPROVAL";

  if (!isDraft && !isReturned && !canWithdraw) return null;

  return (
    <div className="space-y-3">
      {(isDraft || isReturned) && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button className="col-span-2" disabled={pending} onClick={() => run(() => submitPRAction(prId))}>
              {isReturned ? "Resubmit as is" : "Submit for approval"}
            </Button>
            <Link
              href={`/purchase-requests/${prId}/edit`}
              className="col-span-2 inline-flex items-center justify-center rounded border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-page-bg"
            >
              {isReturned ? "Edit and resubmit" : "Edit draft"}
            </Link>
          </div>
          <p className="text-xs text-graphite">
            {skipsDivision
              ? "You approve this division, so it goes straight to finance."
              : "It goes to your division manager first, then finance."}
          </p>
        </>
      )}

      {canWithdraw &&
        (confirming ? (
          <div className="rounded border border-danger/30 bg-danger/5 p-3 space-y-2">
            <p className="text-sm text-ink">
              {isDraft ? "Discard this draft? It can't be recovered." : "Withdraw this request? It can't be resubmitted."}
            </p>
            <div className="flex gap-2">
              <Button variant="danger" disabled={pending} onClick={() => run(() => withdrawPRAction(prId), () => setConfirming(false))}>
                {isDraft ? "Discard draft" : "Withdraw request"}
              </Button>
              <Button variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm text-graphite underline-offset-2 hover:text-danger hover:underline"
          >
            {isDraft ? "Discard draft" : "Withdraw request"}
          </button>
        ))}
      <ErrorLine text={error} />
    </div>
  );
}

/** Shared approve / return / reject block with comment validation. */
function DecisionForm({
  allowReturn,
  approveLabel,
  onDecide,
  pending,
  error,
  setError,
}: {
  allowReturn: boolean;
  approveLabel: string;
  onDecide: (action: "approve" | "reject" | "return", comment: string) => void;
  pending: boolean;
  error: string | null;
  setError: (e: string | null) => void;
}) {
  const [comment, setComment] = useState("");
  const [needsComment, setNeedsComment] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  function decide(action: "approve" | "reject" | "return") {
    if (action !== "approve" && !comment.trim()) {
      // Caught here instead of a server round trip: the server would refuse it too.
      setNeedsComment(true);
      setError(action === "reject" ? "Add a comment so the requester knows why it was rejected." : "Add a comment saying what needs to change.");
      ref.current?.focus();
      return;
    }
    onDecide(action, comment.trim());
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="decision-comment" className="mb-1 block text-xs text-graphite">
          Comment for the requester
        </label>
        <textarea
          ref={ref}
          id="decision-comment"
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            if (needsComment && e.target.value.trim()) {
              setNeedsComment(false);
              setError(null);
            }
          }}
          rows={3}
          maxLength={1000}
          aria-invalid={needsComment}
          aria-describedby="decision-comment-help"
          className={textareaClass}
        />
        <p id="decision-comment-help" className="mt-1 text-xs text-graphite">
          {allowReturn ? "Needed to return or reject. Optional when approving." : "Needed to reject. Optional when approving."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button className="col-span-2" disabled={pending} onClick={() => decide("approve")}>
          {approveLabel}
        </Button>
        {allowReturn && (
          <Button variant="secondary" disabled={pending} onClick={() => decide("return")}>
            Return
          </Button>
        )}
        <Button variant="danger" className={allowReturn ? "" : "col-span-2"} disabled={pending} onClick={() => decide("reject")}>
          Reject
        </Button>
      </div>
      <ErrorLine text={error} />
    </div>
  );
}

export function DivisionApprovalActions({ prId }: { prId: string }) {
  const { run, pending, error, setError } = useWorkflowAction();
  return (
    <DecisionForm
      allowReturn
      approveLabel="Approve"
      pending={pending}
      error={error}
      setError={setError}
      onDecide={(action, comment) => run(() => divisionApprovalAction(prId, action, comment))}
    />
  );
}

export function FinanceApprovalActions({ prId, approveLabel = "Approve" }: { prId: string; approveLabel?: string }) {
  const { run, pending, error, setError } = useWorkflowAction();
  return (
    <DecisionForm
      allowReturn={false}
      approveLabel={approveLabel}
      pending={pending}
      error={error}
      setError={setError}
      onDecide={(action, comment) => run(() => financeApprovalAction(prId, action === "return" ? "reject" : action, comment))}
    />
  );
}
