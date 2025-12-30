# Sylvia Critique Report: Customer-Specific Pricing Engine

**Feature:** REQ-CUSTOMER-PRICING-001 / Customer-Specific Pricing Engine
**Critiqued By:** Sylvia (Architecture Critique & Gate)
**Date:** 2025-12-21
**Decision:** ✅ APPROVED WITH CONDITIONS
**NATS Channel:** agog.deliverables.sylvia.critique.REQ-CUSTOMER-PRICING-001

---

## Executive Summary

**VERDICT: ✅ APPROVED WITH CONDITIONS**

Cynthia's research is **EXCEPTIONAL** - comprehensive, thorough, and demonstrates deep understanding of pricing systems. The analysis correctly identifies that database infrastructure exists but the critical pricing calculation engine is missing. The approach is sound and aligns with industry best practices for pricing engines.

**KEY FINDING:** Cynthia correctly identified the core gap - **NO PRICING CALCULATION ENGINE EXISTS**. The database schema is production-ready, but the business logic layer is completely missing. This is the right problem to solve.

**CRITICAL ISSUES IDENTIFIED: 2**
**HIGH-PRIORITY RECOMMENDATIONS: 6**

**Bottom Line:** Ready for Sarah (Product Owner) implementation AFTER addressing 2 critical schema gaps and clarifying 2 business rule questions. Estimated fix time: 4-6 hours of schema updates + business rule clarification.

---

## AGOG Standards Compliance

### ✅ PASS: Database Standards (Existing Schema)

**uuid_generate_v7() Pattern:**
- ✅ **CORRECT** - V0.0.6 migration lines 775, 1101: `DEFAULT uuid_generate_v7()`
- ✅ Both `customer_pricing` and `pricing_rules` tables use time-ordered UUIDs
- ✅ Consistent with AGOG standards and V0.0.0 extension enablement

**tenant_id Multi-Tenant Isolation:**
- ✅ **CORRECT** - Both tables include `tenant_id UUID NOT NULL`
- ✅ Foreign key constraints to `tenants(id)` - lines 804, 1140
- ✅ Unique constraint scoped by tenant: `UNIQUE (tenant_id, rule_code)` - line 1141
- ✅ Indexed for query performance - lines 809, 1144

**Surrogate Key + Business Identifier:**
- ✅ **CORRECT** - UUID primary key (id) + unique business identifier (rule_code)
- ✅ Pattern: `id UUID PK` + `UNIQUE (tenant_id, rule_code)` for pricing_rules
- ✅ customer_pricing uses composite uniqueness (customer_id, product_id, dates)

**PostgreSQL 15+ Features:**
- ✅ uuid_generate_v7() extension enabled
- ✅ JSONB for flexible conditions (pricing_rules.conditions, customer_pricing.price_breaks)
- ✅ Date range indexing for effective_from/effective_to queries

### 🟡 PARTIAL PASS: Schema-Driven Development

**Existing Schema (V0.0.6):**
- ✅ Database tables created with proper structure
- ❌ **ISSUE #1 (CRITICAL)**: No YAML schema exists for pricing module
- ❌ **ISSUE #2 (CRITICAL)**: Missing SCD Type 2 columns (`is_current_version`) on `customer_pricing` table

**Missing YAML Schema:**
- **Location:** Should exist at `backend/data-models/schemas/pricing/customer-pricing.yaml`
- **Impact:** Cannot validate schema compliance, cannot generate TypeScript types, violates schema-driven development principle
- **Fix Required:** Create YAML schema BEFORE implementing pricing service
- **Effort:** 2-3 hours to document existing schema + add missing SCD Type 2 columns

**SCD Type 2 Gap:**
- Cynthia correctly identified this gap (research line 71-75)
- `customer_pricing` table has `effective_from`/`effective_to` but missing `is_current_version` flag
- Required for efficient historical queries: `WHERE is_current_version = TRUE` (index scan vs. date range scan)
- Follows V0.0.10 pattern from audit column standardization

### ✅ PASS: Multi-Tenant Security Design

**Tenant Isolation:**
- ✅ tenant_id foreign key constraints on both tables
- ✅ Unique constraints scoped by tenant_id
- ✅ Query filters specified: "MUST validate tenant_id from JWT"
- ✅ Cynthia documented security patterns (research lines 301-327, 612-728)

**RLS Policies:**
- ✅ **CORRECT DECISION** - Cynthia assessed RLS not strictly required (application-level enforcement)
- ✅ Parameterized queries provide sufficient tenant isolation
- ✅ RLS could be added later for defense-in-depth (optional enhancement)

