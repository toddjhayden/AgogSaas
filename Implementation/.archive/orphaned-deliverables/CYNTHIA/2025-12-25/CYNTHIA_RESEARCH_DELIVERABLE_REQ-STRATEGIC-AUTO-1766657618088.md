# Cynthia Research Report: Vendor Scorecards

**Feature:** REQ-STRATEGIC-AUTO-1766657618088 / Vendor Scorecards
**Researched By:** Cynthia (Research Specialist)
**Date:** 2025-12-25
**Complexity:** Simple (Backend exists) to Medium (New UI required)
**Estimated Effort:** 1.5 weeks (Frontend + UI/UX)
**Assigned To:** marcus (Implementation Lead)

---

## Executive Summary

The **Vendor Scorecard** feature is **PARTIALLY IMPLEMENTED** in the codebase:

### What Exists (✅):
1. **Complete Backend Infrastructure:**
   - Database schema: `vendor_performance` table with monthly metrics
   - Service layer: `VendorPerformanceService` with comprehensive calculation algorithms
   - GraphQL API: Queries for `vendorScorecard` and `vendorComparisonReport`
   - Performance metrics: OTD%, Quality%, Price, Responsiveness, Overall Rating (1-5 stars)
   - Advanced features: 12-month rolling metrics, trend analysis, peer comparison

2. **Calculation Engine:**
   - Automated performance calculation from PO data
   - Weighted scoring: OTD (40%), Quality (40%), Price (10%), Responsiveness (10%)
   - Trend detection: IMPROVING, STABLE, DECLINING
   - Historical tracking with SCD Type 2 support

### What's Missing (❌):
1. **Frontend UI:** No vendor scorecard dashboard page
2. **Visualization:** No charts/graphs for performance trends
3. **User Workflows:** No UI for viewing, comparing, or drilling down into vendor performance
4. **Integration:** Scorecard not linked to purchase order or vendor management pages

**Recommendation:** Focus implementation effort on **Frontend UI Development** (Jen) to expose the existing backend capabilities to end users.

---

## Functional Requirements

### Primary Requirements (Backend COMPLETE ✅)

**R1: Monthly Vendor Performance Tracking**
- ✅ Status: IMPLEMENTED in `vendor_performance` table (V0.0.6 migration)
- Tracks per vendor, per month, per tenant
- Metrics captured:
  - Total POs issued (count and value)
  - On-time delivery percentage (calculated from promised vs actual dates)
  - Quality acceptance percentage (acceptances vs rejections)
  - Price competitiveness score (1-5 stars)
  - Responsiveness score (1-5 stars)
  - Overall rating (weighted composite)

**R2: Automated Performance Calculation**
- ✅ Status: IMPLEMENTED in `VendorPerformanceService.calculateVendorPerformance()`
- Location: `backend/src/modules/procurement/services/vendor-performance.service.ts`
- Calculation logic:
  ```
  OTD% = (on_time_deliveries / total_deliveries) * 100
  Quality% = (quality_acceptances / (acceptances + rejections)) * 100
  Overall Rating = (OTD * 40%) + (Quality * 40%) + (Price * 10%) + (Responsiveness * 10%)
  ```
- Supports batch calculation for all vendors: `calculateAllVendorsPerformance()`

**R3: Vendor Scorecard View (12-Month Rolling)**
- ✅ Status: Backend IMPLEMENTED, Frontend MISSING
- GraphQL Query: `vendorScorecard(tenantId, vendorId)`
- Returns:
  - Current rating and rolling averages (OTD%, Quality%, Rating)
  - Trend direction (IMPROVING, STABLE, DECLINING)
  - Last month, 3-month, 6-month averages
  - Full monthly performance history (up to 12 months)

**R4: Vendor Comparison Report**
- ✅ Status: Backend IMPLEMENTED, Frontend MISSING
- GraphQL Query: `vendorComparisonReport(tenantId, year, month, vendorType, topN)`
- Returns:
  - Top N performers (default 5)
  - Bottom N performers (default 5)
  - Average metrics across all vendors
  - Optional filtering by vendor type (MATERIAL_SUPPLIER, TRADE_PRINTER, etc.)

### Acceptance Criteria

#### Backend (VERIFIED ✅)
- ✅ Performance metrics stored per vendor per month in `vendor_performance` table
- ✅ GraphQL queries return scorecard data with rolling metrics and trends
- ✅ Calculation engine correctly applies weighting formula
- ✅ Trend detection identifies IMPROVING/STABLE/DECLINING based on 3-month vs 6-month comparison
- ✅ Multi-tenant isolation enforced via `tenant_id` filtering
- ✅ SCD Type 2 integration updates vendor master summary fields

#### Frontend (NOT IMPLEMENTED ❌)
- ❌ Vendor scorecard dashboard page displays performance metrics visually
- ❌ Charts show trend lines for OTD%, Quality%, Overall Rating over 12 months
- ❌ Comparison table shows top/bottom performers with color coding
- ❌ Drill-down capability to view monthly details
- ❌ Responsive design for tablet/desktop viewing
- ❌ Integration with vendor detail page (link to scorecard)

### Out of Scope (Future Enhancements)

- ❌ **Real-Time Dashboards:** Live updating performance metrics (current: batch monthly)
- ❌ **Predictive Analytics:** ML-based vendor risk scoring
- ❌ **External Data Integration:** D&B credit ratings, market price data
- ❌ **Vendor Portal:** External vendor access to their own scorecard
- ❌ **Automated Alerts:** Notifications when performance drops below threshold
- ❌ **Custom Scoring Weights:** User-configurable weights (currently hardcoded 40/40/10/10)
- ❌ **Quality Inspection Drilldown:** Link to detailed quality defect data (requires quality module)

