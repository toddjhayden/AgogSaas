# Schema Inventory

**📍 Navigation Path:** [AGOG Home](../../../README.md) → Project Architecture → Data Models → Schema Inventory

## Purpose
This document provides a complete inventory of all schema YAML files in the AGOG project, their status, priority, and which KPIs they enable.

**Last Updated:** 2025-11-24  
**Total Schema Files:** 17  
**Schema Coverage:** Production, Financial, Quality, Equipment, Labor, HR, Procurement, Materials, Inventory

---

## Schema Files by Domain

### Production Domain (3 schemas)

#### production-run.yaml
- **Path:** `Implementation/print-industry-erp/data-models/schemas/production/production-run.yaml`
- **Version:** 0.1 (draft)
- **Priority:** CRITICAL
- **Estimated Effort:** 2 weeks
- **Blocks KPIs:** 20+
- **Entities:** ProductionRun
- **KPIs Enabled:**
  - Critical: OEE, setup_time, cycle_time, material_yield_rate, first_pass_yield
  - High: takt_time, scrap_rate, rework_rate, capacity_utilization, speed_variance
  - Medium: equipment_utilization, makeready_time, actual_vs_planned_time
- **Status:** ✅ Complete draft, ready for review

#### material-consumption.yaml
- **Path:** `Implementation/print-industry-erp/data-models/schemas/production/material-consumption.yaml`
- **Version:** 0.1 (draft)
- **Priority:** HIGH
- **Estimated Effort:** 1 week
- **Blocks KPIs:** 5+
- **Entities:** MaterialConsumption
- **KPIs Enabled:**
  - Critical: material_yield_rate, material_waste_rate
  - High: material_variance, ink_consumption_rate, paper_waste_percentage, board_utilization, trim_waste_percentage
  - Medium: material_efficiency, cost_per_good_unit
- **Status:** ✅ Complete draft, ready for review

#### core-entities.yaml
- **Path:** `Implementation/print-industry-erp/data-models/schemas/core-entities.yaml`
- **Version:** 0.1 (draft)
- **Priority:** MEDIUM
- **Estimated Effort:** Ongoing
- **Entities:** Job, ColorSpec, SpotColor, FinishingSpec
- **Status:** ⚠️ Conceptual, needs detailed expansion

---

### Financial Domain (5 schemas)

#### financial-statement.yaml
- **Path:** `Implementation/print-industry-erp/data-models/schemas/financial/financial-statement.yaml`
- **Version:** 0.1 (draft)
- **Priority:** HIGH
- **Estimated Effort:** 1 week
- **Blocks KPIs:** 25+
- **Entities:** FinancialStatement (Income Statement, Balance Sheet, Cash Flow Statement)
- **KPIs Enabled:**
  - Critical: return_on_equity, return_on_assets, revenue_growth, gross_profit_margin, net_profit_margin
  - High: working_capital_ratio, debt_to_equity_ratio, fixed_asset_turnover, interest_coverage_ratio, return_on_capital_employed, operating_profit_margin, ebitda_margin
  - Medium: asset_turnover, equity_multiplier, tangible_net_worth, days_of_inventory_outstanding, market_share (partial)
- **Status:** ✅ Complete draft, ready for review

#### cash-flow.yaml
- **Path:** `Implementation/print-industry-erp/data-models/schemas/financial/cash-flow.yaml`
- **Version:** 0.1 (draft)
- **Priority:** HIGH
- **Estimated Effort:** 1 week
- **Blocks KPIs:** 10+
- **Entities:** CashFlow
- **KPIs Enabled:**
  - Critical: cash_burn_rate, cash_reserves_in_days, operating_cash_flow, free_cash_flow
  - High: days_sales_outstanding, days_payables_outstanding, cash_conversion_cycle, runway
  - Medium: cash_flow_adequacy_ratio, average_days_delinquent, overdues_ratio
- **Status:** ✅ Complete draft, ready for review

