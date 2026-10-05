"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { clearLoginFailures, loginBlockedFor, recordLoginFailure } from "@/lib/login-throttle";
import { db } from "@/db";
import { users, userCompanyAccess, companies } from "@/db/schema";
import { createSession, destroySession, getSessionId } from "@/lib/session";
import { updateSessionActiveCompany } from "@/lib/session";

// A bcrypt hash of a random value nobody knows, at the same cost (10) as real
// password hashes. Unknown emails are checked against it so a wrong email
// takes as long as a wrong password - otherwise the response time alone
// reveals which emails have accounts (~60ms vs ~155ms before this).
const DECOY_HASH = "$2b$10$.pNMdE7Wsa6t0tJXRiWyeeA79cya3lZen4IZDTWjKFqldIx9kAreG";

// bcrypt only reads the first 72 bytes; anything far beyond that is either a
// mistake or someone trying to make the server do pointless work.
const MAX_PASSWORD_LENGTH = 256;

export type LoginState = { error?: string; email?: string } | undefined;

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Every error returns the email, so the form can keep it filled in.
  if (!email || !password) {
    return { error: "Enter your email and password.", email };
  }
  if (password.length > MAX_PASSWORD_LENGTH || email.length > 320) {
    return { error: "That email or password isn't recognized.", email };
  }

  const ip = await clientIp();
  const waitMinutes = loginBlockedFor(ip, email);
  if (waitMinutes > 0) {
    return { error: `Too many failed attempts. Try again in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}.`, email };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Always run exactly one bcrypt comparison, whether or not the user exists.
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DECOY_HASH);
  if (!user || !valid || !user.isActive) {
    recordLoginFailure(ip, email);
    return { error: "That email or password isn't recognized.", email };
  }
  clearLoginFailures(ip, email);

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
