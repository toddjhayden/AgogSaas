# Sales Quote Automation - Research Deliverable
**REQ-STRATEGIC-AUTO-1735249200000**
**Agent:** Cynthia (Research Specialist)
**Date:** 2025-12-26
**Assigned To:** Marcus (Implementation)

---

## Executive Summary

This research deliverable provides a comprehensive analysis of implementing automated sales quote generation for the print industry ERP system. The analysis covers industry best practices, existing system capabilities, technical architecture design, and detailed implementation recommendations.

**Key Findings:**
- The existing system has a complete database schema for quotes with margin calculation support
- GraphQL schema and basic resolvers are already defined but service layer logic is missing
- Industry leaders report 36% reduction in errors and 35% improvement in customer experience with CPQ automation
- Critical features needed: cost calculation engine, pricing rules automation, quote-to-order conversion, and margin analysis

---

## 1. Current System Analysis

### 1.1 Existing Database Schema

The system already has a robust database foundation for sales quotes:

**Tables Available:**
- `quotes` - Main quote header with status tracking, margin calculation, and conversion tracking
- `quote_lines` - Quote line items with costing and margin tracking per line
- `customers` - Customer master with pricing tiers and credit limits
- `customer_pricing` - Customer-specific pricing with quantity breaks
- `pricing_rules` - Dynamic pricing rules engine with conditions and actions
- `products` - Product master with standard costs
- `materials` - Material master with costing methods (FIFO, LIFO, AVERAGE, STANDARD)
- `bill_of_materials` - BOM with scrap allowance for accurate costing

**Key Schema Features:**
```sql
-- Quote header supports:
- Multi-currency (quote_currency_code)
- Margin tracking (total_cost, margin_amount, margin_percentage)
- Quote lifecycle (status: DRAFT, ISSUED, ACCEPTED, REJECTED, EXPIRED, CONVERTED_TO_ORDER)
- Conversion tracking (converted_to_sales_order_id, converted_at)
- Expiration dates (expiration_date)
- Sales rep assignment (sales_rep_user_id)

-- Quote lines support:
- Line-level costing (unit_cost, line_cost)
- Line-level margins (line_margin, margin_percentage)
- Manufacturing strategy tracking
- Lead time and delivery promises
- Discount management (discount_percentage, discount_amount)
```

### 1.2 Existing GraphQL API

**Schema Location:** `print-industry-erp/backend/src/graphql/schema/sales-materials.graphql`

**Available Types:**
- `Quote` type with all header fields
- `QuoteLine` type with costing and margin fields
- `QuoteStatus` enum (DRAFT, ISSUED, ACCEPTED, REJECTED, EXPIRED, CONVERTED_TO_ORDER)
- `PricingRule` type with rule engine support
- `PricingRuleType` enum (VOLUME_DISCOUNT, CUSTOMER_TIER, PRODUCT_CATEGORY, SEASONAL, PROMOTIONAL, CLEARANCE, CONTRACT_PRICING)
- `PricingAction` enum (PERCENTAGE_DISCOUNT, FIXED_DISCOUNT, FIXED_PRICE, MARKUP_PERCENTAGE)

**Available Queries:**
```graphql
quotes(tenantId, facilityId, customerId, status, salesRepUserId, startDate, endDate)
quote(id)
quoteByNumber(quoteNumber)
pricingRules(tenantId, ruleType, isActive, asOfDate)
customerPricing(tenantId, customerId, productId, asOfDate)
```

**Available Mutations:**
```graphql
createQuote(...)
updateQuote(id, status, expirationDate)
convertQuoteToSalesOrder(quoteId)
createPricingRule(...)
updatePricingRule(...)
```

### 1.3 Resolver Implementation Status

**Resolver Location:** `print-industry-erp/backend/src/graphql/resolvers/sales-materials.resolver.ts`

**Current Status:**
- Resolver class exists (`SalesMaterialsResolver`)
- Basic queries implemented for materials, products, vendors, customers
- Quote-specific queries and mutations are **NOT YET IMPLEMENTED**
- Direct PostgreSQL pool approach used (no ORM)
- Row mappers for snake_case to camelCase conversion established

**Missing Implementation:**
- Quote creation logic with cost calculation
- Quote line management
- Pricing rules engine execution
- Margin calculation logic
- Quote-to-order conversion logic
- Quote validation and approval workflows

---

## 2. Industry Best Practices Analysis

### 2.1 Print Industry Quote Automation Patterns

Based on industry research, leading print ERP systems incorporate these automation capabilities:

**1. Fast and Accurate Quote Generation**
- Real-time quote requests with immediate response
- Automated cost calculations eliminating manual errors
- Template-based quoting for common job types
- Customer self-service portals for standard products

**2. Comprehensive Cost Calculation**
- Material costs with quantity breaks and waste factors
- Labor costs based on production time and rates
- Machine/equipment costs with amortization
- Overhead allocation (fixed and variable)
- Outsourced operations costing
- Commission calculations
- Miscellaneous fees (setup, shipping, handling)

**3. Dynamic Pricing Engine**
- Volume-based discounts
- Customer tier pricing (strategic, preferred, transactional)
- Product category-based rules
- Seasonal and promotional pricing
- Contract pricing enforcement
- Price floor enforcement (minimum margin protection)

**4. Automation Benefits**
- 36% reduction in errors and delays
- 35% improvement in customer experience
- Faster quote turnaround (minutes vs hours/days)
- Consistent pricing across sales team
- Higher quote-to-order conversion rates
- Improved profitability through accurate costing

**5. Integration Requirements**
- Single source of truth database
- Real-time inventory checks
- Current material pricing
- Production capacity consideration
- Sales order system integration
- Customer portal integration

**6. Quote-to-Order Workflow**
- One-click conversion from quote to BOM and sales order
- Automatic production order generation
- Artwork proofing workflow integration
- Credit limit checks before conversion
- Inventory reservation upon conversion

### 2.2 Leading Solutions Analysis

**Commercial Print Estimating Systems:**

1. **iQuote**
   - Advanced estimating with production planning
   - Multiple input methods (direct entry, spreadsheet, API)
   - Automatic best-path selection through facilities
   - Real-time pricing and job creation

2. **PrintPLANR**
   - Automated material and press cost calculation
   - Automatic margin application
   - Instant quote delivery
   - Digital print specialization

3. **PressWise**
   - Browser-based estimating engine
   - Customer self-service quoting
   - Consistent quote generation
   - Instant job conversion
   - 24/7 customer access

4. **Ordant**
   - Super-fast estimating (seconds)
   - Advanced automation logic
   - Customizable templates
   - Error elimination

**Common Capabilities:**
- Advanced algorithms for cost breakdowns
- Real-time pricing data access
- Template and configuration management
- Automated error prevention
- Quick conversion to orders

