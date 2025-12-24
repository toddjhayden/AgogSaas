-- =====================================================
-- FLYWAY MIGRATION V1.0.11
-- =====================================================
-- Purpose: Standardize audit columns across all tables (PHASE 1 - Blue-Green Safe)
-- Pattern: Dual-write migration for zero-downtime deployment
-- Tables: 86 tables
-- Dependencies: All previous migrations
-- Created: 2025-12-17
--
-- CRITICAL - AGOG Blue-Green Rules:
-- This is a column RENAME - normally UNSAFE, using dual-write pattern
-- Phase 1 (THIS MIGRATION): Add new columns + triggers
-- Phase 2 (V1.0.12): Drop old columns after deployment
--
-- CHANGES:
-- - created_by → created_by_user_id
-- - updated_by → updated_by_user_id
-- - deleted_by → deleted_by_user_id
-- - approved_by (keep as approved_by_user_id where exists)
--
-- STRATEGY:
-- 1. Add new columns with _user_id suffix (NULLABLE initially)
-- 2. Backfill data from existing columns
-- 3. Create triggers for dual-write (both old and new columns)
-- 4. Make new columns NOT NULL after backfill
-- =====================================================

-- =====================================================
-- STEP 1: Add new audit columns to all tables
-- =====================================================

-- Core Multi-Tenant Tables
ALTER TABLE tenants
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE billing_entities
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE facilities
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE users
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

-- Operations Module Tables
ALTER TABLE work_centers
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE production_orders
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE production_runs
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE production_schedules
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE operations
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE bill_of_materials
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE kit_definitions
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE kit_components
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE maintenance_records
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE equipment_status_log
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE oee_calculations
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE capacity_planning
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE changeover_details
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

-- WMS Module Tables
ALTER TABLE inventory_locations
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE lots
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE inventory_transactions
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE inventory_reservations
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE wave_processing
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE wave_lines
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE pick_lists
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE shipments
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE shipment_lines
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE carrier_integrations
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE tracking_events
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

-- Finance Module Tables
ALTER TABLE chart_of_accounts
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE financial_periods
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE journal_entries
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE journal_entry_lines
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE gl_balances
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE invoices
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE invoice_lines
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE payments
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE cost_allocations
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE exchange_rates
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

-- Sales Module Tables
ALTER TABLE customers
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE customer_products
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE customer_pricing
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE sales_orders
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE sales_order_lines
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE quotes
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE quote_lines
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE customer_rejections
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE pricing_rules
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

-- Materials Module Tables
ALTER TABLE products
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE materials
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

-- Procurement Module Tables
ALTER TABLE vendors
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE vendor_contracts
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE materials_suppliers
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE purchase_orders
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE purchase_order_lines
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE vendor_performance
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

-- Quality Module Tables
ALTER TABLE quality_standards
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE inspection_templates
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE quality_inspections
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE quality_defects
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

-- HR Module Tables
ALTER TABLE employees
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE labor_rates
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE labor_tracking
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE timecards
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

-- IoT Module Tables
ALTER TABLE iot_devices
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE sensor_readings
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE equipment_events
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE asset_hierarchy
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

-- Security Module Tables
ALTER TABLE security_zones
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE security_access_log
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE chain_of_custody
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

-- Marketplace Module Tables
ALTER TABLE partner_network_profiles
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE marketplace_job_postings
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE marketplace_bids
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

ALTER TABLE external_company_orders
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

-- Imposition Module Tables
ALTER TABLE press_specifications
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE substrate_specifications
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE imposition_templates
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE imposition_marks
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID,
    ADD COLUMN deleted_by_user_id UUID;

ALTER TABLE layout_calculations
    ADD COLUMN created_by_user_id UUID,
    ADD COLUMN updated_by_user_id UUID;

-- =====================================================
-- STEP 2: Backfill data from old columns to new columns
-- =====================================================

-- Core Multi-Tenant Tables
UPDATE tenants SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE tenants SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE tenants SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE billing_entities SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE billing_entities SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE billing_entities SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE facilities SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE facilities SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE facilities SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE users SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE users SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE users SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

-- Operations Module Tables
UPDATE work_centers SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE work_centers SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE work_centers SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE production_orders SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE production_orders SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE production_orders SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE production_runs SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE production_runs SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE production_schedules SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE production_schedules SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE operations SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE operations SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE bill_of_materials SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE bill_of_materials SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE kit_definitions SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE kit_definitions SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE kit_components SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE kit_components SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE maintenance_records SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE maintenance_records SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE equipment_status_log SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE equipment_status_log SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE oee_calculations SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE oee_calculations SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE capacity_planning SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE capacity_planning SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE changeover_details SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE changeover_details SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

