# Research Report: PO Approval Workflow
**Requirement:** REQ-STRATEGIC-AUTO-1766821112012
**Agent:** Cynthia (Research Specialist)
**Date:** 2025-12-27
**Status:** COMPLETE

---

## Executive Summary

This research report provides a comprehensive analysis of the current Purchase Order (PO) functionality in the print industry ERP system and detailed recommendations for implementing a robust approval workflow. The system currently has basic approval infrastructure but lacks multi-level approval chains, role-based authorization, approval rules engine, and rejection workflows.

**Key Findings:**
- ✅ Database schema has approval fields (`requires_approval`, `approved_by_user_id`, `approved_at`)
- ✅ User table has JSONB roles for flexible RBAC implementation
- ✅ Multi-tenant security foundation exists
- ❌ Single-level approval only (no approval chains)
- ❌ No approval threshold logic based on PO amount/vendor/category
- ❌ No role-based authorization in GraphQL resolvers
- ❌ No approval history audit trail
- ❌ No rejection/revision workflow

---

## 1. Current Purchase Order System Architecture

### 1.1 Database Schema

#### Core Tables (`sales-materials-procurement-module.sql`)

**`purchase_orders` Table (Lines 388-462)**

Key Fields:
```sql
-- Identity & Multi-Tenancy
id UUID PRIMARY KEY
tenant_id UUID REFERENCES tenants(id)
facility_id UUID REFERENCES facilities(id)
po_number VARCHAR(50) UNIQUE
po_date DATE NOT NULL

-- Vendor & Delivery
vendor_id UUID REFERENCES vendors(id)
ship_to_facility_id UUID REFERENCES facilities(id)
billing_entity_id UUID REFERENCES tenants(id)
buyer_user_id UUID REFERENCES users(id)

-- Financials
po_currency_code VARCHAR(3)
exchange_rate DECIMAL(15,6)
subtotal DECIMAL(15,2)
tax_amount DECIMAL(15,2)
shipping_amount DECIMAL(15,2)
total_amount DECIMAL(15,2)

-- Status & Approval (CRITICAL)
status VARCHAR(20) NOT NULL
  -- Values: DRAFT, ISSUED, ACKNOWLEDGED, PARTIALLY_RECEIVED, RECEIVED, CLOSED, CANCELLED
requires_approval BOOLEAN DEFAULT FALSE
approved_by_user_id UUID REFERENCES users(id)
approved_at TIMESTAMPTZ

-- Payment & Delivery
payment_terms VARCHAR(50)
requested_delivery_date DATE
promised_delivery_date DATE

-- GL Integration
journal_entry_id UUID REFERENCES journal_entries(id)

-- Audit Trail
created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
created_by UUID REFERENCES users(id)
updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
updated_by UUID REFERENCES users(id)
```

**Indexes:**
- `idx_purchase_orders_tenant_id` - Multi-tenant filtering
- `idx_purchase_orders_facility_id` - Facility filtering
- `idx_purchase_orders_vendor_id` - Vendor lookup
- `idx_purchase_orders_status` - Status filtering
- `idx_purchase_orders_po_date` - Date range queries
- `idx_purchase_orders_approved_by` - Approver tracking

**`purchase_order_lines` Table (Lines 469-522)**

Line-level tracking:
```sql
id UUID PRIMARY KEY
purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE
line_number INT NOT NULL
material_id UUID REFERENCES materials(id)
description TEXT
quantity_ordered DECIMAL(15,4) NOT NULL
unit_price DECIMAL(15,4) NOT NULL
line_amount DECIMAL(15,2) NOT NULL
quantity_received DECIMAL(15,4) DEFAULT 0
quantity_remaining DECIMAL(15,4)
status VARCHAR(20) -- OPEN, PARTIALLY_RECEIVED, RECEIVED, CLOSED, CANCELLED
expense_account_id UUID REFERENCES chart_of_accounts(id)
allow_over_receipt BOOLEAN DEFAULT FALSE
over_receipt_tolerance_percentage DECIMAL(5,2)
```

**`vendors` Table (Lines 259-322)**

Vendor approval status:
```sql
is_approved BOOLEAN DEFAULT FALSE
approved_by_user_id UUID REFERENCES users(id)
approved_at TIMESTAMPTZ
on_time_delivery_percentage DECIMAL(5,2)
quality_rating_percentage DECIMAL(5,2)
overall_rating DECIMAL(3,2)
vendor_tier VARCHAR(20) -- STRATEGIC, PREFERRED, TRANSACTIONAL
```

### 1.2 User Roles & Permissions

#### Users Table Structure (`core-multitenant-module.sql` Lines 248-336)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID REFERENCES tenants(id),
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  roles JSONB DEFAULT '[]'::JSONB,
    -- Examples: ['ADMIN', 'CSR', 'PROCUREMENT_MANAGER', 'WAREHOUSE_MANAGER']
  permissions JSONB DEFAULT '[]'::JSONB,
  security_clearance_level VARCHAR(20) DEFAULT 'STANDARD'
    -- STANDARD, RESTRICTED, SECURE, HIGH_SECURITY, VAULT
);
```

**Key Observations:**
1. Roles stored as JSON array - flexible, allows multiple roles per user
2. No predefined roles table - configuration is flexible
3. Tenant-isolated - each tenant has own users
4. Security clearance levels provide additional authorization layer

#### Current Security Implementation

**Tenant Validation (`tenant-validation.ts`):**
```typescript
export function validateTenantAccess(context: any, requestedTenantId: string): void
export function getTenantIdFromContext(context: any): string
export function getUserIdFromContext(context: any): string
```

**Security Pattern:**
- Validates user is authenticated (JWT token required)
- Validates requested tenant matches user's tenant
- Throws `UnauthorizedException` or `ForbiddenException`

**CRITICAL GAP:** No role-based validation in resolvers. Example from `approvePurchaseOrder`:
```typescript
@Mutation('approvePurchaseOrder')
async approvePurchaseOrder(
  @Args('id') id: string,
  @Args('approvedByUserId') approvedByUserId: string,
  @Context() context: any
) {
  // NO validation that user has APPROVAL_PERMISSION or appropriate role
  // ANY authenticated user can approve ANY PO
}
```

---

## 2. Current PO Creation & Management Flows

### 2.1 Frontend Pages

#### PurchaseOrdersPage.tsx - List View

**Key Features:**
- Status filtering: DRAFT, ISSUED, ACKNOWLEDGED, PARTIALLY_RECEIVED, RECEIVED, CLOSED, CANCELLED
- Summary cards showing:
  - Total orders count
  - Pending approval count (DRAFT status + no approvedAt timestamp)
  - Received count
  - Total value (sum of all PO amounts)
- Approval Status Column: Shows "Approved" (green badge) or "Pending Approval" (yellow badge)
- Date range filtering
- Vendor filtering

**GraphQL Query:**
```graphql
query GetPurchaseOrders(
  $tenantId: ID!
  $facilityId: ID
  $vendorId: ID
  $status: String
  $startDate: Date
  $endDate: Date
) {
  purchaseOrders(
    tenantId: $tenantId
    facilityId: $facilityId
    vendorId: $vendorId
    status: $status
    startDate: $startDate
    endDate: $endDate
  ) {
    id
    poNumber
    poDate
    vendor { id name }
    status
    totalAmount
    requiresApproval
    approvedAt
    approvedByUser { id fullName }
  }
}
```

#### CreatePurchaseOrderPage.tsx - PO Creation Form

**PO Header Section:**
- Vendor selection (dropdown filtered: isActive=true AND isApproved=true)
- PO date (date picker, defaults to today)
- Requested delivery date
- Payment terms (text input, e.g., "Net 30")
- Currency selection (USD, EUR, GBP, CAD)
- Notes textarea

**Line Items Section:**
- Material selection (autocomplete from materials master)
- Quantity input (decimal, validates > 0)
- Unit price (decimal, validates >= 0)
- Unit of measure (auto-filled from material master)
- Line amount calculation: qty × unit price
- Add/remove line buttons
- Dynamic row management

**Totals Calculation:**
```typescript
const subtotal = lineItems.reduce((sum, line) => sum + line.lineAmount, 0);
const taxRate = 0.08; // HARDCODED - should be configurable
const taxAmount = subtotal * taxRate;
const shippingAmount = 0; // PLACEHOLDER
const totalAmount = subtotal + taxAmount + shippingAmount;
```

**Form Validation:**
- Required fields: vendor, at least one line item
- Line item validation: material, quantity > 0
- Prevents submission of empty PO

**Mutation:**
```graphql
mutation CreatePurchaseOrder($input: CreatePurchaseOrderInput!) {
  createPurchaseOrder(
    tenantId: $input.tenantId
    facilityId: $input.facilityId
    vendorId: $input.vendorId
    purchaseOrderDate: $input.poDate
    poCurrencyCode: $input.currencyCode
    totalAmount: $input.totalAmount
  ) {
    id
    poNumber
    status
  }
}
```

**Current Behavior:**
- Creates PO with `status='DRAFT'`
- Sets `requires_approval = TRUE` by default
- Sets `created_by` from context user
- Auto-generates `po_number` (sequence-based)

#### PurchaseOrderDetailPage.tsx - PO Detail & Actions

**Status-Based Conditional Actions:**
```typescript
const canApprove = po.requiresApproval && !po.approvedAt && po.status === 'DRAFT';
const canIssue = po.approvedAt && po.status === 'DRAFT';
const canClose = po.status === 'RECEIVED';
```

**Action Buttons:**
1. **Approve Button** (green, icon: ✅)
   - Visible only when `canApprove === true`
   - Opens approval confirmation modal
   - Modal: "Are you sure you want to approve this Purchase Order?"
   - Calls `APPROVE_PURCHASE_ORDER` mutation

2. **Issue Button** (blue, icon: 📦)
   - Visible only when `canIssue === true`
   - Changes status from DRAFT → ISSUED
   - Makes PO official and ready for vendor transmission

3. **Close Button** (gray, icon: ✋)
   - Visible only when `canClose === true`
   - Changes status to CLOSED
   - Marks PO as complete

4. **Print Button** - Prints PO to PDF

5. **Export PDF Button** - Downloads PDF

**Approval Status Display:**
```tsx
{po.requiresApproval && !po.approvedAt && (
  <Alert severity="warning">
    This PO requires approval before it can be issued.
  </Alert>
)}

