# RESEARCH DELIVERABLE: Customer Sentiment Analysis & NPS Automation
**REQ-STRATEGIC-AUTO-1767108044311**
**Agent:** Cynthia (Research & Analysis)
**Date:** 2025-12-30
**Status:** COMPLETE

---

## EXECUTIVE SUMMARY

This research analyzes the existing customer interaction infrastructure and provides comprehensive recommendations for implementing **Customer Sentiment Analysis** and **NPS (Net Promoter Score) Automation** in the Print Industry ERP system.

### Key Findings

✅ **EXISTING INFRASTRUCTURE (Strong Foundation)**
- ✅ Customer Portal with comprehensive activity logging (V0.0.43)
- ✅ Customer rejections tracking with root cause analysis (V0.0.7)
- ✅ Proof approval workflow with customer comments (V0.0.43)
- ✅ Quote approval/rejection with feedback (V0.0.43)
- ✅ Customer activity logs capturing all interactions (15+ activity types)
- ✅ Quality defect tracking with severity classification (V0.0.7)
- ✅ Vendor performance scoring system (can be adapted for customers)

❌ **MISSING COMPONENTS (Implementation Required)**
- ❌ No customer satisfaction survey system
- ❌ No NPS tracking or calculation
- ❌ No sentiment analysis on customer feedback text
- ❌ No customer review/rating system for products/services
- ❌ No automated survey trigger workflows
- ❌ No sentiment scoring on rejection reasons, proof comments, etc.
- ❌ No customer satisfaction analytics dashboard

---

## DETAILED ANALYSIS

### 1. EXISTING CUSTOMER FEEDBACK TOUCHPOINTS

#### A. **Customer Portal Activity Log** (V0.0.43)
```sql
-- 15+ customer interaction types already tracked:
- LOGIN, LOGOUT, VIEW_ORDER, VIEW_QUOTE
- APPROVE_QUOTE, REJECT_QUOTE
- APPROVE_PROOF, REQUEST_PROOF_REVISION
- UPLOAD_ARTWORK
- REQUEST_QUOTE, REORDER
- PASSWORD_CHANGE, MFA_ENROLL, PROFILE_UPDATE
```

**Existing Fields:**
- `activity_type` - Classification of customer action
- `metadata` - JSON with activity-specific data (e.g., rejection reasons)
- `is_suspicious` - Boolean flag for anomaly detection
- `geolocation` - Customer location tracking
- `ip_address`, `user_agent`, `session_id` - Session metadata

**Data Volume:** High-traffic table with time-series indexing
**Location:** `print-industry-erp/backend/migrations/V0.0.43__create_customer_portal_tables.sql:327-386`

---

#### B. **Customer Rejections** (V0.0.7)
```sql
CREATE TABLE customer_rejections (
    rejection_reason TEXT NOT NULL,
    root_cause TEXT,
    corrective_action TEXT,
    disposition VARCHAR(50), -- CREDIT, REPLACEMENT, REWORK, SCRAP
    status VARCHAR(20), -- OPEN, IN_PROGRESS, RESOLVED, CLOSED
    financial_impact DECIMAL(18,4)
);
```

**Sentiment Analysis Opportunity:**
- ✅ `rejection_reason` - Customer feedback on why they rejected (FREE TEXT)
- ✅ `root_cause` - Internal analysis (FREE TEXT)
- ❌ **NO sentiment scoring** on rejection reasons
- ❌ **NO categorization** of rejection types beyond manual entry

**Current Usage:** Quality management tracking only
**Location:** `print-industry-erp/backend/migrations/V0.0.7__create_quality_hr_iot_security_marketplace_imposition.sql:1245-1285`

---

#### C. **Proof Approval Workflow** (V0.0.43)
```sql
CREATE TABLE proofs (
    status VARCHAR(20), -- PENDING_REVIEW, APPROVED, REVISION_REQUESTED, SUPERSEDED
    customer_comments TEXT,
    revision_notes TEXT, -- Customer feedback for prepress team
    approval_signature TEXT
);
```

**Sentiment Analysis Opportunity:**
- ✅ `customer_comments` - Free-text feedback on proofs
- ✅ `revision_notes` - Customer requests for changes
- ❌ **NO sentiment scoring** on comments
- ❌ **NO categorization** of revision reasons (e.g., color issues, layout changes, typos)

**Location:** `print-industry-erp/backend/migrations/V0.0.43__create_customer_portal_tables.sql:256-320`

---

#### D. **Quote Approval/Rejection** (V0.0.43)
```sql
-- Existing quote tracking:
- customerApproveQuote() - Converts quote to order
- customerRejectQuote(quoteId, reason?) - Rejects quote with optional reason
- Quote rejection reason stored in `quotes.notes` field (appended)
```

**Sentiment Analysis Opportunity:**
- ✅ Quote rejection reasons (optional free text)
- ❌ **NO structured rejection reason categories** (e.g., price too high, lead time, terms)
- ❌ **NO sentiment scoring** on rejection reasons
- ❌ **NO analytics** on quote win/loss reasons

**Location:** `print-industry-erp/backend/src/modules/customer-portal/customer-portal.resolver.ts:1089-1130`

---

### 2. VENDOR PERFORMANCE SCORECARD (Adaptable Pattern)

The system has a **comprehensive vendor scoring system** (V0.0.26, V0.0.31) that can be adapted for **customer satisfaction scoring**:

#### **Vendor Scorecard Metrics** (Existing)
```graphql
type VendorPerformanceMetrics {
  deliveryPerformance: DeliveryMetrics!
  qualityMetrics: QualityMetrics!
  serviceMetrics: ServiceMetrics!
  costMetrics: CostMetrics!
  overallRating: Float! # 0-5 stars
  esgScore: Float! # Environmental, Social, Governance
}

type ServiceMetrics {
  responsivenessScore: Float! # 0-5 rating
  responseTime: Float! # Hours
  issueResolutionRate: Float! # Percentage
  communicationScore: Float! # 0-5 rating
}
```

