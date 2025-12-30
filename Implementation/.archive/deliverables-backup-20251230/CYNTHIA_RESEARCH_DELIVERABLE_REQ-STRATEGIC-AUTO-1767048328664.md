# RESEARCH DELIVERABLE: Quality Management & SPC (Statistical Process Control)

**Requirement:** REQ-STRATEGIC-AUTO-1767048328664
**Feature Title:** Quality Management & SPC (Statistical Process Control)
**Researcher:** Cynthia (Research & Architecture Specialist)
**Date:** 2025-12-29
**Status:** COMPLETE

---

## EXECUTIVE SUMMARY

This research deliverable provides a comprehensive analysis of implementing Statistical Process Control (SPC) capabilities for the print industry ERP system. The system already has a robust quality management foundation (5 core tables, GraphQL resolvers, and frontend dashboard), but lacks SPC-specific functionality for real-time process monitoring, control charts, and capability analysis critical for modern print manufacturing.

### Key Findings

1. **Existing Foundation (STRONG)**: Quality module with 5 tables covering standards, inspections, defects, and customer rejections
2. **Statistical Analysis Pattern**: Proven implementation exists in WMS module with sophisticated statistical analysis framework
3. **Critical Gap**: No SPC-specific tables, control charts, or process capability calculations (Cp/Cpk)
4. **Print Industry Requirements**: G7/GRACoL color standards, ISO 12647-2 compliance, press control monitoring

---

## 1. CURRENT STATE ANALYSIS

### 1.1 Existing Quality Infrastructure

#### Database Schema (V0.0.7 Migration)

**5 Core Quality Tables:**

```sql
-- Quality Standards (ISO 9001, ISO 13485, G7, FSC, etc.)
quality_standards
  - standard_code, standard_name, standard_type
  - requirements (JSONB), certification_body
  - Multi-industry support (print, medical devices, aerospace)

-- Inspection Templates (INCOMING, IN_PROCESS, FINAL, FIRST_ARTICLE)
inspection_templates
  - template_code, inspection_type
  - inspection_points (JSONB) - spec limits, measurements
  - sampling_plan (FULL, AQL_2.5, AQL_4.0)

-- Quality Inspections (actual inspection records)
quality_inspections
  - inspection_number, inspection_date
  - sample_size, defects_found, pass_fail
  - inspection_results (JSONB) - measured values vs specs
  - disposition (ACCEPT, REJECT, REWORK, USE_AS_IS, QUARANTINE)

-- Quality Defects (CAPA tracking)
quality_defects
  - defect_code, defect_severity (CRITICAL, MAJOR, MINOR)
  - root_cause, corrective_action, preventive_action
  - Status workflow (OPEN → IN_PROGRESS → RESOLVED → VERIFIED → CLOSED)

-- Customer Rejections
customer_rejections
  - rejection_reason, quantity_rejected
  - financial_impact, disposition (CREDIT, REPLACEMENT, REWORK)
```

#### GraphQL API (FinalModulesResolver)

**Implemented Queries:**
- `qualityStandards` - Filter by type, active status
- `inspectionTemplates` - By type, product, material
- `qualityInspections` - Date range, facility, pass/fail filtering
- `qualityDefects` - Status and severity filtering
- `customerRejections` - Customer trends, financial impact

**Implemented Mutations:**
- `createQualityInspection`, `updateQualityInspection`
- `createQualityDefect`, `updateQualityDefect`
- `createCustomerRejection`, `updateCustomerRejection`

#### Frontend Dashboard (QualityDashboard.tsx)

**Current Metrics:**
- Quality Score (98.5%)
- Defect Rate (1.5%)
- Open NCRs (Non-Conformance Reports)
- Inspections Passed (342)
- Defect Rates by Product (bar chart)

**Current GraphQL Queries:**
- `GET_DEFECT_RATES` - By product, date range
- `GET_CUSTOMER_REJECTION_TRENDS` - Shipment rejection rates
- `GET_INSPECTION_RESULTS` - Inspection history
- `GET_NCR_STATUS` - Non-conformance tracking
- `GET_VENDOR_QUALITY_SCORECARD` - Vendor acceptance rates

### 1.2 Statistical Analysis Framework (WMS Module Pattern)

**Proven Implementation from bin-utilization-statistical-analysis.service.ts:**

```typescript
// Statistical Methods Implemented (Reference Pattern):
- Descriptive statistics (mean, median, std dev, percentiles)
- Hypothesis testing (t-tests, chi-square tests)
- Correlation analysis (Pearson, Spearman)
- Regression analysis (linear regression)
- Outlier detection (IQR, Z-score, Modified Z-score)
- Time-series analysis (trend detection)
- A/B testing framework
- Confidence intervals
- Effect size calculations
```

**Database Pattern (V0.0.22 Migration):**
- `bin_optimization_statistical_metrics` - Time-series metrics tracking
- `bin_optimization_ab_test_results` - A/B test results
- Statistical validity tracking (sample size, confidence intervals)
- Algorithm performance measurement (acceptance rate, improvements)

**Key Insights:**
1. **Time-series tracking pattern** with measurement periods
2. **Statistical significance validation** (p-values, confidence intervals)
3. **Performance metrics** (acceptance rates, improvements)
4. **ML model metrics** (accuracy, precision, recall, F1 score)
5. **Outlier detection** framework

---

## 2. PRINT INDUSTRY SPC REQUIREMENTS

### 2.1 Print-Specific Quality Standards

#### G7/GRACoL (Graphic Arts Color Standards)
- **Purpose:** Industry standard for color consistency
- **Metrics:** Gray balance, dot gain, solid ink density
- **Control:** ΔE2000 color difference measurements
- **Target:** ΔE < 2.0 (excellent), ΔE < 5.0 (acceptable)

#### ISO 12647-2 (Offset Lithography)
- **Purpose:** International standard for print quality
- **Parameters:** Dot gain curves, ink density, trapping
- **Measurement:** Spectrophotometer readings at control strips
- **Frequency:** Every 100 sheets or hourly

#### Print Process Parameters
```plaintext
Critical Control Parameters:
- Ink density (C, M, Y, K) - Target ±0.05
- Register accuracy - ±0.001" tolerance
- Dot gain % - Target 18% @ 50%
- Color bars (ΔE measurements)
- Substrate consistency (caliper, moisture)
- Press speed variations
- Temperature & humidity
```

### 2.2 SPC Core Requirements

