# DIMENSIONAL MODEL - BUS MATRIX

**Purpose**: Define the enterprise dimensional model that drives OLTP design
**Methodology**: Kimball Bus Matrix
**Philosophy**: OLAP requirements drive OLTP schema design

---

## EXECUTIVE SUMMARY

**Critical Issue Identified**: Current OLTP schema was built without dimensional model guidance.

**Required Work**:
1. ✅ Document Bus Matrix (this file)
2. ⚠️ Audit OLTP column names for semantic consistency
3. ⚠️ Build Star Schema dimensional model (OLAP)
4. ⚠️ Align OLTP to support OLAP requirements
5. ⚠️ Create ETL processes (OLTP → OLAP)

---

## BUS MATRIX

### Legend
- ✓ = Dimension used by this fact
- F = Fact grain definition

| Business Process (Fact Table) | Date | Time of Day | Customer | Product | Material | Facility | Work Center | Employee | Vendor | Carrier | Sales Rep | Security Zone | Partner Company | Promotion | Payment Terms |
|-------------------------------|------|-------------|----------|---------|----------|----------|-------------|----------|--------|---------|-----------|---------------|-----------------|-----------|---------------|
| **SALES FACTS** |
| Sales Orders | ✓ | | ✓ | ✓ | | ✓ | | | | | ✓ | | | | ✓ |
| Quotes | ✓ | | ✓ | ✓ | | ✓ | | | | | ✓ | | | | |
| Invoices | ✓ | | ✓ | ✓ | | ✓ | | | | | | | | | ✓ |
| Customer Rejections | ✓ | | ✓ | ✓ | | ✓ | | | | | | | | | |
| **MANUFACTURING FACTS** |
| Production Runs | ✓ | ✓ | | ✓ | | ✓ | ✓ | ✓ | | | | | | | |
| OEE Metrics | ✓ | | | | | ✓ | ✓ | | | | | | | | |
| Quality Inspections | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | | | |
| Defects | ✓ | | | ✓ | | ✓ | ✓ | ✓ | | | | | | | |
| Labor Tracking | ✓ | ✓ | | ✓ | | ✓ | ✓ | ✓ | | | | | | | |
| **PROCUREMENT FACTS** |
| Purchase Orders | ✓ | | | | ✓ | ✓ | | | ✓ | | | | | | ✓ |
| Receipts | ✓ | ✓ | | | ✓ | ✓ | | ✓ | ✓ | | | | | | |
| Vendor Performance | ✓ | | | | | | | | ✓ | | | | | | |
| **INVENTORY FACTS** |
| Inventory Transactions | ✓ | ✓ | | ✓ | ✓ | ✓ | | ✓ | | | | ✓ | | | |
| Inventory Snapshots | ✓ | | | ✓ | ✓ | ✓ | | | | | | ✓ | | | |
| Lot Traceability | ✓ | | ✓ | ✓ | ✓ | ✓ | | | ✓ | | | | | | |
| **WAREHOUSE FACTS** |
| Wave Processing | ✓ | ✓ | ✓ | ✓ | | ✓ | | ✓ | | | | | | | |
| Shipments | ✓ | ✓ | ✓ | ✓ | | ✓ | | ✓ | | ✓ | | | | | |
| Cycle Counts | ✓ | ✓ | | ✓ | ✓ | ✓ | | ✓ | | | | ✓ | | | |
| **FINANCIAL FACTS** |
| GL Transactions | ✓ | | ✓ | ✓ | | ✓ | | | ✓ | | | | | | |
| AR Aging | ✓ | | ✓ | | | | | | | | | | | | ✓ |
| AP Aging | ✓ | | | | | | | | ✓ | | | | | | ✓ |
| Cost Allocations | ✓ | | | ✓ | | ✓ | ✓ | | | | | | | | |
| **MARKETPLACE FACTS** |
| Job Postings | ✓ | | | ✓ | | | | | | | | | ✓ | | |
| Bids | ✓ | ✓ | | ✓ | | | | | | | | | ✓ | | |
| External Orders | ✓ | | | ✓ | | | | | | | | | ✓ | | |
| **IOT FACTS** |
| Sensor Readings | ✓ | ✓ | | ✓ | | ✓ | ✓ | | | | | | | | |
| Equipment Events | ✓ | ✓ | | | | ✓ | ✓ | | | | | | | | |
| **SECURITY FACTS** |
| Access Log | ✓ | ✓ | | | | ✓ | | ✓ | | | | ✓ | | | |
| Chain of Custody | ✓ | ✓ | ✓ | ✓ | | ✓ | | ✓ | | | | ✓ | | | |
| **HR FACTS** |
| Timecards | ✓ | ✓ | | | | ✓ | ✓ | ✓ | | | | | | | |
| Labor Costs | ✓ | | | ✓ | | ✓ | ✓ | ✓ | | | | | | | |

