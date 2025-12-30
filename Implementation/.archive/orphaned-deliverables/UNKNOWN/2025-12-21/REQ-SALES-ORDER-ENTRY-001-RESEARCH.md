# Research Deliverable: REQ-SALES-ORDER-ENTRY-001
## Streamlined Sales Order Entry Feature

**Agent:** Cynthia (Research Specialist)
**Date:** 2025-12-20
**Requirement:** REQ-SALES-ORDER-ENTRY-001
**Feature:** Streamlined Sales Order Entry

---

## Executive Summary

This research document provides a comprehensive analysis of requirements, best practices, and technical considerations for implementing a streamlined sales order entry feature in the print industry ERP system. The research covers current system capabilities, industry best practices, data validation requirements, and integration touchpoints across the system.

---

## 1. Current System Analysis

### 1.1 Existing Data Model

The system currently has a robust sales order data model with the following key entities:

**Sales Orders Table** (sales_orders):
- Comprehensive header fields including customer, facility, currency, amounts, delivery dates
- Status workflow: DRAFT → CONFIRMED → IN_PRODUCTION → SHIPPED → DELIVERED → INVOICED
- Support for multi-currency with exchange rates
- Quote-to-order conversion capability
- Priority-based ordering (integer field)
- Special instructions and notes fields

**Sales Order Lines Table** (sales_order_lines):
- Product linkage with descriptions
- Quantity tracking (ordered, shipped, invoiced)
- Unit pricing with discount support (percentage and fixed amount)
- Manufacturing strategy specification
- Production order linkage
- Imposition layout integration
- Delivery date tracking per line
- Line-level status management

**Supporting Entities:**
- Customers (with credit management, pricing tiers, tax exemption)
- Products (with BOM, costing, manufacturing specs)
- Customer Pricing (with quantity breaks, effective dating)
- Pricing Rules (dynamic pricing engine with conditions)
- Quotes (with margin calculation)

### 1.2 Current GraphQL Operations

**Existing Queries:**
- `salesOrders()` - List with filtering by tenant, facility, customer, status, sales rep, date range
- `salesOrder(id)` - Single order retrieval with lines
- `salesOrderByNumber()` - Lookup by order number
- Customer lookups: `customer()`, `customerByCode()`, `customers()`
- Product lookups: `product()`, `productByCode()`, `products()`
- Pricing: `customerPricing()`, `pricingRules()`

**Existing Mutations:**
- `createSalesOrder()` - Create new order
- `updateSalesOrder()` - Update status, delivery date
- `confirmSalesOrder()` - Move to CONFIRMED status
- `shipSalesOrder()` - Mark as shipped
- `cancelSalesOrder()` - Cancel with reason
- `convertQuoteToSalesOrder()` - Quote conversion

**Current Limitations:**
1. No dedicated line-level mutations (must update full order)
2. No real-time pricing calculation endpoint
3. No credit check validation exposed
4. No inventory availability checking
5. No automatic tax calculation integration
6. Limited address validation
7. No duplicate order detection
8. No quote retrieval during order entry

---

## 2. Industry Best Practices

### 2.1 Modern ERP Sales Order Entry UX (2025)

Based on current industry research, the following best practices are emerging:

**Guided Workflows & Wizards**
- Structured, repeatable processes that guide staff through customer selection/creation
- Location confirmation before item entry
- Integrated pricing logic baked into the workflow
- Context-aware field population and suggestions

