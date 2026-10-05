import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { divisions, purchaseRequests, workflowHistory, users } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewPRForm } from "../../new/NewPRForm";

export default async function EditPRPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAuthContext();

  const [pr] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, id)).limit(1);
  // Only the requester, and only while it's with them.
  if (!pr || pr.requesterId !== ctx.userId || !ctx.authorizedCompanyIds.includes(pr.companyId)) notFound();
  // Not editable any more (e.g. just resubmitted from this very page): show
  // the request instead of a dead end.
  if (pr.status !== "DRAFT" && pr.status !== "RETURNED_FOR_REVISION") redirect(`/purchase-requests/${pr.id}`);

  const returned = pr.status === "RETURNED_FOR_REVISION";
  const [availableDivisions, lastReturn] = await Promise.all([
    ctx.authorizedDivisionIds.length > 0
      ? db.select({ id: divisions.id, name: divisions.name }).from(divisions).where(inArray(divisions.id, ctx.authorizedDivisionIds))
      : Promise.resolve([]),
    returned
      ? db
          .select({ comment: workflowHistory.comment, actorName: users.name })
          .from(workflowHistory)
          .innerJoin(users, eq(workflowHistory.actorId, users.id))
          .where(and(eq(workflowHistory.entityId, id), eq(workflowHistory.toStatus, "RETURNED_FOR_REVISION")))
          .orderBy(desc(workflowHistory.createdAt))
          .limit(1)
      : Promise.resolve([]),
  ]);
  // Keep the request's own division selectable even if access changed since.
  const options = availableDivisions.some((d) => d.id === pr.divisionId)
    ? availableDivisions
    : [...availableDivisions, ...(await db.select({ id: divisions.id, name: divisions.name }).from(divisions).where(eq(divisions.id, pr.divisionId)))];

  const qty = Number(pr.quantity);
  const cost = Number(pr.estimatedUnitCost);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        className=""
        title={returned ? "Revise request" : "Edit draft"}
        description={pr.prNumber ? <span className="font-mono">{pr.prNumber}</span> : "Only you can see this draft."}
        actions={
          <Link href={`/purchase-requests/${pr.id}`} className="text-sm text-graphite transition-colors hover:text-ink">
            Cancel
          </Link>
        }
      />

      {returned && lastReturn[0] && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
          <p className="text-sm font-medium text-ink">{lastReturn[0].actorName} asked for changes</p>
          {lastReturn[0].comment && <p className="mt-1 text-sm text-ink">{lastReturn[0].comment}</p>}
        </div>
      )}

      <Panel className="p-6">
        <NewPRForm
          divisions={options}
          edit={{
            prId: pr.id,
            returned,
            initial: {
              divisionId: pr.divisionId,
              category: pr.category,
              itemDescription: pr.itemDescription,
              quantity: String(qty),
              estimatedUnitCost: String(cost),
              justification: pr.justification ?? "",
            },
          }}
        />
      </Panel>
    </div>
  );
}