---

## CONFORMED DIMENSIONS

### Dimension: Date
**Grain**: One row per day
**Type**: Type 0 (no changes)
**Attributes**:
- date_key (YYYYMMDD surrogate)
- date_actual (DATE)
- day_of_week
- day_of_month
- day_of_year
- week_of_year
- month_number
- month_name
- quarter_number
- year_number
- fiscal_period
- is_weekend
- is_holiday
- holiday_name

**OLTP Column Standard**: `<event>_date`
- `order_date` = date sales order was placed
- `invoice_date` = date invoice was generated
- `shipment_date` = date shipment occurred
- `production_date` = date production run occurred
- `inspection_date` = date quality inspection performed

**Business Rule**: All `_date` columns refer to calendar date (YYYY-MM-DD), not datetime.

---

### Dimension: Time of Day
**Grain**: One row per minute (or second for high-frequency events)
**Type**: Type 0 (no changes)
**Attributes**:
- time_key (HHMMSS surrogate)
- time_actual (TIME)
- hour_24
- hour_12
- minute
- second
- am_pm
- shift (1st, 2nd, 3rd)
- business_hours (Y/N)

**OLTP Column Standard**: `<event>_time` or `<event>_timestamp`
- `clock_in_time` = time employee clocked in
- `event_timestamp` = precise moment of equipment event
- `reading_timestamp` = precise moment of sensor reading

**Business Rule**: Use `_timestamp` (TIMESTAMPTZ) for precision events, `_time` (TIME) for time-of-day only.

---

### Dimension: Customer
**Grain**: One row per customer per change (SCD Type 2)
**Type**: Type 2 (track changes)
**Attributes**:
- customer_key (surrogate)
- customer_code (natural key)
- customer_name
- legal_name
- customer_type
- credit_limit
- payment_terms
- sales_rep_key (FK to Employee)
- pricing_tier
- effective_from_date
- effective_to_date
- is_current

**OLTP Column Standard**: `customer_id`
- Always references `customers.id`
- Meaning: The customer who is buying/receiving goods or services

**Business Rule**: Customer dimension tracks who BUYS. For 3PL, use separate `customer_id` (owner) vs `ship_to_customer_id` (recipient).

---

### Dimension: Product
**Grain**: One row per product per change (SCD Type 2)
**Type**: Type 2 (track changes)
**Attributes**:
- product_key (surrogate)
- product_code (natural key)
- product_name
- product_category
- packaging_type
- design_width_inches
- design_height_inches
- standard_cost
- list_price
- effective_from_date
- effective_to_date
- is_current

**OLTP Column Standard**: `product_id`
- Always references `products.id`
- Meaning: The finished good being sold/manufactured

**Business Rule**: Product = sellable finished good. Use `material_id` for raw materials/substrates.

---

### Dimension: Material
**Grain**: One row per material per change (SCD Type 2)
**Type**: Type 2 (track changes)
**Attributes**:
- material_key (surrogate)
- material_code (natural key)
- material_name
- material_type (RAW_MATERIAL, SUBSTRATE, INK, etc.)
- material_category
- primary_uom
- standard_cost
- effective_from_date
- effective_to_date
- is_current

**OLTP Column Standard**: `material_id`
- Always references `materials.id`
- Meaning: Raw material, substrate, ink, or component

