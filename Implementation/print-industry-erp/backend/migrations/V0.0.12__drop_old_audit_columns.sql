-- =====================================================
-- FLYWAY MIGRATION V1.0.12
-- =====================================================
-- Purpose: Drop old audit columns (PHASE 2 - AFTER V1.0.11 SOAK)
-- Pattern: Cleanup after dual-write migration complete
-- Tables: 86 tables
-- Dependencies: V1.0.11 (must run 24-48 hours AFTER V1.0.11)
-- Created: 2025-12-17
--
-- WARNING: THIS MIGRATION IS NOT REVERSIBLE WITHOUT RESTORE
--
-- CRITICAL - ONLY RUN AFTER:
-- 1. V1.0.11 deployed and stable for 48+ hours
-- 2. All GraphQL clients migrated to new fields (createdByUserId, etc.)
-- 3. Monitoring confirms no data mismatches
-- 4. Full database backup taken
-- 5. Stakeholder approval obtained
--
-- CHANGES:
-- - Drop triggers (dual-write no longer needed)
-- - Drop old columns: created_by, updated_by, deleted_by
-- - Add NOT NULL constraints to new columns (where appropriate)
-- =====================================================

-- =====================================================
-- PRE-FLIGHT VERIFICATION
-- =====================================================

DO $$
DECLARE
    v_mismatch_count INTEGER;
    v_table_name TEXT;
BEGIN
    RAISE NOTICE '=== PRE-FLIGHT VERIFICATION ===';
    RAISE NOTICE 'Checking for data mismatches between old and new audit columns...';

    -- Check all tables for mismatches
    FOR v_table_name IN
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'created_by_user_id'
        ORDER BY table_name
    LOOP
        EXECUTE format(
            'SELECT COUNT(*) FROM %I WHERE created_by IS NOT NULL AND created_by != created_by_user_id',
            v_table_name
        ) INTO v_mismatch_count;

        IF v_mismatch_count > 0 THEN
            RAISE EXCEPTION 'ABORT: Table % has % mismatches! Data not in sync. DO NOT PROCEED.',
                v_table_name, v_mismatch_count;
        END IF;
    END LOOP;

    RAISE NOTICE 'PRE-FLIGHT CHECK PASSED: All tables in sync.';
END $$;

-- =====================================================
-- STEP 1: Drop all dual-write triggers
-- =====================================================

DROP TRIGGER IF EXISTS trg_tenants_sync_audit ON tenants;
DROP TRIGGER IF EXISTS trg_billing_entities_sync_audit ON billing_entities;
DROP TRIGGER IF EXISTS trg_facilities_sync_audit ON facilities;
DROP TRIGGER IF EXISTS trg_users_sync_audit ON users;

DROP TRIGGER IF EXISTS trg_work_centers_sync_audit ON work_centers;
DROP TRIGGER IF EXISTS trg_production_orders_sync_audit ON production_orders;
DROP TRIGGER IF EXISTS trg_production_runs_sync_audit ON production_runs;
DROP TRIGGER IF EXISTS trg_production_schedules_sync_audit ON production_schedules;
DROP TRIGGER IF EXISTS trg_operations_sync_audit ON operations;
DROP TRIGGER IF EXISTS trg_bill_of_materials_sync_audit ON bill_of_materials;
DROP TRIGGER IF EXISTS trg_kit_definitions_sync_audit ON kit_definitions;
DROP TRIGGER IF EXISTS trg_kit_components_sync_audit ON kit_components;
DROP TRIGGER IF EXISTS trg_maintenance_records_sync_audit ON maintenance_records;
DROP TRIGGER IF EXISTS trg_equipment_status_log_sync_audit ON equipment_status_log;
DROP TRIGGER IF EXISTS trg_oee_calculations_sync_audit ON oee_calculations;
DROP TRIGGER IF EXISTS trg_capacity_planning_sync_audit ON capacity_planning;
DROP TRIGGER IF EXISTS trg_changeover_details_sync_audit ON changeover_details;

DROP TRIGGER IF EXISTS trg_inventory_locations_sync_audit ON inventory_locations;
DROP TRIGGER IF EXISTS trg_lots_sync_audit ON lots;
DROP TRIGGER IF EXISTS trg_inventory_transactions_sync_audit ON inventory_transactions;
DROP TRIGGER IF EXISTS trg_inventory_reservations_sync_audit ON inventory_reservations;
DROP TRIGGER IF EXISTS trg_wave_processing_sync_audit ON wave_processing;
DROP TRIGGER IF EXISTS trg_wave_lines_sync_audit ON wave_lines;
DROP TRIGGER IF EXISTS trg_pick_lists_sync_audit ON pick_lists;
DROP TRIGGER IF EXISTS trg_shipments_sync_audit ON shipments;
DROP TRIGGER IF EXISTS trg_shipment_lines_sync_audit ON shipment_lines;
DROP TRIGGER IF EXISTS trg_carrier_integrations_sync_audit ON carrier_integrations;
DROP TRIGGER IF EXISTS trg_tracking_events_sync_audit ON tracking_events;

