-- =====================================================
-- AGOGSAAS MASTER TABLE INDEX
-- =====================================================
-- Complete list of all 86 tables in dependency order
-- Created: 2025-12-16
-- Author: Roy (Backend Architect)
-- =====================================================

-- =====================================================
-- LAYER 0: EXTENSIONS (Already created in V1.0.0)
-- =====================================================
-- uuid-ossp
-- pgcrypto
-- vector (for Phase 4 memory system)
-- uuid_generate_v7() function

-- =====================================================
-- LAYER 1: MONITORING TABLES (Already created in V1.0.1)
-- =====================================================
-- system_errors
-- health_history
-- memories (Layer 4 memory system)

-- =====================================================
-- LAYER 2: CORE MULTI-TENANT (No dependencies)
-- =====================================================
-- 1. currencies (no dependencies)
-- 2. tenants (no dependencies)
-- 3. billing_entities (depends on: tenants)
-- 4. facilities (depends on: tenants)
-- 5. users (depends on: tenants, facilities)

-- =====================================================
-- LAYER 3: OPERATIONS FOUNDATION
-- =====================================================
-- 6. work_centers (depends on: tenants, facilities)
-- 7. operations (depends on: tenants, work_centers)
-- 8. asset_hierarchy (depends on: tenants, work_centers)

-- =====================================================
-- LAYER 4: MATERIALS & PRODUCTS
-- =====================================================
-- 9. materials (depends on: tenants)
-- 10. products (depends on: tenants, materials)
-- 11. bill_of_materials (depends on: tenants, products, materials, operations)

-- =====================================================
-- LAYER 5: WAREHOUSE MANAGEMENT
-- =====================================================
-- 12. inventory_locations (depends on: tenants, facilities)
-- 13. lots (depends on: tenants, facilities, inventory_locations)
-- 14. inventory_transactions (depends on: tenants, facilities, inventory_locations, users)
-- 15. inventory_reservations (depends on: tenants, facilities, inventory_locations)
-- 16. kit_definitions (depends on: tenants)
-- 17. kit_components (depends on: tenants, kit_definitions)

-- =====================================================
-- LAYER 6: PROCUREMENT
-- =====================================================
-- 18. vendors (depends on: tenants, users)
-- 19. materials_suppliers (depends on: tenants, materials, vendors)
-- 20. vendor_contracts (depends on: tenants, vendors)
-- 21. vendor_performance (depends on: tenants, vendors)
-- 22. purchase_orders (depends on: tenants, facilities, vendors, billing_entities, users, journal_entries)
-- 23. purchase_order_lines (depends on: tenants, purchase_orders, materials, chart_of_accounts)

-- =====================================================
-- LAYER 7: SALES & CUSTOMERS
-- =====================================================
-- 24. customers (depends on: tenants, users)
-- 25. customer_products (depends on: tenants, customers, products)
-- 26. customer_pricing (depends on: tenants, customers, products)
-- 27. pricing_rules (depends on: tenants)
-- 28. quotes (depends on: tenants, facilities, customers, users)
-- 29. quote_lines (depends on: tenants, quotes, products)
-- 30. sales_orders (depends on: tenants, facilities, customers, users, quotes)
-- 31. sales_order_lines (depends on: tenants, sales_orders, products)

-- =====================================================
-- LAYER 8: PRODUCTION
-- =====================================================
-- 32. production_orders (depends on: tenants, facilities, sales_orders)
-- 33. production_runs (depends on: tenants, facilities, production_orders, work_centers, operations, users)
-- 34. changeover_details (depends on: tenants, facilities, work_centers, production_runs, users)
-- 35. equipment_status_log (depends on: tenants, facilities, work_centers, production_runs, users)
-- 36. maintenance_records (depends on: tenants, facilities, work_centers, users)
-- 37. oee_calculations (depends on: tenants, facilities, work_centers)
-- 38. production_schedules (depends on: tenants, facilities, production_orders, work_centers, operations, users)
-- 39. capacity_planning (depends on: tenants, facilities, work_centers)

-- =====================================================
-- LAYER 9: SHIPPING & FULFILLMENT
-- =====================================================
-- 40. carrier_integrations (depends on: tenants, facilities)
-- 41. wave_processing (depends on: tenants, facilities)
-- 42. wave_lines (depends on: tenants, wave_processing, users)
-- 43. pick_lists (depends on: tenants, facilities, wave_processing, users)
-- 44. shipments (depends on: tenants, facilities, wave_processing, carrier_integrations, users)
-- 45. shipment_lines (depends on: tenants, shipments)
-- 46. tracking_events (depends on: tenants, shipments)

-- =====================================================
-- LAYER 10: FINANCE
-- =====================================================
-- 47. financial_periods (depends on: tenants, users)
-- 48. chart_of_accounts (depends on: tenants)
-- 49. exchange_rates (depends on: tenants)
-- 50. journal_entries (depends on: tenants, facilities, financial_periods, users)
-- 51. journal_entry_lines (depends on: tenants, journal_entries, chart_of_accounts)
-- 52. gl_balances (depends on: tenants, chart_of_accounts, financial_periods)
-- 53. invoices (depends on: tenants, facilities, billing_entities, journal_entries)
-- 54. invoice_lines (depends on: tenants, invoices, chart_of_accounts)
-- 55. payments (depends on: tenants, facilities, journal_entries)
-- 56. cost_allocations (depends on: tenants, financial_periods, chart_of_accounts, journal_entries)

