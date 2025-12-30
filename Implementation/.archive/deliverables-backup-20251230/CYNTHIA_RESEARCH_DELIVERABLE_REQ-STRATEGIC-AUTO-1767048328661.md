# Research Deliverable: Estimating & Job Costing Module
## REQ-STRATEGIC-AUTO-1767048328661

**Research Agent:** Cynthia (Research & Analysis Specialist)
**Date:** 2025-12-29
**Status:** COMPLETE
**Assigned To:** Marcus (System Architect)

---

## Executive Summary

This research document provides a comprehensive analysis of the **Estimating & Job Costing Module** for the print industry ERP system. The analysis reveals that while foundational components exist for **quote automation and costing**, the system lacks a complete **estimating workflow** and comprehensive **job costing tracking** capabilities. This document identifies existing infrastructure, gaps, and provides detailed recommendations for implementing a complete Estimating & Job Costing Module.

**Key Findings:**
- ✅ **Quote Costing Infrastructure Exists**: BOM explosion, material costing, and setup cost calculations are implemented
- ❌ **No Dedicated Estimating Module**: No formal estimating workflow or templates
- ❌ **Job Costing Tables Not Implemented**: Database schemas defined but not yet deployed
- ✅ **Standard Cost Framework Defined**: Comprehensive cost model in data models
- ⚠️ **Limited Frontend Coverage**: Sales quote UI exists but no dedicated estimating or job costing views

---

## 1. Current State Analysis

### 1.1 Existing Infrastructure

#### **A. Database Schema - Finance Module (V0.0.5)**

The finance module provides foundational tables for financial tracking:

**Tables Implemented:**
- `financial_periods` - Accounting period management
- `chart_of_accounts` - GL account structure with multi-currency
- `journal_entries` / `journal_entry_lines` - Double-entry accounting
- `gl_balances` - Period-end balance snapshots
- `invoices` / `invoice_lines` - Customer invoicing (AR)
- `payments` - Payment tracking (AR/AP)
- `cost_allocations` - Cost allocation tracking

**Relevance to Job Costing:**
```sql
-- Cost allocations table supports job costing
CREATE TABLE cost_allocations (
    source_type VARCHAR(50) NOT NULL,  -- PRODUCTION_RUN, SALES_ORDER, etc.
    source_id UUID,
    cost_category VARCHAR(50) NOT NULL,  -- MATERIAL, LABOR, OVERHEAD, etc.
    allocation_amount DECIMAL(18,4) NOT NULL,
    allocation_method VARCHAR(50),  -- DIRECT, MACHINE_HOURS, etc.
    ...
);
```

**Status:** ✅ **Deployed** (Migration V0.0.5)

---

#### **B. Data Model Definitions**

Comprehensive YAML schemas exist for job costing entities:

**1. Job Cost Schema (`job-cost.yaml`)**

```yaml
entity:
  name: JobCost
  tables:
    - job_costs

  properties:
    # Revenue
    total_amount: decimal  # Invoice amount

    # Cost Breakdown
    total_cost: decimal
    material_cost: decimal
    labor_cost: decimal
    equipment_cost: decimal
    overhead_cost: decimal
    outsourcing_cost: decimal
    other_cost: decimal

    # Estimates (for variance)
    estimated_material_cost: decimal
    estimated_labor_cost: decimal
    estimated_equipment_cost: decimal
    estimated_total_cost: decimal

    # Profitability Metrics
    gross_profit: decimal  # total_amount - total_cost
    gross_profit_margin: decimal
    cost_variance: decimal  # estimated_total_cost - total_cost
    cost_variance_percentage: decimal

    # Status
    status: enum  # estimated, in-progress, completed, reviewed, approved
```

**2. Standard Cost Schema (`standard-cost.yaml`)**

Defines standard costs for materials, operations, and activities:

```yaml
entity:
  name: StandardCost
  tables:
    - standard_costs
    - cost_centers
    - cost_categories

  properties:
    cost_object_type: enum  # material, operation, equipment_hour, labor_hour, overhead, activity
    cost_object_id: uuid

    # Cost Components
    material_cost: decimal
    labor_cost: decimal
    equipment_cost: decimal
    overhead_cost: decimal
    total_standard_cost: decimal

    # Value Analysis
    value_category: enum  # value_added, business_value_added, non_value_added
    reason_code_category: enum  # material_defect, equipment_failure, operator_error, etc.

    # Effective Dating
    effective_from: date
    effective_to: date
    is_current: boolean
```

**3. Job Schema (`job.yaml`)**

Core job entity linking customer requirements to production:

```yaml
entity:
  name: Job
  properties:
    job_number: string
    customer_id: uuid
    quantity_required: integer

    # Scheduling
    promised_delivery_date: timestamp
    actual_delivery_date: timestamp
    due_date: timestamp

    # Costing
    estimated_cost: decimal
    actual_cost: decimal

    # Status
    status: enum  # quoted, pending, approved, scheduled, in-production, completed, delivered
```

**4. Production Order Schema (`production-order.yaml`)**

Links jobs to actual production with cost tracking:

```yaml
entity:
  name: ProductionOrder
  properties:
    job_id: uuid
    operation_type: enum  # prepress, printing, cutting, folding, etc.

    # Standard Costs
    standard_material_cost: decimal
    standard_labor_cost: decimal
    standard_overhead_cost: decimal

    # Actual Costs
    actual_material_cost: decimal
    actual_labor_cost: decimal
    actual_overhead_cost: decimal
```

**Status:** 📋 **Defined but NOT Deployed** (No migrations created yet)

---

#### **C. Backend Services - Quote Costing**

**Service: QuoteCostingService** (`quote-costing.service.ts`)

Implements sophisticated cost calculation:

**Features:**
- ✅ BOM explosion (multi-level, up to 5 levels deep)
- ✅ Material cost lookup (STANDARD, AVERAGE, FIFO, LIFO methods)
- ✅ Setup cost calculation and amortization
- ✅ Scrap percentage handling
- ✅ Nested BOM support

**Key Methods:**

