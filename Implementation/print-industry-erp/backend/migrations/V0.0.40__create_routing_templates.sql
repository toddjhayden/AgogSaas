-- =====================================================
-- MIGRATION: V0.0.40 - Create Routing Templates
-- =====================================================
-- Purpose: Add routing tables for production planning automation
-- Critical for: Automated production run generation from production orders
-- Author: Roy (Backend Architect)
-- Date: 2025-12-29
-- REQ: REQ-STRATEGIC-AUTO-1767048328658
-- Sylvia Critique: HIGH PRIORITY - Blocks Phase 2-5 scheduling work
-- =====================================================

-- =====================================================
-- TABLE: routing_templates
-- =====================================================
-- Purpose: Reusable production routings for products
-- Example: "Standard Brochure Routing" defines the sequence of operations

CREATE TABLE routing_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Routing identification
    routing_code VARCHAR(50) NOT NULL,
    routing_name VARCHAR(255) NOT NULL,
    routing_version INTEGER DEFAULT 1,

    -- Product linkage (optional default routing for product category)
    product_category VARCHAR(100),
    -- "BROCHURES", "BUSINESS_CARDS", "LABELS", "PACKAGING", etc.

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_routing_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_routing_code UNIQUE (tenant_id, routing_code, routing_version)
);

-- Indexes for performance
CREATE INDEX idx_routing_templates_tenant ON routing_templates(tenant_id);
CREATE INDEX idx_routing_templates_active ON routing_templates(tenant_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_routing_templates_category ON routing_templates(product_category) WHERE product_category IS NOT NULL;

COMMENT ON TABLE routing_templates IS 'Reusable production routings defining operation sequences for products';
COMMENT ON COLUMN routing_templates.routing_version IS 'Version number for routing template changes (allows historical tracking)';
COMMENT ON COLUMN routing_templates.product_category IS 'Optional category linkage (BROCHURES, BUSINESS_CARDS, etc.)';

-- =====================================================
-- TABLE: routing_operations
-- =====================================================
-- Purpose: Operations within a routing with sequencing
-- Example: Brochure routing has: 1. PRINTING → 2. DIE_CUTTING → 3. FOLDING → 4. PACKAGING

CREATE TABLE routing_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    routing_id UUID NOT NULL,
    operation_id UUID NOT NULL,

    -- Sequencing
    sequence_number INTEGER NOT NULL,
    -- 10, 20, 30, 40... (allows insertion of steps without renumbering)

    -- Time standards (override operation defaults if specified)
    setup_time_minutes DECIMAL(10,2),
    run_time_per_unit_seconds DECIMAL(10,4),

    -- Work center override (override operation default if specified)
    work_center_id UUID,

    -- Yield and scrap calculations
    yield_percentage DECIMAL(5,2) DEFAULT 100.0,
    -- Expected good output percentage (95% = 5% expected scrap)
    scrap_percentage DECIMAL(5,2) DEFAULT 0.0,
    -- Expected scrap percentage

    -- Advanced sequencing
    is_concurrent BOOLEAN DEFAULT FALSE,
    -- Can run in parallel with previous operation
    predecessor_operation_id UUID,
    -- For complex dependencies (operation B requires operation A completion)

    -- Instructions
    description TEXT,
    work_instructions TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_routing_op_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_routing_op_routing FOREIGN KEY (routing_id) REFERENCES routing_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_routing_op_operation FOREIGN KEY (operation_id) REFERENCES operations(id),
    CONSTRAINT fk_routing_op_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_routing_op_predecessor FOREIGN KEY (predecessor_operation_id) REFERENCES routing_operations(id),
    CONSTRAINT uq_routing_op_sequence UNIQUE (routing_id, sequence_number),
    CONSTRAINT chk_routing_op_yield CHECK (yield_percentage >= 0 AND yield_percentage <= 100),
    CONSTRAINT chk_routing_op_scrap CHECK (scrap_percentage >= 0 AND scrap_percentage <= 100)
);

-- Indexes for scheduling queries
CREATE INDEX idx_routing_operations_tenant ON routing_operations(tenant_id);
CREATE INDEX idx_routing_operations_routing ON routing_operations(routing_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_routing_operations_sequence ON routing_operations(routing_id, sequence_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_routing_operations_operation ON routing_operations(operation_id);
CREATE INDEX idx_routing_operations_predecessor ON routing_operations(predecessor_operation_id) WHERE predecessor_operation_id IS NOT NULL;

COMMENT ON TABLE routing_operations IS 'Operations within routings with sequencing for automated production run generation';
COMMENT ON COLUMN routing_operations.sequence_number IS 'Sequence number (10, 20, 30...) allowing insertions without renumbering';
COMMENT ON COLUMN routing_operations.is_concurrent IS 'TRUE if operation can run in parallel with previous operation';
COMMENT ON COLUMN routing_operations.predecessor_operation_id IS 'Required predecessor operation for complex dependencies';
COMMENT ON COLUMN routing_operations.yield_percentage IS 'Expected good output percentage (95% = 5% expected scrap)';

-- =====================================================
-- UPDATE: production_orders table
-- =====================================================
-- Add routing_id foreign key to production_orders (if not already exists)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'production_orders'
        AND column_name = 'routing_id'
    ) THEN
        ALTER TABLE production_orders
        ADD COLUMN routing_id UUID,
        ADD CONSTRAINT fk_production_order_routing FOREIGN KEY (routing_id) REFERENCES routing_templates(id);

        CREATE INDEX idx_production_orders_routing ON production_orders(routing_id) WHERE routing_id IS NOT NULL;
    END IF;
END
$$;

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================
-- Insert sample routing template for testing
-- Uncomment for development/testing environments

/*
INSERT INTO routing_templates (tenant_id, routing_code, routing_name, product_category, description)
SELECT
    id,
    'BROCHURE-STD-001',
    'Standard Brochure Routing (4-Step)',
    'BROCHURES',
    'Standard routing for 4-color brochures: Printing → Die Cutting → Folding → Packaging'
FROM tenants
LIMIT 1;

INSERT INTO routing_operations (tenant_id, routing_id, operation_id, sequence_number, setup_time_minutes, run_time_per_unit_seconds, yield_percentage)
SELECT
    rt.tenant_id,
    rt.id,
    op.id,
    10,
    30.0,
    0.02,
    98.0
FROM routing_templates rt
CROSS JOIN operations op
WHERE rt.routing_code = 'BROCHURE-STD-001'
AND op.operation_type = 'PRINTING'
LIMIT 1;
*/

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this to verify migration success:
-- SELECT COUNT(*) FROM routing_templates;
-- SELECT COUNT(*) FROM routing_operations;
