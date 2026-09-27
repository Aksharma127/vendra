const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "var(--color-graphite)" },
  PENDING_DIVISION_APPROVAL: { label: "Pending division approval", color: "var(--color-warning)" },
  PENDING_FINANCE_APPROVAL: { label: "Pending finance approval", color: "var(--color-warning)" },
  APPROVED_PENDING_PO: { label: "Approved, pending PO", color: "var(--color-success)" },
  PO_ISSUED: { label: "PO issued", color: "var(--color-success)" },
  CLOSED: { label: "Closed", color: "var(--color-graphite)" },
  REJECTED: { label: "Rejected", color: "var(--color-danger)" },
  RETURNED_FOR_REVISION: { label: "Returned for revision", color: "var(--color-warning)" },
  WITHDRAWN: { label: "Withdrawn", color: "var(--color-graphite)" },
  ISSUED: { label: "Issued", color: "var(--color-success)" },
  DELIVERED: { label: "Delivered", color: "var(--color-success)" },
};

export function StatusTag({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "var(--color-graphite)" };
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: meta.color }}
      />
      <span style={{ color: meta.color }}>{meta.label}</span>
    </span>
  );
}
