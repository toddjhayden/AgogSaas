# CYNTHIA RESEARCH DELIVERABLE
## REQ-STRATEGIC-AUTO-1766718736461: Inventory Forecasting

**Agent**: Cynthia (Research Lead)
**Date**: 2025-12-25
**Status**: COMPLETE
**Assignment**: Marcus (Implementation Lead)

---

## EXECUTIVE SUMMARY

This research deliverable provides a comprehensive analysis of the AGOGSAAS inventory management system and outlines the requirements for implementing an advanced **Inventory Forecasting** capability. The current system has a robust foundation with enterprise-grade inventory tracking, statistical analysis frameworks, and historical data preservation. However, demand forecasting algorithms, forecast accuracy tracking, and automated replenishment recommendations are not yet implemented.

**Key Findings**:
- ✓ Strong data foundation with 13 WMS tables and multi-module integration
- ✓ Advanced statistical analysis framework already exists (correlation, regression, A/B testing)
- ✓ Historical data preserved via SCD Type 2 with complete audit trails
- ✓ Material velocity and vendor performance analytics in place
- ✗ **Gap**: No demand forecasting models (ARIMA, exponential smoothing, ML)
- ✗ **Gap**: No forecast accuracy metrics (MAPE, RMSE tracking)
- ✗ **Gap**: No automated replenishment recommendations

**Recommendation**: Implement a phased inventory forecasting system leveraging existing statistical infrastructure while adding specialized demand prediction capabilities.

---

## 1. CURRENT STATE ANALYSIS

### 1.1 Inventory Management Architecture

The AGOGSAAS system implements a sophisticated, multi-tiered inventory management solution:

#### **Core WMS Tables** (V0.0.4 Migration)

1. **`inventory_locations`** - Physical warehouse locations
   - Hierarchical structure: zone → aisle → rack → shelf → bin
   - 5-tier security zones (STANDARD, RESTRICTED, SECURE, HIGH_SECURITY, VAULT)
   - Temperature control (min_f, max_f for cold chain)
   - ABC classification for cycle counting (A=weekly, B=monthly, C=quarterly)
   - Physical dimensions and weight capacity tracking
   - Pick sequence optimization for wave processing

2. **`lots`** - Batch/lot tracking with traceability
   - Quantity tracking: original_quantity, current_quantity, available_quantity, allocated_quantity
   - Quality status: QUARANTINE, PENDING_INSPECTION, RELEASED, REJECTED, HOLD
   - Expiration management: received_date, manufactured_date, expiration_date
   - Vendor traceability: vendor_lot_number, purchase_order_id
   - 3PL support: customer_id for customer-owned inventory
   - Certifications: JSONB storage for FDA, FSC, etc.

3. **`inventory_transactions`** - Complete audit trail
   - Transaction types: RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, CYCLE_COUNT, RETURN, SCRAP
   - Movement tracking: from_location_id, to_location_id
   - Financial integration: unit_cost, total_cost
   - User audit: performed_by_user_id

4. **`inventory_reservations`** - Soft allocations
   - Sales order reservations
   - Production order reservations
   - Expiration dates for time-bound holds

5. **`kit_definitions` & `kit_components`** - BOM assemblies
   - Multi-component kit tracking
   - Component substitution support

#### **Supporting Tables**

**Materials Table** (V0.0.5):
- Material master data: material_code, material_name, material_type
- UOM management: primary_uom, secondary_uom, uom_conversion_factor
- Costing: standard_cost, last_cost, average_cost, costing_method (FIFO, LIFO, AVERAGE, STANDARD)
- **Planning Parameters**:
  - `lead_time_days` - Vendor replenishment time
  - `minimum_order_quantity` - MOQ constraints
  - `order_multiple` - Order quantity increments
  - `safety_stock_quantity` - Buffer stock level
  - `reorder_point` - Triggering threshold
  - `economic_order_quantity` - Optimal order size
- ABC classification for velocity analysis
- Lot tracking flags: is_lot_tracked, is_serialized, shelf_life_days

**Materials_Suppliers Table** (V0.0.6):
- Vendor-specific lead times and pricing
- Price breaks (volume-based pricing)
- Vendor-specific MOQs

**Products Table**:
- Links to materials via material_id
- Packaging type classification (CORRUGATED, COMMERCIAL, LABELS, FLEXIBLE)
- BOM support via bill_of_materials table

### 1.2 Statistical Analysis Capabilities

The system has **advanced statistical analysis infrastructure** implemented by Priya (Statistical Analysis Expert):

#### **Bin Optimization Statistical Metrics** (V0.0.22)

**Table**: `bin_optimization_statistical_metrics`

Tracks algorithm performance with time-series analysis:
- **Descriptive Statistics**: mean, median, std_dev, percentile_25, percentile_75, percentile_95
- **Utilization Metrics**: volume_utilization_mean, weight_utilization_mean
- **Target Achievement**: locations_in_target_range (60-80% utilization)
- **Performance Improvements**: pick_travel_distance_reduction, putaway_time_reduction
- **ML Model Statistics**: accuracy, precision, recall, f1_score
- **Confidence Analysis**: avg_confidence_score, confidence_95_lower, confidence_95_upper
- **Time-Series Tracking**: measurement_period, period_start_date, period_end_date

**Materialized View**: `bin_utilization_statistical_summary`
- Aggregates 30-day rolling metrics
- Provides trend analysis (current vs previous period)
- Enables fast dashboard queries

#### **A/B Testing Framework** (V0.0.22)

**Table**: `bin_optimization_ab_tests`

Enables algorithm comparison:
- Test configuration: control_group_config vs treatment_group_config
- Algorithm version tracking
- Statistical test results:
  - Test type: T_TEST, CHI_SQUARE, MANN_WHITNEY
  - P-value significance testing (threshold: 0.05)
  - Effect size calculations (Cohen's d, Cramér's V)
- Winner determination and recommendations

#### **Correlation Analysis** (V0.0.22)

**Table**: `bin_optimization_correlation_analysis`

Analyzes relationships between metrics:
- Correlation types: PEARSON, SPEARMAN
- Regression analysis: slope, intercept, r_squared
- Relationship classification: POSITIVE, NEGATIVE, NONE
- Significance testing: p_value

#### **Material Velocity Analysis** (V0.0.15, V0.0.16)

**Table**: `material_velocity_metrics`

Tracks material movement patterns:
- Period-based tracking (weekly/monthly/quarterly)
- Metrics: total_picks, total_quantity_picked, total_value_picked
- ABC classification tracking
- velocity_rank for warehouse slotting optimization

**Materialized View**: `material_velocity_analysis`
- 100x performance improvement (500ms → 5ms queries)
- Enables real-time warehouse slotting decisions

### 1.3 Historical Data Availability

The system implements **comprehensive historical data preservation**:

#### **SCD Type 2 Implementation** (V0.0.10)

All master data tables include:
- `effective_from_date` - Version start date
- `effective_to_date` - Version end date (NULL for current)
- `is_current_version` - Fast current record filtering

This enables:
- Historical cost tracking (standard_cost, last_cost changes over time)
- Vendor performance trending
- Material specification evolution analysis

#### **Audit Trail Fields** (Standard Pattern)

All transactional tables include:
- `created_at`, `created_by` - Record creation tracking
- `updated_at`, `updated_by` - Modification tracking
- `deleted_at`, `deleted_by` - Soft delete support

#### **Time-Series Data Sources**

**For Demand Analysis**:
- `sales_orders` + `sales_order_lines` (timestamped customer demand)
- `inventory_transactions` (actual consumption patterns)
- `shipments` + `shipment_lines` (actual fulfillment dates)
- `quotes` + `quote_lines` (forward-looking demand indicators)

**For Supply Analysis**:
- `purchase_orders` + `purchase_order_lines` (replenishment history)
- `vendor_performance` (monthly evaluations with 12-month rolling averages)
- `lots` (receipt dates and vendor lot numbers for lead time analysis)

#### **Data Partitioning** (V0.0.25)

Statistical metrics table partitioned by:
- **Tenant**: Multi-tenant data isolation
- **Measurement Period**: Time-based access patterns
- **Facility**: Location-based analytics

