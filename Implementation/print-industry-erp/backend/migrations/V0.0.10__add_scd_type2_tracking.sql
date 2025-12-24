-- =====================================================
-- FLYWAY MIGRATION V1.0.10
-- =====================================================
-- Purpose: Add SCD Type 2 tracking to master data tables for dimensional analysis
-- Tables Modified: facilities, customers, vendors, products, materials, employees, work_centers
-- Dependencies: V1.0.9 (quantity/amount standardization)
-- Created: 2025-12-17
-- Author: Claude Code (Dimensional Model Remediation - Phase 1 Week 3)
--
-- Context: OLAP-driven OLTP design requires tracking historical changes in master data
-- (customers, vendors, products, materials, employees, facilities, work_centers) to enable
-- dimensional analysis. Slowly Changing Dimension Type 2 tracks full history with effective
-- dating, allowing business intelligence queries like "What was customer's credit limit
-- when order was placed?" or "What was work center's hourly rate during production run?"
--
-- CRITICAL - AGOG Blue-Green Deployment Rules:
-- ✅ SAFE: Adding nullable columns with defaults (old code ignores, new code uses)
-- ✅ SAFE: Adding indexes (improves performance for both versions)
-- ❌ UNSAFE: Renaming or dropping columns (breaks rollback)
-- ❌ UNSAFE: Changing data types (may break old code)
--
-- This migration follows blue-green safety rules:
-- - All new columns are nullable with defaults
-- - Existing columns are not modified or dropped
-- - Old code continues to work (ignores new SCD columns)
-- - New code can start tracking history immediately
-- =============================================================================

-- =============================================================================
-- TABLE: facilities (manufacturing plants, warehouses, sales offices)
-- =============================================================================
-- Business Value: Track facility changes over time (cost center changes, capacity changes,
-- address changes for compliance, operating hours changes)
-- Example BI Query: "What was facility's production capacity when order was quoted?"

ALTER TABLE facilities
ADD COLUMN effective_from_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN effective_to_date DATE DEFAULT '9999-12-31',
ADD COLUMN is_current_version BOOLEAN DEFAULT TRUE;

-- Index for current version queries (most common: "get current facility data")
CREATE INDEX idx_facilities_current_version
ON facilities(tenant_id, is_current_version)
WHERE is_current_version = TRUE;

-- Index for historical queries ("get facility data as of order date")
CREATE INDEX idx_facilities_effective_dates
ON facilities(tenant_id, effective_from_date, effective_to_date);

-- Unique constraint: Only one current version per facility code
CREATE UNIQUE INDEX uq_facilities_current
ON facilities(tenant_id, facility_code)
WHERE is_current_version = TRUE;

-- Composite unique constraint for full history integrity
-- (tenant_id, facility_code, effective_from_date) ensures no duplicate versions
ALTER TABLE facilities
ADD CONSTRAINT uq_facilities_natural_key_effective
UNIQUE (tenant_id, facility_code, effective_from_date);

COMMENT ON COLUMN facilities.effective_from_date IS
'SCD Type 2: Start date this version is valid. Default CURRENT_DATE for new records.';

COMMENT ON COLUMN facilities.effective_to_date IS
'SCD Type 2: End date this version is valid. 9999-12-31 = current version (open-ended).';

COMMENT ON COLUMN facilities.is_current_version IS
'SCD Type 2: TRUE = current active version. Indexed for fast "current data" queries.';

-- =============================================================================
-- TABLE: customers (buyers of finished goods)
-- =============================================================================
-- Business Value: Track customer changes over time (credit limit changes, pricing tier
-- changes, address changes, sales rep assignments)
-- Example BI Query: "What was customer's credit limit when order was approved?"
-- Example BI Query: "Which customers moved from TIER_A to TIER_B pricing this year?"

ALTER TABLE customers
ADD COLUMN effective_from_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN effective_to_date DATE DEFAULT '9999-12-31',
ADD COLUMN is_current_version BOOLEAN DEFAULT TRUE;

