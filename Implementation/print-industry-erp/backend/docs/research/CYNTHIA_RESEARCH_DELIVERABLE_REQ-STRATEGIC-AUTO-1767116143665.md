# Research Deliverable: Integrated CRM & Sales Pipeline Management

**REQ Number:** REQ-STRATEGIC-AUTO-1767116143665
**Feature:** Integrated CRM & Sales Pipeline Management
**Researcher:** Cynthia (Research Specialist)
**Date:** 2025-12-30
**Status:** COMPLETE

---

## Executive Summary

This research analyzes the current state of CRM and sales pipeline functionality in the Print Industry ERP system and identifies gaps for implementing a comprehensive integrated CRM solution. The existing system has strong **customer master data**, **quote-to-order** workflow, and **customer portal** capabilities, but lacks **lead management**, **opportunity tracking**, **sales pipeline stages**, **activity logging**, and **relationship intelligence** features essential for modern CRM.

**Key Findings:**
- ✅ **Strong Foundation:** Customer master data (17 tables), quote automation, and customer portal authentication
- ❌ **Critical Gaps:** No leads, opportunities, pipeline stages, activities/interactions, or contact hierarchy
- 🔄 **Integration Points:** Quote management, customer portal, sales rep assignments ready for CRM extension
- 📊 **Quick Win:** Extend existing quote workflow to create opportunity pipeline

---

## 1. Current State Analysis

### 1.1 Existing Customer Management Infrastructure

#### **Database Schema (V0.0.6: Sales, Materials & Procurement Module)**

The system has comprehensive customer master data:

```sql
-- customers table (print-industry-erp/backend/database/schemas/sales-materials-procurement-module.sql:649-732)
CREATE TABLE customers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,

    -- Core identification
    customer_code VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    customer_type VARCHAR(50), -- DIRECT, DISTRIBUTOR, RESELLER, END_USER, etc.

    -- Contact information
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),

    -- Addresses (billing & shipping)
    billing_address_line1 VARCHAR(255),
    shipping_address_line1 VARCHAR(255),
    -- ... full address fields

    -- Sales assignments
    sales_rep_user_id UUID,
    csr_user_id UUID,

    -- Financial management
    payment_terms VARCHAR(50) DEFAULT 'NET_30',
    credit_limit DECIMAL(18,4),
    credit_hold BOOLEAN DEFAULT FALSE,

    -- Performance tracking
    lifetime_revenue DECIMAL(18,4) DEFAULT 0,
    ytd_revenue DECIMAL(18,4) DEFAULT 0,
    average_order_value DECIMAL(18,4),

    -- SCD Type 2 support
    effective_from_date DATE NOT NULL,
    effective_to_date DATE,
    is_current_version BOOLEAN NOT NULL
);
```

**Supporting Tables:**
1. **customer_products** - Customer-specific product codes and specs
2. **customer_pricing** - Contract pricing with quantity breaks
3. **quotes** - Sales quotes/estimates with margin tracking
4. **quote_lines** - Line items with automated costing
5. **sales_orders** - Customer orders
6. **sales_order_lines** - Order line items
7. **pricing_rules** - Dynamic pricing engine

**Total: 17 tables in sales/materials/procurement module**

#### **Quote-to-Order Workflow**

**File:** `print-industry-erp/backend/src/modules/sales/services/quote-management.service.ts`

**Capabilities:**
- ✅ Automated quote creation with margin calculations
- ✅ Quote line pricing integration (customer-specific, volume discounts)
- ✅ Margin validation (15% minimum, approval thresholds at 20% and 10%)
- ✅ Quote-to-sales-order conversion
- ✅ Multi-currency support

**Quote Status Lifecycle:**
```
DRAFT → ISSUED → ACCEPTED/REJECTED/EXPIRED → CONVERTED_TO_ORDER
```

**Business Rules (line 34-36):**
```typescript
private readonly MINIMUM_MARGIN_PERCENTAGE = 15;
private readonly MANAGER_APPROVAL_THRESHOLD = 20; // < 20% requires manager approval
private readonly VP_APPROVAL_THRESHOLD = 10; // < 10% requires VP approval
```

#### **Customer Portal & Authentication**

**Files:**
- `src/modules/customer-portal/customer-portal.module.ts`
- `src/modules/customer-auth/customer-auth.module.ts`
- `src/graphql/schema/customer-portal.graphql`

**Features:**
- ✅ Self-service registration
- ✅ MFA enrollment (TOTP with QR codes and backup codes)
- ✅ Email verification
- ✅ Password reset workflow
- ✅ Quote request submission
- ✅ Quote approval (converts to sales order)
- ✅ Reorder functionality
- ✅ Artwork upload with virus scanning
- ✅ Proof approval/revision workflow

**Customer User Roles:**
```graphql
enum CustomerUserRole {
  CUSTOMER_ADMIN
  CUSTOMER_USER
  APPROVER
}
```

### 1.2 GraphQL Schema Coverage

**Existing Customer Queries (sales-materials.graphql:1159-1172):**
```graphql
customers(
  tenantId: ID!
  customerType: CustomerType
  isActive: Boolean
  salesRepUserId: ID
  includeHistory: Boolean  # SCD Type 2 support
  limit: Int = 100
  offset: Int = 0
): [Customer!]!

customer(id: ID!): Customer
customerByCode(tenantId: ID!, customerCode: String!): Customer
customerAsOf(customerCode: String!, tenantId: ID!, asOfDate: Date!): Customer
customerHistory(customerCode: String!, tenantId: ID!): [Customer!]!
```

**Existing Customer Mutations (sales-materials.graphql:1336-1352):**
```graphql
createCustomer(...)
updateCustomer(...)
deleteCustomer(id: ID!): Boolean!
```