{po.approvedAt && (
  <Alert severity="success">
    Approved by {po.approvedByUser.fullName} on {formatDateTime(po.approvedAt)}
  </Alert>
)}
```

### 2.2 Backend GraphQL Resolvers

**File:** `sales-materials.resolver.ts`

#### Queries

**1. `purchaseOrders` Query (Lines 383-435)**
```typescript
@Query('purchaseOrders')
async getPurchaseOrders(
  @Args('tenantId') tenantId: string,
  @Args('facilityId') facilityId: string,
  @Args('vendorId') vendorId: string,
  @Args('status') status: string,
  @Args('startDate') startDate: string,
  @Args('endDate') endDate: string,
  @Args('limit') limit: number,
  @Args('offset') offset: number,
  @Context() context: any
): Promise<PurchaseOrder[]>
```

**Implementation:**
- Validates tenant access
- Builds dynamic WHERE clause based on filters
- Supports pagination (limit, offset)
- Joins with vendors, users for related data
- Returns array of POs with computed fields

**2. `purchaseOrder` Query (Lines 437-457)**
```typescript
@Query('purchaseOrder')
async getPurchaseOrder(
  @Args('id') id: string,
  @Context() context: any
): Promise<PurchaseOrder>
```

**Implementation:**
- Fetches single PO with all line items
- Joins `purchase_orders` + `purchase_order_lines`
- Returns full PO object with nested lines array

**3. `purchaseOrderByNumber` Query (Lines 459-479)**
```typescript
@Query('purchaseOrderByNumber')
async getPurchaseOrderByNumber(
  @Args('tenantId') tenantId: string,
  @Args('poNumber') poNumber: string,
  @Context() context: any
): Promise<PurchaseOrder>
```

#### Mutations

**1. `createPurchaseOrder` Mutation (~Lines 1290-1310)**
```typescript
@Mutation('createPurchaseOrder')
async createPurchaseOrder(
  @Args('tenantId') tenantId: string,
  @Args('facilityId') facilityId: string,
  @Args('vendorId') vendorId: string,
  @Args('purchaseOrderDate') purchaseOrderDate: string,
  @Args('poCurrencyCode') poCurrencyCode: string,
  @Args('totalAmount') totalAmount: number,
  @Context() context: any
): Promise<PurchaseOrder>
```

**Implementation:**
```sql
INSERT INTO purchase_orders (
  tenant_id, facility_id, vendor_id, po_date, po_currency_code,
  total_amount, status, requires_approval, created_by
) VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', TRUE, $7)
RETURNING *;
```

**Key Behaviors:**
- Status set to 'DRAFT'
- `requires_approval` always TRUE
- `created_by` from JWT context
- Auto-generates `po_number` via sequence

**2. `approvePurchaseOrder` Mutation (Lines 1360-1385) - CRITICAL**
```typescript
@Mutation('approvePurchaseOrder')
async approvePurchaseOrder(
  @Args('id') id: string,
  @Args('approvedByUserId') approvedByUserId: string,
  @Context() context: any
): Promise<PurchaseOrder>
```

**Current Implementation:**
```sql
UPDATE purchase_orders
SET
  status = 'ISSUED',
  approved_by_user_id = $1,
  approved_at = NOW(),
  updated_at = NOW(),
  updated_by = $2