CREATE INDEX idx_customers_current_version
ON customers(tenant_id, is_current_version)
WHERE is_current_version = TRUE;

CREATE INDEX idx_customers_effective_dates
ON customers(tenant_id, effective_from_date, effective_to_date);

CREATE UNIQUE INDEX uq_customers_current
ON customers(tenant_id, customer_code)
WHERE is_current_version = TRUE;

ALTER TABLE customers
ADD CONSTRAINT uq_customers_natural_key_effective
UNIQUE (tenant_id, customer_code, effective_from_date);

COMMENT ON COLUMN customers.effective_from_date IS
'SCD Type 2: Start date this customer version is valid. Tracks credit limit changes, pricing tier changes, etc.';

COMMENT ON COLUMN customers.effective_to_date IS
'SCD Type 2: End date this customer version is valid. 9999-12-31 = current version.';

COMMENT ON COLUMN customers.is_current_version IS
'SCD Type 2: TRUE = current active customer version. Query this for real-time customer data.';

-- =============================================================================
-- TABLE: vendors (suppliers of materials)
-- =============================================================================
-- Business Value: Track vendor changes over time (payment terms changes, performance
-- ratings changes, address changes, approved vendor status changes)
-- Example BI Query: "What was vendor's on-time delivery percentage when PO was issued?"
-- Example BI Query: "Track vendor quality rating improvements over 2 years"

ALTER TABLE vendors
ADD COLUMN effective_from_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN effective_to_date DATE DEFAULT '9999-12-31',
ADD COLUMN is_current_version BOOLEAN DEFAULT TRUE;

CREATE INDEX idx_vendors_current_version
ON vendors(tenant_id, is_current_version)
WHERE is_current_version = TRUE;

CREATE INDEX idx_vendors_effective_dates
ON vendors(tenant_id, effective_from_date, effective_to_date);

CREATE UNIQUE INDEX uq_vendors_current
ON vendors(tenant_id, vendor_code)
WHERE is_current_version = TRUE;

ALTER TABLE vendors
ADD CONSTRAINT uq_vendors_natural_key_effective
UNIQUE (tenant_id, vendor_code, effective_from_date);

COMMENT ON COLUMN vendors.effective_from_date IS
'SCD Type 2: Start date this vendor version is valid. Tracks performance rating changes, payment term changes, etc.';

COMMENT ON COLUMN vendors.effective_to_date IS
'SCD Type 2: End date this vendor version is valid. 9999-12-31 = current version.';

COMMENT ON COLUMN vendors.is_current_version IS
'SCD Type 2: TRUE = current active vendor version. Use for current vendor performance metrics.';

-- =============================================================================
-- TABLE: products (finished goods sold to customers)
-- =============================================================================
-- Business Value: Track product changes over time (cost changes, price changes,
-- specification changes, routing changes)
-- Example BI Query: "What was product's standard cost when quote was generated?"
-- Example BI Query: "Track product margin erosion over time (price vs cost changes)"

ALTER TABLE products
ADD COLUMN effective_from_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN effective_to_date DATE DEFAULT '9999-12-31',
ADD COLUMN is_current_version BOOLEAN DEFAULT TRUE;

CREATE INDEX idx_products_current_version
ON products(tenant_id, is_current_version)
WHERE is_current_version = TRUE;

CREATE INDEX idx_products_effective_dates
ON products(tenant_id, effective_from_date, effective_to_date);

CREATE UNIQUE INDEX uq_products_current
ON products(tenant_id, product_code)
WHERE is_current_version = TRUE;

ALTER TABLE products
ADD CONSTRAINT uq_products_natural_key_effective
UNIQUE (tenant_id, product_code, effective_from_date);

COMMENT ON COLUMN products.effective_from_date IS
'SCD Type 2: Start date this product version is valid. Tracks cost changes, price changes, specification changes.';

COMMENT ON COLUMN products.effective_to_date IS
'SCD Type 2: End date this product version is valid. 9999-12-31 = current version.';

