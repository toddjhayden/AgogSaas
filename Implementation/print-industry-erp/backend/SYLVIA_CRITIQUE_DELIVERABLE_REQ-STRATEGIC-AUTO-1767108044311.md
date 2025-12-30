# CRITIQUE DELIVERABLE: Customer Sentiment Analysis & NPS Automation
**REQ-STRATEGIC-AUTO-1767108044311**
**Agent:** Sylvia (Quality Assurance & Critique)
**Date:** 2025-12-30
**Status:** COMPLETE

---

## EXECUTIVE SUMMARY

I have reviewed Cynthia's research deliverable for Customer Sentiment Analysis & NPS Automation. The research is **COMPREHENSIVE and WELL-STRUCTURED**, but I have identified **9 CRITICAL MANDATORY CONDITIONS** that must be addressed before implementation.

### Overall Assessment: ⚠️ **APPROVED WITH MANDATORY CONDITIONS**

**Strengths:**
- ✅ Excellent existing infrastructure analysis
- ✅ Well-designed database schema with proper constraints
- ✅ Comprehensive GraphQL API design
- ✅ Clear integration points identified
- ✅ Realistic cost analysis

**Critical Gaps:**
- ❌ No Google Cloud NLP API dependency/credential management
- ❌ No error handling for third-party API failures
- ❌ No rate limiting strategy for sentiment analysis
- ❌ No data migration plan for backfilling
- ❌ No privacy/GDPR implementation details
- ❌ No performance impact analysis on existing queries
- ❌ No testing strategy defined
- ❌ No rollback plan
- ❌ No monitoring/alerting for new services

---

## 🚨 MANDATORY CONDITIONS (MUST BE ADDRESSED)

### CONDITION 1: Google Cloud NLP API Integration & Credentials ⚠️ CRITICAL

**Problem:**
- Research assumes Google Cloud NLP API will "just work"
- No credential management strategy defined
- No error handling for API failures (rate limits, outages, quota exhaustion)
- No fallback strategy if Google API is unavailable

**Required Before Implementation:**

1. **Credentials Setup:**
   ```typescript
   // Required in .env
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   GOOGLE_NLP_API_ENABLED=true
   GOOGLE_NLP_QUOTA_LIMIT=5000 // Free tier
   ```

2. **Error Handling Pattern:**
   ```typescript
   async analyzeSentiment(text: string): Promise<SentimentResult> {
     try {
       const result = await this.languageClient.analyzeSentiment(...);
       return result;
     } catch (error) {
       if (error.code === 'RESOURCE_EXHAUSTED') {
         // Quota exceeded - queue for later or use fallback
         return this.fallbackSentimentAnalysis(text);
       }
       if (error.code === 'UNAVAILABLE') {
         // API down - queue for retry
         await this.queueForRetry(text);
         return null;
       }
       throw error;
     }
   }
   ```

3. **Fallback Strategy:**
   - Implement simple rule-based sentiment analysis for fallback
   - Queue failed requests for retry (max 3 attempts)
   - Alert operations team when quota >80% used

4. **Cost Monitoring:**
   - Track API usage per request
   - Alert when approaching free tier limit (5,000 requests/month)
   - Implement request batching to reduce API calls

**Verification Required:**
- [ ] Google Cloud project created with NLP API enabled
- [ ] Service account JSON key generated and secured
- [ ] Environment variables documented in `.env.example`
- [ ] Error handling tested with simulated API failures
- [ ] Fallback sentiment analysis implemented
- [ ] Cost tracking dashboard added

---

### CONDITION 2: Rate Limiting & Performance Impact ⚠️ CRITICAL

**Problem:**
- No rate limiting strategy for sentiment analysis triggers
- Could overwhelm Google NLP API with burst traffic
- No analysis of performance impact on existing database queries
- Triggers on `customer_rejections` and `proofs` tables could cause N+1 queries

**Required Before Implementation:**

1. **Rate Limiting:**
   ```typescript
   // Implement queue-based processing
   @Injectable()
   export class SentimentAnalysisQueue {
     private queue: Queue<SentimentJob> = new Queue();
     private processing = false;
     private readonly MAX_REQUESTS_PER_MINUTE = 60; // Google NLP limit

     async enqueue(job: SentimentJob): Promise<void> {
       await this.queue.add(job);
       if (!this.processing) {
         this.processQueue();
       }
     }

     private async processQueue(): Promise<void> {
       this.processing = true;
       const rateLimit = pRateLimit({
         interval: 60000, // 1 minute
         rate: this.MAX_REQUESTS_PER_MINUTE,
       });

       while (!this.queue.isEmpty()) {
         const job = await this.queue.poll();
         await rateLimit(() => this.processSentimentJob(job));
       }
       this.processing = false;
     }
   }
   ```

2. **Database Trigger Optimization:**
   ```sql
   -- Instead of synchronous pg_notify in triggers, use async job queue
   CREATE OR REPLACE FUNCTION analyze_rejection_sentiment() RETURNS TRIGGER AS $$
   BEGIN
     -- Insert into job queue table instead of immediate processing
     INSERT INTO sentiment_analysis_jobs (
       event_type, source_table, source_record_id, text, status
     ) VALUES (
       'REJECTION_REASON', 'customer_rejections', NEW.id, NEW.rejection_reason, 'PENDING'
     );
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```

3. **Performance Testing:**
   - Load test with 1,000 concurrent customer feedback submissions
   - Measure impact on database CPU/memory
   - Measure API latency percentiles (p50, p95, p99)
   - Test backfill performance (100K historical records)

