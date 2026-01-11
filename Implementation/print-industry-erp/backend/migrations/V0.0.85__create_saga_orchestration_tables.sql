-- Migration: Create saga orchestration tables for distributed transaction management
-- REQ-1767541724201-s8kck - Implement End-to-End Demand-to-Cash Saga Pattern
-- Purpose: Implement saga pattern for long-running business transactions with compensation support

-- ============================================================================
-- SAGA DEFINITIONS TABLE
-- Stores saga workflow definitions (like demand-to-cash, procure-to-pay, etc.)
-- ============================================================================
CREATE TABLE saga_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  saga_name VARCHAR(100) NOT NULL,
  description TEXT,
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Saga configuration
  steps_config JSONB NOT NULL, -- Array of step definitions with forward and compensation actions
  timeout_seconds INT DEFAULT 3600,
  max_retries INT DEFAULT 3,
  retry_delay_seconds INT DEFAULT 60,

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by UUID,
  deleted_at TIMESTAMP,
  deleted_by UUID,

  CONSTRAINT fk_saga_definitions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT uq_saga_definitions_name_version UNIQUE (tenant_id, saga_name, version)
);

CREATE INDEX idx_saga_definitions_tenant ON saga_definitions(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_saga_definitions_active ON saga_definitions(tenant_id, is_active) WHERE deleted_at IS NULL;

COMMENT ON TABLE saga_definitions IS 'Saga workflow definitions with step configurations and compensation logic';
COMMENT ON COLUMN saga_definitions.steps_config IS 'JSON array of steps: [{stepName, serviceUrl, forwardAction, compensationAction, timeout, retryable}]';

-- ============================================================================
-- SAGA INSTANCES TABLE
-- Tracks individual saga execution instances
-- ============================================================================
CREATE TABLE saga_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  saga_definition_id UUID NOT NULL,
  saga_name VARCHAR(100) NOT NULL,
  saga_version INT NOT NULL,

  -- Execution state
  status VARCHAR(30) NOT NULL CHECK (status IN (
    'started', 'running', 'compensating', 'completed', 'failed', 'compensated'
  )),
  current_step_index INT NOT NULL DEFAULT 0,

  -- Context data
  context_entity_type VARCHAR(50), -- e.g., 'sales_quote', 'purchase_order'
  context_entity_id UUID,
  saga_context JSONB NOT NULL DEFAULT '{}'::jsonb, -- Shared data across saga steps

  -- Timestamps
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  compensated_at TIMESTAMP,

  -- Error tracking
  error_message TEXT,
  error_stack TEXT,

  -- SLA and monitoring
  deadline TIMESTAMP,
  retry_count INT NOT NULL DEFAULT 0,

  -- Metadata
  created_by UUID,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_saga_instances_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_saga_instances_definition FOREIGN KEY (saga_definition_id) REFERENCES saga_definitions(id)
);

CREATE INDEX idx_saga_instances_tenant ON saga_instances(tenant_id);
CREATE INDEX idx_saga_instances_status ON saga_instances(tenant_id, status);
CREATE INDEX idx_saga_instances_definition ON saga_instances(saga_definition_id);
CREATE INDEX idx_saga_instances_entity ON saga_instances(tenant_id, context_entity_type, context_entity_id);
CREATE INDEX idx_saga_instances_deadline ON saga_instances(deadline) WHERE status IN ('running', 'compensating');

COMMENT ON TABLE saga_instances IS 'Individual saga execution instances with current state';
COMMENT ON COLUMN saga_instances.saga_context IS 'Shared data accumulated across saga steps (inputs/outputs)';

-- ============================================================================
-- SAGA STEP EXECUTIONS TABLE
-- Tracks execution of individual steps within a saga instance
-- ============================================================================
CREATE TABLE saga_step_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  saga_instance_id UUID NOT NULL,
  step_index INT NOT NULL,
  step_name VARCHAR(100) NOT NULL,

  -- Execution state
  status VARCHAR(30) NOT NULL CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'compensating', 'compensated', 'compensation_failed'
  )),
  execution_type VARCHAR(20) NOT NULL CHECK (execution_type IN ('forward', 'compensation')),

  -- Step data
  input_data JSONB,
  output_data JSONB,

  -- Timestamps
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  compensated_at TIMESTAMP,

  -- Error tracking
  error_message TEXT,
  error_stack TEXT,
  retry_count INT NOT NULL DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_saga_step_executions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_saga_step_executions_instance FOREIGN KEY (saga_instance_id) REFERENCES saga_instances(id) ON DELETE CASCADE,
  CONSTRAINT uq_saga_step_executions_instance_step UNIQUE (saga_instance_id, step_index, execution_type)
);

CREATE INDEX idx_saga_step_executions_tenant ON saga_step_executions(tenant_id);
CREATE INDEX idx_saga_step_executions_instance ON saga_step_executions(saga_instance_id);
CREATE INDEX idx_saga_step_executions_status ON saga_step_executions(saga_instance_id, status);

COMMENT ON TABLE saga_step_executions IS 'Individual step execution records within saga instances';
COMMENT ON COLUMN saga_step_executions.execution_type IS 'Whether this is a forward action or compensation action';

-- ============================================================================
-- SAGA EVENT LOG TABLE
-- Audit trail of all saga events for debugging and compliance
-- ============================================================================
CREATE TABLE saga_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  saga_instance_id UUID NOT NULL,
  step_execution_id UUID,

  -- Event details
  event_type VARCHAR(50) NOT NULL, -- e.g., 'saga_started', 'step_completed', 'compensation_started'
  event_data JSONB,

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID,

  CONSTRAINT fk_saga_event_log_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_saga_event_log_instance FOREIGN KEY (saga_instance_id) REFERENCES saga_instances(id) ON DELETE CASCADE,
  CONSTRAINT fk_saga_event_log_step FOREIGN KEY (step_execution_id) REFERENCES saga_step_executions(id) ON DELETE CASCADE
);

CREATE INDEX idx_saga_event_log_tenant ON saga_event_log(tenant_id);
CREATE INDEX idx_saga_event_log_instance ON saga_event_log(saga_instance_id, created_at);
CREATE INDEX idx_saga_event_log_type ON saga_event_log(tenant_id, event_type, created_at);

COMMENT ON TABLE saga_event_log IS 'Complete audit trail of all saga events for debugging and compliance';

-- ============================================================================
-- RLS POLICIES
-- Multi-tenant isolation for all saga tables
-- ============================================================================

ALTER TABLE saga_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE saga_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE saga_step_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE saga_event_log ENABLE ROW LEVEL SECURITY;

-- Saga definitions RLS
CREATE POLICY saga_definitions_tenant_isolation ON saga_definitions
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Saga instances RLS
CREATE POLICY saga_instances_tenant_isolation ON saga_instances
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Saga step executions RLS
CREATE POLICY saga_step_executions_tenant_isolation ON saga_step_executions
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Saga event log RLS
CREATE POLICY saga_event_log_tenant_isolation ON saga_event_log
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- TRIGGERS
-- Auto-update timestamp triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_saga_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER saga_definitions_updated_at
  BEFORE UPDATE ON saga_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_saga_updated_at();

CREATE TRIGGER saga_instances_updated_at
  BEFORE UPDATE ON saga_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_saga_updated_at();

CREATE TRIGGER saga_step_executions_updated_at
  BEFORE UPDATE ON saga_step_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_saga_updated_at();