Enables efficient historical queries without full table scans.

### 1.4 Data Quality Framework

#### **Data Quality Monitoring** (V0.0.20)

**View**: `bin_optimization_data_quality`

Tracks data quality metrics:
- **Completeness**: null_critical_fields_count (detects missing dimensions, weights, prices)
- **Consistency**: inconsistent_lot_quantity_count (lot quantities vs location capacity)
- **Accuracy**: price_variance_anomalies (detects unusual price changes)
- **Duplicates**: duplicate_lot_location_count
- **Referential Integrity**: invalid_material_reference_count, invalid_location_reference_count
- **Temporal Anomalies**: future_transaction_dates_count, expired_lot_in_active_location_count

**Service**: `BinOptimizationDataQualityService`
- File: `/backend/src/modules/wms/services/bin-optimization-data-quality.service.ts`
- Provides GraphQL query: `binOptimizationDataQuality(facilityId)`
- Calculates data quality score (0-100)
- Categorizes severity: CRITICAL, WARNING, INFO

This framework ensures forecasting models will have clean, validated input data.

### 1.5 Integration Points

#### **Sales Module Integration**

**Flow**: Customer Order → Inventory Reservation → Fulfillment
1. Customer places order (`sales_orders`)
2. System creates reservation (`inventory_reservations`)
3. Order status progression: DRAFT → CONFIRMED → IN_PRODUCTION → SHIPPED
4. Inventory consumption via `inventory_transactions` (type=ISSUE)

**Key Tables**:
- `sales_orders`, `sales_order_lines` (demand creation)
- `customers`, `customer_products`, `customer_pricing` (customer-specific patterns)
- `quotes`, `quote_lines` (forward-looking demand signals)

**GraphQL Resolver**: `/backend/src/graphql/resolvers/sales-materials.resolver.ts`

#### **Purchasing Module Integration**

**Flow**: Purchase Order → Goods Receipt → Inventory Increase
1. Purchase order created (`purchase_orders`)
2. Goods receipt creates lots with vendor traceability
3. Inventory receipt transaction (`inventory_transactions` type=RECEIPT)
4. Vendor performance metrics updated

**Key Tables**:
- `purchase_orders`, `purchase_order_lines` (supply replenishment)
- `vendors`, `materials_suppliers` (vendor-specific lead times)
- `vendor_performance` (monthly evaluations with 12-month rolling)

**Planning Parameters Available**:
- Material level: `lead_time_days`, `minimum_order_quantity`, `order_multiple`
- Vendor level: `lead_time_days`, `minimum_order_quantity`, `price_breaks`
- Contract level: `pricing_terms`, `volume_commitment`

#### **Warehouse Module Integration**

**Wave Processing**:
- `wave_processing` (manufacturing vs pick/ship waves)
- `wave_lines` (order lines within wave)
- `pick_lists` (worker task assignments)
- `shipments` (outbound tracking with carrier integration)

**Carrier Integration** (3PL support):
- `carrier_integrations` (FedEx, UPS, USPS, DHL credentials)
- `tracking_events` (webhook-based shipment tracking)

---

## 2. INVENTORY FORECASTING GAP ANALYSIS

### 2.1 What EXISTS

| Capability | Status | Implementation |
|-----------|--------|----------------|
| Statistical Analysis Framework | ✓ Implemented | Time-series, correlation, regression (V0.0.22) |
| Material Velocity Metrics | ✓ Implemented | ABC classification tracking (V0.0.15, V0.0.16) |
| Historical Data Preservation | ✓ Implemented | SCD Type 2 with complete audit trails (V0.0.10) |
| Vendor Performance Trending | ✓ Implemented | 12-month rolling metrics (V0.0.6) |
| Safety Stock Definitions | ✓ Implemented | In materials table (V0.0.5) |
| Lead Time Tracking | ✓ Implemented | Vendor and material level (V0.0.5, V0.0.6) |
| Data Quality Monitoring | ✓ Implemented | Completeness, consistency, accuracy checks (V0.0.20) |
| Materialized View Caching | ✓ Implemented | 100x performance improvement (V0.0.16) |
| A/B Testing Framework | ✓ Implemented | Algorithm comparison infrastructure (V0.0.22) |

### 2.2 What is MISSING

| Capability | Status | Priority | Complexity |
|-----------|--------|----------|------------|
| Demand Forecasting Models | ✗ Not Implemented | **HIGH** | Medium |
| Sales/Demand Pattern Analysis | ✗ Not Implemented | **HIGH** | Medium |
| Seasonal Adjustment Methods | ✗ Not Implemented | **HIGH** | Medium |
| Forecast Accuracy Metrics | ✗ Not Implemented | **HIGH** | Low |
| Recommended Inventory Levels | ✗ Not Implemented | **HIGH** | Medium |
| Safety Stock Optimization | ✗ Not Implemented | Medium | Medium |
| Lead Time Variability Analysis | ✗ Not Implemented | Medium | Low |
| Stockout/Overstock Prediction | ✗ Not Implemented | **HIGH** | Medium |
| Multi-Echelon Optimization | ✗ Not Implemented | Low | High |
| Demand Sensing | ✗ Not Implemented | Medium | Medium |
| Collaborative Forecasting UI | ✗ Not Implemented | Low | Medium |

### 2.3 Critical Gaps for MVP

To deliver a functional **Inventory Forecasting MVP**, the following capabilities are essential:

1. **Demand Forecasting Engine**
   - Multiple forecasting methods (moving average, exponential smoothing, linear regression)
   - Automatic method selection based on data characteristics
   - Seasonal decomposition (trend, seasonality, residual components)
   - Confidence intervals for forecast uncertainty

2. **Forecast Accuracy Tracking**
   - MAPE (Mean Absolute Percentage Error)
   - RMSE (Root Mean Squared Error)
   - Bias detection (over-forecasting vs under-forecasting)
   - Method performance comparison

3. **Replenishment Recommendations**
   - Calculate recommended order quantities
   - Optimal order timing based on lead time and safety stock
   - Integration with existing `materials` table parameters (EOQ, MOQ, order_multiple)
   - Alerts for predicted stockouts

4. **Dashboard Visualization**
   - Forecast vs actual demand charts
   - Forecast accuracy metrics display
   - Replenishment recommendations list
   - Inventory level projections

---

## 3. FORECASTING METHODOLOGY RECOMMENDATIONS

### 3.1 Forecasting Methods to Implement

#### **Method 1: Moving Average** (Baseline)
- **Use Case**: Stable demand with minimal trend or seasonality
- **Formula**: MA_t = (D_{t-1} + D_{t-2} + ... + D_{t-n}) / n
- **Pros**: Simple, smooth, fast computation
- **Cons**: Lags behind actual demand, poor for seasonal patterns
- **Recommended For**: Class C materials (low velocity)

#### **Method 2: Exponential Smoothing** (Primary)
- **Use Case**: General-purpose forecasting with trend and seasonality support
- **Variants to Implement**:
  - **Simple Exponential Smoothing (SES)**: No trend, no seasonality
    - Formula: F_t = α × D_{t-1} + (1 - α) × F_{t-1}
  - **Holt's Method**: Linear trend, no seasonality
    - Level: L_t = α × D_t + (1 - α) × (L_{t-1} + T_{t-1})
    - Trend: T_t = β × (L_t - L_{t-1}) + (1 - β) × T_{t-1}
  - **Holt-Winters**: Trend + seasonality (additive or multiplicative)
    - Level: L_t = α × (D_t - S_{t-s}) + (1 - α) × (L_{t-1} + T_{t-1})
    - Trend: T_t = β × (L_t - L_{t-1}) + (1 - β) × T_{t-1}
    - Seasonality: S_t = γ × (D_t - L_t) + (1 - γ) × S_{t-s}
- **Pros**: Adapts to changing patterns, configurable smoothing parameters
- **Cons**: Requires parameter tuning (α, β, γ)
- **Recommended For**: Class A and B materials (medium to high velocity)

#### **Method 3: Linear Regression** (Trend Analysis)
- **Use Case**: Materials with clear upward or downward trend
- **Formula**: D_t = β_0 + β_1 × t + ε
- **Pros**: Captures long-term trends, simple interpretation
- **Cons**: Assumes linear relationship, poor for seasonal patterns
- **Recommended For**: New materials ramping up or phasing out