**Adaptation for Customer Satisfaction:**
- ✅ **Star rating system** (0-5) already implemented
- ✅ **12-month rolling metrics** with trend analysis
- ✅ **Tier classification** (STRATEGIC, PREFERRED, TRANSACTIONAL)
- ✅ **Automated alert system** for threshold breaches
- ✅ **GraphQL schema** for comprehensive scoring

**Location:** `print-industry-erp/backend/src/graphql/schema/vendor-performance.graphql`

---

### 3. QUALITY MANAGEMENT SYSTEM

#### **Quality Defects** (V0.0.7)
```sql
CREATE TABLE quality_defects (
    defect_severity VARCHAR(20), -- CRITICAL, MAJOR, MINOR
    defect_description TEXT NOT NULL,
    root_cause TEXT,
    corrective_action TEXT
);
```

**Sentiment Analysis Opportunity:**
- ✅ Defect descriptions capture quality issues
- ❌ **NO customer sentiment** linked to defects
- ❌ **NO correlation** between defects and customer satisfaction

---

## RECOMMENDED IMPLEMENTATION ARCHITECTURE

### PHASE 1: DATABASE SCHEMA (Priority: HIGH)

#### **Table 1: `customer_feedback_surveys`**
```sql
CREATE TABLE customer_feedback_surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,

    -- Survey metadata
    survey_type VARCHAR(50) NOT NULL,
    -- NPS, CSAT, ORDER_FOLLOWUP, PROOF_FEEDBACK, SERVICE_REVIEW, PRODUCT_REVIEW

    survey_template_id UUID,
    trigger_event VARCHAR(50),
    -- ORDER_DELIVERED, QUOTE_APPROVED, PROOF_APPROVED, REJECTION_LOGGED

    trigger_entity_type VARCHAR(50),
    -- SALES_ORDER, QUOTE, PROOF, CUSTOMER_REJECTION
    trigger_entity_id UUID,

    -- Survey delivery
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_via VARCHAR(20) DEFAULT 'EMAIL', -- EMAIL, SMS, PORTAL, API
    recipient_customer_user_id UUID,
    recipient_email VARCHAR(255),

    -- Survey completion
    status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING, OPENED, PARTIAL, COMPLETED, EXPIRED

    opened_at TIMESTAMPTZ,
    first_response_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    -- NPS specific
    nps_score INTEGER, -- 0-10
    nps_category VARCHAR(20), -- DETRACTOR (0-6), PASSIVE (7-8), PROMOTER (9-10)
    nps_comment TEXT,

    -- CSAT specific
    csat_score INTEGER, -- 1-5
    csat_comment TEXT,

    -- General feedback
    overall_rating INTEGER, -- 1-5 stars
    feedback_text TEXT,

    -- Sentiment analysis
    sentiment_score DECIMAL(5,4), -- -1.0 (negative) to +1.0 (positive)
    sentiment_magnitude DECIMAL(5,4), -- 0.0 to +infinity (strength)
    sentiment_label VARCHAR(20), -- VERY_NEGATIVE, NEGATIVE, NEUTRAL, POSITIVE, VERY_POSITIVE
    sentiment_analyzed_at TIMESTAMPTZ,

    -- Response metadata
    response_time_seconds INTEGER, -- Time to complete survey
    response_ip VARCHAR(50),
    response_user_agent TEXT,

    -- Flags
    is_anonymous BOOLEAN DEFAULT FALSE,
    requires_followup BOOLEAN DEFAULT FALSE,
    followup_assigned_to UUID,
    followup_completed_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_feedback_surveys_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_feedback_surveys_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_feedback_surveys_template FOREIGN KEY (survey_template_id) REFERENCES survey_templates(id),
    CONSTRAINT fk_feedback_surveys_user FOREIGN KEY (recipient_customer_user_id) REFERENCES customer_users(id),
    CONSTRAINT fk_feedback_surveys_followup_user FOREIGN KEY (followup_assigned_to) REFERENCES users(id),
    CONSTRAINT chk_nps_score CHECK (nps_score IS NULL OR (nps_score >= 0 AND nps_score <= 10)),
    CONSTRAINT chk_csat_score CHECK (csat_score IS NULL OR (csat_score >= 1 AND csat_score <= 5)),
    CONSTRAINT chk_overall_rating CHECK (overall_rating IS NULL OR (overall_rating >= 1 AND overall_rating <= 5)),
    CONSTRAINT chk_sentiment_score CHECK (sentiment_score IS NULL OR (sentiment_score >= -1.0 AND sentiment_score <= 1.0))
);

CREATE INDEX idx_feedback_surveys_tenant ON customer_feedback_surveys(tenant_id);
CREATE INDEX idx_feedback_surveys_customer ON customer_feedback_surveys(customer_id);
CREATE INDEX idx_feedback_surveys_status ON customer_feedback_surveys(status);
CREATE INDEX idx_feedback_surveys_type ON customer_feedback_surveys(survey_type);
CREATE INDEX idx_feedback_surveys_sent_at ON customer_feedback_surveys(sent_at DESC);
CREATE INDEX idx_feedback_surveys_nps_score ON customer_feedback_surveys(nps_score) WHERE nps_score IS NOT NULL;
CREATE INDEX idx_feedback_surveys_sentiment ON customer_feedback_surveys(sentiment_label) WHERE sentiment_label IS NOT NULL;
CREATE INDEX idx_feedback_surveys_followup ON customer_feedback_surveys(requires_followup, followup_assigned_to) WHERE requires_followup = TRUE;

COMMENT ON TABLE customer_feedback_surveys IS 'Customer satisfaction surveys (NPS, CSAT, order followup) with sentiment analysis';
COMMENT ON COLUMN customer_feedback_surveys.nps_score IS 'Net Promoter Score: 0-6 Detractor, 7-8 Passive, 9-10 Promoter';
COMMENT ON COLUMN customer_feedback_surveys.sentiment_score IS 'Google Cloud NLP sentiment: -1.0 (negative) to +1.0 (positive)';
```

