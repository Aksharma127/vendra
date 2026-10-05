// Timeline notes written by the workflow AND by the demo-data generator.
// Kept free of "server-only" so the generator (plain Node via tsx) can import
// them, which keeps generated history word-for-word identical to the app's.

/** Written when a manager's own request skips their desk (separation of duties). */
export const DIVISION_SKIPPED_NOTE =
  "Division approval skipped: the requester approves this division, so the request goes straight to finance.";

/** Written when the first of two finance approvals is recorded. */
export const FIRST_FINANCE_APPROVAL_NOTE = "First finance approval recorded; awaiting a second, different approver";