-- WMS Module Tables
UPDATE inventory_locations SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE inventory_locations SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE inventory_locations SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE lots SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE lots SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE lots SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE inventory_transactions SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE inventory_transactions SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE inventory_reservations SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE inventory_reservations SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE wave_processing SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE wave_processing SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE wave_lines SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE wave_lines SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE pick_lists SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE pick_lists SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE shipments SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE shipments SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE shipment_lines SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE shipment_lines SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE carrier_integrations SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE carrier_integrations SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE tracking_events SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE tracking_events SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

-- Finance Module Tables
UPDATE chart_of_accounts SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE chart_of_accounts SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE chart_of_accounts SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE financial_periods SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE financial_periods SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE journal_entries SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE journal_entries SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE journal_entry_lines SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE journal_entry_lines SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE gl_balances SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE gl_balances SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE invoices SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE invoices SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE invoice_lines SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE invoice_lines SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE payments SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE payments SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE cost_allocations SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE cost_allocations SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE exchange_rates SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE exchange_rates SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

-- Sales Module Tables
UPDATE customers SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE customers SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE customers SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE customer_products SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE customer_products SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE customer_products SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE customer_pricing SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE customer_pricing SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE customer_pricing SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE sales_orders SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE sales_orders SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE sales_orders SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE sales_order_lines SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE sales_order_lines SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE sales_order_lines SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE quotes SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE quotes SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE quotes SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE quote_lines SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE quote_lines SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE quote_lines SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE customer_rejections SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE customer_rejections SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE pricing_rules SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE pricing_rules SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE pricing_rules SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

-- Materials Module Tables
UPDATE products SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE products SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE products SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE materials SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE materials SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE materials SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

-- Procurement Module Tables
UPDATE vendors SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE vendors SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE vendors SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE vendor_contracts SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE vendor_contracts SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE vendor_contracts SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE materials_suppliers SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE materials_suppliers SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE materials_suppliers SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE purchase_orders SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE purchase_orders SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE purchase_orders SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE purchase_order_lines SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE purchase_order_lines SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE purchase_order_lines SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE vendor_performance SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE vendor_performance SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

-- Quality Module Tables
UPDATE quality_standards SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE quality_standards SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE quality_standards SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE inspection_templates SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE inspection_templates SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE inspection_templates SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE quality_inspections SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE quality_inspections SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE quality_defects SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE quality_defects SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

-- HR Module Tables
UPDATE employees SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE employees SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE employees SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE labor_rates SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE labor_rates SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE labor_rates SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE labor_tracking SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE labor_tracking SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE timecards SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE timecards SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

-- IoT Module Tables
UPDATE iot_devices SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE iot_devices SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE iot_devices SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE sensor_readings SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE sensor_readings SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE equipment_events SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE equipment_events SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE asset_hierarchy SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE asset_hierarchy SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE asset_hierarchy SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

-- Security Module Tables
UPDATE security_zones SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE security_zones SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE security_zones SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE security_access_log SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE security_access_log SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE chain_of_custody SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE chain_of_custody SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

-- Marketplace Module Tables
UPDATE partner_network_profiles SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE partner_network_profiles SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE partner_network_profiles SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE marketplace_job_postings SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE marketplace_job_postings SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE marketplace_job_postings SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE marketplace_bids SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE marketplace_bids SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

UPDATE external_company_orders SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE external_company_orders SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

-- Imposition Module Tables
UPDATE press_specifications SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE press_specifications SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE press_specifications SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE substrate_specifications SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE substrate_specifications SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE substrate_specifications SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE imposition_templates SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE imposition_templates SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE imposition_templates SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE imposition_marks SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE imposition_marks SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;
UPDATE imposition_marks SET deleted_by_user_id = deleted_by WHERE deleted_by IS NOT NULL;

UPDATE layout_calculations SET created_by_user_id = created_by WHERE created_by IS NOT NULL;
UPDATE layout_calculations SET updated_by_user_id = updated_by WHERE updated_by IS NOT NULL;

-- =====================================================
-- STEP 3: Create trigger function for dual-write
-- =====================================================

CREATE OR REPLACE FUNCTION sync_audit_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- On INSERT or UPDATE, sync created_by
    IF TG_OP = 'INSERT' THEN
        NEW.created_by := NEW.created_by_user_id;
        NEW.created_by_user_id := COALESCE(NEW.created_by_user_id, NEW.created_by);
    END IF;

    -- On UPDATE, sync updated_by
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_by := NEW.updated_by_user_id;
        NEW.updated_by_user_id := COALESCE(NEW.updated_by_user_id, NEW.updated_by);

        -- If soft-delete occurred, sync deleted_by
        IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
            NEW.deleted_by := NEW.deleted_by_user_id;
            NEW.deleted_by_user_id := COALESCE(NEW.deleted_by_user_id, NEW.deleted_by);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_audit_columns() IS 'Dual-write trigger: keeps old (created_by) and new (created_by_user_id) columns in sync during blue-green deployment';