---

#### **Table 2: `survey_templates`**
```sql
CREATE TABLE survey_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Template details
    template_name VARCHAR(100) NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    -- NPS, CSAT, ORDER_FOLLOWUP, PROOF_FEEDBACK, SERVICE_REVIEW, PRODUCT_REVIEW

    is_active BOOLEAN DEFAULT TRUE,

    -- Survey configuration
    questions JSONB NOT NULL,
    -- [{"id": "q1", "type": "NPS", "text": "How likely...", "required": true}, ...]

    -- Trigger rules
    trigger_events JSONB,
    -- ["ORDER_DELIVERED", "QUOTE_APPROVED"]

    trigger_conditions JSONB,
    -- {"order_value_min": 1000, "customer_tier": ["STRATEGIC", "PREFERRED"]}

    send_delay_hours INTEGER DEFAULT 24,
    -- Wait 24 hours after trigger event before sending

    expiry_days INTEGER DEFAULT 14,
    -- Survey expires 14 days after sending

    -- Email template
    email_subject VARCHAR(255),
    email_body_template TEXT,
    -- Mustache template: "Hi {{customerName}}, please rate order {{orderNumber}}..."

    -- Branding
    survey_header_html TEXT,
    survey_footer_html TEXT,

    -- Analytics
    times_sent INTEGER DEFAULT 0,
    times_completed INTEGER DEFAULT 0,
    avg_completion_rate DECIMAL(5,4),
    avg_response_time_hours DECIMAL(10,2),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_survey_templates_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_survey_templates_tenant ON survey_templates(tenant_id);
CREATE INDEX idx_survey_templates_type ON survey_templates(template_type);
CREATE INDEX idx_survey_templates_active ON survey_templates(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE survey_templates IS 'Reusable survey templates for NPS, CSAT, and custom feedback forms';
COMMENT ON COLUMN survey_templates.questions IS 'JSON array of survey questions with type, text, options, and validation rules';
```

---

#### **Table 3: `customer_sentiment_events`**
```sql
CREATE TABLE customer_sentiment_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,

    -- Event source
    event_type VARCHAR(50) NOT NULL,
    -- REJECTION_REASON, PROOF_COMMENT, QUOTE_REJECTION, SURVEY_RESPONSE, SUPPORT_TICKET

    source_table VARCHAR(50),
    -- customer_rejections, proofs, customer_feedback_surveys
    source_record_id UUID,

    -- Text content
    original_text TEXT NOT NULL,
    processed_text TEXT, -- Cleaned, normalized text for analysis

    -- Sentiment analysis (Google Cloud NLP API)
    sentiment_score DECIMAL(5,4), -- -1.0 (negative) to +1.0 (positive)
    sentiment_magnitude DECIMAL(5,4), -- 0.0 to +infinity (strength)
    sentiment_label VARCHAR(20), -- VERY_NEGATIVE, NEGATIVE, NEUTRAL, POSITIVE, VERY_POSITIVE

    -- Entity extraction (optional)
    entities JSONB,
    -- [{"name": "color accuracy", "type": "ISSUE", "sentiment": -0.8}, ...]

    -- Categories (ML classification)
    categories JSONB,
    -- ["QUALITY_ISSUE", "DELIVERY_DELAY", "PRICING_CONCERN"]

    -- Flags
    requires_attention BOOLEAN DEFAULT FALSE,
    flagged_reason VARCHAR(255),
    assigned_to UUID,
    resolved_at TIMESTAMPTZ,

    -- Analysis metadata
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    analysis_model VARCHAR(50), -- google_nlp_v1, aws_comprehend, custom_model
    analysis_cost_cents DECIMAL(10,4), -- Track API costs

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_sentiment_events_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_sentiment_events_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_sentiment_events_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id)
);

CREATE INDEX idx_sentiment_events_tenant ON customer_sentiment_events(tenant_id);
CREATE INDEX idx_sentiment_events_customer ON customer_sentiment_events(customer_id);
CREATE INDEX idx_sentiment_events_type ON customer_sentiment_events(event_type);
CREATE INDEX idx_sentiment_events_label ON customer_sentiment_events(sentiment_label);
CREATE INDEX idx_sentiment_events_attention ON customer_sentiment_events(requires_attention) WHERE requires_attention = TRUE;
CREATE INDEX idx_sentiment_events_created_at ON customer_sentiment_events(created_at DESC);

COMMENT ON TABLE customer_sentiment_events IS 'Sentiment analysis results for all customer feedback text (rejections, comments, surveys)';
COMMENT ON COLUMN customer_sentiment_events.sentiment_score IS 'Google Cloud NLP sentiment: -1.0 (negative) to +1.0 (positive)';
COMMENT ON COLUMN customer_sentiment_events.entities IS 'Extracted entities/topics from text (e.g., "color accuracy", "delivery time")';
```

---