**Authorization Model:**
- ✅ Role-based permissions documented (research lines 316-319)
- ✅ Approval workflow authority limits specified (sales rep < manager < executive)
- ⚠️ **RECOMMENDATION**: Needs approval authority matrix from Sarah before implementation

### 🟡 PARTIAL PASS: Documentation Standards

**Research Quality:**
- ✅ Comprehensive (1,190 lines covering requirements, constraints, edge cases, security)
- ✅ Evidence-based (15 file reads, multiple grep searches, thorough codebase analysis)
- ✅ Actionable (10 files to create/modify, clear implementation roadmap)
- ❌ **MINOR**: Agent deliverables exempt from Navigation Path requirement (acceptable)

---

## Architecture Review

### ✅ EXCELLENT: Problem Identification

**Cynthia's Core Finding:**
- ✅ **ACCURATE** - "Database schema and GraphQL API infrastructure already exist... However, NO PRICING CALCULATION ENGINE EXISTS"
- ✅ This is the RIGHT problem statement
- ✅ Correctly identified the gap: data structures ✅ | business logic ❌

**Missing Components Identified:**
1. ❌ Pricing calculation engine/service (research line 21)
2. ❌ Rule evaluation logic (priority-based) (line 22)
3. ❌ Quantity break calculation algorithm (line 23)
4. ❌ Promotional pricing application (line 24)
5. ❌ Contract pricing validation (line 25)
6. ❌ Discount approval workflow (line 26)
7. ❌ Price history queries (as-of-date lookups) (line 27)
8. ❌ Pricing audit trail and change notifications (line 28)

**Assessment:** This is a comprehensive and accurate gap analysis.

### ✅ GOOD: Service Layer Architecture Recommendation

**Cynthia's Recommendation (research lines 464-475):**
- ✅ Create `pricing.service.ts` with business logic
- ✅ Create `pricing-rules.service.ts` for rule evaluation
- ✅ Create `approval.service.ts` for workflow (if not exists)
- ✅ Resolvers should call service, not DB directly
- ✅ Separation of concerns: data access vs. business logic

**Critique:**
- ✅ **SOUND DESIGN** - Service layer is the correct architectural pattern for complex business logic
- ✅ Aligns with industry best practices (Domain-Driven Design, Hexagonal Architecture)
- ✅ Improves testability (unit test services independently)
- ✅ **HOWEVER**: Current codebase has NO service layer (research line 464) - this is a significant architectural shift

**Recommendation:**
- ✅ Approve service layer approach
- ⚠️ **CONDITION**: Roy must coordinate with Sarah - is introducing service layer in scope for this feature?
- ⚠️ **RISK**: If service layer is new pattern, estimate may be too low (3-4 weeks includes learning curve)

### ✅ EXCELLENT: Pricing Engine Design

**Cynthia's Proposed Algorithm (research lines 198-280):**

1. **calculatePrice Query:**
   - Input: tenantId, customerId, productId, quantity, orderDate, currencyCode
   - Output: PriceCalculationResult with breakdown
   - ✅ **CORRECT** - This is the right API contract

2. **Calculation Steps:**
   - Step 1: Get base price from `products.list_price`
   - Step 2: Check `customer_pricing` for customer-specific price
   - Step 3: Apply quantity breaks (JSONB `price_breaks` field)
   - Step 4: Evaluate `pricing_rules` by priority
   - Step 5: Apply promotional/contract pricing
   - Step 6: Currency conversion if needed
   - Step 7: Margin validation (prevent below-cost pricing)
   - Step 8: Check approval threshold (>20% discount)

**Critique:**
- ✅ **INDUSTRY-STANDARD ALGORITHM** - This is how sophisticated pricing engines work
- ✅ Waterfall approach (base → customer → quantity → rules → promotions) is correct
- ✅ Priority-based rule evaluation is the right pattern
- ⚠️ **QUESTION**: Rule stacking vs. best-only? (research line 930-933) - NEEDS CLARIFICATION

**Missing Consideration:**
- ⚠️ **RECOMMENDATION #1**: Add caching strategy for pricing rules (frequently accessed, read-heavy)
- ✅ Cynthia mentioned Redis caching (research line 803) - good thinking

### 🟡 CONCERNS: Complexity Estimate

**Cynthia's Estimate:**
- 3-4 weeks total
- Database: 1-2 days (Ron - out of scope for pricing, schema already exists)
- Backend: 2.5-3 weeks (Roy)
- QA: 3-4 days (Billy)
- DevOps: 1 day (Miki)