---

## 3. Technical Architecture Design

### 3.1 Service Layer Architecture

**Recommended Service Structure:**

```
src/modules/sales/
├── services/
│   ├── quote-calculation.service.ts      # Core cost/price calculation engine
│   ├── quote-management.service.ts        # Quote CRUD and lifecycle management
│   ├── pricing-rules.service.ts           # Pricing rules engine
│   ├── quote-conversion.service.ts        # Quote-to-order conversion
│   ├── margin-analysis.service.ts         # Margin calculation and analysis
│   └── quote-validation.service.ts        # Business rule validation
├── dto/
│   ├── create-quote.dto.ts
│   ├── update-quote.dto.ts
│   ├── add-quote-line.dto.ts
│   └── convert-quote.dto.ts
└── interfaces/
    ├── quote-calculation.interface.ts
    ├── pricing-context.interface.ts
    └── cost-breakdown.interface.ts
```

### 3.2 Quote Calculation Engine Design

**Core Calculation Flow:**

```typescript
interface QuoteCalculationRequest {
  tenantId: string;
  customerId: string;
  facilityId: string;
  lines: QuoteLineInput[];
  requestedDeliveryDate?: Date;
}

interface QuoteLineInput {
  productId: string;
  quantity: number;
  specifications?: JSON;
}

interface CostBreakdown {
  materialCost: number;
  laborCost: number;
  machineCost: number;
  overheadCost: number;
  outsourcedCost: number;
  setupCost: number;
  totalCost: number;
}

interface PricingResult {
  listPrice: number;
  appliedDiscounts: AppliedDiscount[];
  netPrice: number;
  margin: number;
  marginPercentage: number;
}

class QuoteCalculationService {
  // Calculate costs for a quote line
  async calculateLineCost(
    productId: string,
    quantity: number,
    facilityId: string
  ): Promise<CostBreakdown>

  // Apply pricing rules and calculate price
  async calculateLinePrice(
    productId: string,
    customerId: string,
    quantity: number,
    costBreakdown: CostBreakdown,
    asOfDate: Date
  ): Promise<PricingResult>

  // Calculate full quote with all lines
  async calculateQuote(
    request: QuoteCalculationRequest
  ): Promise<CalculatedQuote>
}
```

### 3.3 Costing Algorithm

**Step-by-Step Calculation Process:**

**1. Material Cost Calculation:**
```typescript
async calculateMaterialCost(productId: string, quantity: number): Promise<number> {
  // Get BOM for product
  const bom = await this.getBillOfMaterials(productId);

  let totalMaterialCost = 0;

  for (const component of bom) {
    // Get current material cost
    const material = await this.getMaterial(component.materialId);

    // Calculate required quantity with scrap
    const requiredQty = quantity * component.quantityPerParent;
    const scrapFactor = 1 + (component.scrapPercentage || 0) / 100;
    const totalQty = requiredQty * scrapFactor;

    // Apply costing method (FIFO, LIFO, AVERAGE, STANDARD)
    const unitCost = this.getMaterialCost(material);

    totalMaterialCost += totalQty * unitCost;
  }

  return totalMaterialCost;
}
```

**2. Labor Cost Calculation:**
```typescript
async calculateLaborCost(productId: string, quantity: number): Promise<number> {
  // Get product routing/production time
  const product = await this.getProduct(productId);
  const standardTimeHours = product.standardProductionTimeHours;

  // Get labor rate (could be facility-specific or operation-specific)
  const laborRate = await this.getLaborRate(product.facilityId);

  // Calculate setup time (fixed) + run time (variable)
  const setupTime = await this.getSetupTime(productId);
  const runTime = standardTimeHours * quantity;

  return (setupTime + runTime) * laborRate;
}
```

**3. Machine/Overhead Cost Calculation:**
```typescript
async calculateMachineAndOverhead(
  productId: string,
  quantity: number
): Promise<{ machineCost: number; overheadCost: number }> {
  const product = await this.getProduct(productId);

  // Machine cost (hourly rate * production time)
  const machineHourlyRate = await this.getMachineRate(product.defaultRoutingId);
  const productionHours = product.standardProductionTimeHours * quantity;
  const machineCost = productionHours * machineHourlyRate;

  // Overhead (typically % of material + labor or fixed allocation)
  const overheadRate = await this.getOverheadRate(product.facilityId);
  const overheadCost = (materialCost + laborCost) * overheadRate;

  return { machineCost, overheadCost };
}
```

### 3.4 Pricing Rules Engine

**Pricing Rules Evaluation Logic:**

```typescript
interface PricingRule {
  ruleType: PricingRuleType;
  priority: number;
  conditions: {
    customerTier?: string[];
    productCategory?: string[];
    minimumQuantity?: number;
    maximumQuantity?: number;
    startDate?: Date;
    endDate?: Date;
  };
  pricingAction: PricingAction;
  actionValue: number;
}

class PricingRulesService {
  async applyPricingRules(
    context: PricingContext,
    basePrice: number
  ): Promise<PricingResult> {
    // Get applicable rules sorted by priority
    const rules = await this.getApplicableRules(context);

    let currentPrice = basePrice;
    const appliedDiscounts: AppliedDiscount[] = [];

    for (const rule of rules) {
      if (this.evaluateConditions(rule.conditions, context)) {
        const { newPrice, discount } = this.applyRule(
          rule,
          currentPrice,
          basePrice
        );

        currentPrice = newPrice;
        appliedDiscounts.push(discount);
      }
    }

    return {
      listPrice: basePrice,
      appliedDiscounts,
      netPrice: currentPrice,
      margin: currentPrice - context.totalCost,
      marginPercentage: ((currentPrice - context.totalCost) / currentPrice) * 100
    };
  }

  private applyRule(
    rule: PricingRule,
    currentPrice: number,
    basePrice: number
  ): { newPrice: number; discount: AppliedDiscount } {
    let newPrice = currentPrice;
    let discountAmount = 0;

    switch (rule.pricingAction) {
      case PricingAction.PERCENTAGE_DISCOUNT:
        discountAmount = currentPrice * (rule.actionValue / 100);
        newPrice = currentPrice - discountAmount;
        break;

      case PricingAction.FIXED_DISCOUNT:
        discountAmount = rule.actionValue;
        newPrice = currentPrice - discountAmount;
        break;

      case PricingAction.FIXED_PRICE:
        newPrice = rule.actionValue;
        discountAmount = currentPrice - newPrice;
        break;

      case PricingAction.MARKUP_PERCENTAGE:
        // Apply markup to cost, not current price
        newPrice = context.totalCost * (1 + rule.actionValue / 100);
        discountAmount = currentPrice - newPrice;
        break;
    }

    return {
      newPrice,
      discount: {
        ruleName: rule.ruleName,
        ruleType: rule.ruleType,
        discountAmount,
        discountPercentage: (discountAmount / basePrice) * 100
      }
    };
  }
}
```

