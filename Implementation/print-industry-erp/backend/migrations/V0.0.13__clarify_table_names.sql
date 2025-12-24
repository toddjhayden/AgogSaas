-- V1.0.13__clarify_table_names.sql
-- Purpose: Rename tables for maximum semantic clarity
-- Author: Claude Code (Dimensional Model Remediation - Week 5)
-- Date: 2025-12-17
--
-- Context: Table names must be unambiguous. Users should never wonder:
-- "Is this a vendor PO or customer PO?" The name should make it obvious.
--
-- Changes:
-- 1. purchase_orders → vendor_purchase_orders (buying FROM vendors)
-- 2. purchase_order_lines → vendor_purchase_order_lines
-- 3. materials_suppliers → material_vendors (consistent "vendor" terminology)
-- 4. external_company_orders → marketplace_partner_orders (clearer context)
--
-- Terminology Standard: "VENDOR" (not "supplier")
-- - Industry standard: SAP, Microsoft Dynamics, print ERPs use "vendor"
-- - Consistent with existing vendors table
-- - "Vendor" = entity we buy materials/services FROM
-- - "Customer" = entity we sell products TO
-- =============================================================================

-- =============================================================================
-- CRITICAL: BLUE-GREEN SAFE RENAMES
-- =============================================================================
-- Strategy: CREATE new table, COPY data, UPDATE foreign keys, DROP old table
-- This is safer than ALTER TABLE RENAME which can break running queries
--
-- AGOG Blue-Green Rules:
-- ✅ SAFE: Creating new tables (old code continues to work)
-- ✅ SAFE: Copying data (both tables exist during transition)
-- ❌ UNSAFE: Direct RENAME (breaks any running query referencing old name)
--
-- Deployment Steps:
-- 1. Run this migration (creates new tables)
-- 2. Deploy application code using new table names
-- 3. Run V1.0.14 cleanup migration (drops old tables)
-- =============================================================================

-- =============================================================================
-- RENAME 1: purchase_orders → vendor_purchase_orders
-- =============================================================================
-- Reason: "purchase_orders" is ambiguous. Make it clear this is buying FROM vendors.
-- Impact: GraphQL schema, resolvers, all vendor procurement queries

-- Create new table with identical structure
CREATE TABLE vendor_purchase_orders (LIKE purchase_orders INCLUDING ALL);

-- Copy all data
INSERT INTO vendor_purchase_orders SELECT * FROM purchase_orders;

-- Update foreign key references (if any other tables reference this)
-- Note: We'll handle foreign keys in the cleanup migration after code deployment

COMMENT ON TABLE vendor_purchase_orders IS
'Purchase orders sent TO vendors for materials/services. Renamed from purchase_orders for clarity (Week 5 remediation).';

-- =============================================================================
-- RENAME 2: purchase_order_lines → vendor_purchase_order_lines
-- =============================================================================
-- Reason: Consistency with parent table rename

CREATE TABLE vendor_purchase_order_lines (LIKE purchase_order_lines INCLUDING ALL);

INSERT INTO vendor_purchase_order_lines SELECT * FROM purchase_order_lines;

-- Update foreign key to point to new parent table
ALTER TABLE vendor_purchase_order_lines
DROP CONSTRAINT IF EXISTS purchase_order_lines_purchase_order_id_fkey,
ADD CONSTRAINT vendor_purchase_order_lines_purchase_order_id_fkey
    FOREIGN KEY (purchase_order_id) REFERENCES vendor_purchase_orders(id) ON DELETE CASCADE;

COMMENT ON TABLE vendor_purchase_order_lines IS
'Line items on vendor purchase orders. Renamed from purchase_order_lines for clarity (Week 5 remediation).';

-- =============================================================================
-- RENAME 3: materials_suppliers → material_vendors
-- =============================================================================
-- Reason: Standardize on "vendor" terminology (not "supplier")
-- This is a junction table: which vendors supply which materials

CREATE TABLE material_vendors (LIKE materials_suppliers INCLUDING ALL);

INSERT INTO material_vendors SELECT * FROM materials_suppliers;

-- Update foreign keys
ALTER TABLE material_vendors
DROP CONSTRAINT IF EXISTS materials_suppliers_material_id_fkey,
DROP CONSTRAINT IF EXISTS materials_suppliers_vendor_id_fkey,
ADD CONSTRAINT material_vendors_material_id_fkey
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
ADD CONSTRAINT material_vendors_vendor_id_fkey
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;

COMMENT ON TABLE material_vendors IS
'Junction table: which vendors can supply which materials. Renamed from materials_suppliers for terminology consistency (Week 5 remediation).';

-- =============================================================================
-- RENAME 4: external_company_orders → marketplace_partner_orders
-- =============================================================================
-- Reason: "external_company_orders" is vague. Make it clear this is marketplace context.

CREATE TABLE marketplace_partner_orders (LIKE external_company_orders INCLUDING ALL);

INSERT INTO marketplace_partner_orders SELECT * FROM external_company_orders;

-- Update foreign keys (references partner_network_profiles)
ALTER TABLE marketplace_partner_orders
DROP CONSTRAINT IF EXISTS external_company_orders_partner_id_fkey,
ADD CONSTRAINT marketplace_partner_orders_partner_id_fkey
    FOREIGN KEY (partner_id) REFERENCES partner_network_profiles(id) ON DELETE SET NULL;