#### **Method 4: Seasonal Decomposition (STL)** (Advanced)
- **Use Case**: Materials with strong seasonal patterns
- **Components**:
  - Trend component (long-term direction)
  - Seasonal component (repeating patterns)
  - Residual component (random variation)
- **Formula**: D_t = Trend_t + Seasonal_t + Residual_t
- **Pros**: Handles complex seasonal patterns, provides interpretable components
- **Cons**: Requires sufficient historical data (2+ seasonal cycles)
- **Recommended For**: Materials with known seasonal demand (e.g., holiday-related products)

### 3.2 Automatic Method Selection Algorithm

Implement a **data-driven method selection** based on historical pattern analysis:

```
IF historical_data_points < 12:
    USE: Moving Average (insufficient data for complex methods)
ELSE IF seasonality_detected AND seasonal_cycles >= 2:
    USE: Holt-Winters (handles trend + seasonality)
ELSE IF trend_detected:
    USE: Holt's Method (handles trend)
ELSE:
    USE: Simple Exponential Smoothing (stable demand)

# Fallback: Compare forecast accuracy and select best performer
```

**Seasonality Detection**:
- Autocorrelation function (ACF) analysis
- Spectral analysis (frequency domain)
- Visual pattern inspection (coefficient of variation)

**Trend Detection**:
- Linear regression slope significance test
- Mann-Kendall trend test

### 3.3 Forecast Accuracy Metrics

Implement standard forecasting error metrics:

#### **MAPE (Mean Absolute Percentage Error)**
```
MAPE = (1/n) × Σ |Actual_t - Forecast_t| / Actual_t × 100%
```
- **Interpretation**: % error on average
- **Best Practice**: MAPE < 10% is excellent, 10-20% is good, >50% is poor
- **Limitation**: Undefined when Actual_t = 0

#### **RMSE (Root Mean Squared Error)**
```
RMSE = √((1/n) × Σ (Actual_t - Forecast_t)²)
```
- **Interpretation**: Average magnitude of error in same units as demand
- **Pros**: Penalizes large errors more heavily than MAE
- **Use**: Compare methods for same material

#### **Bias**
```
Bias = (1/n) × Σ (Actual_t - Forecast_t)
```
- **Interpretation**: Systematic over-forecasting (positive) or under-forecasting (negative)
- **Best Practice**: Bias should be close to 0

#### **Forecast Accuracy Score** (Composite)
```
Accuracy_Score = 100% - MAPE
```
- **Use**: Simple percentage for business users (95% accuracy = 5% MAPE)

### 3.4 Safety Stock Optimization

Current system has `safety_stock_quantity` in materials table, but no automated calculation. Implement:

#### **Formula 1: Standard Deviation Method**
```
Safety_Stock = Z × σ_LT × √(Lead_Time)

Where:
- Z = service level factor (e.g., 1.65 for 95% service level, 2.33 for 99%)
- σ_LT = standard deviation of demand during lead time
- Lead_Time = vendor lead time in days
```

#### **Formula 2: Lead Time Variability**
```
Safety_Stock = Z × √((Avg_Demand² × σ_LT²) + (Avg_LT × σ_Demand²))

Where:
- σ_LT = standard deviation of lead time
- σ_Demand = standard deviation of daily demand
```

#### **Formula 3: ABC-Based Service Levels**
```
IF abc_classification = 'A':
    Service_Level = 99% (Z = 2.33)
ELSE IF abc_classification = 'B':
    Service_Level = 95% (Z = 1.65)
ELSE: # Class C
    Service_Level = 90% (Z = 1.28)
```

### 3.5 Replenishment Recommendations

Calculate optimal order quantities and timing:

#### **Reorder Point (ROP)**
```
ROP = (Average_Daily_Demand × Lead_Time_Days) + Safety_Stock
```

#### **Economic Order Quantity (EOQ)**
```
EOQ = √((2 × Annual_Demand × Ordering_Cost) / Holding_Cost_Per_Unit)
```
- Note: System already has `economic_order_quantity` field in materials table
- Recommendation: Recalculate periodically based on updated demand forecasts

#### **Order Quantity Adjustment**
```
Recommended_Order_Qty = ROUND_UP(EOQ / order_multiple) × order_multiple

IF Recommended_Order_Qty < minimum_order_quantity:
    Recommended_Order_Qty = minimum_order_quantity
```

---

## 4. DATABASE SCHEMA DESIGN

### 4.1 New Tables Required

#### **Table 1: `demand_forecasts`**

Stores forecasted demand values for materials:

```sql
CREATE TABLE demand_forecasts (
    forecast_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    facility_id UUID NOT NULL REFERENCES facilities(facility_id),
    material_id UUID NOT NULL REFERENCES materials(material_id),

    -- Forecast metadata
    forecast_date DATE NOT NULL,
    forecast_horizon_days INT NOT NULL, -- e.g., 30, 60, 90 days
    forecast_method VARCHAR(50) NOT NULL, -- 'MOVING_AVERAGE', 'EXPONENTIAL_SMOOTHING', 'HOLT_WINTERS', etc.
    model_version VARCHAR(50) NOT NULL,

    -- Forecast values
    forecasted_quantity DECIMAL(15,3) NOT NULL,
    confidence_level DECIMAL(5,2) NOT NULL, -- e.g., 95.00
    lower_bound DECIMAL(15,3) NOT NULL,
    upper_bound DECIMAL(15,3) NOT NULL,

    -- Actual values (populated after forecast_date)
    actual_quantity DECIMAL(15,3),

    -- Model parameters (JSONB for flexibility)
    model_parameters JSONB, -- e.g., {"alpha": 0.3, "beta": 0.1, "gamma": 0.05}

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(user_id),
    updated_at TIMESTAMP,
    updated_by UUID REFERENCES users(user_id)
);

-- Indexes
CREATE INDEX idx_demand_forecasts_material ON demand_forecasts(material_id, forecast_date);
CREATE INDEX idx_demand_forecasts_facility ON demand_forecasts(facility_id, forecast_date);
CREATE INDEX idx_demand_forecasts_tenant ON demand_forecasts(tenant_id);
```

#### **Table 2: `forecast_accuracy_metrics`**

Tracks forecast performance over time:

```sql
CREATE TABLE forecast_accuracy_metrics (
    metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    facility_id UUID NOT NULL REFERENCES facilities(facility_id),
    material_id UUID NOT NULL REFERENCES materials(material_id),

    -- Evaluation period
    evaluation_period_start DATE NOT NULL,
    evaluation_period_end DATE NOT NULL,
    forecast_method VARCHAR(50) NOT NULL,

    -- Accuracy metrics
    mape DECIMAL(8,4), -- Mean Absolute Percentage Error
    rmse DECIMAL(15,3), -- Root Mean Squared Error
    mae DECIMAL(15,3), -- Mean Absolute Error
    bias DECIMAL(15,3), -- Forecast bias (positive = over-forecast)
    forecast_accuracy_score DECIMAL(5,2), -- 100 - MAPE

    -- Sample size
    data_points_count INT NOT NULL,

    -- Method ranking (for comparison)
    method_rank INT, -- 1 = best performer for this material

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(user_id)
);

-- Indexes
CREATE INDEX idx_forecast_accuracy_material ON forecast_accuracy_metrics(material_id, evaluation_period_end);
CREATE INDEX idx_forecast_accuracy_facility ON forecast_accuracy_metrics(facility_id);
```

#### **Table 3: `replenishment_recommendations`**

Stores calculated replenishment suggestions:

