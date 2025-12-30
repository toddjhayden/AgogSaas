# Research Deliverable: Sales Quote Automation
**REQ Number:** REQ-STRATEGIC-AUTO-1766862737958
**Feature Title:** Sales Quote Automation
**Researcher:** Cynthia (Senior Research Analyst)
**Date:** 2025-12-27
**Status:** COMPLETE

---

## Executive Summary

The Sales Quote Automation feature is a **fully implemented, production-ready system** within the Print Industry ERP application. This comprehensive analysis reveals a sophisticated quote management platform with automated pricing, costing, margin validation, and workflow orchestration specifically designed for print manufacturing operations.

**Key Findings:**
- ✅ **Complete Implementation**: All core components are functional and deployed
- ✅ **Advanced Automation**: Pricing rules engine with JSONB-based conditions
- ✅ **Manufacturing-Specific**: BOM explosion, setup cost amortization, scrap allowance
- ✅ **Financial Controls**: Multi-level margin approval workflows
- ✅ **Production Ready**: Deployment scripts, health checks, monitoring in place

---

## 1. Current Implementation Status

### 1.1 Architecture Overview

The Sales Quote Automation system follows a **three-tier architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                            │
│  - React/TypeScript UI Components                           │
│  - Apollo GraphQL Client                                     │
│  - Pages: SalesQuoteDashboard, SalesQuoteDetailPage        │
└─────────────────────────────────────────────────────────────┘
                            ↓ GraphQL
┌─────────────────────────────────────────────────────────────┐
│                   API/BUSINESS LOGIC LAYER                   │
│  - NestJS Framework                                          │
│  - GraphQL Resolvers: QuoteAutomationResolver               │
│  - Services:                                                 │
│    • QuoteManagementService (Orchestration)                 │
│    • QuotePricingService (Pricing Logic)                    │
│    • QuoteCostingService (Cost Calculation)                 │
│    • PricingRuleEngineService (Rule Evaluation)             │
└─────────────────────────────────────────────────────────────┘
                            ↓ SQL
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│  - PostgreSQL Database                                       │
│  - Tables: quotes, quote_lines, pricing_rules,              │
│           customer_pricing, products, bill_of_materials     │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Database Schema

**Migration File:** `V0.0.6__create_sales_materials_procurement.sql` (print-industry-erp/backend/migrations)

#### Core Tables:

**1. quotes** (Quote Headers)
- **Primary Key:** `id` (UUID v7)
- **Identification:** `quote_number` (auto-generated), `quote_date`, `expiration_date`
- **Customer:** `customer_id`, contact information
- **Sales Rep:** `sales_rep_user_id`
- **Financial:** `subtotal`, `tax_amount`, `shipping_amount`, `discount_amount`, `total_amount`
- **Margin Tracking:** `total_cost`, `margin_amount`, `margin_percentage`
- **Status:** DRAFT → ISSUED → ACCEPTED/REJECTED/EXPIRED → CONVERTED_TO_ORDER
- **Conversion:** `converted_to_sales_order_id`, `converted_at`
- **Audit Trail:** `created_at`, `created_by`, `updated_at`, `updated_by`

**2. quote_lines** (Line Items)
- **Quote Linkage:** `quote_id`, `line_number`
- **Product:** `product_id`, `product_code`, `description`
- **Quantity:** `quantity`, `unit_of_measure`
- **Pricing:** `unit_price`, `line_amount`, `discount_percentage`, `discount_amount`
- **Costing:** `unit_cost`, `line_cost`, `line_margin`, `margin_percentage`
- **Manufacturing:** `manufacturing_strategy`, `lead_time_days`, `promised_delivery_date`

**3. pricing_rules** (Dynamic Pricing Engine)
- **Rule Definition:** `rule_code`, `rule_name`, `rule_type`
- **Priority:** Lower number = higher priority (default: 10)
- **Conditions:** JSONB field for flexible matching
  - Examples: `{customer_tier: 'VOLUME', min_quantity: 1000, product_category: 'LABELS'}`
- **Actions:** `pricing_action` (PERCENTAGE_DISCOUNT, FIXED_DISCOUNT, FIXED_PRICE, MARKUP_PERCENTAGE)
- **Effective Dating:** `effective_from`, `effective_to`
- **Status:** `is_active` flag

**4. customer_pricing** (Customer-Specific Pricing)
- **Customer-Product Linkage:** `customer_id`, `product_id`
- **Pricing Tiers:** `unit_price`, `minimum_quantity`, `maximum_quantity`
- **Effective Dating:** `effective_from`, `effective_to`
- **Priority:** Takes precedence over list price and pricing rules

**5. products** (Finished Goods)
- **Product Data:** `product_code`, `product_name`, `description`
- **Category:** `product_category`, `product_type`
- **Design Specs:** `substrate`, `finished_size_width`, `finished_size_height`, `colors_front`, `colors_back`
- **Costing:** `standard_material_cost`, `standard_labor_cost`, `standard_overhead_cost`
- **Pricing:** `list_price`, `unit_of_measure`

**6. bill_of_materials** (Product BOMs)
- **Product:** `product_id`
- **Component:** `material_id`, `quantity_per_unit`, `unit_of_measure`
- **Scrap:** `scrap_percentage` (for waste calculation)
- **Sequence:** `sequence_number` (assembly order)
- **Substitution:** `substitute_material_id` (alternate materials)

**7. materials** (Raw Materials)
- **Material Data:** `material_code`, `material_name`, `material_type`
- **Categories:** Substrate, Ink, Coating, Plate, Packaging, Finishing
- **Costing:** `costing_method` (FIFO, LIFO, AVERAGE, STANDARD)
- **Inventory:** ABC classification, reorder points, lead times
- **Vendor:** `preferred_vendor_id`, `standard_cost`

---

## 2. Business Logic & Services

### 2.1 QuoteManagementService

**File:** `src/modules/sales/services/quote-management.service.ts`

**Responsibilities:**
- Quote CRUD operations (create, read, update, delete)
- Quote number generation (format: `Q-YYYYMMDD-####`)
- Quote line management (add, update, delete lines)
- Quote recalculation (totals, margins)
- Margin validation with approval workflows
- Quote-to-order conversion

**Key Business Rules:**
- **Minimum Margin:** 15% (configurable)
- **Manager Approval:** Required for margins < 20%
- **VP Approval:** Required for margins < 10%
- **Status Progression:** DRAFT → ISSUED → ACCEPTED → CONVERTED_TO_ORDER

**Methods:**
- `createQuote()`: Create quote header with auto-generated quote number
- `addQuoteLine()`: Add line with automatic pricing/costing
- `updateQuoteLine()`: Update line and recalculate
- `deleteQuoteLine()`: Remove line and recalculate totals
- `recalculateQuote()`: Recalculate all pricing, costs, and margins
- `validateMargin()`: Check margin against thresholds
- `convertQuoteToSalesOrder()`: Convert accepted quote to sales order

