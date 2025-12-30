-- =====================================================
-- V0.0.42: CREATE JOB COSTING TABLES
-- =====================================================
-- Purpose: Job costing module for tracking actual costs vs estimates and profitability analysis
-- Dependencies: tenants, users, jobs, estimates
-- Created: 2025-12-29
-- Author: Roy (Backend Architect)
-- Requirement: REQ-STRATEGIC-AUTO-1767048328661 (Estimating & Job Costing Module)
-- =====================================================

-- =====================================================
-- TABLE: job_costs
-- =====================================================
-- Purpose: Track actual costs for jobs and compare to estimates

CREATE TABLE job_costs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    job_id UUID NOT NULL,

    -- Revenue
    total_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
    invoice_id UUID,

    -- Actual Costs
    total_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    material_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    labor_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    equipment_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    overhead_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    outsourcing_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    other_cost DECIMAL(18,4) NOT NULL DEFAULT 0,

    -- Estimates (baseline from estimating module)
    estimated_material_cost DECIMAL(18,4),
    estimated_labor_cost DECIMAL(18,4),
    estimated_equipment_cost DECIMAL(18,4),
    estimated_overhead_cost DECIMAL(18,4),
    estimated_outsourcing_cost DECIMAL(18,4),
    estimated_total_cost DECIMAL(18,4),
    estimate_id UUID,  -- Reference to source estimate

    -- Calculated Profitability Metrics (generated columns)
    gross_profit DECIMAL(18,4) GENERATED ALWAYS AS (total_amount - total_cost) STORED,
    gross_profit_margin DECIMAL(10,4) GENERATED ALWAYS AS (
        CASE WHEN total_amount > 0
        THEN ((total_amount - total_cost) / total_amount) * 100
        ELSE 0 END
    ) STORED,

    -- Variance Analysis (generated columns)
    cost_variance DECIMAL(18,4) GENERATED ALWAYS AS (
        CASE WHEN estimated_total_cost IS NOT NULL
        THEN estimated_total_cost - total_cost
        ELSE NULL END
    ) STORED,
    cost_variance_percentage DECIMAL(10,4) GENERATED ALWAYS AS (
        CASE WHEN estimated_total_cost IS NOT NULL AND estimated_total_cost > 0
        THEN ((estimated_total_cost - total_cost) / estimated_total_cost) * 100
        ELSE NULL END
    ) STORED,

    -- Material variance
    material_variance DECIMAL(18,4) GENERATED ALWAYS AS (
        CASE WHEN estimated_material_cost IS NOT NULL
        THEN estimated_material_cost - material_cost
        ELSE NULL END
    ) STORED,

    -- Labor variance
    labor_variance DECIMAL(18,4) GENERATED ALWAYS AS (
        CASE WHEN estimated_labor_cost IS NOT NULL
        THEN estimated_labor_cost - labor_cost
        ELSE NULL END
    ) STORED,

    -- Equipment variance
    equipment_variance DECIMAL(18,4) GENERATED ALWAYS AS (
        CASE WHEN estimated_equipment_cost IS NOT NULL
        THEN estimated_equipment_cost - equipment_cost
        ELSE NULL END
    ) STORED,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'estimated',
    -- estimated, in_progress, completed, reviewed, approved, closed

    -- Important dates
    costing_date DATE,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,

    -- Cost rollup tracking
    last_rollup_at TIMESTAMPTZ,
    last_rollup_source VARCHAR(50),
    -- MANUAL, PRODUCTION_ORDER, MATERIAL_CONSUMPTION, LABOR_TRACKING

    -- Reconciliation
    is_reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMPTZ,
    reconciled_by UUID,

    -- Adjustments
    adjustment_notes TEXT,
    final_adjustments JSONB,
    -- [{category: 'material', amount: 50.00, reason: 'material return credit'}, ...]

    -- Notes
    notes TEXT,
    variance_explanation TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    closed_by UUID,

    CONSTRAINT fk_job_cost_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_job_cost_job FOREIGN KEY (job_id) REFERENCES jobs(id),
    CONSTRAINT fk_job_cost_estimate FOREIGN KEY (estimate_id) REFERENCES estimates(id),
    CONSTRAINT uq_job_cost_job UNIQUE (tenant_id, job_id),
    CONSTRAINT chk_job_cost_amounts CHECK (
        total_amount >= 0 AND total_cost >= 0 AND
        material_cost >= 0 AND labor_cost >= 0 AND
        equipment_cost >= 0 AND overhead_cost >= 0 AND
        outsourcing_cost >= 0 AND other_cost >= 0
    ),
    CONSTRAINT chk_job_cost_total_matches CHECK (
        total_cost = material_cost + labor_cost + equipment_cost +
        overhead_cost + outsourcing_cost + other_cost
    )
);

