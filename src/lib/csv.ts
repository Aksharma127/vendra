// CSV helpers for exports.

/**
 * One CSV cell. Quotes when needed, and neutralises spreadsheet formulas:
 * a description typed as `=HYPERLINK(...)` would otherwise run when the file
 * is opened in Excel or Sheets (CSV/formula injection), so any text cell that
 * starts with = + - @ or a tab/CR gets a leading apostrophe.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // BOM so Excel reads UTF-8 (names, ₹) correctly; CRLF per RFC 4180.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function todayStamp() {
  // Indian date for the file name.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}