-- =====================================================
-- STEP 4: Create triggers on all tables
-- =====================================================
-- Note: Creating triggers for all 86 tables

-- Core Multi-Tenant Tables
CREATE TRIGGER trg_tenants_sync_audit BEFORE INSERT OR UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_billing_entities_sync_audit BEFORE INSERT OR UPDATE ON billing_entities FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_facilities_sync_audit BEFORE INSERT OR UPDATE ON facilities FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_users_sync_audit BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();

-- Operations Module Tables
CREATE TRIGGER trg_work_centers_sync_audit BEFORE INSERT OR UPDATE ON work_centers FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_production_orders_sync_audit BEFORE INSERT OR UPDATE ON production_orders FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_production_runs_sync_audit BEFORE INSERT OR UPDATE ON production_runs FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_production_schedules_sync_audit BEFORE INSERT OR UPDATE ON production_schedules FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_operations_sync_audit BEFORE INSERT OR UPDATE ON operations FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_bill_of_materials_sync_audit BEFORE INSERT OR UPDATE ON bill_of_materials FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_kit_definitions_sync_audit BEFORE INSERT OR UPDATE ON kit_definitions FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_kit_components_sync_audit BEFORE INSERT OR UPDATE ON kit_components FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_maintenance_records_sync_audit BEFORE INSERT OR UPDATE ON maintenance_records FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_equipment_status_log_sync_audit BEFORE INSERT OR UPDATE ON equipment_status_log FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_oee_calculations_sync_audit BEFORE INSERT OR UPDATE ON oee_calculations FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_capacity_planning_sync_audit BEFORE INSERT OR UPDATE ON capacity_planning FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_changeover_details_sync_audit BEFORE INSERT OR UPDATE ON changeover_details FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();

-- WMS Module Tables
CREATE TRIGGER trg_inventory_locations_sync_audit BEFORE INSERT OR UPDATE ON inventory_locations FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_lots_sync_audit BEFORE INSERT OR UPDATE ON lots FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_inventory_transactions_sync_audit BEFORE INSERT OR UPDATE ON inventory_transactions FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_inventory_reservations_sync_audit BEFORE INSERT OR UPDATE ON inventory_reservations FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_wave_processing_sync_audit BEFORE INSERT OR UPDATE ON wave_processing FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_wave_lines_sync_audit BEFORE INSERT OR UPDATE ON wave_lines FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_pick_lists_sync_audit BEFORE INSERT OR UPDATE ON pick_lists FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_shipments_sync_audit BEFORE INSERT OR UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_shipment_lines_sync_audit BEFORE INSERT OR UPDATE ON shipment_lines FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_carrier_integrations_sync_audit BEFORE INSERT OR UPDATE ON carrier_integrations FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_tracking_events_sync_audit BEFORE INSERT OR UPDATE ON tracking_events FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();

-- Finance Module Tables
CREATE TRIGGER trg_chart_of_accounts_sync_audit BEFORE INSERT OR UPDATE ON chart_of_accounts FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_financial_periods_sync_audit BEFORE INSERT OR UPDATE ON financial_periods FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_journal_entries_sync_audit BEFORE INSERT OR UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_journal_entry_lines_sync_audit BEFORE INSERT OR UPDATE ON journal_entry_lines FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_gl_balances_sync_audit BEFORE INSERT OR UPDATE ON gl_balances FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_invoices_sync_audit BEFORE INSERT OR UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_invoice_lines_sync_audit BEFORE INSERT OR UPDATE ON invoice_lines FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_payments_sync_audit BEFORE INSERT OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_cost_allocations_sync_audit BEFORE INSERT OR UPDATE ON cost_allocations FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_exchange_rates_sync_audit BEFORE INSERT OR UPDATE ON exchange_rates FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();

-- Sales Module Tables
CREATE TRIGGER trg_customers_sync_audit BEFORE INSERT OR UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_customer_products_sync_audit BEFORE INSERT OR UPDATE ON customer_products FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_customer_pricing_sync_audit BEFORE INSERT OR UPDATE ON customer_pricing FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_sales_orders_sync_audit BEFORE INSERT OR UPDATE ON sales_orders FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_sales_order_lines_sync_audit BEFORE INSERT OR UPDATE ON sales_order_lines FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_quotes_sync_audit BEFORE INSERT OR UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_quote_lines_sync_audit BEFORE INSERT OR UPDATE ON quote_lines FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_customer_rejections_sync_audit BEFORE INSERT OR UPDATE ON customer_rejections FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_pricing_rules_sync_audit BEFORE INSERT OR UPDATE ON pricing_rules FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();

-- Materials Module Tables
CREATE TRIGGER trg_products_sync_audit BEFORE INSERT OR UPDATE ON products FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_materials_sync_audit BEFORE INSERT OR UPDATE ON materials FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();

