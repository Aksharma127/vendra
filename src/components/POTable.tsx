import Link from "next/link";
import { StatusTag } from "@/components/ui/StatusTag";
import { formatMoney, formatDate } from "@/lib/format";

export interface PORow {
  id: string;
  poNumber: string | null;
  prNumber: string | null;
  itemDescription: string;
  vendorName: string;
  amount: string;
  status: string;
  deliveryDate: string;
}

/** Orders as a ledger on desktop, stacked cards on phones - same reasoning as PRTable. */
export function POTable({ rows, isOverdue }: { rows: PORow[]; isOverdue: (status: string, deliveryDate: string) => boolean }) {
  return (
    <>
      <ul className="divide-y divide-line sm:hidden">
        {rows.map((r) => {
          const late = isOverdue(r.status, r.deliveryDate);
          return (
            <li key={r.id}>
              <Link href={`/purchase-orders/${r.id}`} className="-mx-1 block rounded-md px-1 py-3 transition-colors active:bg-page-bg">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-xs text-accent">{r.poNumber}</span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{formatMoney(r.amount)}</span>
                </div>
                <p className="mt-1 text-sm leading-snug text-ink">{r.itemDescription}</p>
                <p className="mt-0.5 text-xs text-graphite">{r.vendorName}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusTag status={r.status} />
                  <span className={`text-xs tabular-nums ${late ? "font-medium text-danger" : "text-graphite"}`}>
                    {late ? "Overdue · due " : "Due "}
                    {formatDate(r.deliveryDate)}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <table className="hidden w-full min-w-[760px] text-sm sm:table">
        <thead>
          <tr className="border-b border-line text-left text-xs text-graphite">
            <th className="py-2 pr-4 font-medium">PO number</th>
            <th className="py-2 pr-4 font-medium">Item</th>
            <th className="py-2 pr-4 font-medium">Vendor</th>
            <th className="py-2 pr-6 text-right font-medium">Amount</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 text-right font-medium">Delivery</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const late = isOverdue(r.status, r.deliveryDate);
            return (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-page-bg/70">
                <td className="whitespace-nowrap py-2.5 pr-4 align-top">
                  <Link href={`/purchase-orders/${r.id}`} className="font-mono text-xs text-accent hover:underline">
                    {r.poNumber}
                  </Link>
                </td>
                <td className="py-2.5 pr-4 align-top">
                  <Link href={`/purchase-orders/${r.id}`} className="text-ink hover:underline">
                    {r.itemDescription}
                  </Link>
                  <div className="font-mono text-[11px] text-graphite">{r.prNumber}</div>
                </td>
                <td className="py-2.5 pr-4 align-top text-ink">{r.vendorName}</td>
                <td className="whitespace-nowrap py-2.5 pr-6 text-right align-top tabular-nums text-ink">{formatMoney(r.amount)}</td>
                <td className="py-2.5 pr-4 align-top">
                  <StatusTag status={r.status} />
                </td>
                <td className={`whitespace-nowrap py-2.5 text-right align-top tabular-nums ${late ? "font-medium text-danger" : "text-graphite"}`}>
                  {formatDate(r.deliveryDate)}
                  {late && <div className="text-[11px] font-normal">Overdue</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
