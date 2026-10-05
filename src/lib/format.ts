// Every date and time is shown in Indian time. Without an explicit zone, Intl
// uses the server's zone - UTC on Vercel - so times were 5.5 hours behind.
export const TIME_ZONE = "Asia/Kolkata";

export function formatMoney(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: TIME_ZONE }).format(d);
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(d);
}

/** "29 Sept" - compact date for dense places (route, timeline). */
export function formatShortDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const year = (x: Date) => new Intl.DateTimeFormat("en-IN", { year: "numeric", timeZone: TIME_ZONE }).format(x);
  const sameYear = year(d) === year(new Date());
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: TIME_ZONE }).format(d);
}

/** "2:01 pm" in Indian time. */
export function formatTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", { timeStyle: "short", timeZone: TIME_ZONE }).format(d);
}

/** Day number of a moment's calendar date in Indian time (for day differences). */
function istDay(d: Date): number {
  const { y, m, day } = zonedParts(d);
  return Math.floor(Date.UTC(y, m - 1, day) / 86400000);
}

/** "just now", "5 min ago", "3 hours ago", "yesterday", "4 days ago", else a date.
 * Days are calendar days in Indian time: something from 11 pm last night is
 * "yesterday", not "1 hour ago" rounded into the wrong day. */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const mins = Math.round((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const days = istDay(now) - istDay(d);
  if (days <= 0) {
    const hours = Math.max(1, Math.round(mins / 60));
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return formatShortDate(d);
}

/** Calendar days between two moments in Indian time, for "waiting 3 days". */
export function daysBetween(from: string | Date, to: Date = new Date()): number {
  const d = typeof from === "string" ? new Date(from) : from;
  return Math.max(0, istDay(to) - istDay(d));
}

/** "since today" / "since yesterday" / "for 3 days". */
export function formatWaiting(since: string | Date, now: Date = new Date()): string {
  const days = daysBetween(since, now);
  if (days === 0) return "since today";
  if (days === 1) return "since yesterday";
  return `for ${days} days`;
}

/** Calendar parts of a moment in Indian time (year, 1-12 month, day). */
export function zonedParts(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TIME_ZONE }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), day: get("day") };
}