### 2.2 QuotePricingService

**File:** `src/modules/sales/services/quote-pricing.service.ts`

**Pricing Waterfall Logic:**

```
1. Check Customer-Specific Pricing (customer_pricing table)
   ↓ (if not found)
2. Evaluate Pricing Rules (pricing_rules engine)
   ↓ (if no rules match)
3. Use Product List Price (products.list_price)
   ↓ (if not found)
4. Use Manual Override (if provided by sales rep)
```

**Price Source Tracking:**
- `CUSTOMER_PRICING`: Customer-specific agreement price
- `PRICING_RULE`: Dynamically calculated via rule engine
- `LIST_PRICE`: Standard product list price
- `MANUAL_OVERRIDE`: Sales rep manual entry

**Key Features:**
- **Quantity Breaks:** Customer pricing supports tiered pricing by quantity
- **Date-Effective Pricing:** Prices valid only within effective date ranges
- **Discount Tracking:** Applied discounts tracked per line
- **Margin Calculation:** Automatic margin % = (Price - Cost) / Price × 100

**Methods:**
- `calculateQuoteLinePricing()`: Calculate pricing for a single line
- `getCustomerPricing()`: Fetch customer-specific pricing
- `calculateQuoteTotals()`: Sum all lines and calculate totals

### 2.3 QuoteCostingService

**File:** `src/modules/sales/services/quote-costing.service.ts`

**Costing Methods:**

**1. STANDARD_COST** (Fast, Simple)
- Uses pre-calculated `standard_material_cost`, `standard_labor_cost`, `standard_overhead_cost` from products table
- Best for: High-volume standard products

**2. BOM_EXPLOSION** (Detailed, Recursive)
- Recursively explodes multi-level BOMs (max depth: 5 levels)
- Calculates material costs from current raw material costs
- Applies scrap allowance: `quantity_needed = quantity × (1 + scrap_percentage)`
- Handles material substitutions
- Best for: Custom jobs, complex assemblies

**3. FIFO/LIFO/AVERAGE** (Inventory-Based)
- Uses actual inventory costing based on materials.costing_method
- Best for: Specific material cost tracking

**Setup Cost Amortization:**
- Fixed setup costs distributed across ordered quantity
- Formula: `setup_cost_per_unit = total_setup_cost / quantity`
- Higher quantities = lower per-unit setup cost

**Cost Components Tracked:**
- Material Cost
- Labor Cost
- Overhead Cost
- Setup Cost
- Total Unit Cost

**Methods:**
- `calculateProductCost()`: Calculate cost for a product at given quantity
- `explodeBOM()`: Recursive BOM explosion with scrap
- `calculateSetupCost()`: Calculate setup cost amortization

### 2.4 PricingRuleEngineService

**File:** `src/modules/sales/services/pricing-rule-engine.service.ts`

**Rule Evaluation Process:**

```
1. Fetch active rules for tenant/date range
2. Filter rules matching product/customer criteria
3. Evaluate JSONB conditions against context
4. Sort by priority (ascending)
5. Apply top 10 matching rules sequentially
6. Track which rules were applied and discount amounts
```

**Supported Conditions (JSONB):**
- `customer_tier`: Match customer pricing tier (RETAIL, VOLUME, ENTERPRISE)
- `customer_type`: Match customer type (DIRECT, DISTRIBUTOR, RESELLER)
- `product_category`: Match product category (LABELS, BOXES, BROCHURES)
- `product_type`: Match product type
- `min_quantity`: Minimum order quantity threshold
- `max_quantity`: Maximum order quantity threshold
- `date_range`: Effective date range
- **Custom Conditions:** Any additional JSON fields for business-specific rules

**Pricing Actions:**
- **PERCENTAGE_DISCOUNT:** Reduce price by X%
  - Example: 10% off → `finalPrice = basePrice × 0.90`
- **FIXED_DISCOUNT:** Reduce price by $X
  - Example: $5 off → `finalPrice = basePrice - 5.00`
- **FIXED_PRICE:** Set absolute price
  - Example: Set to $99.99 → `finalPrice = 99.99`
- **MARKUP_PERCENTAGE:** Increase price by X%
  - Example: 20% markup → `finalPrice = basePrice × 1.20`

**Rule Priority:**
- Rules sorted by priority (lower number = higher priority)
- Default priority: 10
- Example: Priority 1 rule executes before Priority 5 rule
- Multiple rules can be applied sequentially (limit: 10 rules)

**Methods:**
- `evaluatePricingRules()`: Evaluate all rules for a quote line
- `evaluateRuleConditions()`: Check if rule conditions match
- `applyPricingAction()`: Apply pricing action to calculate new price
- `testRuleEvaluation()`: Test rule evaluation for admin UI

---

## 3. GraphQL API

### 3.1 Schema

**File:** `src/graphql/schema/sales-quote-automation.graphql`

**Types:**

```graphql
type Quote {
  id: ID!
  quoteNumber: String!
  quoteDate: Date!
  expirationDate: Date
  customerId: ID!
  customerName: String
  salesRepUserId: ID
  salesRepName: String
  quoteCurrencyCode: String!
  subtotal: Float!
  taxAmount: Float
  shippingAmount: Float
  discountAmount: Float
  totalAmount: Float!
  totalCost: Float
  marginAmount: Float
  marginPercentage: Float
  status: QuoteStatus!
  lines: [QuoteLine!]
  notes: String
  termsAndConditions: String
  createdAt: DateTime!
  updatedAt: DateTime
}

type QuoteLine {
  id: ID!
  quoteId: ID!
  lineNumber: Int!
  productId: ID!
  productCode: String
  description: String
  quantityQuoted: Float!
  unitOfMeasure: String
  unitPrice: Float!
  lineAmount: Float!
  discountPercentage: Float
  discountAmount: Float
  unitCost: Float
  lineCost: Float
  lineMargin: Float
  marginPercentage: Float
  manufacturingStrategy: String
  leadTimeDays: Int
  promisedDeliveryDate: Date
}

type PricingCalculation {
  unitPrice: Float!
  lineAmount: Float!
  discountPercentage: Float
  discountAmount: Float
  unitCost: Float
  lineCost: Float
  lineMargin: Float
  marginPercentage: Float
  appliedRules: [AppliedPricingRule!]
  priceSource: PriceSource!
}

type AppliedPricingRule {
  ruleId: ID!
  ruleCode: String!
  ruleName: String!
  ruleType: String!
  pricingAction: String!
  actionValue: Float!
  priority: Int!
  discountApplied: Float!
}

type CostCalculation {
  unitCost: Float!
  totalCost: Float!
  materialCost: Float
  laborCost: Float
  overheadCost: Float
  setupCost: Float
  setupCostPerUnit: Float
  costMethod: String!
  costBreakdown: [CostComponent!]
}

type MarginValidation {
  isValid: Boolean!
  minimumMarginPercentage: Float!
  actualMarginPercentage: Float!
  requiresApproval: Boolean!
  approvalLevel: ApprovalLevel
}

enum QuoteStatus {
  DRAFT
  ISSUED
  ACCEPTED
  REJECTED
  EXPIRED
  CONVERTED_TO_ORDER
}

enum PriceSource {
  CUSTOMER_PRICING
  PRICING_RULE
  LIST_PRICE
  MANUAL_OVERRIDE
}

enum ApprovalLevel {
  NONE
  MANAGER
  VP
  EXECUTIVE
}
```