#### Control Charts (7 Types)
1. **X-bar & R Chart** - Monitor process mean and range (ink density)
2. **X-bar & S Chart** - Mean and standard deviation (for n ≥ 10)
3. **I-MR Chart** - Individual values and moving range (color ΔE)
4. **p-Chart** - Proportion defective (defect rate per batch)
5. **np-Chart** - Number of defectives (absolute count)
6. **c-Chart** - Count of defects (defects per sample)
7. **u-Chart** - Defects per unit (variable sample sizes)

#### Process Capability Indices
```plaintext
Cp (Process Capability) = (USL - LSL) / (6σ)
  - Measures potential capability
  - Minimum: 1.33 (acceptable)
  - Target: 1.67+ (excellent)

Cpk (Process Capability Index) = min[(USL - μ)/(3σ), (μ - LSL)/(3σ)]
  - Measures actual capability (accounts for centering)
  - Minimum: 1.33
  - Target: 1.67+

Pp/Ppk (Process Performance)
  - Long-term performance vs. short-term capability
  - Uses overall std dev, not subgroup std dev
```

#### Control Limits
```plaintext
UCL (Upper Control Limit) = μ + 3σ
CL (Center Line) = μ
LCL (Lower Control Limit) = μ - 3σ

For X-bar chart:
UCL = X̄̄ + A2 * R̄
CL = X̄̄
LCL = X̄̄ - A2 * R̄

For R chart:
UCL = D4 * R̄
CL = R̄
LCL = D3 * R̄
```

#### Out-of-Control Conditions (Western Electric Rules)
1. **Rule 1:** One point beyond 3σ
2. **Rule 2:** 2 of 3 consecutive points beyond 2σ (same side)
3. **Rule 3:** 4 of 5 consecutive points beyond 1σ (same side)
4. **Rule 4:** 8 consecutive points on same side of center line
5. **Rule 5:** 6 consecutive points trending up or down
6. **Rule 6:** 14 consecutive points alternating up and down
7. **Rule 7:** 15 consecutive points within 1σ (hugging center)
8. **Rule 8:** 8 consecutive points beyond 1σ (avoiding center)

### 2.3 Real-Time Monitoring Requirements

#### Data Collection
- **Frequency:** Real-time from IoT sensors + manual measurements
- **Integration:** IoT devices table (iot_devices, sensor_readings)
- **Sources:** Spectrophotometers, densitometers, register scanners
- **Latency:** < 5 seconds for critical parameters

#### Alerting & Notifications
- **Trigger:** Out-of-control conditions detected
- **Escalation:** Operator → Supervisor → Quality Manager
- **Actions:** Automatic press stop, email alerts, mobile notifications
- **Documentation:** Automatic defect record creation

---

## 3. GAP ANALYSIS

### 3.1 Missing SPC Components

| Component | Current State | Required State | Gap |
|-----------|--------------|----------------|-----|
| **Control Charts** | ❌ None | ✅ 7 chart types | CRITICAL |
| **Process Capability** | ❌ None | ✅ Cp/Cpk/Pp/Ppk | CRITICAL |
| **SPC Metrics Storage** | ❌ None | ✅ Time-series table | CRITICAL |
| **Control Limit Calculation** | ❌ None | ✅ UCL/LCL/CL | CRITICAL |
| **Out-of-Control Detection** | ❌ None | ✅ 8 Western Electric rules | CRITICAL |
| **Real-time Monitoring** | ⚠️ Partial (IoT) | ✅ SPC-integrated | MODERATE |
| **Capability Analysis UI** | ❌ None | ✅ Dashboard widgets | HIGH |
| **Trend Analysis** | ⚠️ Basic charts | ✅ Statistical trends | MODERATE |
| **Correlation Analysis** | ❌ None | ✅ Multi-parameter | LOW |
| **Measurement System Analysis** | ❌ None | ✅ Gage R&R | LOW |

### 3.2 Integration Gaps

**IoT Integration:**
- ✅ `iot_devices` table exists
- ✅ `sensor_readings` table exists with `reading_value`, `unit_of_measure`
- ❌ No SPC-specific sensor type categorization
- ❌ No automatic control chart data population

**Quality Inspection Integration:**
- ✅ `inspection_results` (JSONB) stores measurements
- ⚠️ No standardized SPC parameter extraction
- ❌ No automatic Cp/Cpk calculation from inspection data
- ❌ No linkage to control charts

**Production Run Integration:**
- ✅ `production_runs` table exists (operations module)
- ✅ Foreign key in `sensor_readings` and `quality_inspections`
- ❌ No SPC metrics aggregation per production run
- ❌ No automatic first article inspection triggers

---

## 4. TECHNICAL ARCHITECTURE RECOMMENDATIONS

### 4.1 Database Schema Extensions

#### New Tables (4 Core SPC Tables)