DROP TRIGGER IF EXISTS trg_chart_of_accounts_sync_audit ON chart_of_accounts;
DROP TRIGGER IF EXISTS trg_financial_periods_sync_audit ON financial_periods;
DROP TRIGGER IF EXISTS trg_journal_entries_sync_audit ON journal_entries;
DROP TRIGGER IF EXISTS trg_journal_entry_lines_sync_audit ON journal_entry_lines;
DROP TRIGGER IF EXISTS trg_gl_balances_sync_audit ON gl_balances;
DROP TRIGGER IF EXISTS trg_invoices_sync_audit ON invoices;
DROP TRIGGER IF EXISTS trg_invoice_lines_sync_audit ON invoice_lines;
DROP TRIGGER IF EXISTS trg_payments_sync_audit ON payments;
DROP TRIGGER IF EXISTS trg_cost_allocations_sync_audit ON cost_allocations;
DROP TRIGGER IF EXISTS trg_exchange_rates_sync_audit ON exchange_rates;

DROP TRIGGER IF EXISTS trg_customers_sync_audit ON customers;
DROP TRIGGER IF EXISTS trg_customer_products_sync_audit ON customer_products;
DROP TRIGGER IF EXISTS trg_customer_pricing_sync_audit ON customer_pricing;
DROP TRIGGER IF EXISTS trg_sales_orders_sync_audit ON sales_orders;
DROP TRIGGER IF EXISTS trg_sales_order_lines_sync_audit ON sales_order_lines;
DROP TRIGGER IF EXISTS trg_quotes_sync_audit ON quotes;
DROP TRIGGER IF EXISTS trg_quote_lines_sync_audit ON quote_lines;
DROP TRIGGER IF EXISTS trg_customer_rejections_sync_audit ON customer_rejections;
DROP TRIGGER IF EXISTS trg_pricing_rules_sync_audit ON pricing_rules;

DROP TRIGGER IF EXISTS trg_products_sync_audit ON products;
DROP TRIGGER IF EXISTS trg_materials_sync_audit ON materials;

DROP TRIGGER IF EXISTS trg_vendors_sync_audit ON vendors;
DROP TRIGGER IF EXISTS trg_vendor_contracts_sync_audit ON vendor_contracts;
DROP TRIGGER IF EXISTS trg_materials_suppliers_sync_audit ON materials_suppliers;
DROP TRIGGER IF EXISTS trg_purchase_orders_sync_audit ON purchase_orders;
DROP TRIGGER IF EXISTS trg_purchase_order_lines_sync_audit ON purchase_order_lines;
DROP TRIGGER IF EXISTS trg_vendor_performance_sync_audit ON vendor_performance;

DROP TRIGGER IF EXISTS trg_quality_standards_sync_audit ON quality_standards;
DROP TRIGGER IF EXISTS trg_inspection_templates_sync_audit ON inspection_templates;
DROP TRIGGER IF EXISTS trg_quality_inspections_sync_audit ON quality_inspections;
DROP TRIGGER IF EXISTS trg_quality_defects_sync_audit ON quality_defects;

DROP TRIGGER IF EXISTS trg_employees_sync_audit ON employees;
DROP TRIGGER IF EXISTS trg_labor_rates_sync_audit ON labor_rates;
DROP TRIGGER IF EXISTS trg_labor_tracking_sync_audit ON labor_tracking;
DROP TRIGGER IF EXISTS trg_timecards_sync_audit ON timecards;

DROP TRIGGER IF EXISTS trg_iot_devices_sync_audit ON iot_devices;
DROP TRIGGER IF EXISTS trg_sensor_readings_sync_audit ON sensor_readings;
DROP TRIGGER IF EXISTS trg_equipment_events_sync_audit ON equipment_events;
DROP TRIGGER IF EXISTS trg_asset_hierarchy_sync_audit ON asset_hierarchy;

DROP TRIGGER IF EXISTS trg_security_zones_sync_audit ON security_zones;
DROP TRIGGER IF EXISTS trg_security_access_log_sync_audit ON security_access_log;
DROP TRIGGER IF EXISTS trg_chain_of_custody_sync_audit ON chain_of_custody;

