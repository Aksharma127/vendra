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
      roleId: userRoles.roleId,
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
  const applicableRoleIds = [...new Set(applicableRoles.map((r) => r.roleId))];

  const { menuTree, menuPermissions } = await buildMenu(applicableRoleIds);

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
}

/**
 * Builds the pruned, database-driven nav tree plus a path -> permission map,
 * from menu_items + role_menu_permissions for the user's applicable roles.
 * A group heading (path is null) survives pruning only if at least one child
 * is visible; a leaf survives only if some applicable role grants can_view.
 */
async function buildMenu(
  roleIds: string[]
): Promise<{ menuTree: MenuNode[]; menuPermissions: Map<string, MenuPermission> }> {
  const items = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.isActive, true))
    .orderBy(menuItems.sortOrder);

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