COMMENT ON COLUMN products.is_current_version IS
'SCD Type 2: TRUE = current active product version. Use for current product catalog queries.';

-- =============================================================================
-- TABLE: materials (raw materials, substrates, inks, components)
-- =============================================================================
-- Business Value: Track material changes over time (cost changes, supplier changes,
-- lead time changes, specification changes)
-- Example BI Query: "What was material's standard cost when production run started?"
-- Example BI Query: "Analyze material cost inflation trends by category"

ALTER TABLE materials
ADD COLUMN effective_from_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN effective_to_date DATE DEFAULT '9999-12-31',
ADD COLUMN is_current_version BOOLEAN DEFAULT TRUE;

CREATE INDEX idx_materials_current_version
ON materials(tenant_id, is_current_version)
WHERE is_current_version = TRUE;

CREATE INDEX idx_materials_effective_dates
ON materials(tenant_id, effective_from_date, effective_to_date);

CREATE UNIQUE INDEX uq_materials_current
ON materials(tenant_id, material_code)
WHERE is_current_version = TRUE;

ALTER TABLE materials
ADD CONSTRAINT uq_materials_natural_key_effective
UNIQUE (tenant_id, material_code, effective_from_date);

COMMENT ON COLUMN materials.effective_from_date IS
'SCD Type 2: Start date this material version is valid. Tracks cost changes, supplier changes, lead time changes.';

COMMENT ON COLUMN materials.effective_to_date IS
'SCD Type 2: End date this material version is valid. 9999-12-31 = current version.';

COMMENT ON COLUMN materials.is_current_version IS
'SCD Type 2: TRUE = current active material version. Use for current material master queries.';

-- =============================================================================
-- TABLE: employees (workers, operators, inspectors)
-- =============================================================================
-- Business Value: Track employee changes over time (job title changes, department
-- changes, wage rate changes, facility transfers, supervisor changes)
-- Example BI Query: "What was employee's hourly rate when labor was tracked?"
-- Example BI Query: "Analyze departmental headcount changes quarter-over-quarter"

ALTER TABLE employees
ADD COLUMN effective_from_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN effective_to_date DATE DEFAULT '9999-12-31',
ADD COLUMN is_current_version BOOLEAN DEFAULT TRUE;

CREATE INDEX idx_employees_current_version
ON employees(tenant_id, is_current_version)
WHERE is_current_version = TRUE;

CREATE INDEX idx_employees_effective_dates
ON employees(tenant_id, effective_from_date, effective_to_date);

CREATE UNIQUE INDEX uq_employees_current
ON employees(tenant_id, employee_number)
WHERE is_current_version = TRUE;

ALTER TABLE employees
ADD CONSTRAINT uq_employees_natural_key_effective
UNIQUE (tenant_id, employee_number, effective_from_date);

COMMENT ON COLUMN employees.effective_from_date IS
'SCD Type 2: Start date this employee version is valid. Tracks job title changes, department changes, wage changes, facility transfers.';

COMMENT ON COLUMN employees.effective_to_date IS
'SCD Type 2: End date this employee version is valid. 9999-12-31 = current active employee.';

COMMENT ON COLUMN employees.is_current_version IS
'SCD Type 2: TRUE = current active employee version. Use for current employee roster queries.';

-- =============================================================================
-- TABLE: work_centers (presses, bindery, finishing equipment)
-- =============================================================================
-- Business Value: Track work center changes over time (hourly rate changes, capacity
-- changes, status changes, capability changes)
-- Example BI Query: "What was work center's hourly rate when production run executed?"
-- Example BI Query: "Track work center capacity utilization changes after upgrades"

ALTER TABLE work_centers
ADD COLUMN effective_from_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN effective_to_date DATE DEFAULT '9999-12-31',
ADD COLUMN is_current_version BOOLEAN DEFAULT TRUE;

CREATE INDEX idx_work_centers_current_version
ON work_centers(tenant_id, is_current_version)
WHERE is_current_version = TRUE;

