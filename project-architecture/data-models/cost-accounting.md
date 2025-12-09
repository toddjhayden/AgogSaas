**📍 Navigation Path:** [AGOG Home](../../README.md) → [Project Architecture](../README.md) → Cost Accounting

# Cost Accounting System

> **AGOG's Competitive Advantage:** Complete financial visibility - we track **EVERY** cost, not just production costs.
>
> Most print ERPs only track direct job costs. AGOG captures the **complete financial picture** including equipment financing, HR actuals, customer contracts, government compliance, and environmental costs. This enables true profitability analysis and prevents the financial surprises that sink print companies.

## Overview

AGOG's cost accounting system is built on the principle: **If it affects cash flow, we track it.**

**Traditional Print ERP:**
- ❌ Job costing (materials + labor + machine time)
- ❌ Missing: Equipment loans, HR actuals, environmental fees, customer rebates
- ❌ Result: "Profitable" jobs that actually lose money

**AGOG Approach:**
- ✅ **Complete cost tracking** - Every dollar in/out
- ✅ **Real-time accuracy** - Actual costs, not estimates
- ✅ **Job-level allocation** - True profitability per job
- ✅ **Compliance ready** - Government reporting built-in

---

## 1. Production Cost Centers

### Direct Production Areas
```
Prepress Operations
├─ Design/File Prep
├─ Proofing
├─ Plate Making
└─ Color Management

Press Operations
├─ Offset Presses (by press)
├─ Digital Presses (by press)
├─ Wide Format
└─ Specialty Printing

Finishing Operations
├─ Cutting/Trimming
├─ Folding
├─ Binding/Stitching
├─ Laminating/Coating
└─ Die Cutting

Shipping/Receiving
├─ Receiving/Inspection
├─ Packaging
├─ Shipping/Delivery
└─ Fulfillment Services
```

### Support/Overhead Areas
```
Facility Costs
├─ Rent/Mortgage
├─ Property Taxes
├─ Building Insurance
├─ Utilities (electricity, gas, water)
└─ Maintenance/Repairs

Administrative
├─ Office Salaries
├─ Software Licenses
├─ Office Supplies
└─ Professional Services (legal, accounting)

Sales/Marketing
├─ Sales Salaries/Commissions
├─ Marketing Expenses
├─ Customer Acquisition Costs
└─ Trade Shows/Events
```

---

## 2. Equipment Financing & Asset Costs

### Equipment Acquisition Costs
**CRITICAL:** Most ERPs don't track equipment financing - AGOG does.

```yaml
equipment_financing:
  purchase_costs:
    - purchase_price: Actual equipment cost
    - delivery_installation: Setup and installation fees
    - training_costs: Operator training
    - integration_costs: Software/network integration
  
  financing_methods:
    cash_purchase:
      - upfront_payment: Full amount paid
      - opportunity_cost: Track against other uses of cash
    
    equipment_loan:
      - loan_amount: Principal borrowed
      - interest_rate: Annual percentage rate
      - loan_term: Duration in months
      - monthly_payment: Payment amount
      - total_interest: Lifetime interest paid
      - lien_holder: Bank/lender name
      - lien_release_date: When equipment is owned free-and-clear
    
    equipment_lease:
      - lease_type: Capital lease vs Operating lease
      - monthly_payment: Payment amount
      - lease_term: Duration in months
      - buyout_option: End-of-lease purchase price
      - lessor: Leasing company
    
    lease_to_own:
      - monthly_payment: Payment amount
      - ownership_date: When equipment becomes owned
      - total_cost: Lifetime payments
```

**Why This Matters:**
- ✅ **Cash flow accuracy** - Know monthly obligations
- ✅ **True job costing** - Allocate financing costs to jobs
- ✅ **Asset visibility** - Know what you own vs owe
- ✅ **Prevent disasters** - Real company went bankrupt because equipment liens weren't tracked

### Depreciation & Book Value
```yaml
depreciation_tracking:
  methods:
    - straight_line: Equal depreciation per year
    - declining_balance: Accelerated depreciation
    - units_of_production: Based on actual usage
  
  tracking:
    - purchase_date: When asset acquired
    - purchase_price: Original cost
    - useful_life: Expected years of service
    - salvage_value: Estimated end-of-life value
    - accumulated_depreciation: Total depreciation to-date
    - current_book_value: Purchase price - accumulated depreciation
    - tax_depreciation: For tax reporting (may differ from book)
```

