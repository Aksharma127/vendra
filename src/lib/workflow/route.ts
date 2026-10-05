// Turns a request's raw workflow history into (a) the approval route - one
// entry per desk the request passes through - and (b) a plain-language
// timeline. Pure functions over plain data: no database, no React, so the
// rules here are easy to read and to test.
import { DIVISION_SKIPPED_NOTE, FIRST_FINANCE_APPROVAL_NOTE } from "./notes";

export type HistoryEvent = {
  id: string;
  entityType: "PURCHASE_REQUEST" | "PURCHASE_ORDER";
  fromStatus: string | null;
  toStatus: string;
  comment: string | null;
  createdAt: Date;
  actorName: string;
  roleActedAs: string;
};

export type StageKey = "raised" | "division" | "finance" | "order" | "delivered" | "closed";

export type StageState =
  | "done" // passed this desk
  | "current" // sitting here now
  | "returned" // sent back to the requester from here
  | "rejected" // stopped here
  | "withdrawn" // the requester pulled it while it was here
  | "skipped" // desk didn't apply (manager's own request)
  | "upcoming"; // not reached

export type Stage = {
  key: StageKey;
  label: string;
  state: StageState;
  /** Who acted at this desk, in order (two people for a two-step finance approval). */
  people: string[];
  at: Date | null;
  /** Short secondary line, e.g. "1 of 2 approvals" or a PO number. */
  note: string | null;
};

const LABELS: Record<StageKey, string> = {
  raised: "Raised",
  division: "Division",
  finance: "Finance",
  order: "Purchase order",
  delivered: "Delivered",
  closed: "Closed",
};

const ORDER: StageKey[] = ["raised", "division", "finance", "order", "delivered", "closed"];

export function buildRoute(input: {
  status: string;
  history: HistoryEvent[];
  poStatus: string | null;
  poNumber: string | null;
  needsTwoFinance: boolean;
  financeFirstApproverName: string | null;
}): Stage[] {
  const stages = Object.fromEntries(
    ORDER.map((key) => [key, { key, label: LABELS[key], state: "upcoming", people: [], at: null, note: null } as Stage])
  ) as Record<StageKey, Stage>;

  const events = [...input.history].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const e of events) {
    const to = e.toStatus;
    const from = e.fromStatus;
    if (e.entityType === "PURCHASE_ORDER") {
      if (to === "PO_ISSUED") set(stages.order, "done", [e.actorName], e.createdAt, null);
      if (to === "DELIVERED") set(stages.delivered, "done", [e.actorName], e.createdAt, null);
      if (to === "CLOSED") set(stages.closed, "done", [e.actorName], e.createdAt, null);
      continue;
    }
    // A (re)submission starts a fresh pass through the approval desks.
    if ((from === "DRAFT" || from === "RETURNED_FOR_REVISION") && (to === "PENDING_DIVISION_APPROVAL" || to === "PENDING_FINANCE_APPROVAL")) {
      set(stages.raised, "done", [e.actorName], e.createdAt, from === "RETURNED_FOR_REVISION" ? "Resubmitted" : null);
      reset(stages.division);
      reset(stages.finance);
      if (to === "PENDING_FINANCE_APPROVAL") set(stages.division, "skipped", [], null, "Raised by its own approver");
      continue;
    }
    if (to === "WITHDRAWN") {
      const where = from === "PENDING_DIVISION_APPROVAL" ? stages.division : stages.raised;
      set(where, "withdrawn", [e.actorName], e.createdAt, null);
      continue;
    }
    if (from === "PENDING_DIVISION_APPROVAL") {
      if (to === "PENDING_FINANCE_APPROVAL") set(stages.division, "done", [e.actorName], e.createdAt, null);
      if (to === "RETURNED_FOR_REVISION") set(stages.division, "returned", [e.actorName], e.createdAt, null);
      if (to === "REJECTED") set(stages.division, "rejected", [e.actorName], e.createdAt, null);
      continue;
    }
    if (from === "PENDING_FINANCE_APPROVAL") {
      if (to === "PENDING_FINANCE_APPROVAL") {
        // First of two finance approvals.
        set(stages.finance, "current", [e.actorName], e.createdAt, "1 of 2 approvals");
      } else if (to === "APPROVED_PENDING_PO") {
        const first = stages.finance.people.length === 1 && stages.finance.note === "1 of 2 approvals" ? stages.finance.people : [];
        set(stages.finance, "done", [...first, e.actorName], e.createdAt, first.length ? "2 of 2 approvals" : null);
      } else if (to === "REJECTED") {
        set(stages.finance, "rejected", [e.actorName], e.createdAt, null);
      }
    }
  }

  // Where it is now. History tells us who acted; the current status tells
  // us which desk is holding it.
  const s = input.status;
  if (s === "DRAFT") stages.raised.state = "current";
  if (s === "RETURNED_FOR_REVISION") stages.raised.state = "current";
  if (s === "PENDING_DIVISION_APPROVAL") stages.division.state = "current";
  if (s === "PENDING_FINANCE_APPROVAL") {
    stages.finance.state = "current";
    if (input.needsTwoFinance && !stages.finance.note) stages.finance.note = "Needs 2 approvals";
  }
  if (s === "APPROVED_PENDING_PO") stages.order.state = "current";
  if (s === "PO_ISSUED" || s === "CLOSED") {
    if (stages.order.state !== "done") stages.order.state = "done";
    if (input.poStatus === "ISSUED") stages.delivered.state = "current";
    if (input.poStatus === "DELIVERED") stages.closed.state = "current";
  }
  return ORDER.map((k) => stages[k]);
}