---

## 2. Gap Analysis: Missing CRM Capabilities

### 2.1 Lead Management (CRITICAL GAP)

**Status:** ❌ **NOT IMPLEMENTED**

**Required Capabilities:**
1. **Lead Capture**
   - Web form submissions
   - Trade show/event leads
   - Marketing campaign responses
   - Inbound inquiries
   - Partner referrals

2. **Lead Qualification**
   - Lead scoring (based on company size, industry, engagement)
   - BANT qualification (Budget, Authority, Need, Timeline)
   - Lead source tracking
   - Lead status lifecycle

3. **Lead Routing**
   - Territory-based assignment
   - Round-robin distribution
   - Sales rep workload balancing

**Recommended Database Schema:**
```sql
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Lead identification
    lead_number VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    industry VARCHAR(100),
    employee_count_range VARCHAR(50), -- '1-10', '11-50', '51-200', etc.
    annual_revenue_range VARCHAR(50),

    -- Contact information
    contact_first_name VARCHAR(100),
    contact_last_name VARCHAR(100),
    contact_title VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),

    -- Address
    address_line1 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),

    -- Lead management
    lead_source VARCHAR(100), -- 'Website Form', 'Trade Show', 'Referral', 'Cold Call', etc.
    lead_source_campaign VARCHAR(255),
    lead_status VARCHAR(50) DEFAULT 'NEW',
    -- NEW, CONTACTED, QUALIFIED, UNQUALIFIED, CONVERTED, LOST

    lead_score INTEGER DEFAULT 0, -- 0-100 scoring
    qualification_notes TEXT,

    -- Assignment
    assigned_to_user_id UUID,
    assigned_at TIMESTAMPTZ,

    -- Conversion
    converted_to_customer_id UUID,
    converted_to_opportunity_id UUID,
    converted_at TIMESTAMPTZ,
    lost_reason VARCHAR(255),

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_lead_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_lead_assigned_to FOREIGN KEY (assigned_to_user_id) REFERENCES users(id),
    CONSTRAINT fk_lead_converted_customer FOREIGN KEY (converted_to_customer_id) REFERENCES customers(id),
    CONSTRAINT uq_lead_number UNIQUE (tenant_id, lead_number)
);

CREATE INDEX idx_leads_tenant ON leads(tenant_id);
CREATE INDEX idx_leads_status ON leads(lead_status);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to_user_id);
CREATE INDEX idx_leads_source ON leads(lead_source);
CREATE INDEX idx_leads_score ON leads(lead_score DESC);
```

### 2.2 Opportunity & Pipeline Management (CRITICAL GAP)

**Status:** ❌ **NOT IMPLEMENTED**

**Current Workaround:** Quotes are being used as proxy for opportunities, but lack:
- ❌ Pipeline stage tracking
- ❌ Win/loss analysis
- ❌ Probability-weighted forecasting
- ❌ Competitor tracking
- ❌ Deal stakeholder mapping

**Required Capabilities:**
1. **Opportunity Lifecycle**
   - Pipeline stages (Prospecting → Qualification → Proposal → Negotiation → Closed Won/Lost)
   - Stage-specific required fields
   - Stage duration tracking
   - Win/loss reasons

2. **Sales Forecasting**
   - Probability-weighted pipeline value
   - Expected close date tracking
   - Historical close rate by stage

3. **Competitive Intelligence**
   - Competitor tracking on deals
   - Win/loss analysis by competitor

**Recommended Database Schema:**
```sql
CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Opportunity identification
    opportunity_number VARCHAR(50) UNIQUE NOT NULL,
    opportunity_name VARCHAR(255) NOT NULL,

    -- Related entities
    customer_id UUID, -- NULL if still a lead
    lead_id UUID, -- Source lead if converted

    -- Opportunity details
    opportunity_type VARCHAR(50), -- 'NEW_BUSINESS', 'EXISTING_CUSTOMER', 'RENEWAL', 'UPSELL'
    description TEXT,

    -- Pipeline management
    pipeline_stage VARCHAR(50) NOT NULL DEFAULT 'PROSPECTING',
    -- PROSPECTING, QUALIFICATION, NEEDS_ANALYSIS, PROPOSAL, NEGOTIATION, CLOSED_WON, CLOSED_LOST

    probability_percentage INTEGER DEFAULT 10, -- 0-100
    stage_entered_at TIMESTAMPTZ,
    days_in_stage INTEGER,

    -- Financial
    estimated_value DECIMAL(18,4) NOT NULL,
    currency_code VARCHAR(3) DEFAULT 'USD',
    weighted_value DECIMAL(18,4), -- estimated_value * probability / 100

    -- Timeline
    expected_close_date DATE,
    actual_close_date DATE,

    -- Assignment
    owner_user_id UUID NOT NULL, -- Sales rep
    sales_team_id UUID,

    -- Competitive intelligence
    primary_competitor VARCHAR(255),
    competitive_notes TEXT,

    -- Win/loss tracking
    is_closed BOOLEAN DEFAULT FALSE,
    close_reason VARCHAR(50), -- 'WON', 'LOST_PRICE', 'LOST_TIMING', 'LOST_COMPETITOR', 'LOST_NO_BUDGET'
    close_notes TEXT,

    -- Quote linkage (existing integration point!)
    primary_quote_id UUID,

    -- Conversion to sales order
    converted_to_sales_order_id UUID,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_opportunity_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_opportunity_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_opportunity_lead FOREIGN KEY (lead_id) REFERENCES leads(id),
    CONSTRAINT fk_opportunity_owner FOREIGN KEY (owner_user_id) REFERENCES users(id),
    CONSTRAINT fk_opportunity_quote FOREIGN KEY (primary_quote_id) REFERENCES quotes(id),
    CONSTRAINT fk_opportunity_sales_order FOREIGN KEY (converted_to_sales_order_id) REFERENCES sales_orders(id),
    CONSTRAINT uq_opportunity_number UNIQUE (tenant_id, opportunity_number)
);

CREATE INDEX idx_opportunities_tenant ON opportunities(tenant_id);
CREATE INDEX idx_opportunities_customer ON opportunities(customer_id);
CREATE INDEX idx_opportunities_stage ON opportunities(pipeline_stage);
CREATE INDEX idx_opportunities_owner ON opportunities(owner_user_id);
CREATE INDEX idx_opportunities_close_date ON opportunities(expected_close_date);
CREATE INDEX idx_opportunities_is_closed ON opportunities(is_closed);
```