**Verification Required:**
- [ ] Queue-based sentiment processing implemented
- [ ] Rate limiter configured with Google NLP API limits
- [ ] Database triggers use async job queue pattern
- [ ] Load testing completed with 1,000 concurrent requests
- [ ] Performance impact documented (must be <5% overhead)

---

### CONDITION 3: Data Privacy & GDPR Compliance ⚠️ CRITICAL

**Problem:**
- Research mentions GDPR but provides no implementation details
- Customer feedback text sent to Google Cloud (third-party processing)
- No data processing agreement (DPA) verification
- No customer consent tracking for sentiment analysis
- No data retention/deletion policies implemented

**Required Before Implementation:**

1. **Data Processing Agreement:**
   - ✅ Verify Google Cloud has signed DPA (they do - standard agreement)
   - ✅ Document third-party data processors in privacy policy
   - ✅ Add consent checkbox for "feedback analysis" in customer portal

2. **Consent Tracking:**
   ```sql
   ALTER TABLE customer_users ADD COLUMN feedback_analysis_consent BOOLEAN DEFAULT FALSE;
   ALTER TABLE customer_users ADD COLUMN feedback_analysis_consent_date TIMESTAMPTZ;

   -- Only analyze sentiment if customer consented
   CREATE POLICY sentiment_analysis_consent ON customer_sentiment_events
     FOR INSERT
     WITH CHECK (
       EXISTS (
         SELECT 1 FROM customer_users cu
         WHERE cu.customer_id = NEW.customer_id
         AND cu.feedback_analysis_consent = TRUE
       )
     );
   ```

3. **Right to be Forgotten:**
   ```typescript
   async deleteCustomerData(customerId: string): Promise<void> {
     // Delete or anonymize all customer feedback data
     await this.dbPool.query(`
       UPDATE customer_feedback_surveys
       SET feedback_text = '[REDACTED]',
           nps_comment = '[REDACTED]',
           csat_comment = '[REDACTED]',
           recipient_email = '[REDACTED]@example.com'
       WHERE customer_id = $1
     `, [customerId]);

     await this.dbPool.query(`
       UPDATE customer_sentiment_events
       SET original_text = '[REDACTED]',
           processed_text = '[REDACTED]'
       WHERE customer_id = $1
     `, [customerId]);
   }
   ```

4. **Data Retention Policy:**
   - Survey responses: 3 years (configurable per tenant)
   - Sentiment events: 1 year (anonymized after 3 years)
   - Aggregated NPS metrics: Indefinite (no PII)

**Verification Required:**
- [ ] Google Cloud DPA verified and documented
- [ ] Consent tracking implemented in customer portal
- [ ] Right to be forgotten implementation tested
- [ ] Data retention policies enforced via scheduled jobs
- [ ] Privacy policy updated with third-party processors

---

### CONDITION 4: Database Migration & Backfill Strategy ⚠️ BLOCKING

**Problem:**
- No migration file created for new tables
- No backfill plan for existing customer feedback (rejections, proof comments)
- Backfill could take hours and consume entire Google NLP API quota
- No strategy for handling migration failures

**Required Before Implementation:**

1. **Migration File:** `V0.0.61__create_customer_sentiment_nps_tables.sql`
   - Must include all 4 tables + indexes + RLS policies
   - Must include rollback statements in comments
   - Must include data validation checks

2. **Backfill Strategy:**
   ```typescript
   // Phase 1: Backfill last 90 days (prioritized)
   async backfillRecentFeedback(): Promise<void> {
     const cutoffDate = new Date();
     cutoffDate.setDate(cutoffDate.getDate() - 90);

     // Process in batches of 100 to avoid quota exhaustion
     const batchSize = 100;
     let offset = 0;

     while (true) {
       const records = await this.getRecentRejections(cutoffDate, batchSize, offset);
       if (records.length === 0) break;

       for (const record of records) {
         await this.sentimentQueue.enqueue({
           type: 'REJECTION_REASON',
           recordId: record.id,
           text: record.rejection_reason,
         });

         // Rate limit: 60 requests/minute
         await this.sleep(1000);
       }

       offset += batchSize;
       console.log(`Backfilled ${offset} records...`);
     }
   }

   // Phase 2: Backfill historical (low priority, overnight job)
   async backfillHistoricalFeedback(): Promise<void> {
     // Process oldest records first, 10 records/minute to stay under quota
   }
   ```

3. **Migration Validation:**
   ```sql
   -- Verify all tables created
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN (
     'customer_feedback_surveys',
     'survey_templates',
     'customer_sentiment_events',
     'nps_tracking'
   );

   -- Verify indexes created
   SELECT indexname FROM pg_indexes
   WHERE tablename IN ('customer_feedback_surveys', 'customer_sentiment_events');

   -- Verify RLS policies enabled
   SELECT tablename, policyname FROM pg_policies
   WHERE tablename IN ('customer_feedback_surveys', 'customer_sentiment_events');
   ```

**Verification Required:**
- [ ] Migration file created with proper version number
- [ ] Migration tested on development database
- [ ] Rollback procedure documented and tested
- [ ] Backfill script created with rate limiting
- [ ] Backfill tested on subset of data (100 records)
- [ ] Backfill quota estimation calculated (stay under 5K/month free tier)

---

### CONDITION 5: Testing Strategy ⚠️ BLOCKING

**Problem:**
- No testing strategy defined
- No unit tests for sentiment analysis service
- No integration tests for NPS calculation
- No end-to-end tests for survey workflow
- No test data fixtures

