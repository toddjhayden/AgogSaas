# Inventory Forecasting Module

**REQ:** REQ-STRATEGIC-AUTO-1766675619639
**Implementation Date:** 2025-12-26
**Phase:** Phase 1 - Foundation (Simple Forecasting Methods)
**Status:** COMPLETE

## Overview

This module implements inventory demand forecasting capabilities for the AGOG Print Industry ERP system. It provides automated demand forecasting, safety stock calculations, and replenishment planning based on historical consumption patterns.

## Features Implemented

### Phase 1: Foundation (Current)

1. **Demand History Tracking**
   - Automatic recording of demand from inventory transactions
   - Disaggregation by source (sales orders, production, transfers, scrap)
   - Support for exogenous variables (pricing, promotions, campaigns)
   - Backfill capability from existing inventory_transactions

2. **Forecasting Algorithms**
   - **Moving Average (MA):** For stable demand patterns
   - **Simple Exponential Smoothing (SES):** For variable demand patterns
   - Automatic algorithm selection based on coefficient of variation
   - Confidence intervals (80% and 95%) for forecast uncertainty

3. **Safety Stock Calculations**
   - **Basic Safety Stock:** Fixed days of supply
   - **Demand Variability Safety Stock:** For seasonal/promotional items
   - **Lead Time Variability Safety Stock:** For unreliable suppliers
   - **Combined Variability Safety Stock (King's Formula):** For critical A-class materials
   - Automatic formula selection based on demand and lead time variability

4. **Reorder Point & EOQ**
   - Reorder Point = (Avg Daily Demand × Avg Lead Time) + Safety Stock
   - Economic Order Quantity (EOQ) calculation
   - Integration with vendor lead time statistics

5. **GraphQL API**
   - Queries: getDemandHistory, getMaterialForecasts, calculateSafetyStock
   - Mutations: generateForecasts, recordDemand, backfillDemandHistory

## Database Schema

### New Tables Created

1. **demand_history** - Historical demand tracking
2. **material_forecasts** - Generated forecasts with confidence intervals
3. **forecast_models** - Model metadata and performance tracking
4. **forecast_accuracy_metrics** - MAPE, bias, and accuracy metrics
5. **replenishment_suggestions** - Automated PO recommendations

### Extended Tables

- **materials** - Added forecasting configuration fields:
  - forecasting_enabled
  - forecast_algorithm
  - forecast_horizon_days
  - forecast_update_frequency
  - minimum_forecast_history_days
  - target_forecast_accuracy_pct
  - demand_pattern

## Services

### DemandHistoryService

**Location:** `src/modules/forecasting/services/demand-history.service.ts`

**Methods:**
- `recordDemand()` - Record actual demand from inventory transactions
- `getDemandHistory()` - Retrieve historical demand data
- `backfillDemandHistory()` - Populate historical data from inventory_transactions
- `updateForecastedDemand()` - Update forecasted quantities for accuracy tracking
- `getDemandStatistics()` - Get aggregated statistics (avg, stddev, min, max)

### ForecastingService

**Location:** `src/modules/forecasting/services/forecasting.service.ts`

**Methods:**
- `generateForecasts()` - Generate forecasts using MA or SES
- `getMaterialForecasts()` - Retrieve forecasts for a material
- `selectAlgorithm()` - Auto-select forecasting algorithm
- `generateMovingAverageForecast()` - MA implementation
- `generateExponentialSmoothingForecast()` - SES implementation

**Algorithms:**
- Moving Average (30-day window)
- Simple Exponential Smoothing (α = 0.3)

### SafetyStockService

**Location:** `src/modules/forecasting/services/safety-stock.service.ts`

**Methods:**
- `calculateSafetyStock()` - Auto-select and calculate safety stock
- `calculateBasicSafetyStock()` - Fixed days of supply
- `calculateDemandVariabilitySafetyStock()` - Demand variability formula
- `calculateLeadTimeVariabilitySafetyStock()` - Lead time variability formula
- `calculateCombinedVariabilitySafetyStock()` - King's formula
- `calculateReorderPoint()` - ROP calculation
- `calculateEOQ()` - Economic Order Quantity
- `updateMaterialPlanningParameters()` - Update material master data

**Z-Scores:**
- 99% service level → 2.33
- 95% service level → 1.65
- 90% service level → 1.28

## Usage Examples

### 1. Backfill Historical Demand

```graphql
mutation BackfillDemand {
  backfillDemandHistory(
    tenantId: "tenant-123"
    facilityId: "facility-456"
    startDate: "2024-10-01"
    endDate: "2024-12-26"
  )
}
```

### 2. Generate Forecasts

```graphql
mutation GenerateForecasts {
  generateForecasts(
    input: {
      tenantId: "tenant-123"
      facilityId: "facility-456"
      materialIds: ["mat-001", "mat-002", "mat-003"]
      forecastHorizonDays: 30
      forecastAlgorithm: AUTO
    }
  ) {
    forecastId
    materialId
    forecastDate
    forecastedDemandQuantity
    forecastAlgorithm
    lowerBound95Pct
    upperBound95Pct
    modelConfidenceScore
  }
}
```

### 3. Calculate Safety Stock

```graphql
query CalculateSafetyStock {
  calculateSafetyStock(
    input: {
      tenantId: "tenant-123"
      facilityId: "facility-456"
      materialId: "mat-001"
      serviceLevel: 0.95
    }
  ) {
    safetyStockQuantity
    reorderPoint
    economicOrderQuantity
    calculationMethod
    avgDailyDemand
    demandStdDev
    avgLeadTimeDays
    leadTimeStdDev
  }
}
```

### 4. Get Demand History

```graphql
query GetDemandHistory {
  getDemandHistory(
    tenantId: "tenant-123"
    facilityId: "facility-456"
    materialId: "mat-001"
    startDate: "2024-10-01"
    endDate: "2024-12-26"
  ) {
    demandDate
    actualDemandQuantity
    forecastedDemandQuantity
    salesOrderDemand
    productionOrderDemand
    forecastError
    absolutePercentageError
  }
}
```

### 5. Get Forecasts

```graphql
query GetForecasts {
  getMaterialForecasts(
    tenantId: "tenant-123"
    facilityId: "facility-456"
    materialId: "mat-001"
    startDate: "2024-12-27"
    endDate: "2025-01-26"
    forecastStatus: ACTIVE
  ) {
    forecastDate
    forecastedDemandQuantity
    forecastAlgorithm
    lowerBound80Pct
    upperBound80Pct
    modelConfidenceScore
  }
}
```

## Integration Points

### WMS Integration (Future)

When inventory is consumed (ISSUE, SCRAP, TRANSFER transactions), the system should automatically record demand:

```typescript
// In wms.resolver.ts
async createInventoryTransaction(input) {
  const transaction = await this.wmsService.createTransaction(input);

  // Record demand
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

## Performance Benchmarks

### Target Metrics (Phase 1)

- **A-Class Materials:** MAPE < 25%
- **B-Class Materials:** MAPE < 35%
- **C-Class Materials:** MAPE < 40%

### Forecast Generation Performance

- 10 materials × 30 days: <5 seconds
- 100 materials × 30 days: <30 seconds
- 1000 materials × 30 days: Use batch processing

## Security

### Row-Level Security (RLS)

All forecasting tables implement RLS policies based on `tenant_id`:

```sql
CREATE POLICY tenant_isolation_demand_history ON demand_history
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
```

### Data Access Control

- Users can only access forecasts for their tenant
- All queries filter by tenant_id
- Audit trail maintained for forecast overrides

## Future Enhancements

### Phase 2: Statistical Forecasting (Planned)

- Python microservice with FastAPI
- SARIMA implementation using statsmodels
- Auto-parameter selection (auto_arima)
- Seasonal decomposition
- Backtesting validation framework

### Phase 3: ML Forecasting (Planned)

- LightGBM implementation using skforecast
- Feature engineering (lags, rolling windows, calendar features)
- Hyperparameter tuning with Optuna
- Model selection logic (AUTO algorithm)
- 5-10% accuracy improvement over SARIMA

### Phase 4: Demand Sensing (Planned)

- Real-time demand signal aggregation
- Sales order pipeline integration
- Anomaly detection (spike detection, trend shifts)
- Short-term forecast adjustments
- 3-5 day detection speed improvement

## Maintenance

### Daily Jobs (Future)

1. Demand aggregation from inventory transactions
2. Forecast accuracy calculation (actual vs forecast)
3. Short-term forecast updates for A-class materials

### Weekly Jobs (Future)

1. Medium-term forecast generation (30-90 days)
2. Replenishment suggestion generation
3. MAPE and bias tracking

### Monthly Jobs (Future)

1. Model retraining with updated data
2. Safety stock recalculation
3. Long-term strategic forecasting

## Troubleshooting

### Issue: Insufficient Demand History

**Problem:** Material has <7 days of demand history
**Solution:** Increase backfill date range or use manual forecasts

### Issue: High Forecast Error

**Problem:** MAPE > 40%
**Solution:**
1. Check demand pattern (seasonal, erratic, lumpy)
2. Try different algorithm (MA vs SES)
3. Investigate demand drivers (promotions, price changes)
4. Consider manual override

### Issue: Safety Stock Too High

**Problem:** Safety stock calculation exceeds reasonable levels
**Solution:**
1. Review service level target (reduce from 99% to 95%)
2. Check demand variability (outliers)
3. Verify lead time statistics
4. Use basic formula for C-class items

## References

- Research Deliverable: `CYNTHIA_RESEARCH_DELIVERABLE_REQ-STRATEGIC-AUTO-1766675619639.md`
- Critique Deliverable: `SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1766675619639.md`
- Database Migration: `V0.0.30__create_inventory_forecasting_tables.sql`

## Contact

For questions or issues, contact the implementation team:
- Backend Lead: Marcus (Roy)
- Research: Cynthia
- QA: Sylvia