```sql
CREATE TABLE replenishment_recommendations (
    recommendation_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    facility_id UUID NOT NULL REFERENCES facilities(facility_id),
    material_id UUID NOT NULL REFERENCES materials(material_id),

    -- Recommendation metadata
    recommendation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recommendation_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'ORDERED'

    -- Inventory levels
    current_on_hand_qty DECIMAL(15,3) NOT NULL,
    current_allocated_qty DECIMAL(15,3) NOT NULL,
    current_available_qty DECIMAL(15,3) NOT NULL,

    -- Calculated values
    forecasted_demand_30_days DECIMAL(15,3) NOT NULL,
    forecasted_demand_60_days DECIMAL(15,3) NOT NULL,
    forecasted_demand_90_days DECIMAL(15,3) NOT NULL,

    safety_stock_qty DECIMAL(15,3) NOT NULL,
    reorder_point DECIMAL(15,3) NOT NULL,

    -- Recommendation
    recommended_order_qty DECIMAL(15,3) NOT NULL,
    recommended_order_date DATE NOT NULL,

    -- Supplier information
    preferred_vendor_id UUID REFERENCES vendors(vendor_id),
    vendor_lead_time_days INT,

    -- Urgency
    urgency_level VARCHAR(20) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    stockout_risk_days INT, -- Days until predicted stockout

    -- Justification
    recommendation_reason TEXT,

    -- Actions taken
    purchase_order_id UUID REFERENCES purchase_orders(purchase_order_id), -- If order created
    approved_at TIMESTAMP,
    approved_by UUID REFERENCES users(user_id),
    rejected_at TIMESTAMP,
    rejected_by UUID REFERENCES users(user_id),
    rejection_reason TEXT,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(user_id),
    updated_at TIMESTAMP,
    updated_by UUID REFERENCES users(user_id)
);

-- Indexes
CREATE INDEX idx_replenishment_rec_material ON replenishment_recommendations(material_id, recommendation_date);
CREATE INDEX idx_replenishment_rec_facility ON replenishment_recommendations(facility_id, recommendation_status);
CREATE INDEX idx_replenishment_rec_urgency ON replenishment_recommendations(urgency_level, recommendation_status);
```

#### **Table 4: `demand_pattern_analysis`**

Stores detected patterns for materials:

```sql
CREATE TABLE demand_pattern_analysis (
    analysis_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    material_id UUID NOT NULL REFERENCES materials(material_id),

    -- Analysis period
    analysis_start_date DATE NOT NULL,
    analysis_end_date DATE NOT NULL,

    -- Pattern detection
    has_trend BOOLEAN NOT NULL,
    trend_direction VARCHAR(20), -- 'INCREASING', 'DECREASING', 'STABLE'
    trend_slope DECIMAL(15,6),
    trend_p_value DECIMAL(8,6), -- Statistical significance

    has_seasonality BOOLEAN NOT NULL,
    seasonality_period_days INT, -- e.g., 7 for weekly, 30 for monthly, 365 for yearly
    seasonality_strength DECIMAL(5,2), -- 0-100 percentage

    -- Variability
    coefficient_of_variation DECIMAL(8,4), -- StdDev / Mean
    demand_volatility_category VARCHAR(20), -- 'LOW', 'MEDIUM', 'HIGH'

    -- Recommended method
    recommended_forecast_method VARCHAR(50) NOT NULL,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(user_id)
);

-- Indexes
CREATE INDEX idx_demand_pattern_material ON demand_pattern_analysis(material_id, analysis_end_date);
```

### 4.2 Materialized Views

Leverage existing performance optimization pattern (100x speedup from V0.0.16):

#### **Materialized View 1: `forecast_dashboard_cache`**

```sql
CREATE MATERIALIZED VIEW forecast_dashboard_cache AS
SELECT
    df.tenant_id,
    df.facility_id,
    df.material_id,
    m.material_code,
    m.material_name,
    m.abc_classification,

    -- Latest forecast
    df.forecast_date,
    df.forecasted_quantity,
    df.confidence_level,
    df.forecast_method,

    -- Accuracy
    fam.mape,
    fam.forecast_accuracy_score,

    -- Current inventory
    COALESCE(SUM(l.available_quantity), 0) AS current_available_qty,

    -- Recommendation status
    rr.recommendation_status,
    rr.urgency_level,
    rr.stockout_risk_days

FROM demand_forecasts df
INNER JOIN materials m ON df.material_id = m.material_id
LEFT JOIN forecast_accuracy_metrics fam
    ON fam.material_id = df.material_id
    AND fam.forecast_method = df.forecast_method
LEFT JOIN lots l
    ON l.material_id = df.material_id
    AND l.facility_id = df.facility_id
    AND l.quality_status = 'RELEASED'
LEFT JOIN replenishment_recommendations rr
    ON rr.material_id = df.material_id
    AND rr.recommendation_date = CURRENT_DATE
WHERE df.forecast_date = CURRENT_DATE
GROUP BY df.tenant_id, df.facility_id, df.material_id, m.material_code, m.material_name,
         m.abc_classification, df.forecast_date, df.forecasted_quantity, df.confidence_level,
         df.forecast_method, fam.mape, fam.forecast_accuracy_score,
         rr.recommendation_status, rr.urgency_level, rr.stockout_risk_days;

-- Refresh trigger (daily)
CREATE OR REPLACE FUNCTION refresh_forecast_dashboard_cache()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY forecast_dashboard_cache;
END;
$$ LANGUAGE plpgsql;
```

#### **Materialized View 2: `material_forecast_performance`**

Aggregates forecast accuracy by material and method:

```sql
CREATE MATERIALIZED VIEW material_forecast_performance AS
SELECT
    fam.tenant_id,
    fam.material_id,
    m.material_code,
    m.material_name,
    m.abc_classification,
    fam.forecast_method,

    -- Accuracy metrics (30-day rolling)
    AVG(fam.mape) AS avg_mape_30d,
    AVG(fam.forecast_accuracy_score) AS avg_accuracy_score_30d,
    AVG(fam.rmse) AS avg_rmse_30d,
    AVG(fam.bias) AS avg_bias_30d,

    -- Best method flag
    RANK() OVER (PARTITION BY fam.material_id ORDER BY AVG(fam.mape) ASC) AS method_rank

FROM forecast_accuracy_metrics fam
INNER JOIN materials m ON fam.material_id = m.material_id
WHERE fam.evaluation_period_end >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY fam.tenant_id, fam.material_id, m.material_code, m.material_name,
         m.abc_classification, fam.forecast_method;
```

### 4.3 Database Migration Plan

**Migration File**: `V0.0.26__create_inventory_forecasting.sql`

Includes:
1. Create 4 new tables (demand_forecasts, forecast_accuracy_metrics, replenishment_recommendations, demand_pattern_analysis)
2. Create 2 materialized views (forecast_dashboard_cache, material_forecast_performance)
3. Create indexes for query performance
4. Create refresh functions for materialized views
5. Grant appropriate permissions (tenant-level isolation)

---

## 5. BACKEND SERVICE ARCHITECTURE

### 5.1 Service Design

Following existing AGOGSAAS service patterns, implement:

#### **Service 1: `DemandForecastingService`**

**File**: `/backend/src/modules/wms/services/demand-forecasting.service.ts`

**Responsibilities**:
- Fetch historical demand data from sales_orders and inventory_transactions
- Run pattern analysis (trend detection, seasonality detection)
- Apply forecasting algorithms (moving average, exponential smoothing, Holt-Winters)
- Store forecasts in demand_forecasts table
- Calculate confidence intervals

**Key Methods**:
```typescript
async generateForecast(materialId: string, facilityId: string, horizonDays: number): Promise<DemandForecast>
async detectPatterns(materialId: string): Promise<DemandPattern>
async selectForecastMethod(materialId: string): Promise<ForecastMethod>
async calculateConfidenceIntervals(forecast: number, historicalData: number[]): Promise<{lower: number, upper: number}>
```

#### **Service 2: `ForecastAccuracyService`**

**File**: `/backend/src/modules/wms/services/forecast-accuracy.service.ts`

**Responsibilities**:
- Compare forecasted vs actual demand
- Calculate accuracy metrics (MAPE, RMSE, MAE, Bias)
- Store results in forecast_accuracy_metrics table
- Rank forecasting methods by performance
- Trigger method switching if accuracy degrades

**Key Methods**:
```typescript
async calculateAccuracyMetrics(materialId: string, periodStart: Date, periodEnd: Date): Promise<AccuracyMetrics>
async compareForecastMethods(materialId: string): Promise<MethodComparison[]>
async getBestPerformingMethod(materialId: string): Promise<ForecastMethod>
async trackAccuracyTrends(materialId: string): Promise<AccuracyTrend>
```

