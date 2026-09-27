"use server";

import "server-only";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  companies,
  divisions,
  users,
  roles,
  userCompanyAccess,
  userRoles,
  config,
  roleMenuPermissions,
} from "@/db/schema";
import { requireAuthContext, canOnMenu } from "@/lib/auth-context";

type ActionState = { error?: string; success?: boolean };

function requirePermission(
  ctx: Awaited<ReturnType<typeof requireAuthContext>>,
  path: string,
  action: "view" | "create" | "edit" | "delete"
) {
  if (!canOnMenu(ctx, path, action)) {
    throw new Error("Not permitted");
  }
}

// ---------- Companies ----------

export async function createCompanyAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAuthContext();
  requirePermission(ctx, "/admin/companies", "create");

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!name || !code) return { error: "Name and code are required" };

  try {
    await db.insert(companies).values({ name, code });
  } catch {
    return { error: "A company with this code already exists" };
  }
  revalidatePath("/admin/companies");
  return { success: true };
}

export async function toggleCompanyActiveAction(companyId: string, isActive: boolean) {
  const ctx = await requireAuthContext();
  requirePermission(ctx, "/admin/companies", "edit");
  await db.update(companies).set({ isActive }).where(eq(companies.id, companyId));
  revalidatePath("/admin/companies");
}

// ---------- Divisions ----------

export async function createDivisionAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAuthContext();
  requirePermission(ctx, "/admin/divisions", "create");

  const companyId = String(formData.get("companyId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!companyId || !name || !code) return { error: "Company, name, and code are required" };

  try {
    await db.insert(divisions).values({ companyId, name, code });
  } catch {
    return { error: "A division with this code already exists for that company" };
  }
  revalidatePath("/admin/divisions");
  return { success: true };
}

export async function toggleDivisionActiveAction(divisionId: string, isActive: boolean) {
  const ctx = await requireAuthContext();
  requirePermission(ctx, "/admin/divisions", "edit");
  await db.update(divisions).set({ isActive }).where(eq(divisions.id, divisionId));
  revalidatePath("/admin/divisions");
}

// ---------- Users ----------

export async function createUserAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAuthContext();
  requirePermission(ctx, "/admin/users", "create");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const companyIds = formData.getAll("companyIds").map(String).filter(Boolean);

  if (!name || !email || password.length < 6) {
    return { error: "Name, email, and a password of at least 6 characters are required" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let userId: string;
  try {
    const [created] = await db.insert(users).values({ name, email, passwordHash }).returning();
    userId = created.id;
  } catch {
    return { error: "A user with this email already exists" };
  }

  if (companyIds.length > 0) {
    await db
      .insert(userCompanyAccess)
      .values(companyIds.map((companyId) => ({ userId, companyId })))
      .onConflictDoNothing();
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function toggleUserActiveAction(userId: string, isActive: boolean) {
  const ctx = await requireAuthContext();
  requirePermission(ctx, "/admin/users", "edit");
  await db.update(users).set({ isActive }).where(eq(users.id, userId));
  revalidatePath("/admin/users");
}

export async function assignRoleAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAuthContext();
  requirePermission(ctx, "/admin/users", "edit");

  const userId = String(formData.get("userId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  const companyId = String(formData.get("companyId") ?? "") || null;
  const divisionId = String(formData.get("divisionId") ?? "") || null;
  if (!userId || !roleId) return { error: "User and role are required" };

  await db.insert(userRoles).values({ userId, roleId, companyId, divisionId }).onConflictDoNothing();
  revalidatePath("/admin/users");
  return { success: true };
}

export async function revokeRoleAction(userRoleId: string) {
  const ctx = await requireAuthContext();
  requirePermission(ctx, "/admin/users", "delete");
  await db.delete(userRoles).where(eq(userRoles.id, userRoleId));
  revalidatePath("/admin/users");
}

// ---------- Roles ----------

export async function createRoleAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAuthContext();
  requirePermission(ctx, "/admin/roles", "create");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Role name is required" };

  try {
    await db.insert(roles).values({ name });
  } catch {
    return { error: "A role with this name already exists" };
  }
  revalidatePath("/admin/roles");
  return { success: true };
}

export async function setMenuPermissionAction(
  roleId: string,
  menuItemId: string,
  field: "canView" | "canCreate" | "canEdit" | "canDelete",
  value: boolean
) {
  const ctx = await requireAuthContext();
  requirePermission(ctx, "/admin/roles", "edit");

  const [existing] = await db
    .select()
    .from(roleMenuPermissions)
    .where(and(eq(roleMenuPermissions.roleId, roleId), eq(roleMenuPermissions.menuItemId, menuItemId)))
    .limit(1);

  if (existing) {
    await db
      .update(roleMenuPermissions)
      .set({ [field]: value })
      .where(eq(roleMenuPermissions.id, existing.id));
  } else {
    await db.insert(roleMenuPermissions).values({
      roleId,
      menuItemId,
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      [field]: value,
    });
  }
  revalidatePath("/admin/roles");
}

// ---------- Configuration ----------

export async function createConfigAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAuthContext();
  requirePermission(ctx, "/admin/config", "create");

  const key = String(formData.get("key") ?? "").trim();
  const companyId = String(formData.get("companyId") ?? "") || null;
  const value = String(formData.get("value") ?? "").trim();
  if (!key || !value) return { error: "Key and value are required" };

  try {
    await db.insert(config).values({ key, companyId, value });
  } catch {
    return { error: "A config value with this key already exists for that scope" };
  }
  revalidatePath("/admin/config");
  return { success: true };
}

export async function updateConfigAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireAuthContext();
  requirePermission(ctx, "/admin/config", "edit");

  const configId = String(formData.get("configId") ?? "");
  const value = String(formData.get("value") ?? "").trim();
  if (!configId || !value) return { error: "A value is required" };

  await db.update(config).set({ value, updatedAt: new Date() }).where(eq(config.id, configId));
  revalidatePath("/admin/config");
  return { success: true };
}