### 3.5 Quote Lifecycle Management

**State Transitions:**

```typescript
enum QuoteStatus {
  DRAFT = 'DRAFT',                     // Initial creation, editable
  ISSUED = 'ISSUED',                   // Sent to customer, read-only
  ACCEPTED = 'ACCEPTED',               // Customer accepted
  REJECTED = 'REJECTED',               // Customer rejected
  EXPIRED = 'EXPIRED',                 // Past expiration date
  CONVERTED_TO_ORDER = 'CONVERTED_TO_ORDER'  // Converted to sales order
}

class QuoteManagementService {
  async updateQuoteStatus(
    quoteId: string,
    newStatus: QuoteStatus,
    userId: string
  ): Promise<Quote> {
    const quote = await this.getQuote(quoteId);

    // Validate transition
    this.validateStatusTransition(quote.status, newStatus);

    // Perform status-specific actions
    switch (newStatus) {
      case QuoteStatus.ISSUED:
        await this.onQuoteIssued(quote);
        break;

      case QuoteStatus.EXPIRED:
        await this.onQuoteExpired(quote);
        break;

      case QuoteStatus.ACCEPTED:
        await this.onQuoteAccepted(quote);
        break;
    }

    // Update status
    return this.db.query(
      `UPDATE quotes
       SET status = $1, updated_at = NOW(), updated_by = $2
       WHERE id = $3
       RETURNING *`,
      [newStatus, userId, quoteId]
    );
  }

  private validateStatusTransition(
    currentStatus: QuoteStatus,
    newStatus: QuoteStatus
  ): void {
    const validTransitions: Record<QuoteStatus, QuoteStatus[]> = {
      [QuoteStatus.DRAFT]: [QuoteStatus.ISSUED],
      [QuoteStatus.ISSUED]: [QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED],
      [QuoteStatus.ACCEPTED]: [QuoteStatus.CONVERTED_TO_ORDER],
      [QuoteStatus.REJECTED]: [],
      [QuoteStatus.EXPIRED]: [],
      [QuoteStatus.CONVERTED_TO_ORDER]: []
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }
}
```

### 3.6 Quote-to-Order Conversion

**Conversion Process:**

```typescript
class QuoteConversionService {
  async convertQuoteToSalesOrder(
    quoteId: string,
    userId: string
  ): Promise<{ quote: Quote; salesOrder: SalesOrder }> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // 1. Validate quote can be converted
      const quote = await this.validateQuoteForConversion(quoteId, client);

      // 2. Validate customer credit
      await this.validateCustomerCredit(quote.customerId, quote.totalAmount, client);

      // 3. Create sales order header
      const salesOrder = await this.createSalesOrderFromQuote(quote, client);

      // 4. Create sales order lines
      await this.createSalesOrderLines(quote, salesOrder.id, client);

      // 5. Update quote status
      await client.query(
        `UPDATE quotes
         SET status = $1,
             converted_to_sales_order_id = $2,
             converted_at = NOW(),
             updated_by = $3
         WHERE id = $4`,
        [QuoteStatus.CONVERTED_TO_ORDER, salesOrder.id, userId, quoteId]
      );

      // 6. Reserve inventory (if applicable)
      await this.reserveInventory(salesOrder.id, client);

      // 7. Create production orders (if make-to-order)
      await this.createProductionOrders(salesOrder.id, client);

      await client.query('COMMIT');

      return {
        quote: await this.getQuote(quoteId),
        salesOrder
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async validateQuoteForConversion(
    quoteId: string,
    client: any
  ): Promise<Quote> {
    const result = await client.query(
      `SELECT * FROM quotes WHERE id = $1`,
      [quoteId]
    );

    const quote = result.rows[0];

    if (!quote) {
      throw new Error('Quote not found');
    }

    if (quote.status !== QuoteStatus.ACCEPTED) {
      throw new Error('Only ACCEPTED quotes can be converted');
    }

    if (quote.expiration_date && new Date(quote.expiration_date) < new Date()) {
      throw new Error('Quote has expired');
    }

    return quote;
  }

  private async validateCustomerCredit(
    customerId: string,
    orderAmount: number,
    client: any
  ): Promise<void> {
    const result = await client.query(
      `SELECT credit_limit, credit_hold,
              (SELECT COALESCE(SUM(total_amount), 0)
               FROM sales_orders
               WHERE customer_id = $1
                 AND status IN ('CONFIRMED', 'IN_PRODUCTION', 'SHIPPED')) as current_balance
       FROM customers
       WHERE id = $1`,
      [customerId]
    );

    const customer = result.rows[0];

    if (customer.credit_hold) {
      throw new Error('Customer is on credit hold');
    }

    const availableCredit = customer.credit_limit - customer.current_balance;

    if (orderAmount > availableCredit) {
      throw new Error(
        `Order amount exceeds available credit. ` +
        `Available: ${availableCredit}, Required: ${orderAmount}`
      );
    }
  }
}
```

---

## 4. Implementation Requirements

### 4.1 Core Services to Implement

**Priority 1: Quote Calculation Engine**
- `QuoteCalculationService` - Core cost and price calculation
- Material cost calculation with BOM explosion
- Labor cost calculation with routing
- Machine and overhead allocation
- Total cost rollup
- **Estimated Complexity:** High
- **Estimated Effort:** 5-7 days

**Priority 2: Pricing Rules Engine**
- `PricingRulesService` - Dynamic pricing rules evaluation
- Rule condition evaluation
- Multi-rule application with priority
- Customer tier pricing
- Volume discount calculation
- **Estimated Complexity:** Medium-High
- **Estimated Effort:** 3-4 days

**Priority 3: Quote Management Service**
- `QuoteManagementService` - CRUD and lifecycle
- Quote creation with validation
- Quote line management
- Status transition management
- Quote versioning (if needed)
- **Estimated Complexity:** Medium
- **Estimated Effort:** 3-4 days

**Priority 4: Quote Conversion Service**
- `QuoteConversionService` - Quote-to-order conversion
- Validation logic (credit, expiration, status)
- Sales order creation
- Production order triggering
- Inventory reservation
- **Estimated Complexity:** Medium
- **Estimated Effort:** 2-3 days

**Priority 5: Margin Analysis Service**
- `MarginAnalysisService` - Profitability analysis
- Line-level margin calculation
- Quote-level margin rollup
- Margin threshold validation
- Historical margin comparison
- **Estimated Complexity:** Low-Medium
- **Estimated Effort:** 1-2 days

### 4.2 GraphQL Resolver Enhancements

