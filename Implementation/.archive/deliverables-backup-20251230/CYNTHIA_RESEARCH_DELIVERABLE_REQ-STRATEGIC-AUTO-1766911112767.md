# Sales Quote Automation - Research Deliverable
**REQ-STRATEGIC-AUTO-1766911112767**

**Research Analyst:** Cynthia (Research Expert)
**Date:** 2025-12-28
**Status:** Complete

---

## Executive Summary

The Sales Quote Automation feature is a comprehensive, enterprise-grade system that provides sophisticated quote management with automated pricing intelligence, cost calculation, and margin controls. The system is fully integrated with the broader ERP ecosystem and implements multiple layers of business logic for price discovery, BOM explosion, and approval workflows.

**Key Highlights:**
- **4 Core Services**: Quote Management, Pricing, Costing, and Pricing Rule Engine
- **Multi-source Pricing**: Customer-specific pricing → Pricing rules → List price hierarchy
- **Automated Costing**: BOM explosion with recursive depth limiting and scrap percentage handling
- **Margin Controls**: 3-tier approval workflow based on margin thresholds
- **Full GraphQL API**: 3 queries, 6 mutations with comprehensive type definitions
- **Multi-tenant Security**: Row-level security policies on all quote tables

---

## 1. Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     GraphQL API Layer                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │     QuoteAutomationResolver                          │  │
│  │  - previewQuoteLinePricing                           │  │
│  │  - createQuoteWithLines                              │  │
│  │  - addQuoteLine / updateQuoteLine / deleteLine       │  │
│  │  - recalculateQuote / validateQuoteMargin            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer (NestJS)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Quote      │  │   Quote      │  │  Pricing Rule    │  │
│  │ Management   │→ │  Pricing     │→ │     Engine       │  │
│  │   Service    │  │   Service    │  │    Service       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│         ↓                 ↓                                  │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │    Quote     │  │    Quote     │                        │
│  │   Costing    │  │   Totals     │                        │
│  │   Service    │  │ Calculation  │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Database Layer (PostgreSQL)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │    quotes    │  │ quote_lines  │  │ customer_pricing │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ pricing_rules│  │ bill_of_     │  │    products      │  │
│  │              │  │  materials   │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │    Sales     │  │    Sales     │                        │
│  │    Quote     │→ │    Quote     │                        │
│  │  Dashboard   │  │    Detail    │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **API** | GraphQL | Type-safe API with schema-first design |
| **Backend Framework** | NestJS | Dependency injection, modular architecture |
| **Database** | PostgreSQL | Relational data with JSONB support |
| **Frontend** | React + TypeScript | Type-safe UI components |
| **State Management** | Apollo Client | GraphQL client with caching |
| **UI Components** | TanStack Table | Data grid with sorting/filtering |

---

## 2. GraphQL API Specification

### Schema Location
**File:** `backend/src/graphql/schema/sales-quote-automation.graphql`

### Queries

#### 1. previewQuoteLinePricing
Preview pricing calculation without creating a quote line
```graphql
previewQuoteLinePricing(
  tenantId: ID!
  productId: ID!
  customerId: ID!
  quantity: Float!
  quoteDate: Date
): PricingCalculation!
```

**Returns:**
- Unit price, line amount
- Discount percentage and amount
- Unit cost, line cost, margin
- Applied pricing rules with details
- Price source (CUSTOMER_PRICING, PRICING_RULE, LIST_PRICE, MANUAL_OVERRIDE)

**Use Case:** "What-if" analysis for sales reps before adding quote line

#### 2. previewProductCost
Preview cost calculation for a product
```graphql
previewProductCost(
  tenantId: ID!
  productId: ID!
  quantity: Float!
): CostCalculation!
```

**Returns:**
- Total cost breakdown (material, labor, overhead, setup)
- Unit cost and total cost
- Cost method used (STANDARD_COST, BOM_EXPLOSION, FIFO, LIFO, AVERAGE)
- Detailed cost component list with scrap percentages

**Use Case:** Cost estimation for custom manufacturing scenarios

#### 3. testPricingRule
Test pricing rule evaluation (admin tool)
```graphql
testPricingRule(
  ruleId: ID!
  productId: ID
  customerId: ID
  quantity: Float
  basePrice: Float!
): JSON!
```

**Use Case:** Admin UI for testing and debugging pricing rules

### Mutations

#### 1. createQuoteWithLines
Create a complete quote with multiple lines in one transaction
```graphql
createQuoteWithLines(input: CreateQuoteWithLinesInput!): Quote!
```

**Input Fields:**
- Quote header (customer, dates, currency, sales rep, contact info)
- Array of quote lines with product, quantity, optional manual price
- Notes and terms & conditions

**Business Logic:**
1. Creates quote header with DRAFT status
2. Generates quote number (QT-YYYY-NNNNNN format)
3. Adds all quote lines with automated pricing/costing
4. Calculates quote totals
5. Returns complete quote with lines

**Use Case:** Bulk quote creation from external systems or UI forms

#### 2. addQuoteLine
Add a single line to existing quote
```graphql
addQuoteLine(input: AddQuoteLineInput!): QuoteLine!
```

**Automated Processes:**
1. Gets next line number
2. Looks up product details
3. Calculates pricing using pricing hierarchy
4. Calculates cost using BOM explosion or standard cost
5. Computes margin
6. Recalculates quote totals
7. Returns complete quote line with all financial fields

**Supports:** Manual price override for sales flexibility

#### 3. updateQuoteLine
Update quote line and recalculate
```graphql
updateQuoteLine(input: UpdateQuoteLineInput!): QuoteLine!
```

**Recalculation Triggers:**
- Quantity change → recalculate price (may trigger different pricing rules/breaks)
- Manual price override → recalculate margin only
- No change → no recalculation

**Use Case:** Quote revision and negotiation

#### 4. deleteQuoteLine
Remove line and recalculate quote totals
```graphql
deleteQuoteLine(quoteLineId: ID!): Boolean!
```

**Side Effects:**
- Deletes quote line
- Recalculates quote subtotal, discount, margin, total
- Does NOT renumber remaining lines (preserves line_number)

#### 5. recalculateQuote
Force recalculation of all pricing and costs
```graphql
recalculateQuote(
  quoteId: ID!
  recalculateCosts: Boolean = true
  recalculatePricing: Boolean = true
): Quote!
```

**Use Cases:**
- Pricing rule changes
- Product cost changes
- Currency exchange rate updates
- Periodic quote refresh

#### 6. validateQuoteMargin
Validate margin requirements
```graphql
validateQuoteMargin(quoteId: ID!): MarginValidation!
```

