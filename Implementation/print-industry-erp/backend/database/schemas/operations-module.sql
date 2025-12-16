-- =====================================================
-- OPERATIONS MODULE
-- =====================================================
-- Purpose: Production planning, scheduling, execution, and OEE tracking
-- Tables: 12 (production_orders, production_runs, work_centers, operations, changeover_details,
--         equipment_status_log, maintenance_records, asset_hierarchy, oee_calculations,
--         production_schedules, capacity_planning, materials)
-- Created: 2025-12-16
-- Author: Roy (Backend Architect)
-- =====================================================

-- =====================================================
-- TABLE: work_centers
-- =====================================================
-- Purpose: Manufacturing equipment/work centers (presses, bindery, finishing)

CREATE TABLE work_centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Work center identification
    work_center_code VARCHAR(50) NOT NULL,
    work_center_name VARCHAR(255) NOT NULL,
    work_center_type VARCHAR(50) NOT NULL,
    -- OFFSET_PRESS, DIGITAL_PRESS, FLEXO_PRESS, DIE_CUTTER, FOLDER, BINDERY, FINISHING, etc.

    -- Equipment details
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100),
    asset_tag VARCHAR(100),

    -- Press specifications (for imposition engine)
    sheet_width_max DECIMAL(10,4),
    sheet_height_max DECIMAL(10,4),
    sheet_width_min DECIMAL(10,4),
    sheet_height_min DECIMAL(10,4),
    dimension_unit VARCHAR(10) DEFAULT 'INCHES',

    gripper_margin DECIMAL(10,4) DEFAULT 0.5,
    side_margins DECIMAL(10,4) DEFAULT 0.25,
    max_colors INTEGER,
    -- 4 for CMYK, 6 for CMYK+2 spot, etc.

    -- Capacity
    production_rate_per_hour DECIMAL(12,2),
    production_unit VARCHAR(50),
    -- SHEETS, IMPRESSIONS, FEET, METERS, PIECES

    -- Costs
    hourly_rate DECIMAL(18,4),
    setup_cost DECIMAL(18,4),
    cost_per_unit DECIMAL(18,4),

    -- Maintenance
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    maintenance_interval_days INTEGER,

    -- Status
    status VARCHAR(20) DEFAULT 'AVAILABLE',
    -- AVAILABLE, IN_USE, DOWN, MAINTENANCE, OFFLINE
    is_active BOOLEAN DEFAULT TRUE,

    -- Calendar
    operating_calendar JSONB,
    -- {monday: {shifts: [{start: '08:00', end: '16:00'}]}, ...}

    -- Configuration
    capabilities JSONB,
    -- {substrate_types: ['PAPER', 'CARDBOARD'], coating_capable: true, ...}

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_work_center_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_work_center_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT uq_work_center_code UNIQUE (tenant_id, facility_id, work_center_code)
);

CREATE INDEX idx_work_centers_tenant ON work_centers(tenant_id);
CREATE INDEX idx_work_centers_facility ON work_centers(facility_id);
CREATE INDEX idx_work_centers_type ON work_centers(work_center_type);
CREATE INDEX idx_work_centers_status ON work_centers(status);

COMMENT ON TABLE work_centers IS 'Manufacturing equipment: presses, bindery, finishing equipment';

-- =====================================================
-- TABLE: production_orders
-- =====================================================
-- Purpose: High-level production orders (from sales orders)