#### **Service 3: `ReplenishmentRecommendationService`**

**File**: `/backend/src/modules/wms/services/replenishment-recommendation.service.ts`

**Responsibilities**:
- Fetch current inventory levels
- Fetch demand forecasts
- Calculate safety stock, reorder point, recommended order quantity
- Determine urgency level and stockout risk
- Store recommendations in replenishment_recommendations table
- Generate alerts for critical items

**Key Methods**:
```typescript
async generateRecommendations(facilityId: string): Promise<ReplenishmentRecommendation[]>
async calculateSafetyStock(materialId: string): Promise<number>
async calculateReorderPoint(materialId: string): Promise<number>
async calculateOrderQuantity(materialId: string): Promise<number>
async assessStockoutRisk(materialId: string): Promise<{riskLevel: string, daysUntilStockout: number}>
```

#### **Service 4: `InventoryOptimizationService`**

**File**: `/backend/src/modules/wms/services/inventory-optimization.service.ts`

**Responsibilities**:
- Optimize safety stock levels based on service level targets
- Analyze ABC classification and adjust policies
- Calculate economic order quantity (EOQ)
- Identify slow-moving and obsolete inventory
- Recommend inventory reduction opportunities

**Key Methods**:
```typescript
async optimizeSafetyStock(materialId: string, serviceLevel: number): Promise<number>
async analyzeABCClassification(facilityId: string): Promise<ABCAnalysis>
async calculateEOQ(materialId: string): Promise<number>
async identifySlowMovingInventory(facilityId: string): Promise<Material[]>
async recommendInventoryReduction(facilityId: string): Promise<ReductionOpportunity[]>
```

### 5.2 GraphQL Schema Extensions

**File**: `/backend/src/graphql/schema/inventory-forecasting.graphql`

```graphql
type DemandForecast {
  forecastId: ID!
  tenantId: ID!
  facilityId: ID!
  materialId: ID!
  material: Material!

  forecastDate: Date!
  forecastHorizonDays: Int!
  forecastMethod: String!
  modelVersion: String!

  forecastedQuantity: Float!
  confidenceLevel: Float!
  lowerBound: Float!
  upperBound: Float!

  actualQuantity: Float

  modelParameters: JSON

  createdAt: DateTime!
  createdBy: User
}

type ForecastAccuracyMetrics {
  metricId: ID!
  tenantId: ID!
  facilityId: ID!
  materialId: ID!
  material: Material!

  evaluationPeriodStart: Date!
  evaluationPeriodEnd: Date!
  forecastMethod: String!

  mape: Float
  rmse: Float
  mae: Float
  bias: Float
  forecastAccuracyScore: Float

  dataPointsCount: Int!
  methodRank: Int

  createdAt: DateTime!
}

type ReplenishmentRecommendation {
  recommendationId: ID!
  tenantId: ID!
  facilityId: ID!
  materialId: ID!
  material: Material!

  recommendationDate: Date!
  recommendationStatus: String!

  currentOnHandQty: Float!
  currentAllocatedQty: Float!
  currentAvailableQty: Float!

  forecastedDemand30Days: Float!
  forecastedDemand60Days: Float!
  forecastedDemand90Days: Float!

  safetyStockQty: Float!
  reorderPoint: Float!

  recommendedOrderQty: Float!
  recommendedOrderDate: Date!

  preferredVendor: Vendor
  vendorLeadTimeDays: Int

  urgencyLevel: String!
  stockoutRiskDays: Int

  recommendationReason: String

  purchaseOrder: PurchaseOrder

  createdAt: DateTime!
  updatedAt: DateTime
}

type DemandPatternAnalysis {
  analysisId: ID!
  tenantId: ID!
  materialId: ID!
  material: Material!

  analysisStartDate: Date!
  analysisEndDate: Date!

  hasTrend: Boolean!
  trendDirection: String
  trendSlope: Float
  trendPValue: Float

  hasSeasonality: Boolean!
  seasonalityPeriodDays: Int
  seasonalityStrength: Float

  coefficientOfVariation: Float
  demandVolatilityCategory: String

  recommendedForecastMethod: String!

  createdAt: DateTime!
}

# Queries
extend type Query {
  # Demand forecasting
  demandForecast(materialId: ID!, facilityId: ID!, forecastDate: Date!): DemandForecast
  demandForecasts(facilityId: ID!, materialIds: [ID!], startDate: Date, endDate: Date): [DemandForecast!]!

  # Forecast accuracy
  forecastAccuracyMetrics(materialId: ID!, facilityId: ID!): [ForecastAccuracyMetrics!]!
  forecastMethodComparison(materialId: ID!, facilityId: ID!): [ForecastAccuracyMetrics!]!

  # Replenishment recommendations
  replenishmentRecommendations(facilityId: ID!, urgencyLevel: String, status: String): [ReplenishmentRecommendation!]!
  replenishmentRecommendation(recommendationId: ID!): ReplenishmentRecommendation

  # Pattern analysis
  demandPatternAnalysis(materialId: ID!): DemandPatternAnalysis
  demandPatternAnalyses(facilityId: ID!): [DemandPatternAnalysis!]!

  # Dashboard aggregates
  forecastDashboard(facilityId: ID!): ForecastDashboardData!
}

# Mutations
extend type Mutation {
  # Generate forecasts
  generateDemandForecast(materialId: ID!, facilityId: ID!, horizonDays: Int!): DemandForecast!
  generateAllForecasts(facilityId: ID!, horizonDays: Int!): [DemandForecast!]!

  # Update recommendations
  approveReplenishmentRecommendation(recommendationId: ID!): ReplenishmentRecommendation!
  rejectReplenishmentRecommendation(recommendationId: ID!, reason: String!): ReplenishmentRecommendation!

  # Recalculate metrics
  recalculateForecastAccuracy(materialId: ID!, facilityId: ID!): [ForecastAccuracyMetrics!]!

  # Pattern analysis
  analyzeD emandPatterns(materialId: ID!): DemandPatternAnalysis!
}

type ForecastDashboardData {
  facilityId: ID!
  facility: Facility!

  totalMaterialsTracked: Int!
  forecastAccuracyAverage: Float!

  criticalRecommendations: Int!
  highRecommendations: Int!
  mediumRecommendations: Int!
  lowRecommendations: Int!

  topAccurateForecasts: [DemandForecast!]!
  leastAccurateForecasts: [DemandForecast!]!

  upcomingStockouts: [ReplenishmentRecommendation!]!
}
```

### 5.3 GraphQL Resolver Implementation

**File**: `/backend/src/graphql/resolvers/inventory-forecasting.resolver.ts`

```typescript
@Resolver()
export class InventoryForecastingResolver {
  constructor(
    private demandForecastingService: DemandForecastingService,
    private forecastAccuracyService: ForecastAccuracyService,
    private replenishmentRecommendationService: ReplenishmentRecommendationService,
  ) {}

  @Query(() => [DemandForecast])
  async demandForecasts(
    @Args('facilityId') facilityId: string,
    @Args('materialIds', { nullable: true }) materialIds?: string[],
    @Args('startDate', { nullable: true }) startDate?: Date,
    @Args('endDate', { nullable: true }) endDate?: Date,
  ): Promise<DemandForecast[]> {
    return this.demandForecastingService.getForecasts({
      facilityId,
      materialIds,
      startDate,
      endDate,
    });
  }

  @Mutation(() => [DemandForecast])
  async generateAllForecasts(
    @Args('facilityId') facilityId: string,
    @Args('horizonDays') horizonDays: number,
  ): Promise<DemandForecast[]> {
    return this.demandForecastingService.generateAllForecasts(facilityId, horizonDays);
  }

  // ... additional resolver methods
}
```

---

## 6. FRONTEND IMPLEMENTATION

### 6.1 Dashboard Components

Following existing dashboard patterns from `/frontend/src/pages/BinUtilizationDashboard.tsx` and `/frontend/src/pages/ExecutiveDashboard.tsx`:

#### **Page 1: Inventory Forecasting Dashboard**

**File**: `/frontend/src/pages/InventoryForecastingDashboard.tsx`

