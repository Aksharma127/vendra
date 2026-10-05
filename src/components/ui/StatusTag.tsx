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
  OVERDUE: { label: "Overdue", color: "var(--color-danger)" },
};

export function statusLabel(status: string) {
  return STATUS_META[status]?.label ?? status;
}

/**
 * `dot` (default): coloured dot + coloured text, for dense tables.
 * `pill`: tinted capsule, for a page header where the status is the headline.
 */
export function StatusTag({ status, variant = "dot" }: { status: string; variant?: "dot" | "pill" }) {
  const meta = STATUS_META[status] ?? { label: status, color: "var(--color-graphite)" };
  if (variant === "pill") {
    return (
      <span
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium"
        style={{
          color: meta.color,
          borderColor: `color-mix(in srgb, ${meta.color} 28%, transparent)`,
          backgroundColor: `color-mix(in srgb, ${meta.color} 8%, var(--color-surface))`,
        }}
      >
        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
        {meta.label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
      <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
      <span style={{ color: meta.color }}>{meta.label}</span>
    </span>
  );
}
