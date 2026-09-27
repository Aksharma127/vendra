-- Manually-applied structural integrity constraints.
--
-- Drizzle Kit's schema diffing does not (yet) express composite foreign keys,
-- NULLS NOT DISTINCT unique indexes, or arbitrary CHECK constraints, so these
-- are applied here as a second step after `npm run db:push`. Every statement
-- is idempotent (guarded by a lookup in pg_constraint / pg_indexes) so this
-- script can be re-run safely on every deploy.
--
-- These constraints are not decoration: they are the database-level backstop
-- for Vendra's multi-tenant security model - the property that a purchase
-- request, purchase order, or vendor can never structurally point at a
-- division/vendor/PR belonging to a different company, even if every layer
-- of application code above the database were somehow bypassed.

-- ---------- Composite uniques that composite FKs reference ----------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_divisions_id_company') THEN
    ALTER TABLE divisions ADD CONSTRAINT uq_divisions_id_company UNIQUE (id, company_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_vendors_id_company') THEN
    ALTER TABLE vendors ADD CONSTRAINT uq_vendors_id_company UNIQUE (id, company_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_pr_id_company') THEN
    ALTER TABLE purchase_requests ADD CONSTRAINT uq_pr_id_company UNIQUE (id, company_id);
  END IF;
END $$;

-- ---------- Composite FKs enforcing same-company integrity ----------

-- A purchase request's division must belong to the SAME company as the
-- purchase request itself (spec: division auth always validated through
-- parent company).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pr_division_company') THEN
    ALTER TABLE purchase_requests
      ADD CONSTRAINT fk_pr_division_company
      FOREIGN KEY (division_id, company_id) REFERENCES divisions (id, company_id);
  END IF;
END $$;

-- A purchase order's vendor must belong to the SAME company as the PO.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_po_vendor_company') THEN
    ALTER TABLE purchase_orders
      ADD CONSTRAINT fk_po_vendor_company
      FOREIGN KEY (vendor_id, company_id) REFERENCES vendors (id, company_id);
  END IF;
END $$;

-- A purchase order's source PR must belong to the SAME company as the PO.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_po_pr_company') THEN
    ALTER TABLE purchase_orders
      ADD CONSTRAINT fk_po_pr_company
      FOREIGN KEY (pr_id, company_id) REFERENCES purchase_requests (id, company_id);
  END IF;
END $$;

-- ---------- Check constraint: amount is always quantity x unit cost ----------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_amount_matches') THEN
    ALTER TABLE purchase_requests
      ADD CONSTRAINT chk_amount_matches CHECK (amount = quantity * estimated_unit_cost);
  END IF;
END $$;

-- ---------- NULLS NOT DISTINCT unique index on user_roles ----------

-- Drizzle's schema DSL does not yet expose PG15+'s NULLS NOT DISTINCT clause,
-- so the plain unique index it creates (uq_user_role_scope) is dropped and
-- replaced with the NULLS NOT DISTINCT variant, which is required so that
-- two NULL company/division scopes are treated as duplicates rather than
-- always-distinct (the correct semantics for an "unscoped" role grant).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_user_role_scope'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'uq_user_role_scope' AND indexdef ILIKE '%NULLS NOT DISTINCT%'
  ) THEN
    DROP INDEX uq_user_role_scope;
    CREATE UNIQUE INDEX uq_user_role_scope ON user_roles (user_id, role_id, company_id, division_id) NULLS NOT DISTINCT;
  END IF;
END $$;
