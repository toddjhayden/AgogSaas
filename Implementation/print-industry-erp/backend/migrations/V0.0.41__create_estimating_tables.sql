-- =====================================================
-- V0.0.41: CREATE ESTIMATING TABLES
-- =====================================================
-- Purpose: Estimating module for detailed cost estimates before quoting
-- Dependencies: tenants, users, customers, jobs, standard_costs
-- Created: 2025-12-29
-- Author: Roy (Backend Architect)
-- Requirement: REQ-STRATEGIC-AUTO-1767048328661 (Estimating & Job Costing Module)
-- =====================================================

-- =====================================================
-- TABLE: estimates
-- =====================================================
-- Purpose: Estimate header records for customer job quotes

CREATE TABLE estimates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Identification
    estimate_number VARCHAR(50) NOT NULL,
    estimate_date DATE NOT NULL DEFAULT CURRENT_DATE,
    revision_number INTEGER NOT NULL DEFAULT 1,
    parent_estimate_id UUID,  -- For versioning/revisions

    -- Customer/Job
    customer_id UUID,
    customer_name VARCHAR(255),
    customer_contact VARCHAR(255),
    job_description TEXT NOT NULL,
    quantity_estimated INTEGER NOT NULL,
    unit_of_measure VARCHAR(20) DEFAULT 'EACH',

    -- Product specification
    product_id UUID,
    product_code VARCHAR(100),
    product_specification JSONB,
    -- {width: 8.5, height: 11, unit: 'inches', paper_weight: '80#', colors: 4, sides: 2, ...}

    -- Costing summary
    total_material_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    total_labor_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    total_equipment_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    total_overhead_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    total_outsourcing_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    total_cost DECIMAL(18,4) NOT NULL DEFAULT 0,

    -- Pricing
    suggested_price DECIMAL(18,4),
    target_margin_percentage DECIMAL(10,4),
    markup_percentage DECIMAL(10,4),

    -- Lead time
    estimated_lead_time_days INTEGER,
    estimated_production_hours DECIMAL(10,2),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- draft, pending_review, approved, converted_to_quote, rejected

    -- Conversion tracking
    converted_to_quote_id UUID,
    converted_at TIMESTAMPTZ,
    converted_by UUID,

    -- Template
    is_template BOOLEAN DEFAULT FALSE,
    template_name VARCHAR(255),

    -- Version control
    version_notes TEXT,

    -- Validity
    valid_until DATE,

    -- Notes
    internal_notes TEXT,
    customer_notes TEXT,
    assumptions TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    rejected_by UUID,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,

    CONSTRAINT fk_estimate_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_estimate_parent FOREIGN KEY (parent_estimate_id) REFERENCES estimates(id),
    CONSTRAINT fk_estimate_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT uq_estimate_number UNIQUE (tenant_id, estimate_number, revision_number),
    CONSTRAINT chk_estimate_quantity CHECK (quantity_estimated > 0),
    CONSTRAINT chk_estimate_costs CHECK (total_cost >= 0),
    CONSTRAINT chk_estimate_margin CHECK (target_margin_percentage IS NULL OR target_margin_percentage BETWEEN -100 AND 100)
);

CREATE INDEX idx_estimates_tenant ON estimates(tenant_id);
CREATE INDEX idx_estimates_customer ON estimates(customer_id);
CREATE INDEX idx_estimates_status ON estimates(tenant_id, status);
CREATE INDEX idx_estimates_date ON estimates(estimate_date DESC);
CREATE INDEX idx_estimates_number ON estimates(tenant_id, estimate_number);
CREATE INDEX idx_estimates_template ON estimates(tenant_id, is_template) WHERE is_template = TRUE;
CREATE INDEX idx_estimates_parent ON estimates(parent_estimate_id);

COMMENT ON TABLE estimates IS 'Estimate headers for detailed cost estimates before customer quoting';

-- =====================================================
-- TABLE: estimate_operations
-- =====================================================
-- Purpose: Operations/steps within an estimate (prepress, printing, finishing, etc.)

