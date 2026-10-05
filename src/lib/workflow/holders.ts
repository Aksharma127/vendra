import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { roles, userCompanyAccess, userDivisionAccess, userRoles, users } from "@/db/schema";

type Person = { id: string; name: string };

/**
 * Active people holding `roleName` who can act on a record in this company
 * (and division, for division-scoped roles). Mirrors how getAuthContext()
 * scopes roles: a role tied to a company/division only counts there.
 */
export async function peopleWithRole(roleName: string, companyId: string, divisionId?: string): Promise<Person[]> {
  const rows = await db
    .select({ id: users.id, name: users.name, roleCompany: userRoles.companyId, roleDivision: userRoles.divisionId })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(users, eq(userRoles.userId, users.id))
    .where(and(eq(roles.name, roleName), eq(users.isActive, true)));
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => r.id))];

  const [companyAccess, divisionAccess] = await Promise.all([
    db
      .select({ userId: userCompanyAccess.userId })
      .from(userCompanyAccess)
      .where(and(eq(userCompanyAccess.companyId, companyId), inArray(userCompanyAccess.userId, ids))),
    divisionId
      ? db
          .select({ userId: userDivisionAccess.userId })
          .from(userDivisionAccess)
          .where(and(eq(userDivisionAccess.divisionId, divisionId), inArray(userDivisionAccess.userId, ids)))
      : Promise.resolve([]),
  ]);
  const inCompany = new Set(companyAccess.map((r) => r.userId));
  const inDivision = new Set(divisionAccess.map((r) => r.userId));

  const out = new Map<string, Person>();
  for (const r of rows) {
    if (!inCompany.has(r.id)) continue;
    if (r.roleCompany && r.roleCompany !== companyId) continue;
    if (divisionId) {
      if (!inDivision.has(r.id)) continue;
      if (r.roleDivision && r.roleDivision !== divisionId) continue;
    }
    out.set(r.id, { id: r.id, name: r.name });
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Who a request is waiting on right now, never including the requester. */
export async function currentHolders(pr: {
  status: string;
  companyId: string;
  divisionId: string;
  requesterId: string;
  financeFirstApproverId: string | null;
  poStatus: string | null;
}): Promise<{ desk: string; people: Person[] } | null> {
  const notRequester = (p: Person) => p.id !== pr.requesterId;
  switch (pr.status) {
    case "PENDING_DIVISION_APPROVAL":
      return { desk: "Division approval", people: (await peopleWithRole("Division Manager", pr.companyId, pr.divisionId)).filter(notRequester) };
    case "PENDING_FINANCE_APPROVAL":
      return {
        desk: pr.financeFirstApproverId ? "Second finance approval" : "Finance approval",
        people: (await peopleWithRole("Finance Approver", pr.companyId)).filter((p) => notRequester(p) && p.id !== pr.financeFirstApproverId),
      };
    case "APPROVED_PENDING_PO":
      return { desk: "Purchase order", people: await peopleWithRole("Procurement Officer", pr.companyId) };
    case "PO_ISSUED":
      if (pr.poStatus === "ISSUED" || pr.poStatus === "DELIVERED") {
        return { desk: pr.poStatus === "ISSUED" ? "Delivery" : "Closing the order", people: await peopleWithRole("Procurement Officer", pr.companyId) };
      }
      return null;
    default:
      return null;
  }
}