```sql
-- =====================================================
-- SPC CONTROL CHART DATA
-- =====================================================
CREATE TABLE spc_control_chart_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,

  -- Production context
  production_run_id UUID,
  work_center_id UUID,
  product_id UUID,

  -- Parameter being measured
  parameter_code VARCHAR(50) NOT NULL,
  parameter_name VARCHAR(255) NOT NULL,
  parameter_type VARCHAR(50), -- INK_DENSITY, COLOR_DELTA_E, REGISTER, DOT_GAIN, etc.

  -- Chart type
  chart_type VARCHAR(20) NOT NULL, -- XBAR_R, I_MR, P_CHART, C_CHART, etc.

  -- Measurement data
  measurement_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subgroup_number INTEGER,
  subgroup_size INTEGER,
  measured_value DECIMAL(18,6) NOT NULL,
  measurement_unit VARCHAR(20),

  -- Measurement context
  operator_user_id UUID,
  measurement_method VARCHAR(50), -- AUTO_SENSOR, MANUAL_SPECTRO, VISUAL
  measurement_device_id UUID, -- FK to iot_devices

  -- Quality context
  quality_inspection_id UUID,
  lot_number VARCHAR(100),

  -- Data source
  data_source VARCHAR(50), -- IOT_SENSOR, QUALITY_INSPECTION, MANUAL_ENTRY
  sensor_reading_id UUID, -- FK to sensor_readings

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,

  CONSTRAINT fk_spc_chart_data_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_spc_chart_data_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
  CONSTRAINT fk_spc_chart_data_production_run FOREIGN KEY (production_run_id) REFERENCES production_runs(id),
  CONSTRAINT fk_spc_chart_data_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
  CONSTRAINT fk_spc_chart_data_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_spc_chart_data_operator FOREIGN KEY (operator_user_id) REFERENCES users(id),
  CONSTRAINT fk_spc_chart_data_device FOREIGN KEY (measurement_device_id) REFERENCES iot_devices(id),
  CONSTRAINT fk_spc_chart_data_inspection FOREIGN KEY (quality_inspection_id) REFERENCES quality_inspections(id),
  CONSTRAINT fk_spc_chart_data_sensor FOREIGN KEY (sensor_reading_id) REFERENCES sensor_readings(id)
);

CREATE INDEX idx_spc_chart_data_tenant_facility ON spc_control_chart_data(tenant_id, facility_id);
CREATE INDEX idx_spc_chart_data_parameter ON spc_control_chart_data(parameter_code, measurement_timestamp DESC);
CREATE INDEX idx_spc_chart_data_production_run ON spc_control_chart_data(production_run_id, parameter_code);
CREATE INDEX idx_spc_chart_data_timestamp ON spc_control_chart_data(measurement_timestamp DESC);

-- =====================================================
-- SPC CONTROL LIMITS
-- =====================================================
CREATE TABLE spc_control_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,

  -- Parameter configuration
  parameter_code VARCHAR(50) NOT NULL,
  parameter_name VARCHAR(255) NOT NULL,
  chart_type VARCHAR(20) NOT NULL,

  -- Product/process scope
  product_id UUID,
  work_center_id UUID,
  material_id UUID,

  -- Specification limits (from customer/standard)
  upper_spec_limit DECIMAL(18,6),
  lower_spec_limit DECIMAL(18,6),
  target_value DECIMAL(18,6),

  -- Control limits (calculated from process data)
  upper_control_limit DECIMAL(18,6) NOT NULL,
  center_line DECIMAL(18,6) NOT NULL,
  lower_control_limit DECIMAL(18,6),

  -- Process statistics (for calculation)
  process_mean DECIMAL(18,6),
  process_std_dev DECIMAL(18,6),
  process_range DECIMAL(18,6),

  -- Calculation metadata
  calculation_method VARCHAR(50), -- STANDARD_3SIGMA, A2_R_BAR, etc.
  sample_size_used INTEGER,
  data_period_start TIMESTAMPTZ,
  data_period_end TIMESTAMPTZ,

  -- Validity
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,

  -- Recalculation trigger
  recalculation_frequency VARCHAR(20), -- DAILY, WEEKLY, MONTHLY, ON_DEMAND
  last_recalculated_at TIMESTAMPTZ,
  next_recalculation_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_at TIMESTAMPTZ,
  updated_by UUID,

  CONSTRAINT fk_spc_limits_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_spc_limits_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
  CONSTRAINT fk_spc_limits_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_spc_limits_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
  CONSTRAINT fk_spc_limits_material FOREIGN KEY (material_id) REFERENCES materials(id),
  CONSTRAINT uq_spc_limits UNIQUE (tenant_id, parameter_code, product_id, work_center_id, effective_from)
);

CREATE INDEX idx_spc_limits_tenant_facility ON spc_control_limits(tenant_id, facility_id);
CREATE INDEX idx_spc_limits_parameter ON spc_control_limits(parameter_code, effective_from DESC);
CREATE INDEX idx_spc_limits_active ON spc_control_limits(is_active, effective_from, effective_to);

-- =====================================================
-- SPC PROCESS CAPABILITY
-- =====================================================
CREATE TABLE spc_process_capability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,

  -- Process identification
  parameter_code VARCHAR(50) NOT NULL,
  parameter_name VARCHAR(255) NOT NULL,
  product_id UUID,
  work_center_id UUID,

  -- Analysis period
  analysis_date DATE NOT NULL,
  analysis_period_start TIMESTAMPTZ NOT NULL,
  analysis_period_end TIMESTAMPTZ NOT NULL,

  -- Specification limits
  upper_spec_limit DECIMAL(18,6) NOT NULL,
  lower_spec_limit DECIMAL(18,6) NOT NULL,
  target_value DECIMAL(18,6),

  -- Process statistics
  process_mean DECIMAL(18,6) NOT NULL,
  process_std_dev DECIMAL(18,6) NOT NULL,
  sample_size INTEGER NOT NULL,

  -- Short-term capability (within-subgroup variation)
  cp DECIMAL(6,4), -- (USL - LSL) / (6σ_within)
  cpk DECIMAL(6,4), -- min[(USL - μ)/(3σ), (μ - LSL)/(3σ)]
  cpu DECIMAL(6,4), -- (USL - μ) / (3σ) - Upper capability
  cpl DECIMAL(6,4), -- (μ - LSL) / (3σ) - Lower capability

  -- Long-term performance (overall variation)
  pp DECIMAL(6,4), -- (USL - LSL) / (6σ_overall)
  ppk DECIMAL(6,4), -- Long-term performance index

  -- Process centering
  k DECIMAL(6,4), -- Centering index: |μ - Target| / [(USL - LSL) / 2]

  -- Defect rates (parts per million)
  expected_ppm_total DECIMAL(10,2),
  expected_ppm_upper DECIMAL(10,2),
  expected_ppm_lower DECIMAL(10,2),

  -- Capability assessment
  capability_status VARCHAR(20), -- EXCELLENT, ADEQUATE, MARGINAL, POOR
  is_centered BOOLEAN,
  is_capable BOOLEAN,

  -- Recommendations
  recommendations TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,

  CONSTRAINT fk_spc_capability_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_spc_capability_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
  CONSTRAINT fk_spc_capability_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_spc_capability_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id)
);

CREATE INDEX idx_spc_capability_tenant_facility ON spc_process_capability(tenant_id, facility_id);
CREATE INDEX idx_spc_capability_parameter ON spc_process_capability(parameter_code, analysis_date DESC);
CREATE INDEX idx_spc_capability_product ON spc_process_capability(product_id, analysis_date DESC);

-- =====================================================
-- SPC OUT-OF-CONTROL ALERTS
-- =====================================================
CREATE TABLE spc_out_of_control_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,

  -- Production context
  production_run_id UUID,
  work_center_id UUID NOT NULL,
  product_id UUID,

  -- Alert details
  alert_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parameter_code VARCHAR(50) NOT NULL,
  parameter_name VARCHAR(255) NOT NULL,
  chart_type VARCHAR(20),

  -- Rule violated
  rule_type VARCHAR(50) NOT NULL,
  -- POINT_BEYOND_3SIGMA, TWO_OF_THREE_BEYOND_2SIGMA, FOUR_OF_FIVE_BEYOND_1SIGMA,
  -- EIGHT_CONSECUTIVE_SAME_SIDE, SIX_TRENDING, FOURTEEN_ALTERNATING,
  -- FIFTEEN_WITHIN_1SIGMA, EIGHT_BEYOND_1SIGMA

  rule_description TEXT,

  -- Measurement details
  measured_value DECIMAL(18,6),
  control_limit_violated DECIMAL(18,6),
  deviation_from_center DECIMAL(18,6),
  sigma_level DECIMAL(4,2), -- How many sigmas from center

  -- Control chart data points involved
  chart_data_ids UUID[], -- Array of spc_control_chart_data IDs

  -- Severity
  severity VARCHAR(20) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL

  -- Response tracking
  status VARCHAR(20) DEFAULT 'OPEN', -- OPEN, ACKNOWLEDGED, INVESTIGATING, RESOLVED, FALSE_ALARM
  acknowledged_by_user_id UUID,
  acknowledged_at TIMESTAMPTZ,

  -- Resolution
  root_cause TEXT,
  corrective_action TEXT,
  resolved_by_user_id UUID,
  resolved_at TIMESTAMPTZ,

  -- Quality defect linkage
  quality_defect_id UUID, -- Auto-created defect record

  -- Notifications sent
  notifications_sent JSONB, -- [{user_id, method, timestamp}]

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_spc_alert_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_spc_alert_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
  CONSTRAINT fk_spc_alert_production_run FOREIGN KEY (production_run_id) REFERENCES production_runs(id),
  CONSTRAINT fk_spc_alert_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
  CONSTRAINT fk_spc_alert_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_spc_alert_acknowledged FOREIGN KEY (acknowledged_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_spc_alert_resolved FOREIGN KEY (resolved_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_spc_alert_defect FOREIGN KEY (quality_defect_id) REFERENCES quality_defects(id)
);

CREATE INDEX idx_spc_alerts_tenant_facility ON spc_out_of_control_alerts(tenant_id, facility_id);
CREATE INDEX idx_spc_alerts_timestamp ON spc_out_of_control_alerts(alert_timestamp DESC);
CREATE INDEX idx_spc_alerts_status ON spc_out_of_control_alerts(status, severity);
CREATE INDEX idx_spc_alerts_production_run ON spc_out_of_control_alerts(production_run_id, parameter_code);
CREATE INDEX idx_spc_alerts_parameter ON spc_out_of_control_alerts(parameter_code, alert_timestamp DESC);
```

