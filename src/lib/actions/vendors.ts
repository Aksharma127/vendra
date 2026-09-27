"use server";

import "server-only";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { vendors } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";

type ActionState = { error?: string; success?: boolean };

export async function createVendorAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAuthContext();
  if (!ctx.capabilities.has("vendor:manage")) return { error: "Not permitted" };
  if (!ctx.activeCompanyId) return { error: "No active company" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Vendor name is required" };

  try {
    await db.insert(vendors).values({
      companyId: ctx.activeCompanyId,
      name,
      category: String(formData.get("category") ?? "") || null,
      contactName: String(formData.get("contactName") ?? "") || null,
      contactEmail: String(formData.get("contactEmail") ?? "") || null,
    });
  } catch {
    return { error: "A vendor with this name already exists for this company" };
  }

  revalidatePath("/vendors");
  return { success: true };
}

export async function toggleVendorActiveAction(vendorId: string, isActive: boolean) {
  const ctx = await requireAuthContext();
  if (!ctx.capabilities.has("vendor:manage")) throw new Error("Not permitted");

  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!vendor || !ctx.authorizedCompanyIds.includes(vendor.companyId)) {
    throw new Error("Not found");
  }

  await db.update(vendors).set({ isActive }).where(eq(vendors.id, vendorId));
  revalidatePath("/vendors");
}
