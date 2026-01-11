-- =====================================================
-- Cost Allocation Engine Tables
-- REQ-1767541724200-2fb1a: Cost Allocation Engine for Accurate Job Profitability
-- =====================================================

-- Cost Pools: Track overhead and other cost accumulation buckets
CREATE TABLE IF NOT EXISTS cost_pools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pool_code VARCHAR(50) NOT NULL,
    pool_name VARCHAR(200) NOT NULL,
    description TEXT,
    pool_type VARCHAR(50) NOT NULL CHECK (pool_type IN ('overhead', 'equipment', 'facility', 'other')),
    cost_behavior VARCHAR(20) NOT NULL CHECK (cost_behavior IN ('fixed', 'variable', 'mixed')),
    source_account_id UUID REFERENCES chart_of_accounts(id),
    current_pool_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
    period_year INTEGER,
    period_month INTEGER CHECK (period_month BETWEEN 1 AND 12),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(100),
    UNIQUE(tenant_id, pool_code, period_year, period_month)
);

CREATE INDEX idx_cost_pools_tenant ON cost_pools(tenant_id);
CREATE INDEX idx_cost_pools_period ON cost_pools(tenant_id, period_year, period_month);
CREATE INDEX idx_cost_pools_type ON cost_pools(tenant_id, pool_type);
CREATE INDEX idx_cost_pools_active ON cost_pools(tenant_id, is_active);

-- RLS for cost_pools
ALTER TABLE cost_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY cost_pools_tenant_isolation ON cost_pools
    FOR ALL
    USING (tenant_id::TEXT = current_setting('app.current_tenant', TRUE));

-- Cost Drivers: Define how costs are allocated (machine hours, labor hours, etc.)
CREATE TABLE IF NOT EXISTS cost_drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    driver_code VARCHAR(50) NOT NULL,
    driver_name VARCHAR(200) NOT NULL,
    description TEXT,
    driver_type VARCHAR(50) NOT NULL CHECK (driver_type IN ('quantity', 'hours', 'weight', 'area', 'count', 'custom')),
    unit_of_measure VARCHAR(50) NOT NULL,
    calculation_method VARCHAR(50) NOT NULL CHECK (calculation_method IN ('direct', 'formula', 'query')),
    source_table VARCHAR(100),
    source_column VARCHAR(100),
    source_query TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(100),
    UNIQUE(tenant_id, driver_code)
);

CREATE INDEX idx_cost_drivers_tenant ON cost_drivers(tenant_id);
CREATE INDEX idx_cost_drivers_type ON cost_drivers(tenant_id, driver_type);
CREATE INDEX idx_cost_drivers_active ON cost_drivers(tenant_id, is_active);

-- RLS for cost_drivers
ALTER TABLE cost_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY cost_drivers_tenant_isolation ON cost_drivers
    FOR ALL
    USING (tenant_id::TEXT = current_setting('app.current_tenant', TRUE));

-- Allocation Rules: Define how cost pools are allocated using cost drivers
CREATE TABLE IF NOT EXISTS allocation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rule_code VARCHAR(50) NOT NULL,
    rule_name VARCHAR(200) NOT NULL,
    description TEXT,
    cost_pool_id UUID NOT NULL REFERENCES cost_pools(id),
    cost_driver_id UUID NOT NULL REFERENCES cost_drivers(id),
    allocation_method VARCHAR(50) NOT NULL CHECK (allocation_method IN ('direct', 'step_down', 'reciprocal', 'activity_based')),
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('job', 'department', 'work_center', 'product_line')),
    target_cost_category VARCHAR(50) NOT NULL CHECK (target_cost_category IN ('overhead', 'labor', 'material', 'equipment')),
    rate_type VARCHAR(50) NOT NULL CHECK (rate_type IN ('predetermined', 'actual', 'standard')),
    predetermined_rate DECIMAL(19,4),
    allocation_filters JSONB,
    allocation_priority INTEGER NOT NULL DEFAULT 0,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(100),
    UNIQUE(tenant_id, rule_code),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_allocation_rules_tenant ON allocation_rules(tenant_id);
CREATE INDEX idx_allocation_rules_pool ON allocation_rules(tenant_id, cost_pool_id);
CREATE INDEX idx_allocation_rules_driver ON allocation_rules(tenant_id, cost_driver_id);
CREATE INDEX idx_allocation_rules_effective ON allocation_rules(tenant_id, effective_from, effective_to);
CREATE INDEX idx_allocation_rules_priority ON allocation_rules(tenant_id, allocation_priority);
CREATE INDEX idx_allocation_rules_active ON allocation_rules(tenant_id, is_active);

-- RLS for allocation_rules
ALTER TABLE allocation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY allocation_rules_tenant_isolation ON allocation_rules
    FOR ALL
    USING (tenant_id::TEXT = current_setting('app.current_tenant', TRUE));