```typescript
// Calculate total product cost including BOM and setup
async calculateProductCost(input: CostCalculationInput): Promise<CostCalculationResult>

// Explode BOM to get all material requirements
async explodeBOM(input: BOMExplosionInput): Promise<BOMExplosionResult>

// Get material cost using configured method
async getMaterialCost(input: MaterialCostInput): Promise<MaterialCostResult>

// Calculate setup cost amortized across quantity
async calculateSetupCost(input: SetupCostInput): Promise<SetupCostResult>
```

**Example Cost Breakdown:**
```typescript
{
  unitCost: 12.50,
  totalCost: 12500.00,
  materialCost: 8000.00,
  laborCost: 2500.00,
  overheadCost: 1500.00,
  setupCost: 500.00,
  setupCostPerUnit: 0.50,
  costBreakdown: [
    { componentType: 'Material', componentCode: 'PAPER-80#', quantity: 5000, unitCost: 1.60, totalCost: 8000 },
    ...
  ],
  costMethod: 'BOM_EXPLOSION'
}
```

**Status:** ✅ **Implemented and Active**

---

**Service: QuotePricingService** (`quote-pricing.service.ts`)

Handles pricing calculations with margin validation:

**Features:**
- ✅ Automated pricing based on rules
- ✅ Customer-specific pricing
- ✅ Volume discounts
- ✅ Margin calculation and validation
- ✅ Pricing rule engine integration

**Service: QuoteManagementService** (`quote-management.service.ts`)

Manages quote lifecycle:

**Features:**
- ✅ Quote CRUD operations
- ✅ Quote line management
- ✅ Automatic recalculation on changes
- ✅ Status workflow

**Status:** ✅ **Implemented and Active**

---

#### **D. GraphQL API**

**Schema: sales-quote-automation.graphql**

Comprehensive GraphQL API for quote operations:

**Types:**
```graphql
type PricingCalculation {
  unitPrice: Float!
  lineAmount: Float!
  discountPercentage: Float!
  unitCost: Float!
  lineMargin: Float!
  marginPercentage: Float!
  appliedRules: [AppliedPricingRule!]!
  priceSource: PriceSource!
}

type CostCalculation {
  unitCost: Float!
  totalCost: Float!
  materialCost: Float!
  laborCost: Float!
  overheadCost: Float!
  setupCost: Float!
  costMethod: CostMethod!
  costBreakdown: [CostComponent!]!
}

type MarginValidation {
  isValid: Boolean!
  minimumMarginPercentage: Float!
  actualMarginPercentage: Float!
  requiresApproval: Boolean!
  approvalLevel: ApprovalLevel
}
```

**Queries:**
```graphql
previewQuoteLinePricing(
  tenantId: ID!
  productId: ID!
  customerId: ID!
  quantity: Float!
): PricingCalculation!

previewProductCost(
  tenantId: ID!
  productId: ID!
  quantity: Float!
): CostCalculation!
```

**Mutations:**
```graphql
createQuoteWithLines(input: CreateQuoteWithLinesInput!): Quote!
addQuoteLine(input: AddQuoteLineInput!): QuoteLine!
recalculateQuote(quoteId: ID!): Quote!
validateQuoteMargin(quoteId: ID!): MarginValidation!
```

**Status:** ✅ **Implemented**

---

#### **E. Frontend Components**

**1. Sales Quote Dashboard** (`SalesQuoteDashboard.tsx`)

**Features:**
- ✅ Quote listing with filtering
- ✅ Status tracking (DRAFT, ISSUED, ACCEPTED, REJECTED, EXPIRED)
- ✅ KPI display (total value, avg margin, conversion rate)
- ✅ Navigation to detail view

**KPIs Displayed:**
- Total quotes
- Draft/Issued/Accepted counts
- Total value
- Average margin %
- Conversion rate (accepted/issued)

**2. Sales Quote Detail Page** (`SalesQuoteDetailPage.tsx`)

**Features:**
- ✅ Quote header information
- ✅ Quote line management (add/edit/delete)
- ✅ Automatic pricing calculation
- ✅ Margin validation
- ✅ Quote recalculation
- ✅ Status updates

**Quote Line Details:**
- Product code & description
- Quantity, unit price, line amount
- Discount percentage/amount
- Unit cost, line cost
- Line margin & margin percentage
- Manufacturing strategy
- Lead time & delivery date

**Status:** ✅ **Implemented for Quotes** | ❌ **No dedicated Estimating or Job Costing UI**

---

### 1.2 Gap Analysis

| Component | Current State | Gap Identified |
|-----------|--------------|----------------|
| **Database - Job Costs** | Schema defined in YAML | ❌ Migration not created, table doesn't exist |
| **Database - Standard Costs** | Schema defined in YAML | ❌ Migration not created, tables don't exist |
| **Backend - Estimating Service** | N/A | ❌ No estimating service exists |
| **Backend - Job Costing Service** | N/A | ❌ No job costing tracking service |
| **Backend - Variance Analysis** | N/A | ❌ No actual vs estimate comparison |
| **GraphQL - Job Costing** | N/A | ❌ No job costing queries/mutations |
| **Frontend - Estimating UI** | N/A | ❌ No estimating interface |
| **Frontend - Job Costing Dashboard** | N/A | ❌ No job costing views |
| **Integration - Production to Costing** | N/A | ❌ No actual cost rollup from production |

---

## 2. Requirements Analysis

### 2.1 Functional Requirements

#### **A. Estimating Module**

**Purpose:** Create detailed cost estimates for customer jobs before committing to production.

**Key Features:**

1. **Estimate Templates**
   - Standard operation sequences by product category
   - Default material requirements
   - Standard labor hours by operation
   - Equipment time estimates

2. **Interactive Estimating**
   - Select product specifications (size, quantity, materials)
   - Choose operations (printing, cutting, folding, binding, etc.)
   - Define material requirements
   - Calculate setup times
   - Apply waste/scrap allowances
   - Include outsourcing costs

3. **Cost Calculation Engine**
   - Leverage existing `QuoteCostingService`
   - BOM explosion for complex products
   - Material cost lookup (by costing method)
   - Labor cost by skill level and operation
   - Equipment hourly rates
   - Overhead allocation
   - Setup cost amortization

4. **Estimate Versioning**
   - Track estimate revisions
   - Compare estimate versions
   - Audit trail of changes