**Pipeline Stage Configuration Table:**
```sql
CREATE TABLE pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    stage_name VARCHAR(50) NOT NULL,
    stage_order INTEGER NOT NULL,
    default_probability_percentage INTEGER,
    is_closed_stage BOOLEAN DEFAULT FALSE,
    requires_close_reason BOOLEAN DEFAULT FALSE,

    -- Stage-specific requirements
    required_fields JSONB, -- ['customer_id', 'estimated_value', 'expected_close_date']

    is_active BOOLEAN DEFAULT TRUE,

    CONSTRAINT fk_pipeline_stage_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_pipeline_stage UNIQUE (tenant_id, stage_name)
);
```

### 2.3 Contact Hierarchy & Multi-Contact Management (CRITICAL GAP)

**Status:** ❌ **NOT IMPLEMENTED**

**Current Limitation:** `customers` table has only **ONE** `primary_contact_name/email/phone`. Enterprise customers have multiple contacts with different roles (decision makers, influencers, gatekeepers, users).

**Required Capabilities:**
1. **Contact Roles**
   - Decision Maker
   - Economic Buyer
   - Technical Evaluator
   - Champion/Coach
   - Gatekeeper
   - End User

2. **Contact Hierarchy**
   - Reporting structure
   - Department/division

3. **Contact Segmentation**
   - Active/inactive contacts
   - Preferred communication method
   - Do not contact flags

**Recommended Database Schema:**
```sql
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Contact belongs to either a customer or a lead
    customer_id UUID,
    lead_id UUID,

    -- Personal information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(255), -- Computed: "first_name last_name"
    salutation VARCHAR(20), -- 'Mr.', 'Ms.', 'Dr.', etc.

    -- Professional information
    title VARCHAR(100), -- 'Purchasing Manager', 'VP Operations', etc.
    department VARCHAR(100),
    reports_to_contact_id UUID, -- Organizational hierarchy

    -- Contact information
    email VARCHAR(255),
    mobile_phone VARCHAR(50),
    business_phone VARCHAR(50),
    business_phone_extension VARCHAR(20),

    -- Address (if different from customer)
    mailing_address_line1 VARCHAR(255),
    mailing_city VARCHAR(100),
    mailing_state VARCHAR(100),
    mailing_postal_code VARCHAR(20),
    mailing_country VARCHAR(100),

    -- Contact role & influence
    contact_role VARCHAR(50), -- 'DECISION_MAKER', 'INFLUENCER', 'GATEKEEPER', 'CHAMPION', 'USER'
    decision_making_authority VARCHAR(50), -- 'FINAL_DECISION', 'RECOMMEND', 'EVALUATE', 'NONE'

    -- Preferences
    preferred_contact_method VARCHAR(50), -- 'EMAIL', 'PHONE', 'SMS'
    preferred_language VARCHAR(10) DEFAULT 'en-US',

    -- Status flags
    is_primary_contact BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    do_not_contact BOOLEAN DEFAULT FALSE,
    email_opt_out BOOLEAN DEFAULT FALSE,

    -- Social/professional links
    linkedin_url VARCHAR(500),

    -- Notes
    notes TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_contact_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_contact_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_contact_lead FOREIGN KEY (lead_id) REFERENCES leads(id),
    CONSTRAINT fk_contact_reports_to FOREIGN KEY (reports_to_contact_id) REFERENCES contacts(id),
    CONSTRAINT chk_contact_entity CHECK (
        (customer_id IS NOT NULL AND lead_id IS NULL) OR
        (customer_id IS NULL AND lead_id IS NOT NULL)
    )
);

CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_customer ON contacts(customer_id);
CREATE INDEX idx_contacts_lead ON contacts(lead_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_is_primary ON contacts(is_primary_contact);
CREATE INDEX idx_contacts_role ON contacts(contact_role);
```

### 2.4 Activity & Interaction Tracking (CRITICAL GAP)

**Status:** ❌ **NOT IMPLEMENTED**

**Problem:** No way to log:
- Sales calls
- Emails sent/received
- Meetings
- Notes
- Tasks/follow-ups
- Quote discussions
- Customer interactions

**Required Capabilities:**
1. **Activity Types**
   - Phone calls
   - Emails
   - Meetings
   - Tasks
   - Notes
   - Events

2. **Activity Management**
   - Scheduled activities (tasks, meetings)
   - Completed activities (calls, notes)
   - Activity reminders
   - Activity timeline/history

3. **Integration Points**
   - Link activities to leads, opportunities, customers, contacts, quotes, orders