#### invoice.yaml
- **Path:** `Implementation/print-industry-erp/data-models/schemas/financial/invoice.yaml`
- **Version:** 0.1 (draft)
- **Priority:** HIGH
- **Estimated Effort:** 1 week
- **Blocks KPIs:** 10+
- **Entities:** Invoice, InvoiceLine
- **KPIs Enabled:**
  - Critical: gross_profit_margin, job_profitability, revenue_per_job
  - High: average_order_value, revenue_growth, on_time_invoicing_rate
  - Medium: market_share (partial - needs revenue), invoice_accuracy_rate
- **Status:** ✅ Most detailed schema, ready for review

#### accounts-receivable.yaml
- **Path:** `Implementation/print-industry-erp/data-models/schemas/financial/accounts-receivable.yaml`
- **Version:** 0.1 (draft)
- **Priority:** HIGH
- **Estimated Effort:** 1 week
- **Blocks KPIs:** 5+
- **Entities:** AccountsReceivable
- **KPIs Enabled:**
  - Critical: days_sales_outstanding, accounts_receivable_turnover
  - High: average_days_delinquent, overdues_ratio, bad_debt_percentage, collection_effectiveness_index
  - Medium: aging_by_bucket, customer_payment_behavior
- **Status:** ✅ Complete draft, ready for review

#### accounts-payable.yaml
- **Path:** `Implementation/print-industry-erp/data-models/schemas/financial/accounts-payable.yaml`
- **Version:** 0.1 (draft)
- **Priority:** MEDIUM
- **Estimated Effort:** 1 week
- **Blocks KPIs:** 3+
- **Entities:** AccountsPayable
- **KPIs Enabled:**
  - Critical: days_payables_outstanding, accounts_payable_turnover
  - High: early_payment_discount_capture_rate, vendor_payment_timeliness
  - Medium: average_payment_period, ap_aging_analysis
- **Status:** ✅ Complete draft, ready for review

---

### Quality Domain (2 schemas)

#### quality-defect.yaml
- **Path:** `Implementation/print-industry-erp/data-models/schemas/quality/quality-defect.yaml`
- **Version:** 0.1 (draft)
- **Priority:** MEDIUM
- **Estimated Effort:** 1 week
- **Blocks KPIs:** 6+
- **Entities:** QualityDefect
- **KPIs Enabled:**
  - Critical: first_pass_yield, defect_rate, rework_rate
  - High: scrap_rate, quality_cost, root_cause_top_3
  - Medium: defects_per_job, rework_time_average, customer_rejection_rate (if detection_stage = customer)
- **Status:** ✅ Complete draft, ready for review

#### customer-rejection.yaml
- **Path:** `Implementation/print-industry-erp/data-models/schemas/quality/customer-rejection.yaml`
- **Version:** 0.1 (draft)
- **Priority:** MEDIUM
- **Estimated Effort:** 3 days
- **Blocks KPIs:** 3+
- **Entities:** CustomerRejection
- **KPIs Enabled:**
  - Critical: customer_rejection_rate, customer_satisfaction_score, net_promoter_score
  - High: claim_rate, quality_cost (resolution costs), average_resolution_time
  - Medium: customer_complaints_per_month, credit_amount_ratio
- **Status:** ✅ Complete draft, ready for review

---

### Equipment Domain (2 schemas)

#### equipment.yaml
- **Path:** `Implementation/print-industry-erp/data-models/schemas/equipment.yaml`
- **Version:** 0.1 (draft)
- **Priority:** MEDIUM
- **Estimated Effort:** Ongoing
- **Entities:** Equipment, MaintenanceRecord
- **Status:** ⚠️ Reasonable detail, needs financial fields extension

#### equipment-status-log.yaml
- **Path:** `Implementation/print-industry-erp/data-models/schemas/equipment/equipment-status-log.yaml`
- **Version:** 0.1 (draft)
- **Priority:** MEDIUM
- **Estimated Effort:** 1 week
- **Blocks KPIs:** 5+
- **Entities:** EquipmentStatusLog
- **KPIs Enabled:**
  - Critical: equipment_utilization_rate, equipment_uptime, equipment_downtime
  - High: mean_time_between_failures, availability_percentage, setup_time_average, makeready_time
  - Medium: breakdown_frequency, idle_time_percentage