CREATE INDEX idx_job_costs_tenant ON job_costs(tenant_id);
CREATE INDEX idx_job_costs_job ON job_costs(job_id);
CREATE INDEX idx_job_costs_status ON job_costs(tenant_id, status);
CREATE INDEX idx_job_costs_date ON job_costs(tenant_id, costing_date);
CREATE INDEX idx_job_costs_estimate ON job_costs(estimate_id);
CREATE INDEX idx_job_costs_in_progress ON job_costs(tenant_id, status)
    WHERE status = 'in_progress';
CREATE INDEX idx_job_costs_variance ON job_costs(tenant_id, status, costing_date)
    WHERE status IN ('completed', 'reviewed', 'approved', 'closed');
CREATE INDEX idx_job_costs_reconciled ON job_costs(tenant_id, is_reconciled)
    WHERE is_reconciled = FALSE;

COMMENT ON TABLE job_costs IS 'Actual job costs tracked for profitability and variance analysis';

-- =====================================================
-- TABLE: job_cost_updates
-- =====================================================
-- Purpose: Audit trail for job cost changes (incremental updates)

CREATE TABLE job_cost_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    job_cost_id UUID NOT NULL,

    -- Update source
    update_source VARCHAR(50) NOT NULL,
    -- production_order, material_consumption, labor_tracking, manual, adjustment
    source_id UUID,
    source_reference VARCHAR(100),

    -- Cost category affected
    cost_category VARCHAR(50) NOT NULL,
    -- material, labor, equipment, overhead, outsourcing, other

    -- Cost change
    cost_delta DECIMAL(18,4) NOT NULL,
    previous_total DECIMAL(18,4) NOT NULL,
    new_total DECIMAL(18,4) NOT NULL,

    -- Details
    quantity DECIMAL(18,4),
    unit_cost DECIMAL(18,4),
    description TEXT,

    -- Metadata
    update_metadata JSONB,
    -- {production_order_number: 'PO-12345', material_code: 'PAPER-80#', hours: 5.5, ...}

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT fk_job_cost_update_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_job_cost_update_job_cost FOREIGN KEY (job_cost_id) REFERENCES job_costs(id) ON DELETE CASCADE
);

CREATE INDEX idx_job_cost_updates_job_cost ON job_cost_updates(job_cost_id, created_at DESC);
CREATE INDEX idx_job_cost_updates_source ON job_cost_updates(update_source, source_id);
CREATE INDEX idx_job_cost_updates_category ON job_cost_updates(job_cost_id, cost_category);
CREATE INDEX idx_job_cost_updates_tenant ON job_cost_updates(tenant_id);

COMMENT ON TABLE job_cost_updates IS 'Audit trail of incremental job cost updates';

-- =====================================================
-- MATERIALIZED VIEW: Job Cost Variance Summary
-- =====================================================
-- Purpose: Pre-aggregated variance metrics for fast reporting

