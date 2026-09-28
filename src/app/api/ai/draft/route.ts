import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { divisions } from "@/db/schema";
import { getAuthContext } from "@/lib/auth-context";
import { AIDraftError, AI_LIMITS, suggestDraft } from "@/lib/ai/draft";

// A Route Handler rather than a Server Action on purpose: this project hit a
// Turbopack bug where a new action's ID collided with an existing one (see
// src/lib/actions/purchase-requests-create.ts), and Server Actions also cap
// request bodies at 1 MB by default - too small for a phone photo of a quote.
export const maxDuration = 30;

// Best-effort per-user throttle. In-memory, so on serverless it is per
// instance rather than global - enough to stop a stuck button or a loop from
// burning the free-tier quota, not a hard security boundary.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function rateLimited(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > MAX_PER_WINDOW;
}

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return fail("Please sign in again.", 401);
  if (!ctx.capabilities.has("pr:create")) return fail("Your role can't raise purchase requests.", 403);
  if (rateLimited(ctx.userId)) return fail("Too many AI requests. Try again in a few minutes.", 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Couldn't read the upload. If it's a large file, try a smaller one (max 4 MB).", 400);
  }

  const text = String(form.get("text") ?? "").trim();
  const upload = form.get("file");
  const file = upload instanceof File && upload.size > 0 ? upload : null;

  if (!text && !file) return fail("Describe what you need, or attach a quote.", 400);
  if (text.length > AI_LIMITS.maxTextChars) return fail(`Please keep the note under ${AI_LIMITS.maxTextChars} characters.`, 400);
  if (file) {
    if (file.size > AI_LIMITS.maxFileBytes) return fail("That file is over 4 MB. Try a smaller photo or a single-page PDF.", 413);
    if (!AI_LIMITS.fileTypes.includes(file.type)) return fail("Attach a photo (JPG, PNG, WebP, HEIC) or a PDF.", 415);
  }

  // Only the divisions this user may actually raise requests for.
  const allowed = ctx.authorizedDivisionIds.length
    ? await db.select({ id: divisions.id, name: divisions.name }).from(divisions).where(inArray(divisions.id, ctx.authorizedDivisionIds))
    : [];

  try {
    const suggestion = await suggestDraft({
      text,
      file: file ? { mimeType: file.type, base64: Buffer.from(await file.arrayBuffer()).toString("base64") } : null,
      divisions: allowed,
    });
    return Response.json({ suggestion });
  } catch (err) {
    if (err instanceof AIDraftError) return fail(err.message, err.status);
    console.error(err);
    return fail("Something went wrong with AI autofill.", 500);
  }
}