**Components**:
1. **Forecast Accuracy KPIs**
   - Average MAPE across all materials
   - Forecast accuracy score (100 - MAPE)
   - Number of materials tracked
   - Trend indicator (improving vs declining accuracy)

2. **Replenishment Recommendations Widget**
   - Urgent recommendations count (by urgency level)
   - Days until next stockout
   - Pending approval count
   - Action buttons (Approve, Reject, Create PO)

3. **Forecast vs Actual Chart**
   - Time-series line chart with dual axes
   - Forecasted demand (with confidence intervals as shaded area)
   - Actual demand (overlaid)
   - Interactive date range selector

4. **Top Materials by Forecast Error**
   - Table showing materials with highest MAPE
   - Allows drill-down to material detail view
   - Sortable by error magnitude

5. **Method Performance Comparison**
   - Bar chart comparing MAPE by forecast method
   - Shows which methods work best for this facility

#### **Page 2: Material Forecast Detail View**

**File**: `/frontend/src/pages/MaterialForecastDetail.tsx`

**Components**:
1. **Material Information Card**
   - Material code, name, ABC classification
   - Current inventory levels
   - Safety stock, reorder point

2. **Forecast Chart**
   - Historical demand (last 12 months)
   - Forecasted demand (next 90 days)
   - Confidence intervals
   - Seasonal decomposition (trend, seasonality, residual)

3. **Accuracy Metrics Panel**
   - MAPE, RMSE, MAE, Bias
   - Forecast accuracy score
   - Method used and model parameters

4. **Pattern Analysis**
   - Trend detection (increasing/decreasing/stable)
   - Seasonality detection (period, strength)
   - Demand volatility category

5. **Replenishment Recommendation Card**
   - Recommended order quantity
   - Recommended order date
   - Urgency level with color coding
   - Stockout risk (days until stockout)
   - Action buttons

#### **Page 3: Replenishment Recommendations List**

**File**: `/frontend/src/pages/ReplenishmentRecommendationsPage.tsx`

**Components**:
1. **Filters**
   - Urgency level (CRITICAL, HIGH, MEDIUM, LOW)
   - Status (PENDING, APPROVED, REJECTED, ORDERED)
   - Material search
   - ABC classification

2. **Recommendations Table**
   - Columns: Material, Current Stock, Forecast 30d, Safety Stock, Recommended Qty, Order Date, Urgency, Actions
   - Sortable and filterable
   - Bulk actions (Approve All, Create POs)

3. **Recommendation Detail Modal**
   - Full recommendation details
   - Historical demand chart
   - Approval workflow
   - Notes/comments field

### 6.2 GraphQL Queries

**File**: `/frontend/src/graphql/queries/inventoryForecasting.ts`

```typescript
import { gql } from '@apollo/client';

export const GET_DEMAND_FORECASTS = gql`
  query GetDemandForecasts($facilityId: ID!, $materialIds: [ID!], $startDate: Date, $endDate: Date) {
    demandForecasts(facilityId: $facilityId, materialIds: $materialIds, startDate: $startDate, endDate: $endDate) {
      forecastId
      materialId
      material {
        materialCode
        materialName
        abcClassification
      }
      forecastDate
      forecastedQuantity
      confidenceLevel
      lowerBound
      upperBound
      actualQuantity
      forecastMethod
    }
  }
`;

export const GET_FORECAST_ACCURACY_METRICS = gql`
  query GetForecastAccuracyMetrics($materialId: ID!, $facilityId: ID!) {
    forecastAccuracyMetrics(materialId: $materialId, facilityId: $facilityId) {
      metricId
      evaluationPeriodStart
      evaluationPeriodEnd
      forecastMethod
      mape
      rmse
      mae
      bias
      forecastAccuracyScore
      methodRank
    }
  }
`;

export const GET_REPLENISHMENT_RECOMMENDATIONS = gql`
  query GetReplenishmentRecommendations($facilityId: ID!, $urgencyLevel: String, $status: String) {
    replenishmentRecommendations(facilityId: $facilityId, urgencyLevel: $urgencyLevel, status: $status) {
      recommendationId
      materialId
      material {
        materialCode
        materialName
        abcClassification
      }
      currentAvailableQty
      forecastedDemand30Days
      safetyStockQty
      recommendedOrderQty
      recommendedOrderDate
      urgencyLevel
      stockoutRiskDays
      recommendationStatus
    }
  }
`;

export const GENERATE_ALL_FORECASTS = gql`
  mutation GenerateAllForecasts($facilityId: ID!, $horizonDays: Int!) {
    generateAllForecasts(facilityId: $facilityId, horizonDays: $horizonDays) {
      forecastId
      materialId
      forecastDate
      forecastedQuantity
    }
  }
`;

export const APPROVE_RECOMMENDATION = gql`
  mutation ApproveRecommendation($recommendationId: ID!) {
    approveReplenishmentRecommendation(recommendationId: $recommendationId) {
      recommendationId
      recommendationStatus
      approvedAt
      approvedBy {
        userId
        username
      }
    }
  }
`;
```

### 6.3 Chart Components

Leverage existing chart components from `/frontend/src/components/common/Chart.tsx`:

**Component**: `<ForecastVsActualChart />`
- Type: Time-series line chart with confidence intervals
- X-axis: Date
- Y-axis: Quantity
- Series: Forecasted (line), Actual (line), Confidence Interval (shaded area)

**Component**: `<MethodPerformanceChart />`
- Type: Horizontal bar chart
- X-axis: MAPE (%)
- Y-axis: Forecast method
- Color coding: Green (<10%), Yellow (10-20%), Red (>20%)

---

## 7. BATCH PROCESSING AND AUTOMATION

### 7.1 Scheduled Jobs

Implement cron-based scheduled jobs:

#### **Job 1: Daily Forecast Generation**
- **Schedule**: Daily at 2:00 AM
- **Task**: Generate forecasts for all active materials across all facilities
- **Implementation**: NestJS scheduler or PostgreSQL pg_cron extension
- **Code**:
```typescript
@Cron('0 2 * * *') // 2:00 AM daily
async generateDailyForecasts() {
  const facilities = await this.facilitiesService.getActiveFacilities();

  for (const facility of facilities) {
    await this.demandForecastingService.generateAllForecasts(facility.facilityId, 90); // 90-day horizon
  }

  await this.refreshForecastDashboardCache();
}
```

#### **Job 2: Weekly Accuracy Evaluation**
- **Schedule**: Weekly on Sundays at 3:00 AM
- **Task**: Calculate forecast accuracy metrics for the past week
- **Code**:
```typescript
@Cron('0 3 * * 0') // 3:00 AM on Sundays
async evaluateWeeklyAccuracy() {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  const materials = await this.materialsService.getActiveMaterials();

  for (const material of materials) {
    await this.forecastAccuracyService.calculateAccuracyMetrics(
      material.materialId,
      startDate,
      endDate
    );
  }
}
```

#### **Job 3: Daily Replenishment Recommendations**
- **Schedule**: Daily at 4:00 AM
- **Task**: Generate replenishment recommendations based on latest forecasts
- **Code**:
```typescript
@Cron('0 4 * * *') // 4:00 AM daily
async generateDailyRecommendations() {
  const facilities = await this.facilitiesService.getActiveFacilities();

  for (const facility of facilities) {
    await this.replenishmentRecommendationService.generateRecommendations(facility.facilityId);
  }

  // Send alerts for critical items
  await this.sendCriticalStockoutAlerts();
}
```

### 7.2 Real-Time Triggers

Implement event-driven updates:

#### **Trigger 1: New Sales Order**
When a sales order is created, update forecasts for affected materials:
```typescript
@OnEvent('sales_order.created')
async handleNewSalesOrder(event: SalesOrderCreatedEvent) {
  const affectedMaterialIds = event.orderLines.map(line => line.materialId);

  for (const materialId of affectedMaterialIds) {
    // Regenerate forecast to incorporate latest demand signal
    await this.demandForecastingService.generateForecast(materialId, event.facilityId, 90);
  }
}
```