-- Driver Measurements: Track actual driver quantities per job
CREATE TABLE IF NOT EXISTS driver_measurements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id),
    cost_driver_id UUID NOT NULL REFERENCES cost_drivers(id),
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    measurement_date TIMESTAMPTZ NOT NULL,
    measured_quantity DECIMAL(19,4) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    measurement_source VARCHAR(50) NOT NULL CHECK (measurement_source IN ('manual', 'job_tracking', 'production', 'time_entry')),
    source_id UUID,
    source_reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(100)
);

CREATE INDEX idx_driver_measurements_tenant ON driver_measurements(tenant_id);
CREATE INDEX idx_driver_measurements_job ON driver_measurements(tenant_id, job_id);
CREATE INDEX idx_driver_measurements_driver ON driver_measurements(tenant_id, cost_driver_id);
CREATE INDEX idx_driver_measurements_period ON driver_measurements(tenant_id, period_year, period_month);
CREATE INDEX idx_driver_measurements_source ON driver_measurements(tenant_id, measurement_source, source_id);

-- RLS for driver_measurements
ALTER TABLE driver_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY driver_measurements_tenant_isolation ON driver_measurements
    FOR ALL
    USING (tenant_id::TEXT = current_setting('app.current_tenant', TRUE));

-- Allocation Runs: Track allocation execution batches
CREATE TABLE IF NOT EXISTS allocation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    run_number VARCHAR(100) NOT NULL,
    run_description TEXT,
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    allocation_type VARCHAR(50) NOT NULL CHECK (allocation_type IN ('DIRECT', 'STEP_DOWN', 'RECIPROCAL', 'ACTIVITY_BASED')),
    included_pools UUID[],
    included_jobs UUID[],
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    execution_duration_ms INTEGER,
    status VARCHAR(20) NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
    total_pools_processed INTEGER NOT NULL DEFAULT 0,
    total_amount_allocated DECIMAL(19,4) NOT NULL DEFAULT 0,
    total_jobs_affected INTEGER NOT NULL DEFAULT 0,
    total_allocations_created INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    error_details JSONB,
    is_reversed BOOLEAN NOT NULL DEFAULT false,
    reversed_at TIMESTAMPTZ,
    reversed_by VARCHAR(100),
    reversal_run_id UUID REFERENCES allocation_runs(id),
    created_by VARCHAR(100),
    UNIQUE(tenant_id, run_number)
);

CREATE INDEX idx_allocation_runs_tenant ON allocation_runs(tenant_id);
CREATE INDEX idx_allocation_runs_period ON allocation_runs(tenant_id, period_year, period_month);
CREATE INDEX idx_allocation_runs_status ON allocation_runs(tenant_id, status);
CREATE INDEX idx_allocation_runs_started ON allocation_runs(tenant_id, started_at);
CREATE INDEX idx_allocation_runs_reversed ON allocation_runs(tenant_id, is_reversed);

-- RLS for allocation_runs
ALTER TABLE allocation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY allocation_runs_tenant_isolation ON allocation_runs
    FOR ALL
    USING (tenant_id::TEXT = current_setting('app.current_tenant', TRUE));

-- Job Cost Allocations: Store individual allocations to jobs
CREATE TABLE IF NOT EXISTS job_cost_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    allocation_run_id UUID NOT NULL REFERENCES allocation_runs(id) ON DELETE CASCADE,
    job_cost_id UUID NOT NULL REFERENCES job_costs(id),
    job_id UUID NOT NULL REFERENCES jobs(id),
    cost_pool_id UUID NOT NULL REFERENCES cost_pools(id),
    allocation_rule_id UUID NOT NULL REFERENCES allocation_rules(id),
    cost_driver_id UUID NOT NULL REFERENCES cost_drivers(id),
    driver_quantity DECIMAL(19,4) NOT NULL,
    total_driver_quantity DECIMAL(19,4) NOT NULL,
    allocation_rate DECIMAL(19,4) NOT NULL,
    allocation_percentage DECIMAL(7,4),
    allocated_amount DECIMAL(19,4) NOT NULL,
    cost_category VARCHAR(50) NOT NULL CHECK (cost_category IN ('overhead', 'labor', 'material', 'equipment')),
    allocation_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_cost_allocations_tenant ON job_cost_allocations(tenant_id);
CREATE INDEX idx_job_cost_allocations_run ON job_cost_allocations(tenant_id, allocation_run_id);
CREATE INDEX idx_job_cost_allocations_job ON job_cost_allocations(tenant_id, job_id);
CREATE INDEX idx_job_cost_allocations_job_cost ON job_cost_allocations(tenant_id, job_cost_id);
CREATE INDEX idx_job_cost_allocations_pool ON job_cost_allocations(tenant_id, cost_pool_id);
CREATE INDEX idx_job_cost_allocations_category ON job_cost_allocations(tenant_id, cost_category);

-- RLS for job_cost_allocations
ALTER TABLE job_cost_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_cost_allocations_tenant_isolation ON job_cost_allocations
    FOR ALL
    USING (tenant_id::TEXT = current_setting('app.current_tenant', TRUE));