**Critique:**
- ⚠️ **CONCERN**: Estimate assumes Roy is familiar with service layer pattern
- ⚠️ **CONCERN**: No mention of approval workflow complexity (research line 76-83 identifies workflow engine NOT YET IMPLEMENTED)
- ✅ **HOWEVER**: Phased approach is sound (6 phases, incremental delivery)

**Revised Estimate (Sylvia's Assessment):**
- Phase 1: Database schema enhancement (1-2 days) - ✅ REALISTIC
- Phase 2: Pricing calculation service (1.5 weeks) - ✅ REALISTIC if service layer pattern established
- Phase 3: GraphQL API enhancement (3-4 days) - ✅ REALISTIC
- Phase 4: Approval workflow integration (1 week) - ⚠️ **UNDERESTIMATED** if workflow engine doesn't exist
- Phase 5: Historical queries & SCD Type 2 (2-3 days) - ✅ REALISTIC
- Phase 6: QA testing (1 week) - ✅ REALISTIC

**REVISED TOTAL: 4-5 weeks** (if approval workflow needs full implementation, 5-6 weeks)

### ✅ EXCELLENT: Edge Cases Analysis

**Cynthia identified 11 edge cases (research lines 510-610):**

1. **Overlapping Effective Dates** - ✅ Resolution: Prevent via constraint or use priority
2. **No Pricing Data** - ✅ Fallback to list price
3. **Multiple Applicable Rules** - ✅ Priority-based evaluation
4. **Quantity Break Boundary** - ✅ Use >= comparison (inclusive)
5. **Future Effective Date** - ✅ Filter by `effective_from <= orderDate`
6. **Expired Pricing** - ✅ Filter by `effective_to IS NULL OR effective_to >= orderDate`
7. **Currency Mismatch** - ✅ Exchange rate conversion
8. **Negative Pricing** - ✅ Validation: final price must be > 0
9. **Below-Cost Pricing** - ✅ Warning + approval workflow
10. **Approval Workflow Loop** - ✅ Track rejection history, escalation rules

**Additional Edge Cases (Sylvia Identified):**

11. **Concurrent Price Updates** - ✅ Cynthia addressed with optimistic locking (research line 595-599)
12. **Price Snapshot for Orders** - ✅ Cynthia addressed (research line 599) - store calculated price in sales_order_lines
13. **Tenant Isolation Breach** - ✅ Cynthia addressed with JWT validation (research line 616-623)

**Assessment:** Edge case analysis is COMPREHENSIVE. No critical gaps identified.

---

## Security Review

### ✅ EXCELLENT: Threat Analysis

**Cynthia identified 6 OWASP vulnerabilities (research lines 612-728):**

1. **Tenant Isolation Breach** - ✅ Mitigation: JWT validation, RLS policies, tenant_id filtering
2. **SQL Injection** - ✅ Mitigation: Parameterized queries ($1, $2, etc.), JSONB validation
3. **Price Manipulation** - ✅ Mitigation: Server-side calculation ONLY, never trust client
4. **Approval Bypass** - ✅ Mitigation: Database triggers, audit log, workflow enforcement
5. **Historical Data Tampering** - ✅ Mitigation: SCD Type 2 immutability, never UPDATE historical records
6. **Unauthorized Discounts** - ✅ Mitigation: Role-based permissions, executive approval for >20%

**Security Recommendations (research lines 674-728):**
- ✅ Create PricingService with SecurityContext validation
- ✅ Implement approval workflow with role checks
- ✅ Add database triggers for discount validation

**Critique:**
- ✅ **EXCELLENT SECURITY ANALYSIS** - Covers authentication, authorization, data integrity, audit trail
- ✅ Follows OWASP Top 10 best practices
- ✅ Mitigations are practical and implementable

### 🟡 ADDITIONAL SECURITY RECOMMENDATIONS

**Missing Considerations:**

**RECOMMENDATION #2: Rate Limiting**
- Add rate limiting for pricing calculation API (prevent abuse/DoS)
- Example: Max 100 price calculations per minute per user
- Implementation: Redis-based rate limiter middleware

**RECOMMENDATION #3: Sensitive Data Encryption**
- Consider encryption at rest for customer-specific pricing (competitive advantage data)
- Use PostgreSQL pgcrypto for column-level encryption if required
- Check with Legal/Compliance team on data classification

**RECOMMENDATION #4: Audit Trail Retention**
- Research line 950-956 asks "How long must price history be retained?"
- **CRITICAL DECISION NEEDED**: 7 years (tax compliance), 10 years (Sarbanes-Oxley), or forever?
- Must align with company data retention policy

---

## Issues Found

### CRITICAL Issues (MUST FIX Before Implementation)

**1. CRITICAL: Missing YAML Schema for Pricing Module**
- **Location:** Should exist at `backend/data-models/schemas/pricing/`
- **Issue:** No YAML schema for customer_pricing, pricing_rules, or pricing service
- **Impact:** Violates AGOG schema-driven development principle (YAML → Code)
- **Fix Required:**
  - Create `customer-pricing.yaml` documenting existing schema + enhancements
  - Create `pricing-rules.yaml` documenting existing schema
  - Create `pricing-service.yaml` defining service interfaces
- **Rationale:** AGOG standard requires YAML schema BEFORE code (AGOG_AGENT_ONBOARDING.md line 85-91)
- **Effort:** 2-3 hours to document existing schema + add SCD Type 2 columns

**Example YAML Schema:**
```yaml
customer_pricing:
  description: "Customer-specific pricing agreements with SCD Type 2 history"

  columns:
    id:
      type: uuid
      default: uuid_generate_v7()
      constraints:
        - primary_key

    tenant_id:
      type: uuid
      description: "Multi-tenant isolation"
      constraints:
        - not_null
        - foreign_key: tenants.id
        - indexed

    customer_id:
      type: uuid
      constraints:
        - not_null
        - foreign_key: customers.id

    product_id:
      type: uuid
      constraints:
        - not_null
        - foreign_key: products.id

    unit_price:
      type: decimal(18,4)
      constraints:
        - not_null

    price_breaks:
      type: jsonb
      description: "Quantity tier pricing: [{min_qty: 1000, price: 10.50}, ...]"

    effective_from:
      type: date
      constraints:
        - not_null

    effective_to:
      type: date
      default: '9999-12-31'

    # SCD Type 2 column (MISSING IN CURRENT SCHEMA)
    is_current_version:
      type: boolean
      default: true
      description: "Fast current version queries: WHERE is_current_version = TRUE"

    # Approval workflow columns (MISSING IN CURRENT SCHEMA)
    approval_status:
      type: varchar(20)
      default: 'APPROVED'
      values: [PENDING, APPROVED, REJECTED]

    approved_by_user_id:
      type: uuid
      constraints:
        - foreign_key: users.id

    approved_at:
      type: timestamptz

    rejection_reason:
      type: text

    # Standard audit columns (V0.0.11 pattern)
    created_at:
      type: timestamptz
      default: NOW()

    created_by_user_id:
      type: uuid
      constraints:
        - foreign_key: users.id

    updated_at:
      type: timestamptz

    updated_by_user_id:
      type: uuid
      constraints:
        - foreign_key: users.id

  indexes:
    - columns: [tenant_id, customer_id, product_id, is_current_version]
      name: idx_customer_pricing_current
    - columns: [tenant_id, effective_from, effective_to]
      name: idx_customer_pricing_dates
    - columns: [approval_status, tenant_id]
      name: idx_customer_pricing_approval
      where: "approval_status = 'PENDING'"

  constraints:
    - unique: [tenant_id, customer_id, product_id, effective_from]
      name: uq_customer_pricing_version
```

**2. CRITICAL: Missing SCD Type 2 Support on customer_pricing Table**
- **Location:** V0.0.6 migration line 774-807
- **Issue:** `customer_pricing` table has `effective_from`/`effective_to` but missing `is_current_version` flag
- **Impact:** Historical queries require expensive date range scans instead of index scans
- **Fix Required:**
  ```sql
  -- Migration: Add SCD Type 2 support to customer_pricing
  ALTER TABLE customer_pricing
    ADD COLUMN is_current_version BOOLEAN DEFAULT TRUE;

  -- Add approval workflow columns
  ALTER TABLE customer_pricing
    ADD COLUMN approval_status VARCHAR(20) DEFAULT 'APPROVED'
      CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    ADD COLUMN approved_by_user_id UUID REFERENCES users(id),
    ADD COLUMN approved_at TIMESTAMPTZ,
    ADD COLUMN rejection_reason TEXT;

  -- Index for current version queries (most common)
  CREATE INDEX idx_customer_pricing_current
    ON customer_pricing(tenant_id, customer_id, product_id, is_current_version)
    WHERE is_current_version = TRUE;

  -- Index for approval workflow
  CREATE INDEX idx_customer_pricing_approval
    ON customer_pricing(approval_status, tenant_id)
    WHERE approval_status = 'PENDING';
  ```
- **Rationale:** Follows V0.0.10 SCD Type 2 pattern used in 86 tables
- **Effort:** 30 minutes to write migration, 30 minutes to test

### HIGH Priority Recommendations (Should Address)

**3. HIGH: Clarify Pricing Rule Stacking Strategy**
- **Question:** When multiple pricing rules apply (volume discount + promotional), do they stack or apply best-only?
- **Impact:** Fundamentally changes pricing calculation algorithm
- **Options:**
  - **Option A (Cumulative):** Apply all rules, sum discounts (more generous to customer)
  - **Option B (Best-Only):** Apply single best rule by priority (simpler logic, more predictable)
  - **Option C (Configurable):** Rule has `stacking_allowed` flag (most flexible, most complex)
- **Recommendation:** Sarah MUST decide before Roy implements
- **Effort:** 1 hour meeting with Sarah to clarify business rule

**4. HIGH: Define Approval Authority Matrix**
- **Question:** Exact discount thresholds for each role? (research line 935-942)
- **Impact:** Determines approval workflow routing logic
- **Required Information:**
  - Sales rep: Can approve up to X%? (suggest: 0%, no approval authority)
  - Sales manager: Can approve up to Y%? (suggest: 20%)
  - VP Sales: Can approve up to Z%? (suggest: 40%)
  - CFO: Unlimited? (suggest: yes)
- **Recommendation:** Sarah provides approval matrix, Roy implements as configuration (not hardcoded)
- **Effort:** 30 minute meeting, 2 hours to implement as tenant-configurable setting

**5. HIGH: Add Migration for Audit Column Standardization**
- **Issue:** `customer_pricing` and `pricing_rules` tables use old audit column names (research identifies this)
- **Current:** `created_by UUID`, `updated_by UUID`
- **Should Be:** `created_by_user_id UUID`, `updated_by_user_id UUID` (V0.0.11 pattern)
- **Impact:** Inconsistency with rest of codebase (86 tables standardized in V0.0.11)
- **Fix Required:**
  ```sql
  -- Rename audit columns to V0.0.11 standard
  ALTER TABLE customer_pricing
    RENAME COLUMN created_by TO created_by_user_id;
  ALTER TABLE customer_pricing
    RENAME COLUMN updated_by TO updated_by_user_id;

  ALTER TABLE pricing_rules
    RENAME COLUMN created_by TO created_by_user_id;
  ALTER TABLE pricing_rules
    RENAME COLUMN updated_by TO updated_by_user_id;
  ```
- **Effort:** 20 minutes to write migration, 20 minutes to test

**6. HIGH: Add Pricing Calculation Performance Benchmarks**
- **Recommendation:** Define EXPLAIN ANALYZE targets for pricing queries
- **Targets from research (line 329-333):**
  - Price calculation: < 100ms per line item
  - Pricing history query: < 500ms
  - Bulk price update: < 5 seconds for 1000 records
- **Add Performance Tests:**
  - Load test with 50,000 customer_pricing records
  - Concurrent price calculations (100 users)
  - Historical query with 1M+ SCD Type 2 records
- **Effort:** 3 hours to write performance tests, 2 hours to measure in staging

**7. HIGH: Create Pricing Service Unit Tests FIRST (TDD Approach)**
- **Recommendation:** Write tests BEFORE implementing pricing service
- **Test Cases:**
  - calculatePrice with base list price only
  - calculatePrice with customer-specific price
  - calculatePrice with quantity breaks (boundary conditions)
  - calculatePrice with multiple pricing rules (stacking vs. best-only)
  - calculatePrice with currency conversion
  - calculatePrice requiring approval (>20% discount)
  - calculatePrice with below-cost pricing (negative margin)
- **Benefit:** TDD ensures algorithm correctness, prevents regression
- **Effort:** 1 week to write comprehensive test suite (included in 3-4 week estimate)

**8. HIGH: Document Reference Data Seed Strategy**
- **Recommendation:** Define seed data for pricing rule types
- **pricing_rules.rule_type values:**
  - VOLUME_DISCOUNT - Quantity-based discounts
  - CUSTOMER_TIER - Gold/Silver/Bronze customer tiers
  - PRODUCT_CATEGORY - Category-based pricing
  - SEASONAL - Holiday/seasonal promotions
  - PROMOTIONAL - Time-limited promotions
  - CLEARANCE - End-of-life products
  - CONTRACT_PRICING - Long-term contract agreements
- **pricing_rules.pricing_action values:**
  - PERCENTAGE_DISCOUNT - Reduce price by X%
  - FIXED_DISCOUNT - Reduce price by $X
  - FIXED_PRICE - Override with specific price
  - MARKUP_PERCENTAGE - Increase price by X% (for cost-plus)
- **Benefit:** Enables development/testing with realistic data
- **Effort:** 1 hour to create seed data SQL script

---

## Implementation Recommendations

### ✅ APPROVE Cynthia's Phased Approach

**Phase 1: Database Schema Enhancement (1-2 days)**
- ✅ Add SCD Type 2 columns (is_current_version)
- ✅ Add approval workflow columns
- ✅ Rename audit columns to V0.0.11 standard
- ✅ Create database triggers for validation
- ✅ Create indexes for performance
- **ADDITION**: Create YAML schema FIRST (schema-driven development)

**Phase 2: Pricing Calculation Service (1-1.5 weeks)**
- ✅ Create `pricing.service.ts` with core business logic
- ✅ Implement `calculatePrice()` method
- ✅ Implement quantity break algorithm
- ✅ Implement pricing rule evaluation (priority-based)
- ✅ Implement currency conversion
- ✅ Write unit tests (>80% coverage)
- **ADDITION**: Clarify rule stacking strategy with Sarah FIRST

**Phase 3: GraphQL API Enhancement (3-4 days)**
- ✅ Add new queries: `calculatePrice`, `priceHistory`
- ✅ Add new mutations: `approvePricing`, `bulkUpdateCustomerPricing`
- ✅ Modify existing resolvers to use new service
- ✅ Add GraphQL types: `PriceCalculationResult`, `AppliedPricingRule`
- ✅ Write integration tests

**Phase 4: Approval Workflow Integration (3-4 days → 1 WEEK if workflow engine doesn't exist)**
- ⚠️ **RISK**: Research line 79 states "Workflow engine integration (NOT YET IMPLEMENTED)"
- ⚠️ If workflow engine doesn't exist, this phase is MUCH bigger
- **Option A**: Implement simple approval workflow (status flags, email notifications) - 3-4 days
- **Option B**: Implement full workflow engine (reusable for POs, timecards, etc.) - 2-3 weeks
- **RECOMMENDATION**: Sarah decides scope - simple workflow for pricing only, or full workflow engine?

**Phase 5: Historical Queries & SCD Type 2 (2-3 days)**
- ✅ Implement `priceHistory` query
- ✅ Implement as-of-date lookups
- ✅ Implement price change audit trail
- ✅ Test historical data integrity
- ✅ Performance testing with large datasets

**Phase 6: QA Testing (1 week)**
- ✅ Unit tests (pricing.service.test.ts)
- ✅ Integration tests (pricing API)
- ✅ Security testing (tenant isolation, SQL injection)
- ✅ Performance testing (price calculation < 100ms)
- ✅ Edge case testing (11 edge cases identified)

### Libraries/Tools Recommended (Cynthia's List)

**1. Decimal.js** - ✅ APPROVED
- Purpose: Precise currency calculations (avoid floating-point errors)
- NPM: `npm install decimal.js`
- Usage: `new Decimal(price).times(quantity).toDecimalPlaces(2)`

**2. date-fns** - ✅ APPROVED
- Purpose: Date range queries for effective_from/to
- NPM: `npm install date-fns`
- Usage: `isWithinInterval(orderDate, {start: effectiveFrom, end: effectiveTo})`

**3. joi or zod** - ✅ APPROVED (Recommend zod for TypeScript)
- Purpose: Input validation beyond GraphQL type checking
- NPM: `npm install zod`
- Usage: Schema validation for JSONB conditions, price ranges

**4. Redis** - ✅ APPROVED (if not already in use)
- Purpose: Cache pricing rules (read-heavy, changes infrequently)
- Already in use? Check docker-compose.yml
- Usage: Cache by tenant_id, TTL 5-10 minutes

**5. Winston** - ✅ APPROVED (or existing logger)
- Purpose: Audit logging for price changes
- NPM: `npm install winston`
- Usage: Structured logging to file/DB for compliance

---

## Questions for Sarah (Product Owner)

### CRITICAL Decisions Needed Before Implementation

**1. Pricing Rule Stacking Strategy** (BLOCKING)
- **Question:** Multiple rules apply (volume + promotional) - do they stack or best-only?
- **Impact:** Core pricing algorithm design
- **Options:**
  - A) Cumulative (apply all, sum discounts)
  - B) Best-only (apply single best by priority)
  - C) Configurable per rule