CREATE MATERIALIZED VIEW job_cost_variance_summary AS
SELECT
    tenant_id,
    DATE_TRUNC('month', costing_date) AS month,
    status,
    COUNT(*) AS total_jobs,
    SUM(total_amount) AS total_revenue,
    SUM(total_cost) AS total_cost,
    SUM(gross_profit) AS total_profit,
    AVG(gross_profit_margin) AS avg_margin,
    SUM(cost_variance) AS total_variance,
    COUNT(*) FILTER (WHERE cost_variance < 0) AS jobs_over_budget,
    COUNT(*) FILTER (WHERE cost_variance > 0) AS jobs_under_budget,
    COUNT(*) FILTER (WHERE cost_variance = 0 OR cost_variance IS NULL) AS jobs_on_budget,
    MIN(gross_profit_margin) AS min_margin,
    MAX(gross_profit_margin) AS max_margin,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gross_profit_margin) AS median_margin
FROM job_costs
WHERE costing_date IS NOT NULL
GROUP BY tenant_id, DATE_TRUNC('month', costing_date), status;

CREATE UNIQUE INDEX idx_variance_summary_unique ON job_cost_variance_summary(tenant_id, month, status);
CREATE INDEX idx_variance_summary_tenant_month ON job_cost_variance_summary(tenant_id, month DESC);

COMMENT ON MATERIALIZED VIEW job_cost_variance_summary IS 'Pre-aggregated variance metrics by month and status for fast reporting';

-- =====================================================
-- FUNCTIONS: Job Cost Management
-- =====================================================

