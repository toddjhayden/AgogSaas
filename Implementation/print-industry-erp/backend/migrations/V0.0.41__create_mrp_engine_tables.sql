-- Migration: V0.0.41 - Material Requirements Planning (MRP) Engine Tables
-- Description: Create tables for MRP calculation, planned orders, pegging, and action messages
-- Author: Roy (Backend Developer)
-- Date: 2025-12-30
-- Requirement: REQ-STRATEGIC-AUTO-1767084329264

-- ============================================================================
-- TABLE: mrp_runs
-- Purpose: Track MRP execution history and parameters
-- ============================================================================

CREATE TABLE IF NOT EXISTS mrp_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Run identification
    run_number VARCHAR(50) NOT NULL,
    run_type VARCHAR(20) NOT NULL CHECK (run_type IN ('REGENERATIVE', 'NET_CHANGE', 'SIMULATION')),

    -- Timing
    run_start_timestamp TIMESTAMPTZ NOT NULL,
    run_end_timestamp TIMESTAMPTZ,
    run_duration_seconds INTEGER,

    -- Scope
    material_ids UUID[], -- Null = all materials
    planning_horizon_days INTEGER DEFAULT 180 CHECK (planning_horizon_days > 0 AND planning_horizon_days <= 365),

    -- Results
    total_materials_processed INTEGER DEFAULT 0,
    total_planned_orders_generated INTEGER DEFAULT 0,
    total_action_messages_generated INTEGER DEFAULT 0,

    -- Inventory snapshot for auditability
    inventory_snapshot_timestamp TIMESTAMPTZ,

    -- Status
    status VARCHAR(20) DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'CANCELLED')),
    error_message TEXT,
    error_code VARCHAR(50),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_mrp_run_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_mrp_run_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
    CONSTRAINT uq_mrp_run_number UNIQUE (tenant_id, run_number)
);

-- Indexes for mrp_runs
CREATE INDEX idx_mrp_runs_tenant_facility ON mrp_runs(tenant_id, facility_id);
CREATE INDEX idx_mrp_runs_status ON mrp_runs(status) WHERE status IN ('RUNNING', 'FAILED');
CREATE INDEX idx_mrp_runs_timestamp ON mrp_runs(run_start_timestamp DESC);
CREATE INDEX idx_mrp_runs_facility_status ON mrp_runs(facility_id, status);

-- Row-Level Security for mrp_runs
ALTER TABLE mrp_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY mrp_runs_tenant_isolation ON mrp_runs
    FOR SELECT
    USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY mrp_runs_insert ON mrp_runs
    FOR INSERT
    WITH CHECK (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY mrp_runs_update ON mrp_runs
    FOR UPDATE
    USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE))
    WITH CHECK (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY mrp_runs_delete ON mrp_runs
    FOR DELETE
    USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- ============================================================================
-- TABLE: planned_orders
-- Purpose: Store MRP-generated planned orders (before firming to PO/production orders)
-- ============================================================================

CREATE TABLE IF NOT EXISTS planned_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,
    mrp_run_id UUID NOT NULL,

    -- Order identification
    planned_order_number VARCHAR(50) NOT NULL,
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('PURCHASE', 'PRODUCTION', 'TRANSFER')),

    -- Material
    material_id UUID NOT NULL,
    material_code VARCHAR(100),

    -- Quantity
    quantity DECIMAL(18,4) NOT NULL CHECK (quantity > 0),
    unit_of_measure VARCHAR(20),

    -- Timing
    required_date DATE NOT NULL,
    order_date DATE NOT NULL,
    -- order_date = required_date - lead_time

    -- Sourcing
    vendor_id UUID,
    -- For purchase orders
    work_center_id UUID,
    -- For production orders

    -- Costing
    estimated_unit_cost DECIMAL(18,4),
    estimated_total_cost DECIMAL(18,4),

    -- Lot sizing
    lot_sizing_method VARCHAR(30) DEFAULT 'LOT_FOR_LOT' CHECK (
        lot_sizing_method IN ('LOT_FOR_LOT', 'FIXED_ORDER_QUANTITY', 'EOQ', 'PERIOD_ORDER_QUANTITY', 'MIN_MAX')
    ),

    -- Status
    status VARCHAR(20) DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'FIRMED', 'CONVERTED', 'CANCELLED')),

    firmed_at TIMESTAMPTZ,
    firmed_by UUID,

    -- Conversion tracking
    converted_to_po_id UUID,
    converted_to_production_order_id UUID,
    converted_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_planned_order_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_planned_order_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
    CONSTRAINT fk_planned_order_mrp_run FOREIGN KEY (mrp_run_id) REFERENCES mrp_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_planned_order_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    CONSTRAINT fk_planned_order_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
    CONSTRAINT uq_planned_order_number UNIQUE (tenant_id, planned_order_number),
    CONSTRAINT chk_planned_order_dates CHECK (order_date <= required_date)
);