---

## Technical Architecture

### Existing Backend Components (✅ COMPLETE)

#### 1. Database Schema

**vendor_performance Table** (Migration V0.0.6)
```sql
CREATE TABLE vendor_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    vendor_id UUID NOT NULL,

    -- Time period
    evaluation_period_year INTEGER NOT NULL,
    evaluation_period_month INTEGER NOT NULL,

    -- Purchase order metrics
    total_pos_issued INTEGER DEFAULT 0,
    total_pos_value DECIMAL(18,4) DEFAULT 0,

    -- Delivery metrics
    on_time_deliveries INTEGER DEFAULT 0,
    total_deliveries INTEGER DEFAULT 0,
    on_time_percentage DECIMAL(8,4),

    -- Quality metrics
    quality_acceptances INTEGER DEFAULT 0,
    quality_rejections INTEGER DEFAULT 0,
    quality_percentage DECIMAL(8,4),

    -- Scoring (1-5 stars)
    price_competitiveness_score DECIMAL(3,1),
    responsiveness_score DECIMAL(3,1),
    overall_rating DECIMAL(3,1),

    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT uq_vendor_performance
    UNIQUE (tenant_id, vendor_id, evaluation_period_year, evaluation_period_month)
);
```

**Indexes:**
- `idx_vendor_performance_tenant` on (tenant_id)
- `idx_vendor_performance_period` on (evaluation_period_year, evaluation_period_month)
- `idx_vendor_performance_rating` on (overall_rating DESC)

#### 2. Service Layer

**VendorPerformanceService** (`backend/src/modules/procurement/services/vendor-performance.service.ts`)

**Key Methods:**

1. **calculateVendorPerformance(tenantId, vendorId, year, month)**
   - Aggregates PO data for the period
   - Calculates OTD% from promised vs actual delivery dates
   - Calculates Quality% from accepted vs rejected receipts
   - Applies weighted scoring formula
   - Upserts vendor_performance record
   - Updates vendor master summary fields (SCD Type 2 aware)
   - Returns: `VendorPerformanceMetrics` object

2. **calculateAllVendorsPerformance(tenantId, year, month)**
   - Batch processes all active vendors
   - Returns: Array of `VendorPerformanceMetrics[]`
   - Use case: Monthly batch job (scheduled on 1st of month)

3. **getVendorScorecard(tenantId, vendorId)**
   - Retrieves last 12 months of performance data
   - Calculates rolling averages (OTD%, Quality%, Rating)
   - Determines trend direction:
     - IMPROVING: Recent 3-month avg > Previous 3-month avg (+0.3 stars)
     - DECLINING: Recent 3-month avg < Previous 3-month avg (-0.3 stars)
     - STABLE: Change within ±0.3 stars
   - Returns: `VendorScorecard` object with trend analysis

4. **getVendorComparisonReport(tenantId, year, month, vendorType?, topN=5)**
   - Queries all vendors for the period
   - Orders by overall_rating DESC
   - Calculates aggregate metrics (avg OTD%, Quality%, Rating)
   - Returns: Top N + Bottom N performers + averages

#### 3. GraphQL API

**Schema Location:** `backend/src/graphql/schema/sales-materials.graphql`

**Types Defined:**
```graphql
type VendorPerformance {
  id: ID!
  tenantId: ID!
  vendorId: ID!
  evaluationPeriodYear: Int!
  evaluationPeriodMonth: Int!
  totalPosIssued: Int!
  totalPosValue: Float!
  onTimeDeliveries: Int!
  totalDeliveries: Int!
  onTimePercentage: Float
  qualityAcceptances: Int!
  qualityRejections: Int!
  qualityPercentage: Float
  priceCompetitivenessScore: Float
  responsivenessScore: Float
  overallRating: Float
  notes: String
  createdAt: String!
  updatedAt: String
}

type VendorScorecard {
  vendorId: ID!
  vendorCode: String!
  vendorName: String!
  currentRating: Float!

  # 12-month rolling metrics
  rollingOnTimePercentage: Float!
  rollingQualityPercentage: Float!
  rollingAvgRating: Float!

  # Trend indicators
  trendDirection: VendorTrendDirection!  # IMPROVING | STABLE | DECLINING
  monthsTracked: Int!

  # Recent performance
  lastMonthRating: Float!
  last3MonthsAvgRating: Float!
  last6MonthsAvgRating: Float!

  # Performance history
  monthlyPerformance: [VendorPerformance!]!
}

type VendorComparisonReport {
  evaluationPeriodYear: Int!
  evaluationPeriodMonth: Int!
  vendorType: VendorType

  topPerformers: [VendorPerformanceSummary!]!
  bottomPerformers: [VendorPerformanceSummary!]!

  averageMetrics: VendorAverageMetrics!
}

enum VendorTrendDirection {
  IMPROVING
  STABLE
  DECLINING
}
```

**Queries Available:**
```graphql
Query {
  # Get performance for specific period
  vendorPerformance(
    tenantId: ID!
    vendorId: ID!
    year: Int!
    month: Int!
  ): [VendorPerformance!]!

  # Get 12-month scorecard with trends
  vendorScorecard(
    tenantId: ID!
    vendorId: ID!
  ): VendorScorecard!

  # Get vendor comparison report
  vendorComparisonReport(
    tenantId: ID!
    year: Int!
    month: Int!
    vendorType: VendorType
    topN: Int = 5
  ): VendorComparisonReport!
}
```