CREATE TABLE production_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Order identification
    production_order_number VARCHAR(50) UNIQUE NOT NULL,
    sales_order_id UUID,
    sales_order_line_id UUID,

    -- Product
    product_id UUID NOT NULL,
    product_code VARCHAR(100),
    product_description TEXT,

    -- Quantity
    quantity_ordered DECIMAL(18,4) NOT NULL,
    quantity_completed DECIMAL(18,4) DEFAULT 0,
    quantity_scrapped DECIMAL(18,4) DEFAULT 0,
    unit_of_measure VARCHAR(20),

    -- Manufacturing strategy
    manufacturing_strategy VARCHAR(50),
    -- MTS, MTO, CTO, ETO, POD, VDP, LEAN, DIGITAL, MODIFY_TO_ORDER

    -- Scheduling
    priority INTEGER DEFAULT 5,
    -- 1 = URGENT, 5 = NORMAL, 10 = LOW
    due_date DATE,
    planned_start_date TIMESTAMPTZ,
    planned_completion_date TIMESTAMPTZ,
    actual_start_date TIMESTAMPTZ,
    actual_completion_date TIMESTAMPTZ,

    -- Status
    status VARCHAR(20) DEFAULT 'PLANNED',
    -- PLANNED, RELEASED, IN_PROGRESS, COMPLETED, CANCELLED, ON_HOLD

    -- Routing
    routing_id UUID,
    -- Sequence of operations

    -- Costs (estimated vs actual)
    estimated_material_cost DECIMAL(18,4),
    estimated_labor_cost DECIMAL(18,4),
    estimated_overhead_cost DECIMAL(18,4),
    actual_material_cost DECIMAL(18,4),
    actual_labor_cost DECIMAL(18,4),
    actual_overhead_cost DECIMAL(18,4),

    -- Notes
    special_instructions TEXT,
    quality_requirements TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_production_order_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_production_order_facility FOREIGN KEY (facility_id) REFERENCES facilities(id)
);

CREATE INDEX idx_production_orders_tenant ON production_orders(tenant_id);
CREATE INDEX idx_production_orders_facility ON production_orders(facility_id);
CREATE INDEX idx_production_orders_status ON production_orders(status);
CREATE INDEX idx_production_orders_due_date ON production_orders(due_date);
CREATE INDEX idx_production_orders_sales_order ON production_orders(sales_order_id);

COMMENT ON TABLE production_orders IS 'High-level production orders from sales orders';

-- =====================================================
-- TABLE: operations
-- =====================================================
-- Purpose: Individual operations in a production routing

CREATE TABLE operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Operation identification
    operation_code VARCHAR(50) NOT NULL,
    operation_name VARCHAR(255) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    -- PRINTING, DIE_CUTTING, FOLDING, GLUING, COATING, LAMINATING, EMBOSSING, etc.

    -- Work center
    default_work_center_id UUID,

    -- Time standards
    setup_time_minutes DECIMAL(10,2),
    run_time_per_unit_seconds DECIMAL(10,4),

    -- Costs
    setup_cost DECIMAL(18,4),
    cost_per_unit DECIMAL(18,4),

    -- Quality
    inspection_required BOOLEAN DEFAULT FALSE,
    inspection_template_id UUID,

    -- Description
    description TEXT,
    work_instructions TEXT,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_operation_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_operation_work_center FOREIGN KEY (default_work_center_id) REFERENCES work_centers(id),
    CONSTRAINT uq_operation_code UNIQUE (tenant_id, operation_code)
);

CREATE INDEX idx_operations_tenant ON operations(tenant_id);
CREATE INDEX idx_operations_type ON operations(operation_type);
CREATE INDEX idx_operations_work_center ON operations(default_work_center_id);

COMMENT ON TABLE operations IS 'Individual operations: printing, die cutting, folding, etc.';

-- =====================================================
-- TABLE: production_runs
-- =====================================================
-- Purpose: Actual production execution on work centers

CREATE TABLE production_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Run identification
    production_run_number VARCHAR(50) UNIQUE NOT NULL,
    production_order_id UUID NOT NULL,
    work_center_id UUID NOT NULL,
    operation_id UUID NOT NULL,

    -- Operator
    operator_user_id UUID,
    operator_name VARCHAR(255),

    -- Scheduling
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,

    -- Quantity
    quantity_planned DECIMAL(18,4),
    quantity_good DECIMAL(18,4) DEFAULT 0,
    quantity_scrap DECIMAL(18,4) DEFAULT 0,
    quantity_rework DECIMAL(18,4) DEFAULT 0,

    -- Time tracking
    setup_time_minutes DECIMAL(10,2),
    run_time_minutes DECIMAL(10,2),
    downtime_minutes DECIMAL(10,2),
    downtime_reason VARCHAR(255),

    -- Status
    status VARCHAR(20) DEFAULT 'SCHEDULED',
    -- SCHEDULED, IN_PROGRESS, PAUSED, COMPLETED, CANCELLED

    -- Quality
    first_piece_approved BOOLEAN,
    first_piece_approved_by UUID,
    first_piece_approved_at TIMESTAMPTZ,

    -- Notes
    operator_notes TEXT,
    quality_notes TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_production_run_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_production_run_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_production_run_order FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
    CONSTRAINT fk_production_run_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_production_run_operation FOREIGN KEY (operation_id) REFERENCES operations(id),
    CONSTRAINT fk_production_run_operator FOREIGN KEY (operator_user_id) REFERENCES users(id)
);

