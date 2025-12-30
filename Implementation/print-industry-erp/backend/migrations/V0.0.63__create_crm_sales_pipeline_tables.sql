-- =====================================================
-- CRM & SALES PIPELINE MANAGEMENT - Migration V0.0.63
-- =====================================================
-- Purpose: Integrated CRM with contact management, opportunity tracking,
--          sales pipeline management, activity logging, and notes
-- Author: Roy (Backend Architect)
-- Date: 2025-12-30
-- REQ: REQ-STRATEGIC-AUTO-1767116143665
-- =====================================================

-- =====================================================
-- TABLE: crm_contacts
-- =====================================================
-- Purpose: Individual contacts within customer organizations

CREATE TABLE crm_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Contact identification
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    suffix VARCHAR(20), -- Jr., Sr., III, etc.

    -- Associated customer (optional - contacts can exist without customer)
    customer_id UUID,

    -- Job information
    job_title VARCHAR(255),
    department VARCHAR(100),

    -- Contact information
    email_primary VARCHAR(255),
    email_secondary VARCHAR(255),
    phone_office VARCHAR(50),
    phone_mobile VARCHAR(50),
    phone_home VARCHAR(50),

    -- Social/web presence
    linkedin_url TEXT,
    twitter_handle VARCHAR(100),
    website_url TEXT,

    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),

    -- Classification
    contact_type VARCHAR(50), -- DECISION_MAKER, INFLUENCER, GATEKEEPER, USER, TECHNICAL, FINANCIAL
    lead_source VARCHAR(50), -- WEBSITE, REFERRAL, TRADE_SHOW, COLD_CALL, LINKEDIN, PARTNER
    industry VARCHAR(100),
    company_size VARCHAR(50), -- SMALL, MEDIUM, LARGE, ENTERPRISE

    -- Preferences
    preferred_contact_method VARCHAR(50), -- EMAIL, PHONE, TEXT, LINKEDIN
    communication_frequency VARCHAR(50), -- WEEKLY, BI_WEEKLY, MONTHLY, QUARTERLY
    timezone VARCHAR(50),
    language_code VARCHAR(10) DEFAULT 'en-US',

    -- Interests & needs
    interests TEXT[], -- Array of interest tags
    pain_points TEXT[], -- Array of pain point tags
    buying_authority VARCHAR(50), -- NONE, INFLUENCER, DECISION_MAKER, FINAL_APPROVER

    -- Engagement tracking
    last_contact_date TIMESTAMPTZ,
    last_contact_type VARCHAR(50), -- EMAIL, PHONE, MEETING, DEMO
    next_follow_up_date TIMESTAMPTZ,
    engagement_score INTEGER, -- 0-100 score based on activity

    -- Ownership
    owner_user_id UUID, -- Sales rep who owns this contact

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    do_not_contact BOOLEAN DEFAULT FALSE,
    email_opt_out BOOLEAN DEFAULT FALSE,

    -- Marketing consent (GDPR compliance)
    marketing_consent BOOLEAN DEFAULT FALSE,
    marketing_consent_date TIMESTAMPTZ,
    marketing_consent_source VARCHAR(100),

    -- Notes
    notes TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_crm_contact_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_crm_contact_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_crm_contact_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE INDEX idx_crm_contacts_tenant ON crm_contacts(tenant_id);