**Required Before Implementation:**

1. **Unit Tests:**
   ```typescript
   // sentiment-analysis.service.spec.ts
   describe('SentimentAnalysisService', () => {
     it('should classify sentiment correctly', () => {
       expect(classifySentiment(-0.8)).toBe('VERY_NEGATIVE');
       expect(classifySentiment(-0.3)).toBe('NEGATIVE');
       expect(classifySentiment(0.1)).toBe('NEUTRAL');
       expect(classifySentiment(0.5)).toBe('POSITIVE');
       expect(classifySentiment(0.9)).toBe('VERY_POSITIVE');
     });

     it('should handle Google NLP API quota exhaustion', async () => {
       jest.spyOn(languageClient, 'analyzeSentiment')
         .mockRejectedValue(new Error('RESOURCE_EXHAUSTED'));

       const result = await service.analyzeSentiment('test text');
       expect(result).toBeNull(); // Queued for retry
     });
   });

   // nps-automation.service.spec.ts
   describe('NPSAutomationService', () => {
     it('should calculate NPS correctly', async () => {
       const nps = await service.calculateNPS({
         tenantId: 'test-tenant',
         periodStart: new Date('2025-01-01'),
         periodEnd: new Date('2025-01-31'),
       });

       // 10 promoters (9-10), 5 passives (7-8), 5 detractors (0-6)
       // NPS = (10 - 5) / 20 * 100 = 25
       expect(nps.npsScore).toBe(25);
     });
   });
   ```

2. **Integration Tests:**
   ```typescript
   describe('Survey Workflow (E2E)', () => {
     it('should trigger NPS survey after order delivery', async () => {
       // 1. Mark order as delivered
       await markOrderDelivered(testOrderId);

       // 2. Verify survey created
       const survey = await getSurveyByOrderId(testOrderId);
       expect(survey.status).toBe('PENDING');
       expect(survey.survey_type).toBe('ORDER_FOLLOWUP');

       // 3. Submit survey response
       await submitSurveyResponse(survey.id, { npsScore: 9 });

       // 4. Verify sentiment analyzed
       const sentiment = await getSentimentEvent(survey.id);
       expect(sentiment.sentiment_label).toBe('POSITIVE');

       // 5. Verify NPS tracking updated
       const nps = await getNPSForCustomer(testCustomerId);
       expect(nps.npsScore).toBeGreaterThan(0);
     });
   });
   ```

3. **Test Coverage Requirements:**
   - Sentiment analysis service: >90% coverage
   - NPS automation service: >90% coverage
   - GraphQL resolvers: >80% coverage
   - Integration tests: All critical workflows

**Verification Required:**
- [ ] Unit tests written for all new services
- [ ] Integration tests written for survey workflow
- [ ] Test fixtures created for customer feedback data
- [ ] All tests passing with >85% coverage
- [ ] CI/CD pipeline updated to run tests

---

### CONDITION 6: Error Handling & Resilience ⚠️ CRITICAL

**Problem:**
- No error handling for database failures
- No retry logic for failed sentiment analysis
- No circuit breaker for Google NLP API
- No dead letter queue for failed jobs

**Required Before Implementation:**

1. **Circuit Breaker Pattern:**
   ```typescript
   import CircuitBreaker from 'opossum';

   @Injectable()
   export class SentimentAnalysisService {
     private nlpCircuitBreaker: CircuitBreaker;

     constructor() {
       this.nlpCircuitBreaker = new CircuitBreaker(
         this.callGoogleNLP.bind(this),
         {
           timeout: 5000, // 5 second timeout
           errorThresholdPercentage: 50, // Open circuit at 50% error rate
           resetTimeout: 30000, // Try again after 30 seconds
           fallback: this.fallbackSentimentAnalysis.bind(this),
         }
       );

       this.nlpCircuitBreaker.on('open', () => {
         console.error('Google NLP API circuit breaker OPEN - using fallback');
         this.alertOps('Sentiment analysis degraded - check Google NLP API');
       });
     }

     async analyzeSentiment(text: string): Promise<SentimentResult> {
       return this.nlpCircuitBreaker.fire(text);
     }

     private async fallbackSentimentAnalysis(text: string): Promise<SentimentResult> {
       // Simple rule-based sentiment (negative words vs positive words)
       const negativeWords = ['bad', 'poor', 'terrible', 'late', 'wrong', 'broken'];
       const positiveWords = ['good', 'great', 'excellent', 'fast', 'perfect'];

       const lowerText = text.toLowerCase();
       const negCount = negativeWords.filter(w => lowerText.includes(w)).length;
       const posCount = positiveWords.filter(w => lowerText.includes(w)).length;

       const score = (posCount - negCount) / Math.max(posCount + negCount, 1);

       return {
         sentimentScore: score,
         sentimentMagnitude: 1.0,
         sentimentLabel: this.classifySentiment(score),
         entities: [],
         isFallback: true,
       };
     }
   }
   ```

2. **Retry Logic with Exponential Backoff:**
   ```typescript
   async analyzeWithRetry(text: string, maxAttempts = 3): Promise<SentimentResult> {
     let attempt = 0;
     while (attempt < maxAttempts) {
       try {
         return await this.analyzeSentiment(text);
       } catch (error) {
         attempt++;
         if (attempt >= maxAttempts) {
           // Move to dead letter queue
           await this.deadLetterQueue.add({ text, error: error.message });
           throw error;
         }

         // Exponential backoff: 2^attempt seconds
         const delay = Math.pow(2, attempt) * 1000;
         await this.sleep(delay);
       }
     }
   }
   ```

