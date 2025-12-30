-- =====================================================
-- V0.0.40: CREATE JOBS AND STANDARD COSTS TABLES
-- =====================================================
-- Purpose: Foundation for Estimating & Job Costing Module (REQ-STRATEGIC-AUTO-1767048328661)
-- Dependencies: tenants, users, customers, sales_orders
-- Created: 2025-12-29
-- Author: Roy (Backend Architect)
-- =====================================================

-- =====================================================
-- TABLE: jobs
-- =====================================================
-- Purpose: Job master data linking customer requirements to production

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Job identification
    job_number VARCHAR(50) NOT NULL,
    job_name VARCHAR(255),
    job_description TEXT,

    -- Customer
    customer_id UUID NOT NULL,
    customer_name VARCHAR(255),
    sales_order_id UUID,
    quote_id UUID,

    -- Product/Quantity
    product_id UUID,
    product_code VARCHAR(100),
    product_description TEXT,
    quantity_required INTEGER NOT NULL,
    unit_of_measure VARCHAR(20) DEFAULT 'EACH',

    -- Scheduling
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    promised_delivery_date DATE,
    scheduled_start_date DATE,
    scheduled_completion_date DATE,
    actual_start_date DATE,
    actual_completion_date DATE,
    actual_delivery_date DATE,
    due_date DATE,

    -- Costing
    estimated_cost DECIMAL(18,4),
    actual_cost DECIMAL(18,4),
    quoted_price DECIMAL(18,4),
    invoice_amount DECIMAL(18,4),

    -- Priority
    priority INTEGER DEFAULT 5,  -- 1 = highest, 10 = lowest

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'quoted',
    -- quoted, pending, approved, scheduled, in-production, completed, delivered, cancelled

    -- Manufacturing details
    manufacturing_strategy VARCHAR(50),
    special_instructions TEXT,

    -- Contact information
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),

    -- Notes
    internal_notes TEXT,
    customer_notes TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID,
    approved_at TIMESTAMPTZ,
    approved_by UUID,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID,
    cancellation_reason TEXT,

    CONSTRAINT fk_job_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_job_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT uq_job_number UNIQUE (tenant_id, job_number),
    CONSTRAINT chk_job_quantity CHECK (quantity_required > 0),
    CONSTRAINT chk_job_priority CHECK (priority BETWEEN 1 AND 10)
);

CREATE INDEX idx_jobs_tenant ON jobs(tenant_id);
CREATE INDEX idx_jobs_customer ON jobs(customer_id);
CREATE INDEX idx_jobs_status ON jobs(tenant_id, status);
CREATE INDEX idx_jobs_delivery_date ON jobs(promised_delivery_date);
CREATE INDEX idx_jobs_order_date ON jobs(order_date DESC);
CREATE INDEX idx_jobs_priority ON jobs(tenant_id, priority, status);

COMMENT ON TABLE jobs IS 'Job master data linking customer requirements to production';

-- =====================================================
-- TABLE: cost_centers
-- =====================================================
-- Purpose: Cost center master data for job costing

CREATE TABLE cost_centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Cost center identification
    cost_center_code VARCHAR(20) NOT NULL,
    cost_center_name VARCHAR(100) NOT NULL,
    cost_center_type VARCHAR(50) NOT NULL,
    -- production, support, administrative, sales, distribution

    -- Hierarchy
    parent_cost_center_id UUID,

    -- Financial
    gl_account_prefix VARCHAR(20),
    budget_amount DECIMAL(18,4),
    budget_period VARCHAR(20),  -- MONTHLY, QUARTERLY, ANNUAL

    -- Overhead allocation
    overhead_allocation_method VARCHAR(50),
    -- DIRECT_LABOR_HOURS, MACHINE_HOURS, UNITS_PRODUCED, MATERIAL_COST, REVENUE_PERCENTAGE
    overhead_rate DECIMAL(18,4),
    overhead_rate_unit VARCHAR(50),

    -- Management
    manager_id UUID,
    site_id UUID,
    facility_id UUID,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from DATE NOT NULL,
    effective_to DATE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID,

    CONSTRAINT fk_cost_center_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_cost_center_parent FOREIGN KEY (parent_cost_center_id) REFERENCES cost_centers(id),
    CONSTRAINT fk_cost_center_manager FOREIGN KEY (manager_id) REFERENCES users(id),
    CONSTRAINT uq_cost_center_code UNIQUE (tenant_id, cost_center_code)
);