CREATE INDEX idx_crm_contacts_customer ON crm_contacts(customer_id);
CREATE INDEX idx_crm_contacts_owner ON crm_contacts(owner_user_id);
CREATE INDEX idx_crm_contacts_email ON crm_contacts(email_primary) WHERE email_primary IS NOT NULL;
CREATE INDEX idx_crm_contacts_last_name ON crm_contacts(last_name);
CREATE INDEX idx_crm_contacts_type ON crm_contacts(contact_type);
CREATE INDEX idx_crm_contacts_active ON crm_contacts(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_crm_contacts_follow_up ON crm_contacts(next_follow_up_date) WHERE next_follow_up_date IS NOT NULL;

COMMENT ON TABLE crm_contacts IS 'CRM contact records with engagement tracking and GDPR compliance';

-- =====================================================
-- TABLE: crm_pipeline_stages
-- =====================================================
-- Purpose: Configurable sales pipeline stages

CREATE TABLE crm_pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Stage definition
    stage_name VARCHAR(100) NOT NULL,
    stage_description TEXT,

    -- Ordering
    sequence_number INTEGER NOT NULL,

    -- Stage properties
    probability_percentage INTEGER NOT NULL DEFAULT 0, -- 0-100, likelihood of closing
    is_closed_won BOOLEAN DEFAULT FALSE,
    is_closed_lost BOOLEAN DEFAULT FALSE,

    -- Actions & automation
    required_fields JSONB, -- Fields that must be completed to enter this stage
    auto_actions JSONB, -- Automated actions when stage is entered

    -- Time tracking
    target_days_in_stage INTEGER, -- Expected time to spend in this stage

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_crm_pipeline_stage_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_pipeline_stage_name UNIQUE (tenant_id, stage_name),
    CONSTRAINT uq_pipeline_stage_sequence UNIQUE (tenant_id, sequence_number),
    CONSTRAINT chk_probability_range CHECK (probability_percentage >= 0 AND probability_percentage <= 100)
);

CREATE INDEX idx_crm_pipeline_stages_tenant ON crm_pipeline_stages(tenant_id);
CREATE INDEX idx_crm_pipeline_stages_sequence ON crm_pipeline_stages(sequence_number);
CREATE INDEX idx_crm_pipeline_stages_active ON crm_pipeline_stages(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE crm_pipeline_stages IS 'Configurable sales pipeline stages with probability tracking';

-- =====================================================
-- TABLE: crm_opportunities
-- =====================================================
-- Purpose: Sales opportunities in the pipeline

CREATE TABLE crm_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Opportunity identification
    opportunity_number VARCHAR(50) NOT NULL,
    opportunity_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Associated records
    customer_id UUID, -- Can be null for leads not yet converted
    primary_contact_id UUID,

    -- Pipeline stage
    pipeline_stage_id UUID NOT NULL,
    stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Financial details
    estimated_value DECIMAL(18,4) NOT NULL,
    currency_code VARCHAR(3) DEFAULT 'USD',
    probability_percentage INTEGER, -- Inherited from stage, can be overridden
    weighted_value DECIMAL(18,4) GENERATED ALWAYS AS (
        estimated_value * COALESCE(probability_percentage, 0) / 100.0
    ) STORED,

    -- Timing
    expected_close_date DATE,
    actual_close_date DATE,

    -- Classification
    opportunity_type VARCHAR(50), -- NEW_BUSINESS, EXISTING_CUSTOMER, UPSELL, RENEWAL
    lead_source VARCHAR(50), -- WEBSITE, REFERRAL, TRADE_SHOW, COLD_CALL, LINKEDIN, PARTNER

    -- Products/services
    product_categories TEXT[], -- Array of product category tags
    primary_product_id UUID, -- Reference to products table

    -- Competition
    competitors TEXT[], -- Array of competitor names
    our_competitive_advantage TEXT,

    -- Decision criteria
    decision_makers UUID[], -- Array of contact IDs
    decision_criteria TEXT,
    budget_confirmed BOOLEAN DEFAULT FALSE,
    authority_confirmed BOOLEAN DEFAULT FALSE,
    need_confirmed BOOLEAN DEFAULT FALSE,
    timeline_confirmed BOOLEAN DEFAULT FALSE,

    -- Ownership
    owner_user_id UUID NOT NULL, -- Primary sales rep
    team_members UUID[], -- Array of user IDs for sales team

    -- Engagement
    last_activity_date TIMESTAMPTZ,
    next_action_date TIMESTAMPTZ,
    next_action_description TEXT,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN', -- OPEN, WON, LOST, ABANDONED
    lost_reason VARCHAR(100), -- PRICE, COMPETITOR, TIMING, NO_BUDGET, NO_DECISION
    lost_reason_notes TEXT,

    -- Conversion
    quote_id UUID, -- Reference to quotes table if quote generated
    sales_order_id UUID, -- Reference to sales_orders table if converted

    -- Tags & custom fields
    tags TEXT[],
    custom_fields JSONB,

    -- Notes
    notes TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_crm_opportunity_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_crm_opportunity_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_crm_opportunity_contact FOREIGN KEY (primary_contact_id) REFERENCES crm_contacts(id),
    CONSTRAINT fk_crm_opportunity_stage FOREIGN KEY (pipeline_stage_id) REFERENCES crm_pipeline_stages(id),
    CONSTRAINT fk_crm_opportunity_product FOREIGN KEY (primary_product_id) REFERENCES products(id),
    CONSTRAINT fk_crm_opportunity_owner FOREIGN KEY (owner_user_id) REFERENCES users(id),
    CONSTRAINT fk_crm_opportunity_quote FOREIGN KEY (quote_id) REFERENCES quotes(id),
    CONSTRAINT fk_crm_opportunity_order FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
    CONSTRAINT uq_opportunity_number UNIQUE (tenant_id, opportunity_number),
    CONSTRAINT chk_opportunity_probability CHECK (probability_percentage IS NULL OR (probability_percentage >= 0 AND probability_percentage <= 100))
);

