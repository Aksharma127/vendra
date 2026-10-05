import "server-only";
import { and, count, desc, eq, inArray, like, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, purchaseOrders, purchaseRequests, users, vendors } from "@/db/schema";
import type { AuthContext } from "@/lib/auth-context";

// The audit trail as people read it: who did what to which document, in a
// sentence - with the raw record kept alongside for anyone who needs it.

export type AuditTab = { key: string; label: string; match: SQL | null };

export const AUDIT_TABS: AuditTab[] = [
  { key: "all", label: "Everything", match: null },
  { key: "decisions", label: "Approvals and rejections", match: or(like(auditLog.action, "PR_DIVISION_%"), like(auditLog.action, "PR_FINANCE_%"))! },
  { key: "submissions", label: "Submitted or withdrawn", match: inArray(auditLog.action, ["PR_SUBMITTED", "PR_WITHDRAWN"]) },
  { key: "orders", label: "Purchase orders", match: like(auditLog.action, "PO_%") },
];
export const AUDIT_PAGE_SIZE = 50;

const VERBS: Record<string, { text: string; tone: "neutral" | "good" | "warn" | "bad" }> = {
  PR_SUBMITTED: { text: "submitted {doc}", tone: "neutral" },
  PR_WITHDRAWN: { text: "withdrew {doc}", tone: "neutral" },
  PR_DIVISION_APPROVE: { text: "approved {doc} for the division", tone: "good" },
  PR_DIVISION_REJECT: { text: "rejected {doc} at division level", tone: "bad" },
  PR_DIVISION_RETURN: { text: "returned {doc} for changes", tone: "warn" },
  PR_FINANCE_FIRST_APPROVAL: { text: "gave the first of two finance approvals on {doc}", tone: "good" },
  PR_FINANCE_APPROVE: { text: "approved {doc} for finance", tone: "good" },
  PR_FINANCE_REJECT: { text: "rejected {doc} at finance", tone: "bad" },
  PO_ISSUED: { text: "issued {doc}", tone: "good" },
  PO_DELIVERED: { text: "marked {doc} delivered", tone: "good" },
  PO_CLOSED: { text: "closed {doc}", tone: "neutral" },
};

const SHOW_STATUS_AFTER = new Set(["PR_SUBMITTED", "PR_DIVISION_APPROVE", "PR_FINANCE_APPROVE"]);

export type AuditEntry = {
  id: string;
  at: Date;
  actorName: string;
  action: string;
  /** Sentence after the actor's name, split around the document reference. */
  before: string;
  after: string;
  doc: { label: string; href: string } | null;
  tone: "neutral" | "good" | "warn" | "bad";
  detail: string | null;
  statusAfter: string | null;
  raw: string | null;
};

export function parseAuditParams(sp: Record<string, string | string[] | undefined>) {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tab = AUDIT_TABS.find((t) => t.key === first(sp.kind)) ?? AUDIT_TABS[0];
  const n = Number(first(sp.page));
  return { tab, page: Number.isInteger(n) && n > 0 ? n : 1 };
}

function parse(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function loadAudit(ctx: AuthContext, params: { tab: AuditTab; page: number }, opts: { all?: boolean } = {}) {
  if (!ctx.capabilities.has("audit:view") || !ctx.activeCompanyId) return null;
  const where = and(eq(auditLog.companyId, ctx.activeCompanyId), params.tab.match ?? undefined);

  const q = db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      beforeState: auditLog.beforeState,
      afterState: auditLog.afterState,
      createdAt: auditLog.createdAt,
      actorName: users.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .where(where)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id));

  const [rows, counts] = await Promise.all([
    opts.all ? q.limit(10000) : q.limit(AUDIT_PAGE_SIZE).offset((params.page - 1) * AUDIT_PAGE_SIZE),
    Promise.all(AUDIT_TABS.map((t) => db.select({ n: count() }).from(auditLog).where(and(eq(auditLog.companyId, ctx.activeCompanyId!), t.match ?? undefined)))),
  ]);

  // Resolve document numbers (and vendor names for issued orders) in two queries.
  const prIds = [...new Set(rows.filter((r) => r.entityType === "purchase_requests").map((r) => r.entityId))];
  const poIds = [...new Set(rows.filter((r) => r.entityType === "purchase_orders").map((r) => r.entityId))];
  const [prs, pos] = await Promise.all([
    prIds.length ? db.select({ id: purchaseRequests.id, n: purchaseRequests.prNumber }).from(purchaseRequests).where(inArray(purchaseRequests.id, prIds)) : Promise.resolve([]),
    poIds.length
      ? db
          .select({ id: purchaseOrders.id, n: purchaseOrders.poNumber, vendor: vendors.name })
          .from(purchaseOrders)
          .innerJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
          .where(inArray(purchaseOrders.id, poIds))
      : Promise.resolve([]),
  ]);
  const prNum = new Map(prs.map((p) => [p.id, p.n]));
  const poInfo = new Map(pos.map((p) => [p.id, p]));

  const entries: AuditEntry[] = rows.map((r) => {
    const after = parse(r.afterState);
    const verb = VERBS[r.action] ?? { text: `${r.action.toLowerCase().replaceAll("_", " ")} {doc}`, tone: "neutral" as const };
    const [before, rest = ""] = verb.text.split("{doc}");
    const isPR = r.entityType === "purchase_requests";
    const number = isPR ? prNum.get(r.entityId) : poInfo.get(r.entityId)?.n;
    const doc = number !== undefined
      ? { label: number ?? (isPR ? "a draft" : "an order"), href: `${isPR ? "/purchase-requests" : "/purchase-orders"}/${r.entityId}` }
      : null;

    let detail: string | null = null;
    if (r.action === "PR_SUBMITTED" && after?.divisionApprovalSkipped) detail = "Went straight to finance: raised by the division's own approver.";
    if (r.action === "PO_ISSUED") {
      const v = poInfo.get(r.entityId)?.vendor;
      const amount = typeof after?.amount === "string" || typeof after?.amount === "number" ? Number(after.amount) : null;
      detail = [v ? `Vendor ${v}` : null, amount ? `₹${amount.toLocaleString("en-IN")}` : null].filter(Boolean).join(", ") || null;
    }
    if (r.action === "PR_SUBMITTED" && !detail && after?.amount) detail = `Amount ₹${Number(after.amount).toLocaleString("en-IN")}`;

    return {
      id: r.id,
      at: r.createdAt,
      actorName: r.actorName ?? "System",
      action: r.action,
      before: before.trim(),
      after: rest.trim(),
      doc,
      tone: verb.tone,
      detail,
      // Only where it adds something: "approved X" -> now pending finance. For
      // "issued", "rejected", "closed"... the sentence already says it.
      statusAfter: typeof after?.status === "string" && SHOW_STATUS_AFTER.has(r.action) ? after.status : null,
      raw: [r.beforeState ? `before: ${r.beforeState}` : null, r.afterState ? `after: ${r.afterState}` : null].filter(Boolean).join("\n") || null,
    };
  });

  return {
    entries,
    counts: Object.fromEntries(AUDIT_TABS.map((t, i) => [t.key, counts[i][0]?.n ?? 0])) as Record<string, number>,
  };
}