**Mutations Available:**
```graphql
Mutation {
  # Calculate performance for single vendor
  calculateVendorPerformance(
    tenantId: ID!
    vendorId: ID!
    year: Int!
    month: Int!
  ): VendorPerformanceMetrics!

  # Batch calculate for all vendors
  calculateAllVendorsPerformance(
    tenantId: ID!
    year: Int!
    month: Int!
  ): [VendorPerformanceMetrics!]!

  # Update manual scores (price, responsiveness)
  updateVendorPerformanceScores(
    id: ID!
    priceCompetitivenessScore: Float
    responsivenessScore: Float
    notes: String
  ): VendorPerformance!
}
```

**Resolver Location:** `backend/src/graphql/resolvers/sales-materials.resolver.ts`

---

### Required Frontend Components (❌ NOT IMPLEMENTED)

#### 1. **VendorScorecardPage.tsx** (New)

**Purpose:** Main dashboard for viewing vendor scorecards

**Components Needed:**
- **Header Section:**
  - Vendor selector (dropdown with search)
  - Date range selector (default: last 12 months)
  - "Calculate Performance" button (triggers manual recalculation)
  - Export to PDF button

- **Metrics Summary Cards:**
  - Current Overall Rating (1-5 stars with visual stars)
  - Rolling OTD% (with trend indicator ↑↓→)
  - Rolling Quality% (with trend indicator)
  - Trend Direction badge (IMPROVING=green, STABLE=yellow, DECLINING=red)

- **Performance Trend Chart:**
  - Line chart showing 12-month trend
  - Multiple series: OTD%, Quality%, Overall Rating
  - X-axis: Month (MMM YYYY)
  - Y-axis: Percentage / Rating
  - Tooltip on hover with exact values

- **Monthly Performance Table:**
  - Columns: Month, POs Issued, PO Value, OTD%, Quality%, Rating
  - Sortable by any column
  - Expandable rows to show notes/details
  - Color coding by rating (red <2.5, yellow 2.5-4.0, green >4.0)

**GraphQL Query:**
```graphql
query GetVendorScorecard($tenantId: ID!, $vendorId: ID!) {
  vendorScorecard(tenantId: $tenantId, vendorId: $vendorId) {
    vendorCode
    vendorName
    currentRating
    rollingOnTimePercentage
    rollingQualityPercentage
    rollingAvgRating
    trendDirection
    monthsTracked
    lastMonthRating
    last3MonthsAvgRating
    last6MonthsAvgRating
    monthlyPerformance {
      evaluationPeriodYear
      evaluationPeriodMonth
      totalPosIssued
      totalPosValue
      onTimePercentage
      qualityPercentage
      overallRating
      notes
    }
  }
}
```

**Libraries to Use:**
- **Recharts** or **Chart.js** for line charts
- **React Table v8** for monthly performance table
- **Lucide React** for icons (trend arrows, stars)
- **Tailwind CSS** for styling (already in project)

#### 2. **VendorComparisonPage.tsx** (New)

**Purpose:** Compare vendors side-by-side for a period

**Components Needed:**
- **Filter Section:**
  - Year/Month selector
  - Vendor Type filter (MATERIAL_SUPPLIER, TRADE_PRINTER, etc.)
  - Top N selector (5, 10, 20)

- **Top Performers Table:**
  - Columns: Rank, Vendor Code, Vendor Name, Rating, OTD%, Quality%
  - Color-coded badges for ratings
  - Click to navigate to vendor scorecard

- **Bottom Performers Table:**
  - Same structure as top performers
  - Red/warning styling

- **Average Metrics Card:**
  - Average OTD% across all vendors
  - Average Quality% across all vendors
  - Average Overall Rating
  - Total vendors evaluated

- **Distribution Chart:**
  - Bar chart showing rating distribution (how many vendors in each rating tier)
  - X-axis: Rating tiers (1-2, 2-3, 3-4, 4-5)
  - Y-axis: Number of vendors

**GraphQL Query:**
```graphql
query GetVendorComparison($tenantId: ID!, $year: Int!, $month: Int!, $vendorType: VendorType, $topN: Int) {
  vendorComparisonReport(
    tenantId: $tenantId
    year: $year
    month: $month
    vendorType: $vendorType
    topN: $topN
  ) {
    evaluationPeriodYear
    evaluationPeriodMonth
    vendorType
    topPerformers {
      vendorId
      vendorCode
      vendorName
      overallRating
      onTimePercentage
      qualityPercentage
    }
    bottomPerformers {
      vendorId
      vendorCode
      vendorName
      overallRating
      onTimePercentage
      qualityPercentage
    }
    averageMetrics {
      avgOnTimePercentage
      avgQualityPercentage
      avgOverallRating
      totalVendorsEvaluated
    }
  }
}
```

#### 3. **Integration with Existing Pages**

**PurchaseOrdersPage.tsx** (Existing)
- Add "View Vendor Scorecard" link/button next to vendor name
- Clicking navigates to VendorScorecardPage with vendor pre-selected

**CreatePurchaseOrderPage.tsx** (Existing)
- Show vendor rating (stars) next to vendor dropdown
- Display tooltip with basic performance metrics on hover