**Recommended Database Schema:**
```sql
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Activity classification
    activity_type VARCHAR(50) NOT NULL,
    -- 'CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE', 'EVENT'

    activity_subtype VARCHAR(50),
    -- For CALL: 'INBOUND', 'OUTBOUND'
    -- For EMAIL: 'SENT', 'RECEIVED'
    -- For MEETING: 'IN_PERSON', 'VIDEO_CALL', 'PHONE_CONFERENCE'

    -- Activity content
    subject VARCHAR(500) NOT NULL,
    description TEXT,

    -- Related entities (polymorphic associations)
    related_to_lead_id UUID,
    related_to_opportunity_id UUID,
    related_to_customer_id UUID,
    related_to_contact_id UUID,
    related_to_quote_id UUID,
    related_to_sales_order_id UUID,

    -- Scheduling (for tasks, meetings, events)
    scheduled_start_datetime TIMESTAMPTZ,
    scheduled_end_datetime TIMESTAMPTZ,
    duration_minutes INTEGER,

    -- Completion tracking
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    completion_notes TEXT,

    -- Assignment
    assigned_to_user_id UUID,
    created_by_user_id UUID,

    -- Meeting/call participants
    participants JSONB, -- [{ user_id: 'uuid', contact_id: 'uuid', name: 'John Doe' }]

    -- Priority (for tasks)
    priority VARCHAR(20), -- 'LOW', 'NORMAL', 'HIGH', 'URGENT'

    -- Reminder
    has_reminder BOOLEAN DEFAULT FALSE,
    reminder_datetime TIMESTAMPTZ,

    -- Email tracking (if email activity)
    email_message_id VARCHAR(500),
    email_from VARCHAR(255),
    email_to JSONB, -- ['email1@example.com', 'email2@example.com']
    email_cc JSONB,

    -- Call tracking (if phone call)
    call_direction VARCHAR(20), -- 'INBOUND', 'OUTBOUND'
    call_duration_seconds INTEGER,
    call_outcome VARCHAR(50), -- 'CONNECTED', 'VOICEMAIL', 'NO_ANSWER', 'BUSY'

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_activity_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_activity_lead FOREIGN KEY (related_to_lead_id) REFERENCES leads(id),
    CONSTRAINT fk_activity_opportunity FOREIGN KEY (related_to_opportunity_id) REFERENCES opportunities(id),
    CONSTRAINT fk_activity_customer FOREIGN KEY (related_to_customer_id) REFERENCES customers(id),
    CONSTRAINT fk_activity_contact FOREIGN KEY (related_to_contact_id) REFERENCES contacts(id),
    CONSTRAINT fk_activity_quote FOREIGN KEY (related_to_quote_id) REFERENCES quotes(id),
    CONSTRAINT fk_activity_sales_order FOREIGN KEY (related_to_sales_order_id) REFERENCES sales_orders(id),
    CONSTRAINT fk_activity_assigned_to FOREIGN KEY (assigned_to_user_id) REFERENCES users(id),
    CONSTRAINT fk_activity_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_activities_tenant ON activities(tenant_id);
CREATE INDEX idx_activities_type ON activities(activity_type);
CREATE INDEX idx_activities_lead ON activities(related_to_lead_id);
CREATE INDEX idx_activities_opportunity ON activities(related_to_opportunity_id);
CREATE INDEX idx_activities_customer ON activities(related_to_customer_id);
CREATE INDEX idx_activities_contact ON activities(related_to_contact_id);
CREATE INDEX idx_activities_assigned_to ON activities(assigned_to_user_id);
CREATE INDEX idx_activities_scheduled_start ON activities(scheduled_start_datetime);
CREATE INDEX idx_activities_is_completed ON activities(is_completed);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
```

### 2.5 Sales Analytics & Reporting (PARTIAL GAP)

**Status:** ⚠️ **PARTIALLY IMPLEMENTED**

**Existing Analytics:**
- ✅ Customer lifetime revenue tracking (`customers.lifetime_revenue`, `ytd_revenue`)
- ✅ Average order value (`customers.average_order_value`)
- ✅ Quote margin analysis (quote-management.service.ts)
- ✅ Vendor performance tracking (V0.0.26 vendor scorecards)

**Missing Analytics:**
- ❌ Sales funnel conversion rates (Lead → Opportunity → Quote → Order)
- ❌ Pipeline velocity (average days in each stage)
- ❌ Win/loss analysis
- ❌ Sales rep performance leaderboard
- ❌ Lead source ROI
- ❌ Opportunity forecast accuracy
- ❌ Activity metrics (calls per day, emails sent, meetings scheduled)