**Business Rule**: Material = inputs to manufacturing. Products can also be materials (type=FINISHED_GOOD).

---

### Dimension: Facility
**Grain**: One row per facility per change (SCD Type 2)
**Type**: Type 2 (track changes)
**Attributes**:
- facility_key (surrogate)
- facility_code (natural key)
- facility_name
- facility_type (FACTORY, WAREHOUSE, OFFICE)
- city
- state
- country
- timezone
- is_edge_site
- effective_from_date
- effective_to_date
- is_current

**OLTP Column Standard**: `facility_id`
- Always references `facilities.id`
- Meaning: The physical location where event occurred

**Business Rule**: Use `ship_to_facility_id` vs `bill_to_facility_id` when different.

---

### Dimension: Work Center
**Grain**: One row per work center per change (SCD Type 2)
**Type**: Type 2 (track changes)
**Attributes**:
- work_center_key (surrogate)
- work_center_code (natural key)
- work_center_name
- work_center_type (OFFSET_PRESS, DIGITAL_PRESS, etc.)
- facility_key (FK)
- max_sheet_width
- max_sheet_height
- max_colors
- production_rate_per_hour
- effective_from_date
- effective_to_date
- is_current

**OLTP Column Standard**: `work_center_id`
- Always references `work_centers.id`
- Meaning: The machine/station where production occurred

---

### Dimension: Employee
**Grain**: One row per employee per change (SCD Type 2)
**Type**: Type 2 (track changes)
**Attributes**:
- employee_key (surrogate)
- employee_number (natural key)
- first_name
- last_name
- full_name
- job_title
- department
- facility_key (FK)
- supervisor_employee_key (FK)
- hire_date
- termination_date
- effective_from_date
- effective_to_date
- is_current

**OLTP Column Standard**: `employee_id` or `<role>_user_id`
- `employee_id` references `employees.id`
- `inspector_user_id` references `users.id` (specific role)
- `created_by` references `users.id` (audit)

**Business Rule**: Use role-specific columns (`inspector_user_id`, `buyer_user_id`) for business meaning. Use `created_by` for audit trails.

---

### Dimension: Vendor
**Grain**: One row per vendor per change (SCD Type 2)
**Type**: Type 2 (track changes)
**Attributes**:
- vendor_key (surrogate)
- vendor_code (natural key)
- vendor_name
- legal_name
- vendor_type
- payment_terms
- on_time_delivery_pct
- quality_rating_pct
- overall_rating
- effective_from_date
- effective_to_date
- is_current

**OLTP Column Standard**: `vendor_id`
- Always references `vendors.id`
- Meaning: The supplier from whom we purchase

---

### Dimension: Carrier
**Grain**: One row per carrier per change (SCD Type 2)
**Type**: Type 2 (track changes)
**Attributes**:
- carrier_key (surrogate)
- carrier_code (natural key)
- carrier_name
- carrier_type
- scac_code
- effective_from_date
- effective_to_date
- is_current

**OLTP Column Standard**: `carrier_id`
- References `carrier_integrations.id`
- Meaning: The freight carrier transporting shipment

---

### Dimension: Security Zone
**Grain**: One row per security zone per change (SCD Type 2)
**Type**: Type 2 (track changes)
**Attributes**:
- security_zone_key (surrogate)
- zone_code (natural key)
- zone_name
- zone_level (STANDARD, RESTRICTED, SECURE, HIGH_SECURITY, VAULT)
- facility_key (FK)
- requires_badge
- requires_biometric
- requires_dual_control
- effective_from_date
- effective_to_date
- is_current

**OLTP Column Standard**: `security_zone_id`
- References `security_zones.id`
- Meaning: The secure area being accessed

---

### Dimension: Partner Company
**Grain**: One row per partner company per change (SCD Type 2)
**Type**: Type 2 (track changes)
**Attributes**:
- partner_company_key (surrogate)
- company_code (natural key)
- company_name
- company_type
- reliability_score
- on_time_delivery_pct
- quality_rating_pct
- total_jobs_completed
- effective_from_date
- effective_to_date
- is_current