#### Table Relationships

```plaintext
┌─────────────────────────────────────┐
│ EXISTING TABLES                     │
├─────────────────────────────────────┤
│ production_runs                     │──┐
│ work_centers                        │  │
│ products                            │  │
│ quality_inspections                 │  │
│ sensor_readings                     │  │
│ iot_devices                         │  │
└─────────────────────────────────────┘  │
                                         │
                                         ↓
┌─────────────────────────────────────────────────┐
│ NEW SPC TABLES                                  │
├─────────────────────────────────────────────────┤
│ spc_control_chart_data ←─────────┐              │
│   ↓                               │              │
│ spc_control_limits               │              │
│   ↓                               │              │
│ spc_process_capability           │              │
│   ↓                               │              │
│ spc_out_of_control_alerts ───────┘              │
│   ↓                                              │
│ quality_defects (auto-create from alerts)       │
└─────────────────────────────────────────────────┘
```

### 4.2 Backend Service Architecture

#### New NestJS Module: SPCModule

```typescript
// src/modules/spc/spc.module.ts
@Module({
  imports: [DatabaseModule],
  providers: [
    SPCDataCollectionService,
    SPCControlChartService,
    SPCCapabilityAnalysisService,
    SPCAlertingService,
    SPCStatisticsService,
  ],
  exports: [
    SPCControlChartService,
    SPCCapabilityAnalysisService,
  ],
})
export class SPCModule {}
```

#### Service Responsibilities

**1. SPCDataCollectionService**
```typescript
// Automatic data collection from multiple sources
- collectFromSensorReadings() // IoT integration
- collectFromQualityInspections() // Manual measurements
- collectFromManualEntry() // Operator input
- validateMeasurement() // Data quality checks
- populateControlChartData() // Insert into spc_control_chart_data
```

**2. SPCControlChartService**
```typescript
// Control chart calculations and rendering
- calculateControlLimits(parameter, chartType, sampleData)
  → UCL, CL, LCL using appropriate formulas

- getControlChartData(parameter, dateRange)
  → Data points with limits for visualization

- detectOutOfControlConditions(chartData, limits)
  → Apply 8 Western Electric rules

- updateControlLimits(parameter, recalculationFrequency)
  → Periodic recalculation based on new data
```

**3. SPCCapabilityAnalysisService**
```typescript
// Process capability calculations
- calculateProcessCapability(parameter, dateRange)
  → Cp, Cpk, Pp, Ppk, CPU, CPL

- calculateDefectRate(capability)
  → Expected PPM based on capability indices

- assessCapabilityStatus(cpk)
  → EXCELLENT (Cpk ≥ 2.0)
  → ADEQUATE (1.33 ≤ Cpk < 2.0)
  → MARGINAL (1.0 ≤ Cpk < 1.33)
  → POOR (Cpk < 1.0)

- generateRecommendations(capability)
  → Process centering, variation reduction
```

**4. SPCAlertingService**
```typescript
// Real-time alerting and notifications
- evaluateDataPoint(newMeasurement)
  → Check against all 8 Western Electric rules

- createAlert(rule, severity, chartData)
  → Insert into spc_out_of_control_alerts

- notifyStakeholders(alert)
  → Email, SMS, mobile push notifications
  → Escalation based on severity

- autoCreateDefect(alert)
  → Create quality_defect record for tracking

- acknowledgeAlert(alertId, userId)
- resolveAlert(alertId, userId, rootCause, action)
```

**5. SPCStatisticsService**
```typescript
// Statistical calculations (leverage existing pattern from WMS)
- calculateMean(values[])
- calculateStdDev(values[], sampleType) // 'within' or 'overall'
- calculateRange(values[])
- calculatePercentiles(values[], percentiles[])
- detectOutliers(values[], method) // IQR, Z-score, Modified Z-score
- calculateConfidenceInterval(mean, stdDev, sampleSize, confidence)
- performTTest(group1[], group2[])
- calculateCorrelation(x[], y[], method) // Pearson, Spearman
```

### 4.3 GraphQL API Design

#### New Queries