- **Recommendation:** Use AskUserQuestion tool to get Sarah's decision

**2. Approval Authority Matrix** (BLOCKING)
- **Question:** Discount approval thresholds for each role?
- **Impact:** Approval workflow routing logic
- **Required:**
  - Sales rep: X%
  - Sales manager: Y%
  - VP Sales: Z%
  - CFO: Unlimited?
- **Recommendation:** Sarah provides matrix, implement as tenant-configurable setting

**3. Approval Workflow Scope** (BLOCKING)
- **Question:** Simple pricing-only workflow or full reusable workflow engine?
- **Impact:** 3-4 days vs. 2-3 weeks effort
- **Options:**
  - A) Simple: Status flags + email notifications (pricing-only)
  - B) Full: Reusable workflow engine (pricing, POs, timecards, etc.)
- **Recommendation:** If other workflows needed soon (REQ-SALES-ORDER-ENTRY-001 mentions approval), build full engine

### NON-BLOCKING Questions (Can Defer or Use Defaults)

**4. Contract Pricing Volume Commitments**
- **Question:** Enforce volume commitments or reporting only?
- **Default:** Reporting only (simpler)

**5. Price Change Notifications**
- **Question:** Auto-email customers when pricing changes?
- **Default:** Manual notification (later enhancement)