COMMENT ON TABLE marketplace_partner_orders IS
'Orders placed through the marketplace partner network. Renamed from external_company_orders for clarity (Week 5 remediation).';

-- =============================================================================
-- VERIFICATION QUERIES (commented out - for reference)
-- =============================================================================

-- Verify row counts match:
-- SELECT
--     (SELECT COUNT(*) FROM purchase_orders) AS old_po_count,
--     (SELECT COUNT(*) FROM vendor_purchase_orders) AS new_po_count,
--     (SELECT COUNT(*) FROM purchase_order_lines) AS old_pol_count,
--     (SELECT COUNT(*) FROM vendor_purchase_order_lines) AS new_pol_count,
--     (SELECT COUNT(*) FROM materials_suppliers) AS old_ms_count,
--     (SELECT COUNT(*) FROM material_vendors) AS new_mv_count,
--     (SELECT COUNT(*) FROM external_company_orders) AS old_eco_count,
--     (SELECT COUNT(*) FROM marketplace_partner_orders) AS new_mpo_count;

-- Verify foreign keys:
-- SELECT
--     tc.table_name,
--     tc.constraint_name,
--     kcu.column_name,
--     ccu.table_name AS foreign_table_name
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--     ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage ccu
--     ON tc.constraint_name = ccu.constraint_name
-- WHERE tc.table_name IN (
--     'vendor_purchase_orders',
--     'vendor_purchase_order_lines',
--     'material_vendors',
--     'marketplace_partner_orders'
-- )
-- AND tc.constraint_type = 'FOREIGN KEY';

-- =============================================================================
-- DIMENSIONAL MODEL IMPACT
-- =============================================================================

-- These renames improve OLAP dimensional model clarity:
--
-- BEFORE (ambiguous):
-- - fact_purchase_orders (purchase from who? vendor or customer?)
-- - dim_suppliers vs vendors table (inconsistent)
--
-- AFTER (crystal clear):
-- - fact_vendor_purchase_orders (buying FROM vendors)
-- - dim_vendors (consistent terminology)
-- - fact_marketplace_partner_orders (marketplace context obvious)
--
-- Bus Matrix now has unambiguous fact table names:
-- - fact_sales_orders (selling TO customers)
-- - fact_vendor_purchase_orders (buying FROM vendors)
-- - fact_production_orders (internal manufacturing)
-- - fact_marketplace_partner_orders (partner network)
--
-- Business intelligence queries are now self-documenting:
-- - "Vendor spend analysis" uses fact_vendor_purchase_orders
-- - "Sales revenue analysis" uses fact_sales_orders
-- - "Marketplace activity" uses fact_marketplace_partner_orders

-- =============================================================================
-- NEXT STEPS (V1.0.14 CLEANUP MIGRATION)
-- =============================================================================

-- After application code deployed with new table names:
-- 1. Update any remaining foreign key references in other tables
-- 2. Drop old tables: purchase_orders, purchase_order_lines, materials_suppliers, external_company_orders
-- 3. Verify no broken queries in application logs
-- 4. Update GraphQL schemas and resolvers
-- 5. Update documentation

-- =============================================================================
-- GRAPHQL SCHEMA UPDATES REQUIRED
-- =============================================================================

-- Files to update:
-- 1. src/graphql/schema/sales-materials.graphql
--    - type PurchaseOrder → VendorPurchaseOrder
--    - type PurchaseOrderLine → VendorPurchaseOrderLine
--    - type MaterialSupplier → MaterialVendor
--
-- 2. src/graphql/resolvers/sales-materials.resolver.ts
--    - Update query names: purchaseOrders → vendorPurchaseOrders
--    - Update table references in SQL queries
--
-- 3. src/graphql/schema/quality-hr-iot-security-marketplace-imposition.graphql
--    - type ExternalCompanyOrder → MarketplacePartnerOrder
--
-- 4. src/graphql/resolvers/quality-hr-iot-security-marketplace-imposition.resolver.ts
--    - Update query names and table references

-- =============================================================================
-- TERMINOLOGY STANDARD (for all future development)
-- =============================================================================

-- ✅ USE "VENDOR" (not "supplier"):
--    - vendors (table)
--    - vendor_purchase_orders (buying FROM vendors)
--    - vendor_contracts (agreements with vendors)
--    - vendor_performance (vendor metrics)
--    - material_vendors (junction: which vendors supply materials)
--
-- ✅ USE "CUSTOMER" (not "client" or "buyer"):
--    - customers (table)
--    - sales_orders (selling TO customers)
--    - customer_pricing (pricing for customers)
--    - customer_products (customer-specific product configs)
--
-- ✅ USE "MARKETPLACE PARTNER" (not "external company"):
--    - partner_network_profiles (marketplace partners)
--    - marketplace_partner_orders (orders through partner network)
--    - marketplace_job_postings (jobs posted to network)
--    - marketplace_bids (bids from partners)

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
-- Status: New tables created, data copied, ready for code deployment
-- Next: Deploy application code using new table names
-- Then: Run V1.0.14 to drop old tables
-- =============================================================================