- **Status:** ✅ Complete draft, ready for review

---

### Labor Domain (1 schema)

#### labor-tracking.yaml
- **Path:** `Implementation/print-industry-erp/data-models/schemas/labor/labor-tracking.yaml`
- **Version:** 0.1 (draft)
- **Priority:** MEDIUM
- **Estimated Effort:** 1 week
- **Blocks KPIs:** 10+
- **Entities:** LaborTracking
- **KPIs Enabled:**
  - Critical: labor_efficiency_rate, labor_productivity, direct_labor_percentage
  - High: overtime_hours_percentage, labor_cost_per_unit, revenue_per_employee, labor_utilization_rate
  - Medium: average_hourly_productivity, setup_time_per_job, downtime_hours
- **Status:** ✅ Complete draft, ready for review

---

### HR Domain (1 schema)

#### employee.yaml
- **Path:** `Implementation/print-industry-erp/data-models/schemas/hr/employee.yaml`
- **Version:** 0.1 (draft)
- **Priority:** MEDIUM
- **Estimated Effort:** 1 week
- **Blocks KPIs:** 10+
- **Entities:** Employee
- **KPIs Enabled:**
  - Critical: total_headcount, employee_turnover_rate, revenue_per_employee
  - High: average_tenure, termination_rate, voluntary_vs_involuntary_turnover, fte_count, labor_capacity_hours, absenteeism_rate
  - Medium: time_to_fill_position, employee_productivity, training_hours_per_employee
- **Status:** ✅ Complete draft, ready for review

---

### Procurement Domain (1 schema)

#### purchase-order.yaml
- **Path:** `Implementation/print-industry-erp/data-models/schemas/procurement/purchase-order.yaml`
- **Version:** 0.1 (draft)
- **Priority:** MEDIUM
- **Estimated Effort:** 1 week
- **Blocks KPIs:** 2+
- **Entities:** PurchaseOrder (header), PurchaseOrderLine
- **KPIs Enabled:**
  - Critical: purchase_order_cycle_time, vendor_on_time_delivery
  - Medium: procurement_cost_savings, vendor_lead_time_average, po_accuracy_rate
- **Status:** ✅ Complete draft, ready for review

---

### Materials Domain (1 schema)

#### materials.yaml
- **Path:** `Implementation/print-industry-erp/data-models/schemas/materials.yaml`
- **Version:** 0.1 (draft)
- **Priority:** MEDIUM
- **Estimated Effort:** Ongoing
- **Entities:** Material, Inventory, StorageLocation
- **Status:** ⚠️ Good detail level for draft

---

### Inventory Domain (1 schema)

#### unified-inventory.yaml
- **Path:** `Project Architecture/data-models/unified-inventory.yaml`
- **Version:** 0.1 (draft)
- **Priority:** MEDIUM
- **Estimated Effort:** Ongoing
- **Entities:** InventoryItem, LotTracking
- **Status:** ⚠️ Bare-bones, needs expansion

---

## Summary Statistics

### Completion Status
- ✅ **Complete Drafts:** 11 schemas (production-run, invoice, financial-statement, cash-flow, material-consumption, quality-defect, customer-rejection, equipment-status-log, labor-tracking, employee, accounts-receivable, accounts-payable, purchase-order)
- ⚠️ **Needs Expansion:** 4 schemas (core-entities, equipment, materials, unified-inventory)
- **Total:** 17 schemas

### Priority Distribution
- **CRITICAL:** 1 schema (production-run)
- **HIGH:** 5 schemas (invoice, financial-statement, cash-flow, material-consumption, accounts-receivable)
- **MEDIUM:** 11 schemas (all others)