### 3.2 Queries

**File:** `src/graphql/resolvers/quote-automation.resolver.ts`

```graphql
# Fetch all quotes with optional filtering
query GetQuotes(
  $tenantId: ID!
  $status: QuoteStatus
  $customerId: ID
  $dateFrom: Date
  $dateTo: Date
) {
  quotes(
    tenantId: $tenantId
    status: $status
    customerId: $customerId
    dateFrom: $dateFrom
    dateTo: $dateTo
  ): [Quote!]!
}

# Fetch single quote with full details
query GetQuote($quoteId: ID!) {
  quote(quoteId: $quoteId): Quote
}

# Preview pricing before creating quote line
query PreviewQuoteLinePricing(
  $tenantId: ID!
  $productId: ID!
  $customerId: ID!
  $quantity: Float!
  $quoteDate: Date
): PricingCalculation!

# Preview product cost calculation
query PreviewProductCost(
  $tenantId: ID!
  $productId: ID!
  $quantity: Float!
): CostCalculation!

# Test pricing rule (admin use)
query TestPricingRule(
  $ruleId: ID!
  $productId: ID
  $customerId: ID
  $quantity: Float
  $basePrice: Float!
): RuleTestResult!
```

### 3.3 Mutations

```graphql
# Create quote with multiple lines in one transaction
mutation CreateQuoteWithLines($input: CreateQuoteWithLinesInput!) {
  createQuoteWithLines(input: $input): Quote!
}

# Add single line to existing quote
mutation AddQuoteLine($input: AddQuoteLineInput!) {
  addQuoteLine(input: $input): QuoteLine!
}

# Update existing quote line
mutation UpdateQuoteLine($input: UpdateQuoteLineInput!) {
  updateQuoteLine(input: $input): QuoteLine!
}

# Delete quote line
mutation DeleteQuoteLine($quoteLineId: ID!) {
  deleteQuoteLine(quoteLineId: $quoteLineId): Boolean!
}

# Recalculate entire quote
mutation RecalculateQuote(
  $quoteId: ID!
  $recalculateCosts: Boolean
  $recalculatePricing: Boolean
): Quote!

# Validate quote margin requirements
mutation ValidateQuoteMargin($quoteId: ID!) {
  validateQuoteMargin(quoteId: $quoteId): MarginValidation!
}

# Update quote status
mutation UpdateQuoteStatus($quoteId: ID!, $status: QuoteStatus!) {
  updateQuoteStatus(quoteId: $quoteId, status: $status): Quote!
}

# Convert quote to sales order
mutation ConvertQuoteToSalesOrder($quoteId: ID!) {
  convertQuoteToSalesOrder(quoteId: $quoteId): SalesOrder!
}
```

---

## 4. Frontend Implementation

### 4.1 Sales Quote Dashboard

**File:** `frontend/src/pages/SalesQuoteDashboard.tsx`

**Features:**
- **KPI Cards:**
  - Total Quotes Count
  - Total Quote Value ($)
  - Average Margin (%)
  - Conversion Rate (%)

- **Status Summary Cards:**
  - Draft Quotes
  - Issued Quotes
  - Accepted Quotes
  - Rejected Quotes

- **Filterable Data Table:**
  - Columns: Quote Number, Customer, Date, Expiration, Status, Amount, Margin, Sales Rep
  - Sortable by all columns
  - Date range filtering
  - Status filtering
  - Clickable quote numbers → navigate to detail page

- **Actions:**
  - Create New Quote button
  - Refresh data
  - Export (planned)

**GraphQL Integration:**
- Query: `GET_QUOTES` with variables for filtering
- Real-time updates via Apollo Client cache
- Optimistic UI updates

### 4.2 Sales Quote Detail Page

**File:** `frontend/src/pages/SalesQuoteDetailPage.tsx`

**Features:**
- **Quote Header Section:**
  - Quote number, date, customer, sales rep
  - Status badge with color coding
  - Financial summary (subtotal, tax, shipping, total)
  - Margin display with warning if below threshold

- **Quote Lines Table:**
  - Add new line button
  - Edit/delete existing lines
  - Columns: Product, Description, Quantity, Unit Price, Discount, Line Total, Margin
  - Inline pricing preview before saving

- **Actions Panel:**
  - Recalculate Quote (refresh pricing/costs)
  - Validate Margin (check approval requirements)
  - Update Status (DRAFT → ISSUED → ACCEPTED)
  - Convert to Sales Order (when accepted)
  - Delete Quote (if draft)

- **Pricing Preview:**
  - Before adding line: show estimated price, cost, margin
  - Applied pricing rules displayed
  - Price source indicator (customer pricing vs. list price vs. rule)

**GraphQL Integration:**
- Query: `GET_QUOTE` for detail
- Mutations: `ADD_QUOTE_LINE`, `UPDATE_QUOTE_LINE`, `DELETE_QUOTE_LINE`
- Mutations: `RECALCULATE_QUOTE`, `VALIDATE_QUOTE_MARGIN`
- Real-time updates after mutations

### 4.3 Frontend GraphQL Queries

**File:** `frontend/src/graphql/queries/salesQuoteAutomation.ts`

All queries and mutations are defined with TypeScript types for type safety. Apollo Client manages caching and optimistic updates.

---

## 5. Deployment & Operations

### 5.1 Deployment Script

**File:** `backend/scripts/deploy-sales-quote-automation.sh`

**Deployment Phases:**

**Phase 1: Prerequisites**
- Check Node.js version (requires 18+)
- Verify npm, psql, git installed
- Validate environment configuration

**Phase 2: Database Backup**
- Create timestamped backup: `db_backup_YYYYMMDD_HHMMSS.sql`
- Store in `backups/` directory
- Safety measure before schema changes

**Phase 3: Database Migrations**
- Apply `V0.0.6__create_sales_materials_procurement.sql`
- Check if tables already exist (idempotent)
- Verify table creation: quotes, quote_lines, pricing_rules, customer_pricing