```graphql
type Query {
  # Control chart data retrieval
  spcControlChartData(
    tenantId: UUID!
    facilityId: UUID
    parameterCode: String!
    chartType: String
    startDate: DateTime
    endDate: DateTime
    productionRunId: UUID
    limit: Int = 1000
  ): [SPCControlChartDataPoint!]!

  # Control limits
  spcControlLimits(
    tenantId: UUID!
    parameterCode: String!
    productId: UUID
    workCenterId: UUID
    asOfDate: Date
  ): SPCControlLimits

  # Process capability analysis
  spcProcessCapability(
    tenantId: UUID!
    parameterCode: String!
    productId: UUID
    workCenterId: UUID
    startDate: DateTime!
    endDate: DateTime!
  ): SPCProcessCapability!

  # Historical capability trends
  spcCapabilityTrends(
    tenantId: UUID!
    parameterCode: String!
    productId: UUID
    startDate: Date!
    endDate: Date!
  ): [SPCProcessCapability!]!

  # Out-of-control alerts
  spcAlerts(
    tenantId: UUID!
    facilityId: UUID
    status: String
    severity: String
    startDate: DateTime
    endDate: DateTime
    limit: Int = 100
  ): [SPCOutOfControlAlert!]!

  # SPC dashboard summary
  spcDashboardSummary(
    tenantId: UUID!
    facilityId: UUID!
    dateRange: DateRangeInput!
  ): SPCDashboardSummary!
}
```

#### New Mutations

```graphql
type Mutation {
  # Manual data entry
  recordSPCMeasurement(
    tenantId: UUID!
    facilityId: UUID!
    parameterCode: String!
    measuredValue: Float!
    productionRunId: UUID
    workCenterId: UUID
    measurementMethod: String
  ): SPCControlChartDataPoint!

  # Control limits management
  createSPCControlLimits(
    input: CreateSPCControlLimitsInput!
  ): SPCControlLimits!

  updateSPCControlLimits(
    id: UUID!
    input: UpdateSPCControlLimitsInput!
  ): SPCControlLimits!

  recalculateSPCControlLimits(
    parameterCode: String!
    tenantId: UUID!
    facilityId: UUID!
    dataRangeInDays: Int = 30
  ): SPCControlLimits!

  # Alert management
  acknowledgeSPCAlert(
    id: UUID!
    userId: UUID!
  ): SPCOutOfControlAlert!

  resolveSPCAlert(
    id: UUID!
    userId: UUID!
    rootCause: String!
    correctiveAction: String!
  ): SPCOutOfControlAlert!

  # Capability analysis trigger
  runCapabilityAnalysis(
    tenantId: UUID!
    parameterCode: String!
    productId: UUID
    startDate: DateTime!
    endDate: DateTime!
  ): SPCProcessCapability!
}
```

#### GraphQL Types

```graphql
type SPCControlChartDataPoint {
  id: UUID!
  tenantId: UUID!
  facilityId: UUID!
  productionRunId: UUID
  workCenterId: UUID
  productId: UUID
  parameterCode: String!
  parameterName: String!
  parameterType: String
  chartType: String!
  measurementTimestamp: DateTime!
  subgroupNumber: Int
  subgroupSize: Int
  measuredValue: Float!
  measurementUnit: String
  operatorUserId: UUID
  measurementMethod: String
  dataSource: String
  createdAt: DateTime!
}

type SPCControlLimits {
  id: UUID!
  tenantId: UUID!
  facilityId: UUID!
  parameterCode: String!
  parameterName: String!
  chartType: String!
  productId: UUID
  workCenterId: UUID
  upperSpecLimit: Float
  lowerSpecLimit: Float
  targetValue: Float
  upperControlLimit: Float!
  centerLine: Float!
  lowerControlLimit: Float
  processMean: Float
  processStdDev: Float
  processRange: Float
  effectiveFrom: Date!
  effectiveTo: Date
  isActive: Boolean!
}

type SPCProcessCapability {
  id: UUID!
  tenantId: UUID!
  facilityId: UUID!
  parameterCode: String!
  parameterName: String!
  productId: UUID
  workCenterId: UUID
  analysisDate: Date!
  analysisPeriodStart: DateTime!
  analysisPeriodEnd: DateTime!
  upperSpecLimit: Float!
  lowerSpecLimit: Float!
  targetValue: Float
  processMean: Float!
  processStdDev: Float!
  sampleSize: Int!
  cp: Float
  cpk: Float
  cpu: Float
  cpl: Float
  pp: Float
  ppk: Float
  k: Float # Centering index
  expectedPpmTotal: Float
  expectedPpmUpper: Float
  expectedPpmLower: Float
  capabilityStatus: String! # EXCELLENT, ADEQUATE, MARGINAL, POOR
  isCentered: Boolean!
  isCapable: Boolean!
  recommendations: String
}

type SPCOutOfControlAlert {
  id: UUID!
  tenantId: UUID!
  facilityId: UUID!
  productionRunId: UUID
  workCenterId: UUID!
  productId: UUID
  alertTimestamp: DateTime!
  parameterCode: String!
  parameterName: String!
  chartType: String
  ruleType: String!
  ruleDescription: String
  measuredValue: Float
  controlLimitViolated: Float
  deviationFromCenter: Float
  sigmaLevel: Float
  severity: String!
  status: String!
  acknowledgedByUserId: UUID
  acknowledgedAt: DateTime
  rootCause: String
  correctiveAction: String
  resolvedByUserId: UUID
  resolvedAt: DateTime
  qualityDefectId: UUID
}

type SPCDashboardSummary {
  totalParametersMonitored: Int!
  parametersInControl: Int!
  parametersOutOfControl: Int!
  openAlerts: Int!
  criticalAlerts: Int!
  avgCpk: Float
  avgCp: Float
  capableProcesses: Int!
  marginalProcesses: Int!
  poorProcesses: Int!
  alertsByRuleType: [AlertCountByRuleType!]!
  topParameters: [ParameterSummary!]!
}

type AlertCountByRuleType {
  ruleType: String!
  count: Int!
}

type ParameterSummary {
  parameterCode: String!
  parameterName: String!
  currentCpk: Float
  alertCount: Int!
  status: String!
}
```

### 4.4 Frontend UI/UX Design

#### Dashboard Enhancements (QualityDashboard.tsx)

