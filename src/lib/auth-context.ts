import "server-only";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  companies,
  divisions,
  userCompanyAccess,
  userDivisionAccess,
  userRoles,
  roles,
} from "@/db/schema";
import { getSessionId, getRawSession, updateSessionActiveCompany } from "./session";
import { capabilitiesForRoles, hasBusinessRole, type Capability } from "./rbac";

export interface AuthContext {
  userId: string;
  userName: string;
  userEmail: string;
  activeCompanyId: string | null;
  authorizedCompanies: { id: string; name: string; code: string }[];
  authorizedCompanyIds: string[];
  authorizedDivisionIds: string[]; // already filtered to activeCompanyId
  roleNames: string[];
  capabilities: Set<Capability>;
  hasBusinessRole: boolean;
}

export function can(ctx: AuthContext, capability: Capability): boolean {
  return ctx.capabilities.has(capability);
}

/**
 * The single scoping choke point. Every server action / page that touches
 * business data calls this first. Division access is ALWAYS re-derived
 * through its live parent company - a division_access grant is never
 * trusted on its own (see getAuthorizedDivisionIds below).
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const sessionId = await getSessionId();
  if (!sessionId) return null;

  const session = await getRawSession(sessionId);
  if (!session) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user || !user.isActive) return null;

  // Authorized companies: explicit grant table, company must still be active.
  const companyGrants = await db
    .select({ id: companies.id, name: companies.name, code: companies.code })
    .from(userCompanyAccess)
    .innerJoin(companies, eq(userCompanyAccess.companyId, companies.id))
    .where(and(eq(userCompanyAccess.userId, user.id), eq(companies.isActive, true)));

  const authorizedCompanyIds = companyGrants.map((c) => c.id);

  // Resolve/validate active company. If the session's active company is no
  // longer authorized (e.g. access revoked), fall back to the first one.
  let activeCompanyId = session.activeCompanyId;
  if (!activeCompanyId || !authorizedCompanyIds.includes(activeCompanyId)) {
    activeCompanyId = authorizedCompanyIds[0] ?? null;
    if (activeCompanyId) {
      await updateSessionActiveCompany(sessionId, activeCompanyId);
    }
  }

  // Live division re-check: company gate FIRST, then filter grants against
  // the division's CURRENT company_id - never trust the grant row alone.
  const authorizedDivisionIds = activeCompanyId
    ? await getAuthorizedDivisionIds(user.id, activeCompanyId)
    : [];

  // Roles applicable in this active company (company-scoped or unscoped;
  // division-scoped roles further narrowed to authorizedDivisionIds).
  const roleRows = await db
    .select({
      roleName: roles.name,
      companyId: userRoles.companyId,
      divisionId: userRoles.divisionId,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));

  const applicableRoles = roleRows.filter((r) => {
    if (r.companyId && r.companyId !== activeCompanyId) return false;
    if (r.divisionId && !authorizedDivisionIds.includes(r.divisionId)) return false;
    return true;
  });

  const roleNames = applicableRoles.map((r) => r.roleName);

  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    activeCompanyId,
    authorizedCompanies: companyGrants,
    authorizedCompanyIds,
    authorizedDivisionIds,
    roleNames,
    capabilities: capabilitiesForRoles(roleNames),
    hasBusinessRole: hasBusinessRole(roleNames),
  };
}

/**
 * Live re-check (spec §20): a division_access grant is only valid if the
 * division's CURRENT company_id matches an authorized company. This is
 * re-queried every time, never cached, so a reparented/deactivated division
 * loses access immediately rather than on next explicit refresh.
 */
export async function getAuthorizedDivisionIds(
  userId: string,
  activeCompanyId: string
): Promise<string[]> {
  const grants = await db
    .select({ divisionId: userDivisionAccess.divisionId, companyId: divisions.companyId, isActive: divisions.isActive })
    .from(userDivisionAccess)
    .innerJoin(divisions, eq(userDivisionAccess.divisionId, divisions.id))
    .where(eq(userDivisionAccess.userId, userId));

  return grants
    .filter((g) => g.companyId === activeCompanyId && g.isActive)
    .map((g) => g.divisionId);
}

export async function requireAuthContext(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("UNAUTHENTICATED");
  return ctx;
}