**Queries to Implement:**
```graphql
type Query {
  # Calculate quote without saving
  calculateQuote(input: QuoteCalculationInput!): CalculatedQuoteResult!

  # Get quote with calculated margins
  quoteWithAnalysis(id: ID!): QuoteAnalysis!

  # Get applicable pricing rules for context
  applicablePricingRules(
    customerId: ID!
    productId: ID!
    quantity: Float!
    asOfDate: Date
  ): [PricingRule!]!
}
```

**Mutations to Implement:**
```graphql
type Mutation {
  # Create quote with lines
  createQuoteWithLines(input: CreateQuoteInput!): Quote!

  # Add line to existing quote
  addQuoteLine(quoteId: ID!, line: QuoteLineInput!): QuoteLine!

  # Update quote line
  updateQuoteLine(id: ID!, updates: QuoteLineUpdateInput!): QuoteLine!

  # Recalculate quote costs and prices
  recalculateQuote(id: ID!): Quote!

  # Issue quote to customer
  issueQuote(id: ID!): Quote!

  # Accept/reject quote
  acceptQuote(id: ID!, acceptedBy: ID!): Quote!
  rejectQuote(id: ID!, reason: String): Quote!

  # Convert to sales order
  convertQuoteToSalesOrder(quoteId: ID!): ConversionResult!
}
```

### 4.3 Database Enhancements

**New Tables Needed:**

```sql
-- Quote calculation audit trail
CREATE TABLE quote_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    quote_id UUID NOT NULL,

    -- Calculation details
    calculation_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_material_cost DECIMAL(18,4),
    total_labor_cost DECIMAL(18,4),
    total_machine_cost DECIMAL(18,4),
    total_overhead_cost DECIMAL(18,4),
    total_cost DECIMAL(18,4),

    -- Pricing details
    list_price DECIMAL(18,4),
    applied_discounts JSONB,
    final_price DECIMAL(18,4),

    -- Margin
    margin_amount DECIMAL(18,4),
    margin_percentage DECIMAL(8,4),

    -- Calculation inputs snapshot
    pricing_rules_applied JSONB,
    cost_breakdown JSONB,

    CONSTRAINT fk_quote_calc_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_quote_calc_quote FOREIGN KEY (quote_id) REFERENCES quotes(id)
);

CREATE INDEX idx_quote_calculations_quote ON quote_calculations(quote_id);
CREATE INDEX idx_quote_calculations_timestamp ON quote_calculations(calculation_timestamp);

-- Pricing rule application history
CREATE TABLE pricing_rule_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    quote_id UUID,
    quote_line_id UUID,
    pricing_rule_id UUID NOT NULL,

    -- Application details
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    base_price DECIMAL(18,4),
    discount_amount DECIMAL(18,4),
    final_price DECIMAL(18,4),

    -- Context
    customer_id UUID,
    product_id UUID,
    quantity DECIMAL(18,4),

    CONSTRAINT fk_pricing_app_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_pricing_app_quote FOREIGN KEY (quote_id) REFERENCES quotes(id),
    CONSTRAINT fk_pricing_app_rule FOREIGN KEY (pricing_rule_id) REFERENCES pricing_rules(id)
);

CREATE INDEX idx_pricing_app_quote ON pricing_rule_applications(quote_id);
CREATE INDEX idx_pricing_app_rule ON pricing_rule_applications(pricing_rule_id);
```

**Schema Modifications:**

```sql
-- Add missing indexes for performance
CREATE INDEX idx_quotes_expiration ON quotes(expiration_date)
  WHERE status IN ('DRAFT', 'ISSUED');

CREATE INDEX idx_quote_lines_quote_line_number ON quote_lines(quote_id, line_number);

-- Add constraint to prevent duplicate line numbers
ALTER TABLE quote_lines
  ADD CONSTRAINT uq_quote_lines_quote_line_number
  UNIQUE (quote_id, line_number);

-- Add check constraint for margin percentage
ALTER TABLE quotes
  ADD CONSTRAINT chk_quotes_margin_percentage
  CHECK (margin_percentage >= -100 AND margin_percentage <= 100);

ALTER TABLE quote_lines
  ADD CONSTRAINT chk_quote_lines_margin_percentage
  CHECK (margin_percentage >= -100 AND margin_percentage <= 100);
```

### 4.4 Configuration Data Setup

**Pricing Rules to Seed:**

```typescript
// Example pricing rules for different scenarios
const defaultPricingRules = [
  {
    ruleCode: 'VOLUME_TIER_1',
    ruleName: 'Volume Discount - Tier 1 (1000-4999)',
    ruleType: 'VOLUME_DISCOUNT',
    priority: 10,
    conditions: {
      minimumQuantity: 1000,
      maximumQuantity: 4999
    },
    pricingAction: 'PERCENTAGE_DISCOUNT',
    actionValue: 5.0,
    effectiveFrom: '2025-01-01',
    isActive: true
  },
  {
    ruleCode: 'VOLUME_TIER_2',
    ruleName: 'Volume Discount - Tier 2 (5000-9999)',
    ruleType: 'VOLUME_DISCOUNT',
    priority: 10,
    conditions: {
      minimumQuantity: 5000,
      maximumQuantity: 9999
    },
    pricingAction: 'PERCENTAGE_DISCOUNT',
    actionValue: 10.0,
    effectiveFrom: '2025-01-01',
    isActive: true
  },
  {
    ruleCode: 'STRATEGIC_CUSTOMER',
    ruleName: 'Strategic Customer Pricing',
    ruleType: 'CUSTOMER_TIER',
    priority: 5,
    conditions: {
      customerTier: ['STRATEGIC']
    },
    pricingAction: 'PERCENTAGE_DISCOUNT',
    actionValue: 15.0,
    effectiveFrom: '2025-01-01',
    isActive: true
  }
];
```

**System Configuration:**

```typescript
// Quote configuration settings
const quoteConfig = {
  // Default quote expiration days
  defaultExpirationDays: 30,

  // Minimum margin percentage allowed
  minimumMarginPercentage: 15.0,

  // Margin warning threshold
  marginWarningThreshold: 20.0,

  // Auto-expire quotes
  autoExpireQuotes: true,

  // Require approval for low margin
  requireApprovalBelowMargin: 15.0,

  // Default tax rate (if not customer-specific)
  defaultTaxRate: 0.0,

  // Include tax in quote total
  includeTaxInTotal: true,

  // Pricing precision (decimal places)
  pricingPrecision: 2,

  // Cost precision (decimal places)
  costPrecision: 4
};
```

### 4.5 Testing Requirements

**Unit Tests:**
- Cost calculation logic with various BOM scenarios
- Pricing rule evaluation with multiple conditions
- Margin calculation accuracy
- Status transition validation
- Credit limit validation

**Integration Tests:**
- Full quote creation flow
- Quote-to-order conversion
- Multi-line quote calculations
- Pricing rule stacking/priority
- Transaction rollback scenarios

