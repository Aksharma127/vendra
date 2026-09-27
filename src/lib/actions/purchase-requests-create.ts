"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/auth-context";
import { createDraft, WorkflowError } from "@/lib/workflow/purchase-requests";

type ActionState = { error?: string; success?: boolean };

function toState(err: unknown): ActionState {
  if (err instanceof WorkflowError) return { error: err.message };
  console.error(err);
  return { error: "Something went wrong. Please try again." };
}

// Split out from purchase-requests.ts into its own module: a Turbopack
// production-build bug was assigning this action's client-side reference
// the SAME action ID as an unrelated action (logoutAction, from
// src/lib/actions/auth.ts), so submitting the "New Purchase Request" form
// actually invoked the sign-out action on the server instead of creating
// the draft - see next.config.ts for the fuller writeup. Isolating this
// action in its own file changes its build fingerprint enough to avoid the
// collision; the whole action surface was re-swept after this change to
// confirm no ID collides with any other (see scripts used during that
// verification pass).
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