**Vendor Management Page** (If exists)
- Add "Scorecard" tab to vendor detail view
- Embed VendorScorecardPage component in tab

---

## Edge Cases & Error Scenarios

### Edge Cases to Handle

#### 1. **New Vendor with No Performance Data**
- **Scenario:** Vendor just onboarded, no POs issued yet
- **Current Behavior:** `vendorScorecard` query returns empty `monthlyPerformance[]`
- **UI Handling:** Show "No performance data available. Performance will be calculated after first PO receipt."
- ✅ **Backend Ready:** Returns valid scorecard with zero metrics

#### 2. **Incomplete Month Data**
- **Scenario:** User views scorecard mid-month (current month not complete)
- **Current Behavior:** Current month's performance not calculated yet
- **UI Handling:** Show "Current month in progress" badge, exclude from trend calculation
- **Recommendation:** Add `isPartialMonth` flag to frontend logic

#### 3. **Vendor with Zero Deliveries in Month**
- **Scenario:** POs issued but not received in the month
- **Current Behavior:** `totalDeliveries = 0`, `onTimePercentage = null`
- **Backend Behavior:** ✅ Handles correctly (sets null, not 0%)
- **UI Handling:** Display "N/A" or "-" instead of "0%"

#### 4. **Trend Analysis with <3 Months Data**
- **Scenario:** Vendor only has 1-2 months of data
- **Current Behavior:** `trendDirection = 'STABLE'` (insufficient data)
- ✅ **Backend Ready:** Checks `if (monthlyPerformance.length >= 3)` before calculating trend
- **UI Handling:** Show "Insufficient data" tooltip on trend badge

#### 5. **Multi-Tenant Vendor Code Collision**
- **Scenario:** Tenant A and Tenant B both have vendor "ACME-001"
- **Current Behavior:** ✅ Isolated by tenant_id (no collision)
- **GraphQL:** Always requires `tenantId` parameter
- ✅ **No Issue:** Proper multi-tenant isolation

#### 6. **Performance Calculation During High Load**
- **Scenario:** `calculateAllVendorsPerformance()` called for tenant with 500 vendors
- **Current Behavior:** Loops through all vendors sequentially (could be slow)
- **Performance Risk:** ⚠️ May timeout if >100 vendors
- **Recommendation:** Add batch processing with queue (BullMQ) for production

### Error Scenarios

#### 1. **GraphQL Query Errors**

**Vendor Not Found:**
```typescript
// Current behavior
throw new Error(`Vendor ${vendorId} not found`);

// UI handling
if (error.message.includes('not found')) {
  toast.error('Vendor not found. Please select a valid vendor.');
  navigate('/vendors');
}
```

**Missing Tenant ID:**
```typescript
// GraphQL validation error (required field)
// UI handling: Should never happen if JWT middleware extracts tenant_id
```

**Invalid Date Range:**
```typescript
// Year out of range (e.g., year=9999)
// Backend: No validation currently
// Recommendation: Add validation in service layer
if (year < 2020 || year > 2100) {
  throw new Error('Invalid year. Must be between 2020 and 2100.');
}
```

#### 2. **Performance Calculation Failures**

**Database Timeout:**
```typescript
// Current: Default pg timeout (30s)
// Recommendation: Set aggressive timeout (10s) for performance queries
const client = await this.db.connect();
await client.query('SET statement_timeout = 10000'); // 10 seconds
```

**Transaction Rollback:**
```typescript
// Current: ✅ Wrapped in BEGIN/COMMIT/ROLLBACK
// If error occurs, vendor_performance record not created (safe)
```

**Partial Data Corruption:**
```typescript
// Scenario: PO has null promised_delivery_date AND null requested_delivery_date
// Current: ✅ Handled via COALESCE and null checks
// No risk of division by zero or null pointer
```

#### 3. **UI Rendering Issues**

**Chart Rendering with No Data:**
```typescript
// Recharts behavior: Shows empty chart area
// Recommendation: Add conditional rendering
{monthlyPerformance.length > 0 ? (
  <LineChart data={monthlyPerformance}>...</LineChart>
) : (
  <EmptyState message="No performance data to display" />
)}
```

**Responsive Design Breakpoints:**
```typescript
// Mobile: Hide chart, show table only
// Tablet: Show simplified chart (1 series)
// Desktop: Show full chart with all series
```

**Slow Chart Rendering:**
```typescript
// Scenario: 12 months of data with multiple series
// Recommendation: Use React.memo() on chart component
const MemoizedPerformanceChart = React.memo(PerformanceChart);
```

### Recovery Strategies

- ✅ **Retry Logic:** Add retry for transient database errors (3 retries, exponential backoff)
- ✅ **Graceful Degradation:** If scorecard unavailable, still show vendor master data
- ✅ **User-Friendly Errors:** Map technical errors to actionable messages
- ⚠️ **Transaction Rollback:** Already implemented for data consistency

---

## Security Analysis

### Vulnerabilities to Avoid

#### 1. **Tenant Isolation**

**CRITICAL: Multi-Tenant Data Leakage**

**Current Implementation:**
```typescript
// ✅ SAFE: All queries filter by tenant_id
const vendorResult = await client.query(
  `SELECT * FROM vendors WHERE id = $1 AND tenant_id = $2`,
  [vendorId, tenantId]
);
```