-- Indexes for planned_orders
CREATE INDEX idx_planned_orders_tenant_facility ON planned_orders(tenant_id, facility_id);
CREATE INDEX idx_planned_orders_mrp_run ON planned_orders(mrp_run_id);
CREATE INDEX idx_planned_orders_material ON planned_orders(material_id);
CREATE INDEX idx_planned_orders_status ON planned_orders(status);
CREATE INDEX idx_planned_orders_required_date ON planned_orders(required_date);
CREATE INDEX idx_planned_orders_type ON planned_orders(order_type);
CREATE INDEX idx_planned_orders_vendor ON planned_orders(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_planned_orders_material_status ON planned_orders(material_id, status);

-- Row-Level Security for planned_orders
ALTER TABLE planned_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY planned_orders_tenant_isolation ON planned_orders
    FOR SELECT
    USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY planned_orders_insert ON planned_orders
    FOR INSERT
    WITH CHECK (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY planned_orders_update ON planned_orders
    FOR UPDATE
    USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE))
    WITH CHECK (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY planned_orders_delete ON planned_orders
    FOR DELETE
    USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- ============================================================================
-- TABLE: mrp_pegging
-- Purpose: Track demand source for each material requirement (pegging/where-used)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mrp_pegging (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,
    mrp_run_id UUID NOT NULL,

    -- Requirement (lower level)
    planned_order_id UUID NOT NULL,
    material_id UUID NOT NULL,
    required_quantity DECIMAL(18,4) NOT NULL CHECK (required_quantity > 0),
    required_date DATE NOT NULL,

    -- Demand source (higher level)
    demand_source_type VARCHAR(30) NOT NULL CHECK (
        demand_source_type IN ('SALES_ORDER', 'PRODUCTION_ORDER', 'FORECAST', 'SAFETY_STOCK', 'PARENT_PLANNED_ORDER')
    ),

    sales_order_id UUID,
    sales_order_line_id UUID,
    production_order_id UUID,
    forecast_id UUID,
    parent_planned_order_id UUID,

    -- Pegging level (0 = top-level demand)
    pegging_level INTEGER NOT NULL CHECK (pegging_level >= 0 AND pegging_level <= 50),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_mrp_pegging_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_mrp_pegging_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
    CONSTRAINT fk_mrp_pegging_mrp_run FOREIGN KEY (mrp_run_id) REFERENCES mrp_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_mrp_pegging_planned_order FOREIGN KEY (planned_order_id) REFERENCES planned_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_mrp_pegging_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

-- Indexes for mrp_pegging
CREATE INDEX idx_mrp_pegging_tenant_facility ON mrp_pegging(tenant_id, facility_id);
CREATE INDEX idx_mrp_pegging_mrp_run ON mrp_pegging(mrp_run_id);
CREATE INDEX idx_mrp_pegging_planned_order ON mrp_pegging(planned_order_id);
CREATE INDEX idx_mrp_pegging_material ON mrp_pegging(material_id);
CREATE INDEX idx_mrp_pegging_sales_order ON mrp_pegging(sales_order_id) WHERE sales_order_id IS NOT NULL;
-- Composite indexes for common query patterns (per Sylvia's recommendation)
CREATE INDEX idx_mrp_pegging_material_run ON mrp_pegging(material_id, mrp_run_id);
CREATE INDEX idx_mrp_pegging_sales_order_level ON mrp_pegging(sales_order_id, pegging_level) WHERE sales_order_id IS NOT NULL;
CREATE INDEX idx_mrp_pegging_tenant_level ON mrp_pegging(tenant_id, pegging_level);

-- Row-Level Security for mrp_pegging
ALTER TABLE mrp_pegging ENABLE ROW LEVEL SECURITY;

CREATE POLICY mrp_pegging_tenant_isolation ON mrp_pegging
    FOR SELECT
    USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY mrp_pegging_insert ON mrp_pegging
    FOR INSERT
    WITH CHECK (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY mrp_pegging_delete ON mrp_pegging
    FOR DELETE
    USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- ============================================================================
-- TABLE: mrp_action_messages
-- Purpose: Store planner action recommendations
-- ============================================================================

CREATE TABLE IF NOT EXISTS mrp_action_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,
    mrp_run_id UUID NOT NULL,

    -- Action identification
    action_message_number VARCHAR(50) NOT NULL,
    action_type VARCHAR(30) NOT NULL CHECK (
        action_type IN ('EXPEDITE', 'DE_EXPEDITE', 'INCREASE_QUANTITY', 'DECREASE_QUANTITY', 'CANCEL', 'NEW_ORDER', 'CAPACITY_WARNING')
    ),

    -- Target order
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('PURCHASE_ORDER', 'PRODUCTION_ORDER', 'PLANNED_ORDER', 'WORK_CENTER')),

    purchase_order_id UUID,
    production_order_id UUID,
    planned_order_id UUID,
    work_center_id UUID,

    -- Material
    material_id UUID NOT NULL,
    material_code VARCHAR(100),

    -- Recommendation
    current_quantity DECIMAL(18,4),
    recommended_quantity DECIMAL(18,4),
    current_due_date DATE,
    recommended_due_date DATE,

    -- Impact
    impact_level VARCHAR(20) DEFAULT 'MEDIUM' CHECK (impact_level IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    affected_sales_orders JSONB,
    -- [{sales_order_number, customer_name, due_date}, ...]

    -- Reason
    reason_code VARCHAR(50),
    reason_description TEXT,

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'CANCELLED')),

    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    executed_by UUID,
    executed_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_mrp_action_msg_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_mrp_action_msg_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
    CONSTRAINT fk_mrp_action_msg_mrp_run FOREIGN KEY (mrp_run_id) REFERENCES mrp_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_mrp_action_msg_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    CONSTRAINT uq_action_message_number UNIQUE (tenant_id, action_message_number)
);

-- Indexes for mrp_action_messages
CREATE INDEX idx_mrp_action_msgs_tenant_facility ON mrp_action_messages(tenant_id, facility_id);
CREATE INDEX idx_mrp_action_msgs_mrp_run ON mrp_action_messages(mrp_run_id);
CREATE INDEX idx_mrp_action_msgs_status ON mrp_action_messages(status);
CREATE INDEX idx_mrp_action_msgs_impact ON mrp_action_messages(impact_level);
CREATE INDEX idx_mrp_action_msgs_material ON mrp_action_messages(material_id);
CREATE INDEX idx_mrp_action_msgs_status_impact ON mrp_action_messages(status, impact_level);

-- Row-Level Security for mrp_action_messages
ALTER TABLE mrp_action_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY mrp_action_messages_tenant_isolation ON mrp_action_messages
    FOR SELECT
    USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY mrp_action_messages_insert ON mrp_action_messages
    FOR INSERT
    WITH CHECK (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY mrp_action_messages_update ON mrp_action_messages
    FOR UPDATE
    USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE))
    WITH CHECK (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY mrp_action_messages_delete ON mrp_action_messages
    FOR DELETE
    USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- ============================================================================
-- MATERIALIZED VIEW: planned_orders_summary
-- Purpose: Provide fast aggregated view of planned orders by material
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS planned_orders_summary AS
SELECT
    po.tenant_id,
    po.facility_id,
    po.material_id,
    m.material_code,
    m.description AS material_description,
    po.order_type,
    po.status,
    COUNT(*) AS order_count,
    SUM(po.quantity) AS total_quantity,
    MIN(po.required_date) AS earliest_required_date,
    MAX(po.required_date) AS latest_required_date,
    SUM(po.estimated_total_cost) AS total_estimated_cost
FROM planned_orders po
JOIN materials m ON m.id = po.material_id
WHERE po.status IN ('PLANNED', 'FIRMED')
GROUP BY
    po.tenant_id,
    po.facility_id,
    po.material_id,
    m.material_code,
    m.description,
    po.order_type,
    po.status;

CREATE UNIQUE INDEX idx_planned_orders_summary_unique ON planned_orders_summary(
    tenant_id, facility_id, material_id, order_type, status
);

-- ============================================================================
-- ALTER TABLE: materials
-- Purpose: Add MRP configuration fields to materials table
-- ============================================================================

ALTER TABLE materials ADD COLUMN IF NOT EXISTS mrp_type VARCHAR(20) DEFAULT 'MRP' CHECK (
    mrp_type IN ('MRP', 'MPS', 'NONE')
);

ALTER TABLE materials ADD COLUMN IF NOT EXISTS lot_sizing_method VARCHAR(30) DEFAULT 'LOT_FOR_LOT' CHECK (
    lot_sizing_method IN ('LOT_FOR_LOT', 'FIXED_ORDER_QUANTITY', 'EOQ', 'PERIOD_ORDER_QUANTITY', 'MIN_MAX')
);

ALTER TABLE materials ADD COLUMN IF NOT EXISTS fixed_order_quantity DECIMAL(18,4) CHECK (
    fixed_order_quantity IS NULL OR fixed_order_quantity > 0
);

ALTER TABLE materials ADD COLUMN IF NOT EXISTS period_order_quantity_days INTEGER DEFAULT 30 CHECK (
    period_order_quantity_days IS NULL OR (period_order_quantity_days > 0 AND period_order_quantity_days <= 365)
);

ALTER TABLE materials ADD COLUMN IF NOT EXISTS safety_lead_time_days INTEGER DEFAULT 0 CHECK (
    safety_lead_time_days >= 0 AND safety_lead_time_days <= 365
);

ALTER TABLE materials ADD COLUMN IF NOT EXISTS planning_time_fence_days INTEGER DEFAULT 0 CHECK (
    planning_time_fence_days >= 0 AND planning_time_fence_days <= 180
);

ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_phantom BOOLEAN DEFAULT FALSE;

ALTER TABLE materials ADD COLUMN IF NOT EXISTS yield_percentage DECIMAL(8,4) DEFAULT 100.0 CHECK (
    yield_percentage > 0 AND yield_percentage <= 100
);

-- Create index on MRP-related fields
CREATE INDEX IF NOT EXISTS idx_materials_mrp_config ON materials(mrp_type, is_phantom) WHERE mrp_type != 'NONE';

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE mrp_runs IS 'Tracks MRP execution history, parameters, and results for audit and analysis';
COMMENT ON TABLE planned_orders IS 'Stores MRP-generated planned orders before they are firmed to purchase orders or production orders';
COMMENT ON TABLE mrp_pegging IS 'Tracks demand sources for material requirements, enabling where-used and impact analysis';
COMMENT ON TABLE mrp_action_messages IS 'Stores planner action recommendations generated by MRP for order expediting, cancellation, etc.';
COMMENT ON MATERIALIZED VIEW planned_orders_summary IS 'Aggregated view of planned orders by material for reporting and dashboards';

COMMENT ON COLUMN materials.mrp_type IS 'MRP planning type: MRP (standard calculation), MPS (master schedule item), NONE (no planning)';
COMMENT ON COLUMN materials.lot_sizing_method IS 'Lot sizing method to use when generating planned orders';
COMMENT ON COLUMN materials.fixed_order_quantity IS 'Fixed quantity to order when using FIXED_ORDER_QUANTITY lot sizing method';
COMMENT ON COLUMN materials.period_order_quantity_days IS 'Number of days of demand to cover when using PERIOD_ORDER_QUANTITY method';
COMMENT ON COLUMN materials.safety_lead_time_days IS 'Buffer time added to material lead time for MRP calculations';
COMMENT ON COLUMN materials.planning_time_fence_days IS 'Period where only firm orders are considered (no forecasts)';
COMMENT ON COLUMN materials.is_phantom IS 'Phantom assemblies are not stocked but exploded through BOM';
COMMENT ON COLUMN materials.yield_percentage IS 'Overall yield percentage for this material (used in BOM explosion)';