### Maintenance & Service Contracts
```yaml
equipment_maintenance:
  contracts:
    - vendor: Service provider name
    - contract_type: Full service vs parts only
    - monthly_cost: Fixed payment
    - coverage: What's included/excluded
    - response_time: Guaranteed response SLA
    - contract_start: Start date
    - contract_end: End date
    - auto_renew: Whether contract auto-renews
  
  actual_costs:
    - scheduled_maintenance: Preventive maintenance
    - unscheduled_repairs: Breakdown repairs
    - parts_costs: Replacement parts
    - labor_costs: Technician time
    - downtime_costs: Lost production value
```

---

## 3. Human Resources Actual Costs

### Employee Compensation (Complete Picture)
**Most ERPs track "labor hours" - AGOG tracks ACTUAL HR costs.**

```yaml
hr_actual_costs:
  direct_compensation:
    - base_salary: Annual/hourly rate
    - overtime_pay: Time-and-a-half, double-time
    - shift_differentials: Night/weekend premiums
    - bonuses: Performance bonuses
    - commissions: Sales commissions
  
  benefits_costs:
    - health_insurance: Employer portion
    - dental_insurance: Employer portion
    - vision_insurance: Employer portion
    - life_insurance: Employer-paid premiums
    - disability_insurance: Short-term and long-term
    - retirement_contributions: 401k matching
    - pension_contributions: If applicable
  
  payroll_taxes:
    - fica_social_security: Employer portion (6.2%)
    - fica_medicare: Employer portion (1.45%)
    - federal_unemployment: FUTA tax
    - state_unemployment: SUTA tax
    - state_disability: If applicable
    - workers_compensation: Industry rate (printing has specific rate)
  
  other_hr_costs:
    - recruitment_costs: Job postings, agency fees
    - onboarding_training: New hire training
    - continuing_education: Skills development
    - uniforms_ppe: Clothing, safety equipment
    - employee_assistance: EAP programs
```

**Why This Matters:**
- ✅ **True labor costs** - $20/hour employee actually costs $28-32/hour
- ✅ **Job profitability** - Allocate real costs, not just wages
- ✅ **Budgeting accuracy** - Plan for total compensation, not just salary

### Payroll Integration vs Tracking
```
AGOG Strategy:
├─ Track: All HR costs in AGOG for job costing
├─ Integrate: Sync to ADP/Gusto/Paychex for actual payroll processing
└─ Report: Pull actual costs back into AGOG for financial reporting

Why: Payroll systems process payments. AGOG allocates costs to jobs.
```

---

## 4. Customer Contracts & Pricing Agreements

### Customer-Specific Pricing
**CRITICAL:** Volume discounts, rebates, and special terms affect profitability.

```yaml
customer_contracts:
  pricing_agreements:
    - contract_type: Volume commitment, blanket PO, annual agreement
    - effective_date: When pricing starts
    - expiration_date: When pricing ends
    - auto_renew: Whether contract auto-renews
    - renegotiation_terms: When pricing can be renegotiated
  
  discounts:
    - volume_discounts: Tiered pricing based on quantity
    - frequency_discounts: Discounts for repeat customers
    - prompt_payment_discounts: 2/10 net 30 terms
    - contract_discounts: Negotiated percentage off list
    - seasonal_discounts: Time-based promotions
  
  rebates:
    - quarterly_rebates: Based on quarterly volume
    - annual_rebates: Based on annual spend
    - growth_rebates: Based on year-over-year growth
    - rebate_calculation: Formula for calculating amount
    - rebate_payment_terms: When rebate is paid
  
  payment_terms:
    - standard_terms: Net 30, Net 60, etc.
    - early_payment_discount: 2/10 net 30
    - late_payment_penalty: Interest on overdue amounts
    - credit_limit: Maximum outstanding balance
    - payment_method: Check, ACH, credit card
```