WHERE id = $3 AND tenant_id = $4
RETURNING *;
```

**LIMITATIONS:**
1. ❌ No validation that `approvedByUserId` matches the authenticated user
2. ❌ No role-based authorization (anyone can approve)
3. ❌ No approval amount thresholds
4. ❌ No multi-level approval chain support
5. ❌ Immediately changes status to ISSUED (no intermediate approval states)
6. ❌ No approval history/audit trail
7. ❌ No rejection capability
8. ❌ No approval comments/notes

**3. `updatePurchaseOrder` Mutation (Lines 1313-1358)**
```typescript
@Mutation('updatePurchaseOrder')
async updatePurchaseOrder(
  @Args('id') id: string,
  @Args('status') status: string,
  @Args('promisedDeliveryDate') promisedDeliveryDate: string,
  @Context() context: any
): Promise<PurchaseOrder>
```

**4. `receivePurchaseOrder` Mutation (Lines 1387-1412)**
```typescript
@Mutation('receivePurchaseOrder')
async receivePurchaseOrder(
  @Args('id') id: string,
  @Context() context: any
): Promise<PurchaseOrder>
```

**Current:** Changes status to 'RECEIVED'
**TODO:** Implement line-level receiving logic

**5. `closePurchaseOrder` Mutation (Lines 1414-1432)**
```typescript
@Mutation('closePurchaseOrder')
async closePurchaseOrder(
  @Args('id') id: string,
  @Context() context: any
): Promise<PurchaseOrder>
```

Changes status to 'CLOSED'

---

## 3. Existing Approval/Workflow Mechanisms

### 3.1 What Currently Exists

1. **Basic Approval Flag:**
   - `requires_approval` column (always set to TRUE)
   - Simple boolean flag, no configurable rules

2. **Approval Tracking:**
   - `approved_by_user_id` - Who approved
   - `approved_at` - When approved
   - Single approval only

3. **Status Progression:**
   ```
   DRAFT → (approval) → ISSUED → ACKNOWLEDGED → PARTIALLY_RECEIVED → RECEIVED → CLOSED
                                                                        ↓
                                                                   CANCELLED
   ```

4. **Approval UI:**
   - Approval confirmation modal
   - Conditional action buttons based on status
   - Approval status badges and alerts

5. **Conditional Action Display:**
   - Shows approve button only when: `requiresApproval && !approvedAt && status === 'DRAFT'`
   - Shows issue button only when: `approvedAt && status === 'DRAFT'`

### 3.2 What's Missing (Critical Gaps)

1. **NO Approval Hierarchy:**
   - Single approver only
   - No manager → director → executive chain
   - No parallel approvals (e.g., both procurement AND finance)

2. **NO Approval Thresholds:**
   - All POs require same approval level regardless of amount
   - No differentiation between $100 and $100,000 POs
   - No automatic approval for low-value POs

3. **NO Approval Rules Configuration:**
   - Can't configure rules by:
     - PO amount ranges (< $1K, $1K-$10K, > $10K)
     - Vendor tier (Strategic, Preferred, Transactional)
     - Product category (Capital equipment, office supplies, materials)
     - Facility (different rules per location)
     - Department/cost center
   - No rule priority or conflict resolution

4. **NO Multi-Approver Workflows:**
   - Can't have sequential approvals (Level 1 → Level 2 → Level 3)
   - Can't have parallel approvals (must have both Procurement AND Finance)
   - No approval routing based on PO attributes

5. **NO Approval Notifications:**
   - No email/SMS alerts to approvers
   - No dashboard showing pending approvals
   - No escalation for overdue approvals
   - No reminders for SLA violations

6. **NO Approval History:**
   - No audit trail of who approved what when
   - No record of approval decisions
   - Can't track approval performance metrics
   - No compliance reporting

7. **NO Rejection Workflow:**
   - Can't reject a PO
   - Can't send back for revision with comments
   - No rejection reason tracking
   - No re-approval after revision

8. **NO SLA Tracking:**
   - No deadline for approvals
   - No automatic escalation if approval overdue
   - No approval aging reports
   - No performance metrics for approvers

9. **NO Delegation:**
   - No approval delegation to backup approvers
   - No temporary approval authority assignment
   - No absence management for approvers

10. **NO Audit Comments:**
    - Approver can't add comments/notes to approval
    - No explanation for approval/rejection decisions
    - No attachment of supporting documents

---

## 4. Related Business Logic for Purchase Orders

### 4.1 Vendor Performance Integration

**Files:**
- `procurement.module.ts` - Procurement module definition
- `vendor-performance.service.ts` - Vendor scorecard calculations
- `vendor-tier-classification.service.ts` - Strategic/Preferred/Transactional classification
- `vendor-alert-engine.service.ts` - Performance alerts

**PO ↔ Vendor Metrics:**
```typescript
// Vendor performance metrics tracked:
total_pos_issued: number;           // Count of POs issued to vendor
total_pos_value: number;            // Sum of PO amounts
on_time_deliveries: number;         // Count of on-time deliveries
total_deliveries: number;           // Total deliveries
on_time_delivery_percentage: number; // (on_time / total) * 100
quality_acceptances: number;        // Passed quality checks
quality_rejections: number;         // Failed quality checks
quality_rating_percentage: number;  // (accepted / total) * 100
price_competitiveness_score: number; // 1-5 stars
responsiveness_score: number;       // 1-5 stars
overall_rating: number;             // Average of all scores
```

**Vendor Tier Classification:**
- **STRATEGIC:** High volume, critical materials, long-term partnerships
- **PREFERRED:** Reliable, good performance, regular business
- **TRANSACTIONAL:** Occasional, commodity items, price-focused

**Approval Workflow Implications:**
- Strategic vendors could have expedited approval (fewer levels)
- New/unproven vendors might require additional approvals
- Vendors with poor performance might trigger additional scrutiny
- High-risk vendors might require executive approval regardless of amount

### 4.2 Quote-to-Order Workflow

**Sales Module (`sales.module.ts`):**
- `QuoteManagementService` - Quote lifecycle management
- `QuotePricingService` - Dynamic pricing calculations
- `PricingRuleEngineService` - Pricing rules with priority evaluation
- `QuoteCostingService` - Cost calculations and margin analysis

**PO Related:**
- Can convert approved quotes to sales orders
- Can create POs from materials needed for production orders
- Links quotes → orders → POs for traceability

**Approval Workflow Implications:**
- POs created from approved quotes might have expedited approval
- Emergency/rush POs might require higher-level approval
- Deviation from quoted prices might trigger additional approval

### 4.3 Financial/GL Integration

**Fields in purchase_orders:**
```sql
journal_entry_id UUID REFERENCES journal_entries(id)
subtotal DECIMAL(15,2)
tax_amount DECIMAL(15,2)
shipping_amount DECIMAL(15,2)
total_amount DECIMAL(15,2)
```

**Purchase Order Lines:**
```sql
expense_account_id UUID REFERENCES chart_of_accounts(id)
```

**Approval Workflow Implications:**
- Approval might trigger GL posting:
  - DRAFT: No GL impact
  - APPROVED: Tentative/encumbrance entry
  - ISSUED: Committed purchase liability
  - RECEIVED: Actual expense recognition
- Different expense accounts might require different approval levels
- Capital expenditures vs. operating expenses approval rules

### 4.4 Multi-Currency Support

**Fields:**
```sql
po_currency_code VARCHAR(3)  -- USD, EUR, GBP, CAD, etc.
exchange_rate DECIMAL(15,6)  -- Conversion rate at time of PO creation
```

**Approval Workflow Implications:**
- Foreign currency POs might require additional approval
- Large currency exposures might need treasury approval
- Exchange rate risk assessment for high-value foreign POs

---

## 5. Architecture Patterns (NestJS Migration)

### 5.1 Current NestJS Structure

**App Module Structure (`app.module.ts`):**
```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),      // Environment config
    DatabaseModule,              // PostgreSQL connection pool
    GraphQLModule.forRoot({...}), // Apollo Server
    HealthModule,
    ForecastingModule,           // Inventory forecasting
    WmsModule,                   // Warehouse management
    ProcurementModule,           // Vendor performance (limited)
    SalesModule,                 // Materials, quotes, pricing
    OperationsModule,            // Production
    FinanceModule,               // Accounting
    TenantModule,                // Multi-tenant
    QualityModule,               // Quality, HR, IoT
    TestDataModule,              // Dev only
  ],
})
export class AppModule {}
```

**Migration Status (Phase 1 Complete):**
- ✅ GraphQL module with Apollo Server integration
- ✅ Database module (PostgreSQL connection pool)
- ✅ Health checks and monitoring
- ✅ Multi-tenant foundation
- ✅ Business modules organized by domain
- 🚀 ProcurementModule created but limited functionality
- 🚀 SalesModule with quote/pricing services

### 5.2 Direct SQL Pattern (No ORM)

**Implementation Approach:**
- Direct PostgreSQL pool queries via `pg` library
- Row mappers for snake_case → camelCase conversion
- **No TypeORM, Sequelize, or other ORM**
- Prepared statements with parameterized queries ($1, $2, etc.)
- Manual transaction management when needed

**Example Pattern:**
```typescript
async getPurchaseOrders(
  tenantId: string,
  status?: string,
  limit = 100,
  offset = 0
): Promise<PurchaseOrder[]> {
  const params = [tenantId];
  let query = `
    SELECT
      po.*,
      v.name AS vendor_name,
      u.full_name AS approved_by_name
    FROM purchase_orders po
    LEFT JOIN vendors v ON po.vendor_id = v.id
    LEFT JOIN users u ON po.approved_by_user_id = u.id
    WHERE po.tenant_id = $1
  `;

  if (status) {
    params.push(status);
    query += ` AND po.status = $${params.length}`;
  }

  query += ` ORDER BY po.po_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await this.db.query(query, params);
  return result.rows.map(this.mapPurchaseOrderRow);
}

private mapPurchaseOrderRow(row: any): PurchaseOrder {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    facilityId: row.facility_id,
    poNumber: row.po_number,
    poDate: row.po_date,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    status: row.status,
    totalAmount: parseFloat(row.total_amount),
    requiresApproval: row.requires_approval,
    approvedByUserId: row.approved_by_user_id,
    approvedByName: row.approved_by_name,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}
```

**Advantages for Approval Implementation:**
- Direct control over complex queries (approval chain lookups)
- Easy to add approval audit tables without ORM migrations
- Can use PostgreSQL arrays/JSONB for approval chains
- No ORM overhead for high-volume approval queries
- Simple to implement row-level security

### 5.3 GraphQL First Approach

**Schema Definition:**
- Schema files in `.graphql` format (schema-first, not code-first)
- Resolvers implement schema contracts manually
- No automatic resolver generation
- Explicit query/mutation definitions

**Example Schema (`sales-materials.graphql`):**
```graphql
type PurchaseOrder {
  id: ID!
  tenantId: ID!
  facilityId: ID!
  poNumber: String!
  poDate: Date!
  vendor: Vendor!
  status: String!
  totalAmount: Float!
  requiresApproval: Boolean!
  approvedByUser: User
  approvedAt: DateTime
  lines: [PurchaseOrderLine!]!
}

type Query {
  purchaseOrders(
    tenantId: ID!
    facilityId: ID
    vendorId: ID
    status: String
    startDate: Date
    endDate: Date
  ): [PurchaseOrder!]!

  purchaseOrder(id: ID!): PurchaseOrder
}

type Mutation {
  createPurchaseOrder(
    tenantId: ID!
    facilityId: ID!
    vendorId: ID!
    purchaseOrderDate: Date!
    poCurrencyCode: String!
    totalAmount: Float!
  ): PurchaseOrder!

  approvePurchaseOrder(
    id: ID!
    approvedByUserId: ID!
  ): PurchaseOrder!
}
```

---

## 6. Recommended Approval Workflow Implementation

### 6.1 Database Schema Extensions

#### Phase 1: Core Approval Tables

**1. `purchase_order_approvals` - Approval History Audit Trail**
```sql
CREATE TABLE purchase_order_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,

  -- Approval Chain Position
  approval_level INT NOT NULL,  -- 1, 2, 3, etc. (sequential order)
  approval_sequence_id UUID,    -- For parallel approvals, same sequence_id

  -- Approval Requirements
  required_role VARCHAR(100),   -- 'PROCUREMENT_MANAGER', 'FINANCE_DIRECTOR', etc.
  required_min_amount DECIMAL(15,2),  -- Threshold for this approval level
  required_max_amount DECIMAL(15,2),

  -- Approver Assignment
  assigned_to_user_id UUID REFERENCES users(id),
  delegated_to_user_id UUID REFERENCES users(id),  -- If delegated

  -- Approval Decision
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING, APPROVED, REJECTED, DELEGATED, ESCALATED
  decision_made_by_user_id UUID REFERENCES users(id),
  decision_at TIMESTAMPTZ,
  comments TEXT,
  rejection_reason TEXT,

  -- SLA Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_at TIMESTAMPTZ,           -- SLA deadline
  escalated_at TIMESTAMPTZ,     -- When escalated for overdue
  escalated_to_user_id UUID REFERENCES users(id),

  -- Audit Trail
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id),

  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_purchase_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id)
);

CREATE INDEX idx_po_approvals_tenant_id ON purchase_order_approvals(tenant_id);
CREATE INDEX idx_po_approvals_po_id ON purchase_order_approvals(purchase_order_id);
CREATE INDEX idx_po_approvals_status ON purchase_order_approvals(status);
CREATE INDEX idx_po_approvals_assigned_to ON purchase_order_approvals(assigned_to_user_id);
CREATE INDEX idx_po_approvals_due_at ON purchase_order_approvals(due_at);
```

**2. `approval_rules` - Approval Threshold Configuration**
```sql
CREATE TABLE approval_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Rule Identification
  rule_name VARCHAR(255) NOT NULL,
  rule_description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,  -- Higher priority rules evaluated first

  -- Rule Conditions (JSONB for flexibility)
  conditions JSONB NOT NULL,
    -- Example: {
    --   "amount_min": 0,
    --   "amount_max": 1000,
    --   "vendor_tier": ["STRATEGIC"],
    --   "facility_ids": ["uuid1", "uuid2"],
    --   "expense_account_prefixes": ["5000", "5100"]
    -- }

  -- Approval Chain Definition (Array of approval levels)
  approval_chain JSONB NOT NULL,
    -- Example: [
    --   {
    --     "level": 1,
    --     "role": "PROCUREMENT_MANAGER",
    --     "sla_hours": 24,
    --     "auto_escalate": true
    --   },
    --   {
    --     "level": 2,
    --     "role": "FINANCE_DIRECTOR",
    --     "sla_hours": 48,
    --     "auto_escalate": true
    --   }
    -- ]

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id),

  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_approval_rules_tenant_id ON approval_rules(tenant_id);
CREATE INDEX idx_approval_rules_is_active ON approval_rules(is_active);
CREATE INDEX idx_approval_rules_priority ON approval_rules(priority DESC);
CREATE INDEX idx_approval_rules_conditions ON approval_rules USING GIN(conditions);
```

**3. `approval_rule_assignments` - User-to-Role Assignment**
```sql
CREATE TABLE approval_rule_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Assignment
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_name VARCHAR(100) NOT NULL,  -- 'PROCUREMENT_MANAGER', etc.

  -- Constraints
  facility_id UUID REFERENCES facilities(id),  -- If role is facility-specific
  max_approval_amount DECIMAL(15,2),  -- User's approval limit

  -- Delegation
  is_active BOOLEAN DEFAULT TRUE,
  delegate_user_id UUID REFERENCES users(id),  -- Backup approver
  delegation_start_date DATE,
  delegation_end_date DATE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id),

  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE (tenant_id, user_id, role_name, facility_id)
);

CREATE INDEX idx_approval_assignments_tenant_id ON approval_rule_assignments(tenant_id);
CREATE INDEX idx_approval_assignments_user_id ON approval_rule_assignments(user_id);
CREATE INDEX idx_approval_assignments_role ON approval_rule_assignments(role_name);
CREATE INDEX idx_approval_assignments_active ON approval_rule_assignments(is_active);
```

**4. `approval_notifications` - Notification Queue**
```sql
CREATE TABLE approval_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Notification Target
  user_id UUID NOT NULL REFERENCES users(id),
  notification_type VARCHAR(50) NOT NULL,
    -- APPROVAL_REQUEST, APPROVAL_REMINDER, APPROVAL_ESCALATION, APPROVAL_APPROVED, APPROVAL_REJECTED

  -- Related Records
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  approval_id UUID REFERENCES purchase_order_approvals(id) ON DELETE CASCADE,

  -- Notification Content
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,

  -- Delivery
  delivery_method VARCHAR(20) NOT NULL DEFAULT 'IN_APP',
    -- IN_APP, EMAIL, SMS
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_notifications_tenant_id ON approval_notifications(tenant_id);
CREATE INDEX idx_notifications_user_id ON approval_notifications(user_id);
CREATE INDEX idx_notifications_sent_at ON approval_notifications(sent_at);
CREATE INDEX idx_notifications_read_at ON approval_notifications(read_at);
```

#### Phase 2: Purchase Order Table Modifications

**Add new columns to `purchase_orders` table:**
```sql
ALTER TABLE purchase_orders
  ADD COLUMN approval_status VARCHAR(20) DEFAULT 'PENDING_APPROVAL',
    -- PENDING_APPROVAL, PARTIALLY_APPROVED, FULLY_APPROVED, REJECTED, NO_APPROVAL_REQUIRED
  ADD COLUMN current_approval_level INT DEFAULT 1,
  ADD COLUMN total_approval_levels INT DEFAULT 1,
  ADD COLUMN rejected_at TIMESTAMPTZ,
  ADD COLUMN rejected_by_user_id UUID REFERENCES users(id),
  ADD COLUMN rejection_reason TEXT,
  ADD COLUMN revision_count INT DEFAULT 0;

CREATE INDEX idx_purchase_orders_approval_status ON purchase_orders(approval_status);
```

### 6.2 Service Layer Architecture

#### New Service Classes

**1. `ApprovalRuleEngineService`**

**Purpose:** Determine approval requirements based on PO attributes

**Key Methods:**
```typescript
@Injectable()
export class ApprovalRuleEngineService {
  constructor(
    @Inject('DATABASE_POOL') private db: Pool,
    private logger: Logger
  ) {}

  /**
   * Find the applicable approval rule for a purchase order
   * Evaluates rules by priority, returns first matching rule
   */
  async getApplicableRule(
    tenantId: string,
    poAmount: number,
    vendorTier: string,
    facilityId: string,
    expenseAccountId: string
  ): Promise<ApprovalRule | null> {
    // 1. Fetch all active rules for tenant, ordered by priority DESC
    // 2. Evaluate conditions in order (JSONB → conditions)
    // 3. Return first matching rule
    // 4. If no match, return default rule (if configured)
  }

  /**
   * Generate approval chain for a purchase order
   */
  async generateApprovalChain(
    tenantId: string,
    purchaseOrderId: string,
    ruleId: string
  ): Promise<ApprovalChainLevel[]> {
    // 1. Fetch rule's approval_chain JSONB
    // 2. For each level, find assigned approvers (by role + facility)
    // 3. Return array of approval levels with assigned users
  }

  /**
   * Check if PO amount exceeds user's approval limit
   */
  async validateApproverAuthority(
    userId: string,
    roleName: string,
    poAmount: number,
    facilityId: string
  ): Promise<boolean> {
    // Query approval_rule_assignments
    // Validate user has role AND max_approval_amount >= poAmount
  }
}
```

**2. `ApprovalWorkflowService`**

**Purpose:** Manage approval workflow state and transitions

**Key Methods:**
```typescript
@Injectable()
export class ApprovalWorkflowService {
  constructor(
    @Inject('DATABASE_POOL') private db: Pool,
    private ruleEngine: ApprovalRuleEngineService,
    private notificationService: ApprovalNotificationService,
    private logger: Logger
  ) {}

  /**
   * Initiate approval workflow for a newly created PO
   */
  async initiateApprovalWorkflow(
    tenantId: string,
    purchaseOrderId: string,
    poAmount: number,
    vendorTier: string,
    facilityId: string,
    expenseAccountId: string
  ): Promise<void> {
    // 1. Get applicable approval rule
    // 2. Generate approval chain
    // 3. Create purchase_order_approvals records for each level
    // 4. Update PO: total_approval_levels, approval_status = 'PENDING_APPROVAL'
    // 5. Notify first-level approvers
  }

  /**
   * Record approval decision and progress workflow
   */
  async approvePurchaseOrder(
    approvalId: string,
    approverUserId: string,
    comments?: string
  ): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // 1. Validate approver has authority
      // 2. Update purchase_order_approvals: status='APPROVED', decision_at=NOW()
      // 3. Check if this was the last approval level
      // 4a. If last level: Update PO status='ISSUED', approval_status='FULLY_APPROVED'
      // 4b. If not last: Move to next level, notify next approvers
      // 5. Create approval notification for PO creator
      // 6. Log audit trail

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject PO and send back for revision
   */
  async rejectPurchaseOrder(
    approvalId: string,
    approverUserId: string,
    rejectionReason: string
  ): Promise<void> {
    // 1. Update purchase_order_approvals: status='REJECTED'
    // 2. Update PO: approval_status='REJECTED', rejected_at=NOW(), rejection_reason
    // 3. Notify PO creator with rejection reason
    // 4. Log audit trail
  }

  /**
   * Delegate approval to another user
   */
  async delegateApproval(
    approvalId: string,
    delegatingUserId: string,
    delegateToUserId: string
  ): Promise<void> {
    // 1. Validate delegating user is assigned approver
    // 2. Update purchase_order_approvals: delegated_to_user_id, status='DELEGATED'
    // 3. Notify delegated user
  }

  /**
   * Escalate overdue approvals
   */
  async escalateOverdueApprovals(): Promise<void> {
    // 1. Find approvals where: status='PENDING' AND due_at < NOW()
    // 2. For each, find escalation user (manager of assigned approver)
    // 3. Update: escalated_at=NOW(), escalated_to_user_id
    // 4. Send escalation notifications
  }

  /**
   * Get approval status for a PO
   */
  async getApprovalStatus(
    purchaseOrderId: string
  ): Promise<ApprovalStatusDetail> {
    // 1. Fetch PO with approval_status, current_approval_level, total_approval_levels
    // 2. Fetch all approval records for this PO
    // 3. Return status object with chain, current approver, SLA info
  }
}
```

**3. `ApprovalNotificationService`**

**Purpose:** Send notifications to approvers and stakeholders

**Key Methods:**
```typescript
@Injectable()
export class ApprovalNotificationService {
  constructor(
    @Inject('DATABASE_POOL') private db: Pool,
    private emailService: EmailService,  // If implemented
    private logger: Logger
  ) {}

  /**
   * Notify approvers that a PO is awaiting their approval
   */
  async notifyApprovers(
    tenantId: string,
    purchaseOrderId: string,
    approverUserIds: string[]
  ): Promise<void> {
    // 1. Fetch PO details
    // 2. For each approver, create notification record
    // 3. Send in-app notification (and email if configured)
  }

  /**
   * Send approval reminder for overdue items
   */
  async sendApprovalReminder(
    approvalId: string,
    approverUserId: string
  ): Promise<void> {
    // Send reminder notification
  }

  /**
   * Notify PO creator of approval/rejection
   */
  async notifyPOCreator(
    purchaseOrderId: string,
    notificationType: 'APPROVED' | 'REJECTED',
    message: string
  ): Promise<void> {
    // Notify creator of decision
  }
}
```

**4. `ApprovalAuditService`**

**Purpose:** Log all approval activities for compliance

**Key Methods:**
```typescript
@Injectable()
export class ApprovalAuditService {
  constructor(
    @Inject('DATABASE_POOL') private db: Pool,
    private logger: Logger
  ) {}

  /**
   * Log approval decision
   */
  async logApprovalDecision(
    tenantId: string,
    purchaseOrderId: string,
    approvalId: string,
    action: 'APPROVED' | 'REJECTED' | 'DELEGATED',
    userId: string,
    details: any
  ): Promise<void> {
    // Insert into audit log table
  }

  /**
   * Generate approval compliance report
   */
  async generateComplianceReport(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ApprovalComplianceReport> {
    // Query approval history
    // Calculate metrics: avg approval time, overdue %, rejection rate
  }
}
```

### 6.3 GraphQL Schema Extensions

**File:** `approval-workflow.graphql` (new file)

```graphql
# ============================================================
# TYPES
# ============================================================

type ApprovalRule {
  id: ID!
  tenantId: ID!
  ruleName: String!
  ruleDescription: String
  isActive: Boolean!
  priority: Int!
  conditions: JSON!
  approvalChain: JSON!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type ApprovalRequest {
  id: ID!
  tenantId: ID!
  purchaseOrderId: ID!
  purchaseOrder: PurchaseOrder!
  approvalLevel: Int!
  approvalSequenceId: ID
  requiredRole: String
  requiredMinAmount: Float
  requiredMaxAmount: Float
  assignedToUser: User
  delegatedToUser: User
  status: ApprovalStatus!
  decisionMadeByUser: User
  decisionAt: DateTime
  comments: String
  rejectionReason: String
  createdAt: DateTime!
  dueAt: DateTime
  escalatedAt: DateTime
  escalatedToUser: User
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  DELEGATED
  ESCALATED
}

type ApprovalStatusDetail {
  purchaseOrderId: ID!
  overallStatus: String!
  currentLevel: Int!
  totalLevels: Int!
  approvalChain: [ApprovalRequest!]!
  nextApprover: User
  slaExceeded: Boolean!
  estimatedCompletionDate: DateTime
}

type ApprovalNotification {
  id: ID!
  userId: ID!
  notificationType: String!
  purchaseOrderId: ID
  approvalId: ID
  subject: String!
  message: String!
  deliveryMethod: String!
  sentAt: DateTime
  readAt: DateTime
  createdAt: DateTime!
}

type ApprovalRuleAssignment {
  id: ID!
  tenantId: ID!
  user: User!
  roleName: String!
  facility: Facility
  maxApprovalAmount: Float
  isActive: Boolean!
  delegateUser: User
  delegationStartDate: Date
  delegationEndDate: Date
}

type ApprovalComplianceReport {
  tenantId: ID!
  startDate: Date!
  endDate: Date!
  totalPOs: Int!
  totalApprovals: Int!
  avgApprovalTimeHours: Float!
  overdueApprovalPercentage: Float!
  rejectionRate: Float!
  approvalsByLevel: [ApprovalLevelMetrics!]!
}

type ApprovalLevelMetrics {
  level: Int!
  roleName: String!
  totalApprovals: Int!
  avgTimeHours: Float!
  overdueCount: Int!
}

# ============================================================
# QUERIES
# ============================================================

type Query {
  # Get approval status for a specific PO
  getPOApprovalStatus(
    purchaseOrderId: ID!
  ): ApprovalStatusDetail!

  # Get pending approvals for current user
  getMyPendingApprovals(
    tenantId: ID!
    limit: Int
    offset: Int
  ): [ApprovalRequest!]!

  # Get approval history for a PO
  getApprovalHistory(
    purchaseOrderId: ID!
  ): [ApprovalRequest!]!

  # Get approval rules for tenant
  getApprovalRules(
    tenantId: ID!
    isActive: Boolean
  ): [ApprovalRule!]!

  # Get approval rule assignments for a user
  getUserApprovalRoles(
    userId: ID!
  ): [ApprovalRuleAssignment!]!

  # Get approval notifications
  getApprovalNotifications(
    userId: ID!
    unreadOnly: Boolean
    limit: Int
    offset: Int
  ): [ApprovalNotification!]!

  # Generate compliance report
  getApprovalComplianceReport(
    tenantId: ID!
    startDate: Date!
    endDate: Date!
  ): ApprovalComplianceReport!
}

# ============================================================
# MUTATIONS
# ============================================================

type Mutation {
  # Initiate approval workflow (called automatically on PO creation)
  initiateApprovalWorkflow(
    purchaseOrderId: ID!
  ): ApprovalStatusDetail!

  # Approve a PO at current approval level
  approvePO(
    approvalId: ID!
    comments: String
  ): ApprovalRequest!

  # Reject a PO and send back for revision
  rejectPO(
    approvalId: ID!
    rejectionReason: String!
  ): ApprovalRequest!

  # Delegate approval to another user
  delegateApproval(
    approvalId: ID!
    delegateToUserId: ID!
  ): ApprovalRequest!

  # Re-submit PO after revision (resets approval chain)
  resubmitPO(
    purchaseOrderId: ID!
  ): ApprovalStatusDetail!

  # Admin: Create/update approval rule
  upsertApprovalRule(
    id: ID
    tenantId: ID!
    ruleName: String!
    ruleDescription: String
    conditions: JSON!
    approvalChain: JSON!
    priority: Int
  ): ApprovalRule!

  # Admin: Assign user to approval role
  assignApprovalRole(
    tenantId: ID!
    userId: ID!
    roleName: String!
    facilityId: ID
    maxApprovalAmount: Float
  ): ApprovalRuleAssignment!

  # Mark notification as read
  markNotificationAsRead(
    notificationId: ID!
  ): ApprovalNotification!
}
```

### 6.4 Frontend Components

#### New Pages

**1. `ApprovalDashboardPage.tsx`**

**Purpose:** Central hub for approvers to see pending approvals

**Features:**
- List of pending approvals for current user
- Filter by: priority, amount range, vendor, age
- Sort by: due date, amount, PO number
- Bulk approval capability (select multiple, approve all)
- SLA countdown timers (e.g., "Due in 4 hours" with red/yellow/green status)
- Quick approve/reject buttons
- Search by PO number

**Layout:**
```tsx
<Page title="Approval Dashboard">
  <SummaryCards>
    <Card title="Pending Approvals" value={pendingCount} />
    <Card title="Overdue" value={overdueCount} status="error" />
    <Card title="Avg Approval Time" value="4.2 hours" />
    <Card title="Approvals This Week" value={weeklyCount} />
  </SummaryCards>

  <Filters>
    <PriorityFilter />
    <AmountRangeFilter />
    <VendorFilter />
    <AgeFilter />
  </Filters>

  <ApprovalList>
    {approvals.map(approval => (
      <ApprovalCard
        key={approval.id}
        approval={approval}
        onApprove={handleApprove}
        onReject={handleReject}
        onViewDetails={handleViewDetails}
      />
    ))}
  </ApprovalList>
</Page>
```

**2. `ApprovalDetailsModal.tsx`**

**Purpose:** Detailed view of approval request with decision interface

**Features:**
- PO summary (vendor, amount, line items preview)
- Approval chain visualization (timeline showing completed/pending approvals)
- Comments from previous approvers
- Rejection reason if rejected
- Decision interface:
  - Approve button with optional comments
  - Reject button with required rejection reason
  - Delegate button with user selector
- Related documents (PO PDF, quotes, etc.)
- Audit trail

**Layout:**
```tsx
<Modal title={`Approval Request: ${po.poNumber}`}>
  <PurchaseOrderSummary po={po} />

  <ApprovalChainTimeline
    approvals={approvalChain}
    currentLevel={currentLevel}
  />

  <TabPanel>
    <Tab label="Details">
      <POLineItemsTable lines={po.lines} />
      <VendorInformation vendor={po.vendor} />
    </Tab>

    <Tab label="Comments">
      <CommentsList comments={approval.comments} />
    </Tab>

    <Tab label="Documents">
      <DocumentList documents={po.attachments} />
    </Tab>
  </TabPanel>

  <DecisionPanel>
    <Button
      variant="success"
      onClick={() => setShowApproveDialog(true)}
    >
      Approve
    </Button>

    <Button
      variant="danger"
      onClick={() => setShowRejectDialog(true)}
    >
      Reject
    </Button>

    <Button
      variant="secondary"
      onClick={() => setShowDelegateDialog(true)}
    >
      Delegate
    </Button>
  </DecisionPanel>
</Modal>
```

**3. `ApprovalRulesConfigPage.tsx`**

**Purpose:** Admin UI to configure approval rules and thresholds

**Features:**
- List of existing approval rules
- Create/edit/delete rules
- Rule priority ordering (drag-and-drop)
- Conditions builder:
  - Amount ranges (min/max)
  - Vendor tier selection
  - Facility selection
  - Expense account prefix
- Approval chain builder:
  - Add/remove approval levels
  - Role selection for each level
  - SLA hours configuration
  - Auto-escalation toggle
- Rule activation/deactivation
- Test rule engine (simulate PO to see which rule applies)

**Layout:**
```tsx
<Page title="Approval Rules Configuration">
  <Button onClick={handleCreateRule}>
    Create New Rule
  </Button>

  <RulesList
    rules={rules}
    onEdit={handleEditRule}
    onDelete={handleDeleteRule}
    onReorder={handleReorderRules}
  />

  <RuleEditorModal
    isOpen={isEditorOpen}
    rule={selectedRule}
    onSave={handleSaveRule}
    onCancel={handleCancelEdit}
  >
    <RuleNameInput />
    <RulePriorityInput />

    <ConditionsBuilder
      conditions={conditions}
      onChange={setConditions}
    >
      <AmountRangeInput />
      <VendorTierSelect />
      <FacilityMultiSelect />
      <ExpenseAccountInput />
    </ConditionsBuilder>

    <ApprovalChainBuilder
      chain={approvalChain}
      onChange={setApprovalChain}
    >
      {chain.map((level, index) => (
        <ApprovalLevelEditor
          key={index}
          level={level}
          onUpdate={handleUpdateLevel}
          onRemove={handleRemoveLevel}
        >
          <RoleSelect />
          <SLAHoursInput />
          <AutoEscalateToggle />
        </ApprovalLevelEditor>
      ))}
      <Button onClick={handleAddLevel}>
        Add Approval Level
      </Button>
    </ApprovalChainBuilder>
  </RuleEditorModal>
</Page>
```

**4. `ApprovalHistoryTimeline.tsx` Component**

**Purpose:** Visual timeline of approval chain progress

**Features:**
- Vertical timeline showing approval levels
- Color-coded status indicators:
  - Green checkmark: Approved
  - Yellow clock: Pending
  - Red X: Rejected
  - Gray circle: Not yet reached
- Approver name and timestamp
- Comments/rejection reason on hover or expand
- SLA deadline visualization

**Layout:**
```tsx
<Timeline>
  {approvalChain.map((approval, index) => (
    <TimelineItem
      key={approval.id}
      icon={getStatusIcon(approval.status)}
      color={getStatusColor(approval.status)}
    >
      <TimelineHeader>
        Level {approval.approvalLevel}: {approval.requiredRole}
      </TimelineHeader>

      <TimelineBody>
        {approval.status === 'APPROVED' && (
          <>
            <Typography>
              Approved by {approval.decisionMadeByUser.fullName}
            </Typography>
            <Typography variant="caption">
              {formatDateTime(approval.decisionAt)}
            </Typography>
            {approval.comments && (
              <CommentBubble>{approval.comments}</CommentBubble>
            )}
          </>
        )}

        {approval.status === 'PENDING' && (
          <>
            <Typography>
              Awaiting approval from {approval.assignedToUser.fullName}
            </Typography>
            <SLACountdown dueAt={approval.dueAt} />
          </>
        )}

        {approval.status === 'REJECTED' && (
          <>
            <Typography color="error">
              Rejected by {approval.decisionMadeByUser.fullName}
            </Typography>
            <Typography variant="caption">
              {formatDateTime(approval.decisionAt)}
            </Typography>
            <RejectionReasonBadge>
              {approval.rejectionReason}
            </RejectionReasonBadge>
          </>
        )}
      </TimelineBody>
    </TimelineItem>
  ))}
</Timeline>
```

**5. `ApprovalRoleAssignmentsPage.tsx`**

**Purpose:** Manage which users have approval authority

**Features:**
- List of users with approval roles
- Assign/revoke approval roles
- Set maximum approval amounts per user
- Facility-specific assignments
- Delegation management (vacation backup approvers)
- Approval authority effective dates

#### Updates to Existing Pages

**1. `CreatePurchaseOrderPage.tsx` - Enhanced**

Add approval preview:
```tsx
<ApprovalRequirementPreview
  amount={totalAmount}
  vendor={selectedVendor}
  onRuleChange={setApplicableRule}
/>

// Shows: "This PO will require approval from Procurement Manager (Level 1) and Finance Director (Level 2)"
```

**2. `PurchaseOrderDetailPage.tsx` - Enhanced**

Replace simple approval button with:
```tsx
{po.requiresApproval && (
  <ApprovalSection>
    <ApprovalHistoryTimeline
      approvals={approvalHistory}
      currentLevel={po.currentApprovalLevel}
    />

    {canApprove && (
      <ApprovalActionPanel
        approval={currentApproval}
        onApprove={handleApprove}
        onReject={handleReject}
        onDelegate={handleDelegate}
      />
    )}

    {po.approvalStatus === 'REJECTED' && (
      <RejectionAlert
        rejectedBy={po.rejectedByUser}
        rejectedAt={po.rejectedAt}
        reason={po.rejectionReason}
      />
    )}
  </ApprovalSection>
)}
```

**3. `PurchaseOrdersPage.tsx` - Enhanced**

Add approval status column:
```tsx
<DataTable columns={[
  { field: 'poNumber', header: 'PO Number' },
  { field: 'vendor', header: 'Vendor' },
  { field: 'totalAmount', header: 'Amount' },
  {
    field: 'approvalStatus',
    header: 'Approval Status',
    render: (row) => <ApprovalStatusBadge status={row.approvalStatus} />
  },
  {
    field: 'currentApprover',
    header: 'Current Approver',
    render: (row) => row.nextApprover?.fullName || 'N/A'
  },
  { field: 'status', header: 'PO Status' },
]} />
```

### 6.5 Integration Points

#### Backend Integration

**1. ProcurementModule Enhancement**

Update `procurement.module.ts`:
```typescript
@Module({
  imports: [DatabaseModule, ConfigModule],
  providers: [
    // Existing
    VendorPerformanceService,
    VendorTierClassificationService,
    VendorAlertEngineService,

    // NEW Approval Services
    ApprovalRuleEngineService,
    ApprovalWorkflowService,
    ApprovalNotificationService,
    ApprovalAuditService,
  ],
  exports: [
    // Existing
    VendorPerformanceService,
    VendorTierClassificationService,
    VendorAlertEngineService,

    // NEW
    ApprovalRuleEngineService,
    ApprovalWorkflowService,
  ],
})
export class ProcurementModule {}
```

**2. SalesModule Enhancement**

Update `sales-materials.resolver.ts`:

```typescript
// Inject approval services
constructor(
  @Inject('DATABASE_POOL') private db: Pool,
  private approvalWorkflowService: ApprovalWorkflowService,
  private approvalRuleEngine: ApprovalRuleEngineService
) {}

// Modify createPurchaseOrder to initiate approval
@Mutation('createPurchaseOrder')
async createPurchaseOrder(
  @Args('tenantId') tenantId: string,
  @Args('facilityId') facilityId: string,
  @Args('vendorId') vendorId: string,
  @Args('totalAmount') totalAmount: number,
  // ... other args
  @Context() context: any
): Promise<PurchaseOrder> {
  validateTenantAccess(context, tenantId);
  const userId = getUserIdFromContext(context);

  // Create PO
  const result = await this.db.query(
    `INSERT INTO purchase_orders (...) VALUES (...) RETURNING *`,
    [...]
  );
  const po = this.mapPurchaseOrderRow(result.rows[0]);

  // Initiate approval workflow
  await this.approvalWorkflowService.initiateApprovalWorkflow(
    tenantId,
    po.id,
    totalAmount,
    vendorTier,  // fetch from vendor
    facilityId,
    expenseAccountId
  );

  return po;
}

// Replace approvePurchaseOrder with new implementation
@Mutation('approvePO')
async approvePO(
  @Args('approvalId') approvalId: string,
  @Args('comments') comments: string,
  @Context() context: any
): Promise<ApprovalRequest> {
  const userId = getUserIdFromContext(context);

  // Approval workflow service handles validation, state updates, notifications
  await this.approvalWorkflowService.approvePurchaseOrder(
    approvalId,
    userId,
    comments
  );

  // Return updated approval request
  return this.getApprovalRequest(approvalId);
}

// Add new resolver for rejection
@Mutation('rejectPO')
async rejectPO(
  @Args('approvalId') approvalId: string,
  @Args('rejectionReason') rejectionReason: string,
  @Context() context: any
): Promise<ApprovalRequest> {
  const userId = getUserIdFromContext(context);

  await this.approvalWorkflowService.rejectPurchaseOrder(
    approvalId,
    userId,
    rejectionReason
  );

  return this.getApprovalRequest(approvalId);
}
```

**3. Scheduled Job for SLA Escalation**

Create `approval-escalation.cron.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApprovalWorkflowService } from './approval-workflow.service';

@Injectable()
export class ApprovalEscalationCron {
  private readonly logger = new Logger(ApprovalEscalationCron.name);

  constructor(
    private approvalWorkflowService: ApprovalWorkflowService
  ) {}

  // Run every hour to check for overdue approvals
  @Cron(CronExpression.EVERY_HOUR)
  async handleOverdueApprovals() {
    this.logger.log('Checking for overdue approvals...');

    try {
      await this.approvalWorkflowService.escalateOverdueApprovals();
      this.logger.log('Overdue approval escalation complete');
    } catch (error) {
      this.logger.error('Error during approval escalation', error);
    }
  }
}
```

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Week 1)
**Objective:** Database schema and basic approval tracking