function set(stage: Stage, state: StageState, people: string[], at: Date | null, note: string | null) {
  stage.state = state;
  stage.people = people;
  stage.at = at;
  stage.note = note;
}

function reset(stage: Stage) {
  set(stage, "upcoming", [], null, null);
}

export type TimelineEntry = {
  id: string;
  actorName: string;
  role: string;
  /** What happened, written as the rest of a sentence after the actor's name. */
  text: string;
  /** A person's comment, shown as a quote. System notes are excluded. */
  comment: string | null;
  /** A system explanation (e.g. why division approval was skipped). */
  note: string | null;
  tone: "neutral" | "good" | "warn" | "bad";
  at: Date;
};

const SYSTEM_NOTES = new Set([DIVISION_SKIPPED_NOTE, FIRST_FINANCE_APPROVAL_NOTE]);

export function buildTimeline(history: HistoryEvent[], poNumber: string | null): TimelineEntry[] {
  let firstFinanceSeen = false;
  return [...history]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((e) => {
      const described = describe(e, poNumber);
      if (e.entityType === "PURCHASE_REQUEST") {
        if (e.fromStatus === "DRAFT" || e.fromStatus === "RETURNED_FOR_REVISION") firstFinanceSeen = false;
        if (e.fromStatus === "PENDING_FINANCE_APPROVAL" && e.toStatus === "PENDING_FINANCE_APPROVAL") firstFinanceSeen = true;
        else if (e.fromStatus === "PENDING_FINANCE_APPROVAL" && e.toStatus === "APPROVED_PENDING_PO" && firstFinanceSeen) {
          described.text = "gave the second finance approval";
        }
      }
      const comment = e.comment && !SYSTEM_NOTES.has(e.comment) ? e.comment : null;
      return { id: e.id, actorName: e.actorName, role: e.roleActedAs, text: described.text, comment, note: described.note, tone: described.tone, at: e.createdAt };
    });
}

function describe(e: HistoryEvent, poNumber: string | null): { text: string; tone: TimelineEntry["tone"]; note: string | null } {
  const { fromStatus: from, toStatus: to } = e;
  if (e.entityType === "PURCHASE_ORDER") {
    if (to === "PO_ISSUED") return { text: `issued purchase order ${poNumber ?? ""}`.trim(), tone: "good", note: null };
    if (to === "DELIVERED") return { text: "marked the order delivered", tone: "good", note: null };
    if (to === "CLOSED") return { text: "closed the order", tone: "neutral", note: null };
  }
  if (to === "WITHDRAWN") return { text: from === "DRAFT" ? "discarded the draft" : "withdrew the request", tone: "neutral", note: null };
  if (from === "RETURNED_FOR_REVISION") return { text: "resubmitted the request", tone: "neutral", note: to === "PENDING_FINANCE_APPROVAL" ? "Division approval skipped: they approve this division themselves." : null };
  if (from === "DRAFT" && to === "PENDING_FINANCE_APPROVAL")
    return { text: "submitted the request", tone: "neutral", note: "Division approval skipped: they approve this division themselves, so it went straight to finance." };
  if (from === "DRAFT") return { text: "submitted the request", tone: "neutral", note: null };
  if (from === "PENDING_DIVISION_APPROVAL") {
    if (to === "PENDING_FINANCE_APPROVAL") return { text: "approved it for the division", tone: "good", note: null };
    if (to === "RETURNED_FOR_REVISION") return { text: "returned it for changes", tone: "warn", note: null };
    if (to === "REJECTED") return { text: "rejected it at division level", tone: "bad", note: null };
  }
  if (from === "PENDING_FINANCE_APPROVAL") {
    if (to === "PENDING_FINANCE_APPROVAL") return { text: "gave the first of two finance approvals", tone: "good", note: null };
    if (to === "APPROVED_PENDING_PO") return { text: "approved it for finance", tone: "good", note: null };
    if (to === "REJECTED") return { text: "rejected it at finance", tone: "bad", note: null };
  }
  return { text: `moved it to ${to.toLowerCase().replaceAll("_", " ")}`, tone: "neutral", note: null };
}