**Why This Matters:**
- ✅ **True revenue** - Account for discounts and rebates in job pricing
- ✅ **Cash flow forecasting** - Know when payments are expected
- ✅ **Prevent losses** - High-volume customer with rebates may be unprofitable

---

## 5. Government Compliance & Tax Obligations

### Tax Tracking & Reporting
```yaml
tax_obligations:
  sales_tax:
    - state_sales_tax: By state (printing may be exempt in some states)
    - local_sales_tax: City/county taxes
    - use_tax: For out-of-state purchases
    - exemption_tracking: Tax-exempt customers (government, nonprofits)
    - nexus_tracking: Where company has sales tax obligation
  
  income_tax:
    - federal_corporate_tax: Estimated quarterly payments
    - state_income_tax: By state where company operates
    - estimated_tax_payments: Quarterly estimates
    - tax_credits: R&D credits, energy credits
  
  payroll_taxes:
    - federal_withholding: Employee federal tax
    - state_withholding: Employee state tax
    - fica: Social Security + Medicare
    - futa: Federal unemployment
    - suta: State unemployment
    - local_payroll_taxes: City/county payroll taxes
  
  property_tax:
    - real_property_tax: Building/land taxes
    - personal_property_tax: Equipment/furniture taxes (varies by state)
    - assessment_dates: When taxes are assessed
    - payment_due_dates: When taxes are due
```

### Licenses, Permits & Compliance Fees
```yaml
regulatory_compliance:
  business_licenses:
    - business_license: City/county business license
    - state_license: State business registration
    - dba_filing: Doing Business As registration
    - renewal_dates: When licenses must be renewed
    - renewal_fees: Cost to renew
  
  industry_permits:
    - air_quality_permit: VOC emissions permit (printing-specific)
    - hazardous_waste_permit: Ink/chemical disposal
    - fire_department_permit: For flammable materials storage
    - building_permit: For facility modifications
    - signage_permit: For business signage
  
  compliance_costs:
    - safety_inspections: OSHA, fire marshal
    - environmental_inspections: EPA, state environmental agency
    - health_department: If food/beverage printing
    - professional_dues: Industry associations
```

**Why This Matters:**
- ✅ **Avoid surprises** - Know compliance obligations in advance
- ✅ **Budgeting** - Plan for recurring fees and renewals
- ✅ **Audit trail** - Prove compliance with timestamps

---

## 6. Environmental Costs & Reporting

### Environmental Compliance Costs
**Increasingly important:** Government regulations require tracking and reporting.

```yaml
environmental_costs:
  waste_disposal:
    - ink_waste: Pounds/gallons of ink waste
    - solvent_waste: Cleaning solvents
    - chemical_waste: Other hazardous chemicals
    - paper_waste: Scrap paper by weight
    - plate_waste: Used plates (aluminum, plastic)
    - disposal_fees: Per pound/gallon fees
    - hazmat_transport: Transportation costs
    - disposal_certifications: Certificate of disposal
  
  emissions:
    - voc_emissions: Volatile organic compounds from inks/coatings
    - carbon_emissions: From electricity, gas, vehicles
    - emission_testing: Required testing costs
    - emission_credits: If cap-and-trade system
    - offset_purchases: Carbon offsets
  
  energy_consumption:
    - electricity: KWh by equipment/area
    - natural_gas: Therms for heating
    - fuel: For vehicles/forklifts
    - renewable_energy: Solar/wind if applicable
    - energy_efficiency_rebates: Utility rebates
  
  water_usage:
    - water_consumption: Gallons used (if wet processes)
    - wastewater_discharge: Gallons discharged
    - water_treatment: Treatment costs
    - discharge_permits: Permit fees
  
  recycling_programs:
    - paper_recycling: Pounds recycled
    - cardboard_recycling: Pounds recycled
    - metal_recycling: Plates, cans
    - recycling_revenue: Income from recyclables
    - recycling_costs: Collection/transport costs
```

### Environmental Reporting Requirements
```yaml
regulatory_reports:
  government_required:
    - epa_tier_ii_report: Hazardous chemical inventory (US)
    - toxic_release_inventory: TRI reporting (US)
    - air_quality_reports: VOC emissions (varies by state)
    - waste_manifests: Hazardous waste tracking
    - csrd_reporting: Corporate sustainability (EU)
    - ghg_protocol: Greenhouse gas reporting (global)
  
  voluntary_reporting:
    - iso_14001: Environmental management certification
    - leed_certification: Green building certification
    - fsc_certification: Sustainable forestry
    - sustainability_reports: For customers/investors
```