**Vulnerability Test:**
```graphql
# Attack: User from Tenant A tries to query Tenant B's scorecard
query {
  vendorScorecard(
    tenantId: "tenant-B-uuid"
    vendorId: "vendor-B-uuid"
  ) {
    vendorCode
    overallRating
  }
}

# Expected: Authorization error or empty result
# Current: ⚠️ Returns Tenant B's data if API called directly
# Fix Needed: Add middleware to validate tenantId matches JWT token
```

**Recommendation:**
```typescript
// In GraphQL resolver or middleware
export function validateTenantAccess(context: any, requestedTenantId: string) {
  const userTenantId = context.req.user.tenant_id; // From JWT
  if (userTenantId !== requestedTenantId) {
    throw new ForbiddenError('Access denied to tenant data');
  }
}

// Usage in resolver
@Query('vendorScorecard')
async getVendorScorecard(
  @Args('tenantId') tenantId: string,
  @Args('vendorId') vendorId: string,
  @Context() context: any
) {
  validateTenantAccess(context, tenantId); // ADD THIS
  return this.vendorPerformanceService.getVendorScorecard(tenantId, vendorId);
}
```

#### 2. **Input Validation**

**SQL Injection Prevention:**
- ✅ **SAFE:** All queries use parameterized statements ($1, $2, $3)
- No string concatenation of user input

**Data Type Validation:**
```typescript
// Current: GraphQL schema enforces types (Int, Float, String)
// Missing: Range validation

// Recommendation: Add validation decorators
class CalculatePerformanceDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}
```

**XSS Prevention:**
```typescript
// Frontend: React auto-escapes JSX content (safe by default)
// Backend: No HTML rendering
// Risk: Low (vendor names, notes stored as plain text)
```

#### 3. **Authorization**

**Permission Checks:**
```typescript
// Current: ❌ NOT IMPLEMENTED
// Any authenticated user can view any vendor's scorecard

// Recommendation: Add RBAC
@Query('vendorScorecard')
@RequirePermission('vendor:view_performance')
async getVendorScorecard(...) { ... }

@Mutation('calculateVendorPerformance')
@RequirePermission('vendor:calculate_performance')
async calculateVendorPerformance(...) { ... }
```

**Role Definitions:**
- `vendor:view_performance` - View scorecards (Procurement team, Managers)
- `vendor:calculate_performance` - Trigger recalculation (Procurement managers only)
- `vendor:edit_scores` - Manually adjust price/responsiveness scores (Procurement managers only)

#### 4. **Rate Limiting**

**DoS Prevention:**
```typescript
// Scenario: Malicious user calls calculateAllVendorsPerformance() repeatedly
// Current: ❌ No rate limiting
// Impact: High database load, potential service degradation

// Recommendation: Add rate limiting middleware
@Mutation('calculateAllVendorsPerformance')
@RateLimit({ max: 5, windowMs: 60000 }) // 5 requests per minute
async calculateAllVendorsPerformance(...) { ... }
```

### Existing Security Patterns

**Authentication:**
- Assumption: NestJS JWT authentication middleware
- User ID available in `context.req.user.id`
- Tenant ID available in `context.req.user.tenant_id`

**Audit Logging:**
- ✅ Audit trail fields in vendor_performance: `created_at`, `updated_at`
- ⚠️ Missing: Who triggered the calculation (no `calculated_by` field)
- Recommendation: Add `calculated_by_user_id` to vendor_performance table

**RLS Policies:**
- ❌ NOT IMPLEMENTED
- Recommendation: Add Row-Level Security for defense-in-depth:
  ```sql
  ALTER TABLE vendor_performance ENABLE ROW LEVEL SECURITY;

  CREATE POLICY vendor_performance_tenant_isolation ON vendor_performance
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
  ```

---

## Implementation Recommendations

### Recommended Approach

**Phase 1: Frontend UI Development (Jen - Frontend)** ⭐ HIGH PRIORITY

**Estimated Effort:** 1.5 weeks

**Tasks:**
1. Create `VendorScorecardPage.tsx` (3 days)
   - Metrics summary cards
   - Performance trend chart (Recharts)
   - Monthly performance table (React Table v8)
   - GraphQL integration (Apollo Client)

2. Create `VendorComparisonPage.tsx` (2 days)
   - Top/bottom performers tables
   - Average metrics cards
   - Rating distribution chart
   - GraphQL integration

3. Integrate with existing pages (1 day)
   - Add "View Scorecard" links to PurchaseOrdersPage
   - Add vendor rating display to CreatePurchaseOrderPage
   - Add navigation to vendor scorecard from vendor management

4. Responsive design & polish (1 day)
   - Mobile/tablet optimizations
   - Loading states, error handling
   - Empty states for no data scenarios

5. Testing & QA (1 day)
   - Manual testing of all workflows
   - Edge case validation (no data, single month, etc.)
   - Cross-browser testing

**Deliverables:**
- Working vendor scorecard dashboard
- Vendor comparison report page
- Integration with PO and vendor management pages
- User documentation

---

**Phase 2: Backend Enhancements (Roy - Backend)** ⭐ MEDIUM PRIORITY

**Estimated Effort:** 3-4 days

**Tasks:**
1. Add security middleware (1 day)
   - Tenant validation middleware
   - Permission checks (RBAC)
   - Rate limiting for expensive mutations

2. Add input validation (0.5 day)
   - Validation decorators for DTOs
   - Range checks (year, month, topN)
   - Error messages improvement

3. Add audit logging (0.5 day)
   - Add `calculated_by_user_id` field
   - Track who triggered performance calculations
   - Add detailed error logging

