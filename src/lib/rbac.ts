/**
 * Role capabilities. Scope decision (documented, not an oversight): the full
 * dynamic per-menu-item permission matrix from the design spec is replaced
 * here with a static role -> capability map. Every capability check still
 * happens server-side on every request - nothing here is UI-only - which is
 * the property that actually matters for the security story. What's cut is
 * only the *admin UI for editing* which role has which capability.
 */
export type Capability =
  | "pr:create" // raise + edit + submit + withdraw own PRs
  | "pr:approve-division" // Division Manager actions
  | "pr:approve-finance" // Finance Approver actions
  | "pr:view-all" // see all PRs in scope, not just own/queue
  | "po:issue" // Procurement Officer actions
  | "vendor:manage"
  | "audit:view"
  | "reports:view"
  | "admin:manage"; // Companies/Divisions/Users/Roles/Config structural admin

const ROLE_CAPABILITIES: Record<string, Capability[]> = {
  Employee: ["pr:create"],
  "Division Manager": ["pr:create", "pr:approve-division"],
  "Finance Approver": ["pr:approve-finance", "pr:view-all", "reports:view"],
  "Procurement Officer": ["po:issue", "vendor:manage", "pr:view-all", "reports:view"],
  Auditor: ["audit:view", "reports:view", "pr:view-all"],
  // Admin deliberately has ZERO business capabilities. Structural only.
  Admin: ["admin:manage"],
};

export function capabilitiesForRoles(roleNames: string[]): Set<Capability> {
  const caps = new Set<Capability>();
  for (const name of roleNames) {
    for (const c of ROLE_CAPABILITIES[name] ?? []) caps.add(c);
  }
  return caps;
}

export function hasBusinessRole(roleNames: string[]): boolean {
  return roleNames.some((r) => r !== "Admin");
}
