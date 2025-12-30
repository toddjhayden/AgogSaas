# RESEARCH DELIVERABLE: INVENTORY FORECASTING
## REQ-STRATEGIC-AUTO-1766639534835

**Research Analyst:** CYNTHIA
**Date:** 2025-12-27
**Status:** COMPLETE
**Phase:** Phase 1 Foundation - Statistical Forecasting Methods

---

## EXECUTIVE SUMMARY

I have completed comprehensive research on the Inventory Forecasting feature implementation for the AGOG Print Industry ERP system. This deliverable documents the complete architecture, algorithms, database design, API specifications, and integration points for the forecasting system.

**Key Findings:**
- **Implementation Status:** Phase 1 Complete with 3 forecasting algorithms (Moving Average, Exponential Smoothing, Holt-Winters)
- **Database Schema:** 5 core tables with full row-level security and comprehensive indexing
- **API Coverage:** 6 GraphQL queries and 5 mutations for complete forecasting lifecycle
- **Test Status:** CONDITIONAL PASS - 2 critical bugs identified in Holt-Winters and Safety Stock calculations
- **Deployment Status:** Partial deployment completed, resolver architecture converted to Apollo Server pattern

**Critical Issues Identified:**
1. **P0 Bug:** Holt-Winters algorithm generates zero forecasts after day 63
2. **P0 Bug:** Safety Stock calculation has SQL syntax error
3. **Infrastructure:** Database migration V0.0.30 requires manual application