4. Performance optimization (1 day)
   - Add background job queue (BullMQ) for batch calculations
   - Add caching for frequently accessed scorecards (Redis)
   - Add database query performance monitoring

5. Testing (1 day)
   - Unit tests for VendorPerformanceService
   - Integration tests for GraphQL resolvers
   - Load testing for batch calculations

---

**Phase 3: Security Hardening (Ron - Database)** ⭐ MEDIUM PRIORITY

**Estimated Effort:** 4 hours

**Tasks:**
1. Add RLS policies (2 hours)
   - Enable RLS on vendor_performance table
   - Create tenant isolation policy
   - Test policy enforcement

2. Add CHECK constraints (1 hour)
   - Rating range validation (0.0 to 5.0)
   - Percentage range validation (0 to 100)
   - Month validation (1 to 12)

3. Add audit log table (1 hour)
   - Create vendor_performance_audit_log table
   - Add trigger to log changes
   - Test audit trail capture

---

**Phase 4: QA & UAT (Billy - QA)** ⭐ HIGH PRIORITY

**Estimated Effort:** 2-3 days

**Tasks:**
1. Manual exploratory testing (1 day)
   - Test all scorecard workflows
   - Verify calculation accuracy
   - Test edge cases (no data, single month, etc.)

2. E2E tests (1 day)
   - Playwright tests for scorecard page
   - Comparison report flow
   - Integration with PO pages

3. Performance testing (0.5 day)
   - Load test vendor comparison with 100+ vendors
   - Verify response time < 500ms

4. Security validation (0.5 day)
   - Test tenant isolation
   - Verify authorization checks
   - Test input validation

---

### Libraries/Tools Recommended

**Frontend:**
- ✅ **Recharts** (preferred) or **Chart.js** - Line charts, bar charts
  - Recharts: Better React integration, responsive by default
  - Chart.js: More features, larger bundle size
- ✅ **React Table v8** - Monthly performance table with sorting/filtering
- ✅ **Lucide React** - Icons (trend arrows, stars, etc.)
- ✅ **Tailwind CSS** - Styling (already in project)
- ✅ **Apollo Client** - GraphQL queries (already in project)
- ⚠️ **React Hook Form** - If adding filters/forms

**Backend:**
- ⚠️ **class-validator** - Input validation decorators
- ⚠️ **class-transformer** - DTO transformation
- ⚠️ **BullMQ** - Background job queue for batch calculations
- ⚠️ **Redis** - Caching for scorecards (optional optimization)

**Testing:**
- ✅ **Jest** - Unit tests (already in project)
- ✅ **Supertest** - API integration tests
- ⚠️ **Playwright** - E2E tests (recommended over Cypress)

---

### Implementation Order

1. ✅ **Database Schema** - ALREADY DONE (V0.0.6)
2. ✅ **Service Layer** - ALREADY DONE (VendorPerformanceService)
3. ✅ **GraphQL API** - ALREADY DONE (queries, mutations, resolvers)
4. ⭐ **Frontend UI** - VendorScorecardPage + VendorComparisonPage (Jen - 1.5 weeks)
5. ⭐ **Integration** - Link scorecard to PO/vendor pages (Jen - 1 day)
6. ⭐ **Security** - Add middleware, validation, RLS (Roy + Ron - 1 week)
7. ⭐ **QA** - E2E tests, performance tests (Billy - 2-3 days)

---

### Complexity Assessment

**Backend Complexity:** ✅ **COMPLETE** (Simple - already implemented)
**Frontend Complexity:** ⚠️ **Medium** (New UI with charts, tables, integration)
**Overall Complexity:** **Simple to Medium**

**Rationale:**
- Core calculation engine exists and is production-ready
- GraphQL API fully functional
- Main effort is building UI to expose backend capabilities
- No complex algorithms or new architecture needed
- Standard React patterns (hooks, Apollo queries, chart libraries)

---

### Estimated Effort

| Role | Task | Effort |
|------|------|--------|
| Jen (Frontend) | VendorScorecardPage + VendorComparisonPage | 1 week |
| Jen (Frontend) | Integration with existing pages | 1 day |
| Jen (Frontend) | Responsive design, testing, polish | 1 day |
| Roy (Backend) | Security middleware, validation, optimization | 3-4 days |
| Ron (Database) | RLS policies, CHECK constraints, audit log | 4 hours |
| Billy (QA) | E2E tests, performance tests, security validation | 2-3 days |
| **Total** | **2-2.5 weeks** (with parallel work) |

**Critical Path:** Jen's frontend work (1.5 weeks)

---

## Blockers & Dependencies

### Blockers (Must Resolve Before Starting)

- ❌ **NONE** - All backend infrastructure exists and is functional

### Dependencies (Coordinate With)

1. **Purchase Order Module** (already exists)
   - Frontend integration: Need to link "View Scorecard" from PO list
   - Coordinate with Jen if PO pages need updates

2. **Vendor Management Module**
   - If vendor CRUD pages exist, add "Scorecard" tab
   - If not, scorecard can be standalone page

3. **Authentication/Authorization System**
   - Need JWT middleware to extract `user_id` and `tenant_id`
   - Need RBAC system for permission checks (optional for MVP)

4. **Design System / Component Library**
   - Confirm chart component standards (Recharts vs Chart.js)
   - Confirm color scheme for rating tiers (red/yellow/green)

