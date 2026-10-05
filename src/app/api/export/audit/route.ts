import { getAuthContext } from "@/lib/auth-context";
import { loadAudit, parseAuditParams } from "@/lib/audit-view";
import { csvResponse, toCsv, todayStamp } from "@/lib/csv";
import { statusLabel } from "@/components/ui/StatusTag";

/** The audit trail as CSV: readable sentence AND the raw record, for auditors. */
export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return new Response("Please sign in again.", { status: 401 });
  const params = parseAuditParams(Object.fromEntries(new URL(request.url).searchParams));
  const data = await loadAudit(ctx, params, { all: true });
  if (!data) return new Response("The audit trail is for auditors.", { status: 403 });

  const csv = toCsv(
    ["When (UTC)", "Who", "What happened", "Document", "Status after", "Action code", "Raw record"],
    data.entries.map((e) => [
      e.at,
      e.actorName,
      [e.before, e.doc?.label ?? "(deleted record)", e.after].filter(Boolean).join(" "),
      e.doc?.label ?? "",
      e.statusAfter ? statusLabel(e.statusAfter) : "",
      e.action,
      e.raw ?? "",
    ])
  );
  return csvResponse(`vendra-audit-trail${params.tab.key === "all" ? "" : `-${params.tab.key}`}-${todayStamp()}.csv`, csv);
}