**Test Data Requirements:**
- Sample customers with different tiers
- Sample products with BOMs
- Sample materials with costs
- Sample pricing rules
- Sample quotes at various statuses

---

## 5. API Usage Examples

### 5.1 Create Quote with Automated Calculation

```graphql
mutation CreateQuote {
  createQuoteWithLines(
    input: {
      tenantId: "550e8400-e29b-41d4-a716-446655440000"
      facilityId: "660e8400-e29b-41d4-a716-446655440001"
      customerId: "770e8400-e29b-41d4-a716-446655440002"
      quoteDate: "2025-12-26"
      expirationDate: "2026-01-25"
      quoteCurrencyCode: "USD"
      salesRepUserId: "880e8400-e29b-41d4-a716-446655440003"
      lines: [
        {
          productId: "990e8400-e29b-41d4-a716-446655440004"
          quantity: 5000
          specifications: {
            finish: "gloss"
            substrate: "80lb coated"
          }
        }
        {
          productId: "990e8400-e29b-41d4-a716-446655440005"
          quantity: 2500
        }
      ]
    }
  ) {
    id
    quoteNumber
    status
    subtotal
    taxAmount
    totalAmount
    totalCost
    marginAmount
    marginPercentage
    lines {
      id
      lineNumber
      productCode
      description
      quantity
      unitCost
      unitPrice
      lineCost
      lineAmount
      lineMargin
      marginPercentage
      leadTimeDays
    }
  }
}
```

### 5.2 Calculate Quote Without Saving

```graphql
query CalculateQuote {
  calculateQuote(
    input: {
      tenantId: "550e8400-e29b-41d4-a716-446655440000"
      customerId: "770e8400-e29b-41d4-a716-446655440002"
      lines: [
        {
          productId: "990e8400-e29b-41d4-a716-446655440004"
          quantity: 10000
        }
      ]
    }
  ) {
    estimatedTotal
    estimatedCost
    estimatedMargin
    estimatedMarginPercentage
    lines {
      productId
      quantity
      costBreakdown {
        materialCost
        laborCost
        machineCost
        overheadCost
        totalCost
      }
      pricingBreakdown {
        listPrice
        appliedDiscounts {
          ruleName
          discountAmount
          discountPercentage
        }
        netPrice
      }
      margin
      marginPercentage
      leadTimeDays
    }
    appliedPricingRules {
      id
      ruleName
      ruleType
      discountAmount
    }
  }
}
```

### 5.3 Convert Quote to Sales Order

```graphql
mutation ConvertQuote {
  convertQuoteToSalesOrder(quoteId: "aa0e8400-e29b-41d4-a716-446655440006") {
    quote {
      id
      quoteNumber
      status
      convertedToSalesOrderId
      convertedAt
    }
    salesOrder {
      id
      salesOrderNumber
      status
      totalAmount
      lines {
        id
        lineNumber
        productCode
        quantityOrdered
        unitPrice
        lineAmount
        productionOrderId
      }
    }
    productionOrders {
      id
      productionOrderNumber
      productId
      quantityToMake
      status
    }
  }
}
```

---

## 6. Integration Points

### 6.1 Required Integrations

**1. Customer Master Integration**
- Customer credit limit validation
- Customer pricing tier retrieval
- Customer-specific pricing rules
- Credit hold status check
- Payment terms retrieval

**2. Product Master Integration**
- Product standard costs
- Product pricing
- BOM explosion
- Routing/production time
- Lead time calculation

**3. Inventory Integration**
- Material availability check
- Current material costs
- Inventory reservation on conversion
- Warehouse location assignment

**4. Production Integration**
- Production order creation
- Capacity availability check
- Lead time estimation
- Routing selection

**5. Accounting/Finance Integration**
- GL account assignment
- Revenue recognition
- Cost of goods sold tracking
- Commission calculation

### 6.2 External System Integrations

**Customer Portal Integration:**
- Self-service quote request
- Quote status tracking
- Quote acceptance/rejection
- Historical quote retrieval

**Email Notification System:**
- Quote issued notification
- Quote expiration warning
- Quote acceptance confirmation
- Conversion confirmation

**Document Generation:**
- PDF quote generation
- Terms and conditions inclusion
- Pricing breakdown display
- Company branding

---

## 7. Performance Considerations

### 7.1 Caching Strategy

**Cache Candidates:**
- Material costs (5-minute TTL)
- Customer pricing tiers (15-minute TTL)
- Pricing rules (1-hour TTL, invalidate on update)
- BOM data (1-hour TTL, invalidate on update)
- Product routing (1-hour TTL)

**Implementation:**
```typescript
class QuoteCalculationService {
  private readonly cache: CacheManager;

  async getMaterialCost(materialId: string): Promise<number> {
    const cacheKey = `material:cost:${materialId}`;

    let cost = await this.cache.get<number>(cacheKey);

    if (cost === undefined) {
      cost = await this.fetchMaterialCostFromDB(materialId);
      await this.cache.set(cacheKey, cost, { ttl: 300 }); // 5 minutes
    }

    return cost;
  }
}
```

### 7.2 Query Optimization

**Materialized Views:**
```sql
-- Pre-calculate current material costs
CREATE MATERIALIZED VIEW mv_current_material_costs AS
SELECT
    m.id as material_id,
    m.material_code,
    CASE m.costing_method
        WHEN 'STANDARD' THEN m.standard_cost
        WHEN 'AVERAGE' THEN m.average_cost
        WHEN 'FIFO' THEN m.last_cost
        WHEN 'LIFO' THEN m.last_cost
        ELSE m.standard_cost
    END as current_cost,
    m.cost_currency_code,
    m.primary_uom
FROM materials m
WHERE m.is_active = TRUE
  AND m.is_current_version = TRUE
  AND m.deleted_at IS NULL;

CREATE UNIQUE INDEX idx_mv_material_costs_id ON mv_current_material_costs(material_id);

-- Refresh strategy
CREATE OR REPLACE FUNCTION refresh_material_costs()
RETURNS trigger AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_current_material_costs;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_material_costs
AFTER INSERT OR UPDATE OF standard_cost, average_cost, last_cost
ON materials
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_material_costs();
```

### 7.3 Batch Processing

**Bulk Quote Calculation:**
```typescript
class QuoteCalculationService {
  async calculateQuoteBatch(
    quotes: QuoteCalculationRequest[]
  ): Promise<CalculatedQuote[]> {
    // Collect all unique product IDs
    const productIds = [...new Set(
      quotes.flatMap(q => q.lines.map(l => l.productId))
    )];

    // Batch fetch all BOMs
    const boms = await this.getBatchBillOfMaterials(productIds);

    // Batch fetch all material costs
    const materialIds = [...new Set(
      boms.flatMap(b => b.components.map(c => c.materialId))
    )];
    const materialCosts = await this.getBatchMaterialCosts(materialIds);

    // Calculate all quotes with pre-fetched data
    return Promise.all(
      quotes.map(q => this.calculateQuoteWithCache(q, boms, materialCosts))
    );
  }
}
```