**Returns:**
- isValid (margin >= 15%)
- requiresApproval
- approvalLevel (SALES_MANAGER, SALES_VP, CFO)
- minimumMarginPercentage (15%)
- actualMarginPercentage

---

## 3. Backend Service Architecture

### 3.1 QuoteManagementService
**File:** `backend/src/modules/sales/services/quote-management.service.ts` (733 lines)

**Responsibilities:**
- Quote header CRUD operations
- Quote line management
- Quote number generation
- Quote totals recalculation orchestration
- Margin validation

**Key Business Rules:**
```typescript
MINIMUM_MARGIN_PERCENTAGE = 15%    // Reject quotes below this
MANAGER_APPROVAL_THRESHOLD = 20%   // 15-20% requires manager
VP_APPROVAL_THRESHOLD = 10%        // 10-15% requires VP
                                   // < 10% requires CFO (implied)
```

**Key Methods:**

| Method | Purpose | Complexity |
|--------|---------|-----------|
| `createQuote()` | Create quote header | Low - simple insert |
| `addQuoteLine()` | Add line with pricing/costing | **High** - orchestrates pricing service |
| `updateQuoteLine()` | Update line and recalculate | **High** - conditional recalculation |
| `deleteQuoteLine()` | Remove line and update totals | Medium - transaction with totals update |
| `recalculateQuote()` | Force full recalculation | **High** - loops all lines |
| `validateMargin()` | Check approval requirements | Low - threshold comparison |
| `generateQuoteNumber()` | Create unique quote number | Medium - sequence logic |

**Quote Number Format:** `QT-2025-000001` (increments within year)

**Transaction Safety:**
- All write operations use PostgreSQL transactions
- ROLLBACK on error
- Connection pooling with proper cleanup

### 3.2 QuotePricingService
**File:** `backend/src/modules/sales/services/quote-pricing.service.ts` (377 lines)

**Responsibilities:**
- Calculate quote line pricing
- Apply pricing rules via PricingRuleEngine
- Handle customer-specific pricing with quantity breaks
- Calculate quote totals from lines
- Support manual price overrides

**Pricing Hierarchy (priority order):**
```
1. Manual Price Override (if provided)
   ↓
2. Customer-Specific Pricing (customer_pricing table)
   - Check effective dates
   - Apply quantity breaks (highest applicable break)
   ↓
3. Pricing Rules (pricing_rules table)
   - Evaluate conditions (JSONB matching)
   - Sort by priority
   - Apply top 10 matching rules cumulatively
   ↓
4. List Price (products.list_price)
   - Fallback if nothing else matches
```

**Customer Pricing Quantity Breaks:**
```typescript
interface PriceBreak {
  minimumQuantity: number;
  unitPrice: number;
}

// Example:
// Base price: $10.00 (minimum 100 units)
// Price breaks:
//   [{ minimumQuantity: 500, unitPrice: 9.50 },
//    { minimumQuantity: 1000, unitPrice: 9.00 }]
//
// Qty 100-499:  $10.00
// Qty 500-999:  $9.50
// Qty 1000+:    $9.00
```

**Key Methods:**

| Method | Purpose | Data Sources |
|--------|---------|--------------|
| `calculateQuoteLinePricing()` | Full pricing calculation | products, customer_pricing, pricing_rules |
| `getBasePrice()` | Get starting price | customer_pricing OR products.list_price |
| `getCustomerPricing()` | Query customer rates | customer_pricing (with date filtering) |
| `calculateQuoteTotals()` | Sum all line totals | quote_lines (aggregation query) |
| `applyManualPriceOverride()` | Override calculated price | In-memory calculation |

**Price Source Tracking:**
Every pricing calculation returns the source:
- `CUSTOMER_PRICING`: Found in customer_pricing table
- `PRICING_RULE`: Applied via pricing rules engine
- `LIST_PRICE`: Used product list price
- `MANUAL_OVERRIDE`: Sales rep override

### 3.3 QuoteCostingService
**File:** `backend/src/modules/sales/services/quote-costing.service.ts` (433 lines)

**Responsibilities:**
- Calculate product costs using BOM explosion
- Support multiple costing methods (FIFO, LIFO, AVERAGE, STANDARD)
- Handle scrap percentages in BOM
- Amortize setup costs across quantity
- Prevent infinite BOM loops with depth limiting

**Costing Methods:**

| Method | Source | Use Case |
|--------|--------|----------|
| `STANDARD_COST` | products.standard_total_cost | Fastest - pre-calculated cost |
| `BOM_EXPLOSION` | Recursive BOM traversal | Detailed cost breakdown needed |
| `FIFO` | Inventory transactions (future) | First-in-first-out |
| `LIFO` | Inventory transactions (future) | Last-in-first-out |
| `AVERAGE` | materials.average_cost | Rolling average cost |

**BOM Explosion Algorithm:**
```typescript
MAX_BOM_DEPTH = 5  // Prevent infinite loops

async explodeBOM(productId, quantity, depth = 1) {
  if (depth > MAX_BOM_DEPTH) return;

  // Get BOM components for this product
  components = await db.query(`
    SELECT * FROM bill_of_materials
    WHERE parent_product_id = $1
  `);

  for (component of components) {
    // Apply scrap percentage
    scrapMultiplier = 1 + (component.scrap_percentage / 100);
    requiredQty = component.qty_per_parent * quantity * scrapMultiplier;

    // Get material cost
    cost = await getMaterialCost(component.material_id, requiredQty);

    // Accumulate in materialRequirements map

    // Check if this component has its own BOM (nested)
    if (hasNestedBOM(component.material_id)) {
      await explodeBOM(component.material_id, requiredQty, depth + 1);
    }
  }
}
```

**Cost Components:**
```typescript
interface CostCalculationResult {
  unitCost: number;           // Total cost per unit
  totalCost: number;          // Total for quantity
  materialCost: number;       // From BOM explosion
  laborCost: number;          // Standard labor rate
  overheadCost: number;       // Standard overhead allocation
  setupCost: number;          // Fixed setup cost
  setupCostPerUnit: number;   // Setup cost / quantity
  costMethod: CostMethod;
  costBreakdown: CostComponent[];  // Detailed breakdown
}
```

**Setup Cost Calculation:**
```typescript
setupTimeHours = product.standard_production_time_hours || 1
setupLaborRate = 50  // Configurable
fixedSetupCost = setupTimeHours * setupLaborRate
setupCostPerUnit = fixedSetupCost / quantity

// Higher quantities = lower setup cost per unit
// Qty 10:   $50 / 10 = $5.00 per unit
// Qty 100:  $50 / 100 = $0.50 per unit
// Qty 1000: $50 / 1000 = $0.05 per unit
```