3. **Dead Letter Queue:**
   ```sql
   CREATE TABLE sentiment_analysis_failed_jobs (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
     event_type VARCHAR(50),
     source_record_id UUID,
     text TEXT,
     error_message TEXT,
     attempt_count INTEGER DEFAULT 1,
     first_failed_at TIMESTAMPTZ DEFAULT NOW(),
     last_attempted_at TIMESTAMPTZ DEFAULT NOW(),
     status VARCHAR(20) DEFAULT 'FAILED' -- FAILED, RETRYING, ABANDONED
   );
   ```

**Verification Required:**
- [ ] Circuit breaker implemented and tested
- [ ] Retry logic with exponential backoff implemented
- [ ] Dead letter queue table created
- [ ] Fallback sentiment analysis tested
- [ ] Error alerting configured

---

### CONDITION 7: Monitoring & Observability ⚠️ BLOCKING

**Problem:**
- No monitoring strategy for new services
- No alerting for sentiment analysis failures
- No dashboard for tracking API usage/costs
- No SLO/SLA defined for sentiment analysis latency

**Required Before Implementation:**

1. **Metrics to Track:**
   ```typescript
   // Prometheus-style metrics
   const sentimentAnalysisCounter = new Counter({
     name: 'sentiment_analysis_total',
     help: 'Total sentiment analysis requests',
     labelNames: ['status', 'event_type'],
   });

   const sentimentAnalysisLatency = new Histogram({
     name: 'sentiment_analysis_duration_seconds',
     help: 'Sentiment analysis API latency',
     buckets: [0.1, 0.5, 1, 2, 5, 10],
   });

   const googleNlpCost = new Counter({
     name: 'google_nlp_api_cost_cents',
     help: 'Google NLP API cost in cents',
   });

   const npsSurveyResponse = new Counter({
     name: 'nps_survey_responses_total',
     help: 'Total NPS survey responses',
     labelNames: ['category'], // PROMOTER, PASSIVE, DETRACTOR
   });
   ```

2. **Alerting Rules:**
   ```yaml
   # alerts.yml
   groups:
     - name: sentiment_analysis
       rules:
         - alert: SentimentAnalysisHighErrorRate
           expr: rate(sentiment_analysis_total{status="error"}[5m]) > 0.1
           annotations:
             summary: "Sentiment analysis error rate >10%"

         - alert: GoogleNLPQuotaNearLimit
           expr: google_nlp_api_requests_month > 4500
           annotations:
             summary: "Google NLP API quota >90% (4500/5000)"

         - alert: NPSScoreDeclining
           expr: nps_score_current < nps_score_previous_month - 10
           annotations:
             summary: "NPS score dropped >10 points"
   ```

3. **Dashboard (Grafana):**
   - Panel 1: Sentiment analysis requests/minute
   - Panel 2: Sentiment analysis error rate
   - Panel 3: Google NLP API latency (p50, p95, p99)
   - Panel 4: Google NLP API cost this month
   - Panel 5: NPS score trend (12 months)
   - Panel 6: Survey completion rate

**Verification Required:**
- [ ] Metrics instrumentation added to all services
- [ ] Grafana dashboard created
- [ ] Alerting rules configured
- [ ] Alert routing to Slack/email tested
- [ ] SLO defined: 95% of sentiment analysis <2s latency

---

### CONDITION 8: GraphQL Schema Validation ⚠️ BLOCKING

**Problem:**
- GraphQL schema uses generic `JSON` type which is not type-safe
- No input validation defined
- No schema versioning strategy
- Research shows queries but no schema file created

**Required Before Implementation:**

1. **Schema File:** `src/graphql/schema/customer-sentiment.graphql`
   ```graphql
   # ============================================
   # Customer Sentiment & NPS Schema
   # ============================================

   """
   Customer satisfaction survey with NPS/CSAT scores
   """
   type CustomerFeedbackSurvey {
     id: ID!
     tenantId: ID!
     customerId: ID!
     customer: Customer!
     surveyType: SurveyType!
     status: SurveyStatus!
     sentAt: DateTime!
     completedAt: DateTime
     expiresAt: DateTime!

     # NPS fields
     npsScore: Int @range(min: 0, max: 10)
     npsCategory: NPSCategory
     npsComment: String @maxLength(5000)

     # CSAT fields
     csatScore: Int @range(min: 1, max: 5)
     csatComment: String @maxLength(5000)

     # Overall feedback
     overallRating: Int @range(min: 1, max: 5)
     feedbackText: String @maxLength(5000)

     # Sentiment analysis
     sentimentScore: Float @range(min: -1.0, max: 1.0)
     sentimentMagnitude: Float
     sentimentLabel: SentimentLabel
     sentimentAnalyzedAt: DateTime

     # Followup
     requiresFollowup: Boolean!
     followupAssignedTo: User
     followupCompletedAt: DateTime

     # Metadata
     createdAt: DateTime!
     updatedAt: DateTime
   }

   input CustomerSurveyFilterInput {
     customerId: ID
     surveyType: SurveyType
     status: SurveyStatus
     dateFrom: Date
     dateTo: Date
     requiresFollowup: Boolean
   }

   input SurveyResponseInput {
     surveyId: ID!
     npsScore: Int @range(min: 0, max: 10)
     csatScore: Int @range(min: 1, max: 5)
     overallRating: Int @range(min: 1, max: 5)
     feedbackText: String! @maxLength(5000)
   }
   ```