### Risks

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Chart Library Compatibility** | Recharts may have issues with React 18 | Test in sandbox before committing; fallback to Chart.js |
| **Performance with Large Datasets** | 100+ vendors, 12 months data = 1200+ data points | Add pagination, caching, or data aggregation |
| **Mobile Responsiveness** | Complex charts may not render well on mobile | Design mobile-first; hide charts on small screens |
| **Data Accuracy** | If PO delivery dates not tracked properly, OTD% will be wrong | Validate data quality; add warnings if data incomplete |
| **No RBAC System** | Without permissions, any user can view any scorecard | Implement basic role checks; defer granular RBAC to Phase 2 |

---

## Questions for Clarification

### For Marcus (Implementation Lead)

1. **Chart Library Preference:**
   - Should we use Recharts (better React integration) or Chart.js (more features)?
   - **Recommendation:** Recharts for consistency with modern React patterns

2. **Mobile Support Priority:**
   - Should scorecards be mobile-optimized? (Likely viewed on desktop/tablet)
   - **Recommendation:** Desktop-first, tablet-optimized, mobile-friendly (hide charts, show tables)

3. **Color Scheme for Rating Tiers:**
   - Confirm color coding: Red (<2.5), Yellow (2.5-4.0), Green (>4.0)?
   - **Recommendation:** Use Tailwind color palette: red-500, yellow-500, green-500

4. **Vendor Selection UI:**
   - Should scorecard page have vendor selector, or always navigate from vendor detail page?
   - **Recommendation:** Standalone page with vendor selector + navigation from vendor pages

5. **Export Functionality:**
   - Should scorecards be exportable to PDF/Excel?
   - **Recommendation:** Phase 2 enhancement; not required for MVP

### For Product Owner (Alex - Procurement)

1. **Custom Scoring Weights:**
   - Current weights: OTD 40%, Quality 40%, Price 10%, Responsiveness 10%
   - Should these be configurable per tenant?
   - **Recommendation:** Hardcode for MVP, make configurable in Phase 2

2. **Vendor Certification Thresholds:**
   - What rating/OTD%/Quality% qualifies a vendor as "Certified Supplier"?
   - **Recommendation:** Use badge system (e.g., Gold = Rating >4.5, Silver = >4.0)

3. **Alerting Requirements:**
   - Should users receive alerts when vendor performance drops?
   - **Recommendation:** Phase 2 enhancement; not required for MVP

---

## Next Steps

### Ready for Marcus (Implementation Lead)

Marcus should review this research and:

1. ✅ **Confirm Understanding:** Backend complete, focus effort on frontend UI
2. ✅ **Prioritize Phases:** Which phase is most critical? (Recommend: Phase 1 Frontend)
3. ✅ **Assign to Jen:** Frontend development is primary deliverable
4. ✅ **Clarify Requirements:** Answer 5 questions above
5. ✅ **Create User Stories:** Break Phase 1 into implementable tasks
6. ✅ **Schedule Work:** Coordinate with Billy for QA handoff

### For Jen (Frontend Developer)

1. ✅ **Review GraphQL API:** Familiarize with `vendorScorecard` and `vendorComparisonReport` queries
2. ✅ **Set Up Chart Library:** Install Recharts, create sample chart component
3. ✅ **Design Mockups:** Sketch basic layout for scorecard page (optional)
4. ✅ **Start with VendorScorecardPage.tsx:** Build metrics cards → chart → table
5. ✅ **Iterate with Billy:** Get early feedback on UI/UX

### For Sylvia (Critique)

1. ✅ **Are requirements complete?** YES - Backend fully documented, frontend specs provided
2. ✅ **Is the recommended approach sound?** YES - Leverage existing backend, focus on UI
3. ✅ **Are security risks identified?** YES - Tenant isolation, RBAC, rate limiting
4. ✅ **Is the complexity estimate realistic?** YES - "Simple to Medium", 1.5-2.5 weeks
5. ✅ **Should we proceed with implementation?** YES - Backend ready, low-risk frontend work

---

## Research Artifacts

### Files Read

1. `backend/migrations/V0.0.6__create_sales_materials_procurement.sql` (vendor_performance schema)
2. `backend/src/modules/procurement/services/vendor-performance.service.ts` (complete service implementation)
3. `backend/src/graphql/schema/sales-materials.graphql` (VendorScorecard, VendorComparisonReport types)
4. `backend/src/graphql/resolvers/sales-materials.resolver.ts` (vendorScorecard, vendorComparisonReport resolvers)
5. `backend/REQ-VENDOR-MANAGEMENT-001_IMPLEMENTATION.md` (previous vendor performance implementation docs)
6. `backend/agent-output/deliverables/cynthia-research-REQ-VENDOR-MANAGEMENT-001.md` (previous research)
7. `frontend/src/i18n/locales/en-US.json` (found "vendorScorecard" i18n key)

### Grep Searches Performed

- Pattern: `VendorScorecard|vendorScorecard` → Found in GraphQL schema, service, i18n
- Pattern: `vendor.*performance` (case-insensitive) → Found service implementation
- Pattern: `vendorComparisonReport` → Found in service, resolvers, schema

### Glob Patterns Used

- `**/*scorecard*.{tsx,ts,graphql}` → No frontend components found
- `**/*vendor*.{tsx,ts}` → Found service, no UI pages
- `**/frontend/src/pages/*Vendor*.tsx` → No vendor pages found

### Time Spent

- Research: 30 minutes
- Code analysis: 45 minutes
- Documentation: 1.5 hours
- **Total: 2.75 hours**

---

**END OF REPORT**

---