CREATE TABLE estimate_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    estimate_id UUID NOT NULL,

    -- Operation details
    sequence_number INTEGER NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    -- prepress, printing, cutting, folding, stitching, binding, coating, packaging, die_cutting, laminating
    operation_code VARCHAR(50),
    operation_description TEXT,

    -- Resource requirements
    equipment_id UUID,
    equipment_code VARCHAR(50),
    work_center_id UUID,
    work_center_code VARCHAR(50),

    -- Time estimates
    setup_time_hours DECIMAL(10,4) DEFAULT 0,
    run_time_hours DECIMAL(10,4) DEFAULT 0,
    run_rate_per_hour DECIMAL(10,2),  -- Units per hour
    total_time_hours DECIMAL(10,4),

    -- Labor
    labor_hours DECIMAL(10,4),
    labor_rate_per_hour DECIMAL(18,4),
    number_of_operators INTEGER DEFAULT 1,

    -- Costs
    material_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    labor_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    equipment_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    overhead_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    outsourcing_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    operation_total_cost DECIMAL(18,4) NOT NULL DEFAULT 0,

    -- Cost calculation method
    cost_calculation_method VARCHAR(50),
    -- STANDARD_COST, MANUAL_ENTRY, BOM_EXPLOSION, HISTORICAL_AVERAGE

    -- Standards reference
    standard_cost_id UUID,

    -- Outsourcing
    is_outsourced BOOLEAN DEFAULT FALSE,
    vendor_id UUID,
    vendor_name VARCHAR(255),
    vendor_quote_amount DECIMAL(18,4),

    -- Dependencies
    predecessor_operation_id UUID,
    dependency_type VARCHAR(20),  -- FINISH_TO_START, START_TO_START

    -- Specifications
    operation_specifications JSONB,
    -- {ink_coverage: 60, paper_type: 'coated', plates_required: 4, ...}

    -- Notes
    notes TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID,

    CONSTRAINT fk_est_op_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_est_op_estimate FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
    CONSTRAINT fk_est_op_standard FOREIGN KEY (standard_cost_id) REFERENCES standard_costs(id),
    CONSTRAINT fk_est_op_predecessor FOREIGN KEY (predecessor_operation_id) REFERENCES estimate_operations(id),
    CONSTRAINT uq_est_op_sequence UNIQUE (estimate_id, sequence_number),
    CONSTRAINT chk_est_op_costs CHECK (operation_total_cost >= 0)
);

CREATE INDEX idx_est_ops_estimate ON estimate_operations(estimate_id, sequence_number);
CREATE INDEX idx_est_ops_type ON estimate_operations(operation_type);
CREATE INDEX idx_est_ops_tenant ON estimate_operations(tenant_id);
CREATE INDEX idx_est_ops_work_center ON estimate_operations(work_center_id);
CREATE INDEX idx_est_ops_outsourced ON estimate_operations(estimate_id, is_outsourced) WHERE is_outsourced = TRUE;

COMMENT ON TABLE estimate_operations IS 'Operations and process steps within an estimate';

-- =====================================================
-- TABLE: estimate_materials
-- =====================================================
-- Purpose: Materials required for estimate operations

CREATE TABLE estimate_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    estimate_id UUID NOT NULL,
    estimate_operation_id UUID,

    -- Material details
    material_id UUID NOT NULL,
    material_code VARCHAR(100),
    material_name VARCHAR(255),
    material_category VARCHAR(50),
    -- SUBSTRATE, INK, COATING, PLATES, DIES, CONSUMABLES

    -- Quantity
    quantity_required DECIMAL(18,4) NOT NULL,
    unit_of_measure VARCHAR(20) NOT NULL,
    scrap_percentage DECIMAL(10,4) DEFAULT 0,
    quantity_with_scrap DECIMAL(18,4),
    -- Automatically calculated: quantity_required * (1 + scrap_percentage / 100)

    -- Cost
    unit_cost DECIMAL(18,4) NOT NULL,
    total_cost DECIMAL(18,4) NOT NULL,
    cost_source VARCHAR(50),
    -- STANDARD_COST, CURRENT_PRICE, VENDOR_QUOTE, HISTORICAL_AVERAGE

    -- Supplier
    preferred_vendor_id UUID,
    preferred_vendor_name VARCHAR(255),

    -- Specifications
    material_specifications JSONB,
    -- {weight: '80#', finish: 'gloss', brightness: 92, ...}

    -- Substitutions
    substitute_material_id UUID,
    is_substitute BOOLEAN DEFAULT FALSE,

    -- Notes
    notes TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT fk_est_mat_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_est_mat_estimate FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
    CONSTRAINT fk_est_mat_operation FOREIGN KEY (estimate_operation_id) REFERENCES estimate_operations(id) ON DELETE CASCADE,
    CONSTRAINT chk_est_mat_quantity CHECK (quantity_required > 0),
    CONSTRAINT chk_est_mat_cost CHECK (unit_cost >= 0 AND total_cost >= 0),
    CONSTRAINT chk_est_mat_scrap CHECK (scrap_percentage >= 0 AND scrap_percentage <= 100)
);

CREATE INDEX idx_est_mats_estimate ON estimate_materials(estimate_id);
CREATE INDEX idx_est_mats_operation ON estimate_materials(estimate_operation_id);
CREATE INDEX idx_est_mats_material ON estimate_materials(material_id);
CREATE INDEX idx_est_mats_tenant ON estimate_materials(tenant_id);
CREATE INDEX idx_est_mats_category ON estimate_materials(material_category);

COMMENT ON TABLE estimate_materials IS 'Materials required for estimate operations';