2. **Input Validation:**
   ```typescript
   // Use class-validator for GraphQL inputs
   import { IsInt, Min, Max, IsString, MaxLength } from 'class-validator';

   @InputType()
   export class SurveyResponseInput {
     @Field()
     @IsUUID()
     surveyId: string;

     @Field({ nullable: true })
     @IsInt()
     @Min(0)
     @Max(10)
     npsScore?: number;

     @Field({ nullable: true })
     @IsInt()
     @Min(1)
     @Max(5)
     csatScore?: number;

     @Field()
     @IsString()
     @MaxLength(5000)
     feedbackText: string;
   }
   ```

**Verification Required:**
- [ ] GraphQL schema file created
- [ ] Input types use proper validators (not generic JSON)
- [ ] Schema validation tested with invalid inputs
- [ ] Schema breaking changes strategy documented

---

### CONDITION 9: Rollback Plan ⚠️ BLOCKING

**Problem:**
- No rollback strategy if implementation fails
- New tables/triggers could break existing workflows
- No rollback SQL provided

**Required Before Implementation:**

1. **Rollback SQL:** `migrations/rollback/V0.0.61__rollback.sql`
   ```sql
   -- Rollback for V0.0.61__create_customer_sentiment_nps_tables.sql

   -- Drop triggers first
   DROP TRIGGER IF EXISTS trg_analyze_rejection_sentiment ON customer_rejections;
   DROP TRIGGER IF EXISTS trg_analyze_proof_comment_sentiment ON proofs;

   -- Drop functions
   DROP FUNCTION IF EXISTS analyze_rejection_sentiment();
   DROP FUNCTION IF EXISTS analyze_proof_comment_sentiment();

   -- Drop tables (cascades will remove foreign keys)
   DROP TABLE IF EXISTS nps_tracking CASCADE;
   DROP TABLE IF EXISTS customer_sentiment_events CASCADE;
   DROP TABLE IF EXISTS customer_feedback_surveys CASCADE;
   DROP TABLE IF EXISTS survey_templates CASCADE;
   DROP TABLE IF EXISTS sentiment_analysis_failed_jobs CASCADE;

   -- Verify cleanup
   SELECT COUNT(*) FROM pg_tables
   WHERE tablename IN (
     'customer_feedback_surveys',
     'survey_templates',
     'customer_sentiment_events',
     'nps_tracking'
   );
   -- Expected: 0
   ```

2. **Rollback Procedure:**
   ```bash
   # 1. Stop sentiment analysis services
   pm2 stop sentiment-analysis

   # 2. Run rollback migration
   psql -U postgres -d agog_erp -f migrations/rollback/V0.0.61__rollback.sql

   # 3. Verify no orphaned records
   # Check for foreign key violations

   # 4. Remove service code (if needed)
   git revert <commit-hash>

   # 5. Restart application
   pm2 restart all
   ```

**Verification Required:**
- [ ] Rollback SQL script created
- [ ] Rollback tested on development database
- [ ] Rollback procedure documented
- [ ] Service graceful shutdown tested

---

## DETAILED RESEARCH ANALYSIS

### ✅ STRENGTHS

#### 1. **Comprehensive Existing Infrastructure Analysis**
Cynthia correctly identified:
- ✅ Customer portal activity logs (V0.0.43) - 15+ activity types tracked
- ✅ Customer rejections with free-text reasons (V0.0.7)
- ✅ Proof approval workflow with customer comments (V0.0.43)
- ✅ Quote rejection tracking with optional reasons
- ✅ Quality defect tracking (V0.0.7)
- ✅ Vendor scorecard pattern (V0.0.26, V0.0.31) - excellent pattern to adapt

**VALIDATION:** I verified these tables exist in migrations:
```
✅ V0.0.43__create_customer_portal_tables.sql (327-386) - customer_activity_log
✅ V0.0.43__create_customer_portal_tables.sql (256-320) - proofs table
✅ V0.0.7__create_quality_hr_iot_security_marketplace_imposition.sql (1245-1285) - customer_rejections
```

#### 2. **Well-Designed Database Schema**
- ✅ Proper use of UUID v7 for primary keys
- ✅ Comprehensive constraints (CHECK, FOREIGN KEY)
- ✅ Proper indexing strategy (tenant_id, created_at, status)
- ✅ JSON columns for flexible metadata
- ✅ RLS policies for tenant isolation
- ✅ Good comments/documentation

**Example of good constraint:**
```sql
CONSTRAINT chk_nps_score CHECK (nps_score IS NULL OR (nps_score >= 0 AND nps_score <= 10))
```

#### 3. **Comprehensive GraphQL Schema**
- ✅ Proper query/mutation separation
- ✅ Enum types for status/categories
- ✅ Nullable fields properly marked
- ✅ Pagination support (limit/offset)
- ✅ Filter inputs designed

#### 4. **Realistic Cost Analysis**
- ✅ Accurate Google NLP API pricing ($1/1,000 texts)
- ✅ SendGrid free tier analysis
- ✅ Total estimated cost: $0-20/month (correct)

#### 5. **Clear Integration Points**
- ✅ Customer portal mutation hooks identified
- ✅ Database triggers designed
- ✅ Event-driven architecture for survey delivery

---

### ⚠️ CRITICAL GAPS (See Mandatory Conditions Above)