**Tasks:**
1. Create new database tables:
   - `purchase_order_approvals`
   - `approval_rules`
   - `approval_rule_assignments`
   - `approval_notifications`
2. Add new columns to `purchase_orders` table
3. Create database indexes
4. Write database migration scripts
5. Test schema changes in development environment

**Deliverables:**
- Migration scripts (V0.0.35__create_approval_workflow_tables.sql)
- Schema documentation
- Test data scripts for development

### Phase 2: Service Layer (Week 2)
**Objective:** Core approval workflow logic

**Tasks:**
1. Implement `ApprovalRuleEngineService`
   - Rule matching logic
   - Approval chain generation
   - Authority validation
2. Implement `ApprovalWorkflowService`
   - Workflow initiation
   - Approval processing
   - Rejection handling
   - Delegation logic
3. Implement `ApprovalNotificationService`
   - In-app notifications
   - Email integration (optional)
4. Implement `ApprovalAuditService`
   - Audit logging
   - Compliance reporting
5. Write unit tests for all services

**Deliverables:**
- Service classes with full test coverage
- Service integration tests
- API documentation

### Phase 3: GraphQL API (Week 3)
**Objective:** Expose approval functionality via GraphQL

**Tasks:**
1. Create `approval-workflow.graphql` schema
2. Implement approval resolvers:
   - Queries (getPOApprovalStatus, getMyPendingApprovals, etc.)
   - Mutations (approvePO, rejectPO, delegateApproval, etc.)