**Production Readiness:**
- ✅ Moving Average algorithm: READY
- ✅ Exponential Smoothing algorithm: READY
- ❌ Holt-Winters algorithm: NOT READY (requires fix)
- ❌ Safety Stock calculation: NOT READY (requires fix)

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema Design](#2-database-schema-design)
3. [Forecasting Algorithms](#3-forecasting-algorithms)
4. [Safety Stock & Inventory Planning](#4-safety-stock--inventory-planning)
5. [GraphQL API Specification](#5-graphql-api-specification)
6. [Service Layer Architecture](#6-service-layer-architecture)
7. [Frontend Implementation](#7-frontend-implementation)
8. [Integration Points](#8-integration-points)
9. [Performance & Scalability](#9-performance--scalability)
10. [Security & Multi-Tenancy](#10-security--multi-tenancy)
11. [Testing & Quality Assurance](#11-testing--quality-assurance)
12. [Deployment & Operations](#12-deployment--operations)
13. [Future Enhancements](#13-future-enhancements)
14. [Recommendations](#14-recommendations)

---

## 1. ARCHITECTURE OVERVIEW

### 1.1 System Architecture

The Inventory Forecasting system follows a layered architecture pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  InventoryForecastingDashboard.tsx                   │   │
│  │  - Forecast visualization charts                     │   │
│  │  - Accuracy metrics display                          │   │
│  │  - Replenishment recommendations                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ GraphQL Queries/Mutations
┌─────────────────────────────────────────────────────────────┐
│                    GraphQL API Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  forecasting.resolver.ts (Apollo Server Pattern)     │   │
│  │  - 6 Queries (getDemandHistory, getMaterialForecasts)│   │
│  │  - 5 Mutations (generateForecasts, recordDemand)     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ Service Calls
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│  ┌──────────────────┬──────────────────┬─────────────────┐  │
│  │ Demand History   │ Forecasting      │ Safety Stock    │  │
│  │ Service          │ Service          │ Service         │  │
│  ├──────────────────┼──────────────────┼─────────────────┤  │
│  │ Forecast         │ Replenishment    │                 │  │
│  │ Accuracy Service │ Service          │                 │  │
│  └──────────────────┴──────────────────┴─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ SQL Queries
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer (PostgreSQL)                   │
│  ┌──────────────────┬──────────────────┬─────────────────┐  │
│  │ demand_history   │ material_        │ forecast_models │  │
│  │                  │ forecasts        │                 │  │
│  ├──────────────────┼──────────────────┼─────────────────┤  │
│  │ forecast_        │ replenishment_   │                 │  │
│  │ accuracy_metrics │ suggestions      │                 │  │
│  └──────────────────┴──────────────────┴─────────────────┘  │
│  + Row-Level Security + Indexes + Constraints               │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

**Backend:**
- Runtime: Node.js 20.x
- Framework: NestJS (services) + Apollo Server (GraphQL)
- Language: TypeScript 5.x
- Database: PostgreSQL 15.x with TimescaleDB extensions
- Migration Tool: Flyway

**Frontend:**
- Framework: React 18.x
- GraphQL Client: Apollo Client
- Charting: Recharts
- State Management: React Context + Apollo Cache

**Algorithms:**
- Moving Average (JavaScript/TypeScript)
- Simple Exponential Smoothing (JavaScript/TypeScript)
- Holt-Winters Seasonal (JavaScript/TypeScript)
- Future: SARIMA (Python/statsmodels), LightGBM (Python/scikit-learn)

### 1.3 Module Structure

**Location:** `print-industry-erp/backend/src/modules/forecasting/`

```
forecasting/
├── forecasting.module.ts          # NestJS module definition
├── README.md                       # Module documentation
├── dto/
│   └── forecast.types.ts          # TypeScript interfaces & enums
├── services/
│   ├── demand-history.service.ts
│   ├── forecasting.service.ts
│   ├── safety-stock.service.ts
│   ├── forecast-accuracy.service.ts
│   └── replenishment-recommendation.service.ts
└── [tests/]                        # Unit tests (future)
```

---

## 2. DATABASE SCHEMA DESIGN

### 2.1 Schema Overview

**Migration File:** `V0.0.32__create_inventory_forecasting_tables.sql` (originally V0.0.30)
**Tables Created:** 5 core tables
**Material Table Extensions:** 7 new columns added to `materials` table
**Row-Level Security:** Enabled on all tables with tenant isolation policies

### 2.2 Core Tables

#### 2.2.1 demand_history

**Purpose:** Historical demand tracking for forecasting algorithms

**Key Fields:**
- `demand_history_id` (UUID v7) - Primary key
- Time dimensions: `demand_date`, `year`, `month`, `week_of_year`, `day_of_week`, `quarter`
- Demand tracking: `actual_demand_quantity`, `forecasted_demand_quantity`, `demand_uom`
- Source disaggregation: `sales_order_demand`, `production_order_demand`, `transfer_order_demand`, `scrap_adjustment`
- External factors: `avg_unit_price`, `promotional_discount_pct`, `marketing_campaign_active`, `is_holiday`, `is_promotional_period`
- Accuracy metrics: `forecast_error`, `absolute_percentage_error`

**Constraints:**
- Unique: `(tenant_id, facility_id, material_id, demand_date)`
- Check: `actual_demand_quantity >= 0`

**Indexes:**
- `idx_demand_history_tenant_facility` - (tenant_id, facility_id)
- `idx_demand_history_material` - (material_id)
- `idx_demand_history_date` - (demand_date DESC)
- `idx_demand_history_material_date_range` - (material_id, demand_date)

**Row-Level Security:**
```sql
CREATE POLICY tenant_isolation_demand_history ON demand_history
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
```

**Data Flow:**
1. Demand recorded via `recordDemand()` mutation
2. Auto-populated from `inventory_transactions` via `backfillDemandHistory()`
3. Forecasted quantities updated post-forecast generation
4. Used as input for forecasting algorithms

#### 2.2.2 material_forecasts

**Purpose:** Generated demand forecasts with confidence intervals

**Key Fields:**
- `forecast_id` (UUID v7) - Primary key
- Forecast metadata: `forecast_generation_timestamp`, `forecast_version`, `forecast_algorithm`, `forecast_horizon_type`
- Forecast values: `forecasted_demand_quantity`, `forecast_uom`
- Confidence intervals: `lower_bound_80_pct`, `upper_bound_80_pct`, `lower_bound_95_pct`, `upper_bound_95_pct`
- Manual overrides: `is_manually_overridden`, `manual_override_quantity`, `manual_override_by`, `manual_override_reason`
- Status: `forecast_status` (ACTIVE, SUPERSEDED, REJECTED)

**Constraints:**
- Unique: `(tenant_id, facility_id, material_id, forecast_date, forecast_version)`
- Check: `model_confidence_score BETWEEN 0 AND 1`

**Indexes:**
- `idx_material_forecasts_tenant_facility` - (tenant_id, facility_id)
- `idx_material_forecasts_material` - (material_id)
- `idx_material_forecasts_date` - (forecast_date)
- `idx_material_forecasts_status` - (forecast_status)
- `idx_material_forecasts_material_date_range` - (material_id, forecast_date)
- `idx_material_forecasts_active` - (material_id, forecast_date) WHERE forecast_status = 'ACTIVE' (PARTIAL)

**Versioning Strategy:**
- Each forecast generation increments `forecast_version`
- Previous forecasts marked as `SUPERSEDED`
- Allows historical tracking of forecast evolution

#### 2.2.3 forecast_models

**Purpose:** Forecasting model metadata and performance tracking

**Key Fields:**
- `forecast_model_id` (UUID v7) - Primary key
- Model identification: `model_name`, `model_algorithm`, `model_version`
- Training metadata: `training_start_date`, `training_end_date`, `training_sample_size`, `training_timestamp`
- Model parameters: `model_hyperparameters` (JSONB), `feature_list` (JSONB)
- Performance metrics: `backtest_mape`, `backtest_rmse`, `backtest_mae`, `backtest_bias`, `backtest_r_squared`
- Model artifact: `model_artifact_path`, `model_artifact_size_bytes`

**Supported Algorithms:**
- MOVING_AVERAGE
- EXP_SMOOTHING
- HOLT_WINTERS
- SARIMA (future)
- LIGHTGBM (future)

**Indexes:**
- `idx_forecast_models_tenant_facility` - (tenant_id, facility_id)
- `idx_forecast_models_material` - (material_id)
- `idx_forecast_models_algorithm` - (model_algorithm)
- `idx_forecast_models_status` - (model_status)

**Use Cases:**
- Model versioning and auditability
- Performance comparison across algorithms
- Model artifact storage (for ML models)
- Auto-selection based on historical performance

#### 2.2.4 forecast_accuracy_metrics

**Purpose:** Aggregated forecast accuracy metrics calculated periodically

**Key Fields:**
- `metric_id` (UUID v7) - Primary key
- Time period: `measurement_period_start`, `measurement_period_end`, `aggregation_level`
- Accuracy metrics: `mape`, `rmse`, `mae`, `bias`, `tracking_signal`
- Sample statistics: `sample_size`, `total_actual_demand`, `total_forecasted_demand`
- Performance flags: `is_within_tolerance`, `target_mape_threshold`

**Aggregation Levels:**
- DAILY
- WEEKLY
- MONTHLY
- QUARTERLY

**Metrics Definitions:**
- **MAPE:** Mean Absolute Percentage Error - `(1/n) × Σ |Actual - Forecast| / Actual × 100%`
- **RMSE:** Root Mean Squared Error - `√((1/n) × Σ (Actual - Forecast)²)`
- **MAE:** Mean Absolute Error - `(1/n) × Σ |Actual - Forecast|`
- **Bias:** Mean Forecast Error - `(1/n) × Σ (Forecast - Actual)`
- **Tracking Signal:** Cumulative Forecast Error / MAD

**Indexes:**
- `idx_forecast_accuracy_tenant_facility` - (tenant_id, facility_id)
- `idx_forecast_accuracy_material` - (material_id)
- `idx_forecast_accuracy_period` - (measurement_period_start, measurement_period_end)
- `idx_forecast_accuracy_material_period` - (material_id, measurement_period_end DESC)

#### 2.2.5 replenishment_suggestions

**Purpose:** System-generated purchase order suggestions based on forecasts and inventory levels

**Key Fields:**
- `suggestion_id` (UUID v7) - Primary key
- Inventory snapshot: `current_on_hand_quantity`, `current_allocated_quantity`, `current_available_quantity`, `current_on_order_quantity`
- Planning parameters: `safety_stock_quantity`, `reorder_point_quantity`, `economic_order_quantity`
- Forecast integration: `forecasted_demand_30_days`, `forecasted_demand_60_days`, `forecasted_demand_90_days`
- Recommendation: `recommended_order_quantity`, `recommended_order_date`, `recommended_delivery_date`
- Vendor info: `preferred_vendor_id`, `estimated_unit_cost`, `vendor_lead_time_days`
- Justification: `suggestion_reason`, `calculation_method`

**Status Workflow:**
```
PENDING → APPROVED → CONVERTED_TO_PO
        ↓
      REJECTED
        ↓
      EXPIRED
```

**Indexes:**
- `idx_replenishment_suggestions_tenant_facility` - (tenant_id, facility_id)
- `idx_replenishment_suggestions_material` - (material_id)
- `idx_replenishment_suggestions_status` - (suggestion_status)
- `idx_replenishment_suggestions_vendor` - (preferred_vendor_id)
- `idx_replenishment_suggestions_order_date` - (recommended_order_date)
- `idx_replenishment_suggestions_stockout_date` - (projected_stockout_date ASC) WHERE suggestion_status = 'PENDING' (PARTIAL)

### 2.3 Material Table Extensions

**Columns Added to `materials` Table:**

```sql
ALTER TABLE materials ADD COLUMN IF NOT EXISTS forecasting_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS forecast_algorithm VARCHAR(50) DEFAULT 'AUTO';
ALTER TABLE materials ADD COLUMN IF NOT EXISTS forecast_horizon_days INTEGER DEFAULT 90;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS forecast_update_frequency VARCHAR(20) DEFAULT 'WEEKLY';
ALTER TABLE materials ADD COLUMN IF NOT EXISTS minimum_forecast_history_days INTEGER DEFAULT 90;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS target_forecast_accuracy_pct DECIMAL(5,2) DEFAULT 20.00;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS demand_pattern VARCHAR(20);
```

**Demand Pattern Classifications:**
- `STABLE` - Low variability, predictable demand
- `SEASONAL` - Repeating seasonal patterns
- `INTERMITTENT` - Sporadic demand with zero periods
- `LUMPY` - Large infrequent orders
- `ERRATIC` - High variability, unpredictable

### 2.4 Data Volume Estimates

**Assumptions:**
- 1,000 materials
- 90 days demand history per material
- 30-day forecast horizon
- Daily forecast generation for A-class, weekly for B/C-class

**Table Size Estimates:**

| Table | Records/Year | Storage/Record | Total Size/Year |
|-------|--------------|----------------|-----------------|
| demand_history | 365,000 | 500 bytes | 183 MB |
| material_forecasts | 10,950,000 | 400 bytes | 4.4 GB |
| forecast_models | 12,000 | 1,000 bytes | 12 MB |
| forecast_accuracy_metrics | 48,000 | 300 bytes | 14 MB |
| replenishment_suggestions | 730,000 | 600 bytes | 438 MB |
| **TOTAL** | | | **5.0 GB/year** |

**Partitioning Strategy (Future):**
- Partition `material_forecasts` by `forecast_date` (monthly partitions)
- Partition `demand_history` by `demand_date` (monthly partitions)
- Archive old forecasts (>1 year) to cold storage

---

## 3. FORECASTING ALGORITHMS

### 3.1 Algorithm Selection Logic

**Function:** `ForecastingService.selectAlgorithm()`

**Selection Criteria:**

```typescript
// 1. Check for explicit algorithm request
if (requestedAlgorithm && requestedAlgorithm !== 'AUTO') {
  return requestedAlgorithm;
}

// 2. Calculate coefficient of variation (CV)
const cv = stdDev / mean;

// 3. Detect seasonality
const isSeasonal = detectSeasonality(demandHistory);

// 4. Select algorithm based on data characteristics
if (isSeasonal && demandHistory.length >= 60) {
  return 'HOLT_WINTERS';  // Seasonal pattern with sufficient data
} else if (cv > 0.3) {
  return 'EXP_SMOOTHING';  // High variability
} else {
  return 'MOVING_AVERAGE';  // Stable demand
}
```

### 3.2 Moving Average (MA)

**Implementation:** `ForecastingService.generateMovingAverageForecast()`

**Algorithm:**
```typescript
// Configuration
const windowSize = 30;  // 30-day moving average

// Calculate average demand
const recentDemands = demandHistory
  .slice(-windowSize)
  .map(d => d.actualDemandQuantity);

const avgDemand = recentDemands.reduce((sum, val) => sum + val, 0) / recentDemands.length;

// Calculate standard deviation for confidence intervals
const variance = recentDemands.reduce((sum, val) =>
  sum + Math.pow(val - avgDemand, 2), 0) / recentDemands.length;
const stdDev = Math.sqrt(variance);

// Generate forecasts for each day in horizon
for (let day = 1; day <= horizonDays; day++) {
  const forecastDate = new Date(startDate);
  forecastDate.setDate(forecastDate.getDate() + day);

  forecasts.push({
    forecastDate: forecastDate,
    forecastedDemandQuantity: avgDemand,
    lowerBound80Pct: avgDemand - 1.28 * stdDev,  // 80% confidence
    upperBound80Pct: avgDemand + 1.28 * stdDev,
    lowerBound95Pct: avgDemand - 1.96 * stdDev,  // 95% confidence
    upperBound95Pct: avgDemand + 1.96 * stdDev,
    modelConfidenceScore: 0.70,
    forecastAlgorithm: 'MOVING_AVERAGE'
  });
}
```

**Characteristics:**
- **Best for:** Stable demand patterns with low variability
- **Confidence Score:** 0.70
- **Pros:** Simple, easy to interpret, no parameters to tune
- **Cons:** Does not capture trends or seasonality, lags behind demand changes
- **Expected MAPE:** 10-15% for stable materials

**Test Results (BILLY QA Report):**
- ✅ PASSED - All tests successful
- Response time: 0.064 seconds (target: <2s)
- Forecast value: 99.9356 units (expected: ~100)
- Confidence interval width: ±3.74 units (appropriate for stable demand)

### 3.3 Simple Exponential Smoothing (SES)

**Implementation:** `ForecastingService.generateExponentialSmoothingForecast()`

**Algorithm:**
```typescript
// Configuration
const alpha = 0.3;  // Smoothing parameter (0 < α < 1)

// Initialize smoothed value
let smoothed = demandHistory[0].actualDemandQuantity;

// Apply exponential smoothing
for (let i = 1; i < demandHistory.length; i++) {
  smoothed = alpha * demandHistory[i].actualDemandQuantity + (1 - alpha) * smoothed;
}

// Calculate mean squared error for confidence intervals
let mse = 0;
let tempSmoothed = demandHistory[0].actualDemandQuantity;
for (let i = 1; i < demandHistory.length; i++) {
  const error = demandHistory[i].actualDemandQuantity - tempSmoothed;
  mse += error * error;
  tempSmoothed = alpha * demandHistory[i].actualDemandQuantity + (1 - alpha) * tempSmoothed;
}
mse = mse / (demandHistory.length - 1);
const rmse = Math.sqrt(mse);

// Generate forecasts
for (let day = 1; day <= horizonDays; day++) {
  const forecastDate = new Date(startDate);
  forecastDate.setDate(forecastDate.getDate() + day);

  forecasts.push({
    forecastDate: forecastDate,
    forecastedDemandQuantity: smoothed,
    lowerBound80Pct: smoothed - 1.28 * rmse,
    upperBound80Pct: smoothed + 1.28 * rmse,
    lowerBound95Pct: smoothed - 1.96 * rmse,
    upperBound95Pct: smoothed + 1.96 * rmse,
    modelConfidenceScore: 0.75,
    forecastAlgorithm: 'EXP_SMOOTHING'
  });
}
```

**Characteristics:**
- **Best for:** Variable demand patterns with trend
- **Confidence Score:** 0.75
- **Alpha Parameter:** 0.3 (weights recent demand more heavily)
- **Pros:** Adapts to demand changes, simple to implement
- **Cons:** Does not capture seasonality, all forecasts identical (no trend continuation)
- **Expected MAPE:** 15-20% for trending materials

**Test Results (BILLY QA Report):**
- ✅ PASSED - All tests successful
- Response time: 0.041 seconds (target: <2s)
- Forecast value: 121.8295 units (expected: ~120-122 for upward trend)
- Algorithm correctly detects upward trend

**Note:** Implementation is Single Exponential Smoothing rather than Double (Holt's method). Future enhancement could add trend component for better trending forecasts.

### 3.4 Holt-Winters Seasonal

**Implementation:** `ForecastingService.generateHoltWintersForecast()`

**Algorithm:**
```typescript
// Configuration
const alpha = 0.2;  // Level smoothing
const beta = 0.1;   // Trend smoothing
const gamma = 0.1;  // Seasonal smoothing

// 1. Detect seasonal period
const seasonalPeriod = detectSeasonalPeriod(demandHistory);  // 7, 30, 90, 180, 365 days

// 2. Initialize components
let level = demandHistory[0].actualDemandQuantity;
let trend = 0;
const seasonal = new Array(seasonalPeriod).fill(0);

// Initialize seasonal indices
for (let i = 0; i < seasonalPeriod && i < demandHistory.length; i++) {
  seasonal[i] = demandHistory[i].actualDemandQuantity / level;
}

// 3. Update components for each historical point
for (let t = 1; t < demandHistory.length; t++) {
  const seasonalIndex = t % seasonalPeriod;
  const deseasonalized = demandHistory[t].actualDemandQuantity - seasonal[seasonalIndex];

  const prevLevel = level;
  level = alpha * deseasonalized + (1 - alpha) * (level + trend);
  trend = beta * (level - prevLevel) + (1 - beta) * trend;
  seasonal[seasonalIndex] = gamma * (demandHistory[t].actualDemandQuantity - level) +
                            (1 - gamma) * seasonal[seasonalIndex];
}

// 4. Generate forecasts
for (let h = 1; h <= horizonDays; h++) {
  const seasonalIndex = (demandHistory.length + h - 1) % seasonalPeriod;
  const forecast = (level + h * trend) + seasonal[seasonalIndex];

  // Confidence intervals expand with forecast horizon
  const confidenceWidth = rmse * Math.sqrt(h);

  forecasts.push({
    forecastedDemandQuantity: Math.max(0, forecast),  // Prevent negative
    lowerBound80Pct: Math.max(0, forecast - 1.28 * confidenceWidth),
    upperBound80Pct: forecast + 1.28 * confidenceWidth,
    lowerBound95Pct: Math.max(0, forecast - 1.96 * confidenceWidth),
    upperBound95Pct: forecast + 1.96 * confidenceWidth,
    modelConfidenceScore: 0.80,
    forecastAlgorithm: 'HOLT_WINTERS'
  });
}
```

**Seasonality Detection:**
```typescript
function detectSeasonality(demandHistory: DemandHistoryRecord[]): boolean {
  const periods = [7, 30];  // Weekly, monthly patterns

  for (const period of periods) {
    if (demandHistory.length < period * 2) continue;

    // Calculate autocorrelation at lag = period
    const autocorr = calculateAutocorrelation(demandHistory, period);

    if (autocorr > 0.3) {
      return true;  // Seasonal pattern detected
    }
  }

  return false;
}
```

**Characteristics:**
- **Best for:** Seasonal demand patterns with repeating cycles
- **Confidence Score:** 0.80
- **Seasonal Periods:** 7 (weekly), 30 (monthly), 90 (quarterly), 180 (semi-annual), 365 (annual)
- **Pros:** Captures level, trend, and seasonality
- **Cons:** Requires substantial historical data (60+ days), complex to tune
- **Expected MAPE:** 15-20% for seasonal materials

**Test Results (BILLY QA Report):**
- ❌ FAILED - P0 BUG IDENTIFIED
- Response time: 0.057 seconds (target: <3s) ✅
- **Critical Issue:** Forecasts decrease linearly to zero, then remain at zero from day 64 onward
- Expected: Sinusoidal pattern following historical seasonality
- Actual: Linear decrease to 0, all subsequent forecasts = 0

**Root Cause Analysis:**
- Seasonal component not correctly calculated
- Possible division by zero or floor at 0 preventing negative forecasts
- Algorithm may not have sufficient data to detect 90-day seasonality
- Requires complete rework of seasonal detection and forecasting logic

**Recommendation:** DO NOT DEPLOY to production until fixed

### 3.5 Algorithm Performance Comparison

| Algorithm | Use Case | Data Required | MAPE (Expected) | Confidence | Test Status |
|-----------|----------|---------------|-----------------|------------|-------------|
| Moving Average | Stable demand | 7+ days | 10-15% | 0.70 | ✅ PASSED |
| Exp Smoothing | Trending demand | 7+ days | 15-20% | 0.75 | ✅ PASSED |
| Holt-Winters | Seasonal demand | 60+ days | 15-20% | 0.80 | ❌ FAILED |
| SARIMA (future) | Complex patterns | 90+ days | 10-15% | 0.85 | Not implemented |
| LightGBM (future) | All patterns | 180+ days | 8-12% | 0.90 | Not implemented |

---

## 4. SAFETY STOCK & INVENTORY PLANNING

### 4.1 Safety Stock Service

**Location:** `src/modules/forecasting/services/safety-stock.service.ts`

**Purpose:** Calculate safety stock, reorder points, and economic order quantities

### 4.2 Safety Stock Formulas

#### 4.2.1 Basic Safety Stock

**Formula:**
```
Safety Stock = Average Daily Demand × Safety Stock Days
```

**Use Case:** C-class items, stable demand, reliable suppliers

**Implementation:**
```typescript
calculateBasicSafetyStock(
  avgDailyDemand: number,
  safetyStockDays: number = 14
): number {
  return avgDailyDemand * safetyStockDays;
}
```

#### 4.2.2 Demand Variability Safety Stock

**Formula:**
```
Safety Stock = Z × σ_demand × √(Average Lead Time)
```

**Use Case:** Seasonal materials, promotional periods

**Implementation:**
```typescript
calculateDemandVariabilitySafetyStock(
  demandStdDev: number,
  avgLeadTimeDays: number,
  zScore: number
): number {
  return zScore * demandStdDev * Math.sqrt(avgLeadTimeDays);
}
```

#### 4.2.3 Lead Time Variability Safety Stock

**Formula:**
```
Safety Stock = Z × Average Daily Demand × σ_lead_time
```

**Use Case:** International suppliers, port congestion, unreliable vendors

**Implementation:**
```typescript
calculateLeadTimeVariabilitySafetyStock(
  avgDailyDemand: number,
  leadTimeStdDev: number,
  zScore: number
): number {
  return zScore * avgDailyDemand * leadTimeStdDev;
}
```

#### 4.2.4 Combined Variability Safety Stock (King's Formula)

**Formula:**
```
Safety Stock = Z × √((Avg_LT × σ²_demand) + (Avg_Demand² × σ²_LT))
```

**Use Case:** A-class items, critical materials, high-value inventory

**Implementation:**
```typescript
calculateCombinedVariabilitySafetyStock(
  avgDailyDemand: number,
  demandStdDev: number,
  avgLeadTimeDays: number,
  leadTimeStdDev: number,
  zScore: number
): number {
  const demandVariance = demandStdDev * demandStdDev;
  const leadTimeVariance = leadTimeStdDev * leadTimeStdDev;

  const term1 = avgLeadTimeDays * demandVariance;
  const term2 = avgDailyDemand * avgDailyDemand * leadTimeVariance;

  return zScore * Math.sqrt(term1 + term2);
}
```

### 4.3 Z-Scores for Service Levels

**Mapping Table:**

| Service Level | Z-Score | Stockout Risk |
|---------------|---------|---------------|
| 99% | 2.33 | 1% |
| 95% | 1.65 | 5% |
| 90% | 1.28 | 10% |
| 85% | 1.04 | 15% |
| 80% | 0.84 | 20% |

**Implementation:**
```typescript
getZScore(serviceLevel: number): number {
  const zScores = {
    0.99: 2.33,
    0.95: 1.65,
    0.90: 1.28,
    0.85: 1.04,
    0.80: 0.84
  };

  return zScores[serviceLevel] || 1.65;  // Default to 95%
}
```

### 4.4 Reorder Point Calculation

**Formula:**
```
Reorder Point = (Average Daily Demand × Average Lead Time) + Safety Stock
```

**Implementation:**
```typescript
calculateReorderPoint(
  avgDailyDemand: number,
  avgLeadTimeDays: number,
  safetyStock: number
): number {
  return (avgDailyDemand * avgLeadTimeDays) + safetyStock;
}
```

**Example:**
- Average daily demand: 100 units
- Average lead time: 14 days
- Safety stock: 500 units (95% service level)
- **Reorder Point:** (100 × 14) + 500 = **1,900 units**

### 4.5 Economic Order Quantity (EOQ)

**Formula:**
```
EOQ = √((2 × Annual Demand × Ordering Cost) / (Unit Cost × Holding Cost %))
```

**Implementation:**
```typescript
calculateEOQ(
  avgDailyDemand: number,
  unitCost: number,
  orderingCost: number = 50,      // $50 per order
  holdingCostPct: number = 0.25   // 25% annual holding cost
): number {
  const annualDemand = avgDailyDemand * 365;
  const numerator = 2 * annualDemand * orderingCost;
  const denominator = unitCost * holdingCostPct;

  return Math.sqrt(numerator / denominator);
}
```

**Example:**
- Average daily demand: 100 units
- Annual demand: 36,500 units
- Unit cost: $10
- Ordering cost: $50
- Holding cost: 25%
- **EOQ:** √((2 × 36,500 × 50) / (10 × 0.25)) = **1,210 units**

### 4.6 Test Results (Safety Stock)

**Status:** ❌ FAILED - P0 BUG

**Error Message:**
```
syntax error at or near ","
at SafetyStockService.getMaterialInfo (...safety-stock.service.ts:281:20)
```

**Root Cause:** SQL syntax error in `getMaterialInfo()` method at line 281

**Impact:** Safety stock calculation completely broken, cannot execute

**Recommendation:** Fix SQL query syntax immediately before production deployment

---

## 5. GRAPHQL API SPECIFICATION

### 5.1 Schema Definition

**File:** `backend/src/graphql/schema/forecasting.graphql`

### 5.2 Enumerations

```graphql
enum ForecastHorizonType {
  SHORT_TERM    # 1-30 days
  MEDIUM_TERM   # 31-90 days
  LONG_TERM     # 91-365 days
}

enum ForecastAlgorithm {
  SARIMA
  LIGHTGBM
  MOVING_AVERAGE
  EXP_SMOOTHING
  HOLT_WINTERS
  AUTO
}

enum UrgencyLevel {
  LOW       # Stockout > 30 days
  MEDIUM    # Stockout 14-30 days
  HIGH      # Stockout 7-14 days
  CRITICAL  # Below safety stock or stockout < 7 days
}

enum RecommendationStatus {
  PENDING
  APPROVED
  REJECTED
  CONVERTED_TO_PO
  EXPIRED
}

enum ForecastStatus {
  ACTIVE
  SUPERSEDED
  REJECTED
}

enum DemandPattern {
  STABLE
  SEASONAL
  INTERMITTENT
  LUMPY
  ERRATIC
}
```

### 5.3 Queries

#### 5.3.1 getDemandHistory

**Purpose:** Retrieve historical demand data

```graphql
getDemandHistory(
  tenantId: ID!
  facilityId: ID!
  materialId: ID!
  startDate: Date!
  endDate: Date!
): [DemandHistory!]!
```

**Response Type:**
```graphql
type DemandHistory {
  demandHistoryId: ID!
  tenantId: ID!
  facilityId: ID!
  materialId: ID!
  demandDate: Date!
  year: Int!
  month: Int!
  weekOfYear: Int!
  dayOfWeek: Int!
  quarter: Int!
  actualDemandQuantity: Float!
  forecastedDemandQuantity: Float
  demandUom: String!
  salesOrderDemand: Float
  productionOrderDemand: Float
  transferOrderDemand: Float
  scrapAdjustment: Float
  avgUnitPrice: Float
  promotionalDiscountPct: Float
  marketingCampaignActive: Boolean
  isHoliday: Boolean
  isPromotionalPeriod: Boolean
  forecastError: Float
  absolutePercentageError: Float
}
```

#### 5.3.2 getMaterialForecasts

**Purpose:** Retrieve forecasts for a material

```graphql
getMaterialForecasts(
  tenantId: ID!
  facilityId: ID!
  materialId: ID!
  startDate: Date!
  endDate: Date!
  forecastStatus: ForecastStatus
): [MaterialForecast!]!
```

**Response Type:**
```graphql
type MaterialForecast {
  forecastId: ID!
  tenantId: ID!
  facilityId: ID!
  materialId: ID!
  forecastModelId: ID
  forecastGenerationTimestamp: DateTime!
  forecastVersion: Int!
  forecastHorizonType: ForecastHorizonType!
  forecastAlgorithm: ForecastAlgorithm!
  forecastDate: Date!
  forecastYear: Int!
  forecastMonth: Int!
  forecastWeekOfYear: Int!
  forecastedDemandQuantity: Float!
  forecastUom: String!
  lowerBound80Pct: Float
  upperBound80Pct: Float
  lowerBound95Pct: Float
  upperBound95Pct: Float
  modelConfidenceScore: Float
  isManuallyOverridden: Boolean!
  manualOverrideQuantity: Float
  manualOverrideBy: String
  manualOverrideReason: String
  forecastStatus: ForecastStatus!
}
```

#### 5.3.3 calculateSafetyStock

**Purpose:** Calculate safety stock for a material

```graphql
calculateSafetyStock(input: CalculateSafetyStockInput!): SafetyStockCalculation!

input CalculateSafetyStockInput {
  tenantId: ID!
  facilityId: ID!
  materialId: ID!
  serviceLevel: Float!  # 0.80 to 0.99
  calculationMethod: String  # AUTO, BASIC, DEMAND_VAR, LEAD_TIME_VAR, COMBINED
}
```

**Response Type:**
```graphql
type SafetyStockCalculation {
  materialId: ID!
  safetyStockQuantity: Float!
  reorderPoint: Float!
  economicOrderQuantity: Float!
  calculationMethod: String!
  avgDailyDemand: Float!
  demandStdDev: Float!
  avgLeadTimeDays: Int!
  leadTimeStdDev: Float
  serviceLevel: Float!
  zScore: Float!
}
```

#### 5.3.4 getForecastAccuracySummary

**Purpose:** Get forecast accuracy summary for materials

```graphql
getForecastAccuracySummary(
  tenantId: ID!
  facilityId: ID!
  materialIds: [ID!]!
): [ForecastAccuracySummary!]!
```

**Response Type:**
```graphql
type ForecastAccuracySummary {
  materialId: ID!
  last30DaysMape: Float
  last60DaysMape: Float
  last90DaysMape: Float
  last30DaysBias: Float
  last60DaysBias: Float
  last90DaysBias: Float
  currentForecastAlgorithm: ForecastAlgorithm
  recommendedAlgorithm: ForecastAlgorithm
}
```

#### 5.3.5 getForecastAccuracyMetrics

**Purpose:** Get detailed forecast accuracy metrics

```graphql
getForecastAccuracyMetrics(
  tenantId: ID!
  facilityId: ID!
  materialId: ID!
  periodStart: Date
  periodEnd: Date
): [ForecastAccuracyMetrics!]!
```

#### 5.3.6 getReplenishmentRecommendations

**Purpose:** Get replenishment recommendations

```graphql
getReplenishmentRecommendations(
  tenantId: ID!
  facilityId: ID!
  status: RecommendationStatus
  materialId: ID
): [ReplenishmentRecommendation!]!
```

### 5.4 Mutations

#### 5.4.1 generateForecasts

**Purpose:** Generate forecasts for materials

```graphql
generateForecasts(input: GenerateForecastInput!): [MaterialForecast!]!

input GenerateForecastInput {
  tenantId: ID!
  facilityId: ID!
  materialIds: [ID!]!
  forecastHorizonDays: Int!
  forecastAlgorithm: ForecastAlgorithm
}
```

#### 5.4.2 recordDemand

**Purpose:** Record actual demand for a material

```graphql
recordDemand(input: RecordDemandInput!): DemandHistory!

input RecordDemandInput {
  tenantId: ID!
  facilityId: ID!
  materialId: ID!
  demandDate: Date!
  actualDemandQuantity: Float!
  demandUom: String!
  salesOrderDemand: Float
  productionOrderDemand: Float
  transferOrderDemand: Float
  scrapAdjustment: Float
  avgUnitPrice: Float
  promotionalDiscountPct: Float
  marketingCampaignActive: Boolean
  isHoliday: Boolean
  isPromotionalPeriod: Boolean
}
```

#### 5.4.3 backfillDemandHistory

**Purpose:** Backfill demand history from inventory transactions

```graphql
backfillDemandHistory(
  tenantId: ID!
  facilityId: ID!
  startDate: Date!
  endDate: Date!
): Int!  # Returns count of records created
```

#### 5.4.4 calculateForecastAccuracy

**Purpose:** Calculate forecast accuracy metrics

```graphql
calculateForecastAccuracy(input: CalculateAccuracyInput!): ForecastAccuracyMetrics!

input CalculateAccuracyInput {
  tenantId: ID!
  facilityId: ID!
  materialId: ID!
  periodStart: Date!
  periodEnd: Date!
  aggregationLevel: String!  # DAILY, WEEKLY, MONTHLY, QUARTERLY
}
```

#### 5.4.5 generateReplenishmentRecommendations

**Purpose:** Generate replenishment recommendations

```graphql
generateReplenishmentRecommendations(
  input: GenerateRecommendationsInput!
): [ReplenishmentRecommendation!]!

input GenerateRecommendationsInput {
  tenantId: ID!
  facilityId: ID!
  materialIds: [ID!]
  urgencyLevelFilter: UrgencyLevel
}
```

---

## 6. SERVICE LAYER ARCHITECTURE

### 6.1 Service Overview

**Location:** `backend/src/modules/forecasting/services/`

**Services Implemented:**
1. DemandHistoryService - Demand recording and retrieval
2. ForecastingService - Forecast generation algorithms
3. SafetyStockService - Inventory planning calculations
4. ForecastAccuracyService - Accuracy metric calculations
5. ReplenishmentRecommendationService - Purchase order suggestions

### 6.2 DemandHistoryService

**File:** `demand-history.service.ts`

**Key Methods:**

```typescript
class DemandHistoryService {
  // Record actual demand from inventory transactions
  async recordDemand(input: RecordDemandInput): Promise<DemandHistory>

  // Retrieve historical demand data
  async getDemandHistory(
    tenantId: string,
    facilityId: string,
    materialId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DemandHistory[]>

  // Backfill demand from inventory_transactions table
  async backfillDemandHistory(
    tenantId: string,
    facilityId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number>

  // Update forecasted demand quantities
  async updateForecastedDemand(
    tenantId: string,
    facilityId: string,
    materialId: string,
    demandDate: Date,
    forecastedQuantity: number
  ): Promise<void>

  // Get demand statistics (avg, stddev, min, max)
  async getDemandStatistics(
    tenantId: string,
    facilityId: string,
    materialId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DemandStatistics>
}
```

**Backfill Logic:**
```sql
INSERT INTO demand_history (
  tenant_id, facility_id, material_id, demand_date,
  year, month, week_of_year, day_of_week, quarter,
  actual_demand_quantity, demand_uom,
  sales_order_demand, production_order_demand
)
SELECT
  tenant_id, facility_id, material_id, transaction_date::DATE,
  EXTRACT(YEAR FROM transaction_date),
  EXTRACT(MONTH FROM transaction_date),
  EXTRACT(WEEK FROM transaction_date),
  EXTRACT(DOW FROM transaction_date),
  EXTRACT(QUARTER FROM transaction_date),
  SUM(ABS(quantity_change)),
  unit_of_measure,
  SUM(CASE WHEN sales_order_id IS NOT NULL THEN ABS(quantity_change) ELSE 0 END),
  SUM(CASE WHEN production_order_id IS NOT NULL THEN ABS(quantity_change) ELSE 0 END)
FROM inventory_transactions
WHERE transaction_type IN ('ISSUE', 'SCRAP', 'TRANSFER')
  AND tenant_id = $1
  AND facility_id = $2
  AND transaction_date BETWEEN $3 AND $4
GROUP BY tenant_id, facility_id, material_id, transaction_date::DATE, unit_of_measure
ON CONFLICT (tenant_id, facility_id, material_id, demand_date) DO NOTHING;
```

### 6.3 ForecastingService

**File:** `forecasting.service.ts`

**Dependencies:**
- DemandHistoryService (for historical data retrieval)
- Pool (PostgreSQL connection pool)

**Architecture Note:**
- Originally implemented with NestJS decorators (@Injectable)
- Converted to Apollo Server pattern for compatibility
- Services instantiated per-request in resolvers

**Key Methods:**
```typescript
class ForecastingService {
  async generateForecasts(input: GenerateForecastInput): Promise<MaterialForecast[]>
  async getMaterialForecasts(...): Promise<MaterialForecast[]>
  private selectAlgorithm(...): 'MOVING_AVERAGE' | 'EXP_SMOOTHING' | 'HOLT_WINTERS'
  private generateMovingAverageForecast(...): Promise<MaterialForecast[]>
  private generateExponentialSmoothingForecast(...): Promise<MaterialForecast[]>
  private generateHoltWintersForecast(...): Promise<MaterialForecast[]>
  private detectSeasonality(demandHistory): boolean
  private calculateAutocorrelation(data, lag): number
}
```

### 6.4 SafetyStockService

**File:** `safety-stock.service.ts`

**Status:** ❌ SQL SYNTAX ERROR AT LINE 281

**Key Methods:**
```typescript
class SafetyStockService {
  async calculateSafetyStock(input): Promise<SafetyStockCalculation>
  async calculateBasicSafetyStock(...): Promise<number>
  async calculateDemandVariabilitySafetyStock(...): Promise<number>
  async calculateLeadTimeVariabilitySafetyStock(...): Promise<number>
  async calculateCombinedVariabilitySafetyStock(...): Promise<number>
  async calculateReorderPoint(...): Promise<number>
  async calculateEOQ(...): Promise<number>
  async updateMaterialPlanningParameters(...): Promise<void>
  private getZScore(serviceLevel: number): number
  private getMaterialInfo(materialId): Promise<MaterialInfo>  // ❌ SQL ERROR HERE
}
```

### 6.5 ForecastAccuracyService

**File:** `forecast-accuracy.service.ts`

**Key Methods:**
```typescript
class ForecastAccuracyService {
  async calculateAccuracyMetrics(input): Promise<ForecastAccuracyMetrics>
  async getAccuracyMetrics(...): Promise<ForecastAccuracyMetrics[]>
  async getBestPerformingMethod(materialId): Promise<ForecastAlgorithm>
  async compareForecastMethods(materialId): Promise<MethodComparison[]>
  private calculateMAPE(actuals, forecasts): number
  private calculateRMSE(actuals, forecasts): number
  private calculateMAE(actuals, forecasts): number
  private calculateBias(actuals, forecasts): number
  private calculateTrackingSignal(actuals, forecasts): number
}
```

**MAPE Calculation:**
```typescript
calculateMAPE(actuals: number[], forecasts: number[]): number {
  let totalAPE = 0;
  let count = 0;

  for (let i = 0; i < actuals.length; i++) {
    if (actuals[i] === 0) continue;  // Skip zero actuals (division by zero)

    const ape = Math.abs((actuals[i] - forecasts[i]) / actuals[i]) * 100;
    totalAPE += ape;
    count++;
  }

  return count > 0 ? totalAPE / count : null;
}
```

### 6.6 ReplenishmentRecommendationService

**File:** `replenishment-recommendation.service.ts`

**Key Methods:**
```typescript
class ReplenishmentRecommendationService {
  async generateRecommendations(input): Promise<ReplenishmentRecommendation[]>
  async getRecommendations(...): Promise<ReplenishmentRecommendation[]>
  async approveRecommendation(suggestionId): Promise<ReplenishmentRecommendation>
  async rejectRecommendation(suggestionId, reason): Promise<ReplenishmentRecommendation>
  async convertToPurchaseOrder(suggestionId): Promise<string>
  private calculateUrgencyLevel(...): UrgencyLevel
  private projectStockoutDate(...): Date
}
```

**Urgency Level Logic:**
```typescript
calculateUrgencyLevel(
  availableQuantity: number,
  safetyStock: number,
  forecastedDemand30Days: number,
  avgDailyDemand: number
): UrgencyLevel {
  // Below safety stock = CRITICAL
  if (availableQuantity < safetyStock) {
    return 'CRITICAL';
  }

  // Calculate days until stockout
  const daysUntilStockout = availableQuantity / avgDailyDemand;

  if (daysUntilStockout < 7) return 'CRITICAL';
  if (daysUntilStockout < 14) return 'HIGH';
  if (daysUntilStockout < 30) return 'MEDIUM';
  return 'LOW';
}
```

---

## 7. FRONTEND IMPLEMENTATION

### 7.1 Dashboard Component

**File:** `frontend/src/pages/InventoryForecastingDashboard.tsx`

**Features:**
1. Material selection dropdown
2. Forecast horizon selector (30/90/180/365 days)
3. Confidence band toggle (80%/95%)
4. Key metrics cards (4 KPIs)
5. Demand & forecast chart
6. Advanced metrics section (collapsible)
7. Data tables (demand history, forecasts)
8. Export functionality

**Component Structure:**
```typescript
function InventoryForecastingDashboard() {
  // State management
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [forecastHorizon, setForecastHorizon] = useState<number>(30);
  const [showConfidenceBands, setShowConfidenceBands] = useState<boolean>(true);

  // GraphQL queries
  const { data: demandData } = useQuery(GET_DEMAND_HISTORY, {...});
  const { data: forecastData } = useQuery(GET_MATERIAL_FORECASTS, {...});
  const { data: accuracyData } = useQuery(GET_FORECAST_ACCURACY_SUMMARY, {...});

  // GraphQL mutations
  const [generateForecasts] = useMutation(GENERATE_FORECASTS);

  return (
    <div>
      {/* Material Selector */}
      <MaterialSelector onChange={setSelectedMaterial} />

      {/* KPI Cards */}
      <Grid container spacing={2}>
        <Grid item xs={3}>
          <MetricCard
            title="Forecast Accuracy (MAPE)"
            value={accuracyData?.mape}
            colorCode={getColorForMAPE(accuracyData?.mape)}
          />
        </Grid>
        {/* ... 3 more cards */}
      </Grid>

      {/* Chart */}
      <ChartContainer>
        <LineChart data={combinedData}>
          <Line dataKey="actualDemand" stroke="blue" />
          <Line dataKey="forecastedDemand" stroke="green" />
          <Area dataKey="lowerBound95" fill="gray" opacity={0.2} />
          <Area dataKey="upperBound95" fill="gray" opacity={0.2} />
        </LineChart>
      </ChartContainer>

      {/* Tables */}
      <DataTable
        title="Recent Demand History"
        data={demandData}
        columns={demandColumns}
      />

      <DataTable
        title="Upcoming Forecasts"
        data={forecastData}
        columns={forecastColumns}
      />
    </div>
  );
}
```

### 7.2 GraphQL Queries (Frontend)

**File:** `frontend/src/graphql/queries/forecasting.ts`

```typescript
export const GET_DEMAND_HISTORY = gql`
  query GetDemandHistory(
    $tenantId: ID!,
    $facilityId: ID!,
    $materialId: ID!,
    $startDate: Date!,
    $endDate: Date!
  ) {
    getDemandHistory(
      tenantId: $tenantId,
      facilityId: $facilityId,
      materialId: $materialId,
      startDate: $startDate,
      endDate: $endDate
    ) {
      demandDate
      actualDemandQuantity
      forecastedDemandQuantity
      forecastError
      absolutePercentageError
    }
  }
`;

export const GET_MATERIAL_FORECASTS = gql`
  query GetMaterialForecasts(
    $tenantId: ID!,
    $facilityId: ID!,
    $materialId: ID!,
    $startDate: Date!,
    $endDate: Date!
  ) {
    getMaterialForecasts(
      tenantId: $tenantId,
      facilityId: $facilityId,
      materialId: $materialId,
      startDate: $startDate,
      endDate: $endDate,
      forecastStatus: ACTIVE
    ) {
      forecastDate
      forecastedDemandQuantity
      forecastAlgorithm
      lowerBound80Pct
      upperBound80Pct
      lowerBound95Pct
      upperBound95Pct
      modelConfidenceScore
    }
  }
`;

export const GENERATE_FORECASTS = gql`
  mutation GenerateForecasts($input: GenerateForecastInput!) {
    generateForecasts(input: $input) {
      forecastId
      forecastDate
      forecastedDemandQuantity
      forecastAlgorithm
    }
  }
`;
```

### 7.3 Testing Status (Frontend)

**Status:** NOT TESTED (backend endpoints were unavailable during initial testing)

**Next Steps:**
1. Verify dashboard loads without errors
2. Test forecast chart displays with real data
3. Validate accuracy metrics cards
4. Test replenishment recommendations table
5. Verify algorithm selection display

---

## 8. INTEGRATION POINTS

### 8.1 WMS (Warehouse Management System)

**Integration Status:** PLANNED (not yet implemented)

**Purpose:** Automatically record demand from inventory transactions

**Proposed Implementation:**
```typescript
// In wms.resolver.ts
async createInventoryTransaction(input: CreateTransactionInput) {
  const transaction = await this.wmsService.createTransaction(input);

  // Record demand for consumption transactions
  if (['ISSUE', 'SCRAP', 'TRANSFER'].includes(transaction.transactionType)) {
    await this.demandHistoryService.recordDemand({
      tenantId: transaction.tenantId,
      facilityId: transaction.facilityId,
      materialId: transaction.materialId,
      demandDate: new Date(),
      actualDemandQuantity: Math.abs(transaction.quantity),
      demandUom: transaction.uom,
      salesOrderDemand: transaction.salesOrderId ? Math.abs(transaction.quantity) : 0,
      productionOrderDemand: transaction.productionOrderId ? Math.abs(transaction.quantity) : 0
    });
  }

  return transaction;
}
```

### 8.2 Purchasing Module

**Integration Status:** SCHEMA READY (API not yet implemented)

**Purpose:** Convert replenishment recommendations to purchase orders

**Database Link:**
```sql
-- replenishment_suggestions.converted_purchase_order_id → purchase_orders.id
ALTER TABLE replenishment_suggestions
  ADD COLUMN converted_purchase_order_id UUID REFERENCES purchase_orders(id);
```

**Proposed Workflow:**
1. User approves replenishment recommendation
2. System creates draft purchase order
3. Purchase order inherits: vendor, material, quantity, delivery date
4. Recommendation status updated to `CONVERTED_TO_PO`
5. Link stored in `converted_purchase_order_id`

### 8.3 Vendor Management

**Integration Status:** PARTIAL (lead time statistics)

**Purpose:** Pull vendor lead time statistics for safety stock calculations

**Current Implementation:**
```sql
SELECT
  AVG(EXTRACT(DAY FROM (receipt_date - order_date))) AS avg_lead_time,
  STDDEV(EXTRACT(DAY FROM (receipt_date - order_date))) AS std_dev_lead_time
FROM purchase_orders
WHERE vendor_id = $1
  AND material_id = $2
  AND receipt_date IS NOT NULL
  AND order_date IS NOT NULL
```

### 8.4 Material Master Data

**Integration Status:** COMPLETE

**Purpose:** Forecasting configuration stored in materials table

**Fields Used:**
- `forecasting_enabled` - Enable/disable forecasting
- `forecast_algorithm` - Preferred algorithm (AUTO, MA, SES, HW)
- `forecast_horizon_days` - Default forecast period
- `target_forecast_accuracy_pct` - Target MAPE threshold
- `demand_pattern` - Demand classification

**Example Query:**
```sql
SELECT
  forecasting_enabled,
  forecast_algorithm,
  forecast_horizon_days,
  demand_pattern
FROM materials
WHERE id = $1;
```

### 8.5 Future Integration Opportunities

**Phase 2: Sales Pipeline Integration**
- Pull sales order pipeline for short-term demand adjustments
- Integrate promotional calendar for seasonal adjustments
- Link to marketing campaign data for demand spikes

**Phase 3: Production Planning Integration**
- Forecast raw material requirements based on production schedules
- Integrate with MRP (Material Requirements Planning)
- Coordinate with capacity planning

**Phase 4: External Data Sources**
- Economic indicators (GDP, inflation, industry trends)
- Weather data (for seasonal products)
- Competitor analysis (market share shifts)

---

## 9. PERFORMANCE & SCALABILITY

### 9.1 Performance Benchmarks (Billy QA Report)

**Test Results:**

| Test | Target | Actual | Status |
|------|--------|--------|--------|
| Forecast generation (100 items, 30 days) | <30s | 18s | ✅ PASS (40% margin) |
| Dashboard load time | <2s | 0.431s | ✅ PASS (78% faster) |
| Accuracy calculation (30 days) | <5s | 0.057s | ✅ PASS (99% faster) |
| Replenishment batch (100 items) | <60s | 23s | ✅ PASS (62% faster) |
| DB query (forecast accuracy) | <100ms | 0.053ms | ✅ PASS (99.95% faster) |

**Conclusion:** All performance targets exceeded with significant margins

### 9.2 Database Index Strategy

**Indexes Created:**

**demand_history (4 indexes):**
- idx_demand_history_tenant_facility (tenant_id, facility_id)
- idx_demand_history_material (material_id)
- idx_demand_history_date (demand_date DESC)
- idx_demand_history_material_date_range (material_id, demand_date)

**material_forecasts (6 indexes):**
- idx_material_forecasts_tenant_facility (tenant_id, facility_id)
- idx_material_forecasts_material (material_id)
- idx_material_forecasts_date (forecast_date)
- idx_material_forecasts_status (forecast_status)
- idx_material_forecasts_material_date_range (material_id, forecast_date)
- idx_material_forecasts_active (material_id, forecast_date) WHERE forecast_status = 'ACTIVE' (PARTIAL)

**forecast_accuracy_metrics (4 indexes):**
- idx_forecast_accuracy_tenant_facility (tenant_id, facility_id)
- idx_forecast_accuracy_material (material_id)
- idx_forecast_accuracy_period (measurement_period_start, measurement_period_end)
- idx_forecast_accuracy_material_period (material_id, measurement_period_end DESC)

**replenishment_suggestions (6 indexes):**
- idx_replenishment_suggestions_tenant_facility (tenant_id, facility_id)
- idx_replenishment_suggestions_material (material_id)
- idx_replenishment_suggestions_status (suggestion_status)
- idx_replenishment_suggestions_vendor (preferred_vendor_id)
- idx_replenishment_suggestions_order_date (recommended_order_date)
- idx_replenishment_suggestions_stockout_date (projected_stockout_date ASC) WHERE suggestion_status = 'PENDING' (PARTIAL)

**Analysis:**
- All common query patterns covered
- Partial indexes for high-selectivity filters
- Descending date indexes for "latest" queries
- No missing indexes identified

### 9.3 Scalability Considerations

**Current Capacity:**
- Supports 1,000 materials × 365 days = 365,000 forecasts/year
- Database size: ~5 GB/year (see Data Volume Estimates)

**Scaling Strategies:**

**Horizontal Scaling:**
- Read replicas for query load distribution
- Connection pooling (current: pg.Pool)
- GraphQL response caching

**Vertical Scaling:**
- Database partitioning by date (monthly partitions)
- Archive old forecasts (>1 year) to cold storage
- Materialized views for dashboard queries

**Algorithm Optimization:**
- Batch forecast generation (100 materials at a time)
- Async processing for non-critical forecasts
- Python microservice for SARIMA/LightGBM (future)

### 9.4 Monitoring Metrics

**Key Metrics to Track:**

**Performance:**
- Forecast generation time (P50, P95, P99)
- GraphQL query response time
- Database query execution time
- Connection pool utilization

**Accuracy:**
- Average MAPE across all materials
- MAPE by material category (A/B/C class)
- Forecast bias (over/under-forecasting)
- Tracking Signal alerts

**Business:**
- Stockout events (before/after implementation)
- Recommendation acceptance rate
- Inventory carrying cost
- Planning time savings

---

## 10. SECURITY & MULTI-TENANCY

### 10.1 Row-Level Security (RLS)

**Status:** FULLY IMPLEMENTED

All forecasting tables enforce tenant isolation using PostgreSQL Row-Level Security:

```sql
-- demand_history
CREATE POLICY tenant_isolation_demand_history ON demand_history
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- material_forecasts
CREATE POLICY tenant_isolation_material_forecasts ON material_forecasts
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- forecast_models
CREATE POLICY tenant_isolation_forecast_models ON forecast_models
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- forecast_accuracy_metrics
CREATE POLICY tenant_isolation_forecast_accuracy_metrics ON forecast_accuracy_metrics
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- replenishment_suggestions
CREATE POLICY tenant_isolation_replenishment_suggestions ON replenishment_suggestions
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
```

**Testing Evidence (Billy QA Report):**
```sql
-- Test: Query Tenant A forecasts using Tenant B credentials
SET app.current_tenant_id = 'tenant-b-uuid';
SELECT * FROM material_forecasts WHERE material_id = 'tenant-a-material';
-- Result: 0 rows ✅ (RLS blocks cross-tenant access)
```

### 10.2 Input Validation

**GraphQL Schema Constraints:**
- Non-null fields enforced: `tenantId!`, `facilityId!`, `materialId!`
- Enum validation: ForecastAlgorithm, UrgencyLevel, RecommendationStatus
- Date format validation: ISO 8601 required

**Database Constraints:**
```sql
-- Negative demand prevention
CONSTRAINT chk_demand_positive CHECK (actual_demand_quantity >= 0)

-- Confidence score range
CONSTRAINT chk_confidence_range CHECK (model_confidence_score BETWEEN 0 AND 1)

-- Unique constraint
CONSTRAINT uq_demand_history_material_date UNIQUE (tenant_id, facility_id, material_id, demand_date)
```

**Service-Level Validation:**
- Division by zero in MAPE: ✅ Handled (filters out zero values)
- Negative forecast horizon: ✅ Validation error returned
- Missing required parameters: ✅ GraphQL schema validation

### 10.3 Authorization (FUTURE ENHANCEMENT)

**Current State:** NO PERMISSION CHECKS ON MUTATIONS

**Status:**
- Authentication: JWT required (enforced at API gateway level)
- Authorization: NOT IMPLEMENTED (trust after authentication)

**Risk Assessment:**
- **Severity:** Medium
- **Mitigation:** RLS provides baseline security (tenant isolation)
- **Impact:** Authenticated users can perform any forecasting operation within their tenant

**Recommended Implementation (Phase 2):**

```typescript
// Proposed permission decorators
@RequirePermission('inventory:write')
async generateForecasts(input: GenerateForecastInput) {
  // ...
}

@RequirePermission('procurement:write')
async generateReplenishmentRecommendations(input: GenerateRecommendationsInput) {
  // ...
}

@RequirePermission('inventory:read')
async calculateForecastAccuracy(input: CalculateAccuracyInput) {
  // ...
}
```

**Required Permissions:**
- `inventory:read` - View demand history, forecasts, accuracy metrics
- `inventory:write` - Generate forecasts, record demand
- `inventory:admin` - Override forecasts, manage models
- `procurement:write` - Generate/approve replenishment recommendations

### 10.4 Audit Trail

**Current Implementation:**

All tables include audit fields:
```sql
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
created_by VARCHAR(100),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
updated_by VARCHAR(100),
deleted_at TIMESTAMP WITH TIME ZONE,
deleted_by VARCHAR(100)
```

**Manual Override Tracking:**
```sql
-- material_forecasts table
is_manually_overridden BOOLEAN DEFAULT FALSE,
manual_override_quantity DECIMAL(15, 4),
manual_override_by VARCHAR(100),
manual_override_reason TEXT
```

**Recommendation Status Tracking:**
```sql
-- replenishment_suggestions table
reviewed_by VARCHAR(100),
reviewed_at TIMESTAMP WITH TIME ZONE,
review_notes TEXT
```

---

## 11. TESTING & QUALITY ASSURANCE

### 11.1 Test Summary (Billy QA Report)

**Date:** 2025-12-27
**Overall Status:** CONDITIONAL PASS

**Test Results:**

| Test # | Test Name | Status | Pass/Fail |
|--------|-----------|--------|-----------|
| 1 | getDemandHistory | PASSED | PASS |
| 2 | Moving Average Algorithm | PASSED | PASS |
| 3 | Exponential Smoothing Algorithm | PASSED | PASS |
| 4 | Holt-Winters Seasonal Algorithm | FAILED | FAIL |
| 5 | Safety Stock Calculation | FAILED | FAIL |
| 6 | Forecast Accuracy Metrics | PASSED | PASS |
| 7 | Replenishment Recommendations | PASSED | PASS |

**Overall Pass Rate:** 5 of 7 tests (71.4%)

### 11.2 Critical Bugs Identified

**BUG #1: Holt-Winters Algorithm Generates Zero Forecasts**
- **Severity:** P0 - Critical
- **File:** `forecasting.service.ts`
- **Description:** Seasonal forecasting generates zeros after day 63
- **Impact:** Seasonal forecasting completely broken
- **Test Case:** Test 4 - FAILED
- **Recommendation:** Do not deploy Holt-Winters to production until fixed

**BUG #2: Safety Stock Calculation Has SQL Syntax Error**
- **Severity:** P0 - Critical
- **File:** `safety-stock.service.ts` (line 281)
- **Error:** "syntax error at or near \",\""
- **Impact:** Safety stock calculation completely broken
- **Test Case:** Test 5 - FAILED
- **Recommendation:** Fix SQL query syntax immediately

### 11.3 Infrastructure Issues

**ISSUE #1: Database Migration Not Applied**
- **Impact:** Required tables missing from database
- **Tables Affected:** material_forecasts, forecast_models, forecast_accuracy_metrics, replenishment_suggestions
- **Resolution:** Manually created tables during testing
- **Recommendation:** Ensure V0.0.32 migration runs automatically in all environments

### 11.4 Minor Observations

**OBSERVATION #1: Moving Average Confidence Score Below Target**
- **Actual:** 0.70
- **Target:** 0.75
- **Impact:** Minor - still acceptable for production
- **Recommendation:** Review confidence score calculation algorithm

**OBSERVATION #2: Exponential Smoothing Uses Single Rather Than Double Method**
- **Impact:** Forecasts do not continue trend beyond last observation
- **Recommendation:** Consider implementing Holt's double exponential smoothing for trending data

### 11.5 Mathematical Validation (Priya Statistical Analysis)

**Status:** ALL ALGORITHMS MATHEMATICALLY VALIDATED (except Holt-Winters implementation bug)

**Moving Average:**
- ✅ Formula correct: avg_demand = Σ(demand) / window_size
- ✅ Confidence intervals: ±1.28σ (80%), ±1.96σ (95%)
- ✅ Expected MAPE: 10-15% for stable demand

**Exponential Smoothing:**
- ✅ Formula correct: smoothed[t] = α × demand[t] + (1 - α) × smoothed[t-1]
- ✅ Alpha parameter: 0.3 (appropriate for recent trend importance)
- ✅ Expected MAPE: 15-20% for variable demand

**Holt-Winters:**
- ✅ Formulas theoretically correct (level, trend, seasonal components)
- ❌ Implementation bug causing zero forecasts (requires fix)
- ✅ Expected MAPE: 15-20% for seasonal demand (after fix)

**Safety Stock Formulas:**
- ✅ Basic: Avg × Days
- ✅ Demand Variability: Z × σ × √LT
- ✅ Lead Time Variability: Z × Avg × σ_LT
- ✅ King's Combined: Z × √((LT×σ²_D) + (Avg²×σ²_LT))

**Z-Scores:**
- ✅ All correct (verified against standard normal table)
- 80%: 0.84, 85%: 1.04, 90%: 1.28, 95%: 1.65, 99%: 2.33

---

## 12. DEPLOYMENT & OPERATIONS

### 12.1 Deployment Status

**Current Status:** PARTIAL DEPLOYMENT

**Completed:**
- ✅ Database migration V0.0.32 created
- ✅ GraphQL schema defined
- ✅ Backend services implemented
- ✅ Resolver converted to Apollo Server pattern
- ✅ Frontend dashboard created

**Blocked:**
- ❌ Holt-Winters algorithm (zero forecast bug)
- ❌ Safety Stock calculation (SQL syntax error)
- ⚠️ Database migration not auto-applied (manual workaround required)

**Deployment Recommendation (Berry DevOps):**

**Phase 1 Deployment (APPROVED):**
- ✅ Moving Average algorithm
- ✅ Exponential Smoothing algorithm
- ✅ Demand History retrieval
- ✅ Forecast Accuracy metrics
- ✅ Replenishment Recommendations query

**Phase 2 Deployment (HOLD):**
- ❌ Holt-Winters algorithm (requires fix)
- ❌ Safety Stock calculation (requires fix)

### 12.2 Deployment Checklist

**Pre-Deployment:**
- [ ] Fix Holt-Winters algorithm (zero forecast bug)
- [ ] Fix Safety Stock SQL syntax error
- [ ] Verify database migration V0.0.32 applied
- [ ] Run full regression test suite
- [ ] Performance test with 1000+ materials
- [ ] Frontend dashboard testing
- [ ] Load test GraphQL endpoints

**Deployment:**
- [ ] Apply database migration
- [ ] Deploy backend services
- [ ] Deploy frontend dashboard
- [ ] Verify GraphQL endpoints
- [ ] Generate test forecasts
- [ ] Monitor error rates

**Post-Deployment:**
- [ ] Backfill demand history (90+ days)
- [ ] Generate forecasts for A-class materials
- [ ] Calculate accuracy metrics
- [ ] Generate replenishment recommendations
- [ ] Monitor MAPE accuracy
- [ ] Collect user feedback

### 12.3 Operational Procedures

**Daily Jobs (Future):**
1. Demand aggregation from inventory transactions
2. Forecast accuracy calculation (actual vs forecast)
3. Short-term forecast updates for A-class materials

**Weekly Jobs (Future):**
1. Medium-term forecast generation (30-90 days)
2. Replenishment suggestion generation
3. MAPE and bias tracking

**Monthly Jobs (Future):**
1. Model retraining with updated data
2. Safety stock recalculation
3. Long-term strategic forecasting

### 12.4 Monitoring & Alerting

**CRITICAL Alerts (P0):**
- Forecast generation fails (service down)
- Database migration rollback required
- GraphQL endpoint error rate >10%
- RLS policy breach detected

**WARNING Alerts (P1):**
- Average MAPE >35% (poor forecast quality)
- Tracking Signal |TS| > 6 (systematic bias)
- Forecast generation time >60s
- Recommendation generation failures >5%

**INFO Alerts (P2):**
- MAPE 25-35% (approaching target threshold)
- Dashboard load time >3s
- Recommendation acceptance rate <50%

### 12.5 Rollback Plan

**Trigger Conditions:**
- Critical errors preventing backend startup
- Database migration corruption
- GraphQL endpoint 50x errors >5%
- Frontend crashes on dashboard load

**Rollback Steps:**

1. **Stop Backend Server**
2. **Revert Code Changes**
```bash
git checkout HEAD~1 src/index.ts
git checkout HEAD~1 src/graphql/resolvers/forecasting.resolver.ts
```

3. **Rollback Database Migration**
```sql
DROP TABLE IF EXISTS replenishment_suggestions CASCADE;
DROP TABLE IF EXISTS forecast_accuracy_metrics CASCADE;
DROP TABLE IF EXISTS material_forecasts CASCADE;
DROP TABLE IF EXISTS forecast_models CASCADE;
DROP TABLE IF EXISTS demand_history CASCADE;

ALTER TABLE materials DROP COLUMN IF EXISTS forecasting_enabled;
-- ... (drop all 7 new columns)

DELETE FROM schema_version WHERE version = 'V0.0.32';
```

4. **Restart Backend** (previous version)
5. **Verify Rollback**
6. **Notify Stakeholders**

---

## 13. FUTURE ENHANCEMENTS

### 13.1 Phase 2: Statistical Forecasting (Planned)

**Timeline:** Q2 2025

**Features:**
- Python microservice with FastAPI
- SARIMA implementation using statsmodels
- Auto-parameter selection (auto_arima)
- Seasonal decomposition
- Backtesting validation framework

**Expected Benefits:**
- MAPE improvement: 3-5% for seasonal materials
- Better handling of complex patterns
- Automatic parameter tuning

### 13.2 Phase 3: ML Forecasting (Planned)

**Timeline:** Q3 2025

**Features:**
- LightGBM implementation using skforecast
- Feature engineering (lags, rolling windows, calendar features)
- Hyperparameter tuning with Optuna
- Model selection logic (AUTO algorithm)

**Expected Benefits:**
- MAPE improvement: 5-10% over SARIMA
- Better handling of multiple exogenous variables
- Automated model retraining

### 13.3 Phase 4: Demand Sensing (Planned)

**Timeline:** Q4 2025

**Features:**
- Real-time demand signal aggregation
- Sales order pipeline integration
- Anomaly detection (spike detection, trend shifts)
- Short-term forecast adjustments

**Expected Benefits:**
- 3-5 day earlier detection of demand changes
- Proactive stockout prevention
- Reduced safety stock requirements

### 13.4 Quick Wins (Priority Enhancements)

**Enhancement 1: GraphQL Authorization**
- **Effort:** 2 hours
- **Priority:** P1 for v2.0
- **Benefit:** Enhanced security with permission-based access control

**Enhancement 2: Materialized Views**
- **Effort:** 2 hours
- **Priority:** P3
- **Benefit:** Faster dashboard queries (pre-aggregated data)

**Enhancement 3: E2E Test Automation**
- **Effort:** 12 hours
- **Priority:** P2 for v2.0
- **Benefit:** Faster QA cycles, regression testing

**Enhancement 4: Forecast Accuracy Dashboard**
- **Effort:** 16 hours
- **Priority:** P2 for v2.0
- **Benefit:** Better visibility, data-driven decisions

**Enhancement 5: Multi-Period Seasonality**
- **Effort:** 4 hours
- **Priority:** P2 for v2.0
- **Benefit:** MAPE improvement 5-15% for monthly/quarterly patterns

---

## 14. RECOMMENDATIONS

### 14.1 Immediate Actions (P0)

**1. Fix Holt-Winters Algorithm**
- **Owner:** Roy (Backend)
- **Estimated Time:** 8-16 hours
- **Action Items:**
  - Debug seasonal component calculation
  - Review autocorrelation detection logic
  - Add unit tests for seasonal patterns
  - Retest with 90-day seasonal data

**2. Fix Safety Stock SQL Syntax Error**
- **Owner:** Roy (Backend)
- **Estimated Time:** 1-2 hours
- **Action Items:**
  - Review `safety-stock.service.ts` line 281
  - Fix SQL query syntax
  - Add unit tests for SQL query construction
  - Retest all safety stock calculation methods

**3. Ensure Database Migration Auto-Application**
- **Owner:** Berry (DevOps)
- **Estimated Time:** 2 hours
- **Action Items:**
  - Add migration verification script
  - Update deployment pipeline
  - Document manual table creation workaround

### 14.2 Short-Term Actions (P1)

**1. Deploy Phase 1 Features**
- **Timeline:** Week 1
- **Scope:** Moving Average, Exponential Smoothing, Demand History
- **Success Criteria:**
  - All GraphQL endpoints operational
  - Demand history backfilled for 100+ materials
  - Forecasts generated for A-class items
  - Dashboard accessible with no critical errors

**2. User Training & Documentation**
- **Timeline:** Week 2
- **Deliverables:**
  - User guide for Inventory Forecasting Dashboard
  - Admin guide for forecast configuration
  - API documentation for developers
  - Video tutorial for planners

**3. Monitor & Collect Feedback**
- **Timeline:** Weeks 2-4
- **Metrics:**
  - Forecast accuracy (MAPE)
  - User adoption rate
  - Recommendation acceptance rate
  - System performance

### 14.3 Mid-Term Actions (P2)

**1. Implement Authorization**
- **Timeline:** Month 2
- **Effort:** 8 hours
- **Deliverable:** Permission-based access control for all mutations

**2. E2E Test Automation**
- **Timeline:** Month 2
- **Effort:** 12 hours
- **Deliverable:** 100% automation coverage using Playwright

**3. Forecast Accuracy Dashboard**
- **Timeline:** Month 3
- **Effort:** 16 hours
- **Deliverable:** Dashboard showing MAPE trends, algorithm performance comparison

### 14.4 Long-Term Roadmap

**Q2 2025: Phase 2 - Statistical Forecasting**
- SARIMA implementation
- Python microservice
- Advanced seasonality detection

**Q3 2025: Phase 3 - ML Forecasting**
- LightGBM implementation
- Feature engineering
- Hyperparameter tuning

**Q4 2025: Phase 4 - Demand Sensing**
- Real-time demand signals
- Anomaly detection
- Sales pipeline integration

### 14.5 Success Metrics (First 3 Months)

**Month 1:**
- ✅ All GraphQL endpoints operational (100% uptime)
- ✅ Demand history backfilled for 100+ materials
- ✅ Forecasts generated for A-class items
- ✅ Dashboard accessible with no critical errors

**Month 2:**
- 🎯 Forecast accuracy MAPE <25% (target reached)
- 🎯 Recommendation acceptance rate >60%
- 🎯 Algorithm selection auto-tuning enabled
- 🎯 Seasonal patterns detected for 20+ materials

**Month 3:**
- 🎯 Full rollout to all materials (1000+ items)
- 🎯 Stockout reduction: >20% (moving toward 30% target)
- 🎯 Inventory cost savings: >10% (moving toward 15% target)
- 🎯 Planning efficiency: >40% time savings (moving toward 50% target)

### 14.6 Risk Mitigation

**Risk 1: Low Forecast Accuracy (MAPE >40%)**
- **Mitigation:** Algorithm selection tuning, manual override capability
- **Contingency:** Revert to manual planning for problematic materials

**Risk 2: User Adoption Resistance**
- **Mitigation:** Training, demonstration of value, gradual rollout
- **Contingency:** Start with A-class items, expand based on success

**Risk 3: Performance Degradation at Scale**
- **Mitigation:** Batch processing, database partitioning, caching
- **Contingency:** Horizontal scaling, read replicas

**Risk 4: Data Quality Issues**
- **Mitigation:** Data validation, outlier detection, backfill verification
- **Contingency:** Manual data correction, exclude problematic materials

---

## CONCLUSION

The Inventory Forecasting feature represents a comprehensive implementation of demand planning capabilities for the AGOG Print Industry ERP system. Phase 1 has successfully delivered 3 forecasting algorithms, safety stock calculations, and a complete GraphQL API with frontend dashboard.

**Key Achievements:**
- ✅ Database schema with 5 core tables, full RLS, and comprehensive indexing
- ✅ 3 forecasting algorithms (MA, SES, HW) with automatic selection
- ✅ 6 GraphQL queries and 5 mutations for complete lifecycle management
- ✅ Performance benchmarks all exceeded with significant margins
- ✅ Mathematical validation of all formulas (Priya)

**Critical Issues Requiring Resolution:**
- ❌ Holt-Winters algorithm zero forecast bug (P0)
- ❌ Safety Stock SQL syntax error (P0)

**Deployment Recommendation:**
- **Phase 1:** APPROVED for production (Moving Average, Exponential Smoothing)
- **Phase 2:** HOLD until P0 bugs fixed (Holt-Winters, Safety Stock)

**Expected Business Impact (Post-Full Deployment):**
- 30% reduction in stockout events
- 15% inventory carrying cost savings
- 50% planning time efficiency improvement
- 15-25% forecast accuracy (MAPE) for most materials

This research deliverable provides a complete technical foundation for the Inventory Forecasting feature and establishes clear pathways for future enhancements through advanced statistical and machine learning methods.

---

**Research Analyst:** CYNTHIA
**Date:** 2025-12-27
**Status:** COMPLETE
**Next Actions:** Fix P0 bugs → Deploy Phase 1 → Monitor & Iterate

---

**END OF RESEARCH DELIVERABLE**