**Why This Matters:**
- ✅ **Legal compliance** - Avoid fines and penalties
- ✅ **Customer requirements** - Many customers require sustainability reporting
- ✅ **Cost allocation** - Allocate environmental costs to jobs
- ✅ **Real-world impact** - Recent bankruptcy due to unpaid environmental fees

---

## 7. Insurance & Risk Management Costs

### Insurance Policies
```yaml
insurance_costs:
  property_insurance:
    - building_insurance: Fire, flood, earthquake
    - equipment_insurance: Replacement value
    - inventory_insurance: Raw materials, WIP, finished goods
    - business_interruption: Lost income during downtime
  
  liability_insurance:
    - general_liability: Slip-and-fall, property damage
    - professional_liability: Errors & omissions
    - product_liability: Defective products
    - cyber_liability: Data breach, ransomware
  
  employee_insurance:
    - workers_compensation: Required by law
    - employment_practices: Wrongful termination, harassment
    - key_person_insurance: On critical employees
  
  vehicle_insurance:
    - commercial_auto: Delivery vehicles
    - hired_auto: Rental vehicles
    - non_owned_auto: Employee vehicles used for business
```

---

## 8. Job Costing (Complete Picture)

### Direct Job Costs
```yaml
direct_costs:
  materials:
    - substrate: Paper, vinyl, fabric, etc.
    - inks: CMYK + spot colors
    - coatings: Varnish, laminate, UV coating
    - plates: Printing plates
    - packaging: Boxes, shrink wrap, pallets
    - shipping_materials: Cartons, padding, labels
  
  direct_labor:
    - production_labor: Actual hours worked on job
    - fully_burdened_rate: Include benefits + payroll taxes
    - overtime_premium: Additional cost for overtime
  
  machine_time:
    - machine_rate: Per hour rate including depreciation
    - setup_time: Makeready time
    - run_time: Actual production time
    - cleanup_time: Post-job cleanup
  
  outside_services:
    - trade_shops: Bindery, die cutting, embossing
    - freight: Inbound and outbound shipping
    - specialty_services: Foil stamping, embossing, etc.
```

### Allocated Overhead Costs
```yaml
overhead_allocation:
  equipment_costs:
    - depreciation: Allocated based on machine hours
    - financing_costs: Loan/lease payments allocated
    - maintenance: Service contracts + repairs
  
  facility_costs:
    - rent_mortgage: Allocated by square footage
    - utilities: Allocated by usage (electricity per machine)
    - property_taxes: Allocated by square footage
    - insurance: Allocated by asset value
  
  hr_costs:
    - indirect_labor: Supervisors, QA, maintenance
    - benefits_overhead: Benefits for indirect labor
    - training: Ongoing training costs
  
  environmental_costs:
    - waste_disposal: Allocated by waste generated
    - emission_fees: Allocated by VOC usage
    - recycling_costs: Allocated by recyclables generated
  
  administrative_costs:
    - office_salaries: Accounting, HR, IT
    - software_licenses: ERP, design software
    - professional_services: Legal, accounting
  
  sales_marketing:
    - sales_commissions: Commission on this job
    - customer_acquisition: Allocated to new customers
    - marketing_overhead: General marketing costs
```

### Customer-Specific Adjustments
```yaml
customer_adjustments:
  pricing_discounts:
    - volume_discount: Based on contract
    - frequency_discount: Repeat customer discount
    - prompt_payment_discount: If applicable
  
  future_obligations:
    - rebate_accrual: Quarterly/annual rebate accrual
    - warranty_reserve: For potential reprints
    - returns_allowance: Expected returns
```