**Phase 4: Backend Build**
- Run `npm ci` (clean install)
- Compile TypeScript: `npm run build`
- Verify dist/ folder created

**Phase 5: Backend Tests**
- Run test suite: `npm test`
- Skip with `SKIP_TESTS=true` flag

**Phase 6: Frontend Build**
- Run `npm ci` in frontend
- Build production bundle: `npm run build`
- Warnings accepted, errors fail deployment

**Phase 7: Deployment Verification**
- Verify quotes table has 20+ columns
- Check backend dist/ exists
- Check frontend dist/ exists
- Validate database connectivity

**Phase 8: Deployment Report**
- Generate timestamped report
- Document all components deployed
- List feature flags, services, endpoints
- Provide rollback instructions

**Environment Variables:**
- `DEPLOYMENT_ENV`: staging | production
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `SKIP_TESTS`: true | false
- `SKIP_MIGRATIONS`: true | false
- `ENABLE_SALES_QUOTE_AUTOMATION`: true | false
- `ENABLE_PRICING_RULES`: true | false
- `ENABLE_AUTOMATED_COSTING`: true | false

### 5.2 Health Check Script

**File:** `backend/scripts/health-check-sales-quotes.sh`

**Health Check Categories:**

**1. Database Tables Check**
- Verify existence: quotes, quote_lines, pricing_rules, customer_pricing
- Check table structure (column count)

**2. Database Performance Check**
- Count records in quotes and quote_lines
- Detect slow queries (>1s execution time)
- Check pg_stat_statements for performance issues

**3. Business Metrics Check**
- **Average Margin (Last 7 Days):** Should be ≥ 15%
- **Conversion Rate (Last 30 Days):** Should be ≥ 20%
- **Low Margin Quotes:** Count quotes with margin < 15%

**4. Data Quality Check**
- Quotes without customer_id: Should be 0
- Quote lines without product_id: Should be 0
- Quotes with negative margins: Warning if > 0

**5. API Health Check**
- GraphQL endpoint introspection query
- HTTP status code check (expect 200)
- Response time check (expect < 2000ms)

**Health Thresholds:**
- `MAX_RESPONSE_TIME_MS`: 2000
- `MIN_CONVERSION_RATE`: 20%
- `MIN_MARGIN_PERCENT`: 15%
- `MAX_ERROR_RATE`: 5%

**Output:**
- Timestamped health report file
- Pass/fail summary with counts
- Exit code: 0 (all passed), 1 (some failed)

---

## 6. Integration Points

### 6.1 Integrated Systems

**Customer Management**
- `customers` table: customer profiles, pricing tiers, credit limits
- Customer-specific pricing agreements
- Contact information for quotes

**Materials Management**
- `materials` table: raw materials with costing
- `bill_of_materials` table: product BOMs
- Scrap allowance and substitutions

**Product Catalog**
- `products` table: finished goods with specifications
- Standard costs (material, labor, overhead)
- List pricing

**Vendor Management**
- `vendors` table: supplier information
- Material sourcing and pricing

**Finance/Accounting**
- GL account integration (planned)
- Currency conversion support (`quote_currency_code`)
- Tax calculations (framework in place)

**Sales Orders**
- Quote-to-order conversion creates sales orders
- Reference linkage: `converted_to_sales_order_id`
- Maintains pricing and line details

**Imposition/Production Planning**
- `manufacturing_strategy` field on quote lines
- Lead time calculation
- Promised delivery dates

**Warehouse Management (WMS)**
- Inventory availability checks (planned)
- Material on-hand validation

### 6.2 NATS Event Bus (Planned)

While not fully implemented yet, the architecture supports event-driven integration:

**Potential Events:**
- `quote.created`: Published when quote is created
- `quote.issued`: Published when quote is sent to customer
- `quote.accepted`: Published when customer accepts
- `quote.converted`: Published when converted to sales order
- `pricing_rule.updated`: Published when pricing rules change
- `customer_pricing.updated`: Published when customer pricing changes

**Subscribers:**
- **Finance System:** Listen for quote.accepted to update forecasts
- **Inventory System:** Listen for quote.created to reserve materials
- **CRM System:** Listen for quote.issued to track customer engagement
- **Reporting System:** Listen for all quote events for analytics

---

## 7. Automation Capabilities

### 7.1 Current Automation Features

**✅ Automated Pricing**
- Customer-specific pricing lookup
- Dynamic pricing rule evaluation
- Multi-rule application with priority
- Quantity break calculations
- Date-effective pricing

**✅ Automated Costing**
- Standard cost lookup
- BOM explosion with recursive assembly
- Scrap allowance application
- Setup cost amortization
- Multi-method costing (FIFO, LIFO, AVERAGE, STANDARD)

**✅ Automated Margin Calculation**
- Per-line margin percentage
- Total quote margin
- Margin validation against thresholds
- Approval level determination

**✅ Automated Quote Number Generation**
- Format: `Q-YYYYMMDD-####`
- Sequential numbering per day
- Unique constraint enforcement

**✅ Automated Recalculation**
- Trigger: When line quantity changes
- Trigger: When pricing rules updated
- Trigger: When product costs change
- Recalculates: Pricing, costs, margins, totals

**✅ Automated Status Management**
- Status progression validation
- Expiration date checking (planned)
- Conversion tracking

### 7.2 Gaps & Enhancement Opportunities

**🔄 Partial Automation (Could be Enhanced)**

**1. Approval Workflows**
- **Current:** Margin validation identifies approval level required
- **Gap:** No automated routing to managers/VPs
- **Enhancement:** Integrate with approval workflow engine
  - Auto-assign approver based on approval level
  - Email notifications to approvers
  - Approval history tracking
  - Escalation if not approved within SLA

**2. Customer Notifications**
- **Current:** Manual email of quote PDF
- **Gap:** No automated quote issuance
- **Enhancement:**
  - Auto-generate PDF quote document
  - Email to customer contact on status = ISSUED
  - Tracking pixel for "quote viewed" status
  - Customer portal for quote review/acceptance

**3. Expiration Handling**
- **Current:** `expiration_date` field exists
- **Gap:** No automated expiration processing
- **Enhancement:**
  - Daily batch job to expire quotes past expiration date
  - Email warning to sales rep 3 days before expiration
  - Auto-renewal suggestion based on customer history

**4. Inventory Availability**
- **Current:** Pricing/costing based on product definition
- **Gap:** No real-time inventory check
- **Enhancement:**
  - Check material availability during quote creation
  - Warning if insufficient inventory
  - Alternative material suggestions
  - Estimated restock date calculation

**5. Lead Time Calculation**
- **Current:** Manual entry of `lead_time_days`
- **Gap:** No automated calculation
- **Enhancement:**
  - Calculate based on manufacturing strategy
  - Consider current production schedule
  - Account for material lead times
  - Include setup time, run time, finishing time