**Recommended Analytics Views:**
```sql
-- Sales Funnel Conversion Metrics
CREATE MATERIALIZED VIEW sales_funnel_metrics AS
SELECT
    tenant_id,
    DATE_TRUNC('month', created_at) as month,

    -- Lead metrics
    COUNT(*) FILTER (WHERE entity_type = 'LEAD') as total_leads,
    COUNT(*) FILTER (WHERE entity_type = 'LEAD' AND converted_at IS NOT NULL) as leads_converted,
    ROUND(
        COUNT(*) FILTER (WHERE entity_type = 'LEAD' AND converted_at IS NOT NULL)::DECIMAL /
        NULLIF(COUNT(*) FILTER (WHERE entity_type = 'LEAD'), 0) * 100,
        2
    ) as lead_conversion_rate_pct,

    -- Opportunity metrics
    COUNT(*) FILTER (WHERE entity_type = 'OPPORTUNITY') as total_opportunities,
    COUNT(*) FILTER (WHERE entity_type = 'OPPORTUNITY' AND close_reason = 'WON') as opportunities_won,
    ROUND(
        COUNT(*) FILTER (WHERE entity_type = 'OPPORTUNITY' AND close_reason = 'WON')::DECIMAL /
        NULLIF(COUNT(*) FILTER (WHERE entity_type = 'OPPORTUNITY' AND is_closed = TRUE), 0) * 100,
        2
    ) as win_rate_pct,

    -- Quote metrics
    COUNT(*) FILTER (WHERE entity_type = 'QUOTE') as total_quotes,
    COUNT(*) FILTER (WHERE entity_type = 'QUOTE' AND status = 'CONVERTED_TO_ORDER') as quotes_converted,

    -- Revenue metrics
    SUM(revenue_amount) FILTER (WHERE entity_type = 'ORDER') as total_revenue
FROM (
    SELECT tenant_id, 'LEAD' as entity_type, created_at, converted_at, NULL as close_reason, FALSE as is_closed, NULL as status, 0 as revenue_amount FROM leads
    UNION ALL
    SELECT tenant_id, 'OPPORTUNITY', created_at, NULL, close_reason, is_closed, NULL, estimated_value FROM opportunities
    UNION ALL
    SELECT tenant_id, 'QUOTE', created_at, converted_at, NULL, FALSE, status, total_amount FROM quotes
    UNION ALL
    SELECT tenant_id, 'ORDER', created_at, NULL, NULL, FALSE, status, total_amount FROM sales_orders
) combined
GROUP BY tenant_id, DATE_TRUNC('month', created_at);

-- Pipeline Velocity Metrics
CREATE MATERIALIZED VIEW pipeline_velocity_metrics AS
SELECT
    tenant_id,
    pipeline_stage,
    AVG(days_in_stage) as avg_days_in_stage,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_in_stage) as median_days_in_stage,
    COUNT(*) as opportunities_in_stage
FROM opportunities
WHERE is_closed = FALSE
GROUP BY tenant_id, pipeline_stage;
```

---

## 3. Integration Points & Extension Strategy

### 3.1 Existing Integration Opportunities

#### **Quote → Opportunity Mapping (IMMEDIATE WIN)**

**Current State:**
- `quotes` table already tracks customer, sales rep, amounts, status
- Quote status includes `ACCEPTED`, `REJECTED`, `EXPIRED`, `CONVERTED_TO_ORDER`

**Proposed Enhancement:**
```sql
-- Add opportunity linkage to existing quotes table
ALTER TABLE quotes ADD COLUMN opportunity_id UUID REFERENCES opportunities(id);
CREATE INDEX idx_quotes_opportunity ON quotes(opportunity_id);

-- Migration: Create opportunities from existing quotes
INSERT INTO opportunities (
    tenant_id,
    opportunity_number,
    opportunity_name,
    customer_id,
    pipeline_stage,
    estimated_value,
    currency_code,
    owner_user_id,
    primary_quote_id,
    expected_close_date,
    created_at
)
SELECT
    q.tenant_id,
    'OPP-' || q.quote_number,
    'Quote ' || q.quote_number || ' - ' || c.customer_name,
    q.customer_id,
    CASE q.status
        WHEN 'DRAFT' THEN 'PROPOSAL'
        WHEN 'ISSUED' THEN 'NEGOTIATION'
        WHEN 'ACCEPTED' THEN 'CLOSED_WON'
        WHEN 'REJECTED' THEN 'CLOSED_LOST'
        WHEN 'EXPIRED' THEN 'CLOSED_LOST'
        WHEN 'CONVERTED_TO_ORDER' THEN 'CLOSED_WON'
        ELSE 'PROPOSAL'
    END,
    q.total_amount,
    q.quote_currency_code,
    q.sales_rep_user_id,
    q.id,
    q.expiration_date,
    q.created_at
FROM quotes q
JOIN customers c ON c.id = q.customer_id
WHERE q.created_at > NOW() - INTERVAL '1 year'; -- Only migrate recent quotes
```

#### **Customer Portal → Lead Capture Integration**

**Current State:**
- Customer portal has self-service registration (`customerRegister` mutation)
- Quote request workflow (`customerRequestQuote` mutation)

**Proposed Enhancement:**
```graphql
# New mutation for anonymous quote requests (becomes a lead)
mutation anonymousRequestQuote(
  companyName: String!
  contactFirstName: String!
  contactLastName: String!
  contactEmail: String!
  contactPhone: String
  productCategory: String!
  quantityEstimate: Float
  projectDescription: String
  requestedDeliveryDate: Date
) {
  # Creates:
  # 1. Lead record
  # 2. Activity (type: 'NOTE', subject: 'Quote request submitted')
  # 3. Notification to sales rep
}
```

#### **Sales Rep Assignment → Activity Tracking**

**Current State:**
- Customers have `sales_rep_user_id` and `csr_user_id`
- Quotes track `sales_rep_user_id`
- Users table exists with roles

**Proposed Enhancement:**
```sql
-- Add sales territory management
CREATE TABLE sales_territories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    territory_name VARCHAR(100) NOT NULL,
    territory_type VARCHAR(50), -- 'GEOGRAPHIC', 'INDUSTRY', 'ACCOUNT_SIZE'

    -- Geographic boundaries (for GEOGRAPHIC type)
    included_states JSONB,
    included_postal_codes JSONB,

    -- Industry assignment (for INDUSTRY type)
    included_industries JSONB,

    -- Account size (for ACCOUNT_SIZE type)
    min_annual_revenue DECIMAL(18,4),
    max_annual_revenue DECIMAL(18,4),

    -- Assignment
    assigned_to_user_id UUID REFERENCES users(id),

    is_active BOOLEAN DEFAULT TRUE,

    CONSTRAINT fk_territory_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Auto-assign leads to territories
CREATE OR REPLACE FUNCTION auto_assign_lead_to_territory()
RETURNS TRIGGER AS $$
BEGIN
    -- Find matching territory based on state, industry, revenue
    UPDATE leads
    SET assigned_to_user_id = (
        SELECT st.assigned_to_user_id
        FROM sales_territories st
        WHERE st.tenant_id = NEW.tenant_id
          AND st.is_active = TRUE
          AND (
              st.included_states ? NEW.state OR
              st.included_industries ? NEW.industry
          )
        LIMIT 1
    )
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_assign_lead
AFTER INSERT ON leads
FOR EACH ROW
EXECUTE FUNCTION auto_assign_lead_to_territory();
```

