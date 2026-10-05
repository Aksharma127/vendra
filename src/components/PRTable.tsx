import Link from "next/link";
import { StatusTag } from "@/components/ui/StatusTag";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney, formatDate } from "@/lib/format";

export interface PRRow {
  id: string;
  prNumber: string | null;
  itemDescription: string;
  amount: string;
  status: string;
  createdAt: Date;
  divisionName?: string;
  companyName?: string;
  requesterName?: string;
}

/**
 * A ledger of requests: document numbers in mono, money right-aligned in
 * tabular figures.
 *
 * Below `sm` the same rows render as stacked cards instead. A seven-column
 * ledger inside a horizontal scroller is unusable on a phone - the item wraps
 * to four lines and amount and status sit off-screen, which is exactly the
 * information you are scanning for. Only one of the two is ever in the DOM's
 * accessibility tree, since `display: none` removes the other.
 */
export function PRTable({ rows, emptyMessage }: { rows: PRRow[]; emptyMessage: string }) {
  if (rows.length === 0) return <EmptyState message={emptyMessage} />;
  const showRequester = rows[0]?.requesterName !== undefined;
  const showDivision = rows[0]?.divisionName !== undefined;
  const meta = (r: PRRow) => [showRequester ? r.requesterName : null, showDivision ? r.divisionName : null].filter(Boolean).join(" · ");

  return (
    <>
      <ul className="divide-y divide-line sm:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/purchase-requests/${r.id}`} className="-mx-1 block rounded-md px-1 py-3 transition-colors active:bg-page-bg">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs text-accent">{r.prNumber ?? "Draft"}</span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{formatMoney(r.amount)}</span>
              </div>
              <p className="mt-1 text-sm leading-snug text-ink">{r.itemDescription}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <StatusTag status={r.status} />
                <span className="text-xs text-graphite">
                  {meta(r)}
                  {meta(r) && " · "}
                  {formatDate(r.createdAt)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <table className="hidden w-full min-w-[680px] text-sm sm:table">
        <thead>
          <tr className="border-b border-line text-left text-xs text-graphite">
            <th className="py-2 pr-4 font-medium">PR number</th>
            <th className="py-2 pr-4 font-medium">Item</th>
            {showRequester && <th className="py-2 pr-4 font-medium">Requester</th>}
            {showDivision && <th className="py-2 pr-4 font-medium">Division</th>}
            <th className="py-2 pr-6 text-right font-medium">Amount</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 text-right font-medium">Raised</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line last:border-0 hover:bg-page-bg/70">
              <td className="whitespace-nowrap py-2.5 pr-4">
                <Link href={`/purchase-requests/${r.id}`} className="font-mono text-xs text-accent hover:underline">
                  {r.prNumber ?? "Draft"}
                </Link>
              </td>
              <td className="py-2.5 pr-4">
                <Link href={`/purchase-requests/${r.id}`} className="text-ink hover:underline">
                  {r.itemDescription}
                </Link>
              </td>
              {showRequester && <td className="whitespace-nowrap py-2.5 pr-4 text-ink">{r.requesterName}</td>}
              {showDivision && <td className="whitespace-nowrap py-2.5 pr-4 text-ink">{r.divisionName}</td>}
              <td className="whitespace-nowrap py-2.5 pr-6 text-right tabular-nums text-ink">{formatMoney(r.amount)}</td>
              <td className="py-2.5 pr-4">
                <StatusTag status={r.status} />
              </td>
              <td className="whitespace-nowrap py-2.5 text-right tabular-nums text-graphite">{formatDate(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