#### **Table 4: `nps_tracking`** (Materialized View)
```sql
CREATE TABLE nps_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    customer_id UUID,

    -- Time period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type VARCHAR(20), -- MONTHLY, QUARTERLY, YEARLY

    -- NPS metrics
    total_responses INTEGER DEFAULT 0,
    promoter_count INTEGER DEFAULT 0, -- Score 9-10
    passive_count INTEGER DEFAULT 0, -- Score 7-8
    detractor_count INTEGER DEFAULT 0, -- Score 0-6

    nps_score DECIMAL(5,2), -- -100 to +100 (% promoters - % detractors)

    -- Breakdown by source
    nps_by_survey_type JSONB,
    -- {"ORDER_FOLLOWUP": 75, "PROOF_FEEDBACK": 65, "SERVICE_REVIEW": 80}

    -- Comparison
    previous_period_nps DECIMAL(5,2),
    nps_trend VARCHAR(20), -- IMPROVING, STABLE, DECLINING

    -- Averages
    avg_response_time_hours DECIMAL(10,2),
    avg_sentiment_score DECIMAL(5,4),

    -- Audit
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_nps_tracking_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_nps_tracking_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    UNIQUE(tenant_id, customer_id, period_start, period_end)
);

CREATE INDEX idx_nps_tracking_tenant ON nps_tracking(tenant_id);
CREATE INDEX idx_nps_tracking_customer ON nps_tracking(customer_id);
CREATE INDEX idx_nps_tracking_period ON nps_tracking(period_start, period_end);
CREATE INDEX idx_nps_tracking_score ON nps_tracking(nps_score DESC);

COMMENT ON TABLE nps_tracking IS 'Net Promoter Score tracking by customer and time period (materialized view)';
COMMENT ON COLUMN nps_tracking.nps_score IS 'NPS = (% Promoters - % Detractors) ranging from -100 to +100';
```

---

### PHASE 2: GRAPHQL SCHEMA EXTENSIONS

#### **Queries**
```graphql
extend type Query {
  # ============================================
  # Customer Satisfaction & NPS Queries
  # ============================================

  """
  Get NPS score for a time period (overall or by customer)
  """
  getNPSScore(
    customerId: ID
    periodStart: Date!
    periodEnd: Date!
    periodType: NPSPeriodType = MONTHLY
  ): NPSMetrics!

  """
  Get customer feedback surveys (filtered)
  """
  getCustomerSurveys(
    customerId: ID
    surveyType: SurveyType
    status: SurveyStatus
    dateFrom: Date
    dateTo: Date
    limit: Int = 50
    offset: Int = 0
  ): CustomerSurveyResults!

  """
  Get sentiment analysis events for a customer
  """
  getCustomerSentiment(
    customerId: ID!
    eventType: SentimentEventType
    sentimentLabel: SentimentLabel
    requiresAttention: Boolean
    limit: Int = 100
  ): [CustomerSentimentEvent!]!

  """
  Get customer satisfaction trends over time
  """
  getCustomerSatisfactionTrends(
    customerId: ID
    metric: SatisfactionMetric! # NPS, CSAT, AVG_RATING
    groupBy: TrendGrouping! # DAY, WEEK, MONTH, QUARTER
    dateFrom: Date!
    dateTo: Date!
  ): [SatisfactionTrendPoint!]!

  """
  Get survey response details
  """
  getSurveyResponse(surveyId: ID!): CustomerFeedbackSurvey!

  """
  Get actionable feedback requiring followup
  """
  getActionableFeedback(
    assignedTo: ID
    requiresFollowup: Boolean = true
    limit: Int = 50
  ): [CustomerFeedbackSurvey!]!
}
```

#### **Mutations**
```graphql
extend type Mutation {
  # ============================================
  # Survey Management Mutations
  # ============================================

  """
  Create a new survey template
  """
  createSurveyTemplate(input: SurveyTemplateInput!): SurveyTemplate!

  """
  Update survey template
  """
  updateSurveyTemplate(id: ID!, input: SurveyTemplateInput!): SurveyTemplate!

  """
  Send survey to a customer (manual trigger)
  """
  sendCustomerSurvey(
    customerId: ID!
    templateId: ID!
    triggerEntityType: String
    triggerEntityId: ID
  ): CustomerFeedbackSurvey!

  """
  Submit survey response (customer-facing)
  """
  submitSurveyResponse(
    surveyId: ID!
    responses: JSON!
    npsScore: Int
    csatScore: Int
    feedbackText: String
  ): CustomerFeedbackSurvey!

  """
  Manually analyze sentiment for existing text
  """
  analyzeSentiment(
    eventType: SentimentEventType!
    sourceTable: String!
    sourceRecordId: ID!
    text: String!
  ): CustomerSentimentEvent!

  """
  Assign feedback for followup
  """
  assignFeedbackFollowup(
    surveyId: ID!
    assignedTo: ID!
    flaggedReason: String
  ): CustomerFeedbackSurvey!

  """
  Mark feedback followup as complete
  """
  completeFeedbackFollowup(
    surveyId: ID!
    resolutionNotes: String
  ): CustomerFeedbackSurvey!
}
```