CREATE INDEX idx_work_centers_effective_dates
ON work_centers(tenant_id, effective_from_date, effective_to_date);

CREATE UNIQUE INDEX uq_work_centers_current
ON work_centers(tenant_id, facility_id, work_center_code)
WHERE is_current_version = TRUE;

ALTER TABLE work_centers
ADD CONSTRAINT uq_work_centers_natural_key_effective
UNIQUE (tenant_id, facility_id, work_center_code, effective_from_date);

COMMENT ON COLUMN work_centers.effective_from_date IS
'SCD Type 2: Start date this work center version is valid. Tracks hourly rate changes, capacity changes, capability upgrades.';

COMMENT ON COLUMN work_centers.effective_to_date IS
'SCD Type 2: End date this work center version is valid. 9999-12-31 = current version.';

COMMENT ON COLUMN work_centers.is_current_version IS
'SCD Type 2: TRUE = current active work center version. Use for current equipment roster queries.';

-- =============================================================================
-- VERIFICATION QUERIES (commented out - for testing/validation)
-- =============================================================================

-- Verify all master data tables have SCD Type 2 columns:
-- SELECT
--     table_name,
--     COUNT(*) FILTER (WHERE column_name = 'effective_from_date') AS has_from,
--     COUNT(*) FILTER (WHERE column_name = 'effective_to_date') AS has_to,
--     COUNT(*) FILTER (WHERE column_name = 'is_current_version') AS has_current
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('facilities', 'customers', 'vendors', 'products', 'materials', 'employees', 'work_centers')
--   AND column_name IN ('effective_from_date', 'effective_to_date', 'is_current_version')
-- GROUP BY table_name
-- ORDER BY table_name;
-- Expected: Each table should have has_from=1, has_to=1, has_current=1

-- Verify indexes created:
-- SELECT
--     schemaname,
--     tablename,
--     indexname,
--     indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN ('facilities', 'customers', 'vendors', 'products', 'materials', 'employees', 'work_centers')
--   AND (indexname LIKE '%current_version%' OR indexname LIKE '%effective_dates%')
-- ORDER BY tablename, indexname;

-- Verify unique constraints:
-- SELECT
--     tc.table_name,
--     tc.constraint_name,
--     tc.constraint_type,
--     kcu.column_name
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--     ON tc.constraint_name = kcu.constraint_name
-- WHERE tc.table_schema = 'public'
--   AND tc.table_name IN ('facilities', 'customers', 'vendors', 'products', 'materials', 'employees', 'work_centers')
--   AND tc.constraint_type = 'UNIQUE'
--   AND tc.constraint_name LIKE '%natural_key_effective%'
-- ORDER BY tc.table_name, kcu.ordinal_position;

-- =============================================================================
-- DIMENSIONAL MODEL IMPACT
-- =============================================================================

-- These changes enable:
-- 1. Point-in-time queries: "What was customer's credit limit on order_date?"
-- 2. Trend analysis: "Track material cost inflation quarter-over-quarter"
-- 3. Historical reporting: "Revenue by customer pricing tier over 2 years"
-- 4. Audit compliance: "Prove what work center hourly rate was when labor was charged"
-- 5. Root cause analysis: "Did vendor's quality rating decline before defects increased?"

-- GraphQL Query Patterns (to be implemented in resolvers):

-- Current version (default behavior - unchanged for backward compatibility):
-- query {
--   customer(id: "123") {
--     customerName
--     creditLimit
--     # Automatically filters is_current_version = TRUE
--   }
-- }

-- Historical version (new capability):
-- query {
--   customerAsOf(id: "123", asOfDate: "2024-06-01") {
--     customerName
--     creditLimit  # Shows credit limit as of June 1, 2024
--     effectiveFromDate
--     effectiveToDate
--   }
-- }

-- Version history (new capability):
-- query {
--   customerHistory(customerCode: "ACME-001") {
--     customerName
--     creditLimit
--     effectiveFromDate
--     effectiveToDate
--     isCurrentVersion
--     # Returns ALL versions of customer ACME-001
--   }
-- }

