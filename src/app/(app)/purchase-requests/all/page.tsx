import { requireAuthContext } from "@/lib/auth-context";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequestListView } from "@/components/RequestListView";
import { loadRequestList, parseListParams } from "@/lib/request-list";

export default async function AllRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAuthContext();
  const params = parseListParams("all", await searchParams);
  const list = await loadRequestList(ctx, "all", params);
  if (!list) return <EmptyState message="Viewing every request isn't part of your role. Your own requests are under My Requests." />;

  return (
    <div>
      <PageHeader title="All requests" description="Every submitted request in the active company. Drafts stay private to whoever wrote them." />
      <RequestListView scope="all" {...params} {...list} emptyMessage="No purchase requests in this company yet." />
    </div>
  );
}