### 3.4 PricingRuleEngineService
**File:** `backend/src/modules/sales/services/pricing-rule-engine.service.ts` (352 lines)

**Responsibilities:**
- Fetch active pricing rules for evaluation period
- Evaluate JSONB conditions against context
- Apply pricing actions in priority order
- Track applied rules for audit trail

**Rule Types Supported:**
- `VOLUME_DISCOUNT`: Quantity-based discounts
- `CUSTOMER_TIER`: Tier-based pricing (PLATINUM, GOLD, SILVER)
- `PRODUCT_CATEGORY`: Category-specific rules
- `SEASONAL`: Time-based pricing
- `PROMOTIONAL`: Temporary promotions
- `CLEARANCE`: Inventory clearance pricing
- `CONTRACT_PRICING`: Contract-based rates

**Pricing Actions:**

| Action | Effect | Example |
|--------|--------|---------|
| `PERCENTAGE_DISCOUNT` | % off current price | 10% → $100 becomes $90 |
| `FIXED_DISCOUNT` | $ amount discount | $5 → $100 becomes $95 |
| `FIXED_PRICE` | Override with fixed price | $85 → price becomes $85 |
| `MARKUP_PERCENTAGE` | % markup on base price | 5% → $100 becomes $105 |

**Condition Matching (JSONB):**
```json
{
  "customerTier": "PLATINUM",
  "minimumQuantity": 1000,
  "productCategory": "LABELS",
  "startDate": "2025-01-01",
  "endDate": "2025-03-31"
}
```

**Evaluation Logic:**
1. Fetch all active rules for tenant and date range
2. Filter rules by condition matching (JSONB evaluation)
3. Sort by priority (lower number = higher priority)
4. Apply top 10 matching rules **cumulatively**
5. Track each applied rule with discount amount

**Example Multi-Rule Application:**
```
Base Price:        $100.00
Rule 1 (Priority 1): Volume Discount 10%  → $90.00  (saved $10.00)
Rule 2 (Priority 5): Customer Tier 5%     → $85.50  (saved $4.50)
Rule 3 (Priority 10): Promotional 2%      → $83.79  (saved $1.71)
Final Price:       $83.79
Total Discount:    $16.21 (16.21%)
Applied Rules:     [Rule 1, Rule 2, Rule 3]
```

**Admin Testing:**
`testRuleEvaluation()` allows admins to test rules with sample input before activation

---

## 4. Database Schema

### 4.1 Core Tables

#### quotes
**Primary quote header table**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key (uuid_generate_v7) |
| `tenant_id` | UUID | Multi-tenant isolation |
| `facility_id` | UUID | Facility assignment (optional) |
| `quote_number` | VARCHAR(50) UNIQUE | QT-YYYY-NNNNNN |
| `quote_date` | DATE | Quote creation date |
| `expiration_date` | DATE | Quote expiration |
| `customer_id` | UUID | Customer reference |
| `contact_name` | VARCHAR(255) | Customer contact |
| `contact_email` | VARCHAR(255) | Contact email |
| `sales_rep_user_id` | UUID | Assigned sales rep |
| `quote_currency_code` | VARCHAR(3) | ISO currency (USD, EUR, etc.) |
| `subtotal` | DECIMAL(18,4) | Sum of line amounts |
| `tax_amount` | DECIMAL(18,4) | Calculated tax |
| `shipping_amount` | DECIMAL(18,4) | Shipping cost |
| `discount_amount` | DECIMAL(18,4) | Total discount |
| `total_amount` | DECIMAL(18,4) | Grand total |
| `total_cost` | DECIMAL(18,4) | Total cost (for margin) |
| `margin_amount` | DECIMAL(18,4) | total_amount - total_cost |
| `margin_percentage` | DECIMAL(8,4) | (margin / total) * 100 |
| `status` | VARCHAR(20) | Quote status enum |
| `converted_to_sales_order_id` | UUID | Conversion tracking |
| `converted_at` | TIMESTAMPTZ | Conversion timestamp |
| `notes` | TEXT | Internal notes |
| `terms_and_conditions` | TEXT | Quote T&C |
| `created_at`, `created_by` | Audit fields | Audit trail |
| `updated_at`, `updated_by` | Audit fields | Audit trail |

**Quote Status Values:**
- `DRAFT`: Work in progress
- `ISSUED`: Sent to customer
- `ACCEPTED`: Customer accepted
- `REJECTED`: Customer rejected
- `EXPIRED`: Past expiration date
- `CONVERTED_TO_ORDER`: Converted to sales order

**Indexes:**
```sql
CREATE INDEX idx_quotes_tenant ON quotes(tenant_id);
CREATE INDEX idx_quotes_customer ON quotes(customer_id);
CREATE INDEX idx_quotes_date ON quotes(quote_date);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_sales_rep ON quotes(sales_rep_user_id);
```

#### quote_lines
**Quote line items with pricing and costing**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Multi-tenant isolation |
| `quote_id` | UUID | Parent quote reference |
| `line_number` | INTEGER | Line sequence |
| `product_id` | UUID | Product reference |
| `product_code` | VARCHAR(100) | Product code (denormalized) |
| `description` | TEXT | Line description |
| `quantity_quoted` | DECIMAL(18,4) | Order quantity |
| `unit_of_measure` | VARCHAR(20) | UOM (EA, LB, FT, etc.) |
| `unit_price` | DECIMAL(18,4) | Calculated or manual price |
| `line_amount` | DECIMAL(18,4) | quantity * unit_price |
| `discount_percentage` | DECIMAL(8,4) | Discount % applied |
| `discount_amount` | DECIMAL(18,4) | Discount $ amount |
| `unit_cost` | DECIMAL(18,4) | Calculated cost per unit |
| `line_cost` | DECIMAL(18,4) | Total cost for line |
| `line_margin` | DECIMAL(18,4) | line_amount - line_cost |
| `margin_percentage` | DECIMAL(8,4) | (margin / line_amount) * 100 |
| `manufacturing_strategy` | VARCHAR(50) | MTO, MTS, ETO, etc. |
| `lead_time_days` | INTEGER | Production lead time |
| `promised_delivery_date` | DATE | Delivery promise |
| `created_at`, `updated_at` | Audit fields | Audit trail |

**Indexes:**
```sql
CREATE INDEX idx_quote_lines_tenant ON quote_lines(tenant_id);
CREATE INDEX idx_quote_lines_quote ON quote_lines(quote_id);
CREATE INDEX idx_quote_lines_product ON quote_lines(product_id);
```

