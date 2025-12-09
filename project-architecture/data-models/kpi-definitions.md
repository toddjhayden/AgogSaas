**📍 Navigation Path:** [AGOG Home](../../README.md) → [Project Architecture](../README.md) → [Data Models](./README.md) → KPI Definitions

# KPI Definitions: Schema-Driven Metrics

> **Auto-generated:** 2025-11-26T00:49:00.453Z
> **Source:** `Project Architecture/data-models/kpis/*.yaml`
> **Generator:** `scripts/generate-kpi-docs.js`

## Purpose

This document defines Key Performance Indicators (KPIs) that AGOG calculates for packaging industry customers across all business functions. **Each KPI is mapped to specific schema entities/fields**, ensuring that:

1. **Workflows are validated against the schema** - If a workflow claims to provide a KPI, the schema must support it
2. **Schema changes consider KPI impact** - Breaking a KPI calculation is a breaking change
3. **KPIs drive schema requirements** - Business-critical KPIs that can't be calculated reveal schema gaps

**Schema Sources:** `Implementation/print-industry-erp/data-models/schemas/`

**KPI Categories:**
- Production Efficiency (OEE, throughput, cycle time, schedule adherence)
- Quality Management (FPY, defect rates, Cost of Quality, Customer PPM)
- Financial Performance (margins, profitability, ROI, ROE, ROA)
- Cash Flow Management (DSO, DPO, cash conversion cycle)
- Equipment Performance (MTBF, MTTR, utilization, downtime)
- Labor & Human Resources (efficiency, productivity, turnover)

## Summary

**Total KPIs:** 63

**Validation Status:**
- ✅ Can Calculate: 12 (19.0%)
- ⚠️ Partial: 3
- ❌ Cannot Calculate: 48

**Priority Distribution:**
- 🔴 Critical: 21
- 🟠 High: 34
- 🟡 Medium: 8
- 🟢 Low: 0

## Table of Contents