CREATE INDEX idx_production_runs_tenant ON production_runs(tenant_id);
CREATE INDEX idx_production_runs_facility ON production_runs(facility_id);
CREATE INDEX idx_production_runs_order ON production_runs(production_order_id);
CREATE INDEX idx_production_runs_work_center ON production_runs(work_center_id);
CREATE INDEX idx_production_runs_status ON production_runs(status);
CREATE INDEX idx_production_runs_scheduled ON production_runs(scheduled_start, scheduled_end);

COMMENT ON TABLE production_runs IS 'Actual production execution tracking on work centers';

-- =====================================================
-- TABLE: changeover_details
-- =====================================================
-- Purpose: Track changeover/setup times between jobs (CRITICAL for lean manufacturing)

CREATE TABLE changeover_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Changeover identification
    work_center_id UUID NOT NULL,
    previous_production_run_id UUID,
    next_production_run_id UUID,

    -- Changeover type
    changeover_type VARCHAR(50),
    -- COLOR_CHANGE, SUBSTRATE_CHANGE, SIZE_CHANGE, COMPLETE_SETUP, etc.

    -- Time tracking
    changeover_start TIMESTAMPTZ NOT NULL,
    changeover_end TIMESTAMPTZ,
    total_minutes DECIMAL(10,2),

    -- Breakdown (for lean improvement)
    washup_minutes DECIMAL(10,2),
    plate_change_minutes DECIMAL(10,2),
    material_loading_minutes DECIMAL(10,2),
    calibration_minutes DECIMAL(10,2),
    first_piece_approval_minutes DECIMAL(10,2),

    -- Operator
    operator_user_id UUID,

    -- Material waste during setup
    setup_waste_sheets INTEGER,
    setup_waste_weight DECIMAL(18,4),

    -- Notes
    notes TEXT,
    improvement_opportunities TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT fk_changeover_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_changeover_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_changeover_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_changeover_previous_run FOREIGN KEY (previous_production_run_id) REFERENCES production_runs(id),
    CONSTRAINT fk_changeover_next_run FOREIGN KEY (next_production_run_id) REFERENCES production_runs(id),
    CONSTRAINT fk_changeover_operator FOREIGN KEY (operator_user_id) REFERENCES users(id)
);

CREATE INDEX idx_changeover_tenant ON changeover_details(tenant_id);
CREATE INDEX idx_changeover_work_center ON changeover_details(work_center_id);
CREATE INDEX idx_changeover_type ON changeover_details(changeover_type);
CREATE INDEX idx_changeover_date ON changeover_details(changeover_start);

COMMENT ON TABLE changeover_details IS 'Changeover/setup time tracking for lean manufacturing optimization';

-- =====================================================
-- TABLE: equipment_status_log
-- =====================================================
-- Purpose: Real-time equipment status tracking (for OEE calculations)