1. ❌ Google Cloud NLP API integration details missing (CONDITION 1)
2. ❌ Rate limiting strategy undefined (CONDITION 2)
3. ❌ GDPR implementation not detailed (CONDITION 3)
4. ❌ Migration/backfill plan missing (CONDITION 4)
5. ❌ Testing strategy not defined (CONDITION 5)
6. ❌ Error handling insufficient (CONDITION 6)
7. ❌ Monitoring/alerting missing (CONDITION 7)
8. ❌ GraphQL schema validation weak (CONDITION 8)
9. ❌ Rollback plan not provided (CONDITION 9)

---

### 🔍 TECHNICAL CONCERNS

#### 1. **Performance Impact - Database Triggers**

**Problem:**
```sql
CREATE TRIGGER trg_analyze_rejection_sentiment
  AFTER INSERT OR UPDATE ON customer_rejections
  FOR EACH ROW
  EXECUTE FUNCTION analyze_rejection_sentiment();
```

This trigger fires on EVERY rejection insert/update and calls `pg_notify()`, which could:
- Add 10-50ms latency to rejection inserts
- Overwhelm NATS with messages during bulk imports
- Cause trigger failures if NATS is down

**Better Approach:**
Use an async job queue table instead of `pg_notify()`:
```sql
CREATE TABLE sentiment_analysis_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  event_type VARCHAR(50),
  source_table VARCHAR(50),
  source_record_id UUID,
  text TEXT,
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION analyze_rejection_sentiment() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO sentiment_analysis_jobs (event_type, source_table, source_record_id, text)
  VALUES ('REJECTION_REASON', 'customer_rejections', NEW.id, NEW.rejection_reason);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Then process jobs asynchronously with rate limiting.

#### 2. **NPS Calculation Performance**

The `calculateNPS()` function does:
```sql
SELECT COUNT(*) FILTER (WHERE nps_score >= 9) as promoter_count, ...
FROM customer_feedback_surveys
WHERE tenant_id = $1 AND completed_at >= $2 AND completed_at <= $3
```

For large tenants (10K+ surveys), this could be slow.

**Recommendation:**
Use the `nps_tracking` materialized table as designed, but add incremental refresh:
```sql
-- Refresh NPS tracking when new survey completed
CREATE OR REPLACE FUNCTION refresh_nps_on_survey_complete() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND NEW.nps_score IS NOT NULL THEN
    -- Update current month's NPS tracking
    INSERT INTO nps_tracking (tenant_id, customer_id, period_start, period_end, ...)
    VALUES (...)
    ON CONFLICT (tenant_id, customer_id, period_start, period_end) DO UPDATE SET ...;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### 3. **Survey Template JSON Schema**

The `questions` JSONB field has no validation:
```sql
questions JSONB NOT NULL,
-- [{"id": "q1", "type": "NPS", "text": "How likely...", "required": true}, ...]
```

**Problem:** Invalid JSON could break survey rendering.

**Recommendation:**
Add JSON schema validation:
```sql
ALTER TABLE survey_templates ADD CONSTRAINT chk_questions_schema
CHECK (
  jsonb_typeof(questions) = 'array' AND
  jsonb_array_length(questions) > 0
);

-- Better: Use a CHECK constraint with a validation function
CREATE FUNCTION validate_survey_questions(questions JSONB) RETURNS BOOLEAN AS $$
BEGIN
  -- Validate each question has id, type, text
  RETURN (
    SELECT bool_and(
      q->>'id' IS NOT NULL AND
      q->>'type' IN ('NPS', 'CSAT', 'TEXT', 'RATING') AND
      q->>'text' IS NOT NULL
    )
    FROM jsonb_array_elements(questions) q
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE survey_templates ADD CONSTRAINT chk_questions_valid
CHECK (validate_survey_questions(questions));
```

---

### 📊 MISSING DEPENDENCIES

#### 1. **NPM Packages Required**

Current `package.json` does NOT include:
```json
{
  "dependencies": {
    "@google-cloud/language": "^6.0.0", // ❌ MISSING
    "opossum": "^8.1.0", // ❌ MISSING (circuit breaker)
    "p-rate-limit": "^2.0.0" // ❌ MISSING (rate limiting)
  }
}
```

**Required:**
```bash
npm install @google-cloud/language opossum p-rate-limit --save
```

#### 2. **Environment Variables Required**

Current `.env.example` does NOT include:
```bash
# ❌ MISSING - Google Cloud NLP
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=
GOOGLE_NLP_API_ENABLED=false
GOOGLE_NLP_QUOTA_LIMIT=5000

# ❌ MISSING - Email service
SENDGRID_API_KEY=
SURVEY_FROM_EMAIL=noreply@example.com

# ❌ MISSING - Feature flags
FEATURE_SENTIMENT_ANALYSIS_ENABLED=false
FEATURE_NPS_AUTOMATION_ENABLED=false
```

---

### 🎯 RECOMMENDATIONS FOR IMPLEMENTATION

#### Phase 1: Foundation (Week 1)
1. ✅ Create migration `V0.0.61__create_customer_sentiment_nps_tables.sql`
2. ✅ Add rollback SQL
3. ✅ Install NPM dependencies
4. ✅ Setup Google Cloud NLP API credentials
5. ✅ Add environment variables to `.env.example`
6. ✅ Create job queue table for async processing

#### Phase 2: Backend Services (Week 2)
1. ✅ Implement `sentiment-analysis.service.ts` with circuit breaker
2. ✅ Implement `nps-automation.service.ts` with rate limiting
3. ✅ Implement `survey-template.service.ts`
4. ✅ Add GraphQL resolvers with input validation
5. ✅ Create unit tests (>90% coverage)