### True Job Profitability
```yaml
profitability_calculation:
  revenue:
    - gross_revenue: Invoice amount
    - less_discounts: Contract discounts
    - less_rebate_accrual: Future rebate obligation
    - net_revenue: Actual revenue from job
  
  costs:
    - direct_costs: Materials + labor + machine + outside services
    - allocated_overhead: All overhead costs allocated
    - environmental_costs: Waste disposal + emissions
    - financing_costs: Equipment loan/lease allocation
    - customer_specific_costs: Special handling, custom packaging
    - total_costs: Sum of all costs
  
  profit_analysis:
    - gross_profit: Net revenue - direct costs
    - gross_margin_pct: Gross profit / net revenue
    - net_profit: Net revenue - total costs
    - net_margin_pct: Net profit / net revenue
    - contribution_margin: Covers fixed costs and profit
```

**Why This Matters:**
```
Traditional ERP Job Costing:
Revenue: $10,000
Direct Costs: $6,000
Gross Profit: $4,000 (40% margin) ✅ Looks profitable!

AGOG Complete Cost Accounting:
Revenue: $10,000
- Contract Discount (10%): -$1,000
- Rebate Accrual (5%): -$500
Net Revenue: $8,500

Direct Costs: $6,000
Allocated Overhead: $2,000
Environmental Costs: $150
Equipment Financing: $300
Customer Rebate Accrual: $500
Total Costs: $8,950

Net Profit: -$450 ❌ Actually losing money!
```

---

## 9. Analysis & Reporting Tools

### Cost Variance Analysis
```yaml
variance_tracking:
  material_variance:
    - standard_cost: Expected material cost
    - actual_cost: Real material cost
    - variance: Actual - standard
    - variance_pct: Variance / standard
    - root_cause: Price increase, waste, theft
  
  labor_variance:
    - standard_hours: Expected labor hours
    - actual_hours: Real labor hours
    - variance: Actual - standard
    - variance_pct: Variance / standard
    - root_cause: Training, equipment issues, complexity
  
  overhead_variance:
    - budgeted_overhead: Expected overhead
    - actual_overhead: Real overhead
    - variance: Actual - budgeted
    - root_cause: Utility spike, unexpected repairs
```

### Profitability Reporting
```yaml
profitability_reports:
  by_customer:
    - customer_revenue: Total revenue from customer
    - customer_costs: All costs allocated to customer
    - customer_profit: Revenue - costs
    - customer_margin: Profit / revenue
    - customer_lifetime_value: Projected future value
  
  by_product_category:
    - category_revenue: Business cards, brochures, etc.
    - category_costs: Costs for this category
    - category_profit: Revenue - costs
    - category_margin: Profit / revenue
  
  by_facility:
    - facility_revenue: Revenue from this location
    - facility_costs: All costs at this location
    - facility_profit: Revenue - costs
    - facility_margin: Profit / revenue
  
  by_equipment:
    - equipment_revenue: Jobs run on this equipment
    - equipment_costs: Depreciation, maintenance, financing
    - equipment_profit: Revenue - costs
    - equipment_utilization: Actual hours / available hours
```

### Break-Even Analysis
```yaml
breakeven_calculations:
  fixed_costs:
    - rent_mortgage: Monthly facility costs
    - equipment_financing: Loan/lease payments
    - salaries: Fixed salaries (not hourly)
    - insurance: Property, liability, etc.
    - utilities_base: Minimum utility costs
    - software_licenses: Monthly SaaS fees
    - total_fixed_costs: Sum of fixed costs
  
  variable_costs:
    - materials: Per job costs
    - hourly_labor: Production labor
    - utilities_variable: Usage-based costs
    - waste_disposal: Per job waste costs
    - contribution_margin: Revenue - variable costs
  
  breakeven_point:
    - breakeven_revenue: Fixed costs / contribution margin %
    - breakeven_jobs: Breakeven revenue / average job size
    - current_revenue: Actual revenue this period
    - margin_of_safety: (Current - breakeven) / current
```

### Cost Trend Tracking
```yaml
trend_analysis:
  material_costs:
    - paper_price_index: Track paper cost trends
    - ink_price_index: Track ink cost trends
    - substrate_prices: Track substrate trends
    - supplier_comparison: Compare supplier pricing
  
  labor_costs:
    - wage_trends: Track wage increases
    - benefits_trends: Track benefits cost increases
    - productivity_trends: Output per labor hour
  
  overhead_costs:
    - utility_trends: Track electricity, gas costs
    - insurance_trends: Track premium increases
    - maintenance_trends: Track repair costs
```