CREATE INDEX idx_crm_opportunities_tenant ON crm_opportunities(tenant_id);
CREATE INDEX idx_crm_opportunities_customer ON crm_opportunities(customer_id);
CREATE INDEX idx_crm_opportunities_contact ON crm_opportunities(primary_contact_id);
CREATE INDEX idx_crm_opportunities_stage ON crm_opportunities(pipeline_stage_id);
CREATE INDEX idx_crm_opportunities_owner ON crm_opportunities(owner_user_id);
CREATE INDEX idx_crm_opportunities_status ON crm_opportunities(status);
CREATE INDEX idx_crm_opportunities_close_date ON crm_opportunities(expected_close_date) WHERE expected_close_date IS NOT NULL;
CREATE INDEX idx_crm_opportunities_value ON crm_opportunities(estimated_value);
CREATE INDEX idx_crm_opportunities_weighted_value ON crm_opportunities(weighted_value);
CREATE INDEX idx_crm_opportunities_next_action ON crm_opportunities(next_action_date) WHERE next_action_date IS NOT NULL;

COMMENT ON TABLE crm_opportunities IS 'Sales opportunities with pipeline tracking and BANT qualification';

-- =====================================================
-- TABLE: crm_activities
-- =====================================================
-- Purpose: Activity log for contacts and opportunities

CREATE TABLE crm_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Activity type
    activity_type VARCHAR(50) NOT NULL, -- CALL, EMAIL, MEETING, DEMO, PROPOSAL, FOLLOW_UP, NOTE
    activity_subject VARCHAR(255) NOT NULL,
    activity_description TEXT,

    -- Related records
    opportunity_id UUID,
    contact_id UUID,
    customer_id UUID,

    -- Timing
    activity_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_minutes INTEGER,

    -- Meeting/call specifics
    location VARCHAR(255),
    attendees UUID[], -- Array of user IDs who attended
    external_attendees TEXT[], -- Array of external contact names/emails

    -- Outcome
    outcome VARCHAR(50), -- COMPLETED, SCHEDULED, CANCELLED, NO_SHOW
    next_steps TEXT,

    -- Communication tracking
    email_sent BOOLEAN DEFAULT FALSE,
    email_opened BOOLEAN DEFAULT FALSE,
    email_clicked BOOLEAN DEFAULT FALSE,

    -- Ownership
    owner_user_id UUID NOT NULL,

    -- Attachments
    attachment_urls TEXT[],

    -- Status
    is_completed BOOLEAN DEFAULT FALSE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_crm_activity_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_crm_activity_opportunity FOREIGN KEY (opportunity_id) REFERENCES crm_opportunities(id),
    CONSTRAINT fk_crm_activity_contact FOREIGN KEY (contact_id) REFERENCES crm_contacts(id),
    CONSTRAINT fk_crm_activity_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_crm_activity_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE INDEX idx_crm_activities_tenant ON crm_activities(tenant_id);