5. **Quote Generation**
   - Convert estimate to quote
   - Apply pricing rules
   - Add margin/markup
   - Generate customer-facing quote document

**User Workflow:**
```
Customer Request → Create Estimate → Define Operations →
Calculate Costs → Review/Adjust → Generate Quote →
Customer Approval → Convert to Job
```

---

#### **B. Job Costing Module**

**Purpose:** Track actual costs incurred during production and compare to estimates for profitability analysis.

**Key Features:**

1. **Job Cost Initialization**
   - Create job cost record when job is approved
   - Copy estimates as baseline
   - Link to job and production orders

2. **Actual Cost Collection**
   - **Material Costs:** From material consumption records
   - **Labor Costs:** From labor tracking/time sheets
   - **Equipment Costs:** From machine hours logged
   - **Overhead Costs:** Allocated by predefined rate
   - **Outsourcing Costs:** From vendor invoices
   - **Other Costs:** Freight, special tooling, etc.

3. **Real-Time Cost Rollup**
   - Aggregate costs from production orders
   - Update job cost totals as production progresses
   - Calculate cost-to-date vs. estimate

4. **Variance Analysis**
   - Compare actual vs. estimated costs
   - Identify variances by category (material, labor, overhead)
   - Calculate variance percentages
   - Flag jobs exceeding cost thresholds

5. **Profitability Reporting**
   - Job revenue (from invoice)
   - Total actual costs
   - Gross profit (revenue - cost)
   - Gross margin %
   - Cost variance (estimate - actual)

6. **Cost Adjustment & Close**
   - Adjust for final inventory counts
   - Allocate final overhead
   - Close job costing period
   - Lock cost record

**User Workflow:**
```
Job Approved → Initialize Job Cost → Production Starts →
Collect Actuals (Material/Labor/Equipment) → Update Costs →
Production Complete → Final Adjustments → Close Job Costing →
Profitability Analysis
```

---

### 2.2 Data Model Requirements

#### **A. Job Costs Table**

**Migration:** `V0.0.XX__create_job_costing_tables.sql`

```sql
CREATE TABLE job_costs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    job_id UUID NOT NULL UNIQUE,  -- One job cost per job

    -- Revenue
    total_amount DECIMAL(18,4) NOT NULL DEFAULT 0,

    -- Actual Costs
    total_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    material_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    labor_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    equipment_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    overhead_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    outsourcing_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    other_cost DECIMAL(18,4) NOT NULL DEFAULT 0,

    -- Estimates (from estimating module)
    estimated_material_cost DECIMAL(18,4),
    estimated_labor_cost DECIMAL(18,4),
    estimated_equipment_cost DECIMAL(18,4),
    estimated_total_cost DECIMAL(18,4),

    -- Calculated Metrics
    gross_profit DECIMAL(18,4) GENERATED ALWAYS AS (total_amount - total_cost) STORED,
    gross_profit_margin DECIMAL(10,4) GENERATED ALWAYS AS
        (CASE WHEN total_amount > 0 THEN ((total_amount - total_cost) / total_amount) * 100 ELSE 0 END) STORED,
    cost_variance DECIMAL(18,4) GENERATED ALWAYS AS (estimated_total_cost - total_cost) STORED,
    cost_variance_percentage DECIMAL(10,4) GENERATED ALWAYS AS
        (CASE WHEN estimated_total_cost > 0 THEN ((estimated_total_cost - total_cost) / estimated_total_cost) * 100 ELSE 0 END) STORED,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'estimated',  -- estimated, in-progress, completed, reviewed, approved
    costing_date TIMESTAMPTZ,
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,

    CONSTRAINT fk_job_cost_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_job_cost_job FOREIGN KEY (job_id) REFERENCES jobs(id),
    CONSTRAINT uq_job_cost_job UNIQUE (tenant_id, job_id),
    CONSTRAINT chk_job_cost_amounts CHECK (
        total_amount >= 0 AND total_cost >= 0 AND
        material_cost >= 0 AND labor_cost >= 0 AND equipment_cost >= 0
    )
);

CREATE INDEX idx_job_costs_tenant ON job_costs(tenant_id);
CREATE INDEX idx_job_costs_status ON job_costs(tenant_id, status);
CREATE INDEX idx_job_costs_date ON job_costs(tenant_id, costing_date);
```

---

#### **B. Standard Costs Tables**

**Migration:** `V0.0.XX__create_standard_costs_tables.sql`

```sql
-- Standard cost master
CREATE TABLE standard_costs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Cost object
    cost_object_type VARCHAR(50) NOT NULL,  -- material, operation, equipment_hour, labor_hour, overhead, activity
    cost_object_id UUID,
    cost_object_code VARCHAR(50) NOT NULL,
    cost_object_description TEXT,

    -- Cost components
    material_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    labor_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    equipment_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    overhead_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    total_standard_cost DECIMAL(18,4) NOT NULL,

    -- Unit of measure
    cost_per_unit VARCHAR(50) NOT NULL,  -- per sheet, per hour, per setup, etc.

    -- Cost center mapping
    cost_center_id UUID,
    gl_account VARCHAR(50),

    -- Value analysis
    value_category VARCHAR(50) NOT NULL,  -- value_added, business_value_added, non_value_added
    financial_impact_category VARCHAR(50),

    -- Effective dating
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_current BOOLEAN NOT NULL DEFAULT true,

    -- Calculation basis
    calculation_method TEXT,
    assumptions TEXT,
    variance_threshold_percent DECIMAL(10,4) DEFAULT 10,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,

    CONSTRAINT fk_std_cost_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_std_cost_object UNIQUE (tenant_id, cost_object_type, cost_object_code, effective_from),
    CONSTRAINT chk_std_cost_amounts CHECK (total_standard_cost >= 0)
);

CREATE INDEX idx_std_costs_tenant ON standard_costs(tenant_id);
CREATE INDEX idx_std_costs_object ON standard_costs(tenant_id, cost_object_type, cost_object_code);
CREATE INDEX idx_std_costs_current ON standard_costs(tenant_id, is_current, cost_object_type) WHERE is_current = true;
CREATE INDEX idx_std_costs_effective ON standard_costs(tenant_id, effective_from, effective_to);

-- Cost centers
CREATE TABLE cost_centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    cost_center_code VARCHAR(20) NOT NULL,
    cost_center_name VARCHAR(100) NOT NULL,
    cost_center_type VARCHAR(50) NOT NULL,  -- production, support, administrative, sales
    gl_account_prefix VARCHAR(20),
    manager_id UUID,
    site_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT fk_cost_center_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_cost_center_manager FOREIGN KEY (manager_id) REFERENCES users(id),
    CONSTRAINT uq_cost_center_code UNIQUE (tenant_id, cost_center_code)
);

CREATE INDEX idx_cost_centers_tenant ON cost_centers(tenant_id);
CREATE INDEX idx_cost_centers_type ON cost_centers(tenant_id, cost_center_type);
```

