-- Migration: V0.0.28 - Add 3D Vertical Proximity Optimization
-- Author: Roy (Backend Developer) + Marcus (Implementation Lead)
-- Requirement: REQ-STRATEGIC-AUTO-1766584106655
-- Purpose: Extend SKU affinity optimization to include vertical dimension (shelf level)
-- Addresses: Cynthia OPP-1 (HIGH PRIORITY)

-- =====================================================
-- OPP-1: 3D VERTICAL PROXIMITY OPTIMIZATION
-- =====================================================
-- Current State: 2D affinity (aisle/zone level only)
-- Enhancement: Extend to vertical dimension (shelf level)
-- Expected Impact:
-- - 5-8% pick travel reduction from fewer up/down movements
-- - Better space utilization in vertical racking systems
-- - Improved picker ergonomics and safety
-- =====================================================

-- Step 1: Add shelf level metadata to inventory_locations
ALTER TABLE inventory_locations
ADD COLUMN IF NOT EXISTS shelf_level INTEGER,
ADD COLUMN IF NOT EXISTS shelf_height_inches DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS ergonomic_zone VARCHAR(50);

-- Add constraint for ergonomic zone
ALTER TABLE inventory_locations
ADD CONSTRAINT chk_ergonomic_zone
CHECK (ergonomic_zone IN ('LOW', 'GOLDEN', 'HIGH', NULL));

-- Create index for shelf level queries
CREATE INDEX idx_inventory_locations_shelf_level
  ON inventory_locations(facility_id, zone_code, aisle_code, shelf_level)
  WHERE is_active = true;

COMMENT ON COLUMN inventory_locations.shelf_level IS
  'Vertical shelf level (1 = bottom, higher = upper). Used for 3D proximity optimization.';

COMMENT ON COLUMN inventory_locations.shelf_height_inches IS
  'Height of shelf from floor in inches. Used for ergonomic calculations.';

COMMENT ON COLUMN inventory_locations.ergonomic_zone IS
  'Ergonomic picking zone: LOW (0-30"), GOLDEN (30-60" waist-to-shoulder), HIGH (60"+ above shoulder)';

