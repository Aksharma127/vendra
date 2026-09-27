"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth-context";
import {
  createDraft,
  editDraft,
  submitPR,
  withdrawPR,
  actOnDivisionApproval,
  actOnFinanceApproval,
  WorkflowError,
} from "@/lib/workflow/purchase-requests";

type ActionState = { error?: string; success?: boolean };

function toState(err: unknown): ActionState {
  if (err instanceof WorkflowError) return { error: err.message };
  console.error(err);
  return { error: "Something went wrong. Please try again." };
}

export async function createDraftAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  try {
    const ctx = await requireAuthContext();
    const pr = await createDraft(ctx, {
      divisionId: String(formData.get("divisionId") ?? ""),
      category: String(formData.get("category") ?? ""),
      itemDescription: String(formData.get("itemDescription") ?? ""),
      quantity: Number(formData.get("quantity")),
      estimatedUnitCost: Number(formData.get("estimatedUnitCost")),
      justification: String(formData.get("justification") ?? "") || undefined,
    });
    revalidatePath("/purchase-requests/mine");
    const { redirect } = await import("next/navigation");
    redirect(`/purchase-requests/${pr.id}`);
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err; // redirect()
    return toState(err);
  }
  return {};
}

export async function editDraftAction(
  prId: string,
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  try {
    const ctx = await requireAuthContext();
    await editDraft(ctx, prId, {
      divisionId: String(formData.get("divisionId") ?? "") || undefined,
      category: String(formData.get("category") ?? "") || undefined,
      itemDescription: String(formData.get("itemDescription") ?? "") || undefined,
      quantity: formData.get("quantity") ? Number(formData.get("quantity")) : undefined,
      estimatedUnitCost: formData.get("estimatedUnitCost")
        ? Number(formData.get("estimatedUnitCost"))
        : undefined,
      justification: String(formData.get("justification") ?? "") || undefined,
    });
    revalidatePath(`/purchase-requests/${prId}`);
    return { success: true };
  } catch (err) {
    return toState(err);
  }
}

export async function submitPRAction(prId: string) {
  const ctx = await requireAuthContext();
  await submitPR(ctx, prId);
  revalidatePath(`/purchase-requests/${prId}`);
  revalidatePath("/purchase-requests/mine");
}

export async function withdrawPRAction(prId: string) {
  const ctx = await requireAuthContext();
  await withdrawPR(ctx, prId);
  revalidatePath(`/purchase-requests/${prId}`);
  revalidatePath("/purchase-requests/mine");
}

export async function divisionApprovalAction(
  prId: string,
  action: "approve" | "reject" | "return",
  comment?: string
) {
  const ctx = await requireAuthContext();
  await actOnDivisionApproval(ctx, prId, action, comment);
  revalidatePath(`/purchase-requests/${prId}`);
  revalidatePath("/purchase-requests/queue");
}

export async function financeApprovalAction(
  prId: string,
  action: "approve" | "reject",
  comment?: string
) {
  const ctx = await requireAuthContext();
  await actOnFinanceApproval(ctx, prId, action, comment);
  revalidatePath(`/purchase-requests/${prId}`);
  revalidatePath("/purchase-requests/queue");
}