CREATE TABLE equipment_status_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Equipment
    work_center_id UUID NOT NULL,

    -- Status change
    status VARCHAR(20) NOT NULL,
    -- PRODUCTIVE, NON_PRODUCTIVE_SETUP, NON_PRODUCTIVE_BREAKDOWN, NON_PRODUCTIVE_NO_OPERATOR,
    -- NON_PRODUCTIVE_NO_MATERIAL, NON_PRODUCTIVE_PLANNED_DOWNTIME

    previous_status VARCHAR(20),

    -- Time
    status_start TIMESTAMPTZ NOT NULL,
    status_end TIMESTAMPTZ,
    duration_minutes DECIMAL(10,2),

    -- Production run linkage
    production_run_id UUID,

    -- Reason
    reason_code VARCHAR(50),
    reason_description TEXT,

    -- Logged by
    logged_by_user_id UUID,
    logged_by_system BOOLEAN DEFAULT FALSE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_equipment_status_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_equipment_status_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_equipment_status_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_equipment_status_run FOREIGN KEY (production_run_id) REFERENCES production_runs(id),
    CONSTRAINT fk_equipment_status_user FOREIGN KEY (logged_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_equipment_status_tenant ON equipment_status_log(tenant_id);
CREATE INDEX idx_equipment_status_work_center ON equipment_status_log(work_center_id);
CREATE INDEX idx_equipment_status_time ON equipment_status_log(status_start, status_end);
CREATE INDEX idx_equipment_status_status ON equipment_status_log(status);

COMMENT ON TABLE equipment_status_log IS 'Real-time equipment status for OEE: productive vs non-productive time';

-- =====================================================
-- TABLE: maintenance_records
-- =====================================================
-- Purpose: Preventive and corrective maintenance tracking

CREATE TABLE maintenance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Maintenance identification
    maintenance_number VARCHAR(50) UNIQUE NOT NULL,
    work_center_id UUID NOT NULL,

    -- Maintenance type
    maintenance_type VARCHAR(50) NOT NULL,
    -- PREVENTIVE, CORRECTIVE, BREAKDOWN, CALIBRATION, INSPECTION

    -- Scheduling
    scheduled_date DATE,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    duration_hours DECIMAL(10,2),

    -- Technician
    technician_user_id UUID,
    technician_name VARCHAR(255),
    vendor_technician VARCHAR(255),

    -- Work performed
    work_description TEXT NOT NULL,
    parts_replaced TEXT,
    parts_cost DECIMAL(18,4),
    labor_cost DECIMAL(18,4),
    total_cost DECIMAL(18,4),

    -- Status
    status VARCHAR(20) DEFAULT 'SCHEDULED',
    -- SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED

    -- Quality
    equipment_operational BOOLEAN,
    calibration_performed BOOLEAN,
    calibration_certificate_id VARCHAR(100),

    -- Next maintenance
    next_maintenance_due DATE,

    -- Notes
    notes TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_maintenance_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_maintenance_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_maintenance_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_maintenance_technician FOREIGN KEY (technician_user_id) REFERENCES users(id)
);

CREATE INDEX idx_maintenance_tenant ON maintenance_records(tenant_id);
CREATE INDEX idx_maintenance_work_center ON maintenance_records(work_center_id);
CREATE INDEX idx_maintenance_type ON maintenance_records(maintenance_type);
CREATE INDEX idx_maintenance_status ON maintenance_records(status);
CREATE INDEX idx_maintenance_scheduled ON maintenance_records(scheduled_date);

COMMENT ON TABLE maintenance_records IS 'Preventive and corrective maintenance tracking';

-- =====================================================
-- TABLE: asset_hierarchy
-- =====================================================
-- Purpose: Equipment asset hierarchy (parent-child relationships for complex equipment)

CREATE TABLE asset_hierarchy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Asset relationship
    parent_work_center_id UUID,
    child_work_center_id UUID NOT NULL,

    -- Relationship
    relationship_type VARCHAR(50),
    -- COMPONENT, ASSEMBLY, ATTACHMENT, etc.

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT fk_asset_hierarchy_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_asset_parent FOREIGN KEY (parent_work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_asset_child FOREIGN KEY (child_work_center_id) REFERENCES work_centers(id),
    CONSTRAINT chk_asset_not_self_reference CHECK (parent_work_center_id != child_work_center_id)
);

CREATE INDEX idx_asset_hierarchy_tenant ON asset_hierarchy(tenant_id);
CREATE INDEX idx_asset_hierarchy_parent ON asset_hierarchy(parent_work_center_id);
CREATE INDEX idx_asset_hierarchy_child ON asset_hierarchy(child_work_center_id);

COMMENT ON TABLE asset_hierarchy IS 'Equipment parent-child relationships for complex equipment assemblies';

-- =====================================================
-- TABLE: oee_calculations
-- =====================================================
-- Purpose: Overall Equipment Effectiveness (OEE) calculations (daily snapshots)

