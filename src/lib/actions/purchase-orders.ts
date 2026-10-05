"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth-context";
import { issuePO, updatePOStatus } from "@/lib/workflow/purchase-orders";
import { WorkflowError } from "@/lib/workflow/purchase-requests";

type ActionState = { error?: string; success?: boolean; message?: string };

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
    const paymentTerms = String(formData.get("paymentTerms") ?? "").trim();
    if (!paymentTerms) return { error: "Enter the payment terms agreed with the vendor." };
    const po = await issuePO(ctx, prId, {
      vendorId: String(formData.get("vendorId") ?? ""),
      deliveryDate: String(formData.get("deliveryDate") ?? ""),
      paymentTerms: paymentTerms.slice(0, 120),
    });
    revalidatePath(`/purchase-requests/${prId}`);
    revalidatePath("/purchase-orders");
    return { success: true, message: `Issued ${po.poNumber}.` };
  } catch (err) {
    return toState(err);
  }
}

/** Returned, not thrown - see WorkflowResult in ./purchase-requests.ts. */
export async function updatePOStatusAction(
  poId: string,
  targetStatus: "DELIVERED" | "CLOSED"
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    const ctx = await requireAuthContext();
    const po = await updatePOStatus(ctx, poId, targetStatus);
    revalidatePath("/purchase-orders");
    revalidatePath(`/purchase-orders/${poId}`);
    return {
      ok: true,
      message: targetStatus === "DELIVERED" ? `Marked ${po.poNumber} as delivered.` : `Closed ${po.poNumber}.`,
    };
  } catch (err) {
    const state = toState(err);
    return { ok: false, error: state.error ?? "Something went wrong. Please try again." };
  }
}
