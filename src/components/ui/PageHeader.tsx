/** Page title row: one consistent hierarchy for every screen. */
export function PageHeader({
  title,
  description,
  actions,
  className = "mb-5",
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Spacing below; pass "" inside a container that already spaces its children. */
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-4 gap-y-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-graphite">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