CREATE TABLE oee_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- OEE calculation
    work_center_id UUID NOT NULL,
    calculation_date DATE NOT NULL,
    shift VARCHAR(20),

    -- Time components (minutes)
    planned_production_time DECIMAL(10,2) NOT NULL,
    -- Total time equipment should be running

    downtime DECIMAL(10,2) DEFAULT 0,
    -- Unplanned stops

    runtime DECIMAL(10,2) NOT NULL,
    -- Actual time running

    -- Quantity
    total_pieces_produced INTEGER NOT NULL,
    good_pieces INTEGER NOT NULL,
    defective_pieces INTEGER NOT NULL,

    ideal_cycle_time_seconds DECIMAL(10,4),
    -- Theoretical fastest cycle time

    -- OEE components
    availability_percentage DECIMAL(8,4),
    -- (Runtime / Planned Production Time) × 100

    performance_percentage DECIMAL(8,4),
    -- (Ideal Cycle Time × Total Pieces / Runtime) × 100

    quality_percentage DECIMAL(8,4),
    -- (Good Pieces / Total Pieces) × 100

    oee_percentage DECIMAL(8,4),
    -- Availability × Performance × Quality

    -- Losses breakdown
    setup_changeover_minutes DECIMAL(10,2),
    breakdown_minutes DECIMAL(10,2),
    no_operator_minutes DECIMAL(10,2),
    no_material_minutes DECIMAL(10,2),
    speed_loss_minutes DECIMAL(10,2),
    quality_loss_pieces INTEGER,

    -- Target vs actual
    target_oee_percentage DECIMAL(8,4) DEFAULT 85.0,
    -- World-class OEE = 85%

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    calculated_by UUID,

    CONSTRAINT fk_oee_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_oee_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_oee_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT uq_oee_calculation UNIQUE (work_center_id, calculation_date, shift)
);

CREATE INDEX idx_oee_tenant ON oee_calculations(tenant_id);
CREATE INDEX idx_oee_work_center ON oee_calculations(work_center_id);
CREATE INDEX idx_oee_date ON oee_calculations(calculation_date);
CREATE INDEX idx_oee_percentage ON oee_calculations(oee_percentage);

COMMENT ON TABLE oee_calculations IS 'Daily OEE calculations: Availability × Performance × Quality';
COMMENT ON COLUMN oee_calculations.oee_percentage IS 'World-class OEE = 85% (availability × performance × quality)';

-- =====================================================
-- TABLE: production_schedules
-- =====================================================
-- Purpose: Production scheduling (Gantt chart data)

CREATE TABLE production_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Schedule
    production_order_id UUID NOT NULL,
    work_center_id UUID NOT NULL,
    operation_id UUID NOT NULL,

    -- Time
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    duration_hours DECIMAL(10,2),

    -- Sequence
    sequence_number INTEGER,

    -- Status
    status VARCHAR(20) DEFAULT 'SCHEDULED',
    -- SCHEDULED, CONFIRMED, IN_PROGRESS, COMPLETED, RESCHEDULED, CANCELLED

    -- Conflicts
    has_conflict BOOLEAN DEFAULT FALSE,
    conflict_reason TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_schedule_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_schedule_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_schedule_order FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
    CONSTRAINT fk_schedule_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_schedule_operation FOREIGN KEY (operation_id) REFERENCES operations(id)
);

CREATE INDEX idx_schedule_tenant ON production_schedules(tenant_id);
CREATE INDEX idx_schedule_work_center ON production_schedules(work_center_id);
CREATE INDEX idx_schedule_time ON production_schedules(scheduled_start, scheduled_end);
CREATE INDEX idx_schedule_status ON production_schedules(status);

COMMENT ON TABLE production_schedules IS 'Production scheduling for Gantt chart visualization';

-- =====================================================
-- TABLE: capacity_planning
-- =====================================================
-- Purpose: Capacity planning and forecasting

CREATE TABLE capacity_planning (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Planning period
    planning_date DATE NOT NULL,
    work_center_id UUID NOT NULL,

    -- Capacity
    available_hours DECIMAL(10,2) NOT NULL,
    -- Based on shifts and calendar

    planned_hours DECIMAL(10,2) DEFAULT 0,
    -- From production schedules

    actual_hours DECIMAL(10,2) DEFAULT 0,
    -- From production runs

    -- Utilization
    utilization_percentage DECIMAL(8,4),
    -- (Planned Hours / Available Hours) × 100

    -- Notes
    notes TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_capacity_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_capacity_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_capacity_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT uq_capacity_planning UNIQUE (facility_id, work_center_id, planning_date)
);

CREATE INDEX idx_capacity_tenant ON capacity_planning(tenant_id);
CREATE INDEX idx_capacity_work_center ON capacity_planning(work_center_id);
CREATE INDEX idx_capacity_date ON capacity_planning(planning_date);

COMMENT ON TABLE capacity_planning IS 'Daily capacity planning and utilization tracking';
