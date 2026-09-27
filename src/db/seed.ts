/**
 * Idempotent seed script. Safe to re-run: every insert is keyed by a
 * deterministic ID or a natural unique constraint (onConflictDoNothing).
 *
 * Run with: npm run db:seed
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, sql } from "./index";
import {
  companies,
  divisions,
  roles,
  users,
  userCompanyAccess,
  userDivisionAccess,
  userRoles,
  vendors,
  config,
  companySequences,
  menuItems,
  roleMenuPermissions,
} from "./schema";
import * as ids from "./ids";

async function main() {
  console.log("Seeding Vendra demo data...");

  // 1. Companies
  await db
    .insert(companies)
    .values([
      { id: ids.COMPANY_KIGM_ID, name: "KIG Manufacturing", code: "KIGM" },
      { id: ids.COMPANY_KIGT_ID, name: "KIG Trading Co.", code: "KIGT" },
    ])
    .onConflictDoNothing();

  // 2. Divisions
  await db
    .insert(divisions)
    .values([
      { id: ids.DIVISION_PLANT_OPS_ID, companyId: ids.COMPANY_KIGM_ID, name: "Plant Ops", code: "OPS" },
      { id: ids.DIVISION_QUALITY_ID, companyId: ids.COMPANY_KIGM_ID, name: "Quality", code: "QA" },
      { id: ids.DIVISION_IMPORT_DESK_ID, companyId: ids.COMPANY_KIGT_ID, name: "Import Desk", code: "IMP" },
      { id: ids.DIVISION_DOMESTIC_SALES_ID, companyId: ids.COMPANY_KIGT_ID, name: "Domestic Sales", code: "DOM" },
    ])
    .onConflictDoNothing();

  // 3. Roles
  await db
    .insert(roles)
    .values([
      { id: ids.ROLE_EMPLOYEE_ID, name: "Employee" },
      { id: ids.ROLE_DIVISION_MANAGER_ID, name: "Division Manager" },
      { id: ids.ROLE_FINANCE_APPROVER_ID, name: "Finance Approver" },
      { id: ids.ROLE_PROCUREMENT_OFFICER_ID, name: "Procurement Officer" },
      { id: ids.ROLE_AUDITOR_ID, name: "Auditor" },
      { id: ids.ROLE_ADMIN_ID, name: "Admin" },
    ])
    .onConflictDoNothing();

  // 4. Users (all demo users share one password for the live demo)
  const passwordHash = await bcrypt.hash(ids.DEMO_PASSWORD, 10);
  await db
    .insert(users)
    .values([
      { id: ids.USER_PRIYA_ID, name: "Priya Sharma", email: "priya@vendra.demo", passwordHash },
      { id: ids.USER_RAHUL_ID, name: "Rahul Mehta", email: "rahul@vendra.demo", passwordHash },
      { id: ids.USER_MEERA_ID, name: "Meera Iyer", email: "meera@vendra.demo", passwordHash },
      { id: ids.USER_ARJUN_ID, name: "Arjun Nair", email: "arjun@vendra.demo", passwordHash },
      { id: ids.USER_ZARA_ID, name: "Zara Khan", email: "zara@vendra.demo", passwordHash },
      { id: ids.USER_ADMIN_ID, name: "System Admin", email: "admin@vendra.demo", passwordHash },
    ])
    .onConflictDoNothing();

  // 5. Company access grants
  await db
    .insert(userCompanyAccess)
    .values([
      { userId: ids.USER_PRIYA_ID, companyId: ids.COMPANY_KIGM_ID },
      { userId: ids.USER_RAHUL_ID, companyId: ids.COMPANY_KIGM_ID },
      { userId: ids.USER_MEERA_ID, companyId: ids.COMPANY_KIGM_ID },
      { userId: ids.USER_MEERA_ID, companyId: ids.COMPANY_KIGT_ID },
      { userId: ids.USER_ARJUN_ID, companyId: ids.COMPANY_KIGM_ID },
      { userId: ids.USER_ARJUN_ID, companyId: ids.COMPANY_KIGT_ID },
      { userId: ids.USER_ZARA_ID, companyId: ids.COMPANY_KIGM_ID },
      { userId: ids.USER_ZARA_ID, companyId: ids.COMPANY_KIGT_ID },
      // Admin deliberately gets NO company access - matches Admin having no
      // business-data visibility by default (Final Decision 1).
    ])
    .onConflictDoNothing();

  // 6. Division access grants
  await db
    .insert(userDivisionAccess)
    .values([
      { userId: ids.USER_PRIYA_ID, divisionId: ids.DIVISION_PLANT_OPS_ID },
      { userId: ids.USER_RAHUL_ID, divisionId: ids.DIVISION_PLANT_OPS_ID },
    ])
    .onConflictDoNothing();

  // 7. Role assignments
  await db
    .insert(userRoles)
    .values([
      { userId: ids.USER_PRIYA_ID, roleId: ids.ROLE_EMPLOYEE_ID },
      {
        userId: ids.USER_RAHUL_ID,
        roleId: ids.ROLE_DIVISION_MANAGER_ID,
        companyId: ids.COMPANY_KIGM_ID,
        divisionId: ids.DIVISION_PLANT_OPS_ID,
      },
      { userId: ids.USER_MEERA_ID, roleId: ids.ROLE_FINANCE_APPROVER_ID },
      { userId: ids.USER_ARJUN_ID, roleId: ids.ROLE_PROCUREMENT_OFFICER_ID },
      { userId: ids.USER_ZARA_ID, roleId: ids.ROLE_AUDITOR_ID },
      { userId: ids.USER_ADMIN_ID, roleId: ids.ROLE_ADMIN_ID },
      // Admin has exactly one role: Admin. No business role. This is the
      // seed-data encoding of "Admin has no default business visibility."
    ])
    .onConflictDoNothing();

  // 8. Vendors
  await db
    .insert(vendors)
    .values([
      { id: ids.VENDOR_STEELCORP_ID, companyId: ids.COMPANY_KIGM_ID, name: "SteelCorp Traders", category: "Raw Materials" },
      { id: ids.VENDOR_PRECISION_TOOLS_ID, companyId: ids.COMPANY_KIGM_ID, name: "Precision Tools Ltd", category: "Equipment" },
      { id: ids.VENDOR_ORIENT_IMPORTS_ID, companyId: ids.COMPANY_KIGT_ID, name: "Orient Imports", category: "Trading" },
      { id: ids.VENDOR_DELTA_TRADING_ID, companyId: ids.COMPANY_KIGT_ID, name: "Delta Trading Partners", category: "Trading" },
    ])
    .onConflictDoNothing();

  // 9. Configuration
  await db
    .insert(config)
    .values([
      { key: "justificationThreshold", companyId: null, value: "50000" },
      { key: "financeSecondaryThreshold", companyId: null, value: "500000" },
    ])
    .onConflictDoNothing();

  // 10. Company sequences (current year, both companies, both doc types)
  const year = new Date().getFullYear();
  await db
    .insert(companySequences)
    .values([
      { companyId: ids.COMPANY_KIGM_ID, sequenceName: "PR", calendarYear: year, lastValue: 0 },
      { companyId: ids.COMPANY_KIGM_ID, sequenceName: "PO", calendarYear: year, lastValue: 0 },
      { companyId: ids.COMPANY_KIGT_ID, sequenceName: "PR", calendarYear: year, lastValue: 0 },
      { companyId: ids.COMPANY_KIGT_ID, sequenceName: "PO", calendarYear: year, lastValue: 0 },
    ])
    .onConflictDoNothing();

  // 11. Dynamic menu tree (database-driven nav)
  await db
    .insert(menuItems)
    .values([
      { id: ids.MENU_DASHBOARD_ID, parentId: null, label: "Dashboard", path: "/dashboard", sortOrder: 0 },
      { id: ids.MENU_PROCUREMENT_GROUP_ID, parentId: null, label: "Procurement", path: null, sortOrder: 10 },
      { id: ids.MENU_MY_REQUESTS_ID, parentId: ids.MENU_PROCUREMENT_GROUP_ID, label: "My Requests", path: "/purchase-requests/mine", sortOrder: 0 },
      { id: ids.MENU_APPROVAL_QUEUE_ID, parentId: ids.MENU_PROCUREMENT_GROUP_ID, label: "Approval Queue", path: "/purchase-requests/queue", sortOrder: 1 },
      { id: ids.MENU_ALL_REQUESTS_ID, parentId: ids.MENU_PROCUREMENT_GROUP_ID, label: "All Requests", path: "/purchase-requests/all", sortOrder: 2 },
      { id: ids.MENU_PURCHASE_ORDERS_ID, parentId: ids.MENU_PROCUREMENT_GROUP_ID, label: "Purchase Orders", path: "/purchase-orders", sortOrder: 3 },
      { id: ids.MENU_VENDORS_ID, parentId: ids.MENU_PROCUREMENT_GROUP_ID, label: "Vendors", path: "/vendors", sortOrder: 4 },
      { id: ids.MENU_INSIGHTS_GROUP_ID, parentId: null, label: "Insights", path: null, sortOrder: 20 },
      { id: ids.MENU_REPORTS_ID, parentId: ids.MENU_INSIGHTS_GROUP_ID, label: "Reports", path: "/reports", sortOrder: 0 },
      { id: ids.MENU_AUDIT_TRAIL_ID, parentId: ids.MENU_INSIGHTS_GROUP_ID, label: "Audit Trail", path: "/audit-trail", sortOrder: 1 },
      { id: ids.MENU_ADMIN_GROUP_ID, parentId: null, label: "Administration", path: null, sortOrder: 30 },
      { id: ids.MENU_ADMIN_COMPANIES_ID, parentId: ids.MENU_ADMIN_GROUP_ID, label: "Companies", path: "/admin/companies", sortOrder: 0 },
      { id: ids.MENU_ADMIN_DIVISIONS_ID, parentId: ids.MENU_ADMIN_GROUP_ID, label: "Divisions", path: "/admin/divisions", sortOrder: 1 },
      { id: ids.MENU_ADMIN_USERS_ID, parentId: ids.MENU_ADMIN_GROUP_ID, label: "Users", path: "/admin/users", sortOrder: 2 },
      { id: ids.MENU_ADMIN_ROLES_ID, parentId: ids.MENU_ADMIN_GROUP_ID, label: "Roles", path: "/admin/roles", sortOrder: 3 },
      { id: ids.MENU_ADMIN_CONFIG_ID, parentId: ids.MENU_ADMIN_GROUP_ID, label: "Configuration", path: "/admin/config", sortOrder: 4 },
    ])
    .onConflictDoNothing();

  // 12. Role menu permissions. View mirrors what each role could already do
  // via the business-capability system (kept as the source of truth for
  // actual server-side authorization); Create/Edit/Delete are only granted
  // on the new Administration screens, which check them for real.
  const V = (roleId: string, menuItemId: string) => ({ roleId, menuItemId, canView: true });
  const ADMIN_CRUD = (menuItemId: string) => ({
    roleId: ids.ROLE_ADMIN_ID,
    menuItemId,
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
  });

  await db
    .insert(roleMenuPermissions)
    .values([
      // Dashboard: everyone
      V(ids.ROLE_EMPLOYEE_ID, ids.MENU_DASHBOARD_ID),
      V(ids.ROLE_DIVISION_MANAGER_ID, ids.MENU_DASHBOARD_ID),
      V(ids.ROLE_FINANCE_APPROVER_ID, ids.MENU_DASHBOARD_ID),
      V(ids.ROLE_PROCUREMENT_OFFICER_ID, ids.MENU_DASHBOARD_ID),
      V(ids.ROLE_AUDITOR_ID, ids.MENU_DASHBOARD_ID),
      V(ids.ROLE_ADMIN_ID, ids.MENU_DASHBOARD_ID),

      // Procurement group + My Requests: Employee, Division Manager
      V(ids.ROLE_EMPLOYEE_ID, ids.MENU_PROCUREMENT_GROUP_ID),
      V(ids.ROLE_EMPLOYEE_ID, ids.MENU_MY_REQUESTS_ID),
      V(ids.ROLE_DIVISION_MANAGER_ID, ids.MENU_PROCUREMENT_GROUP_ID),
      V(ids.ROLE_DIVISION_MANAGER_ID, ids.MENU_MY_REQUESTS_ID),

      // Approval Queue: Division Manager, Finance Approver
      V(ids.ROLE_DIVISION_MANAGER_ID, ids.MENU_APPROVAL_QUEUE_ID),
      V(ids.ROLE_FINANCE_APPROVER_ID, ids.MENU_PROCUREMENT_GROUP_ID),
      V(ids.ROLE_FINANCE_APPROVER_ID, ids.MENU_APPROVAL_QUEUE_ID),

      // All Requests + Purchase Orders: Finance Approver, Procurement Officer, Auditor
      V(ids.ROLE_FINANCE_APPROVER_ID, ids.MENU_ALL_REQUESTS_ID),
      V(ids.ROLE_FINANCE_APPROVER_ID, ids.MENU_PURCHASE_ORDERS_ID),
      V(ids.ROLE_PROCUREMENT_OFFICER_ID, ids.MENU_PROCUREMENT_GROUP_ID),
      V(ids.ROLE_PROCUREMENT_OFFICER_ID, ids.MENU_ALL_REQUESTS_ID),
      V(ids.ROLE_PROCUREMENT_OFFICER_ID, ids.MENU_PURCHASE_ORDERS_ID),
      V(ids.ROLE_PROCUREMENT_OFFICER_ID, ids.MENU_VENDORS_ID),
      V(ids.ROLE_AUDITOR_ID, ids.MENU_PROCUREMENT_GROUP_ID),
      V(ids.ROLE_AUDITOR_ID, ids.MENU_ALL_REQUESTS_ID),
      V(ids.ROLE_AUDITOR_ID, ids.MENU_PURCHASE_ORDERS_ID),

      // Insights: Finance Approver + Procurement Officer (Reports), Auditor (both)
      V(ids.ROLE_FINANCE_APPROVER_ID, ids.MENU_INSIGHTS_GROUP_ID),
      V(ids.ROLE_FINANCE_APPROVER_ID, ids.MENU_REPORTS_ID),
      V(ids.ROLE_PROCUREMENT_OFFICER_ID, ids.MENU_INSIGHTS_GROUP_ID),
      V(ids.ROLE_PROCUREMENT_OFFICER_ID, ids.MENU_REPORTS_ID),
      V(ids.ROLE_AUDITOR_ID, ids.MENU_INSIGHTS_GROUP_ID),
      V(ids.ROLE_AUDITOR_ID, ids.MENU_REPORTS_ID),
      V(ids.ROLE_AUDITOR_ID, ids.MENU_AUDIT_TRAIL_ID),

      // Administration: Admin only, full CRUD on every admin screen
      V(ids.ROLE_ADMIN_ID, ids.MENU_ADMIN_GROUP_ID),
      ADMIN_CRUD(ids.MENU_ADMIN_COMPANIES_ID),
      ADMIN_CRUD(ids.MENU_ADMIN_DIVISIONS_ID),
      ADMIN_CRUD(ids.MENU_ADMIN_USERS_ID),
      ADMIN_CRUD(ids.MENU_ADMIN_ROLES_ID),
      ADMIN_CRUD(ids.MENU_ADMIN_CONFIG_ID),
    ])
    .onConflictDoNothing();

  console.log("Seed complete.");
  console.log("Demo login password for all users:", ids.DEMO_PASSWORD);
  console.log("Users: priya@vendra.demo, rahul@vendra.demo, meera@vendra.demo,");
  console.log("       arjun@vendra.demo, zara@vendra.demo, admin@vendra.demo");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end();
  });
