-- ==================================================
-- P2 FORECASTING TEST DATA SETUP
-- ==================================================
-- This script creates test data for P2 Inventory Forecasting API testing
-- It creates 3 test materials with different demand patterns:
-- 1. MAT-FCST-001: Stable demand (Moving Average)
-- 2. MAT-FCST-002: Trending demand (Exponential Smoothing)
-- 3. MAT-FCST-003: Seasonal demand (Holt-Winters)

-- 1. Create test tenant
INSERT INTO tenants (id, tenant_code, tenant_name, is_active)
VALUES ('test-forecast-001', 'FCST001', 'Forecasting Test Tenant', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create test facility
INSERT INTO facilities (id, tenant_id, facility_code, facility_name, facility_type, time_zone, is_active)
VALUES (
  'facility-forecast-001',
  'test-forecast-001',
  'FCST-FAC001',
  'Forecasting Test Facility',
  'MANUFACTURING',
  'America/New_York',
  true
)
ON CONFLICT (id) DO NOTHING;

-- 3. Create test materials (3 items for testing different algorithms)
INSERT INTO materials (
  id, tenant_id, material_code, material_name, material_type,
  primary_uom, costing_method, is_lot_tracked, is_serialized,
  requires_inspection, fda_compliant, food_contact_approved, fsc_certified,
  is_active, is_purchasable, is_sellable, is_manufacturable,
  effective_from_date, is_current_version
)
VALUES
  (
    'material-fcst-001', 'test-forecast-001', 'MAT-FCST-001',
    'Test Material - Moving Average', 'RAW_MATERIAL',
    'EA', 'FIFO', false, false,
    false, false, false, false,
    true, true, false, false,
    CURRENT_DATE, true
  ),
  (
    'material-fcst-002', 'test-forecast-001', 'MAT-FCST-002',
    'Test Material - Exponential Smoothing', 'RAW_MATERIAL',
    'EA', 'FIFO', false, false,
    false, false, false, false,
    true, true, false, false,
    CURRENT_DATE, true
  ),
  (
    'material-fcst-003', 'test-forecast-001', 'MAT-FCST-003',
    'Test Material - Holt-Winters', 'RAW_MATERIAL',
    'EA', 'FIFO', false, false,
    false, false, false, false,
    true, true, false, false,
    CURRENT_DATE, true
  )
ON CONFLICT (id) DO NOTHING;

-- 4. Create 90 days of demand history for MAT-FCST-001 (Moving Average)
-- Pattern: Stable demand around 100 units with small variance
INSERT INTO demand_history (
  id, tenant_id, facility_id, material_id,
  demand_date, year, month, week_of_year, day_of_week, quarter,
  is_holiday, is_promotional_period,
  actual_demand_quantity, demand_uom,
  sales_order_demand, production_order_demand, transfer_order_demand, scrap_adjustment,
  marketing_campaign_active,
  created_at
)
SELECT
  uuid_generate_v7(),
  'test-forecast-001',
  'facility-forecast-001',
  'material-fcst-001',
  (CURRENT_DATE - n || ' days')::DATE,
  EXTRACT(YEAR FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
  EXTRACT(MONTH FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
  EXTRACT(WEEK FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
  EXTRACT(DOW FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
  EXTRACT(QUARTER FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
  false,
  false,
  (95 + (random() * 10))::FLOAT,  -- 95-105 units (stable)
  'EA',
  (95 + (random() * 10))::FLOAT,
  0,
  0,
  0,
  false,
  CURRENT_TIMESTAMP
FROM generate_series(1, 90) n;

-- 5. Create 90 days of demand history for MAT-FCST-002 (Exponential Smoothing)
-- Pattern: Increasing trend from 80 to 120 units
INSERT INTO demand_history (
  id, tenant_id, facility_id, material_id,
  demand_date, year, month, week_of_year, day_of_week, quarter,
  is_holiday, is_promotional_period,
  actual_demand_quantity, demand_uom,
  sales_order_demand, production_order_demand, transfer_order_demand, scrap_adjustment,
  marketing_campaign_active,
  created_at
)
SELECT
  uuid_generate_v7(),
  'test-forecast-001',
  'facility-forecast-001',
  'material-fcst-002',
  (CURRENT_DATE - n || ' days')::DATE,
  EXTRACT(YEAR FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
  EXTRACT(MONTH FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
  EXTRACT(WEEK FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
  EXTRACT(DOW FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
  EXTRACT(QUARTER FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
  false,
  false,
  (80 + ((90 - n) * 0.44) + (random() * 5))::FLOAT,  -- Increasing trend 80->120
  'EA',
  (80 + ((90 - n) * 0.44) + (random() * 5))::FLOAT,
  0,
  0,
  0,
  false,
  CURRENT_TIMESTAMP
FROM generate_series(1, 90) n;

-- 6. Create 365 days of demand history for MAT-FCST-003 (Holt-Winters - Seasonal)
-- Pattern: Seasonal pattern with peaks every 90 days
INSERT INTO demand_history (
  id, tenant_id, facility_id, material_id,
  demand_date, year, month, week_of_year, day_of_week, quarter,
  is_holiday, is_promotional_period,
  actual_demand_quantity, demand_uom,
  sales_order_demand, production_order_demand, transfer_order_demand, scrap_adjustment,
  marketing_campaign_active,
  created_at
)
SELECT
  uuid_generate_v7(),
  'test-forecast-001',
  'facility-forecast-001',
  'material-fcst-003',
  (CURRENT_DATE - n || ' days')::DATE,
  EXTRACT(YEAR FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
  EXTRACT(MONTH FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
  EXTRACT(WEEK FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
  EXTRACT(DOW FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
  EXTRACT(QUARTER FROM (CURRENT_DATE - n || ' days')::DATE)::INT,
  false,
  CASE WHEN n % 90 < 7 THEN true ELSE false END,  -- Promotional periods
  (100 + (50 * SIN((n * 3.14159 / 90))))::FLOAT,  -- Seasonal sine wave 50-150
  'EA',
  (100 + (50 * SIN((n * 3.14159 / 90))))::FLOAT,
  0,
  0,
  0,
  CASE WHEN n % 90 < 7 THEN true ELSE false END,
  CURRENT_TIMESTAMP
FROM generate_series(1, 365) n;

-- ==================================================
-- VERIFICATION QUERIES
-- ==================================================

-- Check test data created
SELECT
  m.material_code,
  m.material_name,
  COUNT(dh.id) as demand_records,
  MIN(dh.demand_date) as earliest_date,
  MAX(dh.demand_date) as latest_date,
  ROUND(AVG(dh.actual_demand_quantity)::NUMERIC, 2) as avg_demand,
  ROUND(MIN(dh.actual_demand_quantity)::NUMERIC, 2) as min_demand,
  ROUND(MAX(dh.actual_demand_quantity)::NUMERIC, 2) as max_demand
FROM materials m
LEFT JOIN demand_history dh ON m.id = dh.material_id
WHERE m.tenant_id = 'test-forecast-001'
GROUP BY m.material_code, m.material_name
ORDER BY m.material_code;