-- =====================================================
-- LAYER 11: QUALITY MANAGEMENT
-- =====================================================
-- 57. quality_standards (depends on: tenants, users)
-- 58. inspection_templates (depends on: tenants, products, materials, operations, users)
-- 59. quality_inspections (depends on: tenants, facilities, inspection_templates, users)
-- 60. quality_defects (depends on: tenants, quality_inspections, production_runs, users)
-- 61. customer_rejections (depends on: tenants, customers, sales_orders, shipments, invoices, users)

-- =====================================================
-- LAYER 12: HR & LABOR
-- =====================================================
-- 62. employees (depends on: tenants, users, facilities)
-- 63. labor_rates (depends on: tenants, work_centers, operations, users)
-- 64. timecards (depends on: tenants, facilities, employees, production_runs, work_centers, users)
-- 65. labor_tracking (depends on: tenants, employees, production_runs)

-- =====================================================
-- LAYER 13: IOT & SENSORS
-- =====================================================
-- 66. iot_devices (depends on: tenants, facilities, work_centers, users)
-- 67. sensor_readings (depends on: tenants, iot_devices, production_runs)
-- 68. equipment_events (depends on: tenants, work_centers, iot_devices, production_runs, users)

-- =====================================================
-- LAYER 14: SECURITY (5-TIER ZONES)
-- =====================================================
-- 69. security_zones (depends on: tenants, facilities, users)
-- 70. security_access_log (depends on: tenants, security_zones, users)
-- 71. chain_of_custody (depends on: tenants, users, inventory_locations)

-- =====================================================
-- LAYER 15: MARKETPLACE (PRINT BUYER BOARDS)
-- =====================================================
-- 72. partner_network_profiles (depends on: tenants, users)
-- 73. marketplace_job_postings (depends on: tenants, partner_network_profiles, users)
-- 74. marketplace_bids (depends on: tenants, marketplace_job_postings, partner_network_profiles, users)
-- 75. external_company_orders (depends on: tenants, partner_network_profiles, marketplace_job_postings, marketplace_bids, users)

-- =====================================================
-- LAYER 16: IMPOSITION ENGINE
-- =====================================================
-- 76. press_specifications (depends on: tenants, work_centers, users)
-- 77. substrate_specifications (depends on: tenants, materials, users)
-- 78. imposition_templates (depends on: tenants, work_centers, users)
-- 79. layout_calculations (depends on: tenants, products, work_centers)
-- 80. imposition_marks (depends on: tenants, users)

-- =====================================================
-- LAYER 17: ALREADY EXISTING TABLES (From earlier work)
-- =====================================================
-- 81. material_consumption (depends on: tenants, production_runs, materials)
-- 82. lot_genealogy (depends on: tenants, materials, products, production_runs)
-- 83. cycle_counts (depends on: tenants, facilities, materials, inventory_locations, users)
-- 84. imposition_layouts (depends on: tenants, sales_order_lines, quote_lines, products, work_centers, users)
-- 85. esko_job_specifications (depends on: tenants, sales_orders)

-- =====================================================
-- TOTAL: 86 TABLES
-- =====================================================

-- =====================================================
-- TABLE COUNT BY MODULE
-- =====================================================
-- Core Multi-Tenant: 5 tables
-- Operations: 11 tables
-- WMS: 13 tables
-- Finance: 10 tables
-- Sales: 9 tables
-- Materials: 3 tables
-- Procurement: 5 tables
-- Quality: 5 tables
-- HR: 4 tables
-- IoT: 3 tables
-- Security: 3 tables
-- Marketplace: 4 tables
-- Imposition Engine: 5 tables
-- Already Existing: 5 tables
-- Monitoring (Layer 2): 3 tables
-- =====================================================
-- TOTAL: 86 tables
-- =====================================================

-- =====================================================
-- CRITICAL DEPENDENCIES TO RESOLVE
-- =====================================================
-- 1. sales_order_lines.production_order_id → production_orders.id
-- 2. sales_order_lines.imposition_layout_id → imposition_layouts.id
-- 3. purchase_orders.journal_entry_id → journal_entries.id
-- 4. invoices.journal_entry_id → journal_entries.id
-- 5. payments.journal_entry_id → journal_entries.id
-- 6. cost_allocations.journal_entry_id → journal_entries.id

-- NOTE: All foreign key constraints are already defined in the schema files.
-- No circular dependencies exist.

-- =====================================================
-- FUTURE ENHANCEMENTS (Beyond 86 tables)
-- =====================================================
-- 1. shipping_addresses (customer multi-ship-to)
-- 2. payment_applications (invoice payment mapping)
-- 3. bank_accounts (for cash management)
-- 4. tax_jurisdictions (advanced tax management)
-- 5. customer_contacts (multiple contacts per customer)
-- 6. vendor_contacts (multiple contacts per vendor)
-- 7. routing_templates (reusable production routings)
-- 8. routing_operations (operations within routings)
-- 9. equipment_calibration_records (quality compliance)
-- 10. training_records (employee certifications)

-- =====================================================
-- END OF MASTER TABLE INDEX
-- =====================================================