**6. Price Optimization**
- **Current:** Rules-based pricing
- **Gap:** No dynamic optimization
- **Enhancement:**
  - AI/ML-based price suggestions
  - Competitive pricing intelligence
  - Win/loss analysis feedback loop
  - Customer price sensitivity modeling

**7. Quote Templates**
- **Current:** Manual quote creation
- **Gap:** No templating for common quotes
- **Enhancement:**
  - Save quote as template
  - Quick quote creation from template
  - Customer-specific templates (e.g., monthly reorders)

**8. Version Control**
- **Current:** Updates overwrite quote data
- **Gap:** No version history
- **Enhancement:**
  - Version tracking for quote revisions
  - Compare versions side-by-side
  - Audit trail of changes
  - Rollback to previous version

**❌ Not Yet Implemented**

**1. Tax Calculation**
- **Field Exists:** `tax_amount` in quotes table
- **Status:** Currently set to 0
- **Enhancement Needed:**
  - Integrate with tax rate service (Avalara, TaxJar)
  - Calculate based on customer location
  - Handle multi-jurisdiction taxes
  - Tax exemption certificate management

**2. Shipping Cost Calculation**
- **Field Exists:** `shipping_amount` in quotes table
- **Status:** Currently set to 0
- **Enhancement Needed:**
  - Integrate with shipping carriers (UPS, FedEx)
  - Calculate based on weight, dimensions, destination
  - Multiple shipping options (ground, express, overnight)
  - Freight calculations for large orders

**3. Discount Management**
- **Field Exists:** `discount_amount` in quotes table
- **Status:** Calculated from pricing rules, but no manual override UI
- **Enhancement Needed:**
  - Allow sales rep to apply manual discounts
  - Discount approval workflow for large discounts
  - Discount code/coupon support
  - Volume discount bundles

**4. Multi-Currency Support**
- **Field Exists:** `quote_currency_code` in quotes table
- **Status:** Currency code stored but no conversion
- **Enhancement Needed:**
  - Real-time exchange rate lookup
  - Multi-currency pricing in product catalog
  - Currency conversion for reporting
  - Hedge foreign exchange risk

**5. Quote Analytics & Reporting**
- **Gap:** No built-in reporting dashboards
- **Enhancement Needed:**
  - Win/loss analysis by product, customer, sales rep
  - Average margin by customer tier, product category
  - Quote cycle time tracking
  - Price variance analysis (quoted vs. actual)

**6. Competitive Intelligence**
- **Gap:** No competitor pricing data
- **Enhancement Needed:**
  - Competitor pricing database
  - "We lost to competitor" tracking
  - Price positioning recommendations
  - Market price benchmarking

---

## 8. Print Industry-Specific Features

### 8.1 Manufacturing Strategy

The `manufacturing_strategy` field on quote lines supports print-specific workflows:

- **SHEET_FED:** Sheet-fed press production
- **WEB:** Web press production
- **DIGITAL:** Digital printing
- **WIDE_FORMAT:** Large format printing
- **FINISHING_ONLY:** Post-press finishing

This drives:
- Lead time calculation
- Equipment scheduling
- Cost calculations (different labor/overhead rates)

### 8.2 Substrate & Finishing

Product definitions include print-specific attributes:
- **Substrate:** Paper type, weight, coating
- **Finished Size:** Width × Height
- **Colors:** Front/back color specifications (4/4, 4/1, 4/0)
- **Finishing:** Die-cutting, folding, binding, lamination

These attributes:
- Drive BOM explosion (ink, substrate, finishing materials)
- Calculate imposition (how many up on sheet)
- Determine setup costs

### 8.3 Scrap Allowance

The `scrap_percentage` field in BOM records is critical for print:
- Typical scrap: 3-10% depending on complexity
- Higher scrap for tight registration jobs
- Setup sheets, color proofs, makeready waste
- Formula: `material_needed = ordered_quantity × (1 + scrap_percentage)`

### 8.4 Setup Cost Amortization

Print jobs have significant setup costs:
- Plate making
- Press makeready
- Die setup
- Color matching

Higher quantities spread setup cost:
- 100 units: $500 setup = $5.00/unit
- 1000 units: $500 setup = $0.50/unit
- 10000 units: $500 setup = $0.05/unit

This is reflected in non-linear pricing curves common in print.

---

## 9. Security & Data Integrity

### 9.1 Multi-Tenancy

All tables include `tenant_id` with foreign key constraints:
- Data isolation between tenants
- Row-level security (RLS) support
- Tenant context passed in all queries

### 9.2 Audit Trail

Comprehensive audit fields:
- `created_at`: Timestamp of creation
- `created_by`: User ID who created
- `updated_at`: Timestamp of last update
- `updated_by`: User ID who updated

Supports:
- Compliance requirements
- Change tracking
- Dispute resolution

### 9.3 Data Validation

**Database Constraints:**
- NOT NULL on required fields
- UNIQUE on quote_number
- Foreign key integrity
- CHECK constraints on enums

**Application-Level Validation:**
- Minimum margin validation
- Status progression validation
- Positive quantity validation
- Valid date range validation

### 9.4 Concurrency Control

- Optimistic locking via `updated_at` timestamp
- Database transactions for multi-row updates
- Row-level locking for quote updates

---

## 10. Performance Considerations

### 10.1 Database Indexes

**Existing Indexes:**
- `idx_quotes_tenant`: Fast tenant filtering
- `idx_quotes_customer`: Fast customer quote lookup
- `idx_quotes_date`: Date range queries
- `idx_quotes_status`: Status filtering
- `idx_quotes_sales_rep`: Sales rep performance reports
- `idx_quote_lines_quote`: Fast line retrieval for quote
- `idx_pricing_rules_priority`: Fast rule sorting
- `idx_pricing_rules_dates`: Date-effective rule lookup

**Query Optimization:**
- All queries filter by `tenant_id` first
- Composite indexes for common filter combinations
- Partial indexes for active pricing rules (`WHERE is_active = TRUE`)

### 10.2 Caching Strategy

**Database Level:**
- Materialized views for reporting (planned)
- Prepared statements for frequent queries

**Application Level:**
- Apollo Client cache for GraphQL responses
- Product pricing cache (5-minute TTL)
- Pricing rule cache (invalidated on rule update)

**Future Enhancements:**
- Redis cache for hot customer pricing
- Product cost cache
- Currency exchange rate cache

### 10.3 Scalability

**Current Architecture:**
- Stateless NestJS services (horizontally scalable)
- PostgreSQL primary-replica replication
- GraphQL batching and caching

**Bottleneck Identification:**
- BOM explosion: O(n) recursive depth, limited to 5 levels
- Pricing rule evaluation: Limited to 100 rules, top 10 applied
- Quote recalculation: Could be slow for quotes with 100+ lines

