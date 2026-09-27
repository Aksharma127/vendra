import "server-only";
import { cache } from "react";
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
  menuItems,
  roleMenuPermissions,
} from "@/db/schema";
import { getSessionId, getRawSession, updateSessionActiveCompany } from "./session";
import { capabilitiesForRoles, hasBusinessRole, type Capability } from "./rbac";

export interface MenuPermission {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface MenuNode {
  id: string;
  label: string;
  path: string | null;
  children: MenuNode[];
}

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
  // Database-driven dynamic menu: menuTree is the pruned nav tree the user
  // can see; menuPermissions is keyed by a leaf item's path and holds the
  // real View/Create/Edit/Delete flags admin screens check server-side.
  menuTree: MenuNode[];
  menuPermissions: Map<string, MenuPermission>;
}

export function can(ctx: AuthContext, capability: Capability): boolean {
  return ctx.capabilities.has(capability);
}

/** Action-level permission check against the dynamic menu system - used by
 * the admin CRUD screens (Companies/Divisions/Users/Roles/Configuration). */
export function canOnMenu(
  ctx: AuthContext,
  path: string,
  action: "view" | "create" | "edit" | "delete"
): boolean {
  const perm = ctx.menuPermissions.get(path);
  if (!perm) return false;
  if (action === "view") return perm.canView;
  if (action === "create") return perm.canCreate;
  if (action === "edit") return perm.canEdit;
  return perm.canDelete;
}

/**
 * The single scoping choke point. Every server action / page that touches
 * business data calls this first. Division access is ALWAYS re-derived
 * through its live parent company - a division_access grant is never
 * trusted on its own (see getAuthorizedDivisionIds below).
 */
// Wrapped in React's cache() so the (app) layout and the page it wraps -
// which each independently need the auth context - resolve it exactly once
// per request instead of twice. Without this, every single navigation ran
// the full session/user/RBAC/menu resolution (5+ queries) TWICE: once for
// the layout, once again for the page's own requireAuthContext() call. This
// only dedupes within a single request/render pass, so it never returns
// stale data across separate navigations.
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const sessionId = await getSessionId();
  if (!sessionId) return null;

  // No dependency on the session/user at all - kick this off immediately so
  // it overlaps with every round trip below instead of adding one at the end.
  const activeMenuItemsPromise = db
    .select()
    .from(menuItems)
    .where(eq(menuItems.isActive, true))
    .orderBy(menuItems.sortOrder);

  const session = await getRawSession(sessionId);
  if (!session) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user || !user.isActive) return null;

  // These three only depend on user.id, not on each other - fetch in
  // parallel instead of round-tripping one at a time.
  const [companyGrants, divisionAccessRows, roleRows] = await Promise.all([
    // Authorized companies: explicit grant table, company must still be active.
    db
      .select({ id: companies.id, name: companies.name, code: companies.code })
      .from(userCompanyAccess)
      .innerJoin(companies, eq(userCompanyAccess.companyId, companies.id))
      .where(and(eq(userCompanyAccess.userId, user.id), eq(companies.isActive, true))),
    // Raw division grants for this user, filtered against the division's
    // CURRENT company/active status once activeCompanyId is known below -
    // same live re-check getAuthorizedDivisionIds does, just inlined so it
    // can run alongside the other two queries instead of waiting on them.
    db
      .select({ divisionId: userDivisionAccess.divisionId, companyId: divisions.companyId, isActive: divisions.isActive })
      .from(userDivisionAccess)
      .innerJoin(divisions, eq(userDivisionAccess.divisionId, divisions.id))
      .where(eq(userDivisionAccess.userId, user.id)),
    // Roles applicable in this active company (company-scoped or unscoped;
    // division-scoped roles further narrowed to authorizedDivisionIds below).
    db
      .select({
        roleId: userRoles.roleId,
        roleName: roles.name,
        companyId: userRoles.companyId,
        divisionId: userRoles.divisionId,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id)),
  ]);

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

  const authorizedDivisionIds = divisionAccessRows
    .filter((g) => g.companyId === activeCompanyId && g.isActive)
    .map((g) => g.divisionId);

  const applicableRoles = roleRows.filter((r) => {
    if (r.companyId && r.companyId !== activeCompanyId) return false;
    if (r.divisionId && !authorizedDivisionIds.includes(r.divisionId)) return false;
    return true;
  });

  const roleNames = applicableRoles.map((r) => r.roleName);
  const applicableRoleIds = [...new Set(applicableRoles.map((r) => r.roleId))];

  const { menuTree, menuPermissions } = await buildMenu(applicableRoleIds, activeMenuItemsPromise);

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
    menuTree,
    menuPermissions,
  };
});

/**
 * Builds the pruned, database-driven nav tree plus a path -> permission map,
 * from menu_items + role_menu_permissions for the user's applicable roles.
 * A group heading (path is null) survives pruning only if at least one child
 * is visible; a leaf survives only if some applicable role grants can_view.
 */
async function buildMenu(
  roleIds: string[],
  itemsPromise: Promise<(typeof menuItems.$inferSelect)[]>
): Promise<{ menuTree: MenuNode[]; menuPermissions: Map<string, MenuPermission> }> {
  const items = await itemsPromise;

  const grants =
    roleIds.length > 0
      ? await db.select().from(roleMenuPermissions).where(inArray(roleMenuPermissions.roleId, roleIds))
      : [];

  const permissionsByItemId = new Map<string, MenuPermission>();
  for (const g of grants) {
    const existing = permissionsByItemId.get(g.menuItemId) ?? {
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    };
    permissionsByItemId.set(g.menuItemId, {
      canView: existing.canView || g.canView,
      canCreate: existing.canCreate || g.canCreate,
      canEdit: existing.canEdit || g.canEdit,
      canDelete: existing.canDelete || g.canDelete,
    });
  }

  const menuPermissions = new Map<string, MenuPermission>();
  for (const item of items) {
    if (item.path) {
      const perm = permissionsByItemId.get(item.id);
      if (perm) menuPermissions.set(item.path, perm);
    }
  }

  const canView = (id: string) => permissionsByItemId.get(id)?.canView ?? false;

  function buildChildren(parentId: string | null): MenuNode[] {
    return items
      .filter((i) => i.parentId === parentId)
      .map((i) => ({ id: i.id, label: i.label, path: i.path, children: buildChildren(i.id) }))
      .filter((node) => (node.path ? canView(node.id) : node.children.length > 0));
  }

  return { menuTree: buildChildren(null), menuPermissions };
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