**6. Historical Price Retention Period**
- **Question:** 7 years (tax), 10 years (SOX), forever?
- **Default:** 7 years minimum, check with Legal/Compliance

**7. Multi-Currency Pricing**
- **Question:** Same customer different prices in different currencies?
- **Default:** Single currency per customer (most common)

---

## Decision

### ✅ APPROVED WITH CONDITIONS

**Ready for Implementation IF:**

1. ✅ Fix Critical Issue #1: Create YAML schema for pricing module (2-3 hours)
2. ✅ Fix Critical Issue #2: Add SCD Type 2 columns to customer_pricing table (1 hour)
3. ✅ Address High Priority #3: Sarah clarifies pricing rule stacking strategy (1 hour meeting)
4. ✅ Address High Priority #4: Sarah provides approval authority matrix (30 min meeting)

**Total Fix Time:** 4-6 hours of schema work + 1.5 hours of business rule clarification

**APPROVAL CONDITIONS:**
- Sarah MUST create YAML schema BEFORE Roy writes any migration code (schema-driven development)
- Sarah MUST clarify rule stacking strategy BEFORE Roy implements pricing service
- Sarah MUST decide approval workflow scope (simple vs. full engine) BEFORE Phase 4
- Billy MUST validate pricing calculations with 11 edge cases in QA phase