**OLTP Column Standard**: `<role>_company_id`
- `posting_company_id` = company posting excess demand
- `bidding_company_id` = company bidding on job
- `originating_company_id` = company outsourcing work
- `fulfilling_company_id` = company fulfilling order

**Business Rule**: Use role-specific naming to distinguish marketplace participants.

---

## FACT TABLE GRAIN DEFINITIONS

### Fact: Sales Orders
**Grain**: One row per sales order line
**Type**: Transaction fact
**Fact Columns**:
- `quantity_ordered` (additive)
- `quantity_shipped` (additive)
- `quantity_invoiced` (additive)
- `unit_price` (semi-additive)
- `line_amount` (additive)
- `discount_amount` (additive)
- `line_cost` (additive)
- `line_margin` (additive)

**Dimension Foreign Keys**:
- order_date_key
- customer_key
- product_key
- facility_key
- sales_rep_key

**Degenerate Dimensions**:
- sales_order_number
- line_number
- customer_po_number

---

### Fact: Production Runs
**Grain**: One row per production run
**Type**: Transaction fact
**Fact Columns**:
- `planned_quantity` (additive)
- `good_quantity` (additive)
- `scrap_quantity` (additive)
- `rework_quantity` (additive)
- `setup_time_minutes` (additive)
- `run_time_minutes` (additive)
- `downtime_minutes` (additive)
- `total_labor_cost` (additive)

**Dimension Foreign Keys**:
- production_date_key
- production_time_key
- product_key
- facility_key
- work_center_key
- employee_key (operator)

**Degenerate Dimensions**:
- production_run_number
- lot_number

---

### Fact: Quality Inspections
**Grain**: One row per inspection
**Type**: Transaction fact
**Fact Columns**:
- `sample_size` (additive)
- `defects_found` (additive)
- `pass_fail_flag` (non-additive)

**Dimension Foreign Keys**:
- inspection_date_key
- inspection_time_key
- product_key
- material_key
- facility_key
- work_center_key
- employee_key (inspector)

**Degenerate Dimensions**:
- inspection_number
- lot_number

---

### Fact: Inventory Snapshots
**Grain**: One row per material per location per day
**Type**: Periodic snapshot fact
**Fact Columns**:
- `quantity_on_hand` (semi-additive - additive across location, not time)
- `quantity_allocated` (semi-additive)
- `quantity_available` (semi-additive)
- `standard_cost` (non-additive)
- `extended_value` (semi-additive)

**Dimension Foreign Keys**:
- snapshot_date_key
- material_key
- facility_key
- security_zone_key

**Business Rule**: Daily snapshot taken at end of day (23:59:59 local time).

---

### Fact: Labor Tracking
**Grain**: One row per employee per production run per labor type
**Type**: Transaction fact
**Fact Columns**:
- `hours_worked` (additive)
- `hourly_rate` (non-additive)
- `total_labor_cost` (additive)

**Dimension Foreign Keys**:
- date_key (work date)
- time_key (shift start time)
- employee_key
- product_key
- facility_key
- work_center_key

**Degenerate Dimensions**:
- production_run_number
- labor_type (SETUP, RUN, CLEANUP, REWORK)

---

## COLUMN NAME STANDARDS

### Date/Time Columns