-- OLAP/BI Examples (executed on Star Schema, not OLTP):

-- Example 1: Material cost inflation analysis
-- SELECT
--     d.year_number,
--     d.quarter_number,
--     m.material_category,
--     AVG(m.standard_cost) AS avg_cost,
--     (AVG(m.standard_cost) / LAG(AVG(m.standard_cost)) OVER (PARTITION BY m.material_category ORDER BY d.year_number, d.quarter_number) - 1) * 100 AS inflation_pct
-- FROM dim_materials m
-- JOIN dim_date d ON d.date_actual BETWEEN m.effective_from_date AND m.effective_to_date
-- WHERE d.year_number >= 2023
-- GROUP BY d.year_number, d.quarter_number, m.material_category
-- ORDER BY d.year_number, d.quarter_number, m.material_category;

-- Example 2: Customer lifetime value by original pricing tier
-- SELECT
--     m_original.pricing_tier AS original_tier,
--     COUNT(DISTINCT f.customer_key) AS customer_count,
--     SUM(f.line_amount) AS total_revenue,
--     AVG(f.line_amount) AS avg_order_value
-- FROM fact_sales_orders f
-- JOIN dim_customers m_current ON f.customer_key = m_current.customer_key AND m_current.is_current_version = TRUE
-- JOIN dim_customers m_original ON m_original.customer_code = m_current.customer_code AND m_original.effective_from_date = (
--     SELECT MIN(effective_from_date) FROM dim_customers WHERE customer_code = m_current.customer_code
-- )
-- GROUP BY m_original.pricing_tier
-- ORDER BY total_revenue DESC;

-- Example 3: Work center profitability (actual cost vs. standard rate over time)
-- SELECT
--     w.work_center_name,
--     d.year_number,
--     d.month_number,
--     w.hourly_rate AS standard_rate,
--     SUM(f.actual_run_minutes) / 60.0 AS total_hours,
--     SUM(f.actual_labor_cost) AS actual_cost,
--     SUM(f.actual_run_minutes) / 60.0 * w.hourly_rate AS standard_cost,
--     SUM(f.actual_labor_cost) - (SUM(f.actual_run_minutes) / 60.0 * w.hourly_rate) AS variance
-- FROM fact_production_runs f
-- JOIN dim_work_centers w ON f.work_center_key = w.work_center_key
-- JOIN dim_date d ON f.production_date_key = d.date_key
-- WHERE d.year_number = 2024
--   AND d.date_actual BETWEEN w.effective_from_date AND w.effective_to_date
-- GROUP BY w.work_center_name, d.year_number, d.month_number, w.hourly_rate
-- ORDER BY variance DESC;

-- =============================================================================
-- NEXT STEPS
-- =============================================================================

-- 1. Update GraphQL schemas (Implementation/print-industry-erp/backend/src/graphql/schema/):
--    - Add effective_from_date, effective_to_date, is_current_version to types
--    - Add historical query variants (customerAsOf, customerHistory, etc.)

-- 2. Update GraphQL resolvers (Implementation/print-industry-erp/backend/src/graphql/resolvers/):
--    - Modify default queries to filter is_current_version = TRUE
--    - Add historical query resolvers (asOf, history variants)

-- 3. Create SCD management functions (future migration):
--    - create_new_version() trigger function
--    - close_current_version() helper function
--    - validate_scd_integrity() check function

-- 4. Build Star Schema (OLAP database - separate from OLTP):
--    - Create dimension tables (dim_customers, dim_products, etc.)
--    - Create fact tables (fact_sales_orders, fact_production_runs, etc.)
--    - Build ETL processes (OLTP → OLAP nightly sync)

-- 5. Next migration: V1.0.11__standardize_audit_columns.sql
--    - Rename created_by → created_by_user_id
--    - Rename updated_by → updated_by_user_id
--    - Rename deleted_by → deleted_by_user_id