---

#### **C. Estimate Tables**

**Migration:** `V0.0.XX__create_estimating_tables.sql`

```sql
-- Estimate headers
CREATE TABLE estimates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Identification
    estimate_number VARCHAR(50) NOT NULL,
    estimate_date DATE NOT NULL,
    revision_number INTEGER NOT NULL DEFAULT 1,
    parent_estimate_id UUID,  -- For versioning

    -- Customer/Job
    customer_id UUID,
    customer_name VARCHAR(255),
    job_description TEXT NOT NULL,
    quantity_estimated INTEGER NOT NULL,

    -- Costing summary
    total_material_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    total_labor_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    total_equipment_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    total_overhead_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    total_outsourcing_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    total_cost DECIMAL(18,4) NOT NULL DEFAULT 0,

    -- Pricing
    suggested_price DECIMAL(18,4),
    target_margin_percentage DECIMAL(10,4),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, pending_review, approved, converted_to_quote, rejected

    -- Conversion
    converted_to_quote_id UUID,
    converted_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,

    CONSTRAINT fk_estimate_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_estimate_parent FOREIGN KEY (parent_estimate_id) REFERENCES estimates(id),
    CONSTRAINT uq_estimate_number UNIQUE (tenant_id, estimate_number, revision_number)
);

CREATE INDEX idx_estimates_tenant ON estimates(tenant_id);
CREATE INDEX idx_estimates_customer ON estimates(customer_id);
CREATE INDEX idx_estimates_status ON estimates(tenant_id, status);
CREATE INDEX idx_estimates_date ON estimates(estimate_date);

-- Estimate operations (breakdown by operation)
CREATE TABLE estimate_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    estimate_id UUID NOT NULL,

    -- Operation details
    sequence_number INTEGER NOT NULL,
    operation_type VARCHAR(50) NOT NULL,  -- prepress, printing, cutting, etc.
    operation_description TEXT,

    -- Resource requirements
    equipment_id UUID,
    work_center_id UUID,

    -- Time estimates
    setup_time_hours DECIMAL(10,4),
    run_time_hours DECIMAL(10,4),
    total_time_hours DECIMAL(10,4),

    -- Costs
    material_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    labor_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    equipment_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    overhead_cost DECIMAL(18,4) NOT NULL DEFAULT 0,
    operation_total_cost DECIMAL(18,4) NOT NULL DEFAULT 0,

    -- Standards reference
    standard_cost_id UUID,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_est_op_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_est_op_estimate FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
    CONSTRAINT fk_est_op_standard FOREIGN KEY (standard_cost_id) REFERENCES standard_costs(id)
);

CREATE INDEX idx_est_ops_estimate ON estimate_operations(estimate_id, sequence_number);

-- Estimate materials (materials needed for estimate)
CREATE TABLE estimate_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    estimate_id UUID NOT NULL,
    estimate_operation_id UUID,

    -- Material details
    material_id UUID NOT NULL,
    material_code VARCHAR(100),
    material_name VARCHAR(255),

    -- Quantity
    quantity_required DECIMAL(18,4) NOT NULL,
    unit_of_measure VARCHAR(20) NOT NULL,
    scrap_percentage DECIMAL(10,4) DEFAULT 0,
    quantity_with_scrap DECIMAL(18,4),

    -- Cost
    unit_cost DECIMAL(18,4) NOT NULL,
    total_cost DECIMAL(18,4) NOT NULL,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_est_mat_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_est_mat_estimate FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
    CONSTRAINT fk_est_mat_operation FOREIGN KEY (estimate_operation_id) REFERENCES estimate_operations(id) ON DELETE CASCADE
);

CREATE INDEX idx_est_mats_estimate ON estimate_materials(estimate_id);
CREATE INDEX idx_est_mats_operation ON estimate_materials(estimate_operation_id);
```

---

### 2.3 Service Layer Requirements

#### **A. EstimatingService**

**Location:** `src/modules/estimating/services/estimating.service.ts`

**Responsibilities:**
- Create/update/delete estimates
- Calculate operation costs
- Apply standard costs
- Manage estimate versions
- Convert estimate to quote

**Key Methods:**

```typescript
class EstimatingService {
  // Create new estimate
  async createEstimate(input: CreateEstimateInput): Promise<Estimate>

  // Add operation to estimate
  async addOperation(estimateId: string, operation: EstimateOperationInput): Promise<EstimateOperation>

  // Calculate operation costs using standard costs
  async calculateOperationCost(operation: EstimateOperationInput): Promise<OperationCostResult>

  // Recalculate entire estimate
  async recalculateEstimate(estimateId: string): Promise<Estimate>

  // Create new estimate revision
  async createRevision(estimateId: string): Promise<Estimate>

  // Convert estimate to quote
  async convertToQuote(estimateId: string, quoteInput: QuoteInput): Promise<Quote>

  // Apply estimate template
  async applyTemplate(estimateId: string, templateId: string): Promise<Estimate>
}
```

---

#### **B. JobCostingService**

**Location:** `src/modules/job-costing/services/job-costing.service.ts`

**Responsibilities:**
- Initialize job cost when job approved
- Collect actual costs from production
- Calculate variances
- Generate profitability reports
- Close job costing period

**Key Methods:**