-- =====================================================
-- FUNCTIONS: Calculate scrap-adjusted quantities
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_quantity_with_scrap(
    p_quantity_required DECIMAL(18,4),
    p_scrap_percentage DECIMAL(10,4)
)
RETURNS DECIMAL(18,4) AS $$
BEGIN
    IF p_scrap_percentage IS NULL OR p_scrap_percentage = 0 THEN
        RETURN p_quantity_required;
    END IF;
    RETURN p_quantity_required * (1 + p_scrap_percentage / 100.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_quantity_with_scrap IS 'Calculates material quantity including scrap allowance';

-- =====================================================
-- TRIGGERS: Auto-calculate fields
-- =====================================================

-- Trigger to calculate total_cost for estimates
CREATE OR REPLACE FUNCTION update_estimate_total_cost()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_cost = NEW.total_material_cost + NEW.total_labor_cost +
                     NEW.total_equipment_cost + NEW.total_overhead_cost +
                     NEW.total_outsourcing_cost;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_estimate_total_cost
BEFORE INSERT OR UPDATE OF total_material_cost, total_labor_cost, total_equipment_cost,
                            total_overhead_cost, total_outsourcing_cost
ON estimates
FOR EACH ROW
EXECUTE FUNCTION update_estimate_total_cost();

-- Trigger to calculate operation total cost
CREATE OR REPLACE FUNCTION update_operation_total_cost()
RETURNS TRIGGER AS $$
BEGIN
    NEW.operation_total_cost = NEW.material_cost + NEW.labor_cost +
                               NEW.equipment_cost + NEW.overhead_cost +
                               NEW.outsourcing_cost;
    NEW.total_time_hours = NEW.setup_time_hours + NEW.run_time_hours;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_operation_total_cost
BEFORE INSERT OR UPDATE OF material_cost, labor_cost, equipment_cost,
                            overhead_cost, outsourcing_cost, setup_time_hours, run_time_hours
ON estimate_operations
FOR EACH ROW
EXECUTE FUNCTION update_operation_total_cost();

-- Trigger to calculate material quantity with scrap and total cost
CREATE OR REPLACE FUNCTION update_material_quantities()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate quantity with scrap
    NEW.quantity_with_scrap = calculate_quantity_with_scrap(
        NEW.quantity_required,
        NEW.scrap_percentage
    );

    -- Calculate total cost
    NEW.total_cost = NEW.quantity_with_scrap * NEW.unit_cost;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_material_quantities
BEFORE INSERT OR UPDATE OF quantity_required, scrap_percentage, unit_cost
ON estimate_materials
FOR EACH ROW
EXECUTE FUNCTION update_material_quantities();

-- =====================================================
-- FUNCTIONS: Estimate operations aggregation
-- =====================================================

-- Function to rollup operation costs to estimate header
CREATE OR REPLACE FUNCTION rollup_estimate_costs(p_estimate_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE estimates SET
        total_material_cost = COALESCE((
            SELECT SUM(material_cost)
            FROM estimate_operations
            WHERE estimate_id = p_estimate_id
        ), 0),
        total_labor_cost = COALESCE((
            SELECT SUM(labor_cost)
            FROM estimate_operations
            WHERE estimate_id = p_estimate_id
        ), 0),
        total_equipment_cost = COALESCE((
            SELECT SUM(equipment_cost)
            FROM estimate_operations
            WHERE estimate_id = p_estimate_id
        ), 0),
        total_overhead_cost = COALESCE((
            SELECT SUM(overhead_cost)
            FROM estimate_operations
            WHERE estimate_id = p_estimate_id
        ), 0),
        total_outsourcing_cost = COALESCE((
            SELECT SUM(outsourcing_cost)
            FROM estimate_operations
            WHERE estimate_id = p_estimate_id
        ), 0),
        estimated_production_hours = COALESCE((
            SELECT SUM(total_time_hours)
            FROM estimate_operations
            WHERE estimate_id = p_estimate_id
        ), 0),
        updated_at = NOW()
    WHERE id = p_estimate_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION rollup_estimate_costs IS 'Aggregates operation costs to estimate header totals';

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_estimates ON estimates
FOR ALL
TO PUBLIC
USING (tenant_id = current_setting('app.tenant_id', TRUE)::uuid);

CREATE POLICY tenant_isolation_estimate_operations ON estimate_operations
FOR ALL
TO PUBLIC
USING (tenant_id = current_setting('app.tenant_id', TRUE)::uuid);

CREATE POLICY tenant_isolation_estimate_materials ON estimate_materials
FOR ALL
TO PUBLIC
USING (tenant_id = current_setting('app.tenant_id', TRUE)::uuid);

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON estimates TO authenticated_users;
GRANT SELECT, INSERT, UPDATE, DELETE ON estimate_operations TO authenticated_users;
GRANT SELECT, INSERT, UPDATE, DELETE ON estimate_materials TO authenticated_users;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
