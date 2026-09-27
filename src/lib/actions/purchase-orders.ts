"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth-context";
import { issuePO, updatePOStatus } from "@/lib/workflow/purchase-orders";
import { WorkflowError } from "@/lib/workflow/purchase-requests";

type ActionState = { error?: string; success?: boolean };

function toState(err: unknown): ActionState {
  if (err instanceof WorkflowError) return { error: err.message };
  console.error(err);
  return { error: "Something went wrong. Please try again." };
}

export async function issuePOAction(
  prId: string,
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  try {
    const ctx = await requireAuthContext();
    await issuePO(ctx, prId, {
      vendorId: String(formData.get("vendorId") ?? ""),
      deliveryDate: String(formData.get("deliveryDate") ?? ""),
      paymentTerms: String(formData.get("paymentTerms") ?? ""),
    });
    revalidatePath(`/purchase-requests/${prId}`);
    revalidatePath("/purchase-orders");
  } catch (err) {
    return toState(err);
  }
  return { success: true };
}

export async function updatePOStatusAction(poId: string, targetStatus: "DELIVERED" | "CLOSED") {
  const ctx = await requireAuthContext();
  await updatePOStatus(ctx, poId, targetStatus);
  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${poId}`);
}
