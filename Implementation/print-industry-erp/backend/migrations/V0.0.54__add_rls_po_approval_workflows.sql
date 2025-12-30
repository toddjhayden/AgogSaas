/**
 * Migration: Add Row-Level Security (RLS) - PO Approval Workflow Module
 * Version: V0.0.54
 * REQ: REQ-STRATEGIC-AUTO-1767084329260
 * Priority: P1 - HIGH (Business process data protection)
 *
 * Tables covered (10 tables):
 * - po_approval_workflows (Workflow definitions)
 * - po_approval_workflow_steps (Workflow step definitions)
 * - po_approval_history (Approval history audit trail)
 * - user_approval_authority (User approval limits - single entry)
 * - user_approval_authorities (Multi-tier approval authorities)
 * - user_delegations (Approval delegations)
 * - purchase_order_approvals (PO approval records)
 * - purchase_order_approval_audit (Approval audit log)
 * - approval_rules (Approval rules)
 * - approval_notifications (Approval notifications)
 *
 * Security Impact:
 * - Prevents cross-tenant business process data exposure
 * - Protects approval authority limits and delegation chains
 * - Enforces tenant isolation via app.current_tenant_id
 * - Complies with SOC 2 audit trail requirements
 *
 * Risk if not deployed:
 * - Business process data cross-tenant leakage
 * - Spending authority limits disclosure
 * - Approval workflow exposure
 */

-- =====================================================
-- ENABLE ROW-LEVEL SECURITY
-- =====================================================

ALTER TABLE po_approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_approval_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_approval_authority ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_approval_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_approval_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_notifications ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES - WORKFLOW MANAGEMENT
-- =====================================================

-- PO Approval Workflows
CREATE POLICY po_approval_workflows_tenant_isolation ON po_approval_workflows
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY po_approval_workflows_tenant_isolation ON po_approval_workflows IS
  'RLS: PO approval workflow isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- PO Approval Workflow Steps (child of workflows)
CREATE POLICY po_approval_workflow_steps_tenant_isolation ON po_approval_workflow_steps
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM po_approval_workflows w
      WHERE w.id = po_approval_workflow_steps.workflow_id
        AND w.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM po_approval_workflows w
      WHERE w.id = po_approval_workflow_steps.workflow_id
        AND w.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  );

COMMENT ON POLICY po_approval_workflow_steps_tenant_isolation ON po_approval_workflow_steps IS
  'RLS: PO approval workflow steps via parent workflow (REQ-STRATEGIC-AUTO-1767084329260)';

-- PO Approval History
CREATE POLICY po_approval_history_tenant_isolation ON po_approval_history
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY po_approval_history_tenant_isolation ON po_approval_history IS
  'RLS: PO approval history audit trail isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CREATE RLS POLICIES - USER AUTHORITIES
-- =====================================================

-- User Approval Authority (single entry per user)
CREATE POLICY user_approval_authority_tenant_isolation ON user_approval_authority
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY user_approval_authority_tenant_isolation ON user_approval_authority IS
  'RLS: User approval authority limits isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- User Approval Authorities (multi-tier)
CREATE POLICY user_approval_authorities_tenant_isolation ON user_approval_authorities
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY user_approval_authorities_tenant_isolation ON user_approval_authorities IS
  'RLS: User approval authorities multi-tier isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- User Delegations
CREATE POLICY user_delegations_tenant_isolation ON user_delegations
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY user_delegations_tenant_isolation ON user_delegations IS
  'RLS: User delegation isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CREATE RLS POLICIES - APPROVAL RECORDS
-- =====================================================

-- Purchase Order Approvals
CREATE POLICY purchase_order_approvals_tenant_isolation ON purchase_order_approvals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_approvals.purchase_order_id
        AND po.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_approvals.purchase_order_id
        AND po.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  );

COMMENT ON POLICY purchase_order_approvals_tenant_isolation ON purchase_order_approvals IS
  'RLS: PO approvals via parent purchase order (REQ-STRATEGIC-AUTO-1767084329260)';

-- Purchase Order Approval Audit
CREATE POLICY purchase_order_approval_audit_tenant_isolation ON purchase_order_approval_audit
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY purchase_order_approval_audit_tenant_isolation ON purchase_order_approval_audit IS
  'RLS: PO approval audit log isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CREATE RLS POLICIES - APPROVAL RULES & NOTIFICATIONS
-- =====================================================

-- Approval Rules
CREATE POLICY approval_rules_tenant_isolation ON approval_rules
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY approval_rules_tenant_isolation ON approval_rules IS
  'RLS: Approval rules isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- Approval Notifications
CREATE POLICY approval_notifications_tenant_isolation ON approval_notifications
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY approval_notifications_tenant_isolation ON approval_notifications IS
  'RLS: Approval notifications isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index foreign keys used in RLS policies
CREATE INDEX IF NOT EXISTS idx_po_approval_workflow_steps_workflow_id ON po_approval_workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_approvals_purchase_order_id ON purchase_order_approvals(purchase_order_id);

-- Index tenant_id columns for optimal RLS performance
CREATE INDEX IF NOT EXISTS idx_po_approval_workflows_tenant_id ON po_approval_workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_po_approval_history_tenant_id ON po_approval_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_approval_authority_tenant_id ON user_approval_authority(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_approval_authorities_tenant_id ON user_approval_authorities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_delegations_tenant_id ON user_delegations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_approval_audit_tenant_id ON purchase_order_approval_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approval_rules_tenant_id ON approval_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approval_notifications_tenant_id ON approval_notifications(tenant_id);

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Verify all 10 tables have RLS enabled
  SELECT COUNT(*)
  INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'po_approval_workflows', 'po_approval_workflow_steps', 'po_approval_history',
      'user_approval_authority', 'user_approval_authorities', 'user_delegations',
      'purchase_order_approvals', 'purchase_order_approval_audit',
      'approval_rules', 'approval_notifications'
    )
    AND rowsecurity = true;

  IF table_count != 10 THEN
    RAISE EXCEPTION 'RLS verification failed: Expected 10 PO approval workflow tables with RLS enabled, got %', table_count;
  END IF;

  -- Verify all 10 policies exist
  SELECT COUNT(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'po_approval_workflows', 'po_approval_workflow_steps', 'po_approval_history',
      'user_approval_authority', 'user_approval_authorities', 'user_delegations',
      'purchase_order_approvals', 'purchase_order_approval_audit',
      'approval_rules', 'approval_notifications'
    );

  IF policy_count < 10 THEN
    RAISE EXCEPTION 'Policy verification failed: Expected 10 PO approval workflow policies, got %', policy_count;
  END IF;

  RAISE NOTICE '✅ RLS verification passed: All 10 PO approval workflow tables have RLS enabled with proper policies';
  RAISE NOTICE '✅ SOC 2 compliance: Business process data and audit trails are now protected at database layer';
END $$;