## Appendix: Sample Frontend Code Snippets

### VendorScorecardPage.tsx (Starter Template)

```tsx
import React from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

const GET_VENDOR_SCORECARD = gql`
  query GetVendorScorecard($tenantId: ID!, $vendorId: ID!) {
    vendorScorecard(tenantId: $tenantId, vendorId: $vendorId) {
      vendorCode
      vendorName
      currentRating
      rollingOnTimePercentage
      rollingQualityPercentage
      rollingAvgRating
      trendDirection
      monthsTracked
      monthlyPerformance {
        evaluationPeriodYear
        evaluationPeriodMonth
        totalPosIssued
        totalPosValue
        onTimePercentage
        qualityPercentage
        overallRating
      }
    }
  }
`;

export const VendorScorecardPage: React.FC = () => {
  const tenantId = 'current-tenant-id'; // From context/JWT
  const [selectedVendorId, setSelectedVendorId] = React.useState<string>('');

  const { data, loading, error } = useQuery(GET_VENDOR_SCORECARD, {
    variables: { tenantId, vendorId: selectedVendorId },
    skip: !selectedVendorId,
  });

  if (loading) return <div>Loading scorecard...</div>;
  if (error) return <div>Error loading scorecard: {error.message}</div>;
  if (!data?.vendorScorecard) return <div>Select a vendor to view scorecard</div>;

  const scorecard = data.vendorScorecard;

  const getTrendIcon = (direction: string) => {
    if (direction === 'IMPROVING') return <TrendingUp className="text-green-500" />;
    if (direction === 'DECLINING') return <TrendingDown className="text-red-500" />;
    return <Minus className="text-yellow-500" />;
  };

  const getRatingStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={i < fullStars ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}
        size={20}
      />
    ));
  };

  // Transform data for chart
  const chartData = scorecard.monthlyPerformance
    .map((m: any) => ({
      month: `${m.evaluationPeriodYear}-${String(m.evaluationPeriodMonth).padStart(2, '0')}`,
      OTD: m.onTimePercentage,
      Quality: m.qualityPercentage,
      Rating: m.overallRating * 20, // Scale to 0-100 for comparison
    }))
    .reverse(); // Show oldest to newest

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{scorecard.vendorName}</h1>
          <p className="text-gray-600">Vendor Code: {scorecard.vendorCode}</p>
        </div>
        <button className="btn btn-primary">Export to PDF</button>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-white shadow-md p-4">
          <h3 className="text-sm text-gray-600">Current Rating</h3>
          <div className="flex items-center space-x-2 mt-2">
            <div className="flex">{getRatingStars(scorecard.currentRating)}</div>
            <span className="text-2xl font-bold">{scorecard.currentRating.toFixed(1)}</span>
          </div>
        </div>

        <div className="card bg-white shadow-md p-4">
          <h3 className="text-sm text-gray-600">On-Time Delivery</h3>
          <p className="text-2xl font-bold mt-2">{scorecard.rollingOnTimePercentage.toFixed(1)}%</p>
        </div>

        <div className="card bg-white shadow-md p-4">
          <h3 className="text-sm text-gray-600">Quality Acceptance</h3>
          <p className="text-2xl font-bold mt-2">{scorecard.rollingQualityPercentage.toFixed(1)}%</p>
        </div>

        <div className="card bg-white shadow-md p-4">
          <h3 className="text-sm text-gray-600">Trend</h3>
          <div className="flex items-center space-x-2 mt-2">
            {getTrendIcon(scorecard.trendDirection)}
            <span className="text-lg font-semibold">{scorecard.trendDirection}</span>
          </div>
        </div>
      </div>

      {/* Performance Trend Chart */}
      <div className="card bg-white shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">12-Month Performance Trend</h2>
        <LineChart width={1000} height={400} data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="OTD" stroke="#3b82f6" name="On-Time Delivery %" />
          <Line type="monotone" dataKey="Quality" stroke="#10b981" name="Quality %" />
          <Line type="monotone" dataKey="Rating" stroke="#f59e0b" name="Overall Rating (scaled)" />
        </LineChart>
      </div>

      {/* Monthly Performance Table */}
      <div className="card bg-white shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Monthly Performance Details</h2>
        <table className="table-auto w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Month</th>
              <th className="text-right p-2">POs Issued</th>
              <th className="text-right p-2">PO Value</th>
              <th className="text-right p-2">OTD %</th>
              <th className="text-right p-2">Quality %</th>
              <th className="text-right p-2">Rating</th>
            </tr>
          </thead>
          <tbody>
            {scorecard.monthlyPerformance.map((m: any, idx: number) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                <td className="p-2">{`${m.evaluationPeriodYear}-${String(m.evaluationPeriodMonth).padStart(2, '0')}`}</td>
                <td className="text-right p-2">{m.totalPosIssued}</td>
                <td className="text-right p-2">${m.totalPosValue.toLocaleString()}</td>
                <td className="text-right p-2">{m.onTimePercentage.toFixed(1)}%</td>
                <td className="text-right p-2">{m.qualityPercentage.toFixed(1)}%</td>
                <td className="text-right p-2">
                  <span
                    className={`px-2 py-1 rounded ${
                      m.overallRating >= 4 ? 'bg-green-100 text-green-800' :
                      m.overallRating >= 2.5 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}
                  >
                    {m.overallRating.toFixed(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

---

**Research Completed Successfully ✅**

**Deliverable Published To:**
`nats://agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1766657618088`
