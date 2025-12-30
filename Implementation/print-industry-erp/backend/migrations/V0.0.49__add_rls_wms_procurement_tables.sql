/**
 * RLS Deployment - WMS & Procurement Tables
 * REQ-STRATEGIC-AUTO-1767066329944: GraphQL Authorization & Tenant Isolation
 *
 * High Priority (P1): Enable Row-Level Security on warehouse and procurement data
 *
 * WMS Tables:
 * - inventory_locations (warehouse locations/bins)
 * - lots (batch/lot tracking)
 * - inventory_transactions (movements)
 * - inventory_reservations (allocations)
 * - wave_processing, wave_lines (wave picking)
 * - pick_lists (picking tasks)
 * - shipments, shipment_lines (shipping)
 * - tracking_events (shipment tracking)
 * - kit_definitions, kit_components (kitting)
 *
 * Procurement Tables:
 * - purchase_orders (POs)
 * - purchase_order_lines (PO line items)
 * - purchase_requisitions (purchase requests)
 * - vendor_purchase_orders (vendor-specific POs)
 */

-- =====================================================
-- ENABLE ROW-LEVEL SECURITY - WMS
-- =====================================================

ALTER TABLE inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wave_processing ENABLE ROW LEVEL SECURITY;
ALTER TABLE wave_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_components ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ENABLE ROW-LEVEL SECURITY - PROCUREMENT
-- =====================================================

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_purchase_orders ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES - WMS
-- =====================================================

CREATE POLICY inventory_locations_tenant_isolation ON inventory_locations
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY lots_tenant_isolation ON lots
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY inventory_transactions_tenant_isolation ON inventory_transactions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY inventory_reservations_tenant_isolation ON inventory_reservations
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY wave_processing_tenant_isolation ON wave_processing
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY wave_lines_tenant_isolation ON wave_lines
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM wave_processing wp
      WHERE wp.id = wave_lines.wave_id
        AND wp.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wave_processing wp
      WHERE wp.id = wave_lines.wave_id
        AND wp.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  );

CREATE POLICY pick_lists_tenant_isolation ON pick_lists
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY shipments_tenant_isolation ON shipments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY shipment_lines_tenant_isolation ON shipment_lines
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_lines.shipment_id
        AND s.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = shipment_lines.shipment_id
        AND s.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  );

CREATE POLICY tracking_events_tenant_isolation ON tracking_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = tracking_events.shipment_id
        AND s.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = tracking_events.shipment_id
        AND s.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  );

CREATE POLICY kit_definitions_tenant_isolation ON kit_definitions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY kit_components_tenant_isolation ON kit_components
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM kit_definitions kd
      WHERE kd.id = kit_components.kit_id
        AND kd.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kit_definitions kd
      WHERE kd.id = kit_components.kit_id
        AND kd.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  );

-- =====================================================
-- CREATE RLS POLICIES - PROCUREMENT
-- =====================================================

CREATE POLICY purchase_orders_tenant_isolation ON purchase_orders
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY purchase_order_lines_tenant_isolation ON purchase_order_lines
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_lines.purchase_order_id
        AND po.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_lines.purchase_order_id
        AND po.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  );

CREATE POLICY purchase_requisitions_tenant_isolation ON purchase_requisitions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY vendor_purchase_orders_tenant_isolation ON vendor_purchase_orders
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- =====================================================
-- ADD COMMENTS
-- =====================================================

COMMENT ON POLICY inventory_locations_tenant_isolation ON inventory_locations IS
  'RLS: Warehouse location isolation (REQ-STRATEGIC-AUTO-1767066329944)';
COMMENT ON POLICY lots_tenant_isolation ON lots IS
  'RLS: Lot/batch tracking isolation (REQ-STRATEGIC-AUTO-1767066329944)';
COMMENT ON POLICY inventory_transactions_tenant_isolation ON inventory_transactions IS
  'RLS: Inventory movement isolation (REQ-STRATEGIC-AUTO-1767066329944)';
COMMENT ON POLICY purchase_orders_tenant_isolation ON purchase_orders IS
  'RLS: Purchase order isolation (REQ-STRATEGIC-AUTO-1767066329944)';

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'inventory_locations', 'lots', 'inventory_transactions', 'inventory_reservations',
      'wave_processing', 'wave_lines', 'pick_lists', 'shipments', 'shipment_lines',
      'tracking_events', 'kit_definitions', 'kit_components',
      'purchase_orders', 'purchase_order_lines', 'purchase_requisitions', 'vendor_purchase_orders'
    )
    AND rowsecurity = true;

  IF table_count != 16 THEN
    RAISE EXCEPTION 'RLS verification failed: Expected 16 tables with RLS enabled, got %', table_count;
  END IF;

  RAISE NOTICE 'RLS verification passed: All 16 WMS/procurement tables have RLS enabled';
END $$;