**Constraints:**
```sql
CONSTRAINT fk_quote_lines_quote FOREIGN KEY (quote_id) REFERENCES quotes(id)
CONSTRAINT fk_quote_lines_product FOREIGN KEY (product_id) REFERENCES products(id)
```

#### pricing_rules
**Flexible pricing rule engine**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Multi-tenant isolation |
| `rule_code` | VARCHAR(50) | Unique rule identifier |
| `rule_name` | VARCHAR(255) | Human-readable name |
| `description` | TEXT | Rule description |
| `rule_type` | VARCHAR(50) | VOLUME_DISCOUNT, CUSTOMER_TIER, etc. |
| `priority` | INTEGER | Lower = higher priority (default 10) |
| `conditions` | JSONB | Flexible condition matching |
| `pricing_action` | VARCHAR(50) | Action type |
| `action_value` | DECIMAL(18,4) | Discount/markup value |
| `effective_from` | DATE | Rule start date |
| `effective_to` | DATE | Rule end date (nullable) |
| `is_active` | BOOLEAN | Enable/disable flag |
| `created_at`, `created_by` | Audit fields | Audit trail |
| `updated_at`, `updated_by` | Audit fields | Audit trail |

**Conditions JSONB Schema:**
```typescript
interface PricingRuleConditions {
  // Product conditions
  productId?: string;
  productCategory?: string;

  // Customer conditions
  customerId?: string;
  customerTier?: string;  // PLATINUM, GOLD, SILVER, BRONZE
  customerType?: string;  // WHOLESALE, RETAIL, DISTRIBUTOR

  // Quantity conditions
  minimumQuantity?: number;
  maximumQuantity?: number;

  // Date conditions (for seasonal rules)
  startDate?: string;  // ISO date
  endDate?: string;    // ISO date
}
```

**Example Rules:**

```sql
-- Volume discount for all products
INSERT INTO pricing_rules VALUES (
  uuid_generate_v7(),
  'tenant-1',
  'VOLUME-1000',
  'Volume Discount 1000+ units',
  'Apply 10% discount for orders over 1000 units',
  'VOLUME_DISCOUNT',
  5,  -- priority
  '{"minimumQuantity": 1000}',
  'PERCENTAGE_DISCOUNT',
  10.00,
  '2025-01-01',
  NULL,
  true
);

-- Platinum customer tier discount
INSERT INTO pricing_rules VALUES (
  uuid_generate_v7(),
  'tenant-1',
  'PLATINUM-TIER',
  'Platinum Customer Discount',
  'Apply 5% discount for platinum tier customers',
  'CUSTOMER_TIER',
  10,  -- lower priority than volume
  '{"customerTier": "PLATINUM"}',
  'PERCENTAGE_DISCOUNT',
  5.00,
  '2025-01-01',
  '2025-12-31',
  true
);
```

**Indexes:**
```sql
CREATE INDEX idx_pricing_rules_tenant ON pricing_rules(tenant_id);
CREATE INDEX idx_pricing_rules_type ON pricing_rules(rule_type);
CREATE INDEX idx_pricing_rules_priority ON pricing_rules(priority);
CREATE INDEX idx_pricing_rules_dates ON pricing_rules(effective_from, effective_to);
CREATE INDEX idx_pricing_rules_active ON pricing_rules(is_active);
```

#### customer_pricing
**Customer-specific pricing agreements**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Multi-tenant isolation |
| `customer_id` | UUID | Customer reference |
| `product_id` | UUID | Product reference |
| `unit_price` | DECIMAL(18,4) | Base price for this customer |
| `price_currency_code` | VARCHAR(3) | ISO currency |
| `price_uom` | VARCHAR(20) | Unit of measure |
| `minimum_quantity` | DECIMAL(18,4) | Minimum order quantity |
| `price_breaks` | JSONB | Quantity break array |
| `effective_from` | DATE | Agreement start date |
| `effective_to` | DATE | Agreement end date (nullable) |
| `is_active` | BOOLEAN | Enable/disable flag |
| `created_at`, `created_by` | Audit fields | Audit trail |
| `updated_at`, `updated_by` | Audit fields | Audit trail |

**Price Breaks JSONB Schema:**
```typescript
interface PriceBreak {
  minimumQuantity: number;
  unitPrice: number;
}

// Example:
[
  { "minimumQuantity": 100, "unitPrice": 10.00 },
  { "minimumQuantity": 500, "unitPrice": 9.50 },
  { "minimumQuantity": 1000, "unitPrice": 9.00 }
]
```

**Indexes:**
```sql
CREATE INDEX idx_customer_pricing_tenant ON customer_pricing(tenant_id);
CREATE INDEX idx_customer_pricing_customer ON customer_pricing(customer_id);
CREATE INDEX idx_customer_pricing_product ON customer_pricing(product_id);
CREATE INDEX idx_customer_pricing_dates ON customer_pricing(effective_from, effective_to);
```

### 4.2 Row Level Security (RLS)

**Migration:** `V0.0.36__add_rls_policies_sales_quote_automation.sql`

