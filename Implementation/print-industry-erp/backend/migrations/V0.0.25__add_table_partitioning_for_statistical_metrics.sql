-- Migration: V0.0.25 - Add Table Partitioning for Statistical Metrics
-- Author: Marcus (Implementation Lead) + Roy (Backend Developer)
-- Requirement: REQ-STRATEGIC-AUTO-1766584106655
-- Purpose: Implement monthly partitioning for time-series tables to prevent performance degradation
-- Addresses: Sylvia Issue #7 (HIGH PRIORITY)

-- =====================================================
-- ISSUE #7 RESOLUTION: TABLE PARTITIONING
-- =====================================================
-- Problem: bin_optimization_statistical_metrics table will grow unbounded,
--          degrading query performance as data accumulates
-- Solution: Implement monthly partitioning with automatic partition creation
-- Expected Impact: Maintain query performance as data scales
-- =====================================================

-- Step 1: Create new partitioned table
-- We'll create a new partitioned table and migrate data
CREATE TABLE IF NOT EXISTS bin_optimization_statistical_metrics_partitioned (
  metric_id UUID DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,

  -- Temporal tracking
  measurement_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  measurement_period_start TIMESTAMP NOT NULL,
  measurement_period_end TIMESTAMP NOT NULL,

  -- Algorithm performance metrics
  algorithm_version VARCHAR(50) NOT NULL DEFAULT 'V2.0_ENHANCED',
  total_recommendations_generated INTEGER NOT NULL DEFAULT 0,
  recommendations_accepted INTEGER NOT NULL DEFAULT 0,
  recommendations_rejected INTEGER NOT NULL DEFAULT 0,
  acceptance_rate DECIMAL(5,4) NOT NULL DEFAULT 0,

  -- Utilization statistics
  avg_volume_utilization DECIMAL(5,2) NOT NULL,
  std_dev_volume_utilization DECIMAL(5,2),
  median_volume_utilization DECIMAL(5,2),
  p25_volume_utilization DECIMAL(5,2),
  p75_volume_utilization DECIMAL(5,2),
  p95_volume_utilization DECIMAL(5,2),

  avg_weight_utilization DECIMAL(5,2) NOT NULL,
  std_dev_weight_utilization DECIMAL(5,2),

  -- Target achievement
  locations_in_optimal_range INTEGER NOT NULL DEFAULT 0,
  locations_underutilized INTEGER NOT NULL DEFAULT 0,
  locations_overutilized INTEGER NOT NULL DEFAULT 0,
  target_achievement_rate DECIMAL(5,4),

  -- Performance improvement metrics
  avg_pick_travel_distance_reduction DECIMAL(5,2),
  avg_putaway_time_reduction DECIMAL(5,2),
  space_utilization_improvement DECIMAL(5,2),

  -- ML model statistics
  ml_model_accuracy DECIMAL(5,4),
  ml_model_precision DECIMAL(5,4),
  ml_model_recall DECIMAL(5,4),
  ml_model_f1_score DECIMAL(5,4),

  -- Confidence score statistics
  avg_confidence_score DECIMAL(4,3),
  std_dev_confidence_score DECIMAL(4,3),
  median_confidence_score DECIMAL(4,3),

  -- Sample size for statistical validity
  sample_size INTEGER NOT NULL,
  is_statistically_significant BOOLEAN DEFAULT FALSE,
  confidence_interval_95_lower DECIMAL(5,4),
  confidence_interval_95_upper DECIMAL(5,4),

  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,

  -- Primary key includes partition key
  PRIMARY KEY (metric_id, measurement_period_start),

  -- Foreign keys
  CONSTRAINT fk_stat_metrics_part_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_stat_metrics_part_facility FOREIGN KEY (facility_id)
    REFERENCES facilities(facility_id) ON DELETE CASCADE
) PARTITION BY RANGE (measurement_period_start);

