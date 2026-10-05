import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney, daysBetween, formatShortDate } from "@/lib/format";

export type QueueRow = {
  id: string;
  prNumber: string | null;
  itemDescription: string;
  amount: string;
  requesterName: string;
  divisionName: string;
  /** When it arrived at this desk. */
  since: Date;
  /** e.g. "Needs 2 approvals", "Meera Iyer gave the 1st approval". */
  marker?: string | null;
};

function Waiting({ since }: { since: Date }) {
  const days = daysBetween(since);
  // Stale items are the point of a queue view: amber after 3 days, red after 7.
  const tone = days >= 7 ? "text-danger" : days >= 3 ? "text-warning" : "text-graphite";
  const label = days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`;
  return (
    <span className={`tabular-nums ${tone}`} title={`Since ${formatShortDate(since)}`}>
      {label}
    </span>
  );
}

/** A queue: oldest first, how long each has waited, money right-aligned. */
export function QueueList({ rows, emptyMessage }: { rows: QueueRow[]; emptyMessage: string }) {
  if (rows.length === 0) return <EmptyState message={emptyMessage} />;
  return (
    <>
      {/* Phones: stacked rows */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/purchase-requests/${r.id}`} className="block py-3 active:bg-page-bg">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs text-accent">{r.prNumber}</span>
                <span className="text-xs">
                  <Waiting since={r.since} />
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="text-sm text-ink">{r.itemDescription}</span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{formatMoney(r.amount)}</span>
              </div>
              <div className="mt-0.5 text-xs text-graphite">
                {r.requesterName}, {r.divisionName}
              </div>
              {r.marker && <div className="mt-1 text-xs font-medium text-accent">{r.marker}</div>}
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablets and up: a table */}
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-line text-left text-xs text-graphite">
            <th className="py-2 pr-4 font-medium">PR number</th>
            <th className="py-2 pr-4 font-medium">Item</th>
            <th className="py-2 pr-4 font-medium">Requester</th>
            <th className="py-2 pr-4 text-right font-medium">Amount</th>
            <th className="py-2 pl-2 text-right font-medium">Waiting</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line last:border-0 hover:bg-page-bg/70">
              <td className="whitespace-nowrap py-2.5 pr-4 align-top">
                <Link href={`/purchase-requests/${r.id}`} className="font-mono text-xs text-accent hover:underline">
                  {r.prNumber}
                </Link>
              </td>
              <td className="py-2.5 pr-4 align-top">
                <Link href={`/purchase-requests/${r.id}`} className="text-ink hover:underline">
                  {r.itemDescription}
                </Link>
                {r.marker && <div className="mt-0.5 text-xs font-medium text-accent">{r.marker}</div>}
              </td>
              <td className="py-2.5 pr-4 align-top text-ink">
                {r.requesterName}
                <div className="text-xs text-graphite">{r.divisionName}</div>
              </td>
              <td className="whitespace-nowrap py-2.5 pr-4 text-right align-top tabular-nums text-ink">{formatMoney(r.amount)}</td>
              <td className="whitespace-nowrap py-2.5 pl-2 text-right align-top">
                <Waiting since={r.since} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