#### **Trigger 2: Inventory Receipt**
When inventory is received, reassess replenishment recommendations:
```typescript
@OnEvent('inventory.received')
async handleInventoryReceipt(event: InventoryReceiptEvent) {
  // Recalculate recommendations for this material
  await this.replenishmentRecommendationService.generateRecommendations(
    event.facilityId,
    [event.materialId]
  );
}
```

---

## 8. TESTING STRATEGY

### 8.1 Unit Tests

Following existing test patterns from `/backend/src/modules/wms/services/__tests__/`:

**Test File**: `demand-forecasting.service.spec.ts`

Test cases:
1. **Forecast generation**
   - Moving average calculation accuracy
   - Exponential smoothing with different alpha values
   - Holt-Winters seasonal decomposition
   - Confidence interval calculation

2. **Pattern detection**
   - Trend detection with synthetic data (increasing, decreasing, stable)
   - Seasonality detection with weekly/monthly patterns
   - Coefficient of variation calculation

3. **Method selection**
   - Automatic method selection based on data characteristics
   - Fallback to simpler methods when insufficient data

**Test File**: `forecast-accuracy.service.spec.ts`

Test cases:
1. **Accuracy metrics**
   - MAPE calculation
   - RMSE calculation
   - Bias detection (over-forecasting vs under-forecasting)
   - Forecast accuracy score

2. **Method comparison**
   - Ranking methods by performance
   - Switching to better-performing method

**Test File**: `replenishment-recommendation.service.spec.ts`

Test cases:
1. **Safety stock calculation**
   - Standard deviation method
   - Lead time variability method
   - ABC-based service levels

2. **Reorder point calculation**
   - Correct incorporation of lead time and safety stock
   - Handling of vendor-specific lead times

3. **Order quantity calculation**
   - EOQ adjustment for MOQ and order multiples
   - Urgency level determination

### 8.2 Integration Tests

Test end-to-end workflows:

**Test 1: Forecast Generation Pipeline**
1. Insert historical sales data
2. Trigger forecast generation
3. Verify forecasts stored in database
4. Verify accuracy metrics calculated
5. Verify recommendations generated

**Test 2: Recommendation Approval Workflow**
1. Generate recommendation
2. Approve recommendation
3. Verify status updated
4. Create purchase order from recommendation
5. Verify PO linked to recommendation

### 8.3 Performance Tests

Benchmark critical operations:

**Benchmark 1: Forecast Generation Speed**
- Target: Generate forecasts for 1000 materials in < 60 seconds
- Method: Batch processing with parallelization

**Benchmark 2: Dashboard Load Time**
- Target: Load forecast dashboard in < 2 seconds
- Optimization: Use materialized view caching

---

## 9. DEPLOYMENT CONSIDERATIONS

### 9.1 Data Migration

**Initial Data Load**:
1. Backfill historical demand from sales_orders (12 months minimum)
2. Generate initial forecasts for all active materials
3. Calculate baseline accuracy metrics
4. Populate demand pattern analysis table

**Migration Script**: `scripts/backfill-forecast-data.ts`
```typescript
async function backfillForecastData() {
  const materials = await getMaterials();

  for (const material of materials) {
    // Analyze historical patterns
    await demandPatternService.analyzePatterns(material.materialId);

    // Generate initial forecast
    await demandForecastingService.generateForecast(material.materialId, facilityId, 90);
  }

  console.log(`Backfilled ${materials.length} materials`);
}
```

### 9.2 Monitoring and Alerting

**Metrics to Track**:
- Forecast generation job success rate
- Average forecast accuracy (MAPE) across facility
- Number of critical replenishment recommendations
- Database query performance (P95 latency)

**Alerts**:
- Critical stockout risk (< 7 days until stockout)
- Forecast accuracy degradation (MAPE > 50%)
- Forecast generation job failures

### 9.3 Performance Optimization

**Database Optimizations**:
- Partition demand_forecasts table by facility_id and forecast_date
- Create indexes on frequently queried columns (material_id, forecast_date)
- Use materialized views for dashboard queries (100x speedup pattern from V0.0.16)

**Application Optimizations**:
- Cache forecast results for 24 hours
- Batch forecast generation (parallel processing)
- Lazy-load historical data for chart rendering

---

## 10. IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Weeks 1-2)
**Goal**: Establish data infrastructure and basic forecasting

**Tasks**:
1. Create database schema (migration V0.0.26)
2. Implement DemandForecastingService with moving average and exponential smoothing
3. Implement ForecastAccuracyService with MAPE and RMSE
4. Create GraphQL schema and resolvers
5. Write unit tests for core services

**Deliverables**:
- ✓ Database tables created
- ✓ Basic forecasting algorithms working
- ✓ GraphQL API functional
- ✓ 80% test coverage

### Phase 2: Advanced Analytics (Weeks 3-4)
**Goal**: Add seasonal decomposition and pattern analysis

**Tasks**:
1. Implement Holt-Winters seasonal forecasting
2. Implement demand pattern analysis service
3. Build automatic method selection algorithm
4. Add forecast confidence intervals
5. Create A/B testing framework integration

**Deliverables**:
- ✓ Seasonal forecasting operational
- ✓ Pattern detection working
- ✓ Method selection automated
- ✓ Statistical rigor validated

### Phase 3: Replenishment Recommendations (Weeks 5-6)
**Goal**: Generate actionable inventory recommendations

**Tasks**:
1. Implement ReplenishmentRecommendationService
2. Calculate safety stock, reorder point, EOQ
3. Assess stockout risk and urgency
4. Create recommendation approval workflow
5. Integrate with purchase order creation

**Deliverables**:
- ✓ Recommendations generated daily
- ✓ Approval workflow functional
- ✓ PO integration complete
- ✓ Alert system operational

### Phase 4: Frontend Dashboard (Weeks 7-8)
**Goal**: Deliver user-facing visualization and controls

**Tasks**:
1. Build InventoryForecastingDashboard page
2. Create MaterialForecastDetail page
3. Implement ReplenishmentRecommendationsPage
4. Build ForecastVsActualChart component
5. Create MethodPerformanceChart component

**Deliverables**:
- ✓ Dashboard accessible and performant
- ✓ Charts interactive and accurate
- ✓ Responsive design
- ✓ User acceptance testing passed

### Phase 5: Automation and Optimization (Weeks 9-10)
**Goal**: Automate processes and optimize performance

**Tasks**:
1. Implement daily forecast generation job
2. Implement weekly accuracy evaluation job
3. Create real-time triggers (sales order, inventory receipt)
4. Optimize database queries (materialized views, indexes)
5. Performance testing and tuning

**Deliverables**:
- ✓ Automated jobs running reliably
- ✓ Real-time updates working
- ✓ Dashboard load time < 2 seconds
- ✓ Batch processing < 60 seconds

### Phase 6: Production Deployment (Week 11)
**Goal**: Deploy to production and stabilize

**Tasks**:
1. Backfill historical forecast data
2. Deploy database migration
3. Deploy backend services
4. Deploy frontend updates
5. Monitor for 7 days and fix issues

**Deliverables**:
- ✓ Production deployment successful
- ✓ Zero critical bugs
- ✓ User training complete
- ✓ Documentation published

---

## 11. SUCCESS CRITERIA

### 11.1 Functional Requirements

| Requirement | Success Criteria |
|------------|------------------|
| Demand Forecasting | Forecasts generated daily for all active materials |
| Forecast Accuracy | Average MAPE < 30% across all materials |
| Replenishment Recommendations | Recommendations generated daily with urgency levels |
| Dashboard Performance | Load time < 2 seconds |
| Stockout Prevention | Alerts sent 7+ days before predicted stockout |
| Method Selection | System automatically selects best-performing method per material |
| Historical Tracking | 12+ months of historical demand preserved |

### 11.2 Non-Functional Requirements

| Requirement | Success Criteria |
|------------|------------------|
| Performance | Forecast generation for 1000 materials < 60 seconds |
| Scalability | Support 10,000+ materials per tenant |
| Reliability | Batch jobs 99.9% success rate |
| Data Quality | Data quality score > 90% |
| Test Coverage | 80%+ code coverage |
| Documentation | Complete API documentation and user guide |

### 11.3 Business Impact