**New Widgets:**
```tsx
1. SPC Summary Cards
   - Parameters Monitored (56)
   - In Control (52) [green]
   - Out of Control (4) [red]
   - Avg Cpk (1.67) [green if ≥ 1.33]

2. Real-Time Control Chart Component
   <SPCControlChart
     parameterCode="INK_DENSITY_CYAN"
     chartType="XBAR_R"
     dateRange={last24Hours}
     showLimits={true}
     showRules={true}
     enableRealTimeUpdates={true}
   />

   Features:
   - Auto-refresh every 30 seconds
   - Highlight out-of-control points (red dots)
   - Show violated rules (annotations)
   - UCL/LCL/CL lines with labels
   - Zoom/pan capabilities
   - Export to PDF/PNG

3. Process Capability Widget
   <ProcessCapabilityCard
     parameterCode="REGISTER_ACCURACY"
     productId={productId}
     showHistogram={true}
     showNormalCurve={true}
     showSpecLimits={true}
   />

   Displays:
   - Cp, Cpk, Pp, Ppk values
   - Capability status badge (EXCELLENT/ADEQUATE/MARGINAL/POOR)
   - Histogram of measurements
   - Normal distribution curve overlay
   - Spec limits (USL/LSL) and actual distribution
   - PPM defect estimate

4. Alert Feed Component
   <SPCAlertFeed
     status="OPEN"
     severity={["HIGH", "CRITICAL"]}
     limit={10}
     enableNotifications={true}
   />

   Features:
   - Real-time alert updates (WebSocket)
   - Severity color coding
   - Acknowledge/Resolve actions
   - Link to production run
   - Link to control chart
   - Auto-refresh

5. Parameter Status Grid
   - Grid view of all monitored parameters
   - Status indicator (green/yellow/red)
   - Current value vs. limits
   - Last measurement timestamp
   - Cpk value
   - Alert count (last 24h)
   - Click to drill down to control chart
```

#### New Page: SPCMonitoringDashboard.tsx

```tsx
// Route: /quality/spc-monitoring
<SPCMonitoringDashboard>
  <FacilitySelector />
  <ParameterSelector multiple={true} />
  <DateRangeSelector />

  <Tabs>
    <Tab label="Control Charts">
      <ControlChartsView>
        // Multiple charts in grid layout
        <ControlChartCard parameterCode="INK_DENSITY_CYAN" />
        <ControlChartCard parameterCode="INK_DENSITY_MAGENTA" />
        <ControlChartCard parameterCode="COLOR_DELTA_E" />
        <ControlChartCard parameterCode="REGISTER_ACCURACY" />
      </ControlChartsView>
    </Tab>

    <Tab label="Capability Analysis">
      <CapabilityAnalysisView>
        <CapabilityTable
          columns={['Parameter', 'Cp', 'Cpk', 'Status', 'PPM', 'Actions']}
          sortBy="cpk"
          filterByStatus="all"
        />
        <CapabilityTrendChart
          parameterCode="selected"
          showCpTrend={true}
          showCpkTrend={true}
        />
      </CapabilityAnalysisView>
    </Tab>

    <Tab label="Alerts & Violations">
      <AlertsView>
        <AlertFilters status severity ruleType dateRange />
        <AlertsTable
          columns={['Timestamp', 'Parameter', 'Rule', 'Severity', 'Status', 'Actions']}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
        />
      </AlertsView>
    </Tab>

    <Tab label="Pareto Analysis">
      <ParetoView>
        <ParetoChart
          dataSource="defects" // or "alerts" or "violations"
          groupBy="parameterCode" // or "ruleType" or "severity"
          dateRange={last30Days}
        />
        // 80/20 rule visualization for identifying vital few problems
      </ParetoView>
    </Tab>
  </Tabs>
</SPCMonitoringDashboard>
```

#### New Page: ProcessCapabilityStudy.tsx

```tsx
// Route: /quality/capability-study
<ProcessCapabilityStudy>
  <StudyConfiguration>
    <ParameterSelector />
    <ProductSelector />
    <WorkCenterSelector />
    <DateRangeSelector />
    <RunAnalysisButton />
  </StudyConfiguration>

  <StudyResults>
    <StatisticsSummary
      mean stdDev range
      sampleSize subgroups
    />

    <CapabilityIndices
      cp cpk cpu cpl
      pp ppk
      k (centering)
    />

    <HistogramWithCurve
      showNormalCurve={true}
      showSpecLimits={true}
      showProcessLimits={true}
    />

    <ControlCharts
      xBarChart={true}
      rChart={true}
      iMrChart={true}
    />

    <DefectEstimates
      expectedPPM
      ppmUpper ppmLower
      sigmaLevel
    />

    <Recommendations>
      - Process centering needed
      - Reduce variation (improve Cp)
      - Investigate special causes
    </Recommendations>

    <ExportOptions>
      <ExportPDFButton />
      <ExportExcelButton />
      <PrintReportButton />
    </ExportOptions>
  </StudyResults>
</ProcessCapabilityStudy>
```

### 4.5 Real-Time Data Integration

#### WebSocket Integration

```typescript
// Backend: SPCGateway (WebSocket Gateway)
@WebSocketGateway({ namespace: '/spc' })
export class SPCGateway {
  @WebSocketServer()
  server: Server;

  // Emit new measurement to connected clients
  emitNewMeasurement(measurement: SPCControlChartDataPoint) {
    this.server.emit('spc:measurement', measurement);
  }

  // Emit new alert to connected clients
  emitNewAlert(alert: SPCOutOfControlAlert) {
    this.server.emit('spc:alert', alert);
  }

  // Subscribe to parameter updates
  @SubscribeMessage('spc:subscribe:parameter')
  subscribeToParameter(
    @MessageBody() { parameterCode }: { parameterCode: string },
    @ConnectedSocket() client: Socket
  ) {
    client.join(`parameter:${parameterCode}`);
  }
}

// Frontend: useRealTimeSPC Hook
export function useRealTimeSPC(parameterCode: string) {
  const [measurements, setMeasurements] = useState<SPCDataPoint[]>([]);
  const [alerts, setAlerts] = useState<SPCAlert[]>([]);

  useEffect(() => {
    const socket = io('ws://localhost:3000/spc');

    socket.emit('spc:subscribe:parameter', { parameterCode });

    socket.on('spc:measurement', (measurement) => {
      if (measurement.parameterCode === parameterCode) {
        setMeasurements(prev => [...prev, measurement]);
      }
    });

    socket.on('spc:alert', (alert) => {
      if (alert.parameterCode === parameterCode) {
        setAlerts(prev => [...prev, alert]);
        // Show toast notification
        toast.error(`SPC Alert: ${alert.ruleDescription}`);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [parameterCode]);

  return { measurements, alerts };
}
```

#### IoT Sensor Integration Pattern