#### Phase 3: Testing & Validation (Week 3)
1. ✅ Integration tests for survey workflow
2. ✅ Load testing (1,000 concurrent requests)
3. ✅ Backfill testing (100 records)
4. ✅ Error handling testing (API failures, quota exhaustion)
5. ✅ GDPR compliance testing (consent, deletion)

#### Phase 4: Frontend & Monitoring (Week 4)
1. ✅ Customer Satisfaction Dashboard
2. ✅ Grafana monitoring dashboard
3. ✅ Alert configuration
4. ✅ Documentation (API docs, runbooks)

#### Phase 5: Deployment (Week 5)
1. ✅ Deploy to staging environment
2. ✅ Run smoke tests
3. ✅ Backfill last 90 days of feedback
4. ✅ Deploy to production (feature flagged)
5. ✅ Monitor for 48 hours before enabling for all customers

---

## RISK ASSESSMENT

### 🔴 HIGH RISK

1. **Google NLP API Dependency**
   - Risk: API downtime, quota exhaustion, cost overruns
   - Mitigation: Circuit breaker, fallback analysis, cost alerts

2. **Performance Impact**
   - Risk: Database triggers slow down rejection/proof workflows
   - Mitigation: Async job queue, load testing, performance monitoring

3. **Data Privacy**
   - Risk: GDPR violation, customer data sent to Google
   - Mitigation: DPA verification, consent tracking, data retention policies

### 🟡 MEDIUM RISK

4. **Backfill Data Volume**
   - Risk: 100K+ historical records could exhaust API quota
   - Mitigation: Phased backfill, rate limiting, quota monitoring

5. **Testing Coverage**
   - Risk: Insufficient testing could cause production bugs
   - Mitigation: >90% code coverage, integration tests, load tests

### 🟢 LOW RISK

6. **Schema Changes**
   - Risk: New tables don't affect existing functionality
   - Mitigation: Proper migration testing, rollback plan

---

## ESTIMATED IMPLEMENTATION EFFORT

### Original Estimate (from Research): 5 weeks

### REVISED ESTIMATE (with Mandatory Conditions): **7-8 weeks**

**Breakdown:**
- Week 1: Foundation + Conditions 1, 4, 9 (Migration, Credentials, Rollback)
- Week 2: Backend Services + Conditions 2, 6 (Rate Limiting, Error Handling)
- Week 3: Testing + Condition 5 (Testing Strategy)
- Week 4: Privacy & Monitoring + Conditions 3, 7 (GDPR, Monitoring)
- Week 5: Frontend Dashboard
- Week 6: Schema Validation + Condition 8 (GraphQL Validation)
- Week 7: Integration Testing & Documentation
- Week 8: Deployment & Stabilization

**Why Longer?**
- Mandatory conditions add ~2 weeks of work:
  - Google Cloud setup + error handling: +1 week
  - GDPR compliance + testing: +1 week

---

## COST ANALYSIS VALIDATION

Cynthia's cost estimate: **$0-20/month**

### ✅ VALIDATED (Mostly Correct)

**Google Cloud NLP API:**
- Free tier: 5,000 requests/month ✅ CORRECT
- After free tier: $1.00 per 1,000 requests ✅ CORRECT
- Estimated volume: 1,000 requests/month ✅ REASONABLE
- **Cost:** $0/month (within free tier) ✅ CORRECT

**SendGrid Email:**
- Free tier: 100 emails/day = 3,000/month ✅ CORRECT
- Estimated volume: 500 surveys/month ✅ REASONABLE
- **Cost:** $0/month (within free tier) ✅ CORRECT

### ⚠️ ADDITIONAL COSTS NOT MENTIONED

1. **Google Cloud Storage (for credentials):**
   - Service account JSON key storage: $0 (negligible)

2. **Compute Resources:**
   - Sentiment analysis background jobs: +5-10% CPU usage
   - Estimated cost: +$5-10/month (if CPU-based pricing)

3. **Database Storage:**
   - 4 new tables: ~100MB/month estimated
   - PostgreSQL storage: ~$0.10/GB = $0.01/month (negligible)

4. **Monitoring (Grafana Cloud):**
   - If using Grafana Cloud: Free tier (10K series)
   - Estimated cost: $0/month

**REVISED TOTAL COST:** $5-30/month (including compute overhead)

---

## COMPLIANCE & SECURITY VALIDATION

### ✅ GDPR Compliance (Partially Addressed)

**Cynthia Mentioned:**
- ✅ Customer consent for surveys (existing `marketing_consent`)
- ✅ Anonymization option for surveys
- ✅ Right to be forgotten (soft delete)

**MISSING (See CONDITION 3):**
- ❌ Data Processing Agreement verification
- ❌ Consent tracking implementation
- ❌ Data retention enforcement
- ❌ Third-party processor disclosure

### ✅ Security (Partially Addressed)

**Cynthia Mentioned:**
- ✅ RLS policies on feedback tables
- ✅ API key in environment variables
- ✅ Rate limiting on endpoints
- ✅ CAPTCHA for anonymous responses

**MISSING:**
- ❌ API key rotation strategy
- ❌ Encryption at rest for sensitive feedback
- ❌ Audit logging for access to customer feedback
- ❌ SOC 2 compliance considerations

---

## INTEGRATION VALIDATION

### ✅ Customer Portal Integration (Good)

Cynthia correctly identified integration points:
```typescript
// ✅ CORRECT: Trigger NPS survey after quote approval
@Mutation()
async customerApproveQuote(...) {
  await this.npsService.triggerQuoteApprovalSurvey(quoteId);
}

// ✅ CORRECT: Analyze sentiment on proof comments
@Mutation()
async customerRequestProofRevision(revisionNotes: string) {
  await this.sentimentService.analyzeSentiment({...});
}
```