#### **Types**
```graphql
type NPSMetrics {
  periodStart: Date!
  periodEnd: Date!
  totalResponses: Int!
  promoterCount: Int!
  passiveCount: Int!
  detractorCount: Int!
  npsScore: Float! # -100 to +100
  previousPeriodNPS: Float
  trend: NPSTrend!
  npsBySource: JSON
  avgResponseTimeHours: Float
  avgSentimentScore: Float
}

enum NPSTrend {
  IMPROVING
  STABLE
  DECLINING
}

enum NPSPeriodType {
  MONTHLY
  QUARTERLY
  YEARLY
}

type CustomerFeedbackSurvey {
  id: ID!
  tenantId: ID!
  customerId: ID!
  surveyType: SurveyType!
  status: SurveyStatus!
  sentAt: DateTime!
  completedAt: DateTime
  npsScore: Int
  npsCategory: NPSCategory
  csatScore: Int
  overallRating: Int
  feedbackText: String
  sentimentScore: Float
  sentimentLabel: SentimentLabel
  requiresFollowup: Boolean!
  followupAssignedTo: ID
}

enum SurveyType {
  NPS
  CSAT
  ORDER_FOLLOWUP
  PROOF_FEEDBACK
  SERVICE_REVIEW
  PRODUCT_REVIEW
}

enum SurveyStatus {
  PENDING
  OPENED
  PARTIAL
  COMPLETED
  EXPIRED
}

enum NPSCategory {
  DETRACTOR
  PASSIVE
  PROMOTER
}

enum SentimentLabel {
  VERY_NEGATIVE
  NEGATIVE
  NEUTRAL
  POSITIVE
  VERY_POSITIVE
}

type CustomerSentimentEvent {
  id: ID!
  customerId: ID!
  eventType: SentimentEventType!
  originalText: String!
  sentimentScore: Float!
  sentimentMagnitude: Float!
  sentimentLabel: SentimentLabel!
  entities: JSON
  categories: [String!]
  requiresAttention: Boolean!
  flaggedReason: String
  assignedTo: ID
  createdAt: DateTime!
}

enum SentimentEventType {
  REJECTION_REASON
  PROOF_COMMENT
  QUOTE_REJECTION
  SURVEY_RESPONSE
  SUPPORT_TICKET
}

type SatisfactionTrendPoint {
  date: Date!
  value: Float!
  sampleSize: Int!
}

enum SatisfactionMetric {
  NPS
  CSAT
  AVG_RATING
  SENTIMENT_SCORE
}

enum TrendGrouping {
  DAY
  WEEK
  MONTH
  QUARTER
  YEAR
}
```

---

### PHASE 3: BACKEND SERVICES

#### **Service 1: `sentiment-analysis.service.ts`**
```typescript
import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { LanguageServiceClient } from '@google-cloud/language';

@Injectable()
export class SentimentAnalysisService {
  private languageClient: LanguageServiceClient;

  constructor(private readonly dbPool: Pool) {
    // Initialize Google Cloud NLP client
    this.languageClient = new LanguageServiceClient();
  }

  /**
   * Analyze sentiment of customer feedback text
   * Uses Google Cloud Natural Language API
   */
  async analyzeSentiment(params: {
    customerId: string;
    tenantId: string;
    eventType: string;
    sourceTable: string;
    sourceRecordId: string;
    text: string;
  }): Promise<{
    sentimentScore: number;
    sentimentMagnitude: number;
    sentimentLabel: string;
    entities: any[];
  }> {
    const { customerId, tenantId, eventType, sourceTable, sourceRecordId, text } = params;

    // Call Google Cloud NLP API
    const document = {
      content: text,
      type: 'PLAIN_TEXT' as const,
      language: 'en',
    };

    const [sentimentResult] = await this.languageClient.analyzeSentiment({ document });
    const sentiment = sentimentResult.documentSentiment;

    const [entityResult] = await this.languageClient.analyzeEntitySentiment({ document });
    const entities = entityResult.entities.map(entity => ({
      name: entity.name,
      type: entity.type,
      sentiment: entity.sentiment.score,
      magnitude: entity.sentiment.magnitude,
    }));

    // Determine sentiment label
    const sentimentLabel = this.classifySentiment(sentiment.score);

    // Check if requires attention (very negative sentiment)
    const requiresAttention = sentiment.score < -0.5 || sentiment.magnitude > 2.0;

    // Insert sentiment event
    await this.dbPool.query(
      `INSERT INTO customer_sentiment_events (
        tenant_id, customer_id, event_type, source_table, source_record_id,
        original_text, sentiment_score, sentiment_magnitude, sentiment_label,
        entities, requires_attention, analysis_model
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'google_nlp_v1')`,
      [
        tenantId,
        customerId,
        eventType,
        sourceTable,
        sourceRecordId,
        text,
        sentiment.score,
        sentiment.magnitude,
        sentimentLabel,
        JSON.stringify(entities),
        requiresAttention,
      ],
    );

    return {
      sentimentScore: sentiment.score,
      sentimentMagnitude: sentiment.magnitude,
      sentimentLabel,
      entities,
    };
  }

  /**
   * Classify sentiment score into label
   */
  private classifySentiment(score: number): string {
    if (score <= -0.6) return 'VERY_NEGATIVE';
    if (score <= -0.2) return 'NEGATIVE';
    if (score >= 0.6) return 'VERY_POSITIVE';
    if (score >= 0.2) return 'POSITIVE';
    return 'NEUTRAL';
  }

  /**
   * Batch analyze sentiment for existing feedback
   * (Backfill historical data)
   */
  async batchAnalyzeCustomerRejections(): Promise<void> {
    const result = await this.dbPool.query(`
      SELECT id, tenant_id, customer_id, rejection_reason
      FROM customer_rejections
      WHERE rejection_reason IS NOT NULL
        AND id NOT IN (SELECT source_record_id FROM customer_sentiment_events WHERE source_table = 'customer_rejections')
      LIMIT 100
    `);

    for (const row of result.rows) {
      await this.analyzeSentiment({
        customerId: row.customer_id,
        tenantId: row.tenant_id,
        eventType: 'REJECTION_REASON',
        sourceTable: 'customer_rejections',
        sourceRecordId: row.id,
        text: row.rejection_reason,
      });
    }
  }

  /**
   * Batch analyze sentiment for proof comments
   */
  async batchAnalyzeProofComments(): Promise<void> {
    const result = await this.dbPool.query(`
      SELECT pr.id, pr.tenant_id, so.customer_id, pr.customer_comments
      FROM proofs pr
      JOIN sales_orders so ON pr.sales_order_id = so.id
      WHERE pr.customer_comments IS NOT NULL
        AND pr.id NOT IN (SELECT source_record_id FROM customer_sentiment_events WHERE source_table = 'proofs')
      LIMIT 100
    `);

    for (const row of result.rows) {
      await this.analyzeSentiment({
        customerId: row.customer_id,
        tenantId: row.tenant_id,
        eventType: 'PROOF_COMMENT',
        sourceTable: 'proofs',
        sourceRecordId: row.id,
        text: row.customer_comments,
      });
    }
  }
}
```