### 3.2 GraphQL Schema Extensions

#### **New CRM Types & Queries**

```graphql
# ============================================
# LEAD MANAGEMENT
# ============================================

type Lead {
  id: ID!
  tenantId: ID!
  leadNumber: String!
  companyName: String!
  contactFirstName: String
  contactLastName: String
  contactEmail: String
  contactPhone: String
  leadSource: String
  leadStatus: LeadStatus!
  leadScore: Int
  assignedTo: User
  convertedToCustomer: Customer
  convertedToOpportunity: Opportunity
  activities: [Activity!]!
  createdAt: DateTime!
}

enum LeadStatus {
  NEW
  CONTACTED
  QUALIFIED
  UNQUALIFIED
  CONVERTED
  LOST
}

# ============================================
# OPPORTUNITY MANAGEMENT
# ============================================

type Opportunity {
  id: ID!
  tenantId: ID!
  opportunityNumber: String!
  opportunityName: String!
  customer: Customer
  lead: Lead
  pipelineStage: PipelineStage!
  probabilityPercentage: Int!
  estimatedValue: Float!
  weightedValue: Float!
  expectedCloseDate: Date
  owner: User!
  primaryQuote: Quote
  activities: [Activity!]!
  contacts: [Contact!]!
  createdAt: DateTime!
}

enum PipelineStage {
  PROSPECTING
  QUALIFICATION
  NEEDS_ANALYSIS
  PROPOSAL
  NEGOTIATION
  CLOSED_WON
  CLOSED_LOST
}

# ============================================
# CONTACT MANAGEMENT
# ============================================

type Contact {
  id: ID!
  tenantId: ID!
  customer: Customer
  lead: Lead
  firstName: String!
  lastName: String!
  fullName: String!
  title: String
  email: String
  mobilePhone: String
  businessPhone: String
  contactRole: ContactRole
  isPrimaryContact: Boolean!
  isActive: Boolean!
  activities: [Activity!]!
  createdAt: DateTime!
}

enum ContactRole {
  DECISION_MAKER
  INFLUENCER
  GATEKEEPER
  CHAMPION
  USER
}

# ============================================
# ACTIVITY TRACKING
# ============================================

type Activity {
  id: ID!
  tenantId: ID!
  activityType: ActivityType!
  subject: String!
  description: String
  relatedToLead: Lead
  relatedToOpportunity: Opportunity
  relatedToCustomer: Customer
  relatedToContact: Contact
  scheduledStartDatetime: DateTime
  isCompleted: Boolean!
  assignedTo: User
  priority: ActivityPriority
  createdAt: DateTime!
}

enum ActivityType {
  CALL
  EMAIL
  MEETING
  TASK
  NOTE
  EVENT
}

enum ActivityPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}

# ============================================
# QUERIES
# ============================================

extend type Query {
  # Lead queries
  leads(
    tenantId: ID!
    leadStatus: LeadStatus
    assignedToUserId: ID
    leadSource: String
    minLeadScore: Int
    limit: Int = 100
    offset: Int = 0
  ): [Lead!]!

  lead(id: ID!): Lead
  leadByNumber(leadNumber: String!): Lead

  # Opportunity queries
  opportunities(
    tenantId: ID!
    pipelineStage: PipelineStage
    ownerUserId: ID
    customerId: ID
    isClosed: Boolean
    limit: Int = 100
    offset: Int = 0
  ): [Opportunity!]!

  opportunity(id: ID!): Opportunity
  opportunityByNumber(opportunityNumber: String!): Opportunity

  # Pipeline analytics
  salesPipeline(
    tenantId: ID!
    ownerUserId: ID
    startDate: Date
    endDate: Date
  ): SalesPipelineReport!

  # Contact queries
  contacts(
    tenantId: ID!
    customerId: ID
    leadId: ID
    contactRole: ContactRole
    isActive: Boolean
    limit: Int = 100
  ): [Contact!]!

  contact(id: ID!): Contact

  # Activity queries
  activities(
    tenantId: ID!
    activityType: ActivityType
    assignedToUserId: ID
    relatedToCustomerId: ID
    relatedToLeadId: ID
    relatedToOpportunityId: ID
    isCompleted: Boolean
    scheduledDateFrom: DateTime
    scheduledDateTo: DateTime
    limit: Int = 100
    offset: Int = 0
  ): [Activity!]!

  activity(id: ID!): Activity

  # CRM Analytics
  crmDashboard(
    tenantId: ID!
    userId: ID
    dateRange: DateRangeInput
  ): CRMDashboard!
}

# ============================================
# MUTATIONS
# ============================================

extend type Mutation {
  # Lead management
  createLead(input: CreateLeadInput!): Lead!
  updateLead(id: ID!, input: UpdateLeadInput!): Lead!
  qualifyLead(id: ID!, qualificationNotes: String): Lead!
  convertLeadToCustomer(id: ID!): Customer!
  convertLeadToOpportunity(id: ID!, opportunityName: String!): Opportunity!

  # Opportunity management
  createOpportunity(input: CreateOpportunityInput!): Opportunity!
  updateOpportunity(id: ID!, input: UpdateOpportunityInput!): Opportunity!
  moveOpportunityStage(id: ID!, newStage: PipelineStage!): Opportunity!
  closeOpportunityWon(id: ID!, closeNotes: String): Opportunity!
  closeOpportunityLost(id: ID!, lostReason: String!, closeNotes: String): Opportunity!

  # Contact management
  createContact(input: CreateContactInput!): Contact!
  updateContact(id: ID!, input: UpdateContactInput!): Contact!
  setAsPrimaryContact(id: ID!): Contact!
  deactivateContact(id: ID!): Contact!

  # Activity tracking
  createActivity(input: CreateActivityInput!): Activity!
  updateActivity(id: ID!, input: UpdateActivityInput!): Activity!
  completeActivity(id: ID!, completionNotes: String): Activity!
  deleteActivity(id: ID!): Boolean!
}
```