### Domain Coverage
- **Production:** 3 schemas
- **Financial:** 5 schemas
- **Quality:** 2 schemas
- **Equipment:** 2 schemas
- **Labor:** 1 schema
- **HR:** 1 schema
- **Procurement:** 1 schema
- **Materials:** 1 schema
- **Inventory:** 1 schema

### KPI Impact
- **Total KPIs Enabled:** 80+ across all business functions
- **Highest Impact:** financial-statement.yaml (25+ KPIs)
- **Second Highest:** production-run.yaml (20+ KPIs)
- **Critical KPIs Unlocked:** 35+ (OEE, FPY, ROE, ROA, margins, DSO, DPO, burn rate, etc.)

---

## Implementation Roadmap

### Phase 1 (Weeks 1-2): Production Foundation
**Schemas:** production-run, quality-defect  
**KPIs Enabled:** 15 (OEE, FPY, setup time, defect rate, scrap, rework, cycle time)  
**Status:** ✅ Schemas complete, ready for implementation

### Phase 2 (Weeks 3-4): Financial & Invoicing
**Schemas:** invoice, financial-statement  
**KPIs Enabled:** 30+ (margins, ROE, ROA, revenue growth, job profitability)  
**Status:** ✅ Schemas complete, ready for implementation

### Phase 3 (Weeks 5-6): Material & Inventory
**Schemas:** material-consumption, purchase-order, accounts-payable  
**KPIs Enabled:** 15+ (yield, waste, inventory turnover, DPO, AP turnover)  
**Status:** ✅ Schemas complete, ready for implementation

### Phase 4 (Weeks 7-8): Cash Flow & AR
**Schemas:** cash-flow, accounts-receivable  
**KPIs Enabled:** 15+ (DSO, burn rate, CCC, OCF, FCF, AR turnover)  
**Status:** ✅ Schemas complete, ready for implementation

### Phase 5 (Weeks 9-10): Equipment & Maintenance
**Schemas:** equipment-status-log  
**KPIs Enabled:** 10+ (utilization, uptime, downtime, MTBF)  
**Status:** ✅ Schema complete, ready for implementation

### Phase 6 (Weeks 11-12): Labor & Headcount
**Schemas:** labor-tracking, employee  
**KPIs Enabled:** 10+ (labor efficiency, productivity, turnover, FTE)  
**Status:** ✅ Schemas complete, ready for implementation

### Phase 7 (Weeks 13-14): Customer Quality
**Schemas:** customer-rejection  
**KPIs Enabled:** 5+ (rejection rate, satisfaction, NPS, claim rate)  
**Status:** ✅ Schema complete, ready for implementation

### Phase 8 (Weeks 15+): Advanced Analytics
**Schemas:** TBD (TaxRecord, CapitalInvestment - often external systems)  
**KPIs Enabled:** 5+ (tax metrics, CAPEX ROI)  
**Status:** ⏳ Not started, optional phase

---

## Next Steps

1. **Review Phase:** Review all 11 complete draft schemas for accuracy and completeness
2. **Validation Scripts:** Create `scripts/validate-kpi-schemas.js` to check schema-KPI consistency
3. **KPI Definition YAMLs:** Create separate YAML files for KPI definitions that reference schemas
4. **Dependency Mapping:** Generate `schema-kpi-map.yaml` showing which schemas block which KPIs
5. **Schema Expansion:** Complete the 4 schemas that need expansion (core-entities, equipment, materials, unified-inventory)
6. **Implementation:** Begin Phase 1 with production-run and quality-defect entities

---

## Related Documentation
- [kpi-definitions.md](./kpi-definitions.md) - Comprehensive KPI definitions with schema mappings
- [unified-inventory.yaml](./unified-inventory.yaml) - Inventory schema
- [GAPS.md](../../../GAPS.md) - Documentation gaps tracking
- [TODO.md](../../../TODO.md) - Task tracking

---

**Completed:** 2025-11-24  
**Status:** 11 of 17 schemas complete and ready for review, 4 need expansion  
**Milestone:** All critical schema gaps closed ✨

[⬆ Back to top](#schema-inventory) | [🏠 AGOG Home](../../../README.md)
