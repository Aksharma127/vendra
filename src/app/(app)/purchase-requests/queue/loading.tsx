import { TableSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <TableSkeleton filters={false} rows={6} />;
}