CREATE INDEX idx_cost_centers_tenant ON cost_centers(tenant_id);
CREATE INDEX idx_cost_centers_type ON cost_centers(tenant_id, cost_center_type);
CREATE INDEX idx_cost_centers_active ON cost_centers(tenant_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_cost_centers_manager ON cost_centers(manager_id);

COMMENT ON TABLE cost_centers IS 'Cost center master data for overhead allocation and budgeting';

-- =====================================================
-- TABLE: standard_costs
-- =====================================================
-- Purpose: Standard cost master data for estimating and variance analysis

CREATE TABLE standard_costs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Cost object
    cost_object_type VARCHAR(50) NOT NULL,
    -- material, operation, equipment_hour, labor_hour, overhead, activity, setup
    cost_object_id UUID,
    cost_object_code VARCHAR(50) NOT NULL,
    cost_object_description TEXT,

    -- Cost components
    material_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    labor_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    equipment_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    overhead_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    total_standard_cost DECIMAL(18,4) NOT NULL,

    -- Unit of measure
    cost_per_unit VARCHAR(50) NOT NULL,
    -- per_sheet, per_hour, per_setup, per_pound, per_foot, per_unit

    -- Cost center mapping
    cost_center_id UUID,
    gl_account VARCHAR(50),

    -- Value analysis
    value_category VARCHAR(50) NOT NULL DEFAULT 'value_added',
    -- value_added, business_value_added, non_value_added
    financial_impact_category VARCHAR(50),
    -- direct_material, direct_labor, variable_overhead, fixed_overhead

    -- Effective dating
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,

    -- Calculation basis
    calculation_method TEXT,
    assumptions TEXT,
    variance_threshold_percent DECIMAL(10,4) DEFAULT 10.0,

    -- Quality metrics
    confidence_level VARCHAR(20),  -- HIGH, MEDIUM, LOW
    data_source VARCHAR(100),  -- historical_average, vendor_quote, engineering_estimate
    last_reviewed_date DATE,
    review_frequency_days INTEGER DEFAULT 365,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,

    CONSTRAINT fk_std_cost_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_std_cost_center FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id),
    CONSTRAINT uq_std_cost_object UNIQUE (tenant_id, cost_object_type, cost_object_code, effective_from),
    CONSTRAINT chk_std_cost_amounts CHECK (total_standard_cost >= 0),
    CONSTRAINT chk_std_cost_components CHECK (
        material_cost >= 0 AND labor_cost >= 0 AND
        equipment_cost >= 0 AND overhead_cost >= 0
    )
);

CREATE INDEX idx_std_costs_tenant ON standard_costs(tenant_id);
CREATE INDEX idx_std_costs_object ON standard_costs(tenant_id, cost_object_type, cost_object_code);
CREATE INDEX idx_std_costs_current ON standard_costs(tenant_id, is_current, cost_object_type) WHERE is_current = TRUE;
CREATE INDEX idx_std_costs_effective ON standard_costs(tenant_id, effective_from, effective_to);
CREATE INDEX idx_std_costs_review ON standard_costs(tenant_id, last_reviewed_date) WHERE is_current = TRUE;

COMMENT ON TABLE standard_costs IS 'Standard cost master data for materials, operations, labor, and overhead';

-- =====================================================
-- SEED DATA: Default cost centers
-- =====================================================

-- Note: Seed data should be inserted per tenant during onboarding
-- Sample structure provided for reference