3. Update `createPurchaseOrder` mutation to initiate workflow
4. Replace old `approvePurchaseOrder` with new implementation
5. Add role-based authorization guards
6. Write integration tests for GraphQL API

**Deliverables:**
- GraphQL schema file
- Resolver implementations
- Integration test suite
- API documentation with examples

### Phase 4: Frontend Components (Week 4)
**Objective:** User interfaces for approval management

**Tasks:**
1. Create `ApprovalDashboardPage.tsx`
   - Pending approvals list
   - Filters and search
   - Bulk actions
2. Create `ApprovalDetailsModal.tsx`
   - Approval chain timeline
   - Decision interface (approve/reject/delegate)
3. Create `ApprovalHistoryTimeline.tsx` component
4. Update `PurchaseOrderDetailPage.tsx`
   - Replace simple approval button with full approval section
5. Update `PurchaseOrdersPage.tsx`
   - Add approval status columns
   - Add approval filters
6. Create GraphQL queries/mutations in frontend
7. Write component tests

**Deliverables:**
- React components
- GraphQL queries/mutations
- Component test suite
- UI/UX documentation

### Phase 5: Admin Configuration (Week 5)
**Objective:** Admin tools for managing approval rules

**Tasks:**
1. Create `ApprovalRulesConfigPage.tsx`
   - Rule list with priority ordering
   - Rule editor with conditions builder
   - Approval chain builder