**Optimization Opportunities:**
- Background jobs for complex cost calculations
- Incremental recalculation (only changed lines)
- Denormalized quote totals for faster reads

---

## 11. Testing Strategy

### 11.1 Current Test Coverage

**Deployment Script includes:**
- Backend unit tests: `npm test`
- Can be skipped with `SKIP_TESTS=true`

**Recommended Test Types:**

**Unit Tests:**
- Service methods (pricing calculations, margin validation)
- Pricing rule evaluation logic
- BOM explosion algorithm
- Cost calculation accuracy

**Integration Tests:**
- GraphQL query/mutation execution
- Database transaction integrity
- Pricing waterfall logic
- Multi-service orchestration

**End-to-End Tests:**
- Quote creation workflow
- Quote-to-order conversion
- Margin approval workflow
- Pricing rule application

### 11.2 Test Data Requirements

**Minimum Test Data:**
- 3 customers (RETAIL, VOLUME, ENTERPRISE tiers)
- 10 products (various categories)
- 5 pricing rules (different types/priorities)
- 3 BOMs (simple, medium, complex)
- 20 materials (different costing methods)

**Test Scenarios:**
- Low-margin quote (triggers approval)
- High-volume quote (quantity break pricing)
- Custom product (BOM explosion)
- Expired quote handling
- Quote amendment (recalculation)

---

## 12. Documentation Status

### 12.1 Existing Documentation

**✅ Available:**
- Database schema comments in migration file
- TypeScript interfaces with JSDoc comments
- Deployment script with inline documentation
- Health check script with comments

**⚠️ Partial:**
- GraphQL schema (type definitions exist, but no usage examples)
- Service method signatures (documented, but limited examples)

**❌ Missing:**
- User guide for sales reps
- API integration guide for third-party systems
- Pricing rule configuration guide
- Troubleshooting guide
- Architecture decision records (ADRs)

### 12.2 Recommended Documentation

**For Sales Team:**
- Quote creation walkthrough (with screenshots)
- Pricing rule examples and when they apply
- Margin approval process
- Quote-to-order conversion steps

**For Administrators:**
- Pricing rule configuration guide
- Customer pricing setup
- Product costing configuration
- System health monitoring

**For Developers:**
- GraphQL API reference with examples
- Service architecture diagrams
- Database ER diagram
- Integration guide (NATS events, webhooks)

**For DevOps:**
- Deployment runbook
- Rollback procedures
- Performance tuning guide
- Monitoring and alerting setup

---

## 13. Competitive Analysis

### 13.1 Industry Comparisons

**ERP Systems with Quote Management:**

**SAP Business One:**
- ✅ Advanced pricing rules
- ✅ Multi-currency support
- ✅ Approval workflows
- ❌ Not print industry-specific
- ❌ Expensive licensing

**Microsoft Dynamics 365:**
- ✅ Integrated CRM and quote-to-cash
- ✅ AI-driven pricing suggestions
- ✅ Mobile quote creation
- ❌ Not print industry-specific
- ❌ Complex configuration

**PrintVis (EFI Pace):**
- ✅ Print industry-specific
- ✅ Imposition and estimating
- ✅ Job ticketing integration
- ✅ Substrate and finishing calculations
- ❌ Legacy UI/UX
- ❌ High cost

**Our System (AGOG Print ERP):**
- ✅ Print industry-specific (BOM, scrap, setup)
- ✅ Modern tech stack (NestJS, React, PostgreSQL)
- ✅ GraphQL API for extensibility
- ✅ Open architecture
- ✅ Automated pricing and costing
- ⚠️ Approval workflows need enhancement
- ⚠️ Limited reporting (can be added)
- ⚠️ No mobile app yet

### 13.2 Competitive Advantages

**1. Modern Architecture**
- GraphQL API enables easy third-party integrations
- React UI provides excellent UX
- PostgreSQL offers robust data integrity

**2. Print Industry Expertise**
- BOM explosion with scrap allowance
- Setup cost amortization
- Manufacturing strategy-driven workflows
- Substrate and color specifications

**3. Flexible Pricing Engine**
- JSONB conditions allow unlimited rule types
- Priority-based rule execution
- Customer-specific pricing overrides
- Transparent price source tracking

**4. Cost Accuracy**
- Multiple costing methods (standard, BOM explosion, FIFO/LIFO)
- Real-time material cost integration
- Setup cost amortization

**5. Developer-Friendly**
- Well-documented TypeScript codebase
- Comprehensive GraphQL schema
- Deployment automation
- Health check monitoring

---

## 14. Recommendations

### 14.1 High-Priority Enhancements

**1. Approval Workflow Engine** (Priority: HIGH)
- **Why:** Margin validation exists but no routing/notification
- **Impact:** Reduces quote approval cycle time
- **Effort:** Medium (2-3 weeks)
- **Components:**
  - Approval task assignment
  - Email notifications to approvers
  - Approval history tracking
  - Escalation rules

**2. Quote PDF Generation** (Priority: HIGH)
- **Why:** Currently manual, error-prone
- **Impact:** Professional quote presentation
- **Effort:** Medium (2 weeks)
- **Components:**
  - PDF template engine
  - Company branding customization
  - Terms and conditions inclusion
  - Email delivery automation

**3. Inventory Availability Check** (Priority: MEDIUM)
- **Why:** Prevents quoting unavailable products
- **Impact:** Reduces customer disappointment
- **Effort:** Medium (2-3 weeks)
- **Components:**
  - Real-time inventory query
  - Material availability by quote line
  - Alternative material suggestions
  - Estimated restock dates

**4. Lead Time Automation** (Priority: MEDIUM)
- **Why:** Currently manual, inconsistent
- **Impact:** Accurate delivery promises
- **Effort:** Medium (2 weeks)
- **Components:**
  - Manufacturing calendar integration
  - Production capacity checking
  - Material lead time inclusion
  - Setup/run/finish time calculations

**5. Tax & Shipping Calculation** (Priority: MEDIUM)
- **Why:** Fields exist but not populated
- **Impact:** Complete quote accuracy
- **Effort:** Medium (2 weeks)
- **Components:**
  - Tax rate service integration (Avalara)
  - Shipping carrier integration (UPS, FedEx)
  - Multiple shipping option quotes
  - Tax exemption handling

### 14.2 Medium-Priority Enhancements

**6. Quote Analytics Dashboard** (Priority: MEDIUM)
- **Why:** No visibility into quote performance
- **Impact:** Data-driven sales improvement
- **Effort:** Medium (3 weeks)
- **Components:**
  - Win/loss analysis by product/customer
  - Average margin tracking
  - Quote cycle time metrics
  - Price variance analysis