- [Equipment Performance](#equipment-performance) (9 KPIs)
- [Financial Performance](#financial-performance) (10 KPIs)
- [Labor_hr](#labor_hr) (12 KPIs)
- [Production Efficiency](#production-efficiency) (21 KPIs)
- [Quality Management](#quality-management) (11 KPIs)

## Equipment Performance

**Category:** Equipment Performance & Maintenance

### Equipment Utilization Rate

**ID:** `equipment_utilization_rate` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Percentage of available time equipment is in use

**Formula:**
```
(Actual Production Time / Available Time) × 100
```

**Target:** 70-85%

**Unit:** percentage

**Required Schemas:**
- `equipment-status-log.yaml`

**Required Entities:**
- EquipmentStatusLog

**Required Fields:**
- `status`
- `duration_minutes`
- `is_productive_time`
- `equipment_id`

**Calculation Notes:**
Excludes scheduled downtime (maintenance, weekends)
100% utilization not ideal - no buffer for breakdowns or rush jobs


---

### Equipment Uptime Percentage

**ID:** `equipment_uptime` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Percentage of time equipment is available and running

**Formula:**
```
(Running Time / (Running Time + Downtime)) × 100
```

**Target:** >= 90%

**Unit:** percentage

**Required Schemas:**
- `equipment-status-log.yaml`

**Required Entities:**
- EquipmentStatusLog

**Required Fields:**
- `status`
- `duration_minutes`
- `is_productive_time`
- `is_unplanned_downtime`

**Calculation Notes:**
Core reliability metric
Includes both planned and unplanned downtime


---

### Equipment Downtime Hours

**ID:** `equipment_downtime` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Total hours equipment unavailable for production

**Formula:**
```
SUM(duration_minutes WHERE is_unplanned_downtime = true) / 60
```

**Target:** < 10% of available time

**Unit:** hours

**Required Schemas:**
- `equipment-status-log.yaml`

**Required Entities:**
- EquipmentStatusLog

**Required Fields:**
- `status`
- `duration_minutes`
- `is_unplanned_downtime`
- `reason_code`

**Calculation Notes:**
Track by reason code for targeted improvements
Separate planned (maintenance) from unplanned (breakdown)


---

### Mean Time Between Failures (MTBF)

**ID:** `mean_time_between_failures` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Average time between equipment breakdowns

**Formula:**
```
Total Operating Time / Number of Failures
```

**Target:** >= 1000 hours

**Unit:** hours

**Required Schemas:**
- `equipment-status-log.yaml`

**Required Entities:**
- EquipmentStatusLog

**Required Fields:**
- `status`
- `duration_minutes`
- `reason_code`

**Calculation Notes:**
Higher is better - more reliable equipment
Track trends over time
Use to justify maintenance investments


---

### Mean Time To Repair (MTTR)

**ID:** `mean_time_to_repair` | **Priority:** 🟠 high | **Validation:** ✅ can_calculate

**Description:** Average time to repair equipment failures

**Formula:**
```
SUM(downtime_hours WHERE maintenance_type IN ('corrective', 'emergency')) / COUNT(failures)
```

**Target:** <= 4 hours

**Unit:** hours

**Required Schemas:**
- `maintenance-record.yaml`

**Required Entities:**
- MaintenanceRecord

**Required Fields:**
- `maintenance_type`
- `scheduled_date`
- `completed_date`
- `downtime_hours`
- `status`

**Calculation Notes:**
Lower is better - faster repair response
Measures maintenance team effectiveness
Calculate as: (completed_date - scheduled_date) for corrective/emergency maintenance
Alternative: Use downtime_hours field directly from maintenance records
Track by equipment type to identify training needs


---

### Availability (OEE Component)

**ID:** `availability_percentage` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Scheduled time minus downtime divided by scheduled time

**Formula:**
```
((Scheduled Time - Downtime) / Scheduled Time) × 100
```

**Target:** >= 90%

**Unit:** percentage

**Required Schemas:**
- `equipment-status-log.yaml`
- `production-run.yaml`

**Required Entities:**
- EquipmentStatusLog
- ProductionRun

**Required Fields:**
- `status`
- `duration_minutes`
- `is_productive_time`
- `is_planned_downtime`
- `is_unplanned_downtime`

**Calculation Notes:**
First component of OEE calculation
Excludes planned maintenance from denominator


---

### Average Setup Time

**ID:** `setup_time_average` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Average time to changeover equipment between jobs

**Formula:**
```
AVG(duration_minutes WHERE status = 'setup')
```

**Target:** <= 30 minutes

**Unit:** minutes

**Required Schemas:**
- `equipment-status-log.yaml`
- `production-run.yaml`

**Required Entities:**
- EquipmentStatusLog
- ProductionRun

**Required Fields:**
- `status`
- `duration_minutes`
- `reason_code`

**Calculation Notes:**
SMED (Single-Minute Exchange of Die) target: < 10 minutes
Critical for short-run profitability


---

### Preventive Maintenance Compliance

**ID:** `preventive_maintenance_compliance` | **Priority:** 🟡 medium | **Validation:** ⚠️ partial

**Description:** Percentage of scheduled PM tasks completed on time

**Formula:**
```
(PM Tasks Completed On Time / Total PM Tasks Scheduled) × 100
```

**Target:** >= 95%

**Unit:** percentage

**Required Schemas:**
- `equipment.yaml`
- `maintenance-record.yaml`

**Required Entities:**
- Equipment
- MaintenanceRecord

**Required Fields:**
- `equipment_id`
- `maintenance_type`
- `scheduled_date`
- `completed_date`
- `status`

**Calculation Notes:**
Proactive maintenance prevents breakdowns
Track overdue PM tasks


---

### Maintenance Cost per Equipment

**ID:** `maintenance_cost_per_equipment` | **Priority:** 🟡 medium | **Validation:** ⚠️ partial

**Description:** Total maintenance spend divided by equipment count

**Formula:**
```
Total Maintenance Cost / Equipment Count
```

**Target:** < 10% of equipment value annually

**Unit:** currency_per_unit

**Required Schemas:**
- `equipment.yaml`
- `maintenance-record.yaml`

**Required Entities:**
- Equipment
- MaintenanceRecord

**Required Fields:**
- `equipment_id`
- `maintenance_cost`

**Calculation Notes:**
Includes parts, labor, contractor costs
High costs may justify equipment replacement


---

## Financial Performance

**Category:** Cash Flow & Liquidity

### Cash Burn Rate

**ID:** `cash_burn_rate` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Rate at which cash reserves are being depleted

**Formula:**
```
(Beginning Cash Balance - Ending Cash Balance) / Number of Months
```

**Target:** < Monthly Revenue

**Unit:** currency_per_month

**Required Schemas:**
- `cash-flow.yaml`

**Required Entities:**
- CashFlow

**Required Fields:**
- `opening_balance`
- `closing_balance`
- `period`
- `period_type`

**Calculation Notes:**
Critical for startups and growth companies.
Negative burn rate means cash is increasing (good).


---

### Cash Reserves in Days (Runway)

**ID:** `cash_reserves_in_days` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Number of days current cash will last at current burn rate

**Formula:**
```
Current Cash Balance / Average Daily Cash Burn
```

**Target:** >= 90 days

**Unit:** days

**Required Schemas:**
- `cash-flow.yaml`

**Required Entities:**
- CashFlow

**Required Fields:**
- `closing_balance`
- `net_cash_flow`
- `period_type`

**Calculation Notes:**
Also called "runway" - how long until cash runs out.
< 30 days: Emergency
30-90 days: Concerning
> 180 days: Comfortable


---

### Days Sales Outstanding (DSO)

**ID:** `days_sales_outstanding` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Average days to collect payment from customers

**Formula:**
```
(Accounts Receivable / Total Revenue) × Number of Days in Period
```

**Target:** <= 45 days

**Unit:** days

**Required Schemas:**
- `accounts-receivable.yaml`
- `financial-statement.yaml`

**Required Entities:**
- AccountsReceivable
- FinancialStatement

**Required Fields:**
- `amount_outstanding`
- `total_revenue`
- `period`

**Calculation Notes:**
Lower is better - faster cash collection.
Compare to payment terms (Net 30, Net 45, etc.).


---

### Days Payables Outstanding (DPO)

**ID:** `days_payables_outstanding` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Average days to pay vendors

**Formula:**
```
(Accounts Payable / COGS) × Number of Days in Period
```

**Target:** 30-60 days

**Unit:** days

**Required Schemas:**
- `accounts-payable.yaml`
- `financial-statement.yaml`

**Required Entities:**
- AccountsPayable
- FinancialStatement

**Required Fields:**
- `amount_outstanding`
- `cost_of_goods_sold`
- `period`

**Calculation Notes:**
Higher is better for cash flow (but don't anger vendors).
Balance: maximize DPO while maintaining good vendor relationships.


---

### Operating Cash Flow (OCF)

**ID:** `operating_cash_flow` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Cash generated from core business operations

**Formula:**
```
Net Income + Non-Cash Expenses + Changes in Working Capital
```

**Target:** Positive and growing

**Unit:** currency

**Required Schemas:**
- `cash-flow.yaml`
- `financial-statement.yaml`

**Required Entities:**
- CashFlow
- FinancialStatement

**Required Fields:**
- `cash_inflows_operations`
- `cash_outflows_operations`
- `operating_cash_flow`

**Calculation Notes:**
Most important cash flow metric.
Company can be profitable but have negative OCF (danger sign).


---

### Free Cash Flow (FCF)

**ID:** `free_cash_flow` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Cash available after capital expenditures

**Formula:**
```
Operating Cash Flow - Capital Expenditures
```

**Target:** Positive

**Unit:** currency

**Required Schemas:**
- `cash-flow.yaml`

**Required Entities:**
- CashFlow

**Required Fields:**
- `cash_inflows_operations`
- `cash_outflows_operations`
- `cash_outflows_capex`

**Calculation Notes:**
Shows true cash generation ability.
FCF funds dividends, debt repayment, growth initiatives.


---

### Cash Conversion Cycle (CCC)

**ID:** `cash_conversion_cycle` | **Priority:** 🟠 high | **Validation:** ✅ can_calculate

**Description:** Days to convert inventory and receivables into cash

**Formula:**
```
((Accounts Receivable / Total Revenue) × Days) + ((Inventory / COGS) × Days) - ((Accounts Payable / COGS) × Days)
```

**Target:** < 60 days

**Unit:** days

**Required Schemas:**
- `accounts-receivable.yaml`
- `accounts-payable.yaml`
- `financial-statement.yaml`

**Required Entities:**
- AccountsReceivable
- AccountsPayable
- FinancialStatement

**Required Fields:**
- `amount_outstanding`
- `total_revenue`
- `cost_of_goods_sold`
- `period`

**Calculation Notes:**
Measures working capital efficiency.
CCC = DSO + DIO - DPO (broken down into component calculations)
Lower is better - less cash tied up in operations.
Negative CCC means vendors finance your working capital (rare but excellent).

Component formulas:
- DSO (Days Sales Outstanding) = (SUM(AR.amount_outstanding) / FS.total_revenue) × Days
- DIO (Days Inventory Outstanding) = (SUM(MI.total_cost) / FS.cost_of_goods_sold) × Days  
- DPO (Days Payables Outstanding) = (SUM(AP.amount_outstanding) / FS.cost_of_goods_sold) × Days

Inventory value from material_inventory table (separate query, not in required_fields)


---

### Average Days Delinquent

**ID:** `average_days_delinquent` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Average days invoices are overdue

**Formula:**
```
SUM(Days Overdue) / COUNT(Overdue Invoices)
```

**Target:** <= 15 days

**Unit:** days

**Required Schemas:**
- `accounts-receivable.yaml`

**Required Entities:**
- AccountsReceivable

**Required Fields:**
- `days_overdue`
- `is_overdue`
- `status`

**Calculation Notes:**
Only counts invoices past due date.
High value indicates collection problems.


---

### Overdues Ratio

**ID:** `overdues_ratio` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Overdue AR as percentage of total AR

**Formula:**
```
(Overdue AR Amount / Total AR Amount) × 100
```

**Target:** <= 20%

**Unit:** percentage

**Required Schemas:**
- `accounts-receivable.yaml`

**Required Entities:**
- AccountsReceivable

**Required Fields:**
- `amount_outstanding`
- `is_overdue`
- `aging_bucket`

**Calculation Notes:**
Break down by aging bucket: 30-60, 60-90, 90+ days.
High ratio indicates credit policy or collection issues.


---

### Cash Flow Adequacy Ratio

**ID:** `cash_flow_adequacy_ratio` | **Priority:** 🟡 medium | **Validation:** ❌ cannot_calculate

**Description:** Operating cash flow divided by average annual debt repayment

**Formula:**
```
Operating Cash Flow / (Debt Principal Payments + Dividends + Capital Expenditures)
```

**Target:** >= 1.0

**Unit:** ratio

**Required Schemas:**
- `cash-flow.yaml`
- `financial-statement.yaml`

**Required Entities:**
- CashFlow
- FinancialStatement

**Required Fields:**
- `operating_cash_flow`
- `cash_outflows_debt`
- `cash_outflows_capex`

**Calculation Notes:**
> 1.0: Company generates enough cash to meet obligations
< 1.0: May need external financing


---

## Labor_hr

**Category:** Labor Efficiency & Human Resources

### Labor Efficiency Rate

**ID:** `labor_efficiency_rate` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Actual labor hours vs. standard labor hours

**Formula:**
```
(Standard Hours / Actual Hours) × 100
```

**Target:** >= 95%

**Unit:** percentage

**Required Schemas:**
- `labor-tracking.yaml`
- `production-run.yaml`

**Required Entities:**
- LaborTracking
- ProductionRun

**Required Fields:**
- `hours_worked`
- `job_id`
- `production_run_id`
- `quantity_produced`

**Calculation Notes:**
> 100%: Working faster than standard
< 90%: Efficiency issues need investigation


---

### Labor Productivity

**ID:** `labor_productivity` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Output per labor hour

**Formula:**
```
Total Units Produced / Total Labor Hours
```

**Target:** Trend upward

**Unit:** units_per_hour

**Required Schemas:**
- `labor-tracking.yaml`

**Required Entities:**
- LaborTracking

**Required Fields:**
- `quantity_produced`
- `hours_worked`
- `productivity_rate`

**Calculation Notes:**
Track by department, shift, employee for targeted training.


---

### Total Headcount

**ID:** `total_headcount` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Total number of active employees

**Formula:**
```
COUNT(employees WHERE status = 'active')
```

**Target:** Aligned with revenue growth

**Unit:** count

**Required Schemas:**
- `employee.yaml`

**Required Entities:**
- Employee

**Required Fields:**
- `employment_status`
- `employee_number`

**Calculation Notes:**
Track by department, full-time vs part-time


---

### Employee Turnover Rate

**ID:** `employee_turnover_rate` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Percentage of workforce that leaves annually

**Formula:**
```
(Number of Separations / Average Headcount) × 100
```

**Target:** <= 15%

**Unit:** percentage_annual

**Required Schemas:**
- `employee.yaml`

**Required Entities:**
- Employee

**Required Fields:**
- `termination_date`
- `termination_reason`
- `hire_date`
- `employment_status`

**Calculation Notes:**
Voluntary vs involuntary turnover
High turnover costly: recruiting, training, lost productivity


---

### Direct Labor Percentage

**ID:** `direct_labor_percentage` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Direct labor hours as percentage of total labor hours

**Formula:**
```
(Direct Labor Hours / Total Labor Hours) × 100
```

**Target:** >= 60%

**Unit:** percentage

**Required Schemas:**
- `labor-tracking.yaml`

**Required Entities:**
- LaborTracking

**Required Fields:**
- `is_direct_labor`
- `hours_worked`
- `activity_type`

**Calculation Notes:**
Direct labor = hands-on production
Low percentage indicates excessive overhead or downtime


---

### Overtime Hours Percentage

**ID:** `overtime_hours_percentage` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Overtime hours as percentage of total hours

**Formula:**
```
(Overtime Hours / Total Hours) × 100
```

**Target:** <= 10%

**Unit:** percentage

**Required Schemas:**
- `labor-tracking.yaml`

**Required Entities:**
- LaborTracking

**Required Fields:**
- `is_overtime`
- `hours_worked`

**Calculation Notes:**
Excessive overtime indicates understaffing or poor scheduling
High overtime costs (1.5x-2x) hurt profitability


---

### Labor Cost per Unit

**ID:** `labor_cost_per_unit` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Total labor cost divided by units produced

**Formula:**
```
Total Labor Cost / Total Units Produced
```

**Target:** Meet or beat standard cost

**Unit:** currency_per_unit

**Required Schemas:**
- `labor-tracking.yaml`
- `production-run.yaml`

**Required Entities:**
- LaborTracking
- ProductionRun

**Required Fields:**
- `total_cost`
- `quantity_produced`
- `hourly_rate`

**Calculation Notes:**
Key component of COGS
Track trends and variance from standard


---

### Full-Time Equivalent (FTE) Count

**ID:** `fte_count` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Total FTE adjusted for part-time workers

**Formula:**
```
SUM(fte_percentage) WHERE status = 'active'
```

**Target:** Aligned with workload

**Unit:** fte

**Required Schemas:**
- `employee.yaml`

**Required Entities:**
- Employee

**Required Fields:**
- `fte_percentage`
- `employment_status`
- `employment_type`

**Calculation Notes:**
Part-time employee at 50% = 0.5 FTE
Use for capacity planning and productivity calculations


---

### Absenteeism Rate

**ID:** `absenteeism_rate` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Percentage of scheduled work time lost to absences

**Formula:**
```
(Total Absent Hours / Total Scheduled Hours) × 100
```

**Target:** <= 3%

**Unit:** percentage

**Required Schemas:**
- `labor-tracking.yaml`
- `employee.yaml`

**Required Entities:**
- LaborTracking
- Employee

**Required Fields:**
- `hours_worked`
- `activity_type`
- `pto_balance_hours`
- `sick_leave_hours`

**Calculation Notes:**
Excludes approved PTO
High rate may indicate morale or safety issues


---

### Revenue per Employee

**ID:** `revenue_per_employee` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Total revenue divided by employee count

**Formula:**
```
Total Revenue / Total Headcount
```

**Target:** >= $150,000

**Unit:** currency

**Required Schemas:**
- `financial-statement.yaml`
- `employee.yaml`

**Required Entities:**
- FinancialStatement
- Employee

**Required Fields:**
- `total_revenue`
- `employment_status`

**Calculation Notes:**
Productivity benchmark
Compare to industry standards
Use FTE count for accuracy


---

### Average Employee Tenure

**ID:** `average_tenure` | **Priority:** 🟡 medium | **Validation:** ❌ cannot_calculate

**Description:** Average length of employment

**Formula:**
```
AVG(CURRENT_DATE - hire_date) WHERE status = 'active'
```

**Target:** >= 5 years

**Unit:** years

**Required Schemas:**
- `employee.yaml`

**Required Entities:**
- Employee

**Required Fields:**
- `hire_date`
- `employment_status`

**Calculation Notes:**
Longer tenure indicates employee satisfaction and institutional knowledge


---

### Labor Capacity Hours

**ID:** `labor_capacity_hours` | **Priority:** 🟡 medium | **Validation:** ❌ cannot_calculate

**Description:** Total available labor hours based on headcount

**Formula:**
```
Total FTE × Standard Hours per Week × 52 weeks × Availability Factor
```

**Target:** Sufficient for demand

**Unit:** hours_per_year

**Required Schemas:**
- `employee.yaml`

**Required Entities:**
- Employee

**Required Fields:**
- `fte_percentage`
- `employment_status`
- `department`

**Calculation Notes:**
Availability factor typically 0.85 (accounting for PTO, training, meetings)
Use for capacity planning and hiring decisions


---

## Production Efficiency

**Category:** Production Efficiency & Quality

### Overall Equipment Effectiveness (OEE)

**ID:** `oee` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Composite metric of availability × performance × quality

**Formula:**
```
(Actual Production Time / Planned Production Time) × (Actual Output / Theoretical Max Output) × (Good Units / Total Units)
```

**Target:** >= 85%

**Unit:** percentage

**Required Schemas:**
- `production-run.yaml`

**Required Entities:**
- ProductionRun

**Required Fields:**
- `actual_start_time`
- `actual_end_time`
- `planned_start_time`
- `planned_end_time`
- `quantity_produced`
- `quantity_good`
- `speed_theoretical`
- `speed_actual`

**Calculation Notes:**
Availability = (Actual Production Time - Downtime) / Planned Production Time
Performance = (Actual Output Rate / Theoretical Max Rate)
Quality = (Good Units / Total Units Produced)
OEE = Availability × Performance × Quality


---

### First Pass Yield (FPY)

**ID:** `first_pass_yield` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Percentage of units produced correctly without rework

**Formula:**
```
(Good Units First Time / Total Units Started) × 100
```

**Target:** >= 95%

**Unit:** percentage

**Required Schemas:**
- `production-run.yaml`
- `quality-defect.yaml`

**Required Entities:**
- ProductionRun
- QualityDefect

**Required Fields:**
- `quantity_produced`
- `quantity_good`
- `quantity_rework`

**Calculation Notes:**
FPY considers only units that passed inspection first time.
Excludes reworked units even if they eventually passed.


---

### Setup Time / Makeready Time

**ID:** `setup_time` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Average time to prepare equipment for production run

**Formula:**
```
AVG(actual_start_time - scheduled_start_time)
```

**Target:** <= 30 minutes

**Unit:** minutes

**Required Schemas:**
- `production-run.yaml`

**Required Entities:**
- ProductionRun

**Required Fields:**
- `scheduled_start_time`
- `actual_start_time`
- `setup_category`

**Calculation Notes:**
Setup includes: plate/blanket changes, ink mixing, registration adjustments.
Track by setup category for targeted improvement.


---

### Material Utilization Percentage

**ID:** `material_utilization_percentage` | **Priority:** 🔴 critical | **Validation:** ✅ can_calculate

**Description:** Percentage of raw material converted to good output (packaging industry standard)

**Formula:**
```
(Total Area/Weight of Good Output / Total Area/Weight of Raw Material Input) × 100
```

**Target:** >= 85%

**Unit:** percentage

**Required Schemas:**
- `material-consumption.yaml`
- `production-run.yaml`
- `job.yaml`

**Required Entities:**
- MaterialConsumption
- ProductionRun
- Job

**Required Fields:**
- `quantity_consumed`
- `quantity_waste`
- `quantity_good`
- `unit_of_measure`

**Calculation Notes:**
Packaging industry standard metric (universal across corrugated, labels, flexible packaging).
Must be tracked by Job and Shift for accurate cost analysis.
Formula accounts for area (sq ft, sq m) or weight (kg, lbs) depending on material type.

Calculation by material type:
- Sheet/Roll stock: (Good sheets × sheet size) / (Total sheets consumed × sheet size)
- Weight-based: (Good output weight) / (Total material weight consumed)

Low utilization indicates:
- Excessive trim waste (die-cutting, guillotine trimming)
- High makeready waste (setup scrap to achieve quality)
- Process issues (web breaks, registration problems)
- Poor nesting/layout optimization


---

### Cycle Time

**ID:** `cycle_time` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Total time from job start to completion

**Formula:**
```
actual_end_time - actual_start_time
```

**Target:** Meet estimated time

**Unit:** hours

**Required Schemas:**
- `production-run.yaml`

**Required Entities:**
- ProductionRun

**Required Fields:**
- `actual_start_time`
- `actual_end_time`

**Calculation Notes:**
Includes all time: setup, production, quality checks, cleanup.


---

### Takt Time

**ID:** `takt_time` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Available production time divided by customer demand

**Formula:**
```
Available Production Time / Required Units
```

**Target:** < Cycle Time

**Unit:** seconds_per_unit

**Required Schemas:**
- `production-run.yaml`
- `job.yaml`

**Required Entities:**
- ProductionRun
- Job

**Required Fields:**
- `quantity_required`
- `available_production_hours`

**Calculation Notes:**
Determines production pace needed to meet demand.
If cycle time > takt time, cannot meet demand without overtime.


---

### Capacity Utilization Rate

**ID:** `capacity_utilization` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Actual production as percentage of maximum capacity

**Formula:**
```
(Actual Production Hours / Available Capacity Hours) × 100
```

**Target:** 75-85% (sweet spot)

**Unit:** percentage

**Required Schemas:**
- `production-run.yaml`
- `equipment-status-log.yaml`

**Required Entities:**
- ProductionRun
- EquipmentStatusLog

**Required Fields:**
- `actual_production_time`
- `available_capacity_hours`
- `equipment_id`

**Calculation Notes:**
Too high (>90%) risks quality issues and burnout.
Too low (<60%) indicates inefficiency or insufficient orders.


---

### Speed Variance

**ID:** `speed_variance` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Difference between actual and theoretical production speed

**Formula:**
```
((speed_actual - speed_theoretical) / speed_theoretical) × 100
```

**Target:** >= -5% (within 5% of theoretical)

**Unit:** percentage

**Required Schemas:**
- `production-run.yaml`

**Required Entities:**
- ProductionRun

**Required Fields:**
- `speed_actual`
- `speed_theoretical`

**Calculation Notes:**
Negative variance indicates slower than expected.
Investigate causes: operator skill, material issues, equipment condition.


---

### Scrap Rate

**ID:** `scrap_rate` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Percentage of production that must be discarded

**Formula:**
```
(Quantity Scrapped / Total Quantity Produced) × 100
```

**Target:** <= 3%

**Unit:** percentage

**Required Schemas:**
- `production-run.yaml`
- `quality-defect.yaml`

**Required Entities:**
- ProductionRun
- QualityDefect

**Required Fields:**
- `quantity_scrapped`
- `quantity_produced`
- `defect_type`
- `resolution_action`

**Calculation Notes:**
Track by defect type to identify root causes.
High scrap rates increase COGS significantly.


---

### Rework Rate

**ID:** `rework_rate` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Percentage of production requiring rework

**Formula:**
```
(Quantity Reworked / Total Quantity Produced) × 100
```

**Target:** <= 5%

**Unit:** percentage

**Required Schemas:**
- `production-run.yaml`
- `quality-defect.yaml`

**Required Entities:**
- ProductionRun
- QualityDefect

**Required Fields:**
- `quantity_rework`
- `quantity_produced`
- `rework_time_minutes`
- `resolution_action`

**Calculation Notes:**
Rework adds significant cost: material, labor, schedule delays.
Track rework time to calculate true cost impact.


---

### Defect Rate

**ID:** `defect_rate` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Number of defects per production run or per thousand units

**Formula:**
```
(Total Defects / Total Units Produced) × 1000
```

**Target:** <= 10 defects per 1000 units

**Unit:** defects_per_thousand

**Required Schemas:**
- `quality-defect.yaml`
- `production-run.yaml`

**Required Entities:**
- QualityDefect
- ProductionRun

**Required Fields:**
- `quantity_affected`
- `quantity_produced`
- `defect_type`
- `severity`

**Calculation Notes:**
Track by defect type and severity for root cause analysis.


---

### Material Yield Rate

**ID:** `material_yield_rate` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Percentage of material that becomes sellable product

**Formula:**
```
(Good Output Weight/Quantity / Total Material Input) × 100
```

**Target:** >= 90%

**Unit:** percentage

**Required Schemas:**
- `material-consumption.yaml`
- `production-run.yaml`

**Required Entities:**
- MaterialConsumption
- ProductionRun

**Required Fields:**
- `quantity_consumed`
- `quantity_waste`
- `quantity_produced`
- `quantity_good`

**Calculation Notes:**
Low yield indicates excessive waste, setup scrap, or quality issues.
Critical for high-value materials (specialty papers, metallic inks).


---

### Trim Waste Percentage

**ID:** `trim_waste_percentage` | **Priority:** 🟠 high | **Validation:** ✅ can_calculate

**Description:** Percentage of material wasted due to trimming operations

**Formula:**
```
(Trim Waste Weight/Area / Total Material Input) × 100
```

**Target:** <= 8%

**Unit:** percentage

**Required Schemas:**
- `material-consumption.yaml`
- `production-run.yaml`

**Required Entities:**
- MaterialConsumption
- ProductionRun

**Required Fields:**
- `quantity_waste`
- `waste_reason`
- `quantity_consumed`
- `unit_of_measure`

**Calculation Notes:**
Critical for die-cutting operations in corrugated, labels, and cartons.

Trim waste occurs during:
- Die-cutting (skeleton/matrix waste)
- Guillotine trimming (edge trim)
- Rotary cutting (web edge trim)
- Slitting operations

Calculate as: SUM(quantity_waste WHERE waste_reason = 'trim') / SUM(quantity_consumed)

Optimization strategies:
- Improve die layout/nesting efficiency
- Reduce trim margins where spec allows
- Reuse trim for smaller jobs when possible
- Track by job complexity (complex dies = higher trim %)

Industry benchmarks:
- Simple rectangular cuts: 3-5% trim waste
- Complex die shapes: 8-12% trim waste
- Irregular shapes: 12-15% trim waste


---

### Makeready Waste (Setup Waste)

**ID:** `makeready_waste_quantity` | **Priority:** 🟠 high | **Validation:** ✅ can_calculate

**Description:** Material wasted during setup/changeover to achieve quality standards

**Formula:**
```
SUM(quantity_waste WHERE waste_reason = 'makeready')
```

**Target:** <= 50 kg per setup (varies by equipment)

**Unit:** weight_or_area

**Required Schemas:**
- `material-consumption.yaml`
- `production-run.yaml`
- `equipment-status-log.yaml`

**Required Entities:**
- MaterialConsumption
- ProductionRun
- EquipmentStatusLog

**Required Fields:**
- `quantity_waste`
- `waste_reason`
- `equipment_id`
- `actual_start_time`

**Calculation Notes:**
Makeready waste occurs during setup phase before production quality is achieved.

Includes waste from:
- Color/registration adjustments (print setup)
- Die-cutter alignment (cutting setup)
- Folder/gluer adjustments (finishing setup)
- Tension/tracking adjustments (web-based processes)

Track by:
- Equipment type (press, die-cutter, folder-gluer)
- Job complexity (number of colors, die complexity)
- Operator experience level
- Time since last similar job

Calculate as: SUM(quantity_waste WHERE waste_reason = 'makeready') per setup event
Link to equipment_status_log to correlate with setup duration

Reduction strategies:
- Standard setup procedures (reduce trial-and-error)
- Quick-change tooling (reduce mechanical adjustments)
- Digital presets (automated settings recall)
- Operator training (reduce learning curve)

Industry benchmarks vary widely by equipment:
- Digital press: 10-20 sheets (minimal)
- Offset press: 100-500 sheets (higher)
- Flexo press: 200-1000 linear feet (web breaks during setup)
- Die-cutter: 50-200 sheets (alignment waste)


---

### On-Time Delivery Rate

**ID:** `on_time_delivery` | **Priority:** 🟠 high | **Validation:** ⚠️ partial

**Description:** Percentage of jobs delivered by promised date

**Formula:**
```
(Jobs Delivered On Time / Total Jobs Delivered) × 100
```

**Target:** >= 95%

**Unit:** percentage

**Required Schemas:**
- `job.yaml`
- `production-run.yaml`

**Required Entities:**
- Job
- ProductionRun

**Required Fields:**
- `promised_delivery_date`
- `actual_delivery_date`
- `status`

**Calculation Notes:**
Consider "on time" as within promised date (not early, not late).
Track reasons for late deliveries to improve scheduling.


---

### Schedule Adherence

**ID:** `schedule_adherence` | **Priority:** 🟠 high | **Validation:** ✅ can_calculate

**Description:** Percentage of production runs starting and completing on schedule

**Formula:**
```
(Runs Completed On Schedule / Total Runs Scheduled) × 100
```

**Target:** >= 90%

**Unit:** percentage

**Required Schemas:**
- `production-run.yaml`

**Required Entities:**
- ProductionRun

**Required Fields:**
- `planned_start_time`
- `actual_start_time`
- `planned_end_time`
- `actual_end_time`
- `status`

**Calculation Notes:**
Measures scheduling accuracy and production predictability
Consider on-schedule if start/end within tolerance window (e.g., +/- 30 minutes)
Track reasons for schedule misses: material delays, equipment breakdowns, labor shortages
Critical for multi-stage production where delays cascade


---

### Throughput Rate

**ID:** `throughput` | **Priority:** 🟠 high | **Validation:** ✅ can_calculate

**Description:** Units produced per time period

**Formula:**
```
Total Units Produced / Total Production Time
```

**Target:** Varies by equipment

**Unit:** units_per_hour

**Required Schemas:**
- `production-run.yaml`

**Required Entities:**
- ProductionRun

**Required Fields:**
- `quantity_produced`
- `actual_start_time`
- `actual_end_time`

**Calculation Notes:**
Raw production rate - different from OEE Performance component
Compare to theoretical max speed for performance analysis
Track by equipment, shift, operator for bottleneck identification
Essential for capacity planning and quote turnaround estimation


---

### Manufacturing Cycle Time

**ID:** `manufacturing_cycle_time` | **Priority:** 🟠 high | **Validation:** ✅ can_calculate

**Description:** Average time from job start to job completion (all operations)

**Formula:**
```
AVG(actual_delivery_date - created_at)
```

**Target:** <= 5 days

**Unit:** days

**Required Schemas:**
- `job.yaml`

**Required Entities:**
- Job

**Required Fields:**
- `created_at`
- `actual_delivery_date`
- `status`

**Calculation Notes:**
End-to-end cycle time including all production operations, setup, and queue time
Different from individual operation cycle time
Includes: order entry, prepress, production, finishing, QC, packing
Critical for lead time quoting and capacity planning
Track by job type and complexity for accurate estimation


---

### Press Utilization Rate (Print Industry)

**ID:** `press_utilization` | **Priority:** 🟡 medium | **Validation:** ❌ cannot_calculate

**Description:** Percentage of scheduled time press is actually printing

**Formula:**
```
(Actual Printing Time / Scheduled Production Time) × 100
```

**Target:** >= 70%

**Unit:** percentage

**Required Schemas:**
- `equipment-status-log.yaml`
- `production-run.yaml`

**Required Entities:**
- EquipmentStatusLog
- ProductionRun

**Required Fields:**
- `status`
- `duration_minutes`
- `is_productive_time`
- `equipment_id`

**Calculation Notes:**
Excludes setup, maintenance, idle time.
Print industry specific - high capital equipment cost demands high utilization.


---

### Makeready Time (Print Industry)

**ID:** `makeready_time` | **Priority:** 🟡 medium | **Validation:** ❌ cannot_calculate

**Description:** Time to prepare press for production (plates, inks, registration)

**Formula:**
```
SUM(duration_minutes WHERE status = 'setup')
```

**Target:** <= 30 minutes per job

**Unit:** minutes

**Required Schemas:**
- `production-run.yaml`
- `equipment-status-log.yaml`

**Required Entities:**
- ProductionRun
- EquipmentStatusLog

**Required Fields:**
- `actual_start_time`
- `scheduled_start_time`
- `setup_category`
- `duration_minutes`

**Calculation Notes:**
Critical for short-run profitability.
Track by setup type: plate change, blanket change, ink change, full setup.


---

### Color Accuracy (Delta E) (Print Industry)

**ID:** `color_accuracy` | **Priority:** 🟡 medium | **Validation:** ❌ cannot_calculate

**Description:** Color variation from target measured in Delta E units

**Formula:**
```
SQRT((L2-L1)² + (a2-a1)² + (b2-b1)²)
```

**Target:** <= 2.0 Delta E (excellent match)

**Unit:** delta_e

**Required Schemas:**
- `production-run.yaml`
- `quality-defect.yaml`

**Required Entities:**
- ProductionRun
- QualityDefect

**Required Fields:**
- `color_measurements`
- `target_color_values`
- `defect_type`

**Calculation Notes:**
Delta E < 1.0: Not perceptible by human eye
Delta E 1-2: Perceptible through close observation
Delta E 2-10: Noticeable at a glance
Delta E > 10: Colors perceived as different
Requires spectrophotometer measurements.


---

## Quality Management

**Category:** Quality Control & Customer Satisfaction

### First Pass Yield (FPY)

**ID:** `first_pass_yield` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Percentage of units produced correctly without rework

**Formula:**
```
(Good Units First Time / Total Units Started) × 100
```

**Target:** >= 95%

**Unit:** percentage

**Required Schemas:**
- `production-run.yaml`
- `quality-defect.yaml`

**Required Entities:**
- ProductionRun
- QualityDefect

**Required Fields:**
- `quantity_produced`
- `quantity_good`
- `quantity_rework`

**Calculation Notes:**
Gold standard quality metric
Excludes reworked units even if eventually acceptable


---

### First-Pass Print Approval Rate

**ID:** `first_pass_print_approval_rate` | **Priority:** 🔴 critical | **Validation:** ✅ can_calculate

**Description:** Percentage of print jobs approved by customer on first proof/sample

**Formula:**
```
(Jobs Approved First Proof / Total Jobs Submitted for Approval) × 100
```

**Target:** >= 90%

**Unit:** percentage

**Required Schemas:**
- `job.yaml`
- `quality-inspection.yaml`

**Required Entities:**
- Job
- QualityInspection

**Required Fields:**
- `inspection_type`
- `overall_result`
- `disposition`
- `job_id`

**Calculation Notes:**
Critical for commercial print, labels, and flexible packaging where brand appearance is paramount.

Distinct from manufacturing First Pass Yield:
- FPY = units produced correctly (internal quality)
- First-Pass Print Approval = customer accepts appearance (external quality)

Track approvals for:
- First article inspection (FAI) - initial setup sample
- Color match approval - customer sign-off on color
- Final proof approval - complete job appearance

Calculate as: COUNT(inspections WHERE inspection_type = 'first_article' 
               AND overall_result = 'pass' AND no prior rejections)
               / COUNT(all first_article inspections)

Rejection reasons to track:
- Color mismatch (Delta E out of tolerance)
- Registration issues (misalignment)
- Print defects (spots, streaks, voids)
- Substrate issues (wrinkles, dirt)
- Finishing problems (die-cut accuracy, fold quality)

Impact of low approval rate:
- Delays (reproof cycle adds 1-3 days)
- Material waste (rejected proofs)
- Labor cost (setup rework)
- Customer satisfaction issues
- Risk of losing repeat business

Improvement strategies:
- Digital color proofing (reduce surprise on press)
- G7 color calibration (predictable color reproduction)
- Standard operating procedures for setup
- Better customer communication during pre-press


---

### Defect Rate

**ID:** `defect_rate` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Defects per thousand units produced

**Formula:**
```
(Total Defects / Total Units) × 1000
```

**Target:** <= 10 DPM

**Unit:** defects_per_thousand

**Required Schemas:**
- `quality-defect.yaml`
- `production-run.yaml`

**Required Entities:**
- QualityDefect
- ProductionRun

**Required Fields:**
- `quantity_affected`
- `quantity_produced`
- `defect_type`
- `severity`

**Calculation Notes:**
Track by defect type and severity
Six Sigma target: 3.4 DPM


---

### Customer Rejection Rate

**ID:** `customer_rejection_rate` | **Priority:** 🔴 critical | **Validation:** ❌ cannot_calculate

**Description:** Percentage of deliveries rejected by customers

**Formula:**
```
(Rejected Deliveries / Total Deliveries) × 100
```

**Target:** <= 1%

**Unit:** percentage

**Required Schemas:**
- `customer-rejection.yaml`

**Required Entities:**
- CustomerRejection

**Required Fields:**
- `job_id`
- `rejection_type`
- `severity`
- `quantity_rejected`
- `quantity_total`

**Calculation Notes:**
Most serious quality metric - external customer impact
Track by reason and severity


---

### Customer PPM (Parts Per Million Defective)

**ID:** `customer_ppm` | **Priority:** 🔴 critical | **Validation:** ✅ can_calculate

**Description:** Defects reported by customers per million units shipped

**Formula:**
```
(Customer Rejected Units / Total Units Shipped) × 1,000,000
```

**Target:** <= 100 PPM

**Unit:** parts_per_million

**Required Schemas:**
- `customer-rejection.yaml`
- `job.yaml`

**Required Entities:**
- CustomerRejection
- Job

**Required Fields:**
- `quantity_rejected`
- `quantity_total`
- `rejection_type`
- `severity`

**Calculation Notes:**
Customer-facing quality metric - measures escaped defects
More stringent than internal defect rate
Industry benchmarks: World-class < 10 PPM, Good < 100 PPM, Acceptable < 500 PPM
Track by customer, product type, and defect category
High PPM indicates inspection process gaps
Essential for automotive, medical, and aerospace customers who require PPM reporting


---

### Registration Accuracy

**ID:** `registration_accuracy` | **Priority:** 🟠 high | **Validation:** ✅ can_calculate

**Description:** Deviation from perfect alignment between colors/printing units (measured in microns)

**Formula:**
```
AVG(ABS(measured_deviation_from_target))
```

**Target:** <= 100 microns

**Unit:** microns

**Required Schemas:**
- `quality-inspection.yaml`
- `production-run.yaml`

**Required Entities:**
- QualityInspection
- QualityTestResult
- ProductionRun

**Required Fields:**
- `characteristic`
- `measured_value`
- `target_value`
- `unit_of_measure`

**Calculation Notes:**
Registration accuracy is critical for multi-color printing (offset, flexo, gravure).

What is registration:
- Alignment of multiple printing units/colors
- Measured as deviation from perfect overlay
- Typically measured in microns (μm) or thousandths of an inch

Measurement points:
- Front-to-back registration (sheet flip accuracy)
- Color-to-color registration (cyan, magenta, yellow, black alignment)
- Die-to-print registration (cutting accuracy to printed image)

Calculate from quality_test_results WHERE characteristic LIKE '%registration%'
Average absolute deviation across all measurement points per job/shift.

Tolerances by application:
- Fine line work, small text: ±50 microns (0.002 inches)
- Standard 4-color process: ±100 microns (0.004 inches)
- Coarse work, single color: ±200 microns (0.008 inches)

Causes of poor registration:
- Paper/substrate dimensional instability (moisture, tension)
- Mechanical wear (gripper bars, impression cylinders)
- Speed variations (web tension fluctuations)
- Temperature/humidity changes

Track by:
- Equipment (identify problem machines)
- Substrate type (some materials more stable)
- Environmental conditions (temp/humidity)
- Operator (training indicator)

Industry benchmarks:
- High-end commercial print: 25-50 microns
- Standard offset/flexo: 75-125 microns
- Corrugated post-print: 150-250 microns (less critical)


---

### Scrap Rate

**ID:** `scrap_rate` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Percentage of production scrapped

**Formula:**
```
(Quantity Scrapped / Total Produced) × 100
```

**Target:** <= 3%

**Unit:** percentage

**Required Schemas:**
- `production-run.yaml`
- `quality-defect.yaml`

**Required Entities:**
- ProductionRun
- QualityDefect

**Required Fields:**
- `quantity_scrapped`
- `quantity_produced`
- `resolution_action`

**Calculation Notes:**
Direct cost impact - material + labor wasted
Track by root cause


---

### Rework Rate

**ID:** `rework_rate` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Percentage of production requiring rework

**Formula:**
```
(Quantity Reworked / Total Produced) × 100
```

**Target:** <= 5%

**Unit:** percentage

**Required Schemas:**
- `production-run.yaml`
- `quality-defect.yaml`

**Required Entities:**
- ProductionRun
- QualityDefect

**Required Fields:**
- `quantity_rework`
- `quantity_produced`
- `rework_time_minutes`
- `rework_cost`

**Calculation Notes:**
Rework adds cost: additional labor + delays
Track rework time to calculate true cost


---

### Customer Satisfaction Score (CSAT)

**ID:** `customer_satisfaction_score` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Average customer satisfaction rating

**Formula:**
```
SUM(satisfaction_ratings) / COUNT(surveys)
```

**Target:** >= 4.5 / 5.0

**Unit:** score_1_to_5

**Required Schemas:**
- `customer-rejection.yaml`

**Required Entities:**
- CustomerRejection

**Required Fields:**
- `customer_satisfied`
- `resolution_type`

**Calculation Notes:**
Survey after issue resolution
Track trends over time


---

### Net Promoter Score (NPS)

**ID:** `net_promoter_score` | **Priority:** 🟠 high | **Validation:** ❌ cannot_calculate

**Description:** Likelihood customers will recommend company

**Formula:**
```
% Promoters (9-10) - % Detractors (0-6)
```

**Target:** >= 50

**Unit:** score

**Required Schemas:**
- `customer-rejection.yaml`

**Required Entities:**
- CustomerRejection

**Required Fields:**
- `nps_score`
- `customer_satisfied`

**Calculation Notes:**
Scale: 0-10
Promoters: 9-10
Passives: 7-8 (not counted)
Detractors: 0-6
NPS = % Promoters - % Detractors


---

### Cost of Quality (COQ)

**ID:** `cost_of_quality` | **Priority:** 🟠 high | **Validation:** ✅ can_calculate

**Description:** Total cost of quality failures (scrap, rework, returns, prevention, appraisal)

**Formula:**
```
Prevention Costs + Appraisal Costs + Internal Failure Costs + External Failure Costs
```

**Target:** < 2% of revenue

**Unit:** currency

**Required Schemas:**
- `quality-defect.yaml`
- `production-run.yaml`
- `job-cost.yaml`
- `customer-rejection.yaml`
- `maintenance-record.yaml`

**Required Entities:**
- QualityDefect
- ProductionRun
- JobCost
- CustomerRejection
- MaintenanceRecord

**Required Fields:**
- `quantity_affected`
- `defect_type`
- `severity`
- `material_cost`
- `labor_cost`
- `total_cost`
- `maintenance_cost`
- `rework_cost`
- `resolution_cost`
- `credit_amount`

**Calculation Notes:**
Four COQ categories (Crosby/Juran model):

1. Prevention Costs: Training, process improvement, quality planning
   - Quality training programs
   - Process documentation and standards development
   - Preventive maintenance (from maintenance-record where type='preventive')

2. Appraisal Costs: Inspection, testing, audits
   - In-process inspection labor
   - Final inspection and testing
   - Quality audits and calibration

3. Internal Failure Costs: Defects caught before delivery
   - Scrap material cost (from quality-defect + material cost)
   - Rework labor cost (from production-run rework time)
   - Downtime due to quality issues

4. External Failure Costs: Defects caught by customer
   - Customer returns (from customer-rejection)
   - Warranty claims and replacements
   - Complaint handling and customer service costs

Calculate as percentage of revenue for benchmarking
Typical target: Prevention 5-10%, Appraisal 20-25%, Failures 65-70%
Goal: Shift spending from failures to prevention over time


---