```typescript
class JobCostingService {
  // Initialize job cost record from estimate/quote
  async initializeJobCost(jobId: string, estimateId?: string): Promise<JobCost>

  // Update actual costs from production activities
  async updateActualCosts(jobId: string, costs: ActualCostInput): Promise<JobCost>

  // Rollup costs from production orders
  async rollupProductionCosts(jobId: string): Promise<JobCost>

  // Calculate cost variance (actual vs estimate)
  async calculateVariance(jobId: string): Promise<CostVariance>

  // Get job profitability
  async getJobProfitability(jobId: string): Promise<JobProfitability>

  // Close job costing (lock record)
  async closeJobCosting(jobId: string): Promise<JobCost>

  // Variance analysis report
  async getVarianceReport(filters: VarianceReportFilters): Promise<VarianceReport>
}
```

---

#### **C. StandardCostService**

**Location:** `src/modules/standard-costs/services/standard-cost.service.ts`

**Responsibilities:**
- Manage standard cost master data
- Cost center management
- Apply standard costs to estimates
- Track cost changes over time

**Key Methods:**

```typescript
class StandardCostService {
  // Get current standard cost for object
  async getCurrentStandardCost(costObjectType: string, costObjectCode: string): Promise<StandardCost>

  // Create/update standard cost
  async upsertStandardCost(input: StandardCostInput): Promise<StandardCost>

  // Manage effective dates
  async expireStandardCost(standardCostId: string, effectiveTo: Date): Promise<void>

  // Get cost center
  async getCostCenter(costCenterCode: string): Promise<CostCenter>

  // Calculate overhead rate
  async calculateOverheadRate(costCenterId: string, period: DateRange): Promise<number>
}
```

---

### 2.4 GraphQL API Requirements

#### **A. Estimating Schema**

**File:** `src/graphql/schema/estimating.graphql`

```graphql
# =====================================================
# ESTIMATING MODULE
# =====================================================

type Estimate {
  id: ID!
  estimateNumber: String!
  estimateDate: Date!
  revisionNumber: Int!
  customerId: ID
  customerName: String
  jobDescription: String!
  quantityEstimated: Int!
  totalMaterialCost: Float!
  totalLaborCost: Float!
  totalEquipmentCost: Float!
  totalOverheadCost: Float!
  totalCost: Float!
  suggestedPrice: Float
  targetMarginPercentage: Float
  status: EstimateStatus!
  operations: [EstimateOperation!]!
  materials: [EstimateMaterial!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type EstimateOperation {
  id: ID!
  sequenceNumber: Int!
  operationType: OperationType!
  operationDescription: String
  setupTimeHours: Float
  runTimeHours: Float
  totalTimeHours: Float
  materialCost: Float!
  laborCost: Float!
  equipmentCost: Float!
  overheadCost: Float!
  operationTotalCost: Float!
}

type EstimateMaterial {
  id: ID!
  materialId: ID!
  materialCode: String!
  materialName: String!
  quantityRequired: Float!
  unitOfMeasure: String!
  scrapPercentage: Float
  quantityWithScrap: Float
  unitCost: Float!
  totalCost: Float!
}

enum EstimateStatus {
  DRAFT
  PENDING_REVIEW
  APPROVED
  CONVERTED_TO_QUOTE
  REJECTED
}

enum OperationType {
  PREPRESS
  PRINTING
  CUTTING
  FOLDING
  STITCHING
  BINDING
  COATING
  PACKAGING
}

input CreateEstimateInput {
  customerName: String!
  jobDescription: String!
  quantityEstimated: Int!
  targetMarginPercentage: Float
}

input AddEstimateOperationInput {
  estimateId: ID!
  operationType: OperationType!
  operationDescription: String
  setupTimeHours: Float
  runTimeHours: Float
  equipmentId: ID
}

input AddEstimateMaterialInput {
  estimateId: ID!
  estimateOperationId: ID
  materialId: ID!
  quantityRequired: Float!
  scrapPercentage: Float
}

# Queries
extend type Query {
  estimate(estimateId: ID!): Estimate
  estimates(status: EstimateStatus, customerId: ID, dateFrom: Date, dateTo: Date): [Estimate!]!
  estimateByNumber(estimateNumber: String!, revisionNumber: Int): Estimate
}

# Mutations
extend type Mutation {
  createEstimate(input: CreateEstimateInput!): Estimate!
  updateEstimate(estimateId: ID!, input: UpdateEstimateInput!): Estimate!
  deleteEstimate(estimateId: ID!): Boolean!

  addEstimateOperation(input: AddEstimateOperationInput!): EstimateOperation!
  updateEstimateOperation(operationId: ID!, input: UpdateEstimateOperationInput!): EstimateOperation!
  deleteEstimateOperation(operationId: ID!): Boolean!

  addEstimateMaterial(input: AddEstimateMaterialInput!): EstimateMaterial!
  deleteEstimateMaterial(materialId: ID!): Boolean!

  recalculateEstimate(estimateId: ID!): Estimate!
  createEstimateRevision(estimateId: ID!): Estimate!
  convertEstimateToQuote(estimateId: ID!, quoteInput: ConvertToQuoteInput!): Quote!

  approveEstimate(estimateId: ID!): Estimate!
  rejectEstimate(estimateId: ID!, reason: String): Estimate!
}
```

---

#### **B. Job Costing Schema**

**File:** `src/graphql/schema/job-costing.graphql`