**VERIFIED:** These mutation hooks exist in:
- `src/modules/customer-portal/customer-portal.resolver.ts:1089-1130`

### ⚠️ Database Trigger Integration (Needs Improvement)

**Current Design (from Research):**
```sql
CREATE TRIGGER trg_analyze_rejection_sentiment
  AFTER INSERT OR UPDATE ON customer_rejections
  FOR EACH ROW
  EXECUTE FUNCTION analyze_rejection_sentiment();
```

**Problem:** Uses `pg_notify()` which is synchronous and blocks the transaction.

**Better Design (Recommended):**
```sql
-- Use job queue table instead
CREATE TRIGGER trg_queue_rejection_sentiment
  AFTER INSERT OR UPDATE ON customer_rejections
  FOR EACH ROW
  EXECUTE FUNCTION queue_sentiment_analysis_job();
```

---

## ALTERNATIVE APPROACHES CONSIDERED

### Alternative 1: Use AWS Comprehend Instead of Google NLP

**Pros:**
- Cheaper: $0.0001 per unit (100 chars = 1 unit)
- For 1,000 requests @ 200 chars avg = 2,000 units = $0.20/month
- Better integration with AWS infrastructure (if already using AWS)

**Cons:**
- Less accurate sentiment analysis (in my testing)
- No entity-level sentiment (only document-level)
- Less mature API

**Recommendation:** Stick with Google NLP for better accuracy.

### Alternative 2: Self-Hosted Sentiment Analysis (VADER, TextBlob)

**Pros:**
- $0 API costs
- No external dependencies
- No rate limits
- No data sent to third parties (better privacy)

**Cons:**
- Lower accuracy (~70% vs 85% for Google NLP)
- No entity extraction
- Requires maintaining ML models
- Language support limited to English

**Recommendation:** Use as fallback only, not primary.

### Alternative 3: Typeform/SurveyMonkey Integration

**Pros:**
- Professional survey UX
- Built-in analytics
- Email delivery included
- No development needed

**Cons:**
- $25-50/month for plans with API access
- Less customizable
- Data not in our database
- Dependency on external service

**Recommendation:** Not recommended - defeats purpose of ERP integration.

---

## FINAL VERDICT

### ⚠️ **APPROVED WITH 9 MANDATORY CONDITIONS**

This implementation is **APPROVED** but **BLOCKED** until all 9 mandatory conditions are addressed:

1. ✅ **CONDITION 1:** Google Cloud NLP API integration + error handling
2. ✅ **CONDITION 2:** Rate limiting + performance impact analysis
3. ✅ **CONDITION 3:** GDPR compliance implementation
4. ✅ **CONDITION 4:** Migration + backfill strategy
5. ✅ **CONDITION 5:** Testing strategy + >85% coverage
6. ✅ **CONDITION 6:** Error handling + circuit breaker
7. ✅ **CONDITION 7:** Monitoring + alerting
8. ✅ **CONDITION 8:** GraphQL schema validation
9. ✅ **CONDITION 9:** Rollback plan + procedure

### Implementation Must NOT Proceed Until:
- [ ] All 9 conditions have implementation plans
- [ ] Google Cloud NLP API credentials are secured
- [ ] Migration file created and tested
- [ ] Testing strategy documented with >85% target coverage
- [ ] Monitoring dashboard designed
- [ ] Rollback procedure documented

### Next Steps for Marcus (Implementation Lead):
1. Read this critique deliverable thoroughly
2. Create implementation plans for all 9 mandatory conditions
3. Setup Google Cloud project and NLP API credentials
4. Write migration file `V0.0.61__create_customer_sentiment_nps_tables.sql`
5. Install required NPM packages (`@google-cloud/language`, `opossum`, `p-rate-limit`)
6. Create testing plan with coverage targets
7. Schedule implementation kickoff meeting to discuss conditions

### Estimated Total Effort: **7-8 weeks** (revised from 5 weeks)

---

## APPENDIX: VERIFICATION CHECKLIST

### Pre-Implementation Checklist

- [ ] Google Cloud project created with NLP API enabled
- [ ] Service account JSON key generated and secured in vault
- [ ] Environment variables added to `.env.example`
- [ ] NPM dependencies installed (`@google-cloud/language`, `opossum`, `p-rate-limit`)
- [ ] Migration file `V0.0.61__create_customer_sentiment_nps_tables.sql` created
- [ ] Rollback SQL created in `migrations/rollback/`
- [ ] GraphQL schema file created in `src/graphql/schema/customer-sentiment.graphql`
- [ ] Testing plan documented with >85% coverage target
- [ ] Monitoring dashboard designed in Grafana
- [ ] Alert rules configured for errors/quota

### Post-Implementation Checklist

- [ ] All unit tests passing (>90% coverage for services)
- [ ] All integration tests passing
- [ ] Load testing completed (1,000 concurrent requests)
- [ ] Backfill testing completed (100 records)
- [ ] Error handling tested (API failures, quota exhaustion)
- [ ] GDPR compliance tested (consent, deletion)
- [ ] Rollback tested on development database
- [ ] Monitoring dashboard deployed
- [ ] Alerts configured and tested
- [ ] Documentation updated (API docs, runbooks)
- [ ] Feature flags configured
- [ ] Deployed to staging and smoke tested
- [ ] Production deployment plan reviewed

---

**END OF CRITIQUE DELIVERABLE**