CREATE INDEX idx_crm_activities_opportunity ON crm_activities(opportunity_id);
CREATE INDEX idx_crm_activities_contact ON crm_activities(contact_id);
CREATE INDEX idx_crm_activities_customer ON crm_activities(customer_id);
CREATE INDEX idx_crm_activities_owner ON crm_activities(owner_user_id);
CREATE INDEX idx_crm_activities_type ON crm_activities(activity_type);
CREATE INDEX idx_crm_activities_date ON crm_activities(activity_date);
CREATE INDEX idx_crm_activities_completed ON crm_activities(is_completed);

COMMENT ON TABLE crm_activities IS 'Activity tracking for contacts, opportunities, and customers';

-- =====================================================
-- TABLE: crm_notes
-- =====================================================
-- Purpose: Notes attached to various CRM entities

CREATE TABLE crm_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Note content
    note_title VARCHAR(255),
    note_content TEXT NOT NULL,

    -- Related records (at least one must be set)
    opportunity_id UUID,
    contact_id UUID,
    customer_id UUID,
    activity_id UUID,

    -- Classification
    note_type VARCHAR(50), -- GENERAL, FOLLOW_UP, IMPORTANT, DECISION, OBJECTION
    is_pinned BOOLEAN DEFAULT FALSE,

    -- Visibility
    is_private BOOLEAN DEFAULT FALSE, -- Only visible to creator

    -- Ownership
    created_by UUID NOT NULL,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT fk_crm_note_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_crm_note_opportunity FOREIGN KEY (opportunity_id) REFERENCES crm_opportunities(id),
    CONSTRAINT fk_crm_note_contact FOREIGN KEY (contact_id) REFERENCES crm_contacts(id),
    CONSTRAINT fk_crm_note_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_crm_note_activity FOREIGN KEY (activity_id) REFERENCES crm_activities(id),
    CONSTRAINT fk_crm_note_creator FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT chk_note_has_parent CHECK (
        opportunity_id IS NOT NULL OR
        contact_id IS NOT NULL OR
        customer_id IS NOT NULL OR
        activity_id IS NOT NULL
    )
);

CREATE INDEX idx_crm_notes_tenant ON crm_notes(tenant_id);
CREATE INDEX idx_crm_notes_opportunity ON crm_notes(opportunity_id);
CREATE INDEX idx_crm_notes_contact ON crm_notes(contact_id);
CREATE INDEX idx_crm_notes_customer ON crm_notes(customer_id);
CREATE INDEX idx_crm_notes_activity ON crm_notes(activity_id);
CREATE INDEX idx_crm_notes_creator ON crm_notes(created_by);
CREATE INDEX idx_crm_notes_pinned ON crm_notes(is_pinned) WHERE is_pinned = TRUE;

COMMENT ON TABLE crm_notes IS 'Notes attached to CRM entities with privacy controls';

-- =====================================================
-- TABLE: crm_opportunity_stage_history
-- =====================================================
-- Purpose: Track opportunity movement through pipeline stages

CREATE TABLE crm_opportunity_stage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    opportunity_id UUID NOT NULL,
    from_stage_id UUID,
    to_stage_id UUID NOT NULL,

    -- Timing
    stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    days_in_previous_stage INTEGER,

    -- Changed by
    changed_by_user_id UUID NOT NULL,

    -- Reason (optional)
    change_reason TEXT,

    CONSTRAINT fk_crm_stage_history_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_crm_stage_history_opportunity FOREIGN KEY (opportunity_id) REFERENCES crm_opportunities(id),
    CONSTRAINT fk_crm_stage_history_from_stage FOREIGN KEY (from_stage_id) REFERENCES crm_pipeline_stages(id),
    CONSTRAINT fk_crm_stage_history_to_stage FOREIGN KEY (to_stage_id) REFERENCES crm_pipeline_stages(id),
    CONSTRAINT fk_crm_stage_history_user FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_crm_stage_history_tenant ON crm_opportunity_stage_history(tenant_id);
CREATE INDEX idx_crm_stage_history_opportunity ON crm_opportunity_stage_history(opportunity_id);
CREATE INDEX idx_crm_stage_history_date ON crm_opportunity_stage_history(stage_changed_at);

