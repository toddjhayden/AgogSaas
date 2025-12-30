-- =====================================================
-- RLS POLICIES FOR CRM TABLES - Migration V0.0.64
-- =====================================================
-- Purpose: Add Row-Level Security policies for CRM tables
-- Author: Roy (Backend Architect)
-- Date: 2025-12-30
-- REQ: REQ-STRATEGIC-AUTO-1767116143665
-- =====================================================

-- Enable RLS on CRM tables
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_opportunity_stage_history ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CRM_CONTACTS POLICIES
-- =====================================================

-- SELECT policy: Users can view contacts in their tenant
CREATE POLICY crm_contacts_select_policy ON crm_contacts
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- INSERT policy: Users can create contacts in their tenant
CREATE POLICY crm_contacts_insert_policy ON crm_contacts
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- UPDATE policy: Users can update contacts in their tenant
CREATE POLICY crm_contacts_update_policy ON crm_contacts
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- DELETE policy: Users can delete contacts in their tenant (soft delete via update)
CREATE POLICY crm_contacts_delete_policy ON crm_contacts
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- =====================================================
-- CRM_PIPELINE_STAGES POLICIES
-- =====================================================

-- SELECT policy: Users can view pipeline stages in their tenant
CREATE POLICY crm_pipeline_stages_select_policy ON crm_pipeline_stages
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- INSERT policy: Users can create pipeline stages in their tenant
CREATE POLICY crm_pipeline_stages_insert_policy ON crm_pipeline_stages
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- UPDATE policy: Users can update pipeline stages in their tenant
CREATE POLICY crm_pipeline_stages_update_policy ON crm_pipeline_stages
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- DELETE policy: Users can delete pipeline stages in their tenant
CREATE POLICY crm_pipeline_stages_delete_policy ON crm_pipeline_stages
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- =====================================================
-- CRM_OPPORTUNITIES POLICIES
-- =====================================================

-- SELECT policy: Users can view opportunities in their tenant
CREATE POLICY crm_opportunities_select_policy ON crm_opportunities
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- INSERT policy: Users can create opportunities in their tenant
CREATE POLICY crm_opportunities_insert_policy ON crm_opportunities
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- UPDATE policy: Users can update opportunities in their tenant
CREATE POLICY crm_opportunities_update_policy ON crm_opportunities
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- DELETE policy: Users can delete opportunities in their tenant (soft delete via update)
CREATE POLICY crm_opportunities_delete_policy ON crm_opportunities
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- =====================================================
-- CRM_ACTIVITIES POLICIES
-- =====================================================

-- SELECT policy: Users can view activities in their tenant
CREATE POLICY crm_activities_select_policy ON crm_activities
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- INSERT policy: Users can create activities in their tenant
CREATE POLICY crm_activities_insert_policy ON crm_activities
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- UPDATE policy: Users can update activities in their tenant
CREATE POLICY crm_activities_update_policy ON crm_activities
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- DELETE policy: Users can delete activities in their tenant (soft delete via update)
CREATE POLICY crm_activities_delete_policy ON crm_activities
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- =====================================================
-- CRM_NOTES POLICIES
-- =====================================================

-- SELECT policy: Users can view non-private notes in their tenant, or their own private notes
CREATE POLICY crm_notes_select_policy ON crm_notes
    FOR SELECT
    USING (
        tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID
        AND (
            is_private = FALSE
            OR created_by = current_setting('app.current_user_id', TRUE)::UUID
        )
    );

-- INSERT policy: Users can create notes in their tenant
CREATE POLICY crm_notes_insert_policy ON crm_notes
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- UPDATE policy: Users can update their own notes
CREATE POLICY crm_notes_update_policy ON crm_notes
    FOR UPDATE
    USING (
        tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID
        AND created_by = current_setting('app.current_user_id', TRUE)::UUID
    )
    WITH CHECK (
        tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID
        AND created_by = current_setting('app.current_user_id', TRUE)::UUID
    );

-- DELETE policy: Users can delete their own notes
CREATE POLICY crm_notes_delete_policy ON crm_notes
    FOR DELETE
    USING (
        tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID
        AND created_by = current_setting('app.current_user_id', TRUE)::UUID
    );

-- =====================================================
-- CRM_OPPORTUNITY_STAGE_HISTORY POLICIES
-- =====================================================

-- SELECT policy: Users can view stage history in their tenant
CREATE POLICY crm_stage_history_select_policy ON crm_opportunity_stage_history
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- INSERT policy: Users can create stage history records in their tenant
CREATE POLICY crm_stage_history_insert_policy ON crm_opportunity_stage_history
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- No UPDATE or DELETE policies for stage history (audit trail - immutable)

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON POLICY crm_contacts_select_policy ON crm_contacts IS 'Allow users to view contacts in their tenant';
COMMENT ON POLICY crm_contacts_insert_policy ON crm_contacts IS 'Allow users to create contacts in their tenant';
COMMENT ON POLICY crm_contacts_update_policy ON crm_contacts IS 'Allow users to update contacts in their tenant';
COMMENT ON POLICY crm_contacts_delete_policy ON crm_contacts IS 'Allow users to delete contacts in their tenant';

COMMENT ON POLICY crm_pipeline_stages_select_policy ON crm_pipeline_stages IS 'Allow users to view pipeline stages in their tenant';
COMMENT ON POLICY crm_pipeline_stages_insert_policy ON crm_pipeline_stages IS 'Allow users to create pipeline stages in their tenant';
COMMENT ON POLICY crm_pipeline_stages_update_policy ON crm_pipeline_stages IS 'Allow users to update pipeline stages in their tenant';
COMMENT ON POLICY crm_pipeline_stages_delete_policy ON crm_pipeline_stages IS 'Allow users to delete pipeline stages in their tenant';

COMMENT ON POLICY crm_opportunities_select_policy ON crm_opportunities IS 'Allow users to view opportunities in their tenant';
COMMENT ON POLICY crm_opportunities_insert_policy ON crm_opportunities IS 'Allow users to create opportunities in their tenant';
COMMENT ON POLICY crm_opportunities_update_policy ON crm_opportunities IS 'Allow users to update opportunities in their tenant';
COMMENT ON POLICY crm_opportunities_delete_policy ON crm_opportunities IS 'Allow users to delete opportunities in their tenant';

COMMENT ON POLICY crm_activities_select_policy ON crm_activities IS 'Allow users to view activities in their tenant';
COMMENT ON POLICY crm_activities_insert_policy ON crm_activities IS 'Allow users to create activities in their tenant';
COMMENT ON POLICY crm_activities_update_policy ON crm_activities IS 'Allow users to update activities in their tenant';
COMMENT ON POLICY crm_activities_delete_policy ON crm_activities IS 'Allow users to delete activities in their tenant';

COMMENT ON POLICY crm_notes_select_policy ON crm_notes IS 'Allow users to view non-private notes or their own private notes';
COMMENT ON POLICY crm_notes_insert_policy ON crm_notes IS 'Allow users to create notes in their tenant';
COMMENT ON POLICY crm_notes_update_policy ON crm_notes IS 'Allow users to update their own notes';
COMMENT ON POLICY crm_notes_delete_policy ON crm_notes IS 'Allow users to delete their own notes';

COMMENT ON POLICY crm_stage_history_select_policy ON crm_opportunity_stage_history IS 'Allow users to view stage history in their tenant';
COMMENT ON POLICY crm_stage_history_insert_policy ON crm_opportunity_stage_history IS 'Allow users to create stage history records';
