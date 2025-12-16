# Operations + WMS MVP - KPI Analysis

**📍 Navigation Path:** [AGOG Home](../README.md) → [Docs](./README.md) → Operations WMS MVP KPIs

**For AI Agents:** This defines MUST-HAVE KPIs for Operations + WMS MVP. Don't build features without KPI support.

**For Humans:** Todd's MVP scope - Operations + WMS together with shipping. These KPIs validate success.

**Date:** 2025-12-10
**Context:** Migrated 71 KPIs from AGOG → agogsaas

---

## Executive Summary

**Just Migrated from AGOG:**
- ✅ 71 KPIs across 6 categories
- ✅ Production (21 KPIs)
- ✅ Quality (10 KPIs)
- ✅ Equipment (9 KPIs)
- ✅ Financial (19 KPIs)
- ✅ Cash Flow (10 KPIs)
- ✅ Labor/HR (12 KPIs)

**Validation Status (from AGOG):**
- ✅ Can Calculate: 12 KPIs (19%) - **schemas support these**
- ⚠️ Partial: 3 KPIs (5%)
- ❌ Cannot Calculate: 48 KPIs (68%) - **schemas need more fields**

**Todd's MVP Requirement:** "Operations and WMS need to be done together without losing sight this is a tightly linked solution."

---

## Operations + WMS Circular Dependencies

**Why These Must Be Built Together:**

```
Sales → Operations: Sales orders create production orders
Operations → WMS: Production consumes raw materials (WMS issues inventory)
WMS → Operations: Material availability drives production scheduling
Operations → WMS: Production creates finished goods (WMS receives inventory)
WMS → Sales: Inventory levels enable sales quotes (available-to-promise)
Operations → Sales: Production completion triggers invoicing
WMS → Shipping: Pick/pack/ship fulfillment
```

**Todd's Quote:** "Finance uses Sales, Sales uses WMS, WMS uses Operations, Operations uses WMS and Sales, etc..."

---

## MUST-HAVE KPIs for Operations + WMS MVP

### Tier 1: CRITICAL (Cannot Launch Without These)

#### 1. **Overall Equipment Effectiveness (OEE)**
**Why Critical:** THE primary metric for manufacturing. "Everything ties back to maximizing OEE." - AGOG vendor

**Formula:** OEE = Availability × Performance × Quality

**Requires:**
- `production_runs` table with actual vs planned times
- `equipment_status_log` for downtime tracking
- Good units vs total units produced

**Validation Status:** ❌ Cannot Calculate (missing fields in schema)

**Target:** ≥ 85%

---

#### 2. **Material Utilization %**
**Why Critical:** #1 cost driver in packaging industry

**Formula:** (Good Output Weight/Area) / (Raw Material Input Weight/Area) × 100

**Requires:**
- `material_consumption` table with waste reason codes
- Track: Trim waste, Makeready waste, Web breaks, Quality rejects

**Validation Status:** ❌ Cannot Calculate (needs material_consumption schema)

**Target:** ≥ 90%

---

#### 3. **First Pass Yield (FPY)**
**Why Critical:** Quality metric - units correct on first attempt

**Formula:** (Good Units First Time / Total Units Started) × 100

**Requires:**
- `production_runs` with quantity_good, quantity_rework
- `quality_defects` table

**Validation Status:** ❌ Cannot Calculate (missing rework tracking)

**Target:** ≥ 95%

---

#### 4. **Inventory Accuracy Rate**
**Why Critical:** WMS core metric - can't trust inventory data if inaccurate

**Formula:** (Correct Items / Total Items Counted) × 100

**Requires:**
- `cycle_counts` table
- `inventory_transactions` for discrepancies

**Validation Status:** ⚠️ Partial (inventory_transactions exists but needs cycle_count)

**Target:** ≥ 99%

---

#### 5. **Lot Traceability Compliance**
**Why Critical:** FDA/FSMA regulatory requirement for food packaging

**Formula:** (Jobs with Complete Lot Records / Total Jobs) × 100

**Requires:**
- `lot_genealogy` table (split, combine, rework, repackage)
- Forward tracing: Lot → customers
- Backward tracing: Product → source lots

