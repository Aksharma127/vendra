"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth-context";
import {
  editDraft,
  submitPR,
  withdrawPR,
  actOnDivisionApproval,
  actOnFinanceApproval,
  WorkflowError,
} from "@/lib/workflow/purchase-requests";

// createDraftAction moved to ./purchase-requests-create.ts - see that file's
// comment for why (a Turbopack production-build action-ID collision).

type ActionState = { error?: string; success?: boolean };

function toState(err: unknown): ActionState {
  if (err instanceof WorkflowError) return { error: err.message };
  console.error(err);
  return { error: "Something went wrong. Please try again." };
}

/**
 * Save edits to a draft or a returned request. With intent=submit it also
 * (re)submits in the same step - "Save and resubmit". Bound to the request id.
 */
export async function editDraftAction(
  prId: string,
  _prev: (ActionState & { message?: string }) | undefined,
  formData: FormData
): Promise<ActionState & { message?: string }> {
  try {
    const ctx = await requireAuthContext();
    const updated = await editDraft(ctx, prId, {
      divisionId: String(formData.get("divisionId") ?? "") || undefined,
      category: String(formData.get("category") ?? "").trim() || undefined,
      itemDescription: String(formData.get("itemDescription") ?? "").trim() || undefined,
      quantity: formData.get("quantity") ? Number(formData.get("quantity")) : undefined,
      estimatedUnitCost: formData.get("estimatedUnitCost") ? Number(formData.get("estimatedUnitCost")) : undefined,
      // Present-but-empty clears it; absent leaves it alone.
      justification: formData.has("justification") ? String(formData.get("justification") ?? "") : undefined,
    });
    let message = updated.prNumber ? `Saved changes to ${updated.prNumber}.` : "Draft saved.";
    if (formData.get("intent") === "submit") {
      const submitted = await submitPR(ctx, prId);
      message =
        submitted.status === "PENDING_FINANCE_APPROVAL"
          ? `Submitted ${submitted.prNumber}. It goes straight to finance because you approve this division.`
          : `Submitted ${submitted.prNumber} for division approval.`;
    }
    revalidatePath(`/purchase-requests/${prId}`);
    revalidatePath("/purchase-requests/mine");
    return { success: true, message };
  } catch (err) {
    return toState(err);
  }
}

/** What an in-place workflow action reports back. Errors are RETURNED, not
 * thrown: Next.js hides the message of anything thrown from a Server Action
 * in production builds, so "A comment is required to reject" used to reach
 * the user as "Minified React error #441". `message` feeds the confirmation
 * toast. */
export type WorkflowResult = { ok: true; message: string } | { ok: false; error: string };

function fail(err: unknown): WorkflowResult {
  if (err instanceof WorkflowError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

const label = (prNumber: string | null | undefined) => prNumber ?? "the draft";

export async function submitPRAction(prId: string): Promise<WorkflowResult> {
  try {
    const ctx = await requireAuthContext();
    const pr = await submitPR(ctx, prId);
    revalidatePath(`/purchase-requests/${prId}`);
    revalidatePath("/purchase-requests/mine");
    return {
      ok: true,
      message:
        pr.status === "PENDING_FINANCE_APPROVAL"
          ? `Submitted ${label(pr.prNumber)}. It goes straight to finance because you approve this division.`
          : `Submitted ${label(pr.prNumber)} for division approval.`,
    };
  } catch (err) {
    return fail(err);
  }
}

export async function withdrawPRAction(prId: string): Promise<WorkflowResult> {
  try {
    const ctx = await requireAuthContext();
    const pr = await withdrawPR(ctx, prId);
    revalidatePath(`/purchase-requests/${prId}`);
    revalidatePath("/purchase-requests/mine");
    return { ok: true, message: `Withdrew ${label(pr.prNumber)}.` };
  } catch (err) {
    return fail(err);
  }
}

export async function divisionApprovalAction(
  prId: string,
  action: "approve" | "reject" | "return",
  comment?: string
): Promise<WorkflowResult> {
  try {
    const ctx = await requireAuthContext();
    const pr = await actOnDivisionApproval(ctx, prId, action, comment);
    revalidatePath(`/purchase-requests/${prId}`);
    revalidatePath("/purchase-requests/queue");
    const n = label(pr.prNumber);
    return {
      ok: true,
      message:
        action === "approve"
          ? `Approved ${n}. It's now with finance.`
          : action === "return"
            ? `Returned ${n} to the requester for changes.`
            : `Rejected ${n}.`,
    };
  } catch (err) {
    return fail(err);
  }
}

export async function financeApprovalAction(
  prId: string,
  action: "approve" | "reject",
  comment?: string
): Promise<WorkflowResult> {
  try {
    const ctx = await requireAuthContext();
    const pr = await actOnFinanceApproval(ctx, prId, action, comment);
    revalidatePath(`/purchase-requests/${prId}`);
    revalidatePath("/purchase-requests/queue");
    const n = label(pr.prNumber);
    if (action === "reject") return { ok: true, message: `Rejected ${n}.` };
    return {
      ok: true,
      message:
        pr.status === "PENDING_FINANCE_APPROVAL"
          ? `First approval recorded on ${n}. A second finance approver has to sign off.`
          : `Approved ${n}. It's ready for a purchase order.`,
    };
  } catch (err) {
    return fail(err);
  }
}