2. Create `ApprovalRoleAssignmentsPage.tsx`
   - User-to-role assignments
   - Maximum approval amounts
   - Delegation management
3. Implement rule testing tool (simulate PO → see which rule applies)
4. Create default approval rules seeder script
5. Write admin user guide

**Deliverables:**
- Admin configuration pages
- Default rules seeder script
- Admin user documentation

### Phase 6: Testing & Refinement (Week 6)
**Objective:** End-to-end testing and bug fixes

**Tasks:**
1. End-to-end testing:
   - Create PO → initiate approval → approve at each level → issue PO
   - Create PO → reject → revise → resubmit → approve
   - Test delegation workflow
   - Test SLA escalation
2. Performance testing:
   - Test with high volume of pending approvals
   - Optimize slow queries
3. Security testing:
   - Test role-based authorization
   - Test cross-tenant isolation
4. User acceptance testing with stakeholders
5. Bug fixes and refinements
6. Documentation finalization

**Deliverables:**
- Test execution reports
- Performance optimization results
- Security audit report
- User acceptance sign-off
- Final documentation (user guide, admin guide, API docs)

---

## 8. Key Recommendations

### Immediate Quick Wins (MVP)

For a minimal viable product, prioritize:

1. **Two-Level Approval (Manager + Director):**
   - Simple: < $5,000 = 1 approval, >= $5,000 = 2 approvals
   - Hardcoded rules initially (no admin UI)