-- =====================================================
-- DATABASE FUNCTIONS
-- =====================================================

-- Function to calculate allocation rate
CREATE OR REPLACE FUNCTION calculate_allocation_rate(
    p_cost_pool_id UUID,
    p_cost_driver_id UUID,
    p_period_year INTEGER,
    p_period_month INTEGER
)
RETURNS DECIMAL(19,4)
LANGUAGE plpgsql
AS $$
DECLARE
    v_pool_amount DECIMAL(19,4);
    v_total_driver_quantity DECIMAL(19,4);
    v_rate DECIMAL(19,4);
BEGIN
    -- Get pool amount
    SELECT current_pool_amount INTO v_pool_amount
    FROM cost_pools
    WHERE id = p_cost_pool_id
      AND period_year = p_period_year
      AND period_month = p_period_month;

    -- Get total driver quantity for period
    SELECT COALESCE(SUM(measured_quantity), 0) INTO v_total_driver_quantity
    FROM driver_measurements
    WHERE cost_driver_id = p_cost_driver_id
      AND period_year = p_period_year
      AND period_month = p_period_month;

    -- Calculate rate (avoid division by zero)
    IF v_total_driver_quantity > 0 THEN
        v_rate := v_pool_amount / v_total_driver_quantity;
    ELSE
        v_rate := 0;
    END IF;

    RETURN v_rate;
END;
$$;

-- Function to allocate costs to a job
CREATE OR REPLACE FUNCTION allocate_costs_to_job(
    p_allocation_run_id UUID,
    p_job_id UUID,
    p_allocation_rule_id UUID,
    p_driver_quantity DECIMAL(19,4),
    p_total_driver_quantity DECIMAL(19,4),
    p_allocation_rate DECIMAL(19,4)
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_tenant_id UUID;
    v_job_cost_id UUID;
    v_cost_pool_id UUID;
    v_cost_driver_id UUID;
    v_target_cost_category VARCHAR(50);
    v_allocated_amount DECIMAL(19,4);
    v_allocation_percentage DECIMAL(7,4);
BEGIN
    -- Get rule details
    SELECT ar.tenant_id, ar.cost_pool_id, ar.cost_driver_id, ar.target_cost_category
    INTO v_tenant_id, v_cost_pool_id, v_cost_driver_id, v_target_cost_category
    FROM allocation_rules ar
    WHERE ar.id = p_allocation_rule_id;

    -- Get or create job_cost record
    SELECT id INTO v_job_cost_id
    FROM job_costs
    WHERE job_id = p_job_id
      AND tenant_id = v_tenant_id
    LIMIT 1;

    IF v_job_cost_id IS NULL THEN
        INSERT INTO job_costs (tenant_id, job_id, cost_category, total_cost)
        VALUES (v_tenant_id, p_job_id, v_target_cost_category, 0)
        RETURNING id INTO v_job_cost_id;
    END IF;

    -- Calculate allocation
    v_allocated_amount := p_driver_quantity * p_allocation_rate;

    IF p_total_driver_quantity > 0 THEN
        v_allocation_percentage := (p_driver_quantity / p_total_driver_quantity) * 100;
    ELSE
        v_allocation_percentage := 0;
    END IF;

    -- Insert allocation record
    INSERT INTO job_cost_allocations (
        tenant_id,
        allocation_run_id,
        job_cost_id,
        job_id,
        cost_pool_id,
        allocation_rule_id,
        cost_driver_id,
        driver_quantity,
        total_driver_quantity,
        allocation_rate,
        allocation_percentage,
        allocated_amount,
        cost_category
    ) VALUES (
        v_tenant_id,
        p_allocation_run_id,
        v_job_cost_id,
        p_job_id,
        v_cost_pool_id,
        p_allocation_rule_id,
        v_cost_driver_id,
        p_driver_quantity,
        p_total_driver_quantity,
        p_allocation_rate,
        v_allocation_percentage,
        v_allocated_amount,
        v_target_cost_category
    );

    -- Update job_cost total
    UPDATE job_costs
    SET total_cost = total_cost + v_allocated_amount,
        updated_at = NOW()
    WHERE id = v_job_cost_id;
END;
$$;

-- =====================================================
-- AUDIT LOGGING
-- =====================================================

COMMENT ON TABLE cost_pools IS 'REQ-1767541724200-2fb1a: Cost pools for overhead and cost accumulation';
COMMENT ON TABLE cost_drivers IS 'REQ-1767541724200-2fb1a: Cost drivers for allocation basis';
COMMENT ON TABLE allocation_rules IS 'REQ-1767541724200-2fb1a: Rules defining how costs are allocated';
COMMENT ON TABLE driver_measurements IS 'REQ-1767541724200-2fb1a: Actual measurements of cost drivers per job';
COMMENT ON TABLE allocation_runs IS 'REQ-1767541724200-2fb1a: Batch execution records for cost allocation';
COMMENT ON TABLE job_cost_allocations IS 'REQ-1767541724200-2fb1a: Individual cost allocations to jobs';