| Metric | Target |
|--------|--------|
| Stockout Reduction | 30% reduction in stockout events |
| Inventory Holding Costs | 15% reduction in average inventory levels |
| Forecast Accuracy Improvement | 25% improvement over manual forecasting |
| Planning Efficiency | 50% reduction in time spent on manual inventory planning |
| Purchase Order Cycle Time | 20% faster replenishment decisions |

---

## 12. RISKS AND MITIGATION

### 12.1 Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Insufficient historical data | High | Medium | Implement fallback to simpler methods (moving average) for new materials |
| Forecast accuracy degradation | Medium | Medium | Continuous monitoring and automatic method switching |
| Performance issues with large datasets | Medium | Low | Use materialized views and partitioning (proven 100x speedup) |
| Integration complexity with existing modules | Medium | Low | Leverage existing patterns from bin optimization and vendor performance |

### 12.2 Business Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| User resistance to automated recommendations | Medium | Medium | Provide approval workflow and explanation for each recommendation |
| Over-reliance on forecasts | High | Low | Show confidence intervals and forecast accuracy metrics prominently |
| Seasonal demand changes not captured | Medium | Medium | Implement Holt-Winters seasonal method and pattern detection |

---

## 13. DEPENDENCIES

### 13.1 Internal Dependencies

| Dependency | Status | Required For |
|-----------|--------|--------------|
| WMS Module (V0.0.4) | ✓ Implemented | Inventory data source |
| Sales Module (V0.0.9) | ✓ Implemented | Demand data source |
| Procurement Module (V0.0.6) | ✓ Implemented | Vendor lead times |
| Statistical Analysis Framework (V0.0.22) | ✓ Implemented | Forecasting algorithms |
| Materialized Views (V0.0.16) | ✓ Implemented | Performance optimization |
| Data Quality Framework (V0.0.20) | ✓ Implemented | Input data validation |

### 13.2 External Dependencies

| Dependency | Purpose | Status |
|-----------|---------|--------|
| PostgreSQL 14+ | Time-series data and statistical functions | Required |
| NestJS Scheduler | Automated job execution | Available |
| Recharts or Chart.js | Chart visualization | Available |
| Apollo GraphQL | API layer | In use |

---

## 14. RECOMMENDATIONS FOR MARCUS (IMPLEMENTATION LEAD)

### 14.1 Start Here

1. **Review Existing Code Patterns**:
   - Study `/backend/src/modules/wms/services/bin-utilization-statistical-analysis.service.ts` for statistical analysis patterns
   - Review `/backend/src/modules/procurement/services/vendor-performance.service.ts` for rolling metrics patterns
   - Examine `/backend/migrations/V0.0.22__bin_utilization_statistical_analysis.sql` for database design patterns

2. **Leverage Existing Infrastructure**:
   - **Statistical analysis**: Use existing correlation and regression functions from V0.0.22
   - **Materialized views**: Copy the caching pattern from V0.0.16 (100x speedup)
   - **Data quality**: Integrate with existing framework from V0.0.20
   - **A/B testing**: Use existing framework to compare forecast methods

3. **Follow Proven Architectural Patterns**:
   - Service-based architecture with dependency injection
   - GraphQL resolvers with direct SQL for performance-critical queries
   - Multi-tenant isolation with row-level security
   - SCD Type 2 for historical tracking

### 14.2 Quick Wins

**Week 1 Quick Wins**:
1. Implement simple moving average forecasting (easiest algorithm)
2. Create demand_forecasts table and basic insert/query
3. Build basic GraphQL query to retrieve forecasts
4. Create simple line chart showing forecast vs actual

**Week 2 Quick Wins**:
1. Implement exponential smoothing (Priya's statistical functions can help)
2. Add MAPE calculation (simple formula)
3. Create forecast_accuracy_metrics table
4. Build dashboard KPI card showing average MAPE

### 14.3 Avoid Common Pitfalls

1. **Don't reinvent the wheel**: Use existing statistical functions from V0.0.22
2. **Don't optimize prematurely**: Start with simple algorithms, add complexity based on actual needs
3. **Don't skip data quality checks**: Leverage existing framework from V0.0.20
4. **Don't ignore performance**: Use materialized views pattern from day 1

### 14.4 Integration Touchpoints

**Backend Integration**:
- `/backend/src/graphql/resolvers/wms.resolver.ts` - Add forecasting queries here
- `/backend/src/modules/wms/services/` - Create new services here
- `/backend/migrations/` - Add V0.0.26 migration here

**Frontend Integration**:
- `/frontend/src/pages/` - Add dashboard pages here
- `/frontend/src/graphql/queries/` - Add forecast queries here
- `/frontend/src/components/common/` - Reuse existing Chart and DataTable components

**Database Integration**:
- Join with `lots` table for current inventory levels
- Join with `sales_order_lines` for historical demand
- Join with `materials` table for planning parameters (safety_stock, reorder_point)
- Join with `vendor_performance` for supply reliability

---

## 15. REFERENCES AND RESOURCES

### 15.1 Internal Documentation

**Files to Review**:
1. `/backend/database/schemas/wms-module.sql` - WMS data model
2. `/backend/migrations/V0.0.22__bin_utilization_statistical_analysis.sql` - Statistical analysis patterns
3. `/backend/src/modules/wms/services/bin-utilization-statistical-analysis.service.ts` - Service implementation pattern
4. `/backend/src/graphql/resolvers/wms.resolver.ts` - GraphQL resolver pattern
5. `/frontend/src/pages/BinUtilizationDashboard.tsx` - Dashboard implementation pattern

### 15.2 Forecasting Methods Documentation

**Algorithms**:
1. **Moving Average**: Simple average of last N periods
2. **Exponential Smoothing**: Weighted average favoring recent observations
3. **Holt's Method**: Exponential smoothing with linear trend
4. **Holt-Winters**: Exponential smoothing with trend and seasonality
5. **STL Decomposition**: Seasonal-Trend decomposition using Loess

**Accuracy Metrics**:
1. **MAPE**: Mean Absolute Percentage Error - industry standard
2. **RMSE**: Root Mean Squared Error - penalizes large errors
3. **MAE**: Mean Absolute Error - simple average error
4. **Bias**: Systematic over/under-forecasting detection

### 15.3 Industry Best Practices

**Forecast Accuracy Benchmarks**:
- Class A materials (high velocity): Target MAPE < 15%
- Class B materials (medium velocity): Target MAPE < 25%
- Class C materials (low velocity): Target MAPE < 40%

**Safety Stock Service Levels**:
- Class A: 99% service level (Z = 2.33)
- Class B: 95% service level (Z = 1.65)
- Class C: 90% service level (Z = 1.28)

**Forecast Horizon**:
- Short-term: 30 days (tactical planning)
- Medium-term: 90 days (procurement planning)
- Long-term: 365 days (strategic planning)

---

## 16. CONCLUSION

The AGOGSAAS system has a **strong foundation** for implementing inventory forecasting:
- Comprehensive historical data (SCD Type 2 tracking)
- Advanced statistical analysis framework (V0.0.22)
- High-performance infrastructure (materialized views, partitioning)
- Proven integration patterns (sales, procurement, warehouse modules)

**Key Implementation Priorities**:
1. **Phase 1**: Implement basic forecasting algorithms (moving average, exponential smoothing)
2. **Phase 2**: Add accuracy tracking (MAPE, RMSE) and method comparison
3. **Phase 3**: Build replenishment recommendations (safety stock, reorder point, EOQ)
4. **Phase 4**: Create dashboard visualization
5. **Phase 5**: Automate with scheduled jobs and real-time triggers

**Expected Outcomes**:
- 30% reduction in stockout events
- 15% reduction in average inventory holding costs
- 25% improvement in forecast accuracy over manual methods
- 50% reduction in time spent on manual inventory planning

This research deliverable provides Marcus with a **comprehensive blueprint** to implement inventory forecasting efficiently, leveraging existing infrastructure and following proven architectural patterns.

---

**RESEARCH COMPLETE**

**Prepared by**: Cynthia (Research Lead)
**For**: Marcus (Implementation Lead)
**Date**: 2025-12-25
**REQ**: REQ-STRATEGIC-AUTO-1766718736461
**Status**: READY FOR IMPLEMENTATION