```graphql
# =====================================================
# JOB COSTING MODULE
# =====================================================

type JobCost {
  id: ID!
  jobId: ID!
  job: Job!

  # Revenue
  totalAmount: Float!

  # Actual Costs
  totalCost: Float!
  materialCost: Float!
  laborCost: Float!
  equipmentCost: Float!
  overheadCost: Float!
  outsourcingCost: Float!
  otherCost: Float!

  # Estimates
  estimatedMaterialCost: Float
  estimatedLaborCost: Float
  estimatedEquipmentCost: Float
  estimatedTotalCost: Float

  # Profitability
  grossProfit: Float!
  grossProfitMargin: Float!
  costVariance: Float
  costVariancePercentage: Float

  # Status
  status: JobCostStatus!
  costingDate: DateTime
  notes: String

  # Breakdown
  costBreakdown: [CostLineItem!]!

  createdAt: DateTime!
  updatedAt: DateTime!
}

type CostLineItem {
  costCategory: CostCategory!
  estimatedCost: Float!
  actualCost: Float!
  variance: Float!
  variancePercentage: Float!
}

enum JobCostStatus {
  ESTIMATED
  IN_PROGRESS
  COMPLETED
  REVIEWED
  APPROVED
}

enum CostCategory {
  MATERIAL
  LABOR
  EQUIPMENT
  OVERHEAD
  OUTSOURCING
  OTHER
}

type JobProfitability {
  jobId: ID!
  jobNumber: String!
  customerName: String!
  revenue: Float!
  totalCost: Float!
  grossProfit: Float!
  grossMargin: Float!
  estimatedCost: Float
  costVariance: Float
  costVariancePercentage: Float
}

type VarianceReport {
  jobs: [JobProfitability!]!
  summary: VarianceSummary!
}

type VarianceSummary {
  totalJobs: Int!
  totalRevenue: Float!
  totalCost: Float!
  totalProfit: Float!
  avgMargin: Float!
  totalVariance: Float!
  jobsOverBudget: Int!
  jobsUnderBudget: Int!
}

# Queries
extend type Query {
  jobCost(jobId: ID!): JobCost
  jobCosts(status: JobCostStatus, dateFrom: Date, dateTo: Date): [JobCost!]!
  jobProfitability(jobId: ID!): JobProfitability!
  varianceReport(filters: VarianceReportFilters): VarianceReport!
}

# Mutations
extend type Mutation {
  initializeJobCost(jobId: ID!, estimateId: ID): JobCost!
  updateActualCosts(jobId: ID!, costs: ActualCostInput!): JobCost!
  rollupProductionCosts(jobId: ID!): JobCost!
  closeJobCosting(jobId: ID!): JobCost!
}

input ActualCostInput {
  materialCost: Float
  laborCost: Float
  equipmentCost: Float
  overheadCost: Float
  outsourcingCost: Float
  otherCost: Float
}

input VarianceReportFilters {
  dateFrom: Date
  dateTo: Date
  customerId: ID
  minVariancePercentage: Float
  status: JobCostStatus
}
```

---

### 2.5 Frontend Requirements

#### **A. Estimating UI Components**

**1. Estimate Dashboard** (`EstimateDashboard.tsx`)

**Features:**
- List all estimates with filtering
- Search by estimate number, customer, date
- Status indicators (Draft, Pending Review, Approved, etc.)
- Quick actions (view, edit, copy, convert to quote)
- KPIs: Total estimates, pending review, conversion rate

**2. Estimate Detail/Builder** (`EstimateBuilder.tsx`)

**Features:**
- Estimate header (customer, job description, quantity)
- Operation builder
  - Add/remove operations
  - Drag-to-reorder sequence
  - Setup/run time inputs
  - Auto-calculate costs from standards
- Material selector
  - Add materials per operation
  - Quantity with scrap allowance
  - Unit cost lookup
- Cost summary panel
  - Material, labor, equipment, overhead breakdown
  - Total cost
  - Suggested price calculator (cost + markup)
  - Target margin validator
- Actions
  - Save draft
  - Submit for approval
  - Create revision
  - Convert to quote

**3. Estimate Template Manager** (`EstimateTemplates.tsx`)

**Features:**
- Create reusable estimate templates
- Standard operation sequences by product type
- Default materials and quantities
- Quick-start estimates from templates

---

#### **B. Job Costing UI Components**

**1. Job Costing Dashboard** (`JobCostingDashboard.tsx`)

**Features:**
- List all jobs with cost tracking
- Filters: Status, date range, customer, cost variance
- Sortable columns:
  - Job number
  - Customer
  - Revenue
  - Actual cost
  - Gross profit
  - Margin %
  - Cost variance
- KPIs:
  - Total jobs tracked
  - Total revenue
  - Total cost
  - Average margin
  - Jobs over/under budget
  - Total cost variance
- Drill-down to job cost detail

**2. Job Cost Detail** (`JobCostDetail.tsx`)

**Features:**
- Job summary (job number, customer, status)
- Revenue section (invoice amount)
- Cost breakdown
  - Estimated vs. actual by category
  - Visual variance indicators (red/green)
  - Percentage variance
- Cost categories:
  - Materials (with drill-down to items)
  - Labor (with drill-down to time entries)
  - Equipment (with drill-down to machine hours)
  - Overhead (allocation method shown)
  - Outsourcing (with vendor info)
  - Other costs
- Profitability metrics
  - Gross profit
  - Gross margin %
  - Cost variance $
  - Cost variance %
- Timeline/history of cost updates
- Notes/adjustments log

**3. Variance Analysis Report** (`VarianceAnalysisReport.tsx`)

**Features:**
- Multi-job variance comparison
- Filters: Date range, customer, min variance threshold
- Summary metrics:
  - Total jobs
  - Total revenue/cost/profit
  - Average margin
  - Total variance
  - Jobs over/under budget count
- Exportable report (CSV, PDF)
- Charts:
  - Variance by job (bar chart)
  - Margin % distribution (histogram)
  - Cost category variance (stacked bar)
  - Trend over time (line chart)

---

#### **C. Standard Costs UI Components**

**1. Standard Cost Manager** (`StandardCostManager.tsx`)

**Features:**
- List all standard costs by type
- Filters: Cost object type, active/inactive, effective date
- CRUD operations for standard costs
- Effective dating management
- Approval workflow
- Cost center assignment

**2. Cost Center Manager** (`CostCenterManager.tsx`)

**Features:**
- List cost centers
- Create/edit cost centers
- Assign managers
- Link to GL accounts
- Track overhead rates

---

## 3. Implementation Recommendations

### 3.1 Implementation Phases

#### **Phase 1: Database Foundation** (Priority: CRITICAL)

**Tasks:**
1. Create migration `V0.0.XX__create_standard_costs_tables.sql`
   - `standard_costs` table
   - `cost_centers` table
   - Indexes

2. Create migration `V0.0.XX__create_estimating_tables.sql`
   - `estimates` table
   - `estimate_operations` table
   - `estimate_materials` table
   - Indexes