---

## 8. Security Considerations

### 8.1 Authorization Rules

**Quote Operations:**
- **Create Quote:** Sales Rep, Sales Manager roles
- **Update Quote (DRAFT):** Quote creator, Sales Manager
- **Issue Quote:** Quote creator, Sales Manager
- **Accept/Reject Quote:** Customer portal user, Sales Manager
- **Convert to Order:** Sales Manager, Order Entry role
- **View Quote:** Quote creator, assigned sales rep, customer

**Pricing Rules:**
- **View Pricing Rules:** Sales Rep, Sales Manager
- **Create/Update Rules:** Pricing Manager only
- **Delete Rules:** Pricing Manager with approval

### 8.2 Tenant Isolation

**Row-Level Security:**
```sql
-- Enable RLS on quotes
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY quotes_tenant_isolation ON quotes
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Enable RLS on quote_lines
ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY quote_lines_tenant_isolation ON quote_lines
    USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 8.3 Audit Trail

**Quote Change Tracking:**
```sql
CREATE TABLE quote_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    quote_id UUID NOT NULL,

    -- Change details
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by UUID NOT NULL,
    change_type VARCHAR(50) NOT NULL, -- CREATED, UPDATED, STATUS_CHANGED, CONVERTED

    -- Before/after snapshot
    old_values JSONB,
    new_values JSONB,

    -- Context
    ip_address INET,
    user_agent TEXT,

    CONSTRAINT fk_quote_audit_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_quote_audit_quote FOREIGN KEY (quote_id) REFERENCES quotes(id),
    CONSTRAINT fk_quote_audit_user FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE INDEX idx_quote_audit_quote ON quote_audit_log(quote_id);
CREATE INDEX idx_quote_audit_timestamp ON quote_audit_log(changed_at);
```

---

## 9. Error Handling

### 9.1 Business Rule Violations

**Common Error Scenarios:**
```typescript
class QuoteValidationException extends Error {
  constructor(
    public code: string,
    public message: string,
    public details?: any
  ) {
    super(message);
  }
}

// Error codes
enum QuoteErrorCode {
  INVALID_CUSTOMER = 'QUOTE_ERR_001',
  CUSTOMER_ON_HOLD = 'QUOTE_ERR_002',
  INVALID_PRODUCT = 'QUOTE_ERR_003',
  INSUFFICIENT_MARGIN = 'QUOTE_ERR_004',
  CREDIT_LIMIT_EXCEEDED = 'QUOTE_ERR_005',
  QUOTE_EXPIRED = 'QUOTE_ERR_006',
  INVALID_STATUS_TRANSITION = 'QUOTE_ERR_007',
  PRICING_RULE_CONFLICT = 'QUOTE_ERR_008',
  BOM_NOT_FOUND = 'QUOTE_ERR_009',
  MATERIAL_COST_UNAVAILABLE = 'QUOTE_ERR_010'
}

// Usage
if (customer.creditHold) {
  throw new QuoteValidationException(
    QuoteErrorCode.CUSTOMER_ON_HOLD,
    `Customer ${customer.customerCode} is on credit hold`,
    { customerId: customer.id, customerCode: customer.customerCode }
  );
}
```

### 9.2 Calculation Failures

**Fallback Strategies:**
```typescript
async calculateLineCost(
  productId: string,
  quantity: number
): Promise<CostBreakdown> {
  try {
    // Primary calculation method
    return await this.calculateFromBOM(productId, quantity);
  } catch (bomError) {
    this.logger.warn(`BOM calculation failed: ${bomError.message}`);

    try {
      // Fallback to standard cost
      return await this.calculateFromStandardCost(productId, quantity);
    } catch (standardCostError) {
      this.logger.error(`All cost calculation methods failed`);

      // Last resort: use product list price with default margin
      return await this.estimateFromListPrice(productId, quantity);
    }
  }
}
```

---

## 10. Monitoring and Metrics

### 10.1 Key Performance Indicators

**Quote Metrics:**
- Quote creation time (target: < 5 seconds)
- Quote calculation accuracy (target: 99.5%)
- Quote-to-order conversion rate
- Average margin percentage
- Low margin quote frequency
- Quote expiration rate

**System Performance:**
- Average quote calculation time
- Cache hit rate
- Database query performance
- API response time (p50, p95, p99)

### 10.2 Monitoring Implementation

```typescript
class QuoteMetricsService {
  async trackQuoteCreation(quote: Quote, calculationTimeMs: number): Promise<void> {
    await this.metrics.record('quote.created', 1, {
      tenantId: quote.tenantId,
      calculationTime: calculationTimeMs,
      lineCount: quote.lines.length,
      totalAmount: quote.totalAmount,
      marginPercentage: quote.marginPercentage
    });

    if (quote.marginPercentage < this.config.minimumMarginPercentage) {
      await this.metrics.record('quote.low_margin', 1, {
        tenantId: quote.tenantId,
        marginPercentage: quote.marginPercentage
      });
    }
  }

