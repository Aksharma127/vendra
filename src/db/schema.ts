import {
  pgTable,
  text,
  uuid,
  boolean,
  timestamp,
  numeric,
  integer,
  primaryKey,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ---------- Enums ----------
export const prStatusEnum = pgEnum("pr_status", [
  "DRAFT",
  "PENDING_DIVISION_APPROVAL",
  "PENDING_FINANCE_APPROVAL",
  "APPROVED_PENDING_PO",
  "PO_ISSUED",
  "CLOSED",
  "REJECTED",
  "RETURNED_FOR_REVISION",
  "WITHDRAWN",
]);

export const poStatusEnum = pgEnum("po_status", ["ISSUED", "DELIVERED", "CLOSED"]);

export const workflowEntityEnum = pgEnum("workflow_entity_type", [
  "PURCHASE_REQUEST",
  "PURCHASE_ORDER",
]);

// ---------- Organization ----------
export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const divisions = pgTable(
  "divisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    name: text("name").notNull(),
    code: text("code").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyCode: uniqueIndex("uq_divisions_company_code").on(t.companyId, t.code),
  })
);

// ---------- Identity ----------
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Roles are fixed for this build (Employee, Division Manager, Finance Approver,
// Procurement Officer, Auditor, Admin) - stored as a simple lookup table rather
// than the full dynamic menu-permission matrix (documented scope cut, see README).
export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
});

export const userCompanyAccess = pgTable(
  "user_company_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
  },
  (t) => ({
    uq: uniqueIndex("uq_user_company").on(t.userId, t.companyId),
  })
);

export const userDivisionAccess = pgTable(
  "user_division_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    divisionId: uuid("division_id")
      .notNull()
      .references(() => divisions.id),
  },
  (t) => ({
    uq: uniqueIndex("uq_user_division").on(t.userId, t.divisionId),
  })
);

// user_roles: role scoped optionally to a company and/or division.
// Nulls mean "unscoped within whatever company/division access grants allow".
export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    companyId: uuid("company_id").references(() => companies.id),
    divisionId: uuid("division_id").references(() => divisions.id),
  },
  (t) => ({
    // NULLS NOT DISTINCT semantics emulated via a computed unique index using
    // coalesce to a sentinel, since drizzle doesn't yet expose the PG15+
    // "NULLS NOT DISTINCT" clause directly. See migration SQL for the real clause.
    uq: uniqueIndex("uq_user_role_scope").on(t.userId, t.roleId, t.companyId, t.divisionId),
  })
);

// ---------- Procurement ----------
export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    name: text("name").notNull(),
    category: text("category"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uq: uniqueIndex("uq_vendor_company_name").on(t.companyId, t.name),
  })
);

export const purchaseRequests = pgTable("purchase_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  prNumber: text("pr_number").unique(), // assigned on first submit, null while DRAFT
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  divisionId: uuid("division_id")
    .notNull()
    .references(() => divisions.id),
  requesterId: uuid("requester_id")
    .notNull()
    .references(() => users.id),
  category: text("category").notNull(),
  itemDescription: text("item_description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  estimatedUnitCost: numeric("estimated_unit_cost", { precision: 14, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 16, scale: 2 }).notNull(),
  justification: text("justification"),
  status: prStatusEnum("status").notNull().default("DRAFT"),
  financeFirstApproverId: uuid("finance_first_approver_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  poNumber: text("po_number").unique(),
  prId: uuid("pr_id")
    .notNull()
    .unique()
    .references(() => purchaseRequests.id),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  amount: numeric("amount", { precision: 16, scale: 2 }).notNull(),
  deliveryDate: text("delivery_date").notNull(),
  paymentTerms: text("payment_terms").notNull(),
  status: poStatusEnum("status").notNull().default("ISSUED"),
  issuedBy: uuid("issued_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Workflow / Audit ----------
export const workflowHistory = pgTable("workflow_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityType: workflowEntityEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id),
  roleActedAs: text("role_acted_as").notNull(),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  companyId: uuid("company_id").references(() => companies.id),
  divisionId: uuid("division_id").references(() => divisions.id),
  beforeState: text("before_state"), // JSON string, redacted per whitelist
  afterState: text("after_state"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// company_sequences: per-company, per-document-type, per-calendar-year counters.
// Never derive numbers via COUNT/MAX - always atomic increment on this table.
export const companySequences = pgTable(
  "company_sequences",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    sequenceName: text("sequence_name").notNull(), // 'PR' | 'PO'
    calendarYear: integer("calendar_year").notNull(),
    lastValue: integer("last_value").notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.companyId, t.sequenceName, t.calendarYear] }),
  })
);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  activeCompanyId: uuid("active_company_id").references(() => companies.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const config = pgTable(
  "config",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    companyId: uuid("company_id").references(() => companies.id),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uq: uniqueIndex("uq_config_key_company").on(t.key, t.companyId),
  })
);

// ---------- Relations (for convenient query API) ----------
export const divisionsRelations = relations(divisions, ({ one }) => ({
  company: one(companies, { fields: [divisions.companyId], references: [companies.id] }),
}));

export const purchaseRequestsRelations = relations(purchaseRequests, ({ one, many }) => ({
  company: one(companies, { fields: [purchaseRequests.companyId], references: [companies.id] }),
  division: one(divisions, { fields: [purchaseRequests.divisionId], references: [divisions.id] }),
  requester: one(users, { fields: [purchaseRequests.requesterId], references: [users.id] }),
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseRequests.id],
    references: [purchaseOrders.prId],
  }),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one }) => ({
  purchaseRequest: one(purchaseRequests, {
    fields: [purchaseOrders.prId],
    references: [purchaseRequests.id],
  }),
  vendor: one(vendors, { fields: [purchaseOrders.vendorId], references: [vendors.id] }),
  company: one(companies, { fields: [purchaseOrders.companyId], references: [companies.id] }),
}));
