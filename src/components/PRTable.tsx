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

export function PRTable({ rows, emptyMessage }: { rows: PRRow[]; emptyMessage: string }) {
  if (rows.length === 0) return <EmptyState message={emptyMessage} />;

  return (
    <table className="w-full min-w-[640px] text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-graphite">
          <th className="py-2 pr-4 font-medium">PR Number</th>
          <th className="py-2 pr-4 font-medium">Item</th>
          {rows[0]?.requesterName !== undefined && <th className="py-2 pr-4 font-medium">Requester</th>}
          {rows[0]?.divisionName !== undefined && <th className="py-2 pr-4 font-medium">Division</th>}
          <th className="py-2 pr-4 font-medium">Amount</th>
          <th className="py-2 pr-4 font-medium">Status</th>
          <th className="py-2 pr-4 font-medium">Created</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-line last:border-0 hover:bg-page-bg">
            <td className="py-2.5 pr-4">
              <Link href={`/purchase-requests/${r.id}`} className="text-accent hover:underline font-mono text-xs">
                {r.prNumber ?? "DRAFT"}
              </Link>
            </td>
            <td className="py-2.5 pr-4 text-ink">{r.itemDescription}</td>
            {r.requesterName !== undefined && <td className="py-2.5 pr-4 text-ink">{r.requesterName}</td>}
            {r.divisionName !== undefined && <td className="py-2.5 pr-4 text-ink">{r.divisionName}</td>}
            <td className="py-2.5 pr-4 text-ink">{formatMoney(r.amount)}</td>
            <td className="py-2.5 pr-4">
              <StatusTag status={r.status} />
            </td>
            <td className="py-2.5 pr-4 text-graphite">{formatDate(r.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
