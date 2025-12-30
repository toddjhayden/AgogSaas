#!/bin/bash
# Simplified QA Test Suite for Inventory Forecasting

GRAPHQL_URL="http://localhost:4000/graphql"
TENANT_ID="018d0001-0001-7000-8000-000000000001"
FACILITY_ID="018d0001-0001-7000-8000-000000000002"
MATERIAL_MA="018d0001-0002-7000-8000-000000000001"

echo "==================================="
echo "INVENTORY FORECASTING QA TESTS"
echo "==================================="
echo ""

# Test 1: Get Demand History
echo "Test 1: Get Demand History"
curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"query { getDemandHistory(tenantId: \\\"$TENANT_ID\\\", facilityId: \\\"$FACILITY_ID\\\", materialId: \\\"$MATERIAL_MA\\\", startDate: \\\"2024-09-01\\\", endDate: \\\"2025-12-28\\\") { demandHistoryId demandDate actualDemandQuantity } }\"}" | python3 -m json.tool | head -50
echo ""
echo "---"
echo ""

# Test 2: Generate Forecasts
echo "Test 2: Generate Moving Average Forecasts (30 days)"
curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"mutation { generateForecasts(input: { tenantId: \\\"$TENANT_ID\\\", facilityId: \\\"$FACILITY_ID\\\", materialIds: [\\\"$MATERIAL_MA\\\"], forecastHorizonDays: 30, forecastAlgorithm: MOVING_AVERAGE }) { forecastId forecastDate forecastedDemandQuantity forecastAlgorithm lowerBound80Pct upperBound80Pct } }\"}" | python3 -m json.tool | head -50
echo ""
echo "---"
echo ""

# Test 3: Calculate Safety Stock
echo "Test 3: Calculate Safety Stock (95% service level)"
curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"query { calculateSafetyStock(input: { tenantId: \\\"$TENANT_ID\\\", facilityId: \\\"$FACILITY_ID\\\", materialId: \\\"$MATERIAL_MA\\\", serviceLevel: 0.95 }) { materialId safetyStockQuantity reorderPoint economicOrderQuantity avgDailyDemand demandStdDev serviceLevel zScore } }\"}" | python3 -m json.tool
echo ""
echo "---"
echo ""

# Test 4: Get Forecast Accuracy Summary
echo "Test 4: Get Forecast Accuracy Summary"
curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"query { getForecastAccuracySummary(tenantId: \\\"$TENANT_ID\\\", facilityId: \\\"$FACILITY_ID\\\", materialIds: [\\\"$MATERIAL_MA\\\"]) { materialId last30DaysMape last60DaysMape last90DaysMape totalForecastsGenerated totalActualDemandRecorded currentForecastAlgorithm } }\"}" | python3 -m json.tool
echo ""

echo "==================================="
echo "TEST SUITE COMPLETE"
echo "==================================="