-- Step 2: Create partitions for 2025
CREATE TABLE bin_optimization_statistical_metrics_2025_01
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE bin_optimization_statistical_metrics_2025_02
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE bin_optimization_statistical_metrics_2025_03
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE bin_optimization_statistical_metrics_2025_04
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE bin_optimization_statistical_metrics_2025_05
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE bin_optimization_statistical_metrics_2025_06
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE bin_optimization_statistical_metrics_2025_07
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE bin_optimization_statistical_metrics_2025_08
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE bin_optimization_statistical_metrics_2025_09
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE bin_optimization_statistical_metrics_2025_10
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE bin_optimization_statistical_metrics_2025_11
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE bin_optimization_statistical_metrics_2025_12
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Step 3: Create partitions for 2026 (for continuity)
CREATE TABLE bin_optimization_statistical_metrics_2026_01
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE bin_optimization_statistical_metrics_2026_02
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE bin_optimization_statistical_metrics_2026_03
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE bin_optimization_statistical_metrics_2026_04
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE bin_optimization_statistical_metrics_2026_05
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE bin_optimization_statistical_metrics_2026_06
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE bin_optimization_statistical_metrics_2026_07
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE bin_optimization_statistical_metrics_2026_08
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE bin_optimization_statistical_metrics_2026_09
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE bin_optimization_statistical_metrics_2026_10
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE bin_optimization_statistical_metrics_2026_11
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE bin_optimization_statistical_metrics_2026_12
  PARTITION OF bin_optimization_statistical_metrics_partitioned
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Step 4: Migrate existing data (if any)
DO $$
BEGIN
  -- Check if old table exists and has data
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'bin_optimization_statistical_metrics'
  ) THEN
    -- Insert existing data into partitioned table
    INSERT INTO bin_optimization_statistical_metrics_partitioned
    SELECT * FROM bin_optimization_statistical_metrics
    ON CONFLICT DO NOTHING;

    -- Rename old table for safety
    ALTER TABLE bin_optimization_statistical_metrics
    RENAME TO bin_optimization_statistical_metrics_old;

    RAISE NOTICE 'Migrated data from old table to partitioned table';
  END IF;
END $$;

-- Step 5: Rename new table to original name
ALTER TABLE bin_optimization_statistical_metrics_partitioned
RENAME TO bin_optimization_statistical_metrics;

-- Step 6: Recreate indexes on partitioned table
CREATE INDEX idx_stat_metrics_tenant_facility
  ON bin_optimization_statistical_metrics(tenant_id, facility_id);

CREATE INDEX idx_stat_metrics_timestamp
  ON bin_optimization_statistical_metrics(measurement_timestamp DESC);

CREATE INDEX idx_stat_metrics_period
  ON bin_optimization_statistical_metrics(measurement_period_start, measurement_period_end);

CREATE INDEX idx_stat_metrics_algorithm
  ON bin_optimization_statistical_metrics(algorithm_version, measurement_timestamp DESC);

-- Step 7: Create function for automatic partition creation
CREATE OR REPLACE FUNCTION create_statistical_metrics_partition()
RETURNS TRIGGER AS $$
DECLARE
  partition_date DATE;
  partition_name TEXT;
  start_date TEXT;
  end_date TEXT;
BEGIN
  -- Get the first day of the month for the measurement_period_start
  partition_date := DATE_TRUNC('month', NEW.measurement_period_start);

  -- Generate partition name (e.g., bin_optimization_statistical_metrics_2025_01)
  partition_name := 'bin_optimization_statistical_metrics_' ||
                    TO_CHAR(partition_date, 'YYYY_MM');

  -- Calculate partition boundaries
  start_date := TO_CHAR(partition_date, 'YYYY-MM-DD');
  end_date := TO_CHAR(partition_date + INTERVAL '1 month', 'YYYY-MM-DD');

  -- Check if partition exists, create if not
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF bin_optimization_statistical_metrics ' ||
      'FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );

    RAISE NOTICE 'Created new partition: %', partition_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger for automatic partition creation
CREATE TRIGGER trg_create_statistical_metrics_partition
BEFORE INSERT ON bin_optimization_statistical_metrics
FOR EACH ROW
EXECUTE FUNCTION create_statistical_metrics_partition();

COMMENT ON TRIGGER trg_create_statistical_metrics_partition
  ON bin_optimization_statistical_metrics IS
  'Automatically creates monthly partitions when new data is inserted';

-- Step 9: Refresh materialized view to reflect partitioned table
REFRESH MATERIALIZED VIEW CONCURRENTLY bin_optimization_statistical_summary;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT, UPDATE ON bin_optimization_statistical_metrics TO wms_application_role;
GRANT EXECUTE ON FUNCTION create_statistical_metrics_partition() TO wms_application_role;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  partition_count INTEGER;
BEGIN
  -- Verify partitioned table exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'bin_optimization_statistical_metrics'
    AND c.relkind = 'p' -- 'p' indicates partitioned table
  ) THEN
    RAISE EXCEPTION 'Partitioned table bin_optimization_statistical_metrics was not created';
  END IF;

  -- Count partitions
  SELECT COUNT(*) INTO partition_count
  FROM pg_inherits
  WHERE inhparent = 'bin_optimization_statistical_metrics'::regclass;

  IF partition_count < 12 THEN
    RAISE WARNING 'Expected at least 12 partitions, found %', partition_count;
  END IF;

  -- Verify trigger exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_create_statistical_metrics_partition'
  ) THEN
    RAISE EXCEPTION 'Trigger trg_create_statistical_metrics_partition was not created';
  END IF;

  RAISE NOTICE 'Table partitioning implemented successfully with % partitions', partition_count;
  RAISE NOTICE 'Automatic partition creation trigger installed';
  RAISE NOTICE 'Issue #7 (HIGH PRIORITY) - RESOLVED';
END $$;
