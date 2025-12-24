-- =====================================================
-- Migration: V0.0.19 - Add tenant_id to ml_model_weights
-- =====================================================
-- Description: Fixes CRITICAL multi-tenant isolation issue
-- Date: 2025-12-23
-- Requirement: REQ-STRATEGIC-AUTO-1766527153113
-- Critique Issue: Sylvia identified ml_model_weights missing tenant_id
-- =====================================================

-- Step 1: Add tenant_id column
ALTER TABLE ml_model_weights
ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Step 2: Populate tenant_id for existing rows (if any)
-- Use first tenant as default for existing global models
DO $$
DECLARE
  first_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO first_tenant_id
  FROM tenants
  ORDER BY created_at ASC
  LIMIT 1;

  IF first_tenant_id IS NOT NULL THEN
    UPDATE ml_model_weights
    SET tenant_id = first_tenant_id
    WHERE tenant_id IS NULL;
  END IF;
END $$;

-- Step 3: Make tenant_id NOT NULL
ALTER TABLE ml_model_weights
ALTER COLUMN tenant_id SET NOT NULL;

-- Step 4: Drop old unique constraint on model_name
ALTER TABLE ml_model_weights
DROP CONSTRAINT IF EXISTS ml_model_weights_model_name_key;

-- Step 5: Add composite unique constraint (tenant_id, model_name)
ALTER TABLE ml_model_weights
ADD CONSTRAINT ml_model_weights_tenant_model_unique
UNIQUE (tenant_id, model_name);

-- Step 6: Add foreign key constraint
ALTER TABLE ml_model_weights
ADD CONSTRAINT fk_ml_model_weights_tenant
FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE;

-- Step 7: Create index for faster tenant-based lookups
CREATE INDEX IF NOT EXISTS idx_ml_model_weights_tenant
ON ml_model_weights(tenant_id);

-- Step 8: Update comments
COMMENT ON COLUMN ml_model_weights.tenant_id IS 'Tenant ID for multi-tenant ML model isolation';
COMMENT ON CONSTRAINT ml_model_weights_tenant_model_unique ON ml_model_weights IS 'Each tenant can have one instance of each model type';

-- Step 9: Grant permissions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agogsaas_user') THEN
    -- Permissions already granted in previous migration
    NULL;
  END IF;
END $$;

-- =====================================================
-- Migration Complete
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration V0.0.19 completed: tenant_id added to ml_model_weights table';
  RAISE NOTICE '  - CRITICAL FIX: ML models now isolated per tenant';
  RAISE NOTICE '  - Composite unique constraint: (tenant_id, model_name)';
  RAISE NOTICE '  - Foreign key constraint added with CASCADE delete';
END $$;
