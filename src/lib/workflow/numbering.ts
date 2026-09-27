import { sql } from "drizzle-orm";
import type { Tx } from "./tx";
import { companySequences } from "@/db/schema";

/**
 * Atomically allocates the next number for a company/sequence/year, never via
 * COUNT or MAX. An upsert with an ON CONFLICT DO UPDATE ... RETURNING is a
 * single atomic statement, so concurrent callers serialize on the row lock -
 * no two callers can ever receive the same number.
 *
 * Produces e.g. KIGM-PR-2026-00001, resetting to 00001 on a new calendar year.
 */
export async function allocateNumber(
  tx: Tx,
  companyId: string,
  companyCode: string,
  sequenceName: "PR" | "PO"
): Promise<string> {
  const calendarYear = new Date().getFullYear();

  const [row] = await tx
    .insert(companySequences)
    .values({ companyId, sequenceName, calendarYear, lastValue: 1 })
    .onConflictDoUpdate({
      target: [companySequences.companyId, companySequences.sequenceName, companySequences.calendarYear],
      set: { lastValue: sql`${companySequences.lastValue} + 1` },
    })
    .returning({ lastValue: companySequences.lastValue });

  const padded = String(row.lastValue).padStart(5, "0");
  return `${companyCode}-${sequenceName}-${calendarYear}-${padded}`;
}