**APPROVAL SCOPE:**
- ✅ Pricing calculation engine architecture (service layer pattern)
- ✅ Database schema enhancements (SCD Type 2, approval workflow)
- ✅ GraphQL API contract (calculatePrice, priceHistory queries)
- ✅ Security patterns (JWT, tenant isolation, parameterized queries)
- ✅ Performance targets (< 100ms price calculation)
- ✅ Edge case handling (11 scenarios documented)
- ✅ Libraries/tools (Decimal.js, date-fns, zod, Redis, Winston)

**OUT OF SCOPE (Deferred):**
- Dynamic cost-plus pricing (future enhancement)
- AI-powered price optimization (future phase)
- Multi-tier distributor pricing (not requested)
- Regional pricing by geography (not requested)

**REVISED EFFORT ESTIMATE:**
- **Optimistic (if simple approval workflow):** 3-4 weeks (Cynthia's estimate)
- **Realistic (if full workflow engine needed):** 5-6 weeks
- **Pessimistic (if service layer is new pattern + full workflow):** 6-8 weeks

**Recommendation:** Use realistic estimate (5-6 weeks) for planning.

---

## Next Steps

### Immediate Actions (Sarah - Product Owner)

**1. Create YAML Schema for Pricing Module (2-3 hours)**
- Create `backend/data-models/schemas/pricing/customer-pricing.yaml`
- Create `backend/data-models/schemas/pricing/pricing-rules.yaml`
- Create `backend/data-models/schemas/pricing/pricing-service.yaml`
- Include SCD Type 2 columns (is_current_version)
- Include approval workflow columns (approval_status, approved_by_user_id, approved_at, rejection_reason)
- Commit with message: `feat(pricing): Add YAML schema for customer pricing engine`

**2. Clarify Business Rules (1.5 hours of meetings)**
- Use AskUserQuestion tool to clarify:
  - Pricing rule stacking strategy (cumulative vs. best-only)
  - Approval authority matrix (sales rep, manager, VP, CFO thresholds)
  - Approval workflow scope (simple vs. full engine)
- Document decisions in YAML schema comments

**3. Write Database Migration (1 hour)**
- V0.0.14: Add SCD Type 2 support to customer_pricing
- V0.0.15: Rename audit columns to V0.0.11 standard
- Test migration in development environment

### Post-Fix Actions (Proceed to Implementation)

**Phase 1: Database Schema (Sarah - 1-2 days)**
- Create YAML schema (DONE in immediate actions)
- Write migration V0.0.14 (SCD Type 2 columns)
- Write migration V0.0.15 (audit column rename)
- Test with sample data

**Phase 2: Pricing Service (Roy - 1.5 weeks)**
- Week 1: Implement pricing.service.ts (calculatePrice, quantity breaks, rule evaluation)
- Week 2: Unit tests (>80% coverage), edge case handling
- Coordinate with Sarah on business rule clarifications

**Phase 3: GraphQL API (Roy - 3-4 days)**
- Add calculatePrice, priceHistory queries
- Add approvePricing, bulkUpdateCustomerPricing mutations
- Integration tests

**Phase 4: Approval Workflow (Roy - 1 week)**
- Implement approval service (or full workflow engine if Sarah decides)
- Email notifications
- Approval UI (coordinate with Jen if frontend needed)

**Phase 5: Historical Queries (Roy - 2-3 days)**
- Implement priceHistory query
- As-of-date lookups
- Performance testing

**Phase 6: QA (Billy - 1 week)**
- Unit tests review
- Integration tests
- Security testing (tenant isolation, SQL injection)
- Performance testing (< 100ms price calculation)
- Edge case testing (11 scenarios)

**Phase 7: Statistics (Priya - 0.5 weeks - OPTIONAL)**
- Pricing dashboard metrics
- Discount analysis
- Margin tracking

---

## Strengths of Cynthia's Research

**Exceptional Work:**
- ✅ **Comprehensive:** 1,190 lines covering requirements, constraints, edge cases, security, industry practices
- ✅ **Accurate:** Correctly identified the core gap (pricing engine missing, schema exists)
- ✅ **Evidence-Based:** Read 6 files, performed 5 grep searches, analyzed GraphQL resolvers
- ✅ **Actionable:** 10 files to create/modify, 6-phase implementation roadmap
- ✅ **Industry-Aligned:** Pricing algorithm follows industry best practices
- ✅ **Security-Focused:** 6 OWASP vulnerabilities identified with mitigations
- ✅ **Risk-Aware:** 4 risks identified with mitigation strategies

**Cynthia followed AGOG standards:**
- ✅ Multi-tenant pattern validated (tenant_id on all tables)
- ✅ uuid_generate_v7() usage verified
- ⚠️ Schema-driven development mentioned but YAML not created (critical gap)
- ✅ Security analysis comprehensive (tenant isolation, SQL injection, audit trail)

**Research Quality:** EXCELLENT - One of the best research reports I've reviewed. Only 2 critical gaps (YAML schema, SCD Type 2 columns) need fixing.

---

## Conclusion

**APPROVED WITH CONDITIONS** - Fix 2 critical schema gaps (4-6 hours), clarify 2 business rules (1.5 hours), then proceed to implementation.

**Confidence Level:** HIGH - Design is sound, approach is practical, risks are identified. The 2 critical issues are schema documentation gaps, not fundamental architectural flaws.

**Expected Outcome:** If critical issues fixed, business rules clarified, and realistic 5-6 week timeline used, Customer-Specific Pricing Engine implementation should succeed with minimal risk.

**Gate Decision:** ✅ **CONDITIONALLY OPEN** - Sarah may proceed to Phase 1 (YAML schema creation) immediately. Roy may proceed to Phase 2 (pricing service) AFTER Sarah completes YAML schema and business rule clarifications.

---

## Comparison to Item Master Critique

**Similarities:**
- Both require YAML schema creation (schema-driven development gap)
- Both have comprehensive research (1,000+ lines, excellent quality)
- Both identify correct architectural patterns (service layer, SCD Type 2)
- Both have realistic complexity estimates (3-8 weeks)

**Differences:**
- **Item Master:** COMPLEX (data migration, 11 tables, 400 hours)
- **Pricing Engine:** MEDIUM (service layer only, 2 tables exist, 200-240 hours)
- **Item Master:** 3 critical issues (tenant_id on attributes, audit columns, incremental delivery)
- **Pricing Engine:** 2 critical issues (YAML schema, SCD Type 2 columns)
- **Item Master:** Requires Marcus approval for downtime window
- **Pricing Engine:** Requires Sarah decisions on business rules

**Assessment:** Pricing Engine is LOWER RISK than Item Master (no data migration, smaller scope, fewer dependencies).

---

**📍 Navigation Path:** [AGOG Home](../../README.md) → [Agent Deliverables](../deliverables/) → Sylvia Critique - Customer Pricing Engine

[⬆ Back to top](#sylvia-critique-report-customer-specific-pricing-engine) | [🏠 AGOG Home](../../../../README.md) | [📋 Research Report](./cynthia-research-REQ-CUSTOMER-PRICING-001.md)