---

#### **Service 2: `nps-automation.service.ts`**
```typescript
import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class NPSAutomationService {
  constructor(
    private readonly dbPool: Pool,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Trigger NPS survey after order delivery
   */
  async triggerOrderFollowupSurvey(orderId: string): Promise<void> {
    const orderResult = await this.dbPool.query(
      `SELECT so.*, c.email
       FROM sales_orders so
       JOIN customers c ON so.customer_id = c.id
       WHERE so.id = $1`,
      [orderId],
    );

    if (orderResult.rows.length === 0) return;

    const order = orderResult.rows[0];

    // Find active NPS survey template for order followup
    const templateResult = await this.dbPool.query(
      `SELECT * FROM survey_templates
       WHERE template_type = 'ORDER_FOLLOWUP'
         AND is_active = TRUE
         AND tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [order.tenant_id],
    );

    if (templateResult.rows.length === 0) return;

    const template = templateResult.rows[0];

    // Create survey
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + template.expiry_days);

    await this.dbPool.query(
      `INSERT INTO customer_feedback_surveys (
        tenant_id, customer_id, survey_type, survey_template_id,
        trigger_event, trigger_entity_type, trigger_entity_id,
        recipient_email, expires_at, status
      ) VALUES ($1, $2, 'ORDER_FOLLOWUP', $3, 'ORDER_DELIVERED', 'SALES_ORDER', $4, $5, $6, 'PENDING')`,
      [
        order.tenant_id,
        order.customer_id,
        template.id,
        orderId,
        order.email,
        expiresAt,
      ],
    );

    // Emit event for email sending
    this.eventEmitter.emit('survey.created', { orderId, surveyType: 'ORDER_FOLLOWUP' });
  }

  /**
   * Calculate NPS score for a time period
   */
  async calculateNPS(params: {
    tenantId: string;
    customerId?: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<{
    npsScore: number;
    totalResponses: number;
    promoterCount: number;
    passiveCount: number;
    detractorCount: number;
  }> {
    const { tenantId, customerId, periodStart, periodEnd } = params;

    const conditions = ['tenant_id = $1', 'completed_at >= $2', 'completed_at <= $3', 'nps_score IS NOT NULL'];
    const values: any[] = [tenantId, periodStart, periodEnd];

    if (customerId) {
      conditions.push('customer_id = $4');
      values.push(customerId);
    }

    const result = await this.dbPool.query(
      `SELECT
        COUNT(*) as total_responses,
        COUNT(*) FILTER (WHERE nps_score >= 9) as promoter_count,
        COUNT(*) FILTER (WHERE nps_score >= 7 AND nps_score <= 8) as passive_count,
        COUNT(*) FILTER (WHERE nps_score <= 6) as detractor_count
       FROM customer_feedback_surveys
       WHERE ${conditions.join(' AND ')}`,
      values,
    );

    const row = result.rows[0];
    const totalResponses = parseInt(row.total_responses);
    const promoterCount = parseInt(row.promoter_count);
    const detractorCount = parseInt(row.detractor_count);

    // NPS = (% Promoters - % Detractors) * 100
    const npsScore =
      totalResponses > 0 ? ((promoterCount - detractorCount) / totalResponses) * 100 : 0;

    return {
      npsScore: Math.round(npsScore * 100) / 100,
      totalResponses,
      promoterCount,
      passiveCount: parseInt(row.passive_count),
      detractorCount,
    };
  }

  /**
   * Refresh NPS tracking materialized view
   */
  async refreshNPSTracking(periodType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'): Promise<void> {
    // Calculate NPS for all customers for current period
    const result = await this.dbPool.query(`
      SELECT DISTINCT tenant_id, customer_id
      FROM customer_feedback_surveys
      WHERE nps_score IS NOT NULL
    `);

    for (const row of result.rows) {
      const { periodStart, periodEnd } = this.getPeriodDates(periodType);

      const nps = await this.calculateNPS({
        tenantId: row.tenant_id,
        customerId: row.customer_id,
        periodStart,
        periodEnd,
      });

      // Upsert into nps_tracking
      await this.dbPool.query(
        `INSERT INTO nps_tracking (
          tenant_id, customer_id, period_start, period_end, period_type,
          total_responses, promoter_count, passive_count, detractor_count, nps_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (tenant_id, customer_id, period_start, period_end)
        DO UPDATE SET
          total_responses = EXCLUDED.total_responses,
          promoter_count = EXCLUDED.promoter_count,
          passive_count = EXCLUDED.passive_count,
          detractor_count = EXCLUDED.detractor_count,
          nps_score = EXCLUDED.nps_score,
          calculated_at = NOW()`,
        [
          row.tenant_id,
          row.customer_id,
          periodStart,
          periodEnd,
          periodType,
          nps.totalResponses,
          nps.promoterCount,
          nps.passiveCount,
          nps.detractorCount,
          nps.npsScore,
        ],
      );
    }
  }

  private getPeriodDates(periodType: string): { periodStart: Date; periodEnd: Date } {
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month

    let periodStart: Date;
    if (periodType === 'MONTHLY') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (periodType === 'QUARTERLY') {
      const quarter = Math.floor(now.getMonth() / 3);
      periodStart = new Date(now.getFullYear(), quarter * 3, 1);
    } else {
      periodStart = new Date(now.getFullYear(), 0, 1);
    }

    return { periodStart, periodEnd };
  }
}
```

---

### PHASE 4: FRONTEND COMPONENTS

#### **Dashboard: `CustomerSatisfactionDashboard.tsx`**
```typescript
import React from 'react';
import { useQuery } from '@apollo/client';
import { Card, Grid, Typography, CircularProgress } from '@mui/material';
import { SentimentVeryDissatisfied, SentimentSatisfied, SentimentVerySatisfied } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const GET_NPS_METRICS = gql`
  query GetNPSMetrics($periodStart: Date!, $periodEnd: Date!) {
    getNPSScore(periodStart: $periodStart, periodEnd: $periodEnd) {
      npsScore
      totalResponses
      promoterCount
      passiveCount
      detractorCount
      trend
      avgSentimentScore
    }
  }
`;

export const CustomerSatisfactionDashboard: React.FC = () => {
  const { data, loading } = useQuery(GET_NPS_METRICS, {
    variables: {
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
    },
  });

  if (loading) return <CircularProgress />;

  const nps = data?.getNPSScore;

  return (
    <Grid container spacing={3}>
      {/* NPS Score Card */}
      <Grid item xs={12} md={4}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6">Net Promoter Score</Typography>
          <Typography variant="h2" color={nps?.npsScore > 50 ? 'success.main' : 'warning.main'}>
            {nps?.npsScore}
          </Typography>
          <Typography variant="caption">{nps?.totalResponses} responses</Typography>
        </Card>
      </Grid>

      {/* Promoters/Detractors Breakdown */}
      <Grid item xs={12} md={4}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6">Breakdown</Typography>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <SentimentVerySatisfied color="success" />
              <Typography>Promoters: {nps?.promoterCount}</Typography>
            </Grid>
            <Grid item xs={4}>
              <SentimentSatisfied color="warning" />
              <Typography>Passive: {nps?.passiveCount}</Typography>
            </Grid>
            <Grid item xs={4}>
              <SentimentVeryDissatisfied color="error" />
              <Typography>Detractors: {nps?.detractorCount}</Typography>
            </Grid>
          </Grid>
        </Card>
      </Grid>

      {/* NPS Trend Chart */}
      <Grid item xs={12}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6">NPS Trend (12 Months)</Typography>
          <LineChart width={1000} height={300} data={/* trend data */}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[-100, 100]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="npsScore" stroke="#8884d8" />
          </LineChart>
        </Card>
      </Grid>
    </Grid>
  );
};
```

---

## INTEGRATION POINTS

### 1. **Existing Customer Portal** (V0.0.43)
```typescript
// Trigger NPS survey after quote approval
@Mutation()
async customerApproveQuote(...) {
  // ... existing code ...

  // Trigger NPS survey (async)
  await this.npsService.triggerQuoteApprovalSurvey(quoteId);
}

// Analyze sentiment on proof comments
@Mutation()
async customerRequestProofRevision(revisionNotes: string) {
  // ... existing code ...

  // Analyze sentiment (async)
  await this.sentimentService.analyzeSentiment({
    eventType: 'PROOF_COMMENT',
    sourceTable: 'proofs',
    sourceRecordId: proofId,
    text: revisionNotes,
  });
}
```

---

### 2. **Customer Rejections** (V0.0.7)
```sql
-- Trigger sentiment analysis on insert/update
CREATE OR REPLACE FUNCTION analyze_rejection_sentiment() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rejection_reason IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.rejection_reason IS DISTINCT FROM NEW.rejection_reason) THEN
    -- Trigger async sentiment analysis job
    PERFORM pg_notify('analyze_sentiment', json_build_object(
      'event_type', 'REJECTION_REASON',
      'source_table', 'customer_rejections',
      'source_record_id', NEW.id,
      'text', NEW.rejection_reason
    )::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_analyze_rejection_sentiment
  AFTER INSERT OR UPDATE ON customer_rejections
  FOR EACH ROW
  EXECUTE FUNCTION analyze_rejection_sentiment();
```

---

### 3. **Order Delivery Webhook**
```typescript
// Trigger NPS survey 24 hours after order delivery
@OnEvent('order.delivered')
async handleOrderDelivered(payload: { orderId: string }) {
  // Schedule NPS survey
  await this.schedulerService.scheduleJob({
    name: `nps-survey-${payload.orderId}`,
    delay: 24 * 60 * 60 * 1000, // 24 hours
    job: () => this.npsService.triggerOrderFollowupSurvey(payload.orderId),
  });
}
```

---

## THIRD-PARTY INTEGRATIONS

### 1. **Google Cloud Natural Language API** (Recommended)
- **Sentiment Analysis:** Detects sentiment score (-1.0 to +1.0) and magnitude
- **Entity Extraction:** Identifies key topics/entities in feedback text
- **Category Classification:** Automatically categorizes feedback
- **Pricing:** $1.00 per 1,000 text records (first 5,000 free per month)
- **Setup:** Requires Google Cloud project with NLP API enabled

**Alternative:** AWS Comprehend ($0.0001 per unit, 100 characters = 1 unit)

---

### 2. **Email Service** (SendGrid / Mailgun)
- **Survey Delivery:** Send NPS/CSAT surveys via email
- **Template Engine:** Mustache templates for personalized emails
- **Tracking:** Open rates, click-through rates
- **Pricing:** SendGrid free tier (100 emails/day), then $19.95/mo (50K emails)

---

### 3. **SMS Service** (Twilio)
- **SMS Surveys:** Send short NPS surveys via SMS
- **Response Handling:** Receive SMS responses and parse scores
- **Pricing:** $0.0079 per SMS (US)

---

## ANALYTICS & REPORTING

### Key Metrics Dashboard

1. **Overall NPS Score**
   - Current period NPS (-100 to +100)
   - Comparison to previous period
   - Trend line (12 months)

2. **NPS Breakdown**
   - Promoter count (9-10)
   - Passive count (7-8)
   - Detractor count (0-6)

3. **Sentiment Analysis**
   - Average sentiment score across all feedback
   - Distribution of sentiment labels (very negative to very positive)
   - Top negative entities/topics
   - Top positive entities/topics

4. **Survey Performance**
   - Survey completion rate
   - Average response time
   - Completion rate by survey type

5. **Actionable Feedback**
   - Feedback requiring followup (very negative sentiment)
   - Assigned vs. unassigned feedback
   - Feedback resolution time

6. **Customer-Specific Metrics**
   - NPS score per customer
   - Sentiment trend per customer
   - Customer satisfaction tier (High, Medium, Low)

---

## IMPLEMENTATION ROADMAP

### Phase 1: Database Schema (Week 1)
- ✅ Create `customer_feedback_surveys` table
- ✅ Create `survey_templates` table
- ✅ Create `customer_sentiment_events` table
- ✅ Create `nps_tracking` table
- ✅ Add triggers for sentiment analysis

### Phase 2: Backend Services (Week 2)
- ✅ Implement `sentiment-analysis.service.ts`
- ✅ Implement `nps-automation.service.ts`
- ✅ Implement `survey-template.service.ts`
- ✅ Integrate Google Cloud NLP API
- ✅ Add GraphQL resolvers

### Phase 3: Survey Automation (Week 3)
- ✅ Build survey email templates
- ✅ Implement event-based survey triggers
- ✅ Build survey response endpoint
- ✅ Implement NPS calculation logic

### Phase 4: Frontend Dashboard (Week 4)
- ✅ Build Customer Satisfaction Dashboard
- ✅ Build NPS Metrics Cards
- ✅ Build Sentiment Analysis Charts
- ✅ Build Actionable Feedback List
- ✅ Build Survey Response Detail View

### Phase 5: Backfill & Testing (Week 5)
- ✅ Backfill sentiment analysis for existing rejections
- ✅ Backfill sentiment analysis for existing proof comments
- ✅ Test NPS calculation accuracy
- ✅ Test survey trigger automation

---

## COST ANALYSIS

### Google Cloud NLP API
- **Volume:** Assume 1,000 customer feedback texts/month
  - Customer rejections: ~200/month
  - Proof comments: ~500/month
  - Survey responses: ~300/month
- **Cost:** $1.00 per 1,000 texts = **$1.00/month**
- **Free Tier:** 5,000 texts/month free

### SendGrid Email
- **Volume:** Assume 500 surveys sent/month
- **Cost:** Free tier (100/day) covers this = **$0/month**
- **Enterprise:** If sending >3,000/month, then $19.95/month

### Total Estimated Cost: **$0-20/month** (within free tiers)

---

## SECURITY & PRIVACY CONSIDERATIONS

1. **GDPR Compliance**
   - ✅ Customer consent for survey emails (already in `customer_users.marketing_consent`)
   - ✅ Anonymization option for survey responses
   - ✅ Right to be forgotten (soft delete surveys)

2. **Data Retention**
   - ✅ Survey responses stored indefinitely (for trend analysis)
   - ✅ Sentiment events stored indefinitely (audit trail)
   - ✅ Expired surveys auto-deleted after 90 days (configurable)

3. **Access Control**
   - ✅ RLS policies on all feedback tables
   - ✅ Customer-facing surveys only show their own data
   - ✅ Internal dashboards require ADMIN or MANAGER role

4. **API Security**
   - ✅ Google Cloud NLP API key stored in environment variables
   - ✅ Rate limiting on survey submission endpoints
   - ✅ CAPTCHA on anonymous survey responses

---

## SUCCESS METRICS

### Adoption Metrics
- **Survey Response Rate:** Target 30% completion rate
- **Time to First Response:** Target <2 hours for urgent feedback

### Quality Metrics
- **NPS Score:** Target >50 (industry benchmark)
- **Sentiment Score:** Target >0.3 (positive overall)
- **Detractor Rate:** Target <10%

### Operational Metrics
- **Followup Time:** Target <24 hours for negative feedback
- **Feedback Resolution Rate:** Target >90% within 7 days

---

## CONCLUSION

The Print Industry ERP has **strong existing infrastructure** for customer interactions (customer portal, activity logs, rejection tracking) but **lacks formal sentiment analysis and NPS tracking**.

This implementation plan provides a **comprehensive, enterprise-grade Customer Sentiment Analysis & NPS Automation system** that:

1. ✅ **Captures feedback** at all customer touchpoints (orders, quotes, proofs, rejections)
2. ✅ **Analyzes sentiment** using Google Cloud NLP API
3. ✅ **Automates NPS surveys** triggered by business events
4. ✅ **Tracks trends** with materialized views and dashboards
5. ✅ **Flags actionable feedback** for immediate followup
6. ✅ **Integrates seamlessly** with existing customer portal and quality management systems

**Estimated Implementation:** 5 weeks
**Estimated Cost:** $0-20/month (within free tiers)
**ROI:** High - improved customer retention, faster issue resolution, data-driven customer success

---

## APPENDIX: FILE REFERENCES

### Database Migrations
- `V0.0.43__create_customer_portal_tables.sql` - Customer portal, proofs, activity logs
- `V0.0.7__create_quality_hr_iot_security_marketplace_imposition.sql` - Customer rejections, quality defects
- `V0.0.26__enhance_vendor_scorecards.sql` - Vendor scoring (pattern for customer scoring)
- `V0.0.31__vendor_scorecard_enhancements_phase1.sql` - Vendor tier classification

### GraphQL Schemas
- `src/graphql/schema/customer-portal.graphql` - Customer portal queries/mutations
- `src/graphql/schema/vendor-performance.graphql` - Vendor scorecard (adaptable pattern)

### Backend Services
- `src/modules/customer-portal/customer-portal.resolver.ts` - Customer portal resolver
- `src/modules/customer-auth/customer-auth.service.ts` - Customer authentication

### Frontend
- `src/store/customerPortalStore.ts` - Customer portal state management
- `src/graphql/queries/customerPortal.ts` - Customer portal queries

---

**END OF RESEARCH DELIVERABLE**