-- Step 2: Create 3D distance calculation function
CREATE OR REPLACE FUNCTION calculate_3d_location_distance(
  loc1_aisle VARCHAR(50),
  loc1_zone VARCHAR(50),
  loc1_shelf_level INTEGER,
  loc2_aisle VARCHAR(50),
  loc2_zone VARCHAR(50),
  loc2_shelf_level INTEGER,
  vertical_weight DECIMAL(4,2) DEFAULT 0.3
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  horizontal_distance DECIMAL(10,2);
  vertical_distance INTEGER;
  total_distance DECIMAL(10,2);
BEGIN
  -- Calculate horizontal distance (simplified: 0 if same aisle/zone, 1 otherwise)
  -- In production, use actual warehouse layout coordinates
  IF loc1_aisle = loc2_aisle AND loc1_zone = loc2_zone THEN
    horizontal_distance := 0;
  ELSIF loc1_aisle = loc2_aisle THEN
    horizontal_distance := 5; -- Same aisle, different zone
  ELSE
    horizontal_distance := 10; -- Different aisle
  END IF;

  -- Calculate vertical distance (shelf levels apart)
  vertical_distance := ABS(COALESCE(loc1_shelf_level, 0) - COALESCE(loc2_shelf_level, 0));

  -- Calculate 3D distance using weighted Euclidean formula
  -- Distance = sqrt(horizontal² + (vertical * weight)²)
  total_distance := SQRT(
    POWER(horizontal_distance, 2) +
    POWER(vertical_distance * vertical_weight, 2)
  );

  RETURN total_distance;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_3d_location_distance IS
  '3D distance calculation including vertical proximity for ergonomic optimization';

-- Step 3: Create materialized view for 3D SKU affinity
CREATE MATERIALIZED VIEW IF NOT EXISTS sku_affinity_3d AS
WITH co_pick_analysis AS (
  SELECT
    it1.material_id as material_a,
    it2.material_id as material_b,
    COUNT(DISTINCT it1.sales_order_id) as co_pick_count,
    -- Get typical storage locations for each material
    (SELECT mode() WITHIN GROUP (ORDER BY il.shelf_level)
     FROM inventory_balances ib
     INNER JOIN inventory_locations il ON ib.location_id = il.location_id
     WHERE ib.material_id = it1.material_id
       AND il.shelf_level IS NOT NULL
    ) as material_a_typical_shelf,
    (SELECT mode() WITHIN GROUP (ORDER BY il.shelf_level)
     FROM inventory_balances ib
     INNER JOIN inventory_locations il ON ib.location_id = il.location_id
     WHERE ib.material_id = it2.material_id
       AND il.shelf_level IS NOT NULL
    ) as material_b_typical_shelf
  FROM inventory_transactions it1
  INNER JOIN inventory_transactions it2
    ON it1.sales_order_id = it2.sales_order_id
    AND it1.material_id != it2.material_id
  WHERE it1.transaction_type = 'ISSUE'
    AND it2.transaction_type = 'ISSUE'
    AND it1.created_at >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY it1.material_id, it2.material_id
  HAVING COUNT(DISTINCT it1.sales_order_id) >= 3
)
SELECT
  material_a,
  material_b,
  co_pick_count,
  material_a_typical_shelf,
  material_b_typical_shelf,
  ABS(COALESCE(material_a_typical_shelf, 0) - COALESCE(material_b_typical_shelf, 0)) as shelf_level_difference,
  CASE
    WHEN ABS(COALESCE(material_a_typical_shelf, 0) - COALESCE(material_b_typical_shelf, 0)) = 0
      THEN 'SAME_SHELF'
    WHEN ABS(COALESCE(material_a_typical_shelf, 0) - COALESCE(material_b_typical_shelf, 0)) = 1
      THEN 'ADJACENT_SHELF'
    WHEN ABS(COALESCE(material_a_typical_shelf, 0) - COALESCE(material_b_typical_shelf, 0)) <= 2
      THEN 'NEAR_SHELF'
    ELSE 'DISTANT_SHELF'
  END as vertical_proximity_category,
  -- 3D affinity bonus: higher for materials that should be vertically close
  CASE
    WHEN co_pick_count >= 50 AND
         ABS(COALESCE(material_a_typical_shelf, 0) - COALESCE(material_b_typical_shelf, 0)) <= 1
      THEN 10.0  -- HIGH bonus for frequently co-picked, same/adjacent shelf
    WHEN co_pick_count >= 20 AND
         ABS(COALESCE(material_a_typical_shelf, 0) - COALESCE(material_b_typical_shelf, 0)) <= 2
      THEN 5.0   -- MEDIUM bonus
    WHEN co_pick_count >= 10
      THEN 2.0   -- LOW bonus for any co-picked materials
    ELSE 0.0
  END as affinity_3d_bonus,
  CURRENT_TIMESTAMP as last_updated
FROM co_pick_analysis;

CREATE UNIQUE INDEX idx_sku_affinity_3d_materials
  ON sku_affinity_3d(material_a, material_b);

CREATE INDEX idx_sku_affinity_3d_vertical_proximity
  ON sku_affinity_3d(vertical_proximity_category, co_pick_count DESC);

CREATE INDEX idx_sku_affinity_3d_bonus
  ON sku_affinity_3d(affinity_3d_bonus DESC)
  WHERE affinity_3d_bonus > 0;

COMMENT ON MATERIALIZED VIEW sku_affinity_3d IS
  '3D SKU affinity with vertical proximity optimization for ergonomic co-location';

-- Step 4: Create function to refresh 3D affinity
CREATE OR REPLACE FUNCTION refresh_sku_affinity_3d()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY sku_affinity_3d;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_sku_affinity_3d() IS
  'Refresh 3D SKU affinity view - should be run daily via cron';

-- Step 5: Create ergonomic zone classification function
CREATE OR REPLACE FUNCTION classify_ergonomic_zone(shelf_height_inches DECIMAL(6,2))
RETURNS VARCHAR(50) AS $$
BEGIN
  IF shelf_height_inches IS NULL THEN
    RETURN NULL;
  ELSIF shelf_height_inches < 30 THEN
    RETURN 'LOW';       -- Below waist (requires bending)
  ELSIF shelf_height_inches <= 60 THEN
    RETURN 'GOLDEN';    -- Waist to shoulder (optimal ergonomics)
  ELSE
    RETURN 'HIGH';      -- Above shoulder (requires reaching/ladder)
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION classify_ergonomic_zone IS
  'Classify shelf location into ergonomic zones based on height';

-- Step 6: Update existing locations with ergonomic zone (if shelf height exists)
UPDATE inventory_locations
SET ergonomic_zone = classify_ergonomic_zone(shelf_height_inches)
WHERE shelf_height_inches IS NOT NULL
  AND ergonomic_zone IS NULL;

-- Step 7: Create view for ABC classification by ergonomic zone
CREATE OR REPLACE VIEW abc_ergonomic_recommendations AS
SELECT
  m.material_id,
  m.material_code,
  m.abc_classification,
  m.annual_velocity,
  CASE
    WHEN m.abc_classification = 'A' THEN 'GOLDEN'  -- High velocity in golden zone
    WHEN m.abc_classification = 'B' AND m.weight_lbs_per_unit <= 20 THEN 'GOLDEN'  -- Medium velocity lightweight in golden zone
    WHEN m.abc_classification = 'B' AND m.weight_lbs_per_unit > 20 THEN 'LOW'      -- Medium velocity heavy items low
    WHEN m.abc_classification = 'C' AND m.weight_lbs_per_unit <= 10 THEN 'HIGH'    -- Low velocity lightweight up high
    WHEN m.abc_classification = 'C' AND m.weight_lbs_per_unit > 10 THEN 'LOW'      -- Low velocity heavy items low
    ELSE 'GOLDEN'  -- Default to golden zone
  END as recommended_ergonomic_zone,
  CASE
    WHEN m.abc_classification = 'A' THEN 'High velocity items should be in waist-to-shoulder height for fastest picking'
    WHEN m.abc_classification = 'B' AND m.weight_lbs_per_unit > 20 THEN 'Heavy items should be stored low for safety'
    WHEN m.abc_classification = 'C' AND m.weight_lbs_per_unit <= 10 THEN 'Low velocity lightweight items can be stored high to save premium space'
    ELSE 'Standard ergonomic placement'
  END as recommendation_reason
FROM materials m
WHERE m.is_active = true;

COMMENT ON VIEW abc_ergonomic_recommendations IS
  'Recommended ergonomic zone placement based on ABC classification and material weight';

-- Step 8: Create 3D optimization metrics table
CREATE TABLE IF NOT EXISTS bin_optimization_3d_metrics (
  metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,

  -- Measurement period
  measurement_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  measurement_period_start TIMESTAMP NOT NULL,
  measurement_period_end TIMESTAMP NOT NULL,

  -- Vertical travel metrics
  avg_vertical_movements_per_pick DECIMAL(6,2),
  avg_vertical_distance_inches DECIMAL(8,2),
  total_vertical_travel_feet DECIMAL(12,2),

  -- Ergonomic compliance
  a_class_in_golden_zone_pct DECIMAL(5,2), -- % of A-class materials in golden zone
  heavy_items_in_low_zone_pct DECIMAL(5,2), -- % of heavy items stored low
  ergonomic_compliance_score DECIMAL(5,2), -- Overall ergonomic score 0-100

  -- 3D affinity optimization
  co_picked_materials_on_same_shelf_pct DECIMAL(5,2),
  co_picked_materials_within_2_shelves_pct DECIMAL(5,2),
  affinity_3d_optimization_score DECIMAL(5,2), -- 0-100

  -- Performance impact
  estimated_vertical_travel_reduction_pct DECIMAL(5,2),
  estimated_picker_fatigue_reduction_pct DECIMAL(5,2),

  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  CONSTRAINT fk_3d_metrics_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_3d_metrics_facility FOREIGN KEY (facility_id)
    REFERENCES facilities(facility_id) ON DELETE CASCADE
);

CREATE INDEX idx_3d_metrics_tenant_facility
  ON bin_optimization_3d_metrics(tenant_id, facility_id);

CREATE INDEX idx_3d_metrics_timestamp
  ON bin_optimization_3d_metrics(measurement_timestamp DESC);

COMMENT ON TABLE bin_optimization_3d_metrics IS
  '3D vertical proximity optimization metrics for tracking ergonomic improvements';

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT ON sku_affinity_3d TO wms_application_role;
GRANT SELECT ON abc_ergonomic_recommendations TO wms_application_role;
GRANT SELECT, INSERT ON bin_optimization_3d_metrics TO wms_application_role;
GRANT EXECUTE ON FUNCTION calculate_3d_location_distance(VARCHAR, VARCHAR, INTEGER, VARCHAR, VARCHAR, INTEGER, DECIMAL) TO wms_application_role;
GRANT EXECUTE ON FUNCTION refresh_sku_affinity_3d() TO wms_application_role;
GRANT EXECUTE ON FUNCTION classify_ergonomic_zone(DECIMAL) TO wms_application_role;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  shelf_level_count INTEGER;
BEGIN
  -- Verify shelf_level column was added
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_locations'
      AND column_name = 'shelf_level'
  ) THEN
    RAISE EXCEPTION 'Column shelf_level was not added to inventory_locations';
  END IF;

  -- Verify ergonomic_zone column was added
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_locations'
      AND column_name = 'ergonomic_zone'
  ) THEN
    RAISE EXCEPTION 'Column ergonomic_zone was not added to inventory_locations';
  END IF;

  -- Verify 3D distance function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'calculate_3d_location_distance'
  ) THEN
    RAISE EXCEPTION 'Function calculate_3d_location_distance was not created';
  END IF;

  -- Verify 3D affinity view exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_matviews
    WHERE matviewname = 'sku_affinity_3d'
  ) THEN
    RAISE EXCEPTION 'Materialized view sku_affinity_3d was not created';
  END IF;

  -- Verify ergonomic recommendations view exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_name = 'abc_ergonomic_recommendations'
  ) THEN
    RAISE EXCEPTION 'View abc_ergonomic_recommendations was not created';
  END IF;

  -- Verify 3D metrics table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'bin_optimization_3d_metrics'
  ) THEN
    RAISE EXCEPTION 'Table bin_optimization_3d_metrics was not created';
  END IF;

  RAISE NOTICE '3D vertical proximity optimization infrastructure created successfully';
  RAISE NOTICE 'OPP-1 (HIGH PRIORITY) - IMPLEMENTED';
  RAISE NOTICE '';
  RAISE NOTICE 'NEW CAPABILITIES:';
  RAISE NOTICE '- Shelf level tracking for vertical proximity';
  RAISE NOTICE '- 3D distance calculation function';
  RAISE NOTICE '- Ergonomic zone classification (LOW/GOLDEN/HIGH)';
  RAISE NOTICE '- SKU affinity with vertical optimization';
  RAISE NOTICE '- ABC-based ergonomic recommendations';
  RAISE NOTICE '';
  RAISE NOTICE 'EXPECTED IMPACT:';
  RAISE NOTICE '- 5-8% pick travel reduction (vertical movements)';
  RAISE NOTICE '- Better space utilization in vertical racking';
  RAISE NOTICE '- Improved picker ergonomics and safety';
  RAISE NOTICE '';
  RAISE NOTICE 'ERGONOMIC ZONES:';
  RAISE NOTICE '- LOW: 0-30" (below waist - requires bending)';
  RAISE NOTICE '- GOLDEN: 30-60" (waist to shoulder - OPTIMAL)';
  RAISE NOTICE '- HIGH: 60"+ (above shoulder - requires reaching)';
  RAISE NOTICE '';
  RAISE NOTICE 'RECOMMENDED ACTIONS:';
  RAISE NOTICE '1. Populate shelf_level for all inventory_locations';
  RAISE NOTICE '2. Populate shelf_height_inches for ergonomic classification';
  RAISE NOTICE '3. Run refresh_sku_affinity_3d() daily via cron';
  RAISE NOTICE '4. Review abc_ergonomic_recommendations for placement optimization';
END $$;
