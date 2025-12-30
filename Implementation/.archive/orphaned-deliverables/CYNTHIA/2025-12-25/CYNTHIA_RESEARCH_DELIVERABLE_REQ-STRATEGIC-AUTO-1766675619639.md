# Research Deliverable: Inventory Forecasting Feature
## REQ-STRATEGIC-AUTO-1766675619639

**Research Agent:** Cynthia
**Date:** 2025-12-25
**Status:** COMPLETE
**Assigned To:** Marcus (Implementation Lead)

---

## Executive Summary

This research deliverable provides comprehensive technical specifications, algorithmic recommendations, and implementation guidance for adding advanced **Inventory Forecasting** capabilities to the AGOG Print Industry ERP system. The proposed solution builds upon the existing robust inventory management infrastructure and statistical analysis framework already present in the codebase.

**Key Findings:**
- Current system has **excellent foundational infrastructure** for inventory tracking, ABC classification, lot traceability, and vendor performance
- Statistical analysis framework exists but is **not integrated with demand forecasting/replenishment**
- Print industry requires **dual-track forecasting**: raw materials (substrates, inks, adhesives) and finished goods (printed products)
- Modern forecasting approaches favor **hybrid models** combining traditional statistical methods (ARIMA/SARIMA) with gradient boosting ML models (LightGBM/XGBoost)
- **Demand sensing** (real-time, short-term) complements traditional forecasting (long-term strategic) for optimal inventory management

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Print Industry Forecasting Requirements](#2-print-industry-forecasting-requirements)
3. [Forecasting Algorithm Recommendations](#3-forecasting-algorithm-recommendations)
4. [Technical Architecture](#4-technical-architecture)
5. [Database Schema Design](#5-database-schema-design)
6. [GraphQL API Design](#6-graphql-api-design)
7. [Safety Stock & Reorder Point Calculations](#7-safety-stock--reorder-point-calculations)
8. [Integration Points](#8-integration-points)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Success Metrics & KPIs](#10-success-metrics--kpis)
11. [Research Sources](#11-research-sources)

---

## 1. Current State Analysis

### 1.1 Existing Infrastructure

The AGOG ERP system has a **production-ready foundation** for inventory forecasting:

**Inventory Management Capabilities:**
- ✅ **Lot Traceability**: Comprehensive lot tracking with vendor lot numbers, purchase orders, expiration dates
- ✅ **ABC Classification**: Applied to both materials and warehouse locations for cycle counting and velocity-based management
- ✅ **Quality Management**: Quality status tracking, inspections, certifications (FDA, FSC, food contact approved)
- ✅ **Multi-Tenant WMS**: 5-tier security zones, location hierarchy (Zone → Aisle → Rack → Shelf → Bin)
- ✅ **Inventory Transactions**: Full audit trail of RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, CYCLE_COUNT, RETURN, SCRAP
- ✅ **Reservation Management**: Soft/hard/allocated reservations linked to sales orders and production orders
- ✅ **Vendor Performance Tracking**: On-time delivery %, quality acceptance %, 12-month rolling metrics
- ✅ **Financial Integration**: Unit costs, total costs tracked per transaction with FIFO/LIFO/AVERAGE/STANDARD costing methods

**Materials & Procurement:**
- ✅ **Material Master Data**: Material types (RAW_MATERIAL, SUBSTRATE, INK, ADHESIVE, CONSUMABLE, FINISHED_GOOD)
- ✅ **Lead Time Tracking**: Lead time days per material and per supplier
- ✅ **Reorder Points & Safety Stock**: Data fields exist in `materials` table (not yet exposed in API or used for automated replenishment)
- ✅ **Economic Order Quantity (EOQ)**: Field exists but calculations not implemented
- ✅ **Supplier Relationships**: Material-supplier mappings with pricing, lead times, minimum order quantities, price breaks

**Statistical Analysis Framework:**
- ✅ **Advanced Statistical Methods**: Descriptive statistics, hypothesis testing, correlation analysis, regression, outlier detection, time-series trend detection
- ✅ **A/B Testing Framework**: Control vs. treatment group comparison, effect size calculations, statistical significance testing
- ✅ **Performance Metrics**: Sample size validation, confidence intervals, p-value calculations
- **LIMITATION**: Currently applied only to bin utilization optimization, **not integrated with demand forecasting or replenishment planning**

**Key Files:**
- Database Schema: `backend/migrations/V0.0.4__create_wms_module.sql`, `V0.0.6__create_sales_materials_procurement.sql`
- GraphQL Schemas: `backend/src/graphql/schema/wms.graphql`, `sales-materials.graphql`
- Resolvers: `backend/src/graphql/resolvers/wms.resolver.ts`, `sales-materials.resolver.ts`
- Statistical Service: `backend/src/modules/wms/services/bin-utilization-statistical-analysis.service.ts`
- Vendor Performance: `backend/src/modules/procurement/services/vendor-performance.service.ts`

### 1.2 Gaps for Inventory Forecasting

**Missing Capabilities:**
- ❌ **Demand Forecasting Engine**: No time-series forecasting algorithms (ARIMA, SARIMA, ML models)
- ❌ **Demand History Tracking**: No dedicated table for historical demand/consumption patterns
- ❌ **Forecast Model Management**: No model versioning, backtesting, or accuracy tracking
- ❌ **Automated Replenishment**: No automated reorder point triggers or purchase order suggestions
- ❌ **Forecast Overrides**: No mechanism for manual forecast adjustments by planners
- ❌ **Seasonality Detection**: No automatic detection of seasonal patterns (print industry has seasonal peaks)
- ❌ **Promotional Impact**: No tracking of promotional events' impact on demand
- ❌ **Demand Sensing**: No real-time demand signal integration (POS data, web orders, manufacturing schedule changes)
- ❌ **Multi-Echelon Planning**: No consideration of inventory levels across distribution centers/warehouses
- ❌ **Forecast Collaboration**: No workflow for sales/marketing input into forecasts

---

## 2. Print Industry Forecasting Requirements

### 2.1 Industry-Specific Characteristics

Based on research into print manufacturing and HP Inc.'s demand forecasting practices, print industry inventory forecasting has unique requirements:

**Raw Materials (Push Strategy):**
- **Substrates** (paper, cardstock, vinyl, fabric): Long lead times (30-90 days for specialty substrates), bulk purchasing for economies of scale, high storage costs
- **Inks** (offset, flexographic, digital): Shelf life constraints (6-18 months), color matching criticality, batch-to-batch variation
- **Adhesives & Coatings**: Expiration date management, temperature-controlled storage, small batch sizes
- **Consumables**: High variability based on production volume, low unit cost, frequent replenishment

**Finished Goods (Pull Strategy):**
- **Made-to-Order Products**: Low/no finished goods inventory, forecasting drives material procurement
- **Stock Products**: Catalog items with predictable demand, seasonal variations (calendars, holiday cards, promotional materials)
- **Print-on-Demand**: Zero inventory model for digital printing, forecasting focuses on substrate/ink consumption

**Demand Patterns:**
- **Seasonality**: Strong seasonal peaks (Q4 holidays, back-to-school, tax season for forms)
- **Promotional Impact**: Marketing campaigns, sales promotions, new product launches cause spikes
- **Customer-Specific**: Large accounts with contractual volumes, spot orders from small customers
- **Economic Sensitivity**: B2B print demand correlates with GDP, marketing budgets, event calendars

**Supply Chain Challenges (2025 Context):**
- **Geopolitical Uncertainty**: Tariff policies, supply chain regionalization
- **Quality Consistency**: Substrate quality variations impact print quality, requiring vendor management
- **Lead Time Variability**: International suppliers face port congestion, customs delays
- **Capacity Constraints**: Press capacity, finishing equipment capacity limit production throughput

### 2.2 Forecasting Horizons

Print industry requires **multi-horizon forecasting**:

| Horizon | Timeframe | Purpose | Update Frequency | Methods |
|---------|-----------|---------|------------------|---------|
| **Short-Term** | 1-30 days | Production scheduling, WIP allocation | Daily | Demand Sensing, Moving Average, Exponential Smoothing |
| **Medium-Term** | 1-6 months | Material procurement, capacity planning | Weekly | SARIMA, LightGBM, Holt-Winters |
| **Long-Term** | 6-24 months | Strategic planning, vendor contracts, capital investments | Monthly/Quarterly | ARIMA, ML ensemble, trend analysis |

**Recommendation**: Implement **short-term** and **medium-term** forecasting initially, add long-term strategic forecasting in Phase 2.

---

## 3. Forecasting Algorithm Recommendations

### 3.1 Algorithm Selection Framework

Based on research comparing traditional statistical methods with modern machine learning approaches, a **hybrid tiered approach** is recommended:

**Tier 1: Statistical Baseline (SARIMA)**
- **Algorithm**: Seasonal ARIMA (AutoRegressive Integrated Moving Average with Seasonality)
- **Use Case**: Materials with stable demand, clear seasonal patterns, sufficient history (>24 months)
- **Advantages**:
  - Statistically robust, interpretable, well-understood by planners
  - Handles trend and seasonality explicitly
  - Low computational cost, fast to train and retrain
  - Provides prediction intervals (confidence bands)
- **Limitations**:
  - Assumes linear relationships
  - Requires manual parameter tuning (p, d, q, P, D, Q, s)
  - Struggles with sudden regime changes
- **Implementation**: Use Python `statsmodels` library or R `forecast` package

**Tier 2: Gradient Boosting ML (LightGBM)**
- **Algorithm**: Light Gradient Boosting Machine (tree-based ensemble)
- **Use Case**: Materials with complex demand patterns, external drivers (promotions, economic indicators), shorter history (>75 data points)
- **Advantages**:
  - Captures non-linear relationships and complex interactions
  - Easily incorporates exogenous variables (price, promotions, weather, competitor activity)
  - Proven 5-10% accuracy improvement over SARIMA in production environments (HP Inc. study)
  - Fast training, handles large datasets efficiently
  - Feature importance analysis reveals demand drivers
- **Limitations**:
  - Less interpretable than SARIMA (black box)
  - Requires feature engineering
  - Can overfit if not properly regularized
- **Implementation**: Use Python `lightgbm` library with `skforecast` wrapper for time-series

**Tier 3: Simple Methods (MA/ES)**
- **Algorithms**: Moving Average, Simple Exponential Smoothing
- **Use Case**: Materials with erratic/intermittent demand, new products (<12 months history), low-value C-class items
- **Advantages**:
  - Simple, fast, no hyperparameter tuning
  - Responsive to recent demand changes
  - Low computational overhead
- **Limitations**:
  - No explicit trend or seasonality handling
  - Short memory (moving average window)
- **Implementation**: Custom TypeScript implementation or Python `statsmodels`

### 3.2 Model Selection Logic

**Decision Tree for Algorithm Selection:**

```
IF material has >= 24 months history AND clear seasonality
  → Use SARIMA (Tier 1)
ELSE IF material has >= 6 months history AND exogenous variables available
  → Use LightGBM (Tier 2)
ELSE IF material is A-class (high value/volume) AND >= 3 months history
  → Use Exponential Smoothing (Tier 3)
ELSE
  → Use Moving Average or manual forecast (Tier 3)
```

**ABC Classification Integration:**
- **A-Class Items** (80% of value, 20% of items): Apply Tier 1 or Tier 2 with daily/weekly updates, high forecast accuracy targets (MAPE <15%)
- **B-Class Items** (15% of value, 30% of items): Apply Tier 2 or Tier 3 with weekly updates, moderate accuracy targets (MAPE <25%)
- **C-Class Items** (5% of value, 50% of items): Apply Tier 3 with monthly updates or min/max inventory policies, low accuracy targets (MAPE <40%)

### 3.3 Performance Benchmarks (Research-Based)

Industry research shows the following accuracy improvements:

| Metric | Traditional Forecasting | With Demand Sensing | With ML (LightGBM/XGBoost) |
|--------|-------------------------|---------------------|----------------------------|
| **MAPE (Mean Absolute Percentage Error)** | 30-40% | 18-24% | 15-20% |
| **Bias** | -5% to +10% | -2% to +2% | -1% to +1% |
| **Forecast Error Reduction** | Baseline | 30-40% improvement | 40-50% improvement |
| **Detection Speed** | 15-30 days | 3-5 days | 1-3 days |
| **Inventory Reduction Potential** | Baseline | 5-10% | 10-20% |
| **Stockout Reduction** | Baseline | 30-50% | 50-70% |

**Target Metrics for AGOG ERP:**
- **Phase 1 (SARIMA + Simple Methods)**: Achieve <25% MAPE for A-class items, <35% for B-class
- **Phase 2 (LightGBM + Demand Sensing)**: Achieve <18% MAPE for A-class items, <25% for B-class
- **Phase 3 (Optimization)**: Achieve <15% MAPE for A-class items through continuous improvement

---

## 4. Technical Architecture

### 4.1 System Components

**Forecasting Service Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                     GraphQL API Layer                        │
│  - ForecastingResolver: Query forecasts, run forecasts     │
│  - ReplenishmentResolver: Generate PO suggestions          │
│  - DemandHistoryResolver: Track actual vs. forecast        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Business Logic Layer                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ForecastingService (TypeScript)                      │  │
│  │ - orchestrateForecastGeneration()                    │  │
│  │ - selectForecastingAlgorithm()                       │  │
│  │ - calculateSafetyStock()                             │  │
│  │ - calculateReorderPoint()                            │  │
│  │ - generateReplenishmentSuggestions()                 │  │
│  │ - trackForecastAccuracy()                            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ DemandSensingService (TypeScript)                    │  │
│  │ - aggregateRealtimeDemand()                          │  │
│  │ - detectAnomalies()                                  │  │
│  │ - adjustShortTermForecast()                          │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ForecastAccuracyService (TypeScript)                 │  │
│  │ - calculateMAPE()                                    │  │
│  │ - calculateBias()                                    │  │
│  │ - trackForecastVsActual()                            │  │
│  │ - generateAccuracyReport()                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Python Forecasting Engine (Microservice)           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ SARIMA Forecaster (statsmodels)                      │  │
│  │ - auto_arima parameter selection                     │  │
│  │ - seasonal decomposition                             │  │
│  │ - prediction intervals                               │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ LightGBM Forecaster (skforecast + lightgbm)          │  │
│  │ - feature engineering (lags, rolling stats, calendar)│  │
│  │ - hyperparameter tuning (Optuna)                     │  │
│  │ - backtesting & validation                           │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Simple Methods (custom implementations)              │  │
│  │ - moving average, exponential smoothing              │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ REST API (FastAPI)                                   │  │
│  │ POST /forecast/generate                              │  │
│  │ POST /forecast/backtest                              │  │
│  │ GET /forecast/model-performance                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
│  - demand_history (actuals tracking)                        │
│  - material_forecasts (forecast results)                    │
│  - forecast_models (model metadata)                         │
│  - forecast_accuracy_metrics (MAPE, bias tracking)          │
│  - replenishment_suggestions (PO recommendations)           │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Technology Stack

**Backend (TypeScript/Node.js):**
- **GraphQL API**: Apollo Server (existing pattern)
- **Business Logic**: TypeScript services in `backend/src/modules/forecasting/services/`
- **Database Access**: `pg` library (existing pattern)
- **HTTP Client**: `axios` for calling Python microservice

**Python Forecasting Engine:**
- **Web Framework**: FastAPI (async, high performance, auto-generated OpenAPI docs)
- **Statistical Forecasting**: `statsmodels` (ARIMA, SARIMA, exponential smoothing)
- **ML Forecasting**: `lightgbm` + `skforecast` (time-series specific wrapper)
- **Data Processing**: `pandas`, `numpy`
- **Hyperparameter Tuning**: `optuna` (Bayesian optimization)
- **Model Serialization**: `joblib` or `pickle`
- **Database**: `psycopg2` or `asyncpg` for PostgreSQL connection

**Deployment:**
- **Python Service**: Docker container, deployed alongside backend (Docker Compose for dev, Kubernetes for prod)
- **Port**: 8001 (to avoid conflict with backend on 8000)
- **Health Checks**: `/health` endpoint for liveness/readiness probes

### 4.3 Data Flow

**Forecast Generation Flow:**

1. **Trigger**: Scheduled job (daily/weekly) or manual trigger via GraphQL mutation
2. **ForecastingService**:
   - Queries `materials` table for active materials requiring forecasts
   - Queries `demand_history` table for historical demand data
   - Queries `forecast_models` table for model configuration
3. **Python Microservice Call**:
   - POST request to `/forecast/generate` with material_id, demand history, exogenous variables
   - Python engine selects algorithm, trains model, generates forecast
   - Returns forecast values, prediction intervals, model metadata
4. **Database Persistence**:
   - Inserts forecast results into `material_forecasts` table
   - Updates `forecast_models` table with training metadata
5. **Replenishment Logic**:
   - Compares forecasted demand with current on-hand inventory, safety stock, reorder point
   - Generates replenishment suggestions if inventory projected to fall below reorder point
   - Inserts into `replenishment_suggestions` table
6. **Notification**:
   - Optional: Send alerts to materials planners for review

**Demand History Tracking Flow:**

1. **Trigger**: Inventory transaction (ISSUE, SALES_ORDER_FULFILLMENT, PRODUCTION_CONSUMPTION)
2. **DemandHistoryService**:
   - Aggregates daily demand by material
   - Inserts/updates `demand_history` table
3. **Forecast Accuracy Calculation**:
   - Compares actual demand with previously generated forecast
   - Calculates MAPE, bias, other accuracy metrics
   - Updates `forecast_accuracy_metrics` table

---

## 5. Database Schema Design

### 5.1 New Tables

**Table: `demand_history`**

Tracks historical demand (consumption) for each material to feed forecasting algorithms.

```sql
CREATE TABLE demand_history (
  demand_history_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  facility_id UUID NOT NULL REFERENCES facilities(facility_id),
  material_id UUID NOT NULL REFERENCES materials(material_id),

  -- Time dimensions
  demand_date DATE NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week_of_year INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  quarter INTEGER NOT NULL,
  is_holiday BOOLEAN DEFAULT FALSE,
  is_promotional_period BOOLEAN DEFAULT FALSE,

  -- Demand quantities
  actual_demand_quantity DECIMAL(15, 4) NOT NULL,
  forecasted_demand_quantity DECIMAL(15, 4),
  demand_uom VARCHAR(10) NOT NULL,

  -- Demand sources (disaggregation)
  sales_order_demand DECIMAL(15, 4) DEFAULT 0,
  production_order_demand DECIMAL(15, 4) DEFAULT 0,
  transfer_order_demand DECIMAL(15, 4) DEFAULT 0,
  scrap_adjustment DECIMAL(15, 4) DEFAULT 0,

  -- External factors (exogenous variables)
  avg_unit_price DECIMAL(15, 4),
  promotional_discount_pct DECIMAL(5, 2),
  marketing_campaign_active BOOLEAN DEFAULT FALSE,

  -- Forecast accuracy metrics (calculated post-facto)
  forecast_error DECIMAL(15, 4),
  absolute_percentage_error DECIMAL(5, 2),

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by VARCHAR(100),

  CONSTRAINT uq_demand_history_material_date UNIQUE (tenant_id, facility_id, material_id, demand_date)
);

CREATE INDEX idx_demand_history_tenant_facility ON demand_history(tenant_id, facility_id);
CREATE INDEX idx_demand_history_material ON demand_history(material_id);
CREATE INDEX idx_demand_history_date ON demand_history(demand_date DESC);
CREATE INDEX idx_demand_history_material_date_range ON demand_history(material_id, demand_date);
```

**Table: `material_forecasts`**

Stores generated forecasts for future time periods.

```sql
CREATE TABLE material_forecasts (
  forecast_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  facility_id UUID NOT NULL REFERENCES facilities(facility_id),
  material_id UUID NOT NULL REFERENCES materials(material_id),
  forecast_model_id UUID REFERENCES forecast_models(forecast_model_id),

  -- Forecast metadata
  forecast_generation_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  forecast_version INTEGER NOT NULL,
  forecast_horizon_type VARCHAR(20) NOT NULL, -- 'SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM'
  forecast_algorithm VARCHAR(50) NOT NULL, -- 'SARIMA', 'LIGHTGBM', 'MOVING_AVERAGE', 'EXP_SMOOTHING'

  -- Forecast period
  forecast_date DATE NOT NULL,
  forecast_year INTEGER NOT NULL,
  forecast_month INTEGER NOT NULL,
  forecast_week_of_year INTEGER NOT NULL,

  -- Forecast quantities
  forecasted_demand_quantity DECIMAL(15, 4) NOT NULL,
  forecast_uom VARCHAR(10) NOT NULL,

  -- Prediction intervals (confidence bands)
  lower_bound_80_pct DECIMAL(15, 4),
  upper_bound_80_pct DECIMAL(15, 4),
  lower_bound_95_pct DECIMAL(15, 4),
  upper_bound_95_pct DECIMAL(15, 4),

  -- Model confidence
  model_confidence_score DECIMAL(5, 4), -- 0.0 to 1.0

  -- Manual overrides
  is_manually_overridden BOOLEAN DEFAULT FALSE,
  manual_override_quantity DECIMAL(15, 4),
  manual_override_by VARCHAR(100),
  manual_override_reason TEXT,

  -- Status
  forecast_status VARCHAR(20) DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUPERSEDED', 'REJECTED'

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by VARCHAR(100),

  CONSTRAINT uq_material_forecast_version UNIQUE (tenant_id, facility_id, material_id, forecast_date, forecast_version)
);

CREATE INDEX idx_material_forecasts_tenant_facility ON material_forecasts(tenant_id, facility_id);
CREATE INDEX idx_material_forecasts_material ON material_forecasts(material_id);
CREATE INDEX idx_material_forecasts_date ON material_forecasts(forecast_date);
CREATE INDEX idx_material_forecasts_status ON material_forecasts(forecast_status);
CREATE INDEX idx_material_forecasts_material_date_range ON material_forecasts(material_id, forecast_date);
```

**Table: `forecast_models`**

Tracks metadata about trained forecasting models for versioning and auditability.

```sql
CREATE TABLE forecast_models (
  forecast_model_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  facility_id UUID NOT NULL REFERENCES facilities(facility_id),
  material_id UUID REFERENCES materials(material_id),

  -- Model identification
  model_name VARCHAR(100) NOT NULL,
  model_algorithm VARCHAR(50) NOT NULL, -- 'SARIMA', 'LIGHTGBM', 'MOVING_AVERAGE', 'EXP_SMOOTHING'
  model_version VARCHAR(20) NOT NULL,

  -- Training metadata
  training_start_date DATE NOT NULL,
  training_end_date DATE NOT NULL,
  training_sample_size INTEGER NOT NULL,
  training_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Model parameters (JSON for flexibility)
  model_hyperparameters JSONB, -- SARIMA: {p, d, q, P, D, Q, s}, LightGBM: {n_estimators, max_depth, ...}
  feature_list JSONB, -- List of features used (for ML models)

  -- Model performance metrics (from backtesting)
  backtest_mape DECIMAL(5, 2),
  backtest_rmse DECIMAL(15, 4),
  backtest_mae DECIMAL(15, 4),
  backtest_bias DECIMAL(15, 4),
  backtest_r_squared DECIMAL(5, 4),

  -- Model status
  model_status VARCHAR(20) DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'RETIRED'
  is_default_model BOOLEAN DEFAULT FALSE,

  -- Model artifact (serialized model file path or binary)
  model_artifact_path VARCHAR(500), -- Path to saved model file in object storage
  model_artifact_size_bytes BIGINT,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by VARCHAR(100)
);

CREATE INDEX idx_forecast_models_tenant_facility ON forecast_models(tenant_id, facility_id);
CREATE INDEX idx_forecast_models_material ON forecast_models(material_id);
CREATE INDEX idx_forecast_models_algorithm ON forecast_models(model_algorithm);
CREATE INDEX idx_forecast_models_status ON forecast_models(model_status);
```

**Table: `forecast_accuracy_metrics`**

Aggregated forecast accuracy metrics calculated periodically (daily, weekly, monthly).

```sql
CREATE TABLE forecast_accuracy_metrics (
  metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  facility_id UUID NOT NULL REFERENCES facilities(facility_id),
  material_id UUID REFERENCES materials(material_id),
  forecast_model_id UUID REFERENCES forecast_models(forecast_model_id),

  -- Time period
  measurement_period_start DATE NOT NULL,
  measurement_period_end DATE NOT NULL,
  aggregation_level VARCHAR(20) NOT NULL, -- 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY'

  -- Accuracy metrics
  mape DECIMAL(5, 2), -- Mean Absolute Percentage Error
  rmse DECIMAL(15, 4), -- Root Mean Squared Error
  mae DECIMAL(15, 4), -- Mean Absolute Error
  bias DECIMAL(15, 4), -- Mean Forecast Error (Bias)
  tracking_signal DECIMAL(15, 4), -- Cumulative sum of forecast errors / MAD

  -- Sample statistics
  sample_size INTEGER NOT NULL,
  total_actual_demand DECIMAL(15, 4),
  total_forecasted_demand DECIMAL(15, 4),

  -- Performance flags
  is_within_tolerance BOOLEAN, -- TRUE if MAPE <= target threshold
  target_mape_threshold DECIMAL(5, 2),

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),

  CONSTRAINT uq_forecast_accuracy_period UNIQUE (tenant_id, facility_id, material_id, measurement_period_start, measurement_period_end, aggregation_level)
);

CREATE INDEX idx_forecast_accuracy_tenant_facility ON forecast_accuracy_metrics(tenant_id, facility_id);
CREATE INDEX idx_forecast_accuracy_material ON forecast_accuracy_metrics(material_id);
CREATE INDEX idx_forecast_accuracy_period ON forecast_accuracy_metrics(measurement_period_start, measurement_period_end);
```

**Table: `replenishment_suggestions`**

System-generated purchase order suggestions based on forecasts and inventory levels.

```sql
CREATE TABLE replenishment_suggestions (
  suggestion_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  facility_id UUID NOT NULL REFERENCES facilities(facility_id),
  material_id UUID NOT NULL REFERENCES materials(material_id),
  preferred_vendor_id UUID REFERENCES vendors(vendor_id),

  -- Suggestion metadata
  suggestion_generation_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  suggestion_status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'CONVERTED_TO_PO', 'EXPIRED'

  -- Inventory levels (snapshot at suggestion time)
  current_on_hand_quantity DECIMAL(15, 4) NOT NULL,
  current_allocated_quantity DECIMAL(15, 4) NOT NULL,
  current_available_quantity DECIMAL(15, 4) NOT NULL,
  current_on_order_quantity DECIMAL(15, 4) NOT NULL,

  -- Planning parameters
  safety_stock_quantity DECIMAL(15, 4) NOT NULL,
  reorder_point_quantity DECIMAL(15, 4) NOT NULL,
  economic_order_quantity DECIMAL(15, 4),

  -- Forecast-driven calculations
  forecasted_demand_30_days DECIMAL(15, 4) NOT NULL,
  forecasted_demand_60_days DECIMAL(15, 4),
  forecasted_demand_90_days DECIMAL(15, 4),
  projected_stockout_date DATE,

  -- Replenishment recommendation
  recommended_order_quantity DECIMAL(15, 4) NOT NULL,
  recommended_order_uom VARCHAR(10) NOT NULL,
  recommended_order_date DATE NOT NULL,
  recommended_delivery_date DATE,

  -- Vendor information
  estimated_unit_cost DECIMAL(15, 4),
  estimated_total_cost DECIMAL(15, 4),
  vendor_lead_time_days INTEGER,

  -- Justification
  suggestion_reason TEXT, -- Human-readable explanation
  calculation_method VARCHAR(50), -- 'FORECAST_BASED', 'REORDER_POINT', 'MIN_MAX', 'EOQ'

  -- User actions
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  converted_purchase_order_id UUID REFERENCES purchase_orders(purchase_order_id),

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by VARCHAR(100)
);

CREATE INDEX idx_replenishment_suggestions_tenant_facility ON replenishment_suggestions(tenant_id, facility_id);
CREATE INDEX idx_replenishment_suggestions_material ON replenishment_suggestions(material_id);
CREATE INDEX idx_replenishment_suggestions_status ON replenishment_suggestions(suggestion_status);
CREATE INDEX idx_replenishment_suggestions_vendor ON replenishment_suggestions(preferred_vendor_id);
CREATE INDEX idx_replenishment_suggestions_order_date ON replenishment_suggestions(recommended_order_date);
```

### 5.2 Schema Extensions to Existing Tables

**Extend `materials` table with forecasting configuration:**

```sql
ALTER TABLE materials ADD COLUMN IF NOT EXISTS forecasting_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS forecast_algorithm VARCHAR(50) DEFAULT 'AUTO'; -- 'AUTO', 'SARIMA', 'LIGHTGBM', 'MOVING_AVERAGE'
ALTER TABLE materials ADD COLUMN IF NOT EXISTS forecast_horizon_days INTEGER DEFAULT 90;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS forecast_update_frequency VARCHAR(20) DEFAULT 'WEEKLY'; -- 'DAILY', 'WEEKLY', 'MONTHLY'
ALTER TABLE materials ADD COLUMN IF NOT EXISTS minimum_forecast_history_days INTEGER DEFAULT 90;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS target_forecast_accuracy_pct DECIMAL(5, 2) DEFAULT 20.00; -- Target MAPE
ALTER TABLE materials ADD COLUMN IF NOT EXISTS demand_pattern VARCHAR(20); -- 'STABLE', 'SEASONAL', 'INTERMITTENT', 'LUMPY', 'ERRATIC'
```

---

## 6. GraphQL API Design

### 6.1 GraphQL Schema Extensions

**File: `backend/src/graphql/schema/forecasting.graphql`**

```graphql
# ============================================================================
# ENUMS
# ============================================================================

enum ForecastHorizonType {
  SHORT_TERM
  MEDIUM_TERM
  LONG_TERM
}

enum ForecastAlgorithm {
  SARIMA
  LIGHTGBM
  MOVING_AVERAGE
  EXP_SMOOTHING
  AUTO
}

enum ForecastStatus {
  ACTIVE
  SUPERSEDED
  REJECTED
}

enum ReplenishmentSuggestionStatus {
  PENDING
  APPROVED
  REJECTED
  CONVERTED_TO_PO
  EXPIRED
}

enum DemandPattern {
  STABLE
  SEASONAL
  INTERMITTENT
  LUMPY
  ERRATIC
}

# ============================================================================
# TYPES
# ============================================================================

type DemandHistory {
  demandHistoryId: ID!
  tenantId: ID!
  facilityId: ID!
  materialId: ID!
  material: Material!

  demandDate: Date!
  year: Int!
  month: Int!
  weekOfYear: Int!
  dayOfWeek: Int!
  quarter: Int!
  isHoliday: Boolean!
  isPromotionalPeriod: Boolean!

  actualDemandQuantity: Float!
  forecastedDemandQuantity: Float
  demandUom: String!

  salesOrderDemand: Float!
  productionOrderDemand: Float!
  transferOrderDemand: Float!
  scrapAdjustment: Float!

  avgUnitPrice: Float
  promotionalDiscountPct: Float
  marketingCampaignActive: Boolean!

  forecastError: Float
  absolutePercentageError: Float

  createdAt: DateTime!
  createdBy: String
}

type MaterialForecast {
  forecastId: ID!
  tenantId: ID!
  facilityId: ID!
  materialId: ID!
  material: Material!
  forecastModelId: ID
  forecastModel: ForecastModel

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

  createdAt: DateTime!
}

type ForecastModel {
  forecastModelId: ID!
  tenantId: ID!
  facilityId: ID!
  materialId: ID
  material: Material

  modelName: String!
  modelAlgorithm: ForecastAlgorithm!
  modelVersion: String!

  trainingStartDate: Date!
  trainingEndDate: Date!
  trainingSampleSize: Int!
  trainingTimestamp: DateTime!

  modelHyperparameters: JSON
  featureList: JSON

  backtestMape: Float
  backtestRmse: Float
  backtestMae: Float
  backtestBias: Float
  backtestRSquared: Float

  modelStatus: String!
  isDefaultModel: Boolean!

  modelArtifactPath: String
  modelArtifactSizeBytes: Int

  createdAt: DateTime!
}

type ForecastAccuracyMetric {
  metricId: ID!
  tenantId: ID!
  facilityId: ID!
  materialId: ID
  material: Material
  forecastModelId: ID
  forecastModel: ForecastModel

  measurementPeriodStart: Date!
  measurementPeriodEnd: Date!
  aggregationLevel: String!

  mape: Float
  rmse: Float
  mae: Float
  bias: Float
  trackingSignal: Float

  sampleSize: Int!
  totalActualDemand: Float
  totalForecastedDemand: Float

  isWithinTolerance: Boolean
  targetMapeThreshold: Float

  createdAt: DateTime!
}

type ReplenishmentSuggestion {
  suggestionId: ID!
  tenantId: ID!
  facilityId: ID!
  materialId: ID!
  material: Material!
  preferredVendorId: ID
  preferredVendor: Vendor

  suggestionGenerationTimestamp: DateTime!
  suggestionStatus: ReplenishmentSuggestionStatus!

  currentOnHandQuantity: Float!
  currentAllocatedQuantity: Float!
  currentAvailableQuantity: Float!
  currentOnOrderQuantity: Float!

  safetyStockQuantity: Float!
  reorderPointQuantity: Float!
  economicOrderQuantity: Float

  forecastedDemand30Days: Float!
  forecastedDemand60Days: Float
  forecastedDemand90Days: Float
  projectedStockoutDate: Date

  recommendedOrderQuantity: Float!
  recommendedOrderUom: String!
  recommendedOrderDate: Date!
  recommendedDeliveryDate: Date

  estimatedUnitCost: Float
  estimatedTotalCost: Float
  vendorLeadTimeDays: Int

  suggestionReason: String
  calculationMethod: String

  reviewedBy: String
  reviewedAt: DateTime
  reviewNotes: String
  convertedPurchaseOrderId: ID
  convertedPurchaseOrder: PurchaseOrder

  createdAt: DateTime!
  updatedAt: DateTime!
}

type ForecastAccuracySummary {
  materialId: ID!
  material: Material!

  last30DaysMape: Float
  last60DaysMape: Float
  last90DaysMape: Float

  last30DaysBias: Float
  last60DaysBias: Float
  last90DaysBias: Float

  totalForecastsGenerated: Int!
  totalActualDemandRecorded: Int!

  currentForecastAlgorithm: ForecastAlgorithm
  lastForecastGenerationDate: DateTime
}

# ============================================================================
# INPUTS
# ============================================================================

input GenerateForecastInput {
  tenantId: ID!
  facilityId: ID!
  materialIds: [ID!] # If empty, generate for all active materials
  forecastHorizonDays: Int! # 30, 60, 90, etc.
  forecastAlgorithm: ForecastAlgorithm # If null, use AUTO selection
  includeBacktest: Boolean # Run backtesting validation
}

input ManualForecastOverrideInput {
  forecastId: ID!
  manualOverrideQuantity: Float!
  manualOverrideReason: String!
}

input UpdateReplenishmentSuggestionInput {
  suggestionId: ID!
  suggestionStatus: ReplenishmentSuggestionStatus!
  reviewNotes: String
}

input GenerateReplenishmentSuggestionsInput {
  tenantId: ID!
  facilityId: ID!
  materialIds: [ID!] # If empty, generate for all materials
  forecastHorizonDays: Int! # 30, 60, 90, etc.
}

input RecordActualDemandInput {
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
}

# ============================================================================
# QUERIES
# ============================================================================

type Query {
  # Get forecast for a specific material and date range
  getMaterialForecasts(
    tenantId: ID!
    facilityId: ID!
    materialId: ID!
    startDate: Date!
    endDate: Date!
    forecastStatus: ForecastStatus
  ): [MaterialForecast!]!

  # Get demand history for a material
  getDemandHistory(
    tenantId: ID!
    facilityId: ID!
    materialId: ID!
    startDate: Date!
    endDate: Date!
  ): [DemandHistory!]!

  # Get forecast accuracy metrics
  getForecastAccuracyMetrics(
    tenantId: ID!
    facilityId: ID!
    materialId: ID
    startDate: Date!
    endDate: Date!
    aggregationLevel: String # 'DAILY', 'WEEKLY', 'MONTHLY'
  ): [ForecastAccuracyMetric!]!

  # Get forecast accuracy summary across materials
  getForecastAccuracySummary(
    tenantId: ID!
    facilityId: ID!
    materialIds: [ID!]
  ): [ForecastAccuracySummary!]!

  # Get replenishment suggestions
  getReplenishmentSuggestions(
    tenantId: ID!
    facilityId: ID!
    materialId: ID
    suggestionStatus: ReplenishmentSuggestionStatus
    orderBy: String # 'projectedStockoutDate', 'recommendedOrderDate', 'estimatedTotalCost'
    limit: Int
  ): [ReplenishmentSuggestion!]!

  # Get forecast models
  getForecastModels(
    tenantId: ID!
    facilityId: ID!
    materialId: ID
    modelAlgorithm: ForecastAlgorithm
    modelStatus: String
  ): [ForecastModel!]!
}

# ============================================================================
# MUTATIONS
# ============================================================================

type Mutation {
  # Generate forecasts for materials
  generateForecasts(input: GenerateForecastInput!): [MaterialForecast!]!

  # Manually override a forecast
  overrideForecast(input: ManualForecastOverrideInput!): MaterialForecast!

  # Generate replenishment suggestions
  generateReplenishmentSuggestions(input: GenerateReplenishmentSuggestionsInput!): [ReplenishmentSuggestion!]!

  # Update replenishment suggestion status (approve/reject)
  updateReplenishmentSuggestion(input: UpdateReplenishmentSuggestionInput!): ReplenishmentSuggestion!

  # Convert replenishment suggestion to purchase order
  convertSuggestionToPurchaseOrder(suggestionId: ID!): PurchaseOrder!

  # Record actual demand (for tracking forecast accuracy)
  recordActualDemand(input: RecordActualDemandInput!): DemandHistory!

  # Recalculate forecast accuracy metrics
  recalculateForecastAccuracy(
    tenantId: ID!
    facilityId: ID!
    materialIds: [ID!]
    startDate: Date!
    endDate: Date!
  ): [ForecastAccuracyMetric!]!
}
```

---

## 7. Safety Stock & Reorder Point Calculations

### 7.1 Safety Stock Formulas

Print industry requires **different safety stock formulas** depending on demand variability and lead time variability.

**Formula Selection Logic:**

```typescript
function calculateSafetyStock(
  material: Material,
  demandHistory: DemandHistory[],
  supplier: MaterialSupplier
): number {
  const demandVariability = calculateStdDev(demandHistory.map(d => d.actualDemandQuantity));
  const avgDemand = calculateMean(demandHistory.map(d => d.actualDemandQuantity));
  const demandCoefficientOfVariation = demandVariability / avgDemand;

  const leadTimes = getHistoricalLeadTimes(supplier);
  const leadTimeVariability = calculateStdDev(leadTimes);
  const avgLeadTime = calculateMean(leadTimes);
  const leadTimeCoefficientOfVariation = leadTimeVariability / avgLeadTime;

  // Case 1: Low demand variability, low lead time variability
  if (demandCoefficientOfVariation < 0.2 && leadTimeCoefficientOfVariation < 0.1) {
    return basicSafetyStock(avgDemand, avgLeadTime, material.safetyStockDays);
  }

  // Case 2: High demand variability, low lead time variability
  if (demandCoefficientOfVariation >= 0.2 && leadTimeCoefficientOfVariation < 0.1) {
    return demandVariabilitySafetyStock(demandVariability, avgLeadTime, material.serviceLevel);
  }

  // Case 3: Low demand variability, high lead time variability
  if (demandCoefficientOfVariation < 0.2 && leadTimeCoefficientOfVariation >= 0.1) {
    return leadTimeVariabilitySafetyStock(avgDemand, leadTimeVariability, material.serviceLevel);
  }

  // Case 4: High demand variability, high lead time variability
  return combinedVariabilitySafetyStock(
    avgDemand,
    demandVariability,
    avgLeadTime,
    leadTimeVariability,
    material.serviceLevel
  );
}
```

**Formula Implementations:**

**1. Basic Safety Stock (Fixed Days of Supply):**
```typescript
// Use Case: C-class items, stable demand, reliable suppliers
function basicSafetyStock(avgDailyDemand: number, avgLeadTimeDays: number, safetyStockDays: number): number {
  return avgDailyDemand * safetyStockDays;
}
```

**2. Demand Variability Safety Stock:**
```typescript
// Use Case: Seasonal materials, promotional periods, B2B customers with variable order patterns
function demandVariabilitySafetyStock(
  stdDevDemand: number,
  avgLeadTimeDays: number,
  serviceLevel: number // 0.95 = 95%, 0.99 = 99%
): number {
  const zScore = getZScoreForServiceLevel(serviceLevel); // 95% = 1.65, 99% = 2.33
  return zScore * stdDevDemand * Math.sqrt(avgLeadTimeDays);
}
```

**3. Lead Time Variability Safety Stock:**
```typescript
// Use Case: International suppliers, port congestion, customs delays
function leadTimeVariabilitySafetyStock(
  avgDailyDemand: number,
  stdDevLeadTimeDays: number,
  serviceLevel: number
): number {
  const zScore = getZScoreForServiceLevel(serviceLevel);
  return zScore * avgDailyDemand * stdDevLeadTimeDays;
}
```

**4. Combined Variability Safety Stock (King Formula):**
```typescript
// Use Case: A-class items, critical materials, high-value substrates
function combinedVariabilitySafetyStock(
  avgDailyDemand: number,
  stdDevDemand: number,
  avgLeadTimeDays: number,
  stdDevLeadTimeDays: number,
  serviceLevel: number
): number {
  const zScore = getZScoreForServiceLevel(serviceLevel);

  // King's formula: SS = Z * sqrt((avgLT * σ²demand) + (avgDemand² * σ²LT))
  const demandVarianceComponent = avgLeadTimeDays * Math.pow(stdDevDemand, 2);
  const leadTimeVarianceComponent = Math.pow(avgDailyDemand, 2) * Math.pow(stdDevLeadTimeDays, 2);

  return zScore * Math.sqrt(demandVarianceComponent + leadTimeVarianceComponent);
}
```

### 7.2 Reorder Point Calculation

**Formula:**
```
Reorder Point = (Average Daily Demand × Average Lead Time) + Safety Stock
```

**Implementation:**
```typescript
function calculateReorderPoint(
  material: Material,
  demandHistory: DemandHistory[],
  supplier: MaterialSupplier
): number {
  const avgDailyDemand = calculateMean(demandHistory.map(d => d.actualDemandQuantity));
  const avgLeadTimeDays = supplier.leadTimeDays || material.leadTimeDays;
  const safetyStock = calculateSafetyStock(material, demandHistory, supplier);

  const demandDuringLeadTime = avgDailyDemand * avgLeadTimeDays;
  return demandDuringLeadTime + safetyStock;
}
```

### 7.3 Economic Order Quantity (EOQ)

**Formula:**
```
EOQ = sqrt((2 × Annual Demand × Ordering Cost) / Holding Cost per Unit per Year)
```

**Implementation:**
```typescript
function calculateEOQ(
  material: Material,
  annualDemand: number,
  orderingCost: number, // Cost per purchase order (fixed)
  holdingCostPercentage: number // Typical: 20-30% of unit cost per year
): number {
  const unitCost = material.standardCost || material.averageCost;
  const annualHoldingCostPerUnit = unitCost * holdingCostPercentage;

  const eoq = Math.sqrt((2 * annualDemand * orderingCost) / annualHoldingCostPerUnit);

  // Round to nearest order multiple if supplier has MOQ or order increments
  if (material.minimumOrderQuantity && eoq < material.minimumOrderQuantity) {
    return material.minimumOrderQuantity;
  }

  return roundToOrderIncrement(eoq, material.orderIncrementQuantity);
}
```

---

## 8. Integration Points

### 8.1 Integration with Existing Modules

**WMS (Warehouse Management) Integration:**
- **Trigger**: When inventory transactions occur (ISSUE, TRANSFER, ADJUSTMENT), record actual demand in `demand_history` table
- **Service**: `DemandHistoryService.recordDemandFromTransaction()`
- **Flow**: `wms.resolver.ts` → `DemandHistoryService` → `demand_history` table

**Procurement Integration:**
- **Trigger**: When replenishment suggestion is approved, convert to purchase order
- **Service**: `ReplenishmentService.convertToPurchaseOrder()`
- **Flow**: `forecasting.resolver.ts` → `ReplenishmentService` → `PurchaseOrderService` → `purchase_orders` table
- **Data**: Populate PO with material_id, vendor_id, quantity, requested_delivery_date from suggestion

**Sales Order Integration:**
- **Trigger**: When sales orders are created/updated, aggregate demand signals
- **Service**: `DemandSensingService.processSalesOrderDemand()`
- **Flow**: Extract committed sales order quantities, update short-term forecasts if significant deviation detected

**Vendor Performance Integration:**
- **Trigger**: When calculating safety stock, retrieve actual lead time performance from `vendor_performance` table
- **Service**: `VendorPerformanceService.getActualLeadTimes()`
- **Flow**: Use actual lead time variability instead of static lead time fields

### 8.2 Data Aggregation Jobs

**Daily Jobs:**
1. **Demand History Aggregation**: Aggregate previous day's demand from inventory transactions → `demand_history` table
2. **Forecast Accuracy Calculation**: Compare yesterday's forecast with actual demand, calculate errors → `forecast_accuracy_metrics` table
3. **Short-Term Forecast Update**: Regenerate 1-30 day forecasts for A-class materials using demand sensing

**Weekly Jobs:**
1. **Medium-Term Forecast Generation**: Generate 30-90 day forecasts for all active materials
2. **Replenishment Suggestion Generation**: Calculate projected inventory levels, generate PO suggestions
3. **Model Performance Review**: Aggregate weekly MAPE, bias, tracking signals

**Monthly Jobs:**
1. **Model Retraining**: Retrain forecasting models with updated data
2. **Safety Stock Recalculation**: Recalculate safety stock and reorder points based on latest variability
3. **Long-Term Forecast Generation**: Generate 90-365 day strategic forecasts

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Week 1-2: Database & Data Collection**
- [ ] Create database migration for new tables (`demand_history`, `material_forecasts`, `forecast_models`, `forecast_accuracy_metrics`, `replenishment_suggestions`)
- [ ] Extend `materials` table with forecasting configuration fields
- [ ] Implement `DemandHistoryService` to backfill historical demand from existing `inventory_transactions`
- [ ] Create seed data for testing (2 years of synthetic demand history for 10-20 materials)

**Week 3-4: Simple Forecasting Methods**
- [ ] Implement TypeScript service for simple forecasting methods (Moving Average, Exponential Smoothing)
- [ ] Implement safety stock calculation functions (all 4 formulas)
- [ ] Implement reorder point and EOQ calculations
- [ ] Create GraphQL schema (`forecasting.graphql`)
- [ ] Implement basic resolvers (queries: `getMaterialForecasts`, `getDemandHistory`)
- [ ] Unit tests for calculation functions

**Deliverable**: Basic forecasting capabilities with simple methods, safety stock/reorder point calculations functional

---

### Phase 2: Statistical Forecasting (Weeks 5-8)

**Week 5-6: Python Microservice Setup**
- [ ] Create Python FastAPI microservice (`forecasting-engine/`)
- [ ] Implement SARIMA forecaster using `statsmodels`
- [ ] Implement auto-parameter selection (`auto_arima`)
- [ ] Create REST API endpoints (`POST /forecast/generate`, `POST /forecast/backtest`)
- [ ] Dockerize Python service, add to Docker Compose
- [ ] Integration tests between Node.js backend and Python service

**Week 7-8: Integration & Automation**
- [ ] Implement `ForecastingService.generateForecasts()` in TypeScript (calls Python service)
- [ ] Implement `ForecastAccuracyService` to calculate MAPE, bias, tracking signal
- [ ] Create scheduled jobs (daily demand aggregation, weekly forecast generation)
- [ ] Implement GraphQL mutations (`generateForecasts`, `overrideForecast`)
- [ ] Create frontend dashboard for viewing forecasts (basic charts)

**Deliverable**: SARIMA-based forecasting with automated weekly forecast generation, accuracy tracking, basic UI

---

### Phase 3: ML Forecasting & Replenishment (Weeks 9-12)

**Week 9-10: LightGBM Implementation**
- [ ] Implement LightGBM forecaster using `skforecast` + `lightgbm`
- [ ] Feature engineering (lags, rolling windows, calendar features)
- [ ] Hyperparameter tuning with `optuna`
- [ ] Backtesting validation framework
- [ ] Model selection logic (AUTO algorithm selection based on data characteristics)

**Week 11-12: Replenishment Suggestions**
- [ ] Implement `ReplenishmentService.generateSuggestions()`
- [ ] Create replenishment suggestion workflow (pending → approved → converted to PO)
- [ ] Implement `convertSuggestionToPurchaseOrder()` mutation
- [ ] Create UI for reviewing/approving replenishment suggestions
- [ ] End-to-end testing: forecast → replenishment suggestion → PO conversion

**Deliverable**: Full forecasting pipeline with ML models, automated replenishment suggestions, PO conversion workflow

---

### Phase 4: Advanced Features (Weeks 13-16)

**Week 13-14: Demand Sensing**
- [ ] Implement `DemandSensingService` for real-time demand signal aggregation
- [ ] Integrate sales order pipeline data, wave processing data
- [ ] Anomaly detection (spike detection, trend shift detection)
- [ ] Short-term forecast adjustment based on demand signals

**Week 15-16: Optimization & Reporting**
- [ ] Multi-material batch forecasting optimization
- [ ] Forecast accuracy dashboards (MAPE trends, bias trends, model comparison)
- [ ] Alerts for forecast accuracy degradation
- [ ] Model retraining automation
- [ ] Performance tuning (database indexes, query optimization, caching)

**Deliverable**: Production-ready forecasting system with demand sensing, comprehensive reporting, automated model management

---

## 10. Success Metrics & KPIs

### 10.1 Forecast Accuracy Metrics

**Primary Metrics:**
- **MAPE (Mean Absolute Percentage Error)**: Target <20% for A-class, <30% for B-class, <40% for C-class
- **Bias (Mean Forecast Error)**: Target -5% to +5% (avoid systematic over/under-forecasting)
- **Tracking Signal**: Target -4 to +4 (cumulative bias monitoring)
- **Forecast Value Added (FVA)**: Percentage improvement vs. naive forecast (simple moving average)

**Secondary Metrics:**
- **RMSE (Root Mean Squared Error)**: Penalizes large errors
- **MAE (Mean Absolute Error)**: Absolute forecast error in units
- **R² (Coefficient of Determination)**: Goodness of fit (for regression-based models)

### 10.2 Operational Metrics

**Inventory Performance:**
- **Inventory Turnover Ratio**: Target improvement of 10-20% (current baseline TBD)
- **Days on Hand (DOH)**: Reduce average DOH by 15-25% while maintaining service levels
- **Stockout Rate**: Reduce stockouts by 50-70%
- **Excess Inventory**: Reduce slow-moving/obsolete inventory by 20-30%

**Procurement Performance:**
- **Purchase Order Accuracy**: % of POs placed based on accurate forecasts (target >85%)
- **Supplier Fill Rate**: Improve from current baseline by 10-15%
- **Emergency Order Reduction**: Reduce expedited/rush orders by 40-60%

**Financial Metrics:**
- **Inventory Carrying Cost Reduction**: Target 10-15% reduction in total carrying costs
- **Cash Flow Improvement**: Reduce working capital tied up in inventory by 15-20%
- **Stockout Cost Avoidance**: Quantify revenue protected by avoiding stockouts

### 10.3 Model Performance Benchmarks

**Backtesting Requirements:**
- Minimum backtesting period: 6 months
- Rolling origin cross-validation: Test on multiple time slices
- Model performance must beat naive forecast (moving average) by >15%

**Model Refresh Cadence:**
- A-class materials: Model retraining every 4 weeks
- B-class materials: Model retraining every 8 weeks
- C-class materials: Model retraining every 12 weeks

---

## 11. Research Sources

This research was informed by the following sources:

**Print Industry Demand Planning:**
- [Print Demand Forecasting with Machine Learning at HP Inc. | INFORMS Journal on Applied Analytics](https://pubsonline.informs.org/doi/10.1287/inte.2024.0126)
- [The Case for Demand Planning. Period. – Demand Planning Blog](https://demand-planning.com/2025/11/02/the-case-for-demand-planning-period/)
- [Best Practices for Demand Planning and Forecasting in 2025 | Impact Analytics](https://www.impactanalytics.ai/blog/best-practices-in-demand-planning-and-forecasting)
- [Printing Industry Trends 2025: The Future of Print](https://printepssw.com/insight/what-does-the-future-of-the-printing-industry-have-in-store)

**Forecasting Algorithms:**
- [ARIMA for Time Series Forecasting: A Complete Guide | DataCamp](https://www.datacamp.com/tutorial/arima)
- [Top Inventory Forecasting Models: MA, ES, ARIMA & When to Use Them](https://www.easyreplenish.com/blog/top-inventory-forecasting-models)
- [Machine learning algorithms | Time Series Forecasting](https://help.llama.ai/release/native/demand/demand-topics/time_series_forecasting_algorithms_machine.htm)
- [ARIMA & SARIMA: Real-World Time Series Forecasting](https://neptune.ai/blog/arima-sarima-real-world-time-series-forecasting-guide)

**Safety Stock Calculations:**
- [Safety Stock Calculator - Inventory Management Tool](https://quickbooks.intuit.com/global/tools-and-templates/safety-stock-calculator/)
- [How to calculate your Safety Stock: The Guide for Makers](https://craftybase.com/blog/how-to-calculate-safety-stock)
- [Understanding safety stock and mastering its equations (MIT)](https://web.mit.edu/2.810/www/files/readings/King_SafetyStock.pdf)
- [Safety Stock Formula Guide for Manufacturing](https://controlata.com/blog/safety-stock/)
- [Calculating the Safety Stock Formula: 6 Methods and Key Use Cases - Fishbowl](https://www.fishbowlinventory.com/blog/calculating-the-safety-stock-formula-6-variations-key-use-cases)

**Demand Sensing:**
- [Demand Sensing vs. Demand Forecasting: Know the Difference](https://www.impactanalytics.co/blog/demand-sensing-vs-demand-forecasting)
- [Demand Sensing: A Real-Time Approach to Demand Planning - Algo](https://www.algo.com/blog/demand-sensing/)
- [Demand Sensing: Technologies, Benefits, and Future Prospects](https://intuendi.com/resource-center/demand-sensing/)
- [AI-Powered Demand Forecasting | AWS Executive Insights](https://aws.amazon.com/executive-insights/content/ai-powered-demand-sensing/)

**ML Models (LightGBM/XGBoost):**
- [XGBoost & LGBM for Time Series Forecasting: How to – 365 Data Science](https://365datascience.com/tutorials/python-tutorials/xgboost-lgbm/)
- [Forecasting time series with gradient boosting: Skforecast, XGBoost, LightGBM](https://cienciadedatos.net/documentos/py39-forecasting-time-series-with-skforecast-xgboost-lightgbm-catboost.html)
- [LightGBM vs XGBoost for time series analysis | Kaggle](https://www.kaggle.com/code/nowakjakub/lightgbm-vs-xgboost-for-time-series-analysis)
- [Forecasting with XGBoost and LightGBM - Skforecast Docs](https://skforecast.org/0.14.0/user_guides/forecasting-xgboost-lightgbm.html)

**ERP Integration:**
- [Complete guide to inventory management software development (2025) | Volpis](https://volpis.com/blog/guide-to-inventory-management-software-development/)
- [AI-Driven Inventory Management with OpenAI Forecasting & ERP Integration | n8n](https://n8n.io/workflows/10531-ai-driven-inventory-management-with-openai-forecasting-and-erp-integration/)
- [The Ultimate Guide to ERP Forecasting | Open Source Integrators](https://www.opensourceintegrators.com/publications/ultimate-guide-erp-forecasting)
- [ERP Software Trends 2025 | VNMT Solutions](https://www.vnmtsolutions.com/erp-software-trends/)

---

## Conclusion

This research provides a comprehensive foundation for implementing **Inventory Forecasting** in the AGOG Print Industry ERP system. The proposed solution:

1. **Builds on existing strengths**: Leverages the robust inventory management, statistical analysis framework, and vendor performance tracking already in place
2. **Follows industry best practices**: Implements proven forecasting methodologies (SARIMA, LightGBM) used by industry leaders like HP Inc.
3. **Addresses print industry specifics**: Handles seasonal demand, substrate variability, lead time uncertainty, and dual-track forecasting (raw materials + finished goods)
4. **Provides incremental value**: Phased implementation ensures early wins (Phase 1: simple methods) while building toward advanced capabilities (Phase 4: demand sensing + ML)
5. **Enables measurable ROI**: Clear success metrics targeting 10-20% inventory reduction, 50-70% stockout reduction, and <20% MAPE for A-class items

The next step is for **Marcus (Implementation Lead)** to review this research, prioritize features, and begin development according to the proposed roadmap.

---

**Research Agent:** Cynthia
**Date Completed:** 2025-12-25
**Status:** READY FOR IMPLEMENTATION
**NATS Subject:** `nats://agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1766675619639`