2. **Role-Based Authorization:**
   - Validate approver has required role in JWT token
   - Block unauthorized approval attempts

3. **Approval History Table:**
   - Basic audit trail
   - Who approved, when, at which level

4. **Rejection Capability:**
   - Add rejectPO mutation
   - Rejection reason required
   - Status change to REJECTED

5. **Approval Dashboard:**
   - Simple list of pending approvals
   - Approve/reject buttons with confirmation

**Estimated MVP Timeline:** 2-3 weeks

### Long-Term Enhancements

After MVP, consider:

1. **Dynamic Approval Rules Engine:**
   - Admin UI for configurable rules
   - Multiple conditions (amount, vendor tier, category)
   - Priority-based rule evaluation

2. **Notifications:**
   - Email notifications to approvers
   - In-app notification center
   - SLA deadline reminders

3. **Advanced Workflows:**
   - Parallel approvals (both Procurement AND Finance)
   - Conditional approvals (if vendor is new, add extra level)
   - Auto-approval for trusted scenarios

4. **Analytics & Reporting:**
   - Approval cycle time metrics
   - Approver performance dashboards
   - Bottleneck identification
   - Compliance reports (SOX, ISO, etc.)

5. **Mobile Support:**
   - Mobile-optimized approval interface
   - Push notifications for mobile app

