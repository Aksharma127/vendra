import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { divisions } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { Panel } from "@/components/ui/Panel";
import { NewPRForm } from "./NewPRForm";

export default async function NewPRPage() {
  const ctx = await requireAuthContext();

  const availableDivisions =
    ctx.authorizedDivisionIds.length > 0
      ? await db.select().from(divisions).where(inArray(divisions.id, ctx.authorizedDivisionIds))
      : [];

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold text-ink mb-4">New Purchase Request</h1>
      <Panel className="p-6">
        <NewPRForm divisions={availableDivisions.map((d) => ({ id: d.id, name: d.name }))} />
      </Panel>
    </div>
  );
}
