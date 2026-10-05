import "server-only";

/**
 * Slows down password guessing on the login form.
 *
 * Two limits, both counting FAILED attempts only:
 * - per (IP, email): stops someone hammering one account from one place.
 * - per IP across all emails: stops spraying one password over many accounts.
 * A successful login clears that (IP, email) counter.
 *
 * Deliberately keyed on IP + email rather than email alone, so a stranger
 * can't lock a real user out of their own account just by mistyping on purpose.
 *
 * In-memory, so on serverless it's per warm instance, not global. That makes it
 * a speed bump, not a guarantee; a shared store (Redis / a DB table) is the
 * upgrade if this ever faces the real internet. Bounded so it can't grow
 * without limit.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_ACCOUNT = 8;
const MAX_PER_IP = 40;
const MAX_KEYS = 5000;

const failures = new Map<string, number[]>();

function recent(key: string, now: number) {
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length) failures.set(key, list);
  else failures.delete(key);
  return list;
}

const keys = (ip: string, email: string) => [`a:${ip}|${email}`, `i:${ip}`] as const;

/** Minutes until the caller may try again, or 0 if they're not blocked. */
export function loginBlockedFor(ip: string, email: string, now = Date.now()): number {
  const [acct, ipKey] = keys(ip, email);
  const a = recent(acct, now);
  const i = recent(ipKey, now);
  const blockedUntil = Math.max(
    a.length >= MAX_PER_ACCOUNT ? a[a.length - MAX_PER_ACCOUNT] + WINDOW_MS : 0,
    i.length >= MAX_PER_IP ? i[i.length - MAX_PER_IP] + WINDOW_MS : 0
  );
  return blockedUntil > now ? Math.ceil((blockedUntil - now) / 60000) : 0;
}

export function recordLoginFailure(ip: string, email: string, now = Date.now()) {
  if (failures.size > MAX_KEYS) {
    // Drop the oldest entries (Map keeps insertion order).
    for (const k of [...failures.keys()].slice(0, failures.size - MAX_KEYS / 2)) failures.delete(k);
  }
  for (const k of keys(ip, email)) failures.set(k, [...recent(k, now), now]);
}

export function clearLoginFailures(ip: string, email: string) {
  failures.delete(keys(ip, email)[0]);
}

export const LOGIN_LIMITS = { WINDOW_MS, MAX_PER_ACCOUNT, MAX_PER_IP };