  async trackQuoteConversion(quote: Quote, salesOrder: SalesOrder): Promise<void> {
    const quoteAge = differenceInDays(
      salesOrder.createdAt,
      quote.createdAt
    );

    await this.metrics.record('quote.converted', 1, {
      tenantId: quote.tenantId,
      quoteAge,
      orderValue: salesOrder.totalAmount
    });
  }
}
```

---

## 11. Implementation Roadmap

### Phase 1: Core Calculation Engine (Week 1-2)
**Deliverables:**
- `QuoteCalculationService` with BOM-based costing
- Material cost calculation
- Labor cost calculation
- Machine and overhead allocation
- Basic margin calculation
- Unit tests for calculation logic

**Success Criteria:**
- Accurate cost calculation for products with BOMs
- Calculation time < 5 seconds for 10-line quotes
- All unit tests passing

### Phase 2: Pricing Rules Engine (Week 2-3)
**Deliverables:**
- `PricingRulesService` implementation
- Rule condition evaluation
- Multi-rule priority handling
- Customer tier pricing
- Volume discount calculation
- Integration with calculation engine

**Success Criteria:**
- Pricing rules apply correctly based on conditions
- Multiple rules stack properly according to priority
- Customer-specific pricing overrides work

### Phase 3: Quote Management (Week 3-4)
**Deliverables:**
- `QuoteManagementService` implementation
- GraphQL resolver methods for quote CRUD
- Quote line management
- Status lifecycle management
- Validation logic
- Audit trail implementation

**Success Criteria:**
- Full CRUD operations working via GraphQL
- Status transitions enforced correctly
- Validation prevents invalid data

### Phase 4: Quote Conversion (Week 4-5)
**Deliverables:**
- `QuoteConversionService` implementation
- Quote-to-order conversion workflow
- Credit validation
- Sales order creation
- Production order triggering
- Inventory reservation

**Success Criteria:**
- Successful quote-to-order conversion
- Transaction rollback on failures
- All business rules enforced

### Phase 5: Testing and Optimization (Week 5-6)
**Deliverables:**
- Comprehensive integration tests
- Performance optimization
- Caching implementation
- Load testing
- Documentation

**Success Criteria:**
- All integration tests passing
- API response times meet targets
- Cache hit rate > 80%
- Documentation complete

---

## 12. Risk Analysis

### High Risk Items

**1. Complex BOM Calculations**
- **Risk:** Multi-level BOMs with substitutions could cause calculation errors
- **Mitigation:** Implement BOM explosion algorithm with circular reference detection
- **Fallback:** Use standard costs if BOM calculation fails

**2. Pricing Rule Conflicts**
- **Risk:** Multiple pricing rules could conflict or produce unexpected results
- **Mitigation:** Clear priority system and rule evaluation order
- **Testing:** Comprehensive test cases for rule combinations

**3. Performance with Large Quotes**
- **Risk:** Quotes with 50+ lines could be slow
- **Mitigation:** Implement caching, batch fetching, and async processing
- **Monitoring:** Track quote calculation times and optimize slow queries

### Medium Risk Items

**4. Data Consistency in Conversions**
- **Risk:** Quote-to-order conversion could fail mid-transaction
- **Mitigation:** Use database transactions with proper rollback
- **Testing:** Test failure scenarios thoroughly

**5. Credit Limit Validation**
- **Risk:** Race conditions in credit limit checks
- **Mitigation:** Use database locks during credit validation
- **Monitoring:** Track credit limit exceptions

---

## 13. Dependencies

### Internal Dependencies
- Materials master data (materials table)
- Product master data (products table)
- BOM data (bill_of_materials table)
- Customer master (customers table)
- User/security system (users, roles)
- Facility data (facilities table)

### External Dependencies
- None identified for Phase 1

### Data Requirements
- Valid material costs
- Complete BOMs for all products
- Customer pricing tiers configured
- Initial pricing rules seeded
- Product standard costs

---

## 14. Success Metrics

### Business Metrics
- **Quote Generation Time:** < 5 seconds for 95% of quotes
- **Quote Accuracy:** 99.5% match between quoted price and final order price
- **Quote-to-Order Conversion Rate:** Track baseline and improvement
- **Margin Compliance:** 95% of quotes meet minimum margin thresholds
- **Quote Expiration Rate:** < 10% of quotes expire without conversion

### Technical Metrics
- **API Response Time (p95):** < 2 seconds for quote calculation
- **Database Query Time (p95):** < 500ms
- **Cache Hit Rate:** > 80% for material costs and pricing rules
- **Test Coverage:** > 85% code coverage
- **Error Rate:** < 0.5% of quote operations fail

### User Satisfaction Metrics
- **Sales Rep Productivity:** Measure quotes per day per rep
- **Customer Response Time:** Time from quote request to delivery
- **Quote Revision Rate:** Number of quote revisions before acceptance

---

## 15. Research Sources

This research deliverable was informed by industry best practices from leading print ERP and CPQ systems:

**Print Industry ERP Solutions:**
- [5 Best ERP Software For The Printing Industry Reviewed in 2025](https://www.hashmicro.com/blog/erp-software-for-printing-industry/)
- [20 Best ERP Software For The Printing Industry Reviewed In 2025](https://thecfoclub.com/tools/best-erp-software-for-printing-industry/)
- [Print MIS/ERP Solutions for the Printing Industry | PrintXpand](https://www.printxpand.com/print-erp-software-solution/)

**Manufacturing CPQ Best Practices:**
- [CPQ Quoting Software for Manufacturing: Pricing & Benefits](https://www.cincom.com/blog/cpq/quoting-software-for-manufacturing/)
- [CPQ for Manufacturing: How to Make Big Reductions in Operational Costs | Experlogix](https://www.experlogix.com/blog/cpq-manufacturing)
- [Manufacturing Sales Quoting and Estimating Software from DELMIAWorks](https://www.solidworks.com/product/delmiaworks/manufacturing-erp/erp/sales-mgmt/salesquotes/)

**Print Estimating Systems:**
- [Digital Print estimating software | Printing estimator software](https://www.printplanr.com/digital-print-estimating-software/)
- [Estimating Software for Printers - iQuote](https://printepssw.com/iquote-print-estimating-software)
- [Best Print Estimating Software 2025 | Capterra](https://www.capterra.com/print-estimating-software/)
- [Print Estimating and Print Quoting Software | PressWise](https://www.presswise.com/about/print-mis/print-estimating/)
- [Best Print Estimating Software 2025 - Reviews on 54+ Tools | GetApp](https://www.getapp.com/industries-software/print-estimating/)

**General Manufacturing Quoting:**
- [10 Best Quoting Software Tools and Solutions in 2025 - PandaDoc](https://www.pandadoc.com/blog/best-quoting-software-tools/)
- [Manufacturing Quoting – Improvement Tips for Small Businesses | MRPeasy](https://www.mrpeasy.com/blog/manufacturing-quoting/)

---

## 16. Recommendations for Implementation Team

### For Marcus (Implementation Lead)

**High Priority Actions:**
1. Start with Phase 1 (Core Calculation Engine) as it's the foundation
2. Implement robust error handling from the start
3. Build comprehensive unit tests alongside code
4. Use TypeScript strict mode for type safety
5. Implement logging/monitoring early

**Architecture Decisions:**
1. Use service layer pattern (not repository pattern) for simplicity
2. Direct SQL with pool connections (matches existing pattern)
3. Implement caching layer for frequently accessed data
4. Use database transactions for multi-step operations
5. Consider async processing for complex calculations if needed

**Code Quality:**
1. Follow existing resolver patterns in `sales-materials.resolver.ts`
2. Use consistent snake_case to camelCase mapping
3. Implement comprehensive input validation
4. Add JSDoc comments for all public methods
5. Use descriptive error messages with error codes

**Testing Strategy:**
1. Unit tests for all calculation logic (TDD approach recommended)
2. Integration tests for full workflows
3. Load test with realistic quote volumes
4. Test edge cases (empty BOMs, missing costs, etc.)

### Technical Decisions to Make

**1. Async vs Sync Processing:**
- **Recommendation:** Start synchronous, add async for complex quotes later
- **Threshold:** If calculation takes > 10 seconds, make async

**2. Caching Strategy:**
- **Recommendation:** Implement Redis caching for material costs and pricing rules
- **Alternative:** In-memory cache with TTL for simpler deployment

**3. BOM Explosion:**
- **Recommendation:** Recursive SQL query with CTE for multi-level BOMs
- **Alternative:** Application-level recursion (easier to debug)

**4. Pricing Rule Priority:**
- **Recommendation:** Numeric priority field (lower number = higher priority)
- **Execution:** Sort by priority DESC, apply in order

### Questions for Product Owner

1. **Minimum Margin Policy:** What should happen when calculated margin is below threshold?
   - Block quote creation?
   - Allow with warning?
   - Require approval?

2. **Quote Expiration:** Should system auto-expire quotes or just warn?

3. **Quote Versioning:** Do we need quote revision history or just audit log?

4. **Multi-Currency:** Is currency conversion needed or just store in quote currency?

5. **Tax Calculation:** Should system calculate tax automatically or allow manual entry?

---

## 17. Appendix

### A. Sample Quote Calculation Flow

```
Request: Create quote for Customer ABC, 5000 units of Product XYZ