-- Function to initialize job cost from estimate
CREATE OR REPLACE FUNCTION initialize_job_cost_from_estimate(
    p_job_id UUID,
    p_estimate_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_job_cost_id UUID;
    v_estimate estimates%ROWTYPE;
BEGIN
    -- Get tenant_id from job
    SELECT tenant_id INTO v_tenant_id FROM jobs WHERE id = p_job_id;

    -- Get estimate details
    SELECT * INTO v_estimate FROM estimates WHERE id = p_estimate_id;

    -- Insert job cost record with estimates as baseline
    INSERT INTO job_costs (
        tenant_id,
        job_id,
        estimate_id,
        estimated_material_cost,
        estimated_labor_cost,
        estimated_equipment_cost,
        estimated_overhead_cost,
        estimated_outsourcing_cost,
        estimated_total_cost,
        status,
        costing_date
    ) VALUES (
        v_tenant_id,
        p_job_id,
        p_estimate_id,
        v_estimate.total_material_cost,
        v_estimate.total_labor_cost,
        v_estimate.total_equipment_cost,
        v_estimate.total_overhead_cost,
        v_estimate.total_outsourcing_cost,
        v_estimate.total_cost,
        'estimated',
        CURRENT_DATE
    )
    RETURNING id INTO v_job_cost_id;

    RETURN v_job_cost_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION initialize_job_cost_from_estimate IS 'Initializes job cost record with estimates as baseline';

-- Function to update job cost incrementally
CREATE OR REPLACE FUNCTION update_job_cost_incremental(
    p_job_cost_id UUID,
    p_cost_category VARCHAR(50),
    p_cost_delta DECIMAL(18,4),
    p_update_source VARCHAR(50),
    p_source_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_tenant_id UUID;
    v_previous_total DECIMAL(18,4);
    v_new_total DECIMAL(18,4);
BEGIN
    -- Get tenant_id and current cost
    SELECT tenant_id INTO v_tenant_id FROM job_costs WHERE id = p_job_cost_id;

    -- Update the appropriate cost category
    CASE p_cost_category
        WHEN 'material' THEN
            SELECT material_cost INTO v_previous_total FROM job_costs WHERE id = p_job_cost_id;
            UPDATE job_costs SET material_cost = material_cost + p_cost_delta WHERE id = p_job_cost_id;
        WHEN 'labor' THEN
            SELECT labor_cost INTO v_previous_total FROM job_costs WHERE id = p_job_cost_id;
            UPDATE job_costs SET labor_cost = labor_cost + p_cost_delta WHERE id = p_job_cost_id;
        WHEN 'equipment' THEN
            SELECT equipment_cost INTO v_previous_total FROM job_costs WHERE id = p_job_cost_id;
            UPDATE job_costs SET equipment_cost = equipment_cost + p_cost_delta WHERE id = p_job_cost_id;
        WHEN 'overhead' THEN
            SELECT overhead_cost INTO v_previous_total FROM job_costs WHERE id = p_job_cost_id;
            UPDATE job_costs SET overhead_cost = overhead_cost + p_cost_delta WHERE id = p_job_cost_id;
        WHEN 'outsourcing' THEN
            SELECT outsourcing_cost INTO v_previous_total FROM job_costs WHERE id = p_job_cost_id;
            UPDATE job_costs SET outsourcing_cost = outsourcing_cost + p_cost_delta WHERE id = p_job_cost_id;
        WHEN 'other' THEN
            SELECT other_cost INTO v_previous_total FROM job_costs WHERE id = p_job_cost_id;
            UPDATE job_costs SET other_cost = other_cost + p_cost_delta WHERE id = p_job_cost_id;
        ELSE
            RAISE EXCEPTION 'Invalid cost category: %', p_cost_category;
    END CASE;

    v_new_total := v_previous_total + p_cost_delta;

    -- Record the update in audit trail
    INSERT INTO job_cost_updates (
        tenant_id,
        job_cost_id,
        update_source,
        source_id,
        cost_category,
        cost_delta,
        previous_total,
        new_total,
        description,
        update_metadata
    ) VALUES (
        v_tenant_id,
        p_job_cost_id,
        p_update_source,
        p_source_id,
        p_cost_category,
        p_cost_delta,
        v_previous_total,
        v_new_total,
        p_description,
        p_metadata
    );

    -- Update last rollup timestamp
    UPDATE job_costs
    SET last_rollup_at = NOW(),
        last_rollup_source = p_update_source
    WHERE id = p_job_cost_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_job_cost_incremental IS 'Incrementally updates job cost with audit trail';

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_job_cost_variance_summary()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY job_cost_variance_summary;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_job_cost_variance_summary IS 'Refreshes the variance summary materialized view';

-- =====================================================
-- TRIGGERS: Update timestamps and totals
-- =====================================================

-- Trigger to update job_costs updated_at and recalculate total_cost
CREATE OR REPLACE FUNCTION update_job_costs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();

    -- Ensure total_cost matches sum of components (redundant with CHECK constraint but ensures consistency)
    NEW.total_cost = NEW.material_cost + NEW.labor_cost + NEW.equipment_cost +
                     NEW.overhead_cost + NEW.outsourcing_cost + NEW.other_cost;

    -- Update status based on completion
    IF NEW.status = 'in_progress' AND NEW.completed_at IS NOT NULL THEN
        NEW.status = 'completed';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_job_costs_timestamp
BEFORE UPDATE ON job_costs
FOR EACH ROW
EXECUTE FUNCTION update_job_costs_timestamp();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE job_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cost_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_job_costs ON job_costs
FOR ALL
TO PUBLIC
USING (tenant_id = current_setting('app.tenant_id', TRUE)::uuid);

CREATE POLICY tenant_isolation_job_cost_updates ON job_cost_updates
FOR ALL
TO PUBLIC
USING (tenant_id = current_setting('app.tenant_id', TRUE)::uuid);

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON job_costs TO authenticated_users;
GRANT SELECT, INSERT ON job_cost_updates TO authenticated_users;
GRANT SELECT ON job_cost_variance_summary TO authenticated_users;

-- =====================================================
-- SCHEDULED JOBS: Refresh materialized view nightly
-- =====================================================

-- Note: This should be set up in pg_cron or application scheduler
-- Example: SELECT cron.schedule('refresh-variance-summary', '0 2 * * *', 'SELECT refresh_job_cost_variance_summary()');

-- =====================================================
-- END OF MIGRATION
-- =====================================================