Source: [ERP Software Blog - Prevent Order Entry Errors](https://erpsoftwareblog.com/2025/12/prevent-order-entry-errors-in-business-central-with-guided-sales-tools/)

**Automation-First Approach**
- OCR and AI for automating data entry from purchase orders
- Automated multi-department approval chains
- Straight-through processing from customer submission to fulfillment

Sources:
- [Artsyl - Sales Order Processing Workflow](https://www.artsyltech.com/blog/sales-order-processing-flow-chart)
- [Top 10 ERP - Understanding Order Management Systems](https://www.top10erp.org/blog/order-management-systems)

**Real-Time Integration & Visibility**
- Immediate connection to inventory management when order enters system
- Real-time inventory visibility for accurate product availability promises
- Automated financial transactions
- Integration with production planning and logistics modules

Source: [B2BE - Sales Order Processing System](https://www.b2be.com/blog/sales-order-processing-system/)

**Streamlined Approval Workflows**
- Automated workflows with user permissions
- Drag-and-drop interface for workflow design
- Real-time monitoring of approval status

Sources:
- [Artsyl - Sales Order Process Best Practices](https://www.artsyltech.com/sales-order-processing)
- [Zedonk - Sales Order Processing Guide](https://zedonk.co.uk/emag_article/a-complete-guide-to-sales-order-processing/)

**Standardization & Templates**
- Uniform procedures for order capture
- Standard templates to save time and increase accuracy
- Clear documentation and training

Source: [Unleashed Software - Sales Order Processing](https://www.unleashedsoftware.com/blog/sales-order-processing-what-is-it-and-how-do-you-optimise-it/)

**Multi-Channel Integration**
- E-commerce system integration
- Supplier portal connectivity
- Logistics provider integration
- Payment processor connections

Source: [NetSuite - Sales Order Management](https://www.netsuite.com/portal/products/erp/order-management/sales-order-management.shtml)

**Context-Aware Features**
- CRM integration providing complete customer history during order entry
- Enhanced cross-selling opportunities
- Personalized service based on customer data

Source: [Slack - Sales Order Processing 101](https://slack.com/blog/productivity/sales-order-processing-101)

### 2.2 Print Industry-Specific Requirements

**Core Workflow Requirements:**
- End-to-end order processing from capture through delivery
- Quote-to-order conversion automation
- Manufacturing order generation
- Job/work order creation
- Delivery order issuance

**Estimating & Quoting:**
- Job estimating based on materials, techniques, and job size
- Custom quote generation for unique requests
- Product variant selection

**Approval Workflows:**
- Artwork approval from customers before production
- Confirmation workflow to avoid production errors
- Direct customer approval integration

**Automation:**
- "Manage by exception" workflow enabling eligible orders to flow automatically
- Automated order validation from shopping cart to production
- Standardized onboarding to minimize data entry errors across channels (email, phone, rep notes)

**Production Integration:**
- Automatic manufacturing order generation
- Work order assignments per product line
- Task assignment to employees for efficient workflow

Sources:
- [OnPrintShop - Print Order Management System Guide](https://onprintshop.com/blog/what-is-print-order-management-system)
- [Ordant - Print Order Management Software](https://ordant.com/what-is-print-order-management-software/)
- [PressWise - Print MIS Order Management](https://www.presswise.com/about/print-mis/order-management/)
- [DecoNetwork - Print Shop Management Software Guide](https://www.deconetwork.com/the-ultimate-guide-to-print-shop-management-software/)
- [PrintXpand - End-to-End Order Management](https://www.printxpand.com/order-management-software/)

---

## 3. Data Validation & Business Rules Requirements

### 3.1 Credit Check Validation

**Timing:**
- Customer credit should be checked BEFORE inventory availability check
- Credit management checkpoints required at order entry and confirmation

**Rules:**
- Check against customer's `credit_limit` field in customers table
- Calculate current outstanding balance from AR
- Option to include/exclude tax in credit check calculation
- If credit check fails:
  - Place order in suspense status (ON_HOLD)
  - Optionally exclude failing lines from shipment
  - Prevent back order quantity from moving to ship quantity

**System Fields:**
- `customers.credit_limit` (DECIMAL 18,4)
- `customers.credit_hold` (BOOLEAN)
- `sales_orders.status` (ENUM with ON_HOLD option)

Source: [Microsoft Dynamics - Credit Holds for Sales Orders](https://learn.microsoft.com/en-us/dynamics365/finance/accounts-receivable/cm-sales-order-credit-holds)

### 3.2 Inventory Availability Validation

**Configuration Options:**
- Availability check groups
- Checking rules and scope parameters
- Consider safety stock
- Consider stock in transit
- Consider blocked stock
- Include open purchase orders
- Include sales requirements

**Process:**
1. Verify product availability in inventory management system
2. Check location-specific inventory
3. Validate against allocated quantities
4. Consider reserved inventory
5. Check production capacity for MTO/ETO items

**System Integration Points:**
- WMS inventory_locations table
- lots table for lot-tracked items
- inventory_transactions for real-time balances
- production_orders for MTO capacity

Source: [SAP SD - Availability Check](https://www.slideshare.net/slideshow/availability-check-in-sap-sd-43046031/43046031)

### 3.3 Tax Calculation Validation

**Requirements:**
- Origin and destination address determination
- Jurisdiction-based tax rate lookup
- Automatic tax rate/area updates when addresses change
- Recalculation of taxed unit price when rates change
- Header-to-line tax amount reconciliation

**Validation Rules:**
- Tax exempt customer handling (check `customers.tax_exempt`)
- Tax exemption certificate verification
- Tax jurisdiction validation
- Line-level tax vs. header-level tax reconciliation

**System Fields:**
- `sales_orders.tax_amount` (DECIMAL 18,4)
- `customers.tax_exempt` (BOOLEAN)
- `customers.tax_exemption_certificate_url` (TEXT)
- `customers.tax_id` (VARCHAR 100)

**Integration Considerations:**
- Avalara AvaTax or similar tax calculation service
- Real-time vs. batch tax calculation
- Tax jurisdiction database maintenance

Sources:
- [Certinia - Tax Calculation Using Avalara AvaTax](https://help.certinia.com/main/2024.1/Content/OIM/Features/Integrations/AvaTax/Overview.htm)
- [TurboTax - Sales Tax 101 for Online Sellers](https://turbotax.intuit.com/tax-tips/self-employment-taxes/sales-tax-101-for-online-sellers/L4uTQCaIx)

### 3.4 Additional Validation Rules

**Customer Validation:**
- Customer must be active (`is_active = TRUE`)
- Customer not on credit hold (unless override permission)
- Valid billing and shipping addresses
- Payment terms validation

**Product Validation:**
- Product must be active and sellable
- Product must exist in products table
- Valid unit of measure
- Product category restrictions by customer type

**Pricing Validation:**
- Price must be greater than zero (unless special case)
- Discount percentage within allowed range
- Discount amount not exceeding line amount
- Pricing tier validation for customer
- Minimum order quantity enforcement

**Date Validation:**
- Order date not in future (unless special permission)
- Requested delivery date after order date
- Promised delivery date feasibility check
- Lead time calculation and validation

**Quantity Validation:**
- Quantity greater than zero
- Quantity meets minimum order requirements
- Order multiple compliance (e.g., must order in multiples of 100)
- Maximum order quantity limits

Source: [SYSPRO - Sales Order Entry](https://help.syspro.com/syspro-7-update-1/imp040.htm)

---

## 4. Integration Points

### 4.1 Customer Master Integration

**Tables:**
- `customers` - Main customer data
- `customer_products` - Customer-specific product codes
- `customer_pricing` - Customer-specific pricing agreements

**Required Data:**
- Customer code, name, type
- Billing and shipping addresses
- Payment terms and credit limit
- Sales rep and CSR assignments
- Pricing tier
- Tax exemption status
- Credit hold status
- Performance metrics (lifetime revenue, YTD revenue, average order value)

**GraphQL Operations:**
- Query: `customer()`, `customerByCode()`, `customers()`
- Mutations: Customer updates should trigger validation refresh

### 4.2 Product & Pricing Integration

**Tables:**
- `products` - Product master
- `materials` - Material specifications for products
- `bill_of_materials` - Product composition
- `customer_pricing` - Customer-specific prices
- `pricing_rules` - Dynamic pricing engine

**Required Data:**
- Product code, name, description
- Product category and packaging type
- List price and currency
- Standard costs (material, labor, overhead)
- Manufacturing strategy
- Lead times
- BOM components for cost estimation

**Pricing Calculation Flow:**
1. Retrieve base list price from products table
2. Check customer-specific pricing (customer_pricing)
3. Apply pricing rules (pricing_rules) by priority
4. Calculate quantity break discounts
5. Apply promotional discounts
6. Validate minimum pricing thresholds

**GraphQL Operations:**
- Query: `product()`, `productByCode()`, `customerPricing()`, `pricingRules()`
- New needed: `calculatePrice(customerId, productId, quantity, date)`

### 4.3 Inventory & Warehouse Integration

**Tables (WMS Module):**
- `inventory_locations` - Physical locations
- `lots` - Lot/batch tracking
- `inventory_transactions` - Movement history
- `waves` - Wave processing
- `pick_lists` - Picking operations

**Required Data:**
- Available quantity by location
- Lot numbers and expiration dates
- Quality status
- Allocated quantities
- Location availability

**Real-Time Checks:**
- Available-to-promise (ATP) calculation
- Capable-to-promise (CTP) for MTO items
- Multi-location inventory visibility
- Lot expiration date validation
- Security zone restrictions

**GraphQL Integration:**
- New query needed: `checkInventoryAvailability(productId, quantity, facilityId, requestedDate)`
- Should return: available qty, allocated qty, on-order qty, ATP date, suggested alternatives

### 4.4 Production Integration

**Tables (Operations Module):**
- `production_orders` - Production order header
- `production_runs` - Manufacturing execution
- `work_centers` - Equipment and capacity
- `operations` - Operation types
- `production_schedule` - Scheduling data
- `capacity_planning` - Capacity analysis

**Required Data:**
- Manufacturing strategy (MTS, MTO, CTO, ETO)
- Standard production time
- Work center capacity
- Current production schedule
- Lead time calculations

**Capacity Checks:**
- For MTO/CTO/ETO items: capacity availability validation
- Lead time calculation based on current schedule
- Work center availability for promised dates
- Bottleneck identification

**Automatic Triggers:**
- MTO orders should generate production_orders automatically upon confirmation
- Production order should link back to sales_order_line_id
- Scheduling should allocate capacity

**GraphQL Integration:**
- New query: `calculateProductionLeadTime(productId, quantity, facilityId, requestedDate)`
- New mutation: `generateProductionOrderFromSalesOrder(salesOrderId)`

### 4.5 Quote Integration

**Tables:**
- `quotes` - Quote header
- `quote_lines` - Quote line items

**Conversion Flow:**
- Existing mutation: `convertQuoteToSalesOrder(quoteId)`
- Copies quote header → sales order
- Copies quote lines → sales order lines
- Updates quote status to CONVERTED_TO_ORDER
- Links sales order back to quote

**Enhancement Needed:**
- Quote lookup during order entry for quick reference
- Quote line selection (partial conversion)
- Price/margin comparison between quote and order
- Quote expiration date validation

### 4.6 Financial Integration

**Tables (Finance Module):**
- `chart_of_accounts` - GL accounts
- `journal_entries` - Accounting transactions
- `billing_entities` - Legal entities

**Integration Points:**
- Revenue recognition upon shipment/delivery
- AR transaction creation upon invoicing
- Cost of goods sold calculation
- Sales tax liability recording
- Freight/shipping revenue accounting

**Real-Time Needs:**
- Tax calculation (external service integration)
- Credit limit checking (AR balance query)
- Currency exchange rates
- Payment term validation

---

## 5. User Experience Workflow Recommendations

### 5.1 Streamlined Order Entry Flow

**Step 1: Customer Selection/Creation**
- Fast customer search (code, name, phone, email)
- Recent customer quick-pick list
- Inline customer creation for new customers
- Display customer credit status, pricing tier, and special notes
- Show customer order history preview

**Step 2: Order Header Setup**
- Auto-populate facility, currency, payment terms from customer defaults
- Select/confirm shipping address (with address book for multi-location customers)
- Optional customer PO number entry
- Delivery date request with lead time guidance
- Priority selection
- Special instructions field

**Step 3: Line Item Entry**
- Product search (code, description, customer product code)
- Quick add from frequently ordered items
- Quantity entry with UOM selection
- Real-time pricing display with margin
- Discount application (with approval rules)
- Delivery date per line (if different from header)
- Manufacturing strategy selection

**Step 4: Validation & Review**
- Real-time validation as lines are added:
  - Credit check with visual indicator
  - Inventory availability with ATP date
  - Pricing rule application confirmation
  - Tax calculation display
- Order total summary with breakdown (subtotal, tax, shipping, discounts)
- Margin summary (if user has permission)
- Missing information warnings

**Step 5: Save/Submit**
- Save as DRAFT for later completion
- Submit for approval (if required)
- Confirm immediately (if authorized and all validations pass)
- Print order confirmation
- Email order acknowledgment to customer

### 5.2 Quick Order Templates

**Functionality:**
- Save frequently ordered configurations as templates
- One-click order creation from template
- Template update capability
- Customer-specific templates
- Product category templates

### 5.3 Bulk Order Entry

**Use Case:** Repeat orders, standing orders, blanket releases
- Upload CSV/Excel with order lines
- Bulk validation and error reporting
- Review and correct interface
- Batch submission

### 5.4 Quote-to-Order Conversion

**Enhanced Flow:**
- Quick quote lookup during order entry
- Select quote for conversion
- Display quote vs. current pricing comparison
- Adjust quantities/prices if needed
- Convert with audit trail

---

## 6. Technical Architecture Recommendations

### 6.1 GraphQL API Enhancements

**New Queries Needed:**
```graphql
# Real-time pricing calculation
calculateLinePrice(
  customerId: ID!
  productId: ID!
  quantity: Float!
  requestedDate: Date
  discountPercent: Float
): LinePriceCalculation!

# Inventory availability check
checkInventoryAvailability(
  productId: ID!
  quantity: Float!
  facilityId: ID!
  requestedDate: Date
): InventoryAvailability!

# Credit check
checkCustomerCredit(
  customerId: ID!
  additionalAmount: Float!
): CreditCheckResult!

# Production lead time
calculateProductionLeadTime(
  productId: ID!
  quantity: Float!
  facilityId: ID!
  requestedDate: Date
): ProductionLeadTime!

# Tax calculation
calculateTax(
  customerId: ID!
  facilityId: ID!
  lineItems: [TaxLineItemInput!]!
): TaxCalculation!

# Quote search for conversion
searchQuotesForConversion(
  customerId: ID!
  status: QuoteStatus
  startDate: Date
  endDate: Date
): [Quote!]!
```

**New Mutations Needed:**
```graphql
# Add line to existing order
addSalesOrderLine(
  salesOrderId: ID!
  input: AddSalesOrderLineInput!
): SalesOrderLine!

# Update line
updateSalesOrderLine(
  id: ID!
  input: UpdateSalesOrderLineInput!
): SalesOrderLine!

# Delete line
deleteSalesOrderLine(id: ID!): Boolean!

# Bulk line operations
bulkAddSalesOrderLines(
  salesOrderId: ID!
  lines: [AddSalesOrderLineInput!]!
): [SalesOrderLine!]!

# Validate full order
validateSalesOrder(
  salesOrderId: ID!
): SalesOrderValidationResult!

# Submit for approval
submitSalesOrderForApproval(
  salesOrderId: ID!
): SalesOrder!

# Generate production order from sales order
generateProductionOrders(
  salesOrderId: ID!
  lineIds: [ID!]
): [ProductionOrder!]!
```

### 6.2 Validation Service Architecture

**Layered Validation:**
1. **Field-level validation** (immediate, client-side where possible)
   - Required fields
   - Data type and format
   - Range validation

2. **Business rule validation** (server-side, synchronous)
   - Customer status checks
   - Product status checks
   - Pricing rule validation
   - Quantity constraints

3. **Integration validation** (server-side, may be async)
   - Credit checking (AR integration)
   - Inventory availability (WMS integration)
   - Tax calculation (external service)
   - Production capacity (scheduling integration)

4. **Order-level validation** (pre-submission)
   - Complete order validation
   - Cross-line validations
   - Approval requirements
   - Print-specific rules

**Error Handling:**
- Severity levels: Info, Warning, Error, Blocking
- Clear error messages with resolution guidance
- Validation summary report
- Override capability with permission tracking

### 6.3 State Management

**Order Lifecycle States:**
```
DRAFT → PENDING_APPROVAL → APPROVED → CONFIRMED →
IN_PRODUCTION → SHIPPED → DELIVERED → INVOICED
```

**Branching States:**
- `CANCELLED` (from any state)
- `ON_HOLD` (credit hold, customer request, production issue)
- `PARTIALLY_SHIPPED` (between CONFIRMED and SHIPPED)

**State Transition Rules:**
- Define allowed transitions
- Required validations per transition
- Permission requirements
- Automatic triggers (e.g., CONFIRMED → auto-generate production orders)

### 6.4 Performance Considerations

**Caching Strategy:**
- Customer data (short TTL for credit status)
- Product catalog (longer TTL, invalidate on updates)
- Pricing rules (medium TTL)
- Inventory snapshots (very short TTL, real-time for critical checks)

**Lazy Loading:**
- Load order lines on demand
- Paginate large order lists
- Stream bulk operations

**Optimistic UI Updates:**
- Update UI immediately, validate in background
- Roll back on validation failure
- Show validation status indicators

---

## 7. Key Gaps & Recommendations

### 7.1 Current Gaps

1. **No line-level CRUD operations** - Can only create/update full orders
2. **No real-time pricing calculation endpoint** - Pricing logic exists but not exposed
3. **No credit checking validation** - Customer has credit_limit field but no check implemented
4. **No inventory availability API** - WMS tables exist but no ATP calculation exposed
5. **No tax calculation integration** - Tax fields exist but no calculation service
6. **No duplicate order detection** - Could create same order multiple times
7. **No order approval workflow** - Status field exists but no workflow implementation
8. **Limited quote integration** - Conversion exists but no lookup/comparison during entry

### 7.2 Priority Recommendations

**Phase 1: Foundation (Must Have)**
1. Implement line-level GraphQL mutations (add, update, delete)
2. Build real-time pricing calculation service
3. Implement credit check validation service
4. Create inventory availability (ATP) calculation
5. Add comprehensive order validation endpoint
6. Implement customer search optimization

**Phase 2: Enhancement (Should Have)**
1. Tax calculation service integration (Avalara or similar)
2. Order approval workflow engine
3. Quote lookup and comparison during order entry
4. Production lead time calculation
5. Duplicate order detection
6. Order templates functionality

**Phase 3: Optimization (Nice to Have)**
1. Bulk order entry with CSV/Excel upload
2. Advanced pricing rules (time-based, volume commitments)
3. Customer-specific product catalogs
4. Intelligent product recommendations
5. Mobile-optimized order entry
6. Voice-to-order integration

---

## 8. Data Model Recommendations

### 8.1 New Tables Needed

**sales_order_approvals**
```sql
CREATE TABLE sales_order_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    sales_order_id UUID NOT NULL,
    approval_level INTEGER NOT NULL,
    approver_user_id UUID NOT NULL,
    approval_status VARCHAR(20) NOT NULL, -- PENDING, APPROVED, REJECTED
    approval_date TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_approval_order FOREIGN KEY (sales_order_id)
        REFERENCES sales_orders(id)
);
```

**sales_order_templates**
```sql
CREATE TABLE sales_order_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    template_code VARCHAR(50) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    customer_id UUID,
    template_data JSONB NOT NULL, -- Stores order structure
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    CONSTRAINT uq_template_code UNIQUE (tenant_id, template_code)
);
```

**sales_order_validation_log**
```sql
CREATE TABLE sales_order_validation_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    sales_order_id UUID NOT NULL,
    validation_type VARCHAR(50) NOT NULL,
    validation_status VARCHAR(20) NOT NULL,
    validation_message TEXT,
    validation_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    validated_by UUID,
    CONSTRAINT fk_validation_order FOREIGN KEY (sales_order_id)
        REFERENCES sales_orders(id)
);
```

### 8.2 Schema Modifications

**sales_orders table additions:**
```sql
ALTER TABLE sales_orders ADD COLUMN approval_required BOOLEAN DEFAULT FALSE;
ALTER TABLE sales_orders ADD COLUMN approval_status VARCHAR(20);
ALTER TABLE sales_orders ADD COLUMN approved_by_user_id UUID;
ALTER TABLE sales_orders ADD COLUMN approved_at TIMESTAMPTZ;
ALTER TABLE sales_orders ADD COLUMN credit_check_status VARCHAR(20);
ALTER TABLE sales_orders ADD COLUMN credit_check_timestamp TIMESTAMPTZ;
ALTER TABLE sales_orders ADD COLUMN validation_status VARCHAR(20);
ALTER TABLE sales_orders ADD COLUMN source_template_id UUID;
```

**sales_order_lines table additions:**
```sql
ALTER TABLE sales_order_lines ADD COLUMN inventory_check_status VARCHAR(20);
ALTER TABLE sales_order_lines ADD COLUMN available_to_promise_date DATE;
ALTER TABLE sales_order_lines ADD COLUMN cost_at_order DECIMAL(18,4);
ALTER TABLE sales_order_lines ADD COLUMN margin_at_order DECIMAL(18,4);
ALTER TABLE sales_order_lines ADD COLUMN tax_amount DECIMAL(18,4);
ALTER TABLE sales_order_lines ADD COLUMN tax_rate DECIMAL(8,4);
ALTER TABLE sales_order_lines ADD COLUMN tax_jurisdiction VARCHAR(100);
```

---

## 9. Security & Compliance Considerations

### 9.1 Role-Based Access Control

**Permissions Needed:**
- `sales_order.create` - Create new orders
- `sales_order.edit_own` - Edit own orders in DRAFT
- `sales_order.edit_all` - Edit any order in DRAFT
- `sales_order.view_cost` - View cost and margin data
- `sales_order.approve_level1` - Approve orders up to threshold
- `sales_order.approve_level2` - Approve large orders
- `sales_order.override_credit` - Override credit hold
- `sales_order.override_pricing` - Override pricing rules
- `sales_order.cancel` - Cancel orders
- `sales_order.delete` - Delete draft orders

### 9.2 Audit Trail

**Tracked Changes:**
- All field modifications with before/after values
- User and timestamp for each change
- Validation override logging
- Approval/rejection history
- Status transition logging
- Price override justification

### 9.3 Data Privacy

**PII Handling:**
- Customer contact information encryption
- Address data protection
- Payment term confidentiality
- Order history access controls

---

## 10. Testing Strategy Recommendations

### 10.1 Unit Testing

**Backend Services:**
- Pricing calculation logic
- Credit check calculations
- Inventory availability calculation
- Tax calculation
- Validation rules
- State transition logic

### 10.2 Integration Testing

**Cross-Module Integration:**
- Customer master → Order entry
- Product catalog → Pricing
- Inventory → Availability checking
- Production → Lead time calculation
- Financial → Credit checking
- Tax service → Tax calculation

### 10.3 End-to-End Testing

**User Workflows:**
- New customer order entry
- Repeat customer order entry
- Quote conversion to order
- Order modification flow
- Approval workflow
- Order cancellation
- Credit hold handling
- Out-of-stock scenarios

### 10.4 Performance Testing

**Load Testing Scenarios:**
- Concurrent order entry (50+ users)
- Bulk order import (100+ orders)
- Real-time validation under load
- Database query performance
- API response times

---

## 11. Migration & Rollout Strategy

### 11.1 Phased Rollout

**Phase 1: Internal Testing (Weeks 1-2)**
- Deploy to development environment
- Internal QA testing
- Performance benchmarking
- Bug fixing

**Phase 2: Pilot (Weeks 3-4)**
- Select 2-3 pilot users/facilities
- Monitor usage and performance
- Collect feedback
- Iterative improvements

**Phase 3: Gradual Rollout (Weeks 5-8)**
- Roll out by facility or user group
- Provide training materials
- Support rapid response team
- Monitor adoption metrics

**Phase 4: Full Production (Week 9+)**
- All users migrated
- Old system deprecated
- Ongoing support and enhancement

### 11.2 Training Requirements

**User Training:**
- Sales order entry workflow
- Customer search and selection
- Product selection and pricing
- Inventory checking
- Approval process
- Error handling and resolution

**Administrator Training:**
- Pricing rule configuration
- Approval workflow setup
- Validation rule management
- Permission management
- Report configuration

---

## 12. Success Metrics

### 12.1 Efficiency Metrics

- **Order entry time reduction:** Target 40% reduction from current baseline
- **Error rate reduction:** Target 60% reduction in order entry errors
- **Approval cycle time:** Target < 4 hours for standard approvals
- **Quote-to-order conversion time:** Target < 5 minutes

### 12.2 Quality Metrics

- **Order accuracy:** Target 99%+ accuracy (no rework needed)
- **Credit hold prevention:** 100% credit checks before confirmation
- **Inventory accuracy:** 95%+ ATP accuracy
- **Pricing accuracy:** 100% automated pricing application

### 12.3 User Satisfaction

- **User satisfaction score:** Target 4.5/5.0
- **Training completion rate:** Target 100%
- **Feature adoption rate:** Target 90% within 30 days
- **Support ticket reduction:** Target 50% reduction in order-entry related tickets

---

## 13. Conclusion

The streamlined sales order entry feature represents a critical modernization of the print industry ERP system. Based on this research, the implementation should focus on:

1. **User Experience:** Guided workflows with real-time validation and intelligent defaults
2. **Integration:** Seamless connectivity with customer, product, inventory, production, and financial modules
3. **Automation:** Reduce manual entry through templates, quote conversion, and intelligent suggestions
4. **Validation:** Comprehensive credit, inventory, pricing, and tax validation before order confirmation
5. **Flexibility:** Support multiple order entry scenarios (manual, bulk, quote conversion, templates)

The recommended phased approach ensures manageable complexity while delivering incremental value. Priority should be given to foundational capabilities (line-level operations, pricing, credit checking, inventory availability) before advancing to optimization features (bulk entry, advanced templates).

Success will require close collaboration between the development team (Roy - Backend, Jen - Frontend), the product owner (Sarah - Sales), warehouse operations (Marcus), and procurement stakeholders (Alex) to ensure the solution meets real-world operational needs while maintaining technical excellence.

---

## 14. References & Sources

### Industry Best Practices
- [ERP Software Blog - Prevent Order Entry Errors in Business Central](https://erpsoftwareblog.com/2025/12/prevent-order-entry-errors-in-business-central-with-guided-sales-tools/)
- [Artsyl - Sales Order Process Best Practices](https://www.artsyltech.com/sales-order-processing)
- [Artsyl - Sales Order Processing Workflow](https://www.artsyltech.com/blog/sales-order-processing-flow-chart)
- [B2BE - Sales Order Processing System](https://www.b2be.com/blog/sales-order-processing-system/)
- [Slack - Sales Order Processing 101](https://slack.com/blog/productivity/sales-order-processing-101)
- [NetSuite - Sales Order Management](https://www.netsuite.com/portal/products/erp/order-management/sales-order-management.shtml)
- [Zedonk - Sales Order Processing Guide](https://zedonk.co.uk/emag_article/a-complete-guide-to-sales-order-processing/)
- [Unleashed Software - Sales Order Processing](https://www.unleashedsoftware.com/blog/sales-order-processing-what-is-it-and-how-do-you-optimise-it/)
- [Top 10 ERP - Understanding Order Management Systems](https://www.top10erp.org/blog/order-management-systems)
- [Tailor Tech - Understanding Sales Order Process](https://www.tailor.tech/resources/posts/understanding-sales-order-process-orders-pos-invoices-explained)

### Print Industry Requirements
- [DecoNetwork - Ultimate Guide to Print Shop Management Software](https://www.deconetwork.com/the-ultimate-guide-to-print-shop-management-software/)
- [Ordant - Print Order Management Software](https://ordant.com/what-is-print-order-management-software/)
- [OnPrintShop - Print Order Management System Guide](https://onprintshop.com/blog/what-is-print-order-management-system)
- [Printavo - Print Management Software](https://www.printavo.com/)
- [PrintEPS - What is Print Management Software](https://printepssw.com/insight/what-is-print-management-software)
- [PrintXpand - End-to-End Order Management](https://www.printxpand.com/order-management-software/)
- [HP Site Flow - Print Workflow Automation](https://www.hp.com/us-en/industrial-digital-presses/print-workflow-automation-management-solutions-site-flow.html)
- [PressWise - Print MIS Order Management](https://www.presswise.com/about/print-mis/order-management/)
- [InfoFlow - Print Shop Management Software](https://infofloprint.com/)

### Validation & Business Rules
- [SYSPRO - Sales Order Entry](https://help.syspro.com/syspro-7-update-1/imp040.htm)
- [Oracle - Processing Sales Orders](https://docs.oracle.com/cd/E16582_01/doc.91/e15146/process_sales_orders.htm)
- [Microsoft Dynamics - Credit Holds for Sales Orders](https://learn.microsoft.com/en-us/dynamics365/finance/accounts-receivable/cm-sales-order-credit-holds)
- [Certinia - Tax Calculation Using Avalara AvaTax](https://help.certinia.com/main/2024.1/Content/OIM/Features/Integrations/AvaTax/Overview.htm)
- [SAP SD - Availability Check](https://www.slideshare.net/slideshow/availability-check-in-sap-sd-43046031/43046031)
- [Microsoft Dynamics - Validate Store Transactions](https://learn.microsoft.com/en-us/dynamics365/commerce/valid-checker)
- [TurboTax - Sales Tax 101 for Online Sellers](https://turbotax.intuit.com/tax-tips/self-employment-taxes/sales-tax-101-for-online-sellers/L4uTQCaIx)
- [Cornell University - Inventory Accounting Guidelines](https://finance.cornell.edu/accounting/topics/inventories)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-20
**Next Review:** Upon backend development planning by Roy (Backend PO)