COMMENT ON TABLE crm_opportunity_stage_history IS 'Historical tracking of opportunity pipeline stage changes';

-- =====================================================
-- DEFAULT PIPELINE STAGES
-- =====================================================
-- Insert default pipeline stages for each tenant (to be done via application logic)
-- Example stages: Lead, Qualified, Proposal, Negotiation, Closed Won, Closed Lost

-- =====================================================
-- VIEWS FOR ANALYTICS
-- =====================================================

-- Pipeline summary by stage
CREATE VIEW crm_pipeline_summary AS
SELECT
    o.tenant_id,
    s.stage_name,
    s.sequence_number,
    COUNT(o.id) AS opportunity_count,
    SUM(o.estimated_value) AS total_value,
    SUM(o.weighted_value) AS total_weighted_value,
    AVG(o.probability_percentage) AS avg_probability
FROM crm_opportunities o
INNER JOIN crm_pipeline_stages s ON o.pipeline_stage_id = s.id
WHERE o.status = 'OPEN'
    AND o.deleted_at IS NULL
GROUP BY o.tenant_id, s.id, s.stage_name, s.sequence_number
ORDER BY s.sequence_number;

COMMENT ON VIEW crm_pipeline_summary IS 'Summary of open opportunities by pipeline stage';

-- Opportunities requiring action
CREATE VIEW crm_opportunities_requiring_action AS
SELECT
    o.id,
    o.tenant_id,
    o.opportunity_number,
    o.opportunity_name,
    o.customer_id,
    c.customer_name,
    o.pipeline_stage_id,
    s.stage_name,
    o.owner_user_id,
    o.estimated_value,
    o.expected_close_date,
    o.next_action_date,
    o.next_action_description,
    CASE
        WHEN o.next_action_date < NOW() THEN 'OVERDUE'
        WHEN o.next_action_date < NOW() + INTERVAL '3 days' THEN 'DUE_SOON'
        ELSE 'SCHEDULED'
    END AS action_urgency
FROM crm_opportunities o
LEFT JOIN customers c ON o.customer_id = c.id
INNER JOIN crm_pipeline_stages s ON o.pipeline_stage_id = s.id
WHERE o.status = 'OPEN'
    AND o.deleted_at IS NULL
    AND o.next_action_date IS NOT NULL
ORDER BY o.next_action_date;

COMMENT ON VIEW crm_opportunities_requiring_action IS 'Opportunities with upcoming or overdue actions';

-- Sales rep performance
CREATE VIEW crm_sales_rep_performance AS
SELECT
    o.tenant_id,
    o.owner_user_id,
    COUNT(o.id) FILTER (WHERE o.status = 'OPEN') AS open_opportunities,
    SUM(o.estimated_value) FILTER (WHERE o.status = 'OPEN') AS pipeline_value,
    SUM(o.weighted_value) FILTER (WHERE o.status = 'OPEN') AS weighted_pipeline_value,
    COUNT(o.id) FILTER (WHERE o.status = 'WON' AND o.actual_close_date >= DATE_TRUNC('quarter', NOW())) AS qtd_wins,
    SUM(o.estimated_value) FILTER (WHERE o.status = 'WON' AND o.actual_close_date >= DATE_TRUNC('quarter', NOW())) AS qtd_revenue,
    COUNT(o.id) FILTER (WHERE o.status = 'WON' AND o.actual_close_date >= DATE_TRUNC('year', NOW())) AS ytd_wins,
    SUM(o.estimated_value) FILTER (WHERE o.status = 'WON' AND o.actual_close_date >= DATE_TRUNC('year', NOW())) AS ytd_revenue,
    ROUND(
        100.0 * COUNT(o.id) FILTER (WHERE o.status = 'WON') /
        NULLIF(COUNT(o.id) FILTER (WHERE o.status IN ('WON', 'LOST')), 0),
        2
    ) AS win_rate_percentage
FROM crm_opportunities o
WHERE o.deleted_at IS NULL
GROUP BY o.tenant_id, o.owner_user_id;

COMMENT ON VIEW crm_sales_rep_performance IS 'Performance metrics by sales representative';