-- Procurement Module Tables
CREATE TRIGGER trg_vendors_sync_audit BEFORE INSERT OR UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_vendor_contracts_sync_audit BEFORE INSERT OR UPDATE ON vendor_contracts FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_materials_suppliers_sync_audit BEFORE INSERT OR UPDATE ON materials_suppliers FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_purchase_orders_sync_audit BEFORE INSERT OR UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_purchase_order_lines_sync_audit BEFORE INSERT OR UPDATE ON purchase_order_lines FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_vendor_performance_sync_audit BEFORE INSERT OR UPDATE ON vendor_performance FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();

-- Quality Module Tables
CREATE TRIGGER trg_quality_standards_sync_audit BEFORE INSERT OR UPDATE ON quality_standards FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_inspection_templates_sync_audit BEFORE INSERT OR UPDATE ON inspection_templates FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_quality_inspections_sync_audit BEFORE INSERT OR UPDATE ON quality_inspections FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_quality_defects_sync_audit BEFORE INSERT OR UPDATE ON quality_defects FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();

-- HR Module Tables
CREATE TRIGGER trg_employees_sync_audit BEFORE INSERT OR UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_labor_rates_sync_audit BEFORE INSERT OR UPDATE ON labor_rates FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_labor_tracking_sync_audit BEFORE INSERT OR UPDATE ON labor_tracking FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_timecards_sync_audit BEFORE INSERT OR UPDATE ON timecards FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();

-- IoT Module Tables
CREATE TRIGGER trg_iot_devices_sync_audit BEFORE INSERT OR UPDATE ON iot_devices FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_sensor_readings_sync_audit BEFORE INSERT OR UPDATE ON sensor_readings FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_equipment_events_sync_audit BEFORE INSERT OR UPDATE ON equipment_events FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_asset_hierarchy_sync_audit BEFORE INSERT OR UPDATE ON asset_hierarchy FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();

-- Security Module Tables
CREATE TRIGGER trg_security_zones_sync_audit BEFORE INSERT OR UPDATE ON security_zones FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_security_access_log_sync_audit BEFORE INSERT OR UPDATE ON security_access_log FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_chain_of_custody_sync_audit BEFORE INSERT OR UPDATE ON chain_of_custody FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();

-- Marketplace Module Tables
CREATE TRIGGER trg_partner_network_profiles_sync_audit BEFORE INSERT OR UPDATE ON partner_network_profiles FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_marketplace_job_postings_sync_audit BEFORE INSERT OR UPDATE ON marketplace_job_postings FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_marketplace_bids_sync_audit BEFORE INSERT OR UPDATE ON marketplace_bids FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_external_company_orders_sync_audit BEFORE INSERT OR UPDATE ON external_company_orders FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();

-- Imposition Module Tables
CREATE TRIGGER trg_press_specifications_sync_audit BEFORE INSERT OR UPDATE ON press_specifications FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_substrate_specifications_sync_audit BEFORE INSERT OR UPDATE ON substrate_specifications FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_imposition_templates_sync_audit BEFORE INSERT OR UPDATE ON imposition_templates FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_imposition_marks_sync_audit BEFORE INSERT OR UPDATE ON imposition_marks FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();
CREATE TRIGGER trg_layout_calculations_sync_audit BEFORE INSERT OR UPDATE ON layout_calculations FOR EACH ROW EXECUTE FUNCTION sync_audit_columns();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify backfill completed successfully
DO $$
DECLARE
    v_table_name TEXT;
    v_old_count INTEGER;
    v_new_count INTEGER;
    v_mismatch_count INTEGER;
BEGIN
    RAISE NOTICE '=== AUDIT COLUMN BACKFILL VERIFICATION ===';

    FOR v_table_name IN
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'created_by_user_id'
        ORDER BY table_name
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I WHERE created_by IS NOT NULL', v_table_name) INTO v_old_count;
        EXECUTE format('SELECT COUNT(*) FROM %I WHERE created_by_user_id IS NOT NULL', v_table_name) INTO v_new_count;
        EXECUTE format('SELECT COUNT(*) FROM %I WHERE created_by IS NOT NULL AND created_by != created_by_user_id', v_table_name) INTO v_mismatch_count;

        IF v_mismatch_count > 0 THEN
            RAISE WARNING 'Table %: % mismatches found!', v_table_name, v_mismatch_count;
        ELSE
            RAISE NOTICE 'Table %: OK (old=%, new=%)', v_table_name, v_old_count, v_new_count;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Next Steps:
-- 1. Deploy this migration to Green environment
-- 2. Update GraphQL schemas to include both old and new fields (old deprecated)
-- 3. Update resolvers to write to both columns
-- 4. Monitor for 24-48 hours
-- 5. Run V1.0.12 to drop old columns
-- =====================================================