---

## 9. Risk Assessment & Mitigation

### Technical Risks

**Risk 1: Complex approval chains slow down PO processing**
- **Mitigation:** Implement SLA tracking and auto-escalation; provide bulk approval capability; start with 2-level max

**Risk 2: Database performance degradation with approval history**
- **Mitigation:** Proper indexing on approval tables; archive old approvals; use database partitioning for large tenants

**Risk 3: Notification spam if many approvals pending**
- **Mitigation:** Digest notifications (daily summary); in-app notification preferences; notification batching

### Business Risks

**Risk 1: User resistance to additional approval steps**
- **Mitigation:** Start with high thresholds (only expensive POs require multi-level); show time savings from automation; provide mobile approval option

**Risk 2: Approval bottlenecks from absent approvers**
- **Mitigation:** Mandatory delegation setup; auto-escalation; temporary approval authority assignment

**Risk 3: Audit compliance gaps**
- **Mitigation:** Comprehensive audit trail from day 1; immutable approval records; regular compliance reports

### Security Risks

**Risk 1: Unauthorized approval via API manipulation**
- **Mitigation:** Role-based validation in resolvers; validate approver matches JWT user; validate approval authority limits

**Risk 2: Cross-tenant approval data leakage**
- **Mitigation:** Tenant validation on all queries; row-level security in database; separate approval chains per tenant

---

## 10. Success Metrics

### Key Performance Indicators (KPIs)

1. **Approval Cycle Time:**
   - Average time from PO creation to final approval
   - Target: < 24 hours for standard POs

2. **Approval SLA Compliance:**
   - Percentage of approvals completed within SLA
   - Target: > 95%

3. **Rejection Rate:**
   - Percentage of POs rejected vs. approved
   - Target: < 5% (indicates good PO quality)

4. **Approval Bottleneck Identification:**
   - Which approval levels/users have longest delays
   - Target: No single approver > 48 hour avg

5. **Audit Compliance:**
   - Percentage of POs with complete audit trail
   - Target: 100%

### User Satisfaction Metrics

1. **Approver Satisfaction:**
   - Survey rating of approval interface
   - Target: > 4/5 stars

2. **PO Creator Satisfaction:**
   - Survey rating of approval transparency
   - Target: > 4/5 stars

3. **Mobile Approval Usage:**
   - Percentage of approvals via mobile
   - Target: > 30% (indicates convenience)

---

## 11. File References for Implementation

### Database Schema
- `/print-industry-erp/backend/database/schemas/sales-materials-procurement-module.sql` (Lines 388-462: purchase_orders table)
- `/print-industry-erp/backend/database/schemas/core-multitenant-module.sql` (Lines 248-336: users table with roles)

### Backend Services
- `/print-industry-erp/backend/src/modules/procurement/procurement.module.ts` - Procurement module
- `/print-industry-erp/backend/src/modules/sales/sales.module.ts` - Sales module
- `/print-industry-erp/backend/src/graphql/resolvers/sales-materials.resolver.ts` (Lines 1360-1385: approvePurchaseOrder)

### Frontend Pages
- `/print-industry-erp/frontend/src/pages/PurchaseOrdersPage.tsx` - PO listing
- `/print-industry-erp/frontend/src/pages/CreatePurchaseOrderPage.tsx` - PO creation
- `/print-industry-erp/frontend/src/pages/PurchaseOrderDetailPage.tsx` - PO detail with approval UI

### GraphQL Schema
- `/print-industry-erp/backend/src/graphql/schema/sales-materials.graphql` - PO type definitions

### Security Utilities
- `/print-industry-erp/backend/src/common/security/tenant-validation.ts` - Multi-tenant validation helpers

---

## 12. Conclusion

The current Purchase Order system has a solid foundation for approval workflows, with database schema already containing basic approval fields and a flexible user roles system. However, it lacks the sophistication needed for enterprise-grade approval management, particularly:

- Multi-level approval chains
- Configurable approval rules and thresholds
- Role-based authorization enforcement
- Rejection and revision workflows
- Approval notifications and SLA tracking

The recommended implementation follows a phased approach, starting with an MVP focused on two-level approval with role validation, then expanding to a full-featured approval rules engine with admin configuration, notifications, and analytics.

The architecture leverages the existing NestJS/GraphQL/PostgreSQL stack, using direct SQL for complex approval queries and maintaining the schema-first GraphQL approach. The approval workflow integrates seamlessly with existing vendor performance tracking and financial systems.

**Estimated Full Implementation Timeline:** 6 weeks
**Estimated MVP Timeline:** 2-3 weeks
**Complexity:** Medium-High
**Business Value:** High (compliance, cost control, audit trail)

---

**Next Steps:**
1. Review and approve this research report
2. Prioritize MVP vs. full implementation
3. Assign backend and frontend developers
4. Create detailed technical specifications from this research
5. Begin Phase 1: Database schema implementation