3. Create migration `V0.0.XX__create_job_costing_tables.sql`
   - `job_costs` table
   - Indexes
   - Triggers for calculated fields

4. Seed standard cost data
   - Material standard costs (from existing materials)
   - Labor hour rates by skill level
   - Equipment hour rates
   - Overhead allocation rates

**Deliverables:**
- 3 migration files
- Seed data scripts
- Database schema documentation

**Estimated Effort:** 2-3 days

---

#### **Phase 2: Backend Services** (Priority: HIGH)

**Tasks:**
1. **StandardCostService**
   - CRUD for standard costs
   - Cost center management
   - Lookup current standard cost
   - Effective dating logic

2. **EstimatingService**
   - Create/update estimates
   - Add operations/materials
   - Calculate costs using standard costs
   - Integrate with existing `QuoteCostingService` for BOM explosion
   - Version management
   - Convert estimate to quote

3. **JobCostingService**
   - Initialize job cost from estimate
   - Rollup actual costs from production
   - Calculate variances
   - Profitability calculations
   - Close job costing

4. **Integration Points**
   - Hook into production order completion
   - Hook into material consumption tracking
   - Hook into labor tracking
   - Hook into invoice creation

**Deliverables:**
- 3 service classes with unit tests
- Integration tests
- Service documentation

**Estimated Effort:** 1-2 weeks

---

#### **Phase 3: GraphQL API** (Priority: HIGH)

**Tasks:**
1. Create `estimating.graphql` schema
2. Create `job-costing.graphql` schema
3. Create `standard-costs.graphql` schema
4. Implement resolvers:
   - `EstimatingResolver`
   - `JobCostingResolver`
   - `StandardCostResolver`
5. Add queries/mutations per requirements
6. Integration testing with GraphQL Playground

**Deliverables:**
- 3 GraphQL schema files
- 3 resolver classes
- GraphQL documentation
- Postman/GraphQL test collections

**Estimated Effort:** 1 week

---

#### **Phase 4: Frontend - Estimating UI** (Priority: MEDIUM)

**Tasks:**
1. **EstimateDashboard.tsx**
   - List view with filtering
   - Status badges
   - KPIs
   - Navigation to detail

2. **EstimateBuilder.tsx**
   - Estimate header form
   - Operation builder (add/edit/reorder)
   - Material selector
   - Cost summary panel
   - Actions (save, submit, convert to quote)

3. **EstimateTemplates.tsx** (Optional)
   - Template manager
   - Quick-start from template

4. GraphQL queries/mutations
   - Create `estimatingQueries.ts`
   - Integrate with Apollo Client

**Deliverables:**
- 3 React components
- GraphQL query/mutation hooks
- Component tests
- User documentation

**Estimated Effort:** 1-2 weeks

---

#### **Phase 5: Frontend - Job Costing UI** (Priority: MEDIUM)

**Tasks:**
1. **JobCostingDashboard.tsx**
   - List view with filters
   - Sortable columns
   - KPIs
   - Drill-down to detail

2. **JobCostDetail.tsx**
   - Job summary
   - Cost breakdown (estimated vs. actual)
   - Profitability metrics
   - Variance indicators
   - Cost update timeline

3. **VarianceAnalysisReport.tsx**
   - Multi-job report
   - Summary metrics
   - Charts (variance, margin, trends)
   - Export functionality

4. GraphQL queries
   - Create `jobCostingQueries.ts`

**Deliverables:**
- 3 React components
- GraphQL query hooks
- Charts (using Chart.js or Recharts)
- Component tests

**Estimated Effort:** 1-2 weeks

---

#### **Phase 6: Standard Costs UI** (Priority: LOW)

**Tasks:**
1. **StandardCostManager.tsx**
   - List/CRUD for standard costs
   - Effective dating UI
   - Approval workflow

2. **CostCenterManager.tsx**
   - List/CRUD for cost centers
   - GL account mapping

**Deliverables:**
- 2 React components
- Admin UI integration

**Estimated Effort:** 3-5 days

---

#### **Phase 7: Integration & Testing** (Priority: HIGH)

**Tasks:**
1. End-to-end workflow testing
   - Create estimate → Convert to quote → Job approval → Production → Job costing → Variance analysis
2. Performance testing
   - BOM explosion for complex products
   - Cost rollup for large jobs
   - Report generation
3. User acceptance testing
4. Documentation
   - User guides
   - API documentation
   - Admin setup guide

**Deliverables:**
- Test plans & results
- User documentation
- Training materials

**Estimated Effort:** 1 week

---

### 3.2 Total Implementation Estimate

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Database | 2-3 days | CRITICAL |
| Phase 2: Backend Services | 1-2 weeks | HIGH |
| Phase 3: GraphQL API | 1 week | HIGH |
| Phase 4: Estimating UI | 1-2 weeks | MEDIUM |
| Phase 5: Job Costing UI | 1-2 weeks | MEDIUM |
| Phase 6: Standard Costs UI | 3-5 days | LOW |
| Phase 7: Integration & Testing | 1 week | HIGH |
| **TOTAL** | **6-9 weeks** | - |

---

### 3.3 Technical Considerations

#### **A. Leverage Existing Infrastructure**

**Reuse:**
- ✅ `QuoteCostingService` for BOM explosion and material costing
- ✅ `QuoteManagementService` for estimate-to-quote conversion
- ✅ Finance module for GL integration and cost allocations
- ✅ Production order schema for actual cost collection

**Benefits:**
- Reduced development time
- Consistent costing logic
- Proven algorithms (BOM explosion, scrap calculation)

---

#### **B. Performance Optimization**

**Potential Bottlenecks:**
1. **BOM Explosion** for complex products with deep nesting
   - **Mitigation:** Caching, materialized views, max depth limit (already 5)

2. **Cost Rollup** for jobs with many production orders
   - **Mitigation:** Incremental updates, batch processing, async jobs

3. **Variance Report** across many jobs
   - **Mitigation:** Indexed queries, summary tables, pagination

**Recommendations:**
- Use database triggers for auto-calculating `gross_profit`, `cost_variance`
- Implement Redis caching for standard costs (frequently accessed)
- Consider OLAP cube for advanced variance analytics

---

#### **C. Data Integrity**

