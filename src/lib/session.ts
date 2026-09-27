import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";

const COOKIE_NAME = "vendra_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours - plenty for a live demo

export async function createSession(userId: string, activeCompanyId: string | null) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const [session] = await db
    .insert(sessions)
    .values({ userId, activeCompanyId, expiresAt })
    .returning();

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return session;
}

export async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

export async function destroySession() {
  const sessionId = await getSessionId();
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function updateSessionActiveCompany(sessionId: string, companyId: string) {
  await db.update(sessions).set({ activeCompanyId: companyId }).where(eq(sessions.id, sessionId));
}

export async function getRawSession(sessionId: string) {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!row) return null;
  if (row.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }
  return row;
}
