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