| Column Name | Meaning | Data Type | Example |
|-------------|---------|-----------|---------|
| `order_date` | Date sales order was placed | DATE | 2025-01-15 |
| `quote_date` | Date quote was created | DATE | 2025-01-10 |
| `invoice_date` | Date invoice was generated | DATE | 2025-01-20 |
| `shipment_date` | Date shipment left facility | DATE | 2025-01-18 |
| `delivery_date` | Date shipment was delivered | DATE | 2025-01-22 |
| `production_date` | Date production run occurred | DATE | 2025-01-16 |
| `inspection_date` | Date quality inspection performed | DATE | 2025-01-17 |
| `receipt_date` | Date material was received | DATE | 2025-01-12 |
| `posting_date` | Date GL entry was posted | DATE | 2025-01-20 |
| `due_date` | Date payment/action is due | DATE | 2025-02-19 |
| `promised_date` | Date promised to customer | DATE | 2025-01-25 |
| `requested_date` | Date requested by customer | DATE | 2025-01-20 |
| `effective_from` | Start date of validity period | DATE | 2025-01-01 |
| `effective_to` | End date of validity period | DATE | 2025-12-31 |
| `clock_in_time` | Time employee clocked in | TIME | 08:00:00 |
| `clock_out_time` | Time employee clocked out | TIME | 17:00:00 |
| `event_timestamp` | Precise moment of event | TIMESTAMPTZ | 2025-01-15 14:32:18-05 |
| `reading_timestamp` | Precise moment of sensor reading | TIMESTAMPTZ | 2025-01-15 14:32:18.123-05 |

**Business Rule**:
- Use `_date` for calendar dates (no time component)
- Use `_time` for time-of-day only
- Use `_timestamp` for precise date+time events

---

### Quantity Columns

| Column Name | Meaning | Unit | Additivity |
|-------------|---------|------|------------|
| `quantity_ordered` | Quantity on sales order line | Product UOM | Additive |
| `quantity_shipped` | Quantity shipped to customer | Product UOM | Additive |
| `quantity_invoiced` | Quantity invoiced | Product UOM | Additive |
| `quantity_received` | Quantity received from vendor | Material UOM | Additive |
| `quantity_on_hand` | Current inventory quantity | Material UOM | Semi-additive |
| `quantity_allocated` | Quantity reserved/allocated | Material UOM | Semi-additive |
| `quantity_available` | Quantity available for use | Material UOM | Semi-additive |
| `good_quantity` | Good production output | Product UOM | Additive |
| `scrap_quantity` | Scrap/waste quantity | Product UOM | Additive |
| `rework_quantity` | Quantity requiring rework | Product UOM | Additive |
| `sample_size` | Number of units inspected | Each | Additive |
| `defects_found` | Number of defects found | Each | Additive |

**Business Rule**: All quantities must have associated UOM. Quantities without UOM are counts (Each).

---

### Amount/Cost Columns

| Column Name | Meaning | Currency | Additivity |
|-------------|---------|----------|------------|
| `unit_price` | Price per unit | Order currency | Non-additive |
| `line_amount` | Extended line total | Order currency | Additive |
| `subtotal` | Sum before tax/shipping | Order currency | Additive |
| `tax_amount` | Tax amount | Order currency | Additive |
| `shipping_amount` | Shipping/freight cost | Order currency | Additive |
| `discount_amount` | Discount amount | Order currency | Additive |
| `total_amount` | Grand total | Order currency | Additive |
| `balance_due` | Amount still owed | Order currency | Semi-additive |
| `standard_cost` | Standard unit cost | Cost currency | Non-additive |
| `actual_cost` | Actual unit cost | Cost currency | Non-additive |
| `extended_value` | Quantity × Cost | Cost currency | Additive |
| `labor_cost` | Labor cost | Cost currency | Additive |
| `material_cost` | Material cost | Cost currency | Additive |
| `overhead_cost` | Overhead cost | Cost currency | Additive |

**Business Rule**: All amounts must reference currency code. Multi-currency orders track `exchange_rate`.

---

### Rate/Percentage Columns

| Column Name | Meaning | Range | Format |
|-------------|---------|-------|--------|
| `unit_price` | Price per unit | >= 0 | DECIMAL(18,4) |
| `hourly_rate` | Labor rate per hour | >= 0 | DECIMAL(18,4) |
| `exchange_rate` | Currency conversion rate | > 0 | DECIMAL(18,8) |
| `discount_percentage` | Discount percent | 0-100 | DECIMAL(8,4) |
| `margin_percentage` | Profit margin percent | -∞ to +∞ | DECIMAL(8,4) |
| `waste_percentage` | Waste/scrap percent | 0-100 | DECIMAL(8,4) |
| `availability_percent` | OEE availability | 0-100 | DECIMAL(8,4) |
| `performance_percent` | OEE performance | 0-100 | DECIMAL(8,4) |
| `quality_percent` | OEE quality | 0-100 | DECIMAL(8,4) |
| `oee_percent` | Overall OEE | 0-100 | DECIMAL(8,4) |
| `on_time_delivery_pct` | On-time delivery rate | 0-100 | DECIMAL(8,4) |
| `quality_rating_pct` | Quality acceptance rate | 0-100 | DECIMAL(8,4) |