-- INSERT INTO cost_centers (tenant_id, cost_center_code, cost_center_name, cost_center_type, overhead_allocation_method, overhead_rate, overhead_rate_unit, effective_from)
-- VALUES
--     ('{{tenant_id}}', 'PROD-01', 'Offset Printing', 'production', 'MACHINE_HOURS', 75.00, 'per_hour', '2025-01-01'),
--     ('{{tenant_id}}', 'PROD-02', 'Digital Printing', 'production', 'MACHINE_HOURS', 50.00, 'per_hour', '2025-01-01'),
--     ('{{tenant_id}}', 'PROD-03', 'Bindery & Finishing', 'production', 'DIRECT_LABOR_HOURS', 45.00, 'per_hour', '2025-01-01'),
--     ('{{tenant_id}}', 'ADMIN-01', 'Administrative Overhead', 'administrative', 'REVENUE_PERCENTAGE', 0.15, 'percentage', '2025-01-01'),
--     ('{{tenant_id}}', 'SALES-01', 'Sales & Marketing', 'sales', 'REVENUE_PERCENTAGE', 0.08, 'percentage', '2025-01-01');

-- =====================================================
-- FUNCTIONS: Helper functions for standard costs
-- =====================================================

-- Function to get current standard cost
CREATE OR REPLACE FUNCTION get_current_standard_cost(
    p_tenant_id UUID,
    p_cost_object_type VARCHAR(50),
    p_cost_object_code VARCHAR(50)
)
RETURNS TABLE (
    id UUID,
    total_standard_cost DECIMAL(18,4),
    material_cost DECIMAL(18,4),
    labor_cost DECIMAL(18,4),
    equipment_cost DECIMAL(18,4),
    overhead_cost DECIMAL(18,4),
    cost_per_unit VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sc.id,
        sc.total_standard_cost,
        sc.material_cost,
        sc.labor_cost,
        sc.equipment_cost,
        sc.overhead_cost,
        sc.cost_per_unit
    FROM standard_costs sc
    WHERE sc.tenant_id = p_tenant_id
      AND sc.cost_object_type = p_cost_object_type
      AND sc.cost_object_code = p_cost_object_code
      AND sc.is_current = TRUE
      AND sc.effective_from <= CURRENT_DATE
      AND (sc.effective_to IS NULL OR sc.effective_to >= CURRENT_DATE)
    ORDER BY sc.effective_from DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_current_standard_cost IS 'Retrieves the current active standard cost for a cost object';

-- =====================================================
-- TRIGGERS: Update timestamps
-- =====================================================

-- Jobs table trigger
CREATE OR REPLACE FUNCTION update_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jobs_updated_at
BEFORE UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION update_jobs_updated_at();

-- Cost centers table trigger
CREATE OR REPLACE FUNCTION update_cost_centers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cost_centers_updated_at
BEFORE UPDATE ON cost_centers
FOR EACH ROW
EXECUTE FUNCTION update_cost_centers_updated_at();

-- Standard costs table trigger
CREATE OR REPLACE FUNCTION update_standard_costs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_standard_costs_updated_at
BEFORE UPDATE ON standard_costs
FOR EACH ROW
EXECUTE FUNCTION update_standard_costs_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on jobs table
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_jobs ON jobs
FOR ALL
TO PUBLIC
USING (tenant_id = current_setting('app.tenant_id', TRUE)::uuid);

-- Enable RLS on cost_centers table
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cost_centers ON cost_centers
FOR ALL
TO PUBLIC
USING (tenant_id = current_setting('app.tenant_id', TRUE)::uuid);

-- Enable RLS on standard_costs table
ALTER TABLE standard_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_standard_costs ON standard_costs
FOR ALL
TO PUBLIC
USING (tenant_id = current_setting('app.tenant_id', TRUE)::uuid);

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON jobs TO authenticated_users;
GRANT SELECT, INSERT, UPDATE, DELETE ON cost_centers TO authenticated_users;
GRANT SELECT, INSERT, UPDATE, DELETE ON standard_costs TO authenticated_users;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