**Policies Applied:**
```sql
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY quotes_tenant_isolation ON quotes
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY quote_lines_tenant_isolation ON quote_lines
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY pricing_rules_tenant_isolation ON pricing_rules
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY customer_pricing_tenant_isolation ON customer_pricing
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

**Security Benefits:**
- Automatic multi-tenant isolation at database level
- No tenant_id filtering needed in application code
- Prevents cross-tenant data leakage
- Session-based tenant context

---

## 5. Frontend Implementation

### 5.1 SalesQuoteDashboard
**File:** `frontend/src/pages/SalesQuoteDashboard.tsx`

**Features:**

1. **KPI Cards**
   - Total quotes
   - Draft/Issued/Accepted counts
   - Total quote value
   - Average margin percentage
   - Quote conversion rate (accepted / issued)

2. **Filtering**
   - Status filter (dropdown)
   - Date range filter (from/to)
   - Real-time filter application

3. **Data Table**
   - Quote number (clickable → detail page)
   - Customer name
   - Quote date
   - Expiration date
   - Status badge (color-coded)
   - Total amount (formatted currency)
   - Margin percentage (color: red < 15%, green >= 15%)
   - Sales rep name

4. **Actions**
   - Refresh button
   - Create new quote button
   - Facility selector integration

**Status Badge Colors:**
```typescript
DRAFT: gray
ISSUED: blue
ACCEPTED: green
REJECTED: red
EXPIRED: yellow
CONVERTED_TO_ORDER: purple
```

### 5.2 SalesQuoteDetailPage
**File:** `frontend/src/pages/SalesQuoteDetailPage.tsx`

**Sections:**

1. **Quote Header**
   - Quote number, date, expiration
   - Customer info
   - Sales rep
   - Status
   - Financial summary (subtotal, tax, shipping, total, margin)

2. **Quote Lines Table**
   - Product code and description
   - Quantity and UOM
   - Unit price and line amount
   - Discount percentage and amount
   - Unit cost, line cost, margin
   - Manufacturing strategy
   - Lead time and delivery date
   - Actions: Edit, Delete

3. **Add Line Form**
   - Product selector (dropdown or autocomplete)
   - Quantity input
   - Manual price override toggle
   - Add button → calls `addQuoteLine` mutation

4. **Quote Actions**
   - Update status dropdown
   - Recalculate button
   - Validate margin button
   - Convert to sales order button

### 5.3 GraphQL Queries/Mutations
**File:** `frontend/src/graphql/queries/salesQuoteAutomation.ts`

**Implemented Operations:**
- `GET_QUOTES`: List all quotes with filters
- `GET_QUOTE`: Get single quote with lines
- `PREVIEW_QUOTE_LINE_PRICING`: Preview pricing calculation
- `PREVIEW_PRODUCT_COST`: Preview cost calculation
- `CREATE_QUOTE_WITH_LINES`: Batch quote creation
- `ADD_QUOTE_LINE`: Add single line
- `UPDATE_QUOTE_LINE`: Update line
- `DELETE_QUOTE_LINE`: Remove line
- `RECALCULATE_QUOTE`: Force recalculation
- `VALIDATE_QUOTE_MARGIN`: Check margin approval
- `UPDATE_QUOTE_STATUS`: Change quote status
- `CONVERT_QUOTE_TO_SALES_ORDER`: Convert to order

---

## 6. Integration Points

### 6.1 Materials Module
**Integration Type:** Database foreign keys + service dependencies

**Connections:**
- `quote_lines.product_id` → `products.id`
- BOM explosion queries `bill_of_materials` table
- Material costs from `materials` table
- Product standard costs from `products` table

**Data Flow:**
```
Quote Line → Product → BOM Components → Materials → Costs
```

**Costing Methods Supported:**
- STANDARD: `products.standard_total_cost`
- BOM_EXPLOSION: Recursive BOM traversal
- FIFO/LIFO: Inventory transaction costing (future)
- AVERAGE: `materials.average_cost`

### 6.2 Customers Module
**Integration Type:** Database foreign keys + pricing context

**Connections:**
- `quotes.customer_id` → `customers.id`
- `customer_pricing` table for customer-specific rates
- Customer tier used in pricing rules (`customers.pricing_tier`)
- Customer type used in pricing rules (`customers.customer_type`)

**Data Flow:**
```
Quote → Customer → Pricing Tier → Pricing Rules
                 → Customer Pricing → Quantity Breaks
```

### 6.3 Products/Categories Module
**Integration Type:** Database foreign keys + pricing context

**Connections:**
- `quote_lines.product_id` → `products.id`
- `products.product_category` used in pricing rules
- `products.list_price` as pricing fallback
- `products.standard_*_cost` for costing

### 6.4 Manufacturing Module
**Integration Type:** Metadata only

**Connections:**
- `quote_lines.manufacturing_strategy` (MTO, MTS, ETO)
- `quote_lines.lead_time_days` for delivery promises
- `products.standard_production_time_hours` for setup cost

**No Direct Foreign Keys** - Informational only

### 6.5 Finance/GL Module
**Integration Type:** Metadata + future integration

**Connections:**
- `quotes.quote_currency_code` for multi-currency
- Tax calculation (placeholder for future tax engine)
- Margin tracking for financial reporting
- Cost tracking for COGS analysis

### 6.6 Sales Orders Module
**Integration Type:** Quote conversion

**Connections:**
- `quotes.converted_to_sales_order_id` → `sales_orders.id`
- `quotes.converted_at` timestamp
- Status transition: ACCEPTED → CONVERTED_TO_ORDER

**Conversion Process:**
1. Create sales order header from quote
2. Copy quote lines to sales order lines
3. Set `converted_to_sales_order_id`
4. Update quote status to `CONVERTED_TO_ORDER`

---

## 7. Business Logic Deep Dive

### 7.1 Pricing Calculation Workflow

**Step-by-Step Process:**

```
Input: productId, customerId, quantity, quoteDate

Step 1: Get Base Price
  ├─ Query customer_pricing table
  │  WHERE customer_id = ? AND product_id = ?
  │    AND quoteDate BETWEEN effective_from AND effective_to
  │    AND is_active = true
  │  ├─ If found:
  │  │  ├─ Check minimum_quantity
  │  │  ├─ Apply highest matching price_break
  │  │  └─ Return: basePrice, priceSource = CUSTOMER_PRICING
  │  └─ If not found:
  │     ├─ Query products.list_price
  │     └─ Return: basePrice, priceSource = LIST_PRICE

Step 2: Get Customer/Product Context
  ├─ Query customers table for pricing_tier, customer_type
  └─ Query products table for product_category

Step 3: Evaluate Pricing Rules
  ├─ Query pricing_rules table
  │  WHERE tenant_id = ? AND is_active = true
  │    AND quoteDate BETWEEN effective_from AND effective_to
  │  ORDER BY priority ASC
  │  LIMIT 100
  ├─ Filter rules by condition matching:
  │  ├─ Match productId (if condition has productId)
  │  ├─ Match productCategory
  │  ├─ Match customerId
  │  ├─ Match customerTier
  │  ├─ Match customerType
  │  ├─ Match quantity range (min/max)
  │  └─ Match date range (seasonal rules)
  ├─ Sort matching rules by priority
  ├─ Apply top 10 rules cumulatively:
  │  ├─ Rule 1: basePrice → price1
  │  ├─ Rule 2: price1 → price2
  │  ├─ Rule 3: price2 → price3
  │  └─ ...
  └─ Track applied rules with discount amounts

Step 4: Calculate Cost
  ├─ Check if product has standard_total_cost
  │  ├─ If yes: use STANDARD_COST method
  │  │  ├─ material_cost = standard_material_cost
  │  │  ├─ labor_cost = standard_labor_cost
  │  │  └─ overhead_cost = standard_overhead_cost
  │  └─ If no: use BOM_EXPLOSION method
  │     ├─ Explode BOM recursively (max depth 5)
  │     ├─ Accumulate material requirements with scrap
  │     ├─ Query material costs by costing_method
  │     └─ Sum material costs + labor + overhead
  ├─ Calculate setup cost:
  │  ├─ setupHours = product.standard_production_time_hours || 1
  │  ├─ fixedSetupCost = setupHours * laborRate (50)
  │  └─ setupCostPerUnit = fixedSetupCost / quantity
  └─ Return: unitCost, totalCost, costBreakdown