---

## 10. Integration with Financial Systems

### AGOG's Integration Strategy

```
AGOG owns the data. Financial software displays it.

Traditional Approach (WRONG):
Print ERP ──sync some data──> QuickBooks
(Missing: Equipment financing, HR actuals, environmental costs)
Result: Incomplete financial picture, manual reconciliation

AGOG Approach (RIGHT):
AGOG (Complete Financial Data)
  │
  ├──> QuickBooks/Xero/NetSuite (Display & Compliance)
  │     - General Ledger posting
  │     - Financial statements
  │     - Tax reporting
  │
  └──> AGOG Dashboards (Real-Time Analysis)
        - Job profitability
        - Equipment ROI
        - Customer lifetime value
        - Environmental compliance
```

### What We Sync to Financial Software
```yaml
gl_integration:
  transactions:
    - customer_invoices: AR transactions
    - vendor_bills: AP transactions
    - payroll_entries: Payroll journal entries
    - depreciation_entries: Monthly depreciation
    - accruals: Rebates, warranties, etc.
  
  chart_of_accounts:
    - revenue_accounts: By product category
    - cogs_accounts: Direct costs
    - expense_accounts: Overhead costs
    - asset_accounts: Equipment, inventory
    - liability_accounts: Loans, leases, accruals
  
  dimensions:
    - cost_centers: By department/facility
    - projects: By job (if project accounting)
    - classes: By product category
```

### What Stays in AGOG (Not Synced)
```yaml
agog_exclusive_data:
  operational_details:
    - job_specifications: What was printed
    - material_usage: Actual quantities used
    - labor_hours: Who worked on what
    - machine_time: Equipment utilization
  
  cost_allocation:
    - overhead_allocation: How costs are allocated
    - customer_profitability: Per-customer analysis
    - equipment_roi: Per-equipment analysis
    - environmental_metrics: Waste, emissions, energy
  
  analytics:
    - kpi_calculations: OEE, yield, utilization
    - predictive_analytics: Forecasting
    - optimization_recommendations: AI-driven insights
```

**Why This Matters:**
- ✅ **Single source of truth** - AGOG has complete picture
- ✅ **Financial compliance** - Sync to QuickBooks for tax/reporting
- ✅ **Operational insight** - Keep detailed data in AGOG for analysis
- ✅ **Flexibility** - Change financial software without losing data

---

## Summary: AGOG's Complete Financial Visibility

### What Competitors Miss
```
❌ Traditional Print ERP:
- Job costing (materials + labor)
- Basic overhead allocation
- Sync to QuickBooks

Missing:
- Equipment financing costs
- HR actual costs (benefits, taxes)
- Customer contracts (discounts, rebates)
- Environmental compliance costs
- Government fees and taxes
- Insurance and risk costs
- True profitability per job/customer
```

### What AGOG Delivers
```
✅ AGOG Complete Cost Accounting:
- Every cost tracked in real-time
- True job profitability (all costs allocated)
- Equipment ROI (including financing)
- Customer lifetime value (including rebates)
- Environmental compliance (required reporting)
- Government compliance (taxes, permits, fees)
- Integration strategy (own data, sync for reporting)

Result: Know if you're REALLY making money, not just guessing.
```

### Real-World Impact
```
Recent Print Company Bankruptcy:
- Thought they were profitable (incomplete costing)
- Didn't track equipment liens properly
- Environmental fees piled up
- Major customer rebates not accrued
- Discovered losses too late to fix

AGOG Prevents This:
- Complete cost visibility from day one
- Real-time profitability analysis
- Early warning of unprofitable situations
- Data-driven decision making
```

---

**See Also:**
- [Financial Reporting System](../workflows/financial-reporting-system.md) - How costs are reported
- [Environmental Reporting](../workflows/environmental-reporting.md) - Environmental compliance details
- [BUSINESS_VALUE.md](../../Project Spirit/BUSINESS_VALUE.md) - Competitive advantage explanation

---

[⬆ Back to top](#cost-accounting-system) | [🏠 AGOG Home](../../README.md) | [🏗️ Project Architecture](../README.md)