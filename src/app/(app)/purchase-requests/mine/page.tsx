import Link from "next/link";
import { requireAuthContext } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequestListView } from "@/components/RequestListView";
import { loadRequestList, parseListParams } from "@/lib/request-list";

export default async function MyRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAuthContext();
  const params = parseListParams("mine", await searchParams);
  const list = (await loadRequestList(ctx, "mine", params))!;
  const needsChanges = list.counts.returned ?? 0;

  return (
    <div>
      <PageHeader
        title="My requests"
        description={
          needsChanges > 0 ? (
            <>
              {needsChanges === 1 ? "One request was" : `${needsChanges} requests were`} returned for changes.{" "}
              <Link href="/purchase-requests/mine?status=returned" className="text-accent hover:underline">
                Review {needsChanges === 1 ? "it" : "them"}
              </Link>
            </>
          ) : (
            "Everything you've raised, newest first."
          )
        }
        actions={
          ctx.capabilities.has("pr:create") ? (
            <Link
              href="/purchase-requests/new"
              className="inline-flex items-center gap-1.5 rounded bg-accent px-3.5 py-2 text-sm font-medium text-on-accent shadow-sm transition-colors hover:bg-accent-hover"
            >
              New request
            </Link>
          ) : null
        }
      />
      <RequestListView scope="mine" {...params} {...list} emptyMessage="You haven't raised any requests yet. Start with New request." />
    </div>
  );
}