Step 5: Calculate Margin
  ├─ lineAmount = finalUnitPrice * quantity
  ├─ lineCost = unitCost * quantity
  ├─ lineMargin = lineAmount - lineCost
  └─ marginPercentage = (lineMargin / lineAmount) * 100

Output: PricingCalculationResult {
  unitPrice: finalUnitPrice,
  lineAmount,
  discountPercentage,
  discountAmount,
  unitCost,
  lineCost,
  lineMargin,
  marginPercentage,
  appliedRules: [array of rules],
  priceSource: CUSTOMER_PRICING | PRICING_RULE | LIST_PRICE | MANUAL_OVERRIDE
}
```

### 7.2 BOM Explosion Algorithm

**Purpose:** Calculate material costs by recursively expanding bill of materials

**Algorithm:**
```typescript
interface MaterialRequirement {
  materialId: string;
  materialCode: string;
  totalQuantity: number;  // Accumulated across all BOM levels
  unitCost: number;
  totalCost: number;
}

async function explodeBOM(
  productId: string,
  quantity: number,
  currentDepth: number = 1,
  maxDepth: number = 5,
  materialRequirements: Map<string, MaterialRequirement>
): Promise<void> {

  // Safety check: prevent infinite loops
  if (currentDepth > maxDepth) {
    return;
  }

  // Get BOM components for this product
  const components = await db.query(`
    SELECT
      bom.component_material_id,
      bom.quantity_per_parent,
      bom.scrap_percentage,
      m.material_code,
      m.material_name,
      m.standard_cost,
      m.costing_method
    FROM bill_of_materials bom
    JOIN materials m ON m.id = bom.component_material_id
    WHERE bom.parent_product_id = $1
      AND bom.is_active = true
    ORDER BY bom.sequence_number
  `, [productId]);

  // Process each component
  for (const component of components) {
    // Apply scrap percentage
    const scrapMultiplier = 1 + (component.scrap_percentage / 100);
    const quantityWithScrap = component.quantity_per_parent * quantity * scrapMultiplier;

    // Get material cost
    const materialCost = await getMaterialCost(
      component.component_material_id,
      quantityWithScrap,
      component.costing_method
    );

    // Accumulate in map (sum if already exists)
    const existing = materialRequirements.get(component.component_material_id);
    if (existing) {
      existing.totalQuantity += quantityWithScrap;
      existing.totalCost += materialCost.totalCost;
    } else {
      materialRequirements.set(component.component_material_id, {
        materialId: component.component_material_id,
        materialCode: component.material_code,
        totalQuantity: quantityWithScrap,
        unitCost: materialCost.unitCost,
        totalCost: materialCost.totalCost,
        costingMethod: component.costing_method
      });
    }

    // Check for nested BOM (this material is also a product)
    const hasNestedBOM = await db.query(`
      SELECT COUNT(*) as count
      FROM bill_of_materials
      WHERE parent_product_id = $1 AND is_active = true
    `, [component.component_material_id]);

    if (hasNestedBOM.rows[0].count > 0) {
      // Recursive call with incremented depth
      await explodeBOM(
        component.component_material_id,
        quantityWithScrap,
        currentDepth + 1,
        maxDepth,
        materialRequirements
      );
    }
  }
}
```

**Example BOM Explosion:**

```
Product: Custom Label (qty 1000)
├─ Level 1: Direct components
│  ├─ Paper Stock: 1.1 lbs (qty 1000, scrap 10%) = 1,100 lbs
│  ├─ Ink: 0.05 lbs (qty 1000, scrap 5%) = 52.5 lbs
│  └─ Adhesive: 0.02 lbs (qty 1000, scrap 0%) = 20 lbs
│
└─ Level 2: Nested BOM (if Ink is also a product)
   ├─ Pigment: 0.7 lbs per lb of ink (qty 52.5) = 36.75 lbs
   └─ Solvent: 0.3 lbs per lb of ink (qty 52.5) = 15.75 lbs

Material Requirements (flattened):
- Paper Stock: 1,100 lbs @ $2.00/lb = $2,200.00
- Pigment:       36.75 lbs @ $15.00/lb = $551.25
- Solvent:       15.75 lbs @ $5.00/lb = $78.75
- Adhesive:      20 lbs @ $10.00/lb = $200.00
Total Material Cost: $3,030.00
```

### 7.3 Margin Validation Workflow

**Business Rules:**
```typescript
const MINIMUM_MARGIN_PERCENTAGE = 15;    // Absolute minimum
const MANAGER_APPROVAL_THRESHOLD = 20;   // Manager approval required
const VP_APPROVAL_THRESHOLD = 10;        // VP approval required
// < 10% implicitly requires CFO approval
```

**Validation Logic:**
```typescript
function validateMargin(marginPercentage: number): MarginValidationResult {
  const isValid = marginPercentage >= MINIMUM_MARGIN_PERCENTAGE;
  const requiresApproval = marginPercentage < MANAGER_APPROVAL_THRESHOLD;

  let approvalLevel: ApprovalLevel | null = null;

  if (marginPercentage < VP_APPROVAL_THRESHOLD) {
    approvalLevel = ApprovalLevel.SALES_VP;
    // If < 10%, should escalate to CFO (not implemented yet)
  } else if (marginPercentage < MANAGER_APPROVAL_THRESHOLD) {
    approvalLevel = ApprovalLevel.SALES_MANAGER;
  }
  // If >= 20%, no approval needed (sales rep can approve)

  return {
    isValid,
    minimumMarginPercentage: MINIMUM_MARGIN_PERCENTAGE,
    actualMarginPercentage: marginPercentage,
    requiresApproval,
    approvalLevel
  };
}
```

**Approval Matrix:**

| Margin % | Valid | Approval Required | Approval Level |
|----------|-------|-------------------|----------------|
| < 10% | ❌ No | ✅ Yes | SALES_VP (or CFO) |
| 10-15% | ❌ No | ✅ Yes | SALES_VP |
| 15-20% | ✅ Yes | ✅ Yes | SALES_MANAGER |
| >= 20% | ✅ Yes | ❌ No | SALES_REP |

**Example Scenarios:**

```
Scenario 1: High Margin Quote
  Quote Amount: $10,000
  Quote Cost:   $7,000
  Margin:       $3,000 (30%)
  ✅ Valid, no approval required

Scenario 2: Requires Manager Approval
  Quote Amount: $10,000
  Quote Cost:   $8,300
  Margin:       $1,700 (17%)
  ✅ Valid, but requires SALES_MANAGER approval