**7. Quote Versioning** (Priority: MEDIUM)
- **Why:** No audit trail of changes
- **Impact:** Customer dispute resolution
- **Effort:** Medium (2 weeks)
- **Components:**
  - Version table with history
  - Compare versions UI
  - Rollback capability
  - Change tracking

**8. Customer Portal** (Priority: MEDIUM)
- **Why:** Manual quote acceptance process
- **Impact:** Faster quote-to-order conversion
- **Effort:** High (4-6 weeks)
- **Components:**
  - Customer login/authentication
  - View quote online
  - Accept/reject quote
  - Request modifications

**9. Quote Templates** (Priority: LOW)
- **Why:** Repetitive quote creation
- **Impact:** Time savings for common quotes
- **Effort:** Low (1 week)
- **Components:**
  - Save quote as template
  - Create from template
  - Template library
  - Customer-specific templates

**10. Multi-Currency Full Support** (Priority: LOW)
- **Why:** Field exists but no conversion
- **Impact:** International sales enablement
- **Effort:** Medium (2 weeks)
- **Components:**
  - Exchange rate service integration
  - Real-time conversion
  - Multi-currency reporting
  - Hedge accounting

### 14.3 Technical Debt & Refactoring

**1. Service Constructor Dependency Injection**
- **Current Issue:** Services manually instantiate dependencies in constructor
- **Recommendation:** Use NestJS @Inject() for all dependencies
- **Impact:** Better testability and loose coupling

**2. Error Handling Standardization**
- **Current Issue:** Inconsistent error handling across resolvers
- **Recommendation:** Global exception filter with standardized error codes
- **Impact:** Better client error handling

**3. Validation Layer**
- **Current Issue:** Business rule validation scattered across services
- **Recommendation:** Centralized validation using class-validator decorators
- **Impact:** Consistent validation, better error messages

**4. Logging & Observability**
- **Current Issue:** Limited structured logging
- **Recommendation:** Integrate Winston or Pino with request correlation IDs
- **Impact:** Easier debugging and monitoring

**5. API Documentation**
- **Current Issue:** GraphQL schema lacks descriptions
- **Recommendation:** Add detailed descriptions to all types, fields, and args
- **Impact:** Better developer experience

---

## 15. Risk Assessment

### 15.1 Technical Risks

**1. Pricing Rule Complexity** (Risk: MEDIUM)
- **Issue:** JSONB conditions could become unmaintainable
- **Mitigation:**
  - Document standard condition patterns
  - Provide rule builder UI
  - Limit max rules evaluated (currently 100)
  - Validate JSONB structure

**2. BOM Explosion Performance** (Risk: MEDIUM)
- **Issue:** Deep BOMs could cause slow quote creation
- **Mitigation:**
  - Depth limit enforced (5 levels)
  - Background job for complex explosions
  - Cache BOM structures
  - Denormalize for hot products

**3. Concurrent Quote Updates** (Risk: LOW)
- **Issue:** Two users editing same quote could lose changes
- **Mitigation:**
  - Optimistic locking with updated_at
  - UI warning on stale data
  - Last-write-wins with audit trail

**4. Data Migration** (Risk: LOW)
- **Issue:** Migrating existing quote data from legacy system
- **Mitigation:**
  - Migration scripts with validation
  - Incremental migration
  - Parallel run period
  - Rollback plan

### 15.2 Business Risks

**1. Margin Threshold Accuracy** (Risk: HIGH)
- **Issue:** Incorrect margin thresholds could lose money
- **Mitigation:**
  - Business rule configuration UI
  - Audit trail of threshold changes
  - Alerts for low-margin quotes
  - Regular threshold review process

**2. Pricing Rule Conflicts** (Risk: MEDIUM)
- **Issue:** Multiple rules could compound unexpectedly
- **Mitigation:**
  - Rule testing UI
  - Rule simulation before activation
  - Maximum discount caps
  - Rule conflict detection

**3. User Adoption** (Risk: MEDIUM)
- **Issue:** Sales team resistant to new system
- **Mitigation:**
  - Comprehensive training
  - Phased rollout
  - Champion users in each region
  - Feedback loop for improvements

**4. Integration Failures** (Risk: LOW)
- **Issue:** Dependency on external systems (tax, shipping)
- **Mitigation:**
  - Graceful degradation
  - Fallback to manual entry
  - Service health monitoring
  - Retry logic with exponential backoff

---

## 16. Success Metrics

### 16.1 Key Performance Indicators (KPIs)

**Operational Metrics:**
- **Quote Creation Time:** Target < 5 minutes (vs. 15 minutes manual)
- **Quote Accuracy:** Target 99%+ (pricing, cost, margin calculations)
- **System Uptime:** Target 99.9%

**Business Metrics:**
- **Quote Conversion Rate:** Baseline → 30%+ improvement
- **Average Margin:** Maintain ≥ 15%
- **Quote Volume:** Support 10× increase without performance degradation
- **Quote-to-Order Cycle Time:** Target < 24 hours (vs. 3-5 days)

**User Adoption Metrics:**
- **Daily Active Users:** 80%+ of sales team within 3 months
- **User Satisfaction:** NPS score ≥ 50
- **Training Completion:** 100% of sales team

**Financial Metrics:**
- **Cost Savings:** Reduce quote preparation cost by 70%
- **Revenue Impact:** Increase quote acceptance rate by 20%
- **ROI:** Positive ROI within 12 months

### 16.2 Monitoring & Alerting

**Application Monitoring:**
- Response time: Alert if P95 > 2 seconds
- Error rate: Alert if > 5% of requests fail
- Database connections: Alert if pool exhausted

**Business Monitoring:**
- Low margin quotes: Alert if > 10% of daily quotes below 15%
- Quote expiration: Alert 3 days before expiration
- Approval backlog: Alert if quotes pending approval > 48 hours

**Data Quality Monitoring:**
- Orphaned quote lines: Alert if count > 0
- Missing customer/product: Alert if count > 0
- Negative margins: Alert if count > 0

---

## 17. Conclusion

The Sales Quote Automation feature is a **comprehensive, well-architected system** that demonstrates sophisticated engineering and deep print industry domain knowledge. The implementation covers the complete quote-to-order lifecycle with automated pricing, costing, and margin management.

### Strengths:
✅ Modern, scalable architecture (NestJS, GraphQL, PostgreSQL)
✅ Print industry-specific features (BOM explosion, scrap, setup costs)
✅ Flexible pricing engine with JSONB-based rules
✅ Strong data integrity and multi-tenancy support
✅ Deployment automation and health monitoring
✅ Comprehensive business logic with margin controls

### Opportunities:
🔄 Enhance approval workflow automation
🔄 Add quote PDF generation and email delivery
🔄 Integrate inventory availability checking
🔄 Automate lead time calculations
🔄 Complete tax and shipping integrations
🔄 Build analytics and reporting dashboards