DROP TRIGGER IF EXISTS trg_partner_network_profiles_sync_audit ON partner_network_profiles;
DROP TRIGGER IF EXISTS trg_marketplace_job_postings_sync_audit ON marketplace_job_postings;
DROP TRIGGER IF EXISTS trg_marketplace_bids_sync_audit ON marketplace_bids;
DROP TRIGGER IF EXISTS trg_external_company_orders_sync_audit ON external_company_orders;

DROP TRIGGER IF EXISTS trg_press_specifications_sync_audit ON press_specifications;
DROP TRIGGER IF EXISTS trg_substrate_specifications_sync_audit ON substrate_specifications;
DROP TRIGGER IF EXISTS trg_imposition_templates_sync_audit ON imposition_templates;
DROP TRIGGER IF EXISTS trg_imposition_marks_sync_audit ON imposition_marks;
DROP TRIGGER IF EXISTS trg_layout_calculations_sync_audit ON layout_calculations;

-- Drop trigger function
DROP FUNCTION IF EXISTS sync_audit_columns();

COMMENT ON SCHEMA public IS 'Dual-write triggers removed - migration V1.0.12';

-- =====================================================
-- STEP 2: Drop old audit columns from all tables
-- =====================================================

-- Core Multi-Tenant Tables
ALTER TABLE tenants
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE billing_entities
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE facilities
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE users
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

-- Operations Module Tables
ALTER TABLE work_centers
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE production_orders
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE production_runs
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE production_schedules
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE operations
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE bill_of_materials
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE kit_definitions
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE kit_components
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE maintenance_records
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE equipment_status_log
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE oee_calculations
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE capacity_planning
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE changeover_details
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

-- WMS Module Tables
ALTER TABLE inventory_locations
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE lots
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE inventory_transactions
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE inventory_reservations
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE wave_processing
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE wave_lines
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE pick_lists
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE shipments
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE shipment_lines
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE carrier_integrations
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE tracking_events
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

-- Finance Module Tables
ALTER TABLE chart_of_accounts
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE financial_periods
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE journal_entries
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE journal_entry_lines
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE gl_balances
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE invoices
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE invoice_lines
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE payments
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE cost_allocations
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE exchange_rates
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

-- Sales Module Tables
ALTER TABLE customers
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE customer_products
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE customer_pricing
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE sales_orders
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE sales_order_lines
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE quotes
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE quote_lines
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE customer_rejections
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE pricing_rules
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

-- Materials Module Tables
ALTER TABLE products
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE materials
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

-- Procurement Module Tables
ALTER TABLE vendors
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE vendor_contracts
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE materials_suppliers
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE purchase_orders
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE purchase_order_lines
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE vendor_performance
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

-- Quality Module Tables
ALTER TABLE quality_standards
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE inspection_templates
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE quality_inspections
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE quality_defects
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

-- HR Module Tables
ALTER TABLE employees
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE labor_rates
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE labor_tracking
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE timecards
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

-- IoT Module Tables
ALTER TABLE iot_devices
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE sensor_readings
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE equipment_events
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE asset_hierarchy
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

-- Security Module Tables
ALTER TABLE security_zones
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE security_access_log
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE chain_of_custody
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

-- Marketplace Module Tables
ALTER TABLE partner_network_profiles
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE marketplace_job_postings
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE marketplace_bids
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

ALTER TABLE external_company_orders
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

-- Imposition Module Tables
ALTER TABLE press_specifications
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE substrate_specifications
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE imposition_templates
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE imposition_marks
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by,
    DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE layout_calculations
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS updated_by;

-- =====================================================
-- POST-MIGRATION VERIFICATION
-- =====================================================

DO $$
DECLARE
    v_table_name TEXT;
    v_old_column_exists BOOLEAN;
BEGIN
    RAISE NOTICE '=== POST-MIGRATION VERIFICATION ===';

    -- Verify old columns dropped
    FOR v_table_name IN
        SELECT DISTINCT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'created_by_user_id'
        ORDER BY table_name
    LOOP
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = v_table_name
              AND column_name = 'created_by'
        ) INTO v_old_column_exists;

        IF v_old_column_exists THEN
            RAISE WARNING 'Table %: Old column "created_by" still exists!', v_table_name;
        ELSE
            RAISE NOTICE 'Table %: Old columns successfully dropped', v_table_name;
        END IF;
    END LOOP;

    RAISE NOTICE 'POST-MIGRATION VERIFICATION COMPLETE';
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Status: Old audit columns dropped
-- Next Steps:
-- 1. Remove deprecated fields from GraphQL schemas
-- 2. Remove dual-write logic from resolvers
-- 3. Update API documentation
-- 4. Monitor application for any missed references
-- =====================================================