Scenario 3: Requires VP Approval
  Quote Amount: $10,000
  Quote Cost:   $8,800
  Margin:       $1,200 (12%)
  ❌ Below minimum (15%), requires SALES_VP approval

Scenario 4: Requires CFO Approval
  Quote Amount: $10,000
  Quote Cost:   $9,100
  Margin:       $900 (9%)
  ❌ Below minimum, requires CFO approval (implied)
```

---

## 8. Data Model Relationships

### Entity Relationship Diagram

```
┌─────────────┐
│   tenants   │
└──────┬──────┘
       │
       ├────────────────────────────────────┐
       │                                    │
       │                                    │
┌──────▼──────┐                      ┌──────▼──────┐
│  customers  │                      │  products   │
└──────┬──────┘                      └──────┬──────┘
       │                                    │
       │                                    │
       │                    ┌───────────────┴──────────┐
       │                    │                          │
       │             ┌──────▼──────┐        ┌─────────▼────────┐
       │             │  materials  │        │ bill_of_materials│
       │             └─────────────┘        └──────────────────┘
       │
       │
┌──────▼──────────┐
│customer_pricing │
└─────────────────┘
       │
       │
┌──────▼──────┐
│   quotes    │◄────────────┐
└──────┬──────┘             │
       │                    │
       │              ┌─────┴──────┐
       │              │pricing_rules│
       │              └────────────┘
       │
┌──────▼──────┐
│ quote_lines │
└─────────────┘
```

### Foreign Key Relationships

```sql
-- Quote to Customer
quotes.customer_id → customers.id

-- Quote to Sales Rep
quotes.sales_rep_user_id → users.id

-- Quote to Tenant
quotes.tenant_id → tenants.id

-- Quote Line to Quote
quote_lines.quote_id → quotes.id

-- Quote Line to Product
quote_lines.product_id → products.id

-- Customer Pricing to Customer
customer_pricing.customer_id → customers.id

-- Customer Pricing to Product
customer_pricing.product_id → products.id

-- BOM to Product (parent)
bill_of_materials.parent_product_id → products.id

-- BOM to Material (component)
bill_of_materials.component_material_id → materials.id
```

---

## 9. Performance Considerations

### 9.1 Query Optimization

**Indexed Queries:**
- All foreign key columns are indexed
- Date range queries use indexes on `effective_from`, `effective_to`
- Status filters use index on `quotes.status`
- Tenant isolation uses index on `tenant_id` (all tables)

**Aggregate Queries:**
```sql
-- Quote totals calculation (optimized)
SELECT
  COALESCE(SUM(line_amount), 0) as subtotal,
  COALESCE(SUM(discount_amount), 0) as discount_amount,
  COALESCE(SUM(line_cost), 0) as total_cost,
  COALESCE(SUM(line_margin), 0) as margin_amount,
  COUNT(*) as line_count
FROM quote_lines
WHERE quote_id = $1 AND tenant_id = $2;
```

### 9.2 BOM Explosion Performance

**Depth Limiting:**
- Maximum BOM depth: 5 levels
- Prevents infinite loops in circular BOMs
- Configurable via `MAX_BOM_DEPTH` constant

**Caching Opportunities:**
- Material costs can be cached per request
- BOM structures rarely change, good cache candidates
- Product standard costs can be cached

**Batch Processing:**
- Recursive queries use prepared statements
- Connection pooling (pg Pool)
- Transaction batching for multi-line quotes

### 9.3 Pricing Rule Performance

**Rule Evaluation Limits:**
- Maximum 100 rules fetched per evaluation
- Maximum 10 rules applied per quote line
- Priority-based early termination possible

**JSONB Condition Matching:**
- PostgreSQL JSONB is indexed (GIN index possible)
- Condition evaluation in application layer for flexibility
- Pre-filtering by date range at database level

---

## 10. Testing & Verification

### 10.1 Verification Script
**File:** `backend/scripts/verify-sales-quote-automation.ts`

**Checks:**
- GraphQL schema registration
- Service availability (DI container)
- Database table existence
- RLS policies enabled
- Sample quote creation and calculation

### 10.2 Manual Testing Scenarios

**Scenario 1: Basic Quote Creation**
```
1. Create quote with customer and date
2. Add quote line with product and quantity
3. Verify pricing calculated correctly
4. Verify cost calculated from BOM
5. Verify margin calculated
6. Verify quote totals updated
```

**Scenario 2: Pricing Rule Application**
```
1. Create pricing rule (volume discount)
2. Create quote line with quantity matching rule
3. Verify rule applied
4. Verify discount amount correct
5. Verify appliedRules array contains rule details
```

**Scenario 3: Customer Pricing with Quantity Breaks**
```
1. Create customer pricing with price breaks
2. Create quote line with quantity in break tier
3. Verify correct tier price applied
4. Verify priceSource = CUSTOMER_PRICING
```

**Scenario 4: Manual Price Override**
```
1. Create quote line with manualUnitPrice
2. Verify manual price used
3. Verify priceSource = MANUAL_OVERRIDE
4. Verify margin recalculated with manual price
```

**Scenario 5: Multi-Level BOM Explosion**
```
1. Create product with nested BOM (2+ levels)
2. Create quote line for product
3. Verify cost calculation includes all levels
4. Verify scrap percentages applied
5. Verify material requirements accumulated correctly
```

**Scenario 6: Margin Validation**
```
1. Create quote with 30% margin → no approval
2. Create quote with 18% margin → manager approval
3. Create quote with 12% margin → VP approval
4. Create quote with 8% margin → VP/CFO approval
```

### 10.3 GraphQL Testing

**Using GraphQL Playground:**

```graphql
# Test 1: Preview pricing
query {
  previewQuoteLinePricing(
    tenantId: "tenant-1"
    productId: "prod-123"
    customerId: "cust-456"
    quantity: 1000
    quoteDate: "2025-12-28"
  ) {
    unitPrice
    lineAmount
    discountPercentage
    marginPercentage
    priceSource
    appliedRules {
      ruleName
      discountApplied
    }
  }
}