**Critical Constraints:**
- One `job_cost` per `job` (UNIQUE constraint)
- Standard costs must have non-overlapping effective date ranges per object
- Cost totals must equal sum of components (CHECK constraints or triggers)

**Audit Trail:**
- Track all cost updates with timestamps
- Log estimate revisions
- Record who approved/closed job costs

---

#### **D. Multi-Tenant Considerations**

All tables include `tenant_id` for isolation:
```sql
tenant_id UUID NOT NULL,
CONSTRAINT fk_xxx_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
```

Row-level security (RLS) policies should be applied:
```sql
CREATE POLICY tenant_isolation ON job_costs
FOR ALL
TO authenticated_users
USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

---

## 4. Integration Points

### 4.1 Upstream Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| **Jobs table** | Job master data | ✅ Exists (job.yaml defined) |
| **Materials table** | Material master for costing | ✅ Exists |
| **Products table** | Product master for BOM | ✅ Exists |
| **Production Orders** | Actual production data | ⚠️ Schema defined, not deployed |
| **Labor Tracking** | Actual labor hours/costs | ❓ Unknown status |
| **Material Consumption** | Actual material usage | ❓ Unknown status |
| **Invoices** | Revenue for job profitability | ✅ Exists (finance module) |

**Recommendations:**
- Verify `jobs` table exists before creating `job_costs` FK
- Check if `production_orders`, `labor_tracking`, `material_consumption` tables need to be created first
- Coordinate with production module implementation

---

### 4.2 Downstream Consumers

| Consumer | Purpose | Integration Point |
|----------|---------|-------------------|
| **Sales Quotes** | Pricing from estimates | `convertEstimateToQuote()` |
| **Production Planning** | Standard costs for planning | Standard costs lookup |
| **Financial Reporting** | Job profitability | `job_costs` table |
| **Executive Dashboard** | Margin KPIs | Variance report API |
| **Inventory Forecasting** | Material requirements | Estimate materials |

---

## 5. Risk Assessment

### 5.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Complex BOM explosion performance** | High | Medium | Implement caching, limit depth, async processing |
| **Production data not available** | High | Medium | Create mock data generator for testing |
| **Standard cost maintenance burden** | Medium | High | Create bulk import tools, templates |
| **Actual cost rollup accuracy** | High | Low | Comprehensive unit tests, audit trail |
| **Currency/multi-entity complexity** | Medium | Low | Leverage existing finance module patterns |

---

### 5.2 Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Users bypass estimating, go straight to quote** | Medium | High | Make estimating optional, streamline workflow |
| **Estimate accuracy varies by estimator** | High | High | Templates, training, variance feedback loop |
| **Job costing not closed timely** | Medium | Medium | Automated reminders, enforce close deadlines |
| **Standard costs outdated** | High | Medium | Scheduled review process, variance alerts |

---

## 6. Success Metrics

### 6.1 Functional Metrics

- **Estimate Accuracy:** Avg cost variance < 10%
- **Estimate-to-Quote Conversion Rate:** > 70%
- **Job Costing Completion Rate:** > 95% of jobs costed within 30 days of completion
- **Standard Cost Currency:** > 90% of standard costs reviewed annually

---

### 6.2 Performance Metrics

- **Estimate Creation Time:** < 15 minutes for standard jobs
- **BOM Explosion:** < 2 seconds for 5-level BOM
- **Cost Rollup:** < 5 seconds for job with 10 production orders
- **Variance Report:** < 10 seconds for 100 jobs

---

### 6.3 User Adoption Metrics

- **Estimators Using System:** > 80% within 3 months
- **Estimates Created per Week:** Baseline + 20% growth
- **User Satisfaction Score:** > 4.0/5.0

---

## 7. Conclusion

The **Estimating & Job Costing Module** represents a critical gap in the current print industry ERP system. While strong foundational components exist (quote costing service, BOM explosion, finance module), the system lacks:

1. **Dedicated estimating workflow** for creating detailed cost estimates before quoting
2. **Job costing tables and services** for tracking actual costs vs. estimates
3. **Standard cost infrastructure** for maintaining cost master data
4. **Variance analysis capabilities** for profitability management

**Recommended Approach:**
- **Phase 1 (Critical):** Deploy database tables for standard costs, estimates, and job costs
- **Phase 2 (High Priority):** Build backend services leveraging existing `QuoteCostingService`
- **Phase 3 (High Priority):** Expose GraphQL APIs for frontend integration
- **Phase 4-6 (Medium Priority):** Build UI components for estimating and job costing workflows
- **Phase 7 (High Priority):** Comprehensive testing and user training

**Total Effort:** 6-9 weeks with single developer focus, can be parallelized across backend and frontend teams.

**Next Steps:**
1. Marcus (System Architect) to review and approve approach
2. Roy (Backend) to implement database migrations and services (Phases 1-2)
3. Jen (Frontend) to implement UI components (Phases 4-6)
4. Billy (QA) to develop test plans and conduct UAT (Phase 7)

---

## Appendix A: Related Requirements

- **REQ-STRATEGIC-AUTO-1735125600000:** Sales Quote Automation (implemented)
- Job costing relies on production tracking modules
- Standard costs feed into MRP and capacity planning

---

## Appendix B: Reference Documentation

### Data Model Files
- `backend/data-models/schemas/financial/job-cost.yaml`
- `backend/data-models/schemas/financial/standard-cost.yaml`
- `backend/data-models/schemas/job.yaml`
- `backend/data-models/schemas/production/production-order.yaml`

### Service Files
- `backend/src/modules/sales/services/quote-costing.service.ts`
- `backend/src/modules/sales/services/quote-pricing.service.ts`
- `backend/src/modules/sales/services/quote-management.service.ts`

### GraphQL Schema
- `backend/src/graphql/schema/sales-quote-automation.graphql`

### Database Schema
- `backend/database/schemas/finance-module.sql`
- `backend/migrations/V0.0.5__create_finance_module.sql`

### Frontend Components
- `frontend/src/pages/SalesQuoteDashboard.tsx`
- `frontend/src/pages/SalesQuoteDetailPage.tsx`

---

**END OF RESEARCH DELIVERABLE**
