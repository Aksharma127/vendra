"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, userCompanyAccess, companies } from "@/db/schema";
import { createSession, destroySession, getSessionId } from "@/lib/session";
import { updateSessionActiveCompany } from "@/lib/session";

export async function loginAction(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.isActive) {
    return { error: "That email or password isn't recognized." };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "That email or password isn't recognized." };
  }

  // Default active company: user's first authorized, active company (if any).
  const [firstGrant] = await db
    .select({ companyId: userCompanyAccess.companyId })
    .from(userCompanyAccess)
    .innerJoin(companies, eq(userCompanyAccess.companyId, companies.id))
    .where(eq(userCompanyAccess.userId, user.id))
    .limit(1);

  await createSession(user.id, firstGrant?.companyId ?? null);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function switchCompanyAction(companyId: string) {
  const sessionId = await getSessionId();
  if (!sessionId) throw new Error("Not authenticated");

  // Re-validate the requested company is actually authorized before switching -
  // never trust the client's request alone.
  const { requireAuthContext } = await import("@/lib/auth-context");
  const ctx = await requireAuthContext();
  if (!ctx.authorizedCompanyIds.includes(companyId)) {
    throw new Error("Not authorized for that company");
  }

  await updateSessionActiveCompany(sessionId, companyId);
}