Step 1: Validate Customer
  - Check customer exists and is active
  - Check not on credit hold
  - Retrieve customer pricing tier: "STRATEGIC"

Step 2: Validate Product
  - Check product exists and is active
  - Check product is sellable
  - Retrieve product data

Step 3: Calculate Costs
  3a. Material Cost
      - Explode BOM for Product XYZ
        - Component A: 2 sheets @ $5.00/sheet = $10.00
        - Component B: 1 unit @ $2.50/unit = $2.50
        - Scrap factor: 5% = $0.625
      - Total material cost per unit: $13.125
      - Total for 5000 units: $65,625

  3b. Labor Cost
      - Setup time: 2 hours @ $45/hour = $90
      - Run time: 0.005 hours/unit × 5000 = 25 hours @ $45/hour = $1,125
      - Total labor cost: $1,215

  3c. Machine Cost
      - Setup time: 2 hours @ $75/hour = $150
      - Run time: 25 hours @ $75/hour = $1,875
      - Total machine cost: $2,025

  3d. Overhead Cost
      - 40% of (material + labor)
      - 40% of ($65,625 + $1,215) = $26,736

  3e. Total Cost = $95,601

Step 4: Calculate Price
  4a. Get List Price
      - Product list price: $25.00/unit
      - List price for 5000: $125,000

  4b. Apply Pricing Rules (priority order)
      - Rule 1: STRATEGIC_CUSTOMER (15% discount)
        - Discount: $18,750
        - Price after: $106,250

      - Rule 2: VOLUME_TIER_2 (10% discount for 5000+)
        - Discount: $10,625
        - Price after: $95,625

  4c. Final Price: $95,625

Step 5: Calculate Margin
  - Total Cost: $95,601
  - Final Price: $95,625
  - Margin Amount: $24
  - Margin %: 0.025%

  ⚠️ WARNING: Margin below minimum threshold (15%)
  - Require manager approval

Step 6: Create Quote Record
  - Generate quote number: QT-2025-000123
  - Set expiration date: 30 days from today
  - Set status: DRAFT
  - Save to database

Result: Quote created with ID, ready for review/approval
```

### B. Database Schema Diagram

```
┌─────────────────┐
│    customers    │
│─────────────────│
│ id              │
│ customer_code   │
│ customer_name   │
│ pricing_tier    │◄───────┐
│ credit_limit    │        │
└─────────────────┘        │
                           │
┌─────────────────┐        │
│     quotes      │        │
│─────────────────│        │
│ id              │        │
│ quote_number    │        │
│ customer_id     │────────┘
│ quote_date      │
│ expiration_date │
│ status          │
│ total_amount    │
│ total_cost      │
│ margin_amount   │
│ margin_%        │◄───────┐
└─────────────────┘        │
         │                 │
         │ 1:N             │
         ▼                 │
┌─────────────────┐        │
│   quote_lines   │        │
│─────────────────│        │
│ id              │        │
│ quote_id        │────────┘
│ line_number     │
│ product_id      │────────┐
│ quantity        │        │
│ unit_cost       │        │
│ unit_price      │        │
│ line_cost       │        │
│ line_amount     │        │
│ line_margin     │        │
│ margin_%        │        │
└─────────────────┘        │
                           │
         ┌─────────────────┘
         │
         ▼
┌─────────────────┐
│    products     │
│─────────────────│
│ id              │
│ product_code    │
│ product_name    │
│ standard_cost   │
│ list_price      │◄───────┐
└─────────────────┘        │
         │                 │
         │ 1:N             │
         ▼                 │
┌─────────────────┐        │
│bill_of_materials│        │
│─────────────────│        │
│ id              │        │
│ parent_prod_id  │────────┘
│ component_mat_id│────────┐
│ qty_per_parent  │        │
│ scrap_%         │        │
└─────────────────┘        │
                           │
         ┌─────────────────┘
         │
         ▼
┌─────────────────┐
│   materials     │
│─────────────────│
│ id              │
│ material_code   │
│ material_name   │
│ standard_cost   │
│ average_cost    │
│ costing_method  │
└─────────────────┘
```

### C. Glossary

**Terms:**
- **BOM (Bill of Materials):** List of raw materials, components, and assemblies required to manufacture a product
- **CPQ (Configure, Price, Quote):** Software that helps companies produce accurate quotes quickly
- **Scrap Allowance:** Additional material quantity to account for waste in production
- **Margin:** Difference between selling price and cost (profit)
- **Costing Method:** How material costs are calculated (FIFO, LIFO, AVERAGE, STANDARD)
- **Quote Lifecycle:** States a quote goes through (DRAFT → ISSUED → ACCEPTED → CONVERTED)
- **Pricing Rule:** Conditional logic that adjusts pricing based on customer, product, or quantity

---

## 18. Conclusion

This research deliverable provides a comprehensive foundation for implementing automated sales quote generation in the print industry ERP system. The proposed architecture leverages existing database infrastructure while adding sophisticated calculation, pricing, and conversion capabilities that align with industry best practices.

**Key Takeaways:**
1. Strong foundation already exists (database schema, GraphQL types)
2. Service layer implementation is the primary work effort
3. Industry benchmarks show significant ROI potential (36% error reduction, 35% satisfaction improvement)
4. Phased implementation approach reduces risk
5. Clear success metrics enable measurement of value delivery

**Next Steps:**
1. Marcus to review and confirm technical approach
2. Product owner to answer policy questions (Section 16)
3. Begin Phase 1 implementation (Core Calculation Engine)
4. Schedule weekly progress reviews
5. Plan integration testing with QA team

---

**Deliverable Status:** ✅ COMPLETE
**Ready for Implementation:** YES
**Estimated Implementation Duration:** 5-6 weeks
**Risk Level:** Medium (mitigated with phased approach)