```typescript
// Automatic data collection from IoT sensors
@Injectable()
export class SPCDataCollectionService {
  // Listen to sensor_readings inserts (via pg_notify or polling)
  async onNewSensorReading(reading: SensorReading) {
    // Map sensor type to SPC parameter
    const spcParameter = this.mapSensorToSPCParameter(reading.sensor_type);

    if (spcParameter) {
      // Create control chart data point
      await this.createSPCDataPoint({
        tenantId: reading.tenant_id,
        facilityId: reading.facility_id,
        parameterCode: spcParameter.code,
        parameterName: spcParameter.name,
        parameterType: spcParameter.type,
        chartType: spcParameter.defaultChartType,
        measurementTimestamp: reading.reading_timestamp,
        measuredValue: reading.reading_value,
        measurementUnit: reading.unit_of_measure,
        dataSource: 'IOT_SENSOR',
        sensorReadingId: reading.id,
        measurementDeviceId: reading.iot_device_id,
        productionRunId: reading.production_run_id,
      });

      // Check for out-of-control conditions
      await this.spcAlertingService.evaluateDataPoint(dataPoint);
    }
  }

  private mapSensorToSPCParameter(sensorType: string): SPCParameterConfig | null {
    const mapping = {
      'INK_DENSITY': {
        code: 'INK_DENSITY_CYAN',
        name: 'Cyan Ink Density',
        type: 'INK_DENSITY',
        defaultChartType: 'I_MR',
      },
      'COLOR_DELTA_E': {
        code: 'COLOR_DELTA_E',
        name: 'Color Delta E (ΔE2000)',
        type: 'COLOR_VARIATION',
        defaultChartType: 'I_MR',
      },
      'REGISTER': {
        code: 'REGISTER_ACCURACY',
        name: 'Registration Accuracy',
        type: 'REGISTER',
        defaultChartType: 'XBAR_R',
      },
      // ... more mappings
    };

    return mapping[sensorType] || null;
  }
}
```

---

## 5. IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Weeks 1-2)
- ✅ **Database Migration**
  - Create 4 SPC tables (V0.0.40__create_spc_tables.sql)
  - Add indexes and constraints
  - Create database functions for statistics

- ✅ **NestJS Module Setup**
  - Create SPCModule
  - Implement SPCStatisticsService (leverage WMS pattern)
  - Implement SPCDataCollectionService (IoT integration)

- ✅ **Basic GraphQL API**
  - Define GraphQL types and schemas
  - Implement basic queries (spcControlChartData, spcControlLimits)
  - Implement basic mutations (recordSPCMeasurement, createSPCControlLimits)

### Phase 2: Control Charts (Weeks 3-4)
- ✅ **SPCControlChartService**
  - Implement control limit calculations (UCL/CL/LCL)
  - Support 3 primary chart types: X-bar & R, I-MR, p-Chart
  - Implement Western Electric rules (all 8 rules)

- ✅ **SPCAlertingService**
  - Out-of-control detection
  - Alert creation and notification
  - Auto-create quality defects for critical alerts

- ✅ **Frontend Control Charts**
  - ControlChart component (using recharts or D3)
  - Real-time data updates (WebSocket)
  - Interactive features (zoom, pan, export)

### Phase 3: Capability Analysis (Weeks 5-6)
- ✅ **SPCCapabilityAnalysisService**
  - Calculate Cp, Cpk, Pp, Ppk
  - Defect rate estimation (PPM)
  - Capability status assessment
  - Generate recommendations

- ✅ **Frontend Capability UI**
  - ProcessCapabilityStudy page
  - Capability dashboard widgets
  - Histogram with normal curve
  - Trend analysis charts

### Phase 4: Advanced Features (Weeks 7-8)
- ✅ **Additional Chart Types**
  - c-Chart (count of defects)
  - u-Chart (defects per unit)
  - np-Chart (number of defectives)
  - X-bar & S Chart (standard deviation)

- ✅ **Advanced Analytics**
  - Pareto analysis
  - Correlation analysis (parameter interactions)
  - Trend detection
  - Seasonality analysis

- ✅ **Measurement System Analysis (MSA)**
  - Gage R&R studies
  - Repeatability and reproducibility
  - Bias and linearity

### Phase 5: Print-Specific Customization (Weeks 9-10)
- ✅ **G7/GRACoL Integration**
  - Predefined parameters for G7 compliance
  - ΔE2000 color difference calculations
  - Solid ink density presets
  - Dot gain targets by substrate

- ✅ **ISO 12647-2 Templates**
  - Offset lithography parameter templates
  - Control strip measurement automation
  - Compliance reporting

- ✅ **Print Job Templates**
  - Per-product SPC configurations
  - Press-specific control limits
  - Substrate-specific capability studies

### Phase 6: Testing & Deployment (Weeks 11-12)
- ✅ **Unit Testing**
  - SPCStatisticsService tests (all calculations)
  - Control chart calculation tests
  - Western Electric rules tests

- ✅ **Integration Testing**
  - IoT sensor → SPC data flow
  - Quality inspection → SPC data flow
  - Alert → notification → defect creation

- ✅ **User Acceptance Testing**
  - Quality manager workflows
  - Operator data entry
  - Alert response procedures

- ✅ **Documentation**
  - User manual (control charts, capability analysis)
  - API documentation (GraphQL)
  - Administrator guide (control limit setup)

---

## 6. SUCCESS METRICS

### Technical Metrics
- **Data Collection Latency:** < 5 seconds (sensor to control chart)
- **Alert Response Time:** < 10 seconds (out-of-control to notification)
- **Control Chart Rendering:** < 2 seconds (1000 data points)
- **Capability Calculation:** < 5 seconds (10,000 measurements)
- **System Uptime:** 99.9%
- **API Response Time:** < 500ms (p95)

### Business Metrics
- **Defect Rate Reduction:** 25% improvement within 6 months
- **First Pass Yield (FPY):** Increase from 95% to 98%
- **Process Capability:** 80% of parameters with Cpk ≥ 1.33
- **Customer Rejections:** 50% reduction within 12 months
- **Cost of Quality (COQ):** 30% reduction in scrap and rework
- **Mean Time to Detect (MTTD):** < 15 minutes for out-of-control conditions
- **Mean Time to Resolve (MTTR):** < 2 hours for critical quality issues

### User Adoption Metrics
- **Active Users:** 80% of quality personnel within 3 months
- **Daily Control Chart Views:** 500+ views/day
- **Alert Acknowledgment Time:** < 30 minutes (avg)
- **Capability Studies Conducted:** 50+ studies/month
- **User Satisfaction:** 4.5/5 stars

---

## 7. RISKS & MITIGATION

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Statistical calculation errors** | HIGH | MEDIUM | Extensive unit testing, compare with R/Minitab, peer review by statistical experts |
| **Real-time data latency** | MEDIUM | MEDIUM | Optimize database queries, use materialized views, implement caching |
| **Sensor data quality issues** | HIGH | MEDIUM | Data validation layer, outlier detection, sensor calibration tracking |
| **False positive alerts** | MEDIUM | HIGH | Tune Western Electric rules, implement confirmatory logic, user feedback loop |
| **Scalability with high-frequency data** | MEDIUM | LOW | Table partitioning by date, time-series database (TimescaleDB), data aggregation |

### Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **User resistance to SPC adoption** | HIGH | MEDIUM | Comprehensive training, demonstrate quick wins, executive sponsorship |
| **Insufficient operator buy-in** | MEDIUM | MEDIUM | Involve operators in design, simplify data entry, show benefits |
| **Overwhelming alert volume** | MEDIUM | HIGH | Start with critical parameters only, phase rollout, tune sensitivity |
| **Lack of statistical expertise** | MEDIUM | MEDIUM | Train power users, provide templates, partner with quality consultants |

---

## 8. DEPENDENCIES & PREREQUISITES

### External Dependencies
- **IoT Infrastructure:** Requires sensor_readings table to be populated
- **Production System:** Requires production_runs to be tracked
- **Quality Inspection Workflow:** Requires quality_inspections to be operational

### Technical Prerequisites
- PostgreSQL ≥ 14 (for JSONB, window functions, CTEs)
- NestJS ≥ 10.x
- GraphQL Code Generator
- Chart visualization library (Recharts or D3.js)
- WebSocket support (Socket.io)
- Background job processing (Bull/BullMQ for periodic calculations)

### Data Prerequisites
- **Historical Data:** 30+ days of measurement data for initial control limits
- **Specification Limits:** USL/LSL for each parameter (from customer/standards)
- **Calibration Records:** IoT device calibration status and history
- **Parameter Definitions:** Clear definitions of all measurable parameters

---

## 9. RECOMMENDATIONS

### Immediate Next Steps (Week 1)
1. **Marcus (Full Stack Developer):** Review this research document
2. **Marcus:** Create V0.0.40__create_spc_tables.sql migration
3. **Marcus:** Implement SPCModule and SPCStatisticsService
4. **Cynthia (Support):** Develop SPC parameter catalog for print industry
5. **Priya (Statistics):** Validate statistical formulas and algorithms
6. **Billy (QA):** Create test plan for SPC functionality

### Architecture Decisions Required
1. **Chart Library:** Recharts vs. D3.js vs. Chart.js (recommend: Recharts for simplicity)
2. **Real-time Strategy:** WebSocket vs. Server-Sent Events vs. Polling (recommend: WebSocket)
3. **Time-series Database:** PostgreSQL vs. TimescaleDB (recommend: Start with PostgreSQL, migrate to TimescaleDB if needed)
4. **Background Jobs:** Bull vs. BullMQ vs. node-cron (recommend: BullMQ for reliability)

### Long-term Enhancements (Post-Phase 6)
1. **Machine Learning Integration:**
   - Predictive control limits (adapt based on trends)
   - Anomaly detection (beyond Western Electric rules)
   - Root cause analysis (correlate parameters)

2. **Mobile App:**
   - Real-time alerts on mobile devices
   - Mobile data entry for inspections
   - Push notifications for critical events

3. **Advanced Visualizations:**
   - 3D capability surfaces (multiple parameters)
   - Interactive Pareto drilldowns
   - Heat maps for parameter correlations

4. **Industry Certifications:**
   - G7 Master Printer certification support
   - ISO 12647-2 compliance reporting
   - Customer-specific quality reports (automotive, pharmaceutical)

---

## 10. CONCLUSION

The implementation of Statistical Process Control (SPC) capabilities will transform the quality management system from reactive defect tracking to proactive process monitoring and continuous improvement. By leveraging the existing quality infrastructure and proven statistical analysis patterns from the WMS module, we can deliver a comprehensive SPC solution that meets print industry standards (G7, ISO 12647-2) while providing real-time insights and automated alerting.

The phased implementation approach minimizes risk while delivering incremental value. Phase 1 establishes the foundation, Phase 2 delivers critical control charts, Phase 3 adds capability analysis, and subsequent phases expand functionality and customization.

**Critical Success Factors:**
1. ✅ **Strong Foundation:** Existing quality tables and IoT infrastructure
2. ✅ **Proven Patterns:** Statistical analysis framework from WMS module
3. ✅ **Clear Requirements:** Well-defined print industry standards
4. ⚠️ **User Training:** Comprehensive training on SPC concepts
5. ⚠️ **Data Quality:** Ensure sensor calibration and data integrity

**Go/No-Go Recommendation:** ✅ **GO**
This feature is strategically important for competitive differentiation in the print industry ERP market. The technical foundation is strong, risks are manageable, and ROI is clear (25% defect reduction, 50% customer rejection reduction).

---

## RESEARCH ARTIFACTS

### Code References
- `backend/database/schemas/quality-hr-iot-security-marketplace-imposition-module.sql` (lines 14-211)
- `backend/migrations/V0.0.7__create_quality_hr_iot_security_marketplace_imposition.sql` (lines 16-215)
- `backend/src/modules/quality/quality.module.ts` (entire file)
- `backend/src/graphql/resolvers/quality-hr-iot-security-marketplace-imposition.resolver.ts` (lines 29-1169)
- `backend/src/modules/wms/services/bin-utilization-statistical-analysis.service.ts` (lines 1-150)
- `backend/migrations/V0.0.22__bin_utilization_statistical_analysis.sql` (lines 1-100)
- `frontend/src/graphql/queries/quality.ts` (entire file)
- `frontend/src/pages/QualityDashboard.tsx` (entire file)

### Industry Standards Referenced
- G7/GRACoL - Graphic Communications Association color standards
- ISO 12647-2 - Process control for offset lithographic processes
- ISO 9001 - Quality management systems
- ANSI/ASQ Z1.4 - Sampling procedures and tables for inspection by attributes
- Western Electric Rules - Control chart interpretation rules
- Six Sigma methodology - Process capability standards (Cpk ≥ 1.33)

### Statistical Methods Catalog
- Descriptive Statistics: Mean, Median, Standard Deviation, Range, Percentiles
- Control Charts: X-bar & R, X-bar & S, I-MR, p, np, c, u
- Capability Indices: Cp, Cpk, Pp, Ppk, CPU, CPL, k (centering)
- Hypothesis Testing: t-tests, chi-square tests, ANOVA
- Correlation Analysis: Pearson, Spearman
- Regression Analysis: Linear regression, multiple regression
- Outlier Detection: IQR method, Z-score, Modified Z-score
- Time-series Analysis: Trend detection, seasonality

---

**END OF RESEARCH DELIVERABLE**

---

**Next Action:** Marcus to proceed with Phase 1 implementation (database migration + NestJS module setup)