**Validation Status:** ❌ Cannot Calculate (lot_genealogy doesn't exist yet)

**Target:** 100% (regulatory compliance)

---

#### 6. **Schedule Adherence**
**Why Critical:** On-time delivery to customers

**Formula:** (Jobs Completed On Time / Total Jobs) × 100

**Requires:**
- `production_orders` with due_date
- `production_runs` with actual_end_time

**Validation Status:** ✅ CAN CALCULATE (schemas support this!)

**Target:** ≥ 95%

---

### Tier 2: HIGH PRIORITY (Needed Soon After Launch)

#### 7. **Setup Time / Makeready Time**
**Why High Priority:** Changeover efficiency = ability to run short batches profitably

**Formula:** AVG(actual_start_time - scheduled_start_time)

**Requires:**
- `changeover_details` table with previous_job, next_job, reason_code

**Validation Status:** ❌ Cannot Calculate (changeover_details needs more fields)

**Target:** ≤ 30 minutes

---

#### 8. **Cycle Time**
**Why High Priority:** Total time job start → completion

**Formula:** actual_end_time - actual_start_time

**Requires:**
- `production_runs` with timestamps

**Validation Status:** ✅ CAN CALCULATE

**Target:** Meet estimated time

---

#### 9. **Inventory Turnover Ratio**
**Why High Priority:** How fast inventory moves (cash flow metric)

**Formula:** COGS / Average Inventory Value

**Requires:**
- `inventory_transactions` for valuation
- Financial integration for COGS

**Validation Status:** ⚠️ Partial (needs financial linkage)

**Target:** 6-12 turns/year (packaging industry standard)

---

#### 10. **Days Inventory Outstanding (DIO)**
**Why High Priority:** Cash tied up in inventory

**Formula:** (Inventory Value / COGS) × Days in Period

**Requires:**
- Same as Inventory Turnover

**Validation Status:** ⚠️ Partial

**Target:** 30-60 days (packaging industry)

---

#### 11. **Picking Accuracy Rate**
**Why High Priority:** WMS operational efficiency

**Formula:** (Correct Picks / Total Picks) × 100

**Requires:**
- `wave_processing` table
- Pick confirmation tracking

**Validation Status:** ❌ Cannot Calculate (wave_processing exists but needs pick tracking)

**Target:** ≥ 99.5%

---

#### 12. **Wave Cycle Time**
**Why High Priority:** Pick/pack/ship efficiency

**Formula:** AVG(actual_end - actual_start) for completed waves

**Requires:**
- `wave_processing` with timestamps

**Validation Status:** ✅ CAN CALCULATE (wave_processing table exists!)

**Target:** < 4 hours

---

### Tier 3: MEDIUM PRIORITY (Nice to Have for MVP)

#### 13. **Equipment Utilization Rate**
**Why Medium:** Capacity planning, not critical for day 1

**Formula:** (Actual Production Time / Available Time) × 100

**Requires:**
- `equipment_status_log` with productive/non-productive flags

**Validation Status:** ❌ Cannot Calculate

**Target:** 70-85%

---

#### 14. **Equipment Uptime %**
**Why Medium:** Reliability metric

**Formula:** (Running Time / (Running Time + Downtime)) × 100

**Requires:**
- `equipment_status_log` with uptime/downtime

**Validation Status:** ❌ Cannot Calculate

**Target:** ≥ 90%

---

#### 15. **MTBF (Mean Time Between Failures)**
**Why Medium:** Predictive maintenance (future feature)

**Formula:** Total Operating Time / Number of Failures

**Requires:**
- `maintenance_records` table
- Failure event tracking

**Validation Status:** ❌ Cannot Calculate

**Target:** > 100 hours

---

#### 16. **MTTR (Mean Time To Repair)**
**Why Medium:** Maintenance efficiency

**Formula:** Total Repair Time / Number of Repairs

**Requires:**
- `maintenance_records` with start/end timestamps

**Validation Status:** ❌ Cannot Calculate

**Target:** < 2 hours

---

#### 17. **Dock-to-Stock Time**
**Why Medium:** WMS receiving efficiency

**Formula:** AVG(put-away completion - receipt time)

**Requires:**
- `inventory_transactions` with receiving + put-away timestamps

**Validation Status:** ⚠️ Partial (transactions exist but need put-away tracking)

**Target:** < 2 hours for urgent materials

---

#### 18. **Scrap Rate**
**Why Medium:** Waste tracking (covered by Material Utilization)

**Formula:** (Scrap Quantity / Total Material Used) × 100

**Requires:**
- `material_consumption` with scrap reason codes

**Validation Status:** ❌ Cannot Calculate

**Target:** < 5%

---

#### 19. **Throughput**
**Why Medium:** Production volume metric

**Formula:** Total Units Produced / Time Period

**Requires:**
- `production_runs` with quantity_produced

**Validation Status:** ✅ CAN CALCULATE

**Target:** Meet capacity targets

---

## Validation Status Summary

**Of 19 MVP KPIs:**

**✅ Can Calculate NOW (4 KPIs - 21%):**
1. Schedule Adherence
2. Cycle Time
3. Wave Cycle Time
4. Throughput

**⚠️ Partially Calculate (3 KPIs - 16%):**
5. Inventory Accuracy Rate (need cycle_count table)
6. Inventory Turnover Ratio (need financial linkage)
7. Dock-to-Stock Time (need put-away tracking)

**❌ Cannot Calculate Yet (12 KPIs - 63%):**
8. OEE (missing fields in production_runs)
9. Material Utilization (need material_consumption table)
10. First Pass Yield (missing rework tracking)
11. Lot Traceability Compliance (need lot_genealogy table)
12. Setup Time (changeover_details needs more fields)
13. Picking Accuracy Rate (need pick confirmation tracking)
14. Equipment Utilization (need equipment_status_log flags)
15. Equipment Uptime (need equipment_status_log)
16. MTBF (need maintenance_records)
17. MTTR (need maintenance_records)
18. Scrap Rate (need material_consumption)

---

## Schema Gaps Analysis

**To calculate Tier 1 CRITICAL KPIs, we need:**

### 1. Material Consumption Table (NEW)
```yaml
entity: MaterialConsumption
properties:
  id: UUID
  tenant_id: UUID
  production_run_id: UUID
  material_id: UUID
  lot_number: String
  quantity_issued: Decimal
  quantity_consumed: Decimal
  quantity_wasted: Decimal
  waste_reason_code: Enum [trim, makeready, web_break, quality, other]
  weight_start: Decimal
  weight_end: Decimal
  created_at: Timestamp
```

**Enables KPIs:**
- Material Utilization %
- Scrap Rate

---

### 2. Lot Genealogy Table (NEW)
```yaml
entity: LotGenealogy
properties:
  id: UUID
  tenant_id: UUID
  parent_lot_number: String
  child_lot_number: String
  relationship_type: Enum [split, combine, rework, repackage]
  parent_quantity: Decimal
  child_quantity: Decimal
  material_id: UUID
  production_run_id: UUID (optional)
  created_at: Timestamp
```

**Enables KPIs:**
- Lot Traceability Compliance (FDA/FSMA regulatory)

---

### 3. Cycle Counting Table (NEW)
```yaml
entity: CycleCount
properties:
  id: UUID
  tenant_id: UUID
  material_id: UUID
  location_id: UUID
  lot_number: String (optional)
  count_date: Date
  system_quantity: Decimal
  counted_quantity: Decimal
  variance: Decimal
  variance_reason: String
  counted_by: UUID
```

**Enables KPIs:**
- Inventory Accuracy Rate

---

### 4. Production Run Enhancements (UPDATE EXISTING)
**Add to existing production_runs table:**
```yaml
# Add these fields:
quantity_rework: Decimal  # For FPY calculation
quantity_scrap: Decimal   # For scrap tracking
planned_start_time: Timestamp  # For setup time calc
planned_end_time: Timestamp    # For schedule adherence
speed_theoretical: Decimal  # For OEE Performance
speed_actual: Decimal       # For OEE Performance
downtime_minutes: Decimal   # For OEE Availability
```

**Enables KPIs:**
- OEE (with new fields)
- First Pass Yield (with quantity_rework)
- Setup Time (with planned_start_time)

---

### 5. Changeover Details Enhancements (UPDATE EXISTING)
**Add to existing changeover_details table:**
```yaml
# Add these fields:
standard_setup_time_minutes: Decimal  # For variance calculation
actual_setup_time_minutes: Decimal
delay_reason_code: String
```

**Enables KPIs:**
- Setup Time / Makeready Time

---

### 6. Wave Processing Enhancements (UPDATE EXISTING)
**Add to existing wave_processing table:**
```yaml
# Add these fields:
picks_planned: Integer
picks_completed: Integer
picks_correct: Integer
picks_incorrect: Integer
```

**Enables KPIs:**
- Picking Accuracy Rate

---

### 7. Equipment Status Log (NEW)
```yaml
entity: EquipmentStatusLog
properties:
  id: UUID
  tenant_id: UUID
  equipment_id: UUID
  status: Enum [running, idle, setup, maintenance, breakdown]
  start_time: Timestamp
  end_time: Timestamp
  duration_minutes: Decimal
  is_productive_time: Boolean
  is_unplanned_downtime: Boolean
  reason_code: String
```

**Enables KPIs:**
- Equipment Utilization Rate
- Equipment Uptime %

---

### 8. Maintenance Records (NEW)
```yaml
entity: MaintenanceRecord
properties:
  id: UUID
  tenant_id: UUID
  equipment_id: UUID
  maintenance_type: Enum [preventive, corrective, emergency]
  failure_occurred: Boolean
  start_time: Timestamp
  end_time: Timestamp
  repair_duration_minutes: Decimal
  technician_id: UUID
  notes: Text
```

**Enables KPIs:**
- MTBF
- MTTR

---

## Implementation Priority

**Phase 1: Get Tier 1 CRITICAL KPIs Working (4 KPIs Already Work!)**

**Week 1: Schema Updates**
1. ✅ Use existing schemas for 4 working KPIs
2. Create `material_consumption` table → Material Utilization
3. Create `lot_genealogy` table → Lot Traceability
4. Create `cycle_count` table → Inventory Accuracy
5. Update `production_runs` with rework/scrap → First Pass Yield, OEE

**Week 2: UI Dashboards**
1. Operations Dashboard with OEE, Material Utilization, FPY
2. WMS Dashboard with Inventory Accuracy, Lot Traceability

---

**Phase 2: Get Tier 2 HIGH PRIORITY KPIs Working**

**Week 3: More Schema Updates**
1. Update `changeover_details` → Setup Time
2. Update `wave_processing` → Picking Accuracy
3. Add financial linkage → Inventory Turnover, DIO

**Week 4: Enhanced Dashboards**
1. Add Tier 2 KPIs to existing dashboards
2. Create alerts for out-of-range KPIs

---

**Phase 3: Tier 3 MEDIUM PRIORITY (Post-MVP)**

1. Create `equipment_status_log` → Utilization, Uptime
2. Create `maintenance_records` → MTBF, MTTR
3. Add put-away tracking → Dock-to-Stock Time

---

## Questions for Todd

### 1. **Tier 1 CRITICAL KPIs - Do you agree these 6 are must-have?**
- OEE
- Material Utilization %
- First Pass Yield
- Inventory Accuracy Rate
- Lot Traceability Compliance
- Schedule Adherence

**Or should we add/remove any?**

---

### 2. **Schema Implementation Order - Which first?**

**Option A: Material Consumption First**
- Enables: Material Utilization % (#1 cost driver)
- Complexity: Medium (new table, production integration)

**Option B: Lot Genealogy First**
- Enables: Lot Traceability (regulatory compliance)
- Complexity: High (complex relationships, FDA requirements)

**Option C: Cycle Counting First**
- Enables: Inventory Accuracy (WMS foundation)
- Complexity: Low (simple table, existing inventory integration)

**Your preference?**

---

### 3. **Shipping in WMS - Scope for MVP?**

You said: "shipping should come from WMS"

**Should MVP include:**
- ☐ Wave processing (group orders for picking)
- ☐ Pick list generation
- ☐ Packing workflows
- ☐ Carrier integration (FedEx/UPS rate shopping, label printing)
- ☐ Shipment tracking
- ☐ All of the above

**Or start with basic shipping (manual) and add integrations later?**

---

### 4. **Financial Integration Depth**

For KPIs like Inventory Turnover, we need COGS (Cost of Goods Sold).

**Should Operations + WMS MVP include:**
- ☐ Basic financial tracking (just enough for KPIs)
- ☐ Full GL integration (every transaction posts to General Ledger)
- ☐ Defer financial integration until Finance module

**Your preference?**

---

### 5. **Equipment/IoT Scope**

Equipment KPIs (Utilization, Uptime, MTBF, MTTR) require IoT integration.

**Should Operations MVP include:**
- ☐ Manual equipment tracking (operators enter data)
- ☐ Basic IoT (connect to 1-2 machines as proof of concept)
- ☐ Full IoT (connect all equipment, real-time monitoring)
- ☐ Defer IoT until post-MVP

**Your preference?**

---

## Recommendations

**My Recommendation for MVP:**

### Phase 1 (4 weeks) - Core Operations + WMS
**Week 1:**
- Implement 4 KPIs that work today (Schedule Adherence, Cycle Time, Wave Cycle Time, Throughput)
- Create Operations Dashboard
- Create WMS Dashboard

**Week 2:**
- Add `cycle_count` table → Inventory Accuracy Rate
- Add `material_consumption` table → Material Utilization %
- Manual equipment tracking (no IoT yet)

**Week 3:**
- Add `lot_genealogy` table → Lot Traceability Compliance
- Update `production_runs` → First Pass Yield, OEE (partial)
- Basic shipping (wave processing, pick lists, manual packing)

**Week 4:**
- Polish dashboards with all 6 Tier 1 CRITICAL KPIs
- Add alerts for out-of-range values
- Customer demo prep

### Phase 2 (2 weeks) - Shipping Integration
**Week 5-6:**
- Carrier integration (FedEx/UPS APIs)
- Label printing
- Tracking numbers
- Tier 2 KPIs (Setup Time, Picking Accuracy)

### Phase 3 (Post-MVP) - Equipment/IoT
- Connect 1-2 machines as proof of concept
- Real-time OEE calculation
- Equipment Utilization, Uptime, MTBF, MTTR

---

**Does this match your vision for Operations + WMS MVP?**

Let's discuss the 5 questions above so I can build exactly what you need.

---

[⬆ Back to top](#operations--wms-mvp---kpi-analysis) | [🏠 AGOG Home](../README.md) | [📚 Docs](./README.md)