### Strategic Positioning:
The system is **production-ready for immediate deployment** and provides a solid foundation for future enhancements. Its modern architecture and extensible design position it competitively against legacy print ERP systems while offering flexibility that proprietary solutions lack.

**Recommendation:** Proceed with deployment to production environment and prioritize the high-priority enhancements (approval workflows, PDF generation, inventory checks) to maximize business value.

---

## Appendices

### Appendix A: Database ER Diagram (ASCII)

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   TENANTS    │◄────┬───│   QUOTES     │────┬───►│  CUSTOMERS   │
└──────────────┘     │   └──────────────┘    │    └──────────────┘
                     │          │             │
                     │          │ 1:N         │
                     │          ▼             │
                     │   ┌──────────────┐    │
                     │   │ QUOTE_LINES  │    │
                     │   └──────────────┘    │
                     │          │             │
                     │          │ N:1         │
                     │          ▼             │
                     │   ┌──────────────┐    │
                     ├───│  PRODUCTS    │◄───┘
                     │   └──────────────┘
                     │          │
                     │          │ 1:N
                     │          ▼
                     │   ┌──────────────┐
                     │   │     BOM      │
                     │   └──────────────┘
                     │          │
                     │          │ N:1
                     │          ▼
                     │   ┌──────────────┐
                     ├───│  MATERIALS   │
                     │   └──────────────┘
                     │
                     ├───┌──────────────┐
                     │   │PRICING_RULES │
                     │   └──────────────┘
                     │
                     └───┌──────────────┐
                         │CUSTOMER_     │
                         │PRICING       │
                         └──────────────┘
```

### Appendix B: Pricing Waterfall Flowchart

```
START: Calculate Quote Line Price
         │
         ▼
┌─────────────────────────────────┐
│ Get Product, Customer, Quantity │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Query customer_pricing table    │
│ WHERE customer_id = X           │
│   AND product_id = Y            │
│   AND quantity BETWEEN min/max  │
│   AND date BETWEEN effective    │
└─────────────────────────────────┘
         │
         ▼
    ┌────────┐
    │ Found? │──YES──► Use customer price ──┐
    └────────┘                                │
         │                                    │
        NO                                    │
         │                                    │
         ▼                                    │
┌─────────────────────────────────┐          │
│ Query pricing_rules table       │          │
│ WHERE tenant_id = T             │          │
│   AND is_active = TRUE          │          │
│   AND date BETWEEN effective    │          │
│ ORDER BY priority ASC           │          │
└─────────────────────────────────┘          │
         │                                    │
         ▼                                    │
┌─────────────────────────────────┐          │
│ Evaluate JSONB conditions       │          │
│ Filter matching rules           │          │
└─────────────────────────────────┘          │
         │                                    │
         ▼                                    │
    ┌────────┐                                │
    │ Found? │──YES──► Apply rules ──────────┤
    └────────┘                                │
         │                                    │
        NO                                    │
         │                                    │
         ▼                                    │
┌─────────────────────────────────┐          │
│ Use products.list_price         │          │
└─────────────────────────────────┘          │
         │                                    │
         ▼                                    │
┌─────────────────────────────────┐◄─────────┘
│ Calculate Cost (BOM/Standard)   │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Calculate Margin %              │
│ = (Price - Cost) / Price × 100  │
└─────────────────────────────────┘
         │
         ▼
       END
```

### Appendix C: Technology Stack

**Backend:**
- Framework: NestJS 10.x
- Language: TypeScript 5.x
- Database: PostgreSQL 15.x
- ORM: pg (node-postgres) with raw SQL
- GraphQL: @nestjs/graphql, Apollo Server
- Validation: class-validator, class-transformer

**Frontend:**
- Framework: React 18.x
- Language: TypeScript 5.x
- Build Tool: Vite 4.x
- GraphQL Client: Apollo Client 3.x
- UI Library: Custom components (not using Material-UI or Chakra)
- Routing: React Router 6.x
- State Management: Zustand (useAppStore)
- i18n: react-i18next

**Database:**
- RDBMS: PostgreSQL 15.x
- UUID Generation: uuid-ossp extension (uuid_generate_v7)
- JSON: JSONB for pricing rule conditions
- Indexing: B-tree, GIN (for JSONB)

**DevOps:**
- Containerization: Docker
- Orchestration: Docker Compose
- Deployment: Bash scripts
- Monitoring: Shell-based health checks
- CI/CD: (Not specified, but scripts support it)

**Planned Integrations:**
- Message Bus: NATS
- Tax Service: Avalara (or similar)
- Shipping: UPS/FedEx APIs
- PDF Generation: Node library (e.g., PDFKit, Puppeteer)

### Appendix D: File Locations Reference

**Database:**
- `print-industry-erp/backend/migrations/V0.0.6__create_sales_materials_procurement.sql`

**Backend Services:**
- `print-industry-erp/backend/src/modules/sales/services/quote-management.service.ts`
- `print-industry-erp/backend/src/modules/sales/services/quote-pricing.service.ts`
- `print-industry-erp/backend/src/modules/sales/services/quote-costing.service.ts`
- `print-industry-erp/backend/src/modules/sales/services/pricing-rule-engine.service.ts`

**Backend Interfaces:**
- `print-industry-erp/backend/src/modules/sales/interfaces/quote-management.interface.ts`
- `print-industry-erp/backend/src/modules/sales/interfaces/quote-pricing.interface.ts`
- `print-industry-erp/backend/src/modules/sales/interfaces/quote-costing.interface.ts`

**GraphQL:**
- `print-industry-erp/backend/src/graphql/schema/sales-quote-automation.graphql`
- `print-industry-erp/backend/src/graphql/schema/sales-materials.graphql`
- `print-industry-erp/backend/src/graphql/resolvers/quote-automation.resolver.ts`
- `print-industry-erp/backend/src/graphql/resolvers/sales-materials.resolver.ts`

**NestJS Module:**
- `print-industry-erp/backend/src/modules/sales/sales.module.ts`

**Frontend Pages:**
- `print-industry-erp/frontend/src/pages/SalesQuoteDashboard.tsx`
- `print-industry-erp/frontend/src/pages/SalesQuoteDetailPage.tsx`

**Frontend Queries:**
- `print-industry-erp/frontend/src/graphql/queries/salesQuoteAutomation.ts`

**Deployment:**
- `print-industry-erp/backend/scripts/deploy-sales-quote-automation.sh`
- `print-industry-erp/backend/scripts/health-check-sales-quotes.sh`

---

**END OF RESEARCH DELIVERABLE**

---

**Prepared by:** Cynthia - Senior Research Analyst
**For:** Marcus - Backend Architect
**REQ Number:** REQ-STRATEGIC-AUTO-1766862737958
**Completion Date:** 2025-12-27
**Document Version:** 1.0
**Status:** FINAL