# Test 2: Create quote with lines
mutation {
  createQuoteWithLines(input: {
    tenantId: "tenant-1"
    customerId: "cust-456"
    quoteDate: "2025-12-28"
    expirationDate: "2026-01-28"
    quoteCurrencyCode: "USD"
    lines: [
      {
        productId: "prod-123"
        quantityQuoted: 1000
      }
    ]
  }) {
    id
    quoteNumber
    totalAmount
    marginPercentage
    lines {
      id
      unitPrice
      lineAmount
      marginPercentage
    }
  }
}
```

---

## 11. Known Limitations & Future Enhancements

### Current Limitations

1. **FIFO/LIFO Costing Not Implemented**
   - Currently falls back to standard cost
   - Requires inventory transaction tracking

2. **Tax Calculation Placeholder**
   - Tax amount field exists but not auto-calculated
   - Future integration with tax engine needed

3. **Setup Cost Simplification**
   - Uses fixed labor rate ($50/hr)
   - Uses default setup time if not specified
   - No machine-specific setup costs

4. **Approval Workflow Not Integrated**
   - Margin validation returns approval level
   - Actual approval process not implemented
   - No approval routing/notifications

5. **Currency Exchange Rates**
   - Multi-currency supported in schema
   - Exchange rate conversion not implemented

### Recommended Enhancements

1. **Approval Workflow Integration**
   - Implement approval request creation
   - Email notifications to approvers
   - Approval history tracking
   - Delegation support

2. **Advanced Cost Methods**
   - FIFO/LIFO from inventory transactions
   - Activity-based costing (ABC)
   - Standard cost variance tracking

3. **Tax Engine Integration**
   - Automated tax calculation by jurisdiction
   - Tax exemption handling
   - Multi-jurisdiction support

4. **Quote Templates**
   - Save quote as template
   - Clone quote functionality
   - Recurring quotes

5. **Quote Analytics**
   - Win/loss analysis
   - Margin trend analysis
   - Sales rep performance
   - Product profitability

6. **PDF Generation**
   - Professional quote PDF
   - Customizable templates
   - Email delivery

7. **Version Control**
   - Quote revision history
   - Compare quote versions
   - Rollback capability

8. **Batch Operations**
   - Bulk quote recalculation
   - Bulk price updates
   - Bulk status changes

---

## 12. File Inventory

### Backend Files

| Path | Lines | Purpose |
|------|-------|---------|
| `backend/src/graphql/schema/sales-quote-automation.graphql` | 209 | GraphQL schema definitions |
| `backend/src/graphql/resolvers/quote-automation.resolver.ts` | 362 | GraphQL resolver implementation |
| `backend/src/modules/sales/services/quote-management.service.ts` | 733 | Quote CRUD and orchestration |
| `backend/src/modules/sales/services/quote-pricing.service.ts` | 377 | Pricing calculation logic |
| `backend/src/modules/sales/services/quote-costing.service.ts` | 433 | BOM explosion and costing |
| `backend/src/modules/sales/services/pricing-rule-engine.service.ts` | 352 | Pricing rule evaluation |
| `backend/src/modules/sales/sales.module.ts` | ~100 | NestJS module configuration |
| `backend/src/modules/sales/interfaces/quote-management.interface.ts` | ~200 | TypeScript interfaces |
| `backend/src/modules/sales/interfaces/quote-pricing.interface.ts` | ~150 | TypeScript interfaces |
| `backend/src/modules/sales/interfaces/quote-costing.interface.ts` | ~150 | TypeScript interfaces |
| `backend/database/schemas/sales-materials-procurement-module.sql` | ~1500 | Database schema (partial) |
| `backend/migrations/V0.0.36__add_rls_policies_sales_quote_automation.sql` | ~100 | RLS policies |
| `backend/scripts/verify-sales-quote-automation.ts` | ~200 | Verification script |

### Frontend Files

| Path | Lines | Purpose |
|------|-------|---------|
| `frontend/src/pages/SalesQuoteDashboard.tsx` | ~400 | Quote list page |
| `frontend/src/pages/SalesQuoteDetailPage.tsx` | ~600 | Quote detail page |
| `frontend/src/graphql/queries/salesQuoteAutomation.ts` | ~300 | GraphQL queries/mutations |
| `frontend/src/components/common/DataTable.tsx` | ~200 | Reusable table component |

**Total Estimated Lines of Code: ~6,000**

---

## 13. Dependencies

### Backend Dependencies

```typescript
// NestJS core
@nestjs/common
@nestjs/graphql
@nestjs/apollo

// Database
pg (PostgreSQL driver)
@types/pg

// GraphQL
@apollo/server
graphql
```

### Frontend Dependencies

```typescript
// React
react
react-dom
react-router-dom

// GraphQL
@apollo/client
graphql

// UI
@tanstack/react-table
lucide-react (icons)

// i18n
react-i18next
```

### Database Requirements

```
PostgreSQL >= 14
Extensions:
  - uuid-ossp (for uuid_generate_v7)
  - pgcrypto (for security)
```

---

## 14. Deployment Considerations

### Environment Variables

```bash
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=agog_erp
DATABASE_USER=postgres
DATABASE_PASSWORD=<secure>
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

GRAPHQL_PLAYGROUND_ENABLED=false  # Production: false
GRAPHQL_DEBUG=false                # Production: false
```

### Migration Sequence

```
1. V0.0.6__create_sales_materials_procurement.sql
   ↓
2. V0.0.36__add_rls_policies_sales_quote_automation.sql
```

### Health Checks

```bash
# Database connectivity
psql -h localhost -U postgres -d agog_erp -c "SELECT 1"

# GraphQL endpoint
curl http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'

# Quote creation test
npm run test:sales-quote-automation
```

### Performance Tuning

```sql
-- Analyze tables for query planner
ANALYZE quotes;
ANALYZE quote_lines;
ANALYZE pricing_rules;
ANALYZE customer_pricing;

-- Vacuum to reclaim space
VACUUM ANALYZE quotes;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('quotes', 'quote_lines', 'pricing_rules', 'customer_pricing')
ORDER BY idx_scan DESC;
```

---

## 15. Conclusion

The Sales Quote Automation feature is a **production-ready, enterprise-grade system** that demonstrates sophisticated software engineering:

**Strengths:**
✅ Comprehensive business logic with pricing hierarchy and margin controls
✅ Flexible pricing rule engine with JSONB-based conditions
✅ Recursive BOM explosion with safety limits
✅ Multi-tenant security with RLS policies
✅ Type-safe GraphQL API with strong schema
✅ Automated cost calculation with multiple methods
✅ Audit trail on all data changes
✅ Frontend dashboard with KPIs and filtering

**Architecture Quality:**
✅ Clean service layer separation of concerns
✅ Dependency injection via NestJS
✅ Transaction safety for multi-table operations
✅ Connection pooling for performance
✅ Indexed queries for fast lookups
✅ JSONB for flexible data structures

**Production Readiness:**
✅ Error handling throughout
✅ Input validation at GraphQL layer
✅ Row-level security for multi-tenancy
✅ Verification scripts for deployment
✅ Scalable architecture (horizontal scaling possible)

This implementation provides a solid foundation for sales quote management and can be extended with approval workflows, tax calculation, PDF generation, and advanced analytics as business needs evolve.

---

**End of Research Deliverable**