**Business Rule**: Percentages stored as 0-100, not 0-1. Display with "%" symbol.

---

### Time Duration Columns

| Column Name | Meaning | Unit | Additivity |
|-------------|---------|------|------------|
| `setup_time_minutes` | Machine setup time | Minutes | Additive |
| `run_time_minutes` | Production run time | Minutes | Additive |
| `downtime_minutes` | Unplanned downtime | Minutes | Additive |
| `changeover_time_minutes` | Changeover duration | Minutes | Additive |
| `regular_hours` | Regular work hours | Hours | Additive |
| `overtime_hours` | Overtime work hours | Hours | Additive |
| `double_time_hours` | Double-time work hours | Hours | Additive |
| `break_hours` | Break time | Hours | Additive |
| `hours_worked` | Total hours worked | Hours | Additive |
| `lead_time_days` | Lead time | Days | Non-additive |
| `shelf_life_days` | Shelf life | Days | Non-additive |

**Business Rule**: Use smallest practical unit. Production = minutes, Labor = hours, Planning = days.

---

## SEMANTIC CONSISTENCY VIOLATIONS (TO FIX)

### Issues Found in Current OLTP Schema:

1. **Date Column Inconsistency**:
   - ❌ `po_date` vs `order_date` vs `quote_date` - inconsistent naming
   - ✅ Should be: `purchase_order_date`, `sales_order_date`, `quote_date`

2. **Quantity Column Overloading**:
   - ❌ Generic `quantity` in multiple tables means different things
   - ✅ Should be specific: `quantity_ordered`, `quantity_shipped`, `quantity_received`

3. **Amount Column Confusion**:
   - ❌ `total_amount` vs `line_amount` vs `amount` - unclear scope
   - ✅ Standardize: `line_amount` (line level), `subtotal` (before tax), `total_amount` (grand total)

4. **Status Column Ambiguity**:
   - ❌ Generic `status` in 20+ tables
   - ✅ Should be specific: `order_status`, `inspection_status`, `defect_status`

5. **ID Column Role Confusion**:
   - ❌ `user_id` vs `created_by` vs `inspector_user_id` - unclear roles
   - ✅ Use role-specific: `inspector_user_id`, `buyer_user_id`, `created_by_user_id`

---

## NEXT STEPS

1. **Audit OLTP Schema** - Review all 86 tables for column name consistency
2. **Create Star Schema** - Build dimensional model with fact/dimension tables
3. **Design ETL Processes** - Map OLTP → OLAP transformations
4. **Implement SCD Logic** - Type 2 slowly changing dimensions
5. **Build Aggregate Tables** - Pre-calculated summaries for performance
6. **Create BI Views** - Business-friendly query layers

---

## BUSINESS VALUE METRICS (OLAP Drives These)

### Sales Metrics:
- Revenue by customer/product/region/time
- Quote-to-order conversion rate
- Average deal size
- Sales velocity
- Customer lifetime value

### Manufacturing Metrics:
- OEE by work center/product/shift
- First-pass yield
- Scrap rate
- Production throughput
- Capacity utilization

### Quality Metrics:
- Defect rate by product/work center
- Customer rejection rate
- CAPA closure time
- Quality cost (internal + external failure)

### Financial Metrics:
- Gross margin by product/customer
- Inventory turns
- DSO (Days Sales Outstanding)
- DPO (Days Payable Outstanding)
- Working capital efficiency

### Marketplace Metrics:
- Partner reliability scores
- Bid-to-award ratio
- Outsourcing volume
- Network utilization

**These business metrics drive what data we capture in OLTP.**