---

## 4. Recommended Implementation Phases

### **Phase 1: Foundation (2 weeks)**
**Goal:** Basic lead and opportunity tracking

**Deliverables:**
1. ✅ Database migration V0.0.X: Create `leads`, `opportunities`, `pipeline_stages` tables
2. ✅ GraphQL schema extensions: Lead and Opportunity types
3. ✅ NestJS modules: `LeadManagementModule`, `OpportunityManagementModule`
4. ✅ Basic CRUD services for leads and opportunities
5. ✅ Quote → Opportunity migration script

**Success Criteria:**
- Sales reps can create and track leads
- Opportunities can be created from quotes
- Pipeline stages are configurable

### **Phase 2: Contacts & Activities (2 weeks)**
**Goal:** Multi-contact management and activity logging

**Deliverables:**
1. ✅ Database migration V0.0.X+1: Create `contacts`, `activities` tables
2. ✅ GraphQL schema extensions: Contact and Activity types
3. ✅ NestJS modules: `ContactManagementModule`, `ActivityTrackingModule`
4. ✅ Contact hierarchy support (reports-to relationships)
5. ✅ Activity timeline view

**Success Criteria:**
- Multiple contacts per customer/lead
- Activity logging (calls, emails, meetings, tasks)
- Activity reminders and notifications

### **Phase 3: Sales Analytics & Reporting (1 week)**
**Goal:** Pipeline visibility and forecasting

**Deliverables:**
1. ✅ Materialized views: `sales_funnel_metrics`, `pipeline_velocity_metrics`
2. ✅ GraphQL analytics queries: `salesPipeline`, `crmDashboard`
3. ✅ Frontend dashboard components (for Jen Frontend)
4. ✅ Email digest: Weekly pipeline summary for sales managers

**Success Criteria:**
- Sales funnel conversion rates visible
- Pipeline forecast (weighted by probability)
- Win/loss analysis

### **Phase 4: Automation & Intelligence (2 weeks)**
**Goal:** Lead scoring, auto-assignment, and workflow automation

**Deliverables:**
1. ✅ Lead scoring algorithm (based on company size, industry, engagement)
2. ✅ Sales territory management with auto-assignment
3. ✅ Workflow automation: Lead assignment rules, follow-up reminders
4. ✅ Email integration: Track email opens/clicks as activities
5. ✅ Duplicate detection for leads and contacts

**Success Criteria:**
- Leads auto-assigned to sales reps based on territory
- Lead scoring updated in real-time
- Duplicate prevention when importing leads

---

## 5. Technical Recommendations

### 5.1 Row-Level Security (RLS) Policies

**Apply tenant isolation and sales territory restrictions:**

```sql
-- Leads RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY leads_tenant_isolation ON leads
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY leads_sales_rep_access ON leads
FOR SELECT
USING (
    assigned_to_user_id = current_setting('app.current_user_id')::UUID
    OR current_setting('app.current_user_role') IN ('ADMIN', 'SALES_MANAGER')
);

-- Opportunities RLS
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY opportunities_tenant_isolation ON opportunities
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY opportunities_owner_access ON opportunities
FOR SELECT
USING (
    owner_user_id = current_setting('app.current_user_id')::UUID
    OR current_setting('app.current_user_role') IN ('ADMIN', 'SALES_MANAGER')
);

-- Activities RLS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY activities_tenant_isolation ON activities
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY activities_assigned_to_access ON activities
FOR SELECT
USING (
    assigned_to_user_id = current_setting('app.current_user_id')::UUID
    OR created_by_user_id = current_setting('app.current_user_id')::UUID
    OR current_setting('app.current_user_role') IN ('ADMIN', 'SALES_MANAGER')
);
```

### 5.2 Performance Optimization

**Indexes:**
```sql
-- Lead search performance
CREATE INDEX idx_leads_tenant_status_score ON leads(tenant_id, lead_status, lead_score DESC);
CREATE INDEX idx_leads_created_at_desc ON leads(created_at DESC);

-- Opportunity pipeline queries
CREATE INDEX idx_opportunities_tenant_stage_close_date ON opportunities(tenant_id, pipeline_stage, expected_close_date);
CREATE INDEX idx_opportunities_weighted_value ON opportunities(weighted_value DESC) WHERE is_closed = FALSE;

-- Activity timeline queries
CREATE INDEX idx_activities_related_customer_created ON activities(related_to_customer_id, created_at DESC);
CREATE INDEX idx_activities_related_opportunity_created ON activities(related_to_opportunity_id, created_at DESC);
CREATE INDEX idx_activities_scheduled_incomplete ON activities(scheduled_start_datetime) WHERE is_completed = FALSE;
```

**Materialized View Refresh Strategy:**
```sql
-- Refresh sales funnel metrics nightly
CREATE OR REPLACE FUNCTION refresh_crm_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY sales_funnel_metrics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY pipeline_velocity_metrics;
END;
$$ LANGUAGE plpgsql;

-- Schedule via pg_cron or cron job
-- 0 1 * * * psql -d print_erp_dev -c "SELECT refresh_crm_analytics();"
```

### 5.3 Existing Infrastructure Leverage

**Use Existing Services:**
1. **Email Service** (from customer portal): Extend for lead nurturing emails
2. **NATS Messaging** (from agent system): Publish CRM events for workflow automation
3. **Row-Level Security** (V0.0.47-V0.0.50): Apply to all new CRM tables
4. **Audit Trail Pattern**: Follow existing `created_at`, `created_by`, `updated_at`, `updated_by` pattern

**NATS Event Topics for CRM:**
```typescript
// Publish lead events
NATS_SUBJECTS = {
  LEAD_CREATED: 'agog.crm.lead.created',
  LEAD_QUALIFIED: 'agog.crm.lead.qualified',
  LEAD_CONVERTED: 'agog.crm.lead.converted',

  OPPORTUNITY_CREATED: 'agog.crm.opportunity.created',
  OPPORTUNITY_STAGE_CHANGED: 'agog.crm.opportunity.stage_changed',
  OPPORTUNITY_CLOSED_WON: 'agog.crm.opportunity.closed_won',
  OPPORTUNITY_CLOSED_LOST: 'agog.crm.opportunity.closed_lost',

  ACTIVITY_CREATED: 'agog.crm.activity.created',
  ACTIVITY_DUE_REMINDER: 'agog.crm.activity.due_reminder',
}
```

---

## 6. Risk Assessment & Mitigation

### 6.1 Data Migration Risks

**Risk:** Existing customers have only one primary contact; importing to multi-contact model may lose data.

**Mitigation:**
```sql
-- Migration script: Create primary contact for each existing customer
INSERT INTO contacts (
    tenant_id,
    customer_id,
    first_name,
    last_name,
    email,
    mobile_phone,
    is_primary_contact,
    created_at
)
SELECT
    c.tenant_id,
    c.id,
    SPLIT_PART(c.primary_contact_name, ' ', 1), -- Approximate first name
    COALESCE(SPLIT_PART(c.primary_contact_name, ' ', 2), ''), -- Last name
    c.primary_contact_email,
    c.primary_contact_phone,
    TRUE,
    c.created_at
FROM customers c
WHERE c.primary_contact_name IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM contacts ct WHERE ct.customer_id = c.id AND ct.is_primary_contact = TRUE
  );
```

### 6.2 Performance Impact

**Risk:** Activity table will grow very large (millions of rows) and slow down queries.

**Mitigation:**
1. **Table Partitioning by Month:**
```sql
CREATE TABLE activities (
    ...
) PARTITION BY RANGE (created_at);

CREATE TABLE activities_2025_01 PARTITION OF activities
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE activities_2025_02 PARTITION OF activities
FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- ... etc.
```

2. **Archive old activities (>2 years) to cold storage**

### 6.3 User Adoption

**Risk:** Sales reps may resist logging activities manually.

**Mitigation:**
1. **Email integration**: Auto-create activity records from sent/received emails
2. **Phone system integration**: Auto-log calls from VoIP system
3. **Calendar integration**: Sync meetings from Outlook/Google Calendar
4. **Gamification**: Leaderboard for most activities logged

---

## 7. Conclusion & Recommendations

### **Summary of Findings**

The Print Industry ERP system has a **solid foundation** for CRM with comprehensive customer master data, quote-to-order workflow, and customer portal authentication. However, it lacks **critical CRM capabilities** including lead management, opportunity tracking, pipeline visibility, multi-contact support, and activity logging.

### **Top Priorities**

1. ✅ **Immediate:** Add `opportunities` table and link to existing `quotes` (1-2 days)
2. ✅ **Week 1:** Implement lead capture and qualification workflow
3. ✅ **Week 2:** Build contact hierarchy and activity tracking
4. ✅ **Week 3:** Create sales pipeline dashboard with analytics

### **Long-Term Vision**

Transform the system into a **true integrated CRM** by:
- Marketing automation (email campaigns, lead nurturing)
- AI-powered lead scoring
- Sales forecasting with machine learning
- Customer health scoring
- Churn prediction for existing customers

### **Next Steps**

1. **Review this research** with Roy (Backend) and Jen (Frontend)
2. **Prioritize features** based on business impact
3. **Create technical spec** for Phase 1 implementation
4. **Design UI mockups** for pipeline dashboard (Jen Frontend)
5. **Estimate effort** and assign to sprint

---

## 8. References

**Existing Code Locations:**
- Customer schema: `database/schemas/sales-materials-procurement-module.sql:649-1156`
- Quote management: `src/modules/sales/services/quote-management.service.ts`
- Customer portal: `src/graphql/schema/customer-portal.graphql`
- Sales GraphQL: `src/graphql/schema/sales-materials.graphql`

**Related Requirements:**
- REQ-STRATEGIC-AUTO-1735125600000: Sales Quote Automation
- REQ-STRATEGIC-AUTO-1767048328659: Customer Portal & Self-Service Ordering
- V0.0.26: Vendor Scorecards (similar analytics pattern)

**External CRM Best Practices:**
- Salesforce Data Model: https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/
- HubSpot CRM API: https://developers.hubspot.com/docs/api/overview
- Microsoft Dynamics 365: https://learn.microsoft.com/en-us/dynamics365/

---

**END OF RESEARCH DELIVERABLE**
