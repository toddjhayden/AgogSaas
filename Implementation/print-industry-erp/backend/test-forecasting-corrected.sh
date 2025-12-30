#!/bin/bash
# Corrected QA Test Suite for Inventory Forecasting

GRAPHQL_URL="http://localhost:4000/graphql"
TENANT_ID="018d0001-0000-7000-8000-000000000001"
FACILITY_ID="018d0001-0001-7000-8000-000000000001"
MATERIAL_MA="018d0001-0002-7000-8000-000000000001"
MATERIAL_ES="018d0001-0003-7000-8000-000000000001"
MATERIAL_HW="018d0001-0004-7000-8000-000000000001"

echo "=========================================="
echo "INVENTORY FORECASTING QA TEST SUITE"
echo "REQ: REQ-STRATEGIC-AUTO-1735405200000"
echo "=========================================="
echo ""

# Test 1: Get Demand History
echo "TEST 1: Get Demand History for MAT-FCST-001"
echo "--------------------------------------------"
RESULT1=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"query { getDemandHistory(tenantId: \\\"$TENANT_ID\\\", facilityId: \\\"$FACILITY_ID\\\", materialId: \\\"$MATERIAL_MA\\\", startDate: \\\"2024-09-01\\\", endDate: \\\"2025-12-28\\\") { demandHistoryId demandDate actualDemandQuantity demandUom } }\"}")
echo "$RESULT1" | python3 -m json.tool | head -30
echo ""

# Test 2: Generate Moving Average Forecasts
echo "TEST 2: Generate Moving Average Forecasts (30 days)"
echo "----------------------------------------------------"
RESULT2=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"mutation { generateForecasts(input: { tenantId: \\\"$TENANT_ID\\\", facilityId: \\\"$FACILITY_ID\\\", materialIds: [\\\"$MATERIAL_MA\\\"], forecastHorizonDays: 30, forecastAlgorithm: MOVING_AVERAGE }) { forecastId forecastDate forecastedDemandQuantity forecastAlgorithm lowerBound80Pct upperBound80Pct modelConfidenceScore } }\"}")
echo "$RESULT2" | python3 -m json.tool | head -40
echo ""

# Test 3: Generate Exponential Smoothing Forecasts
echo "TEST 3: Generate Exponential Smoothing Forecasts"
echo "-------------------------------------------------"
RESULT3=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"mutation { generateForecasts(input: { tenantId: \\\"$TENANT_ID\\\", facilityId: \\\"$FACILITY_ID\\\", materialIds: [\\\"$MATERIAL_ES\\\"], forecastHorizonDays: 30, forecastAlgorithm: EXP_SMOOTHING }) { forecastId forecastedDemandQuantity forecastAlgorithm } }\"}")
COUNT3=$(echo "$RESULT3" | grep -o "forecastId" | wc -l)
echo "Generated $COUNT3 forecasts with EXP_SMOOTHING"
echo "$RESULT3" | python3 -m json.tool | head -30
echo ""

# Test 4: Generate Holt-Winters Forecasts
echo "TEST 4: Generate Holt-Winters Seasonal Forecasts (90 days)"
echo "-----------------------------------------------------------"
RESULT4=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"mutation { generateForecasts(input: { tenantId: \\\"$TENANT_ID\\\", facilityId: \\\"$FACILITY_ID\\\", materialIds: [\\\"$MATERIAL_HW\\\"], forecastHorizonDays: 90, forecastAlgorithm: HOLT_WINTERS }) { forecastId forecastedDemandQuantity } }\"}")
COUNT4=$(echo "$RESULT4" | grep -o "forecastId" | wc -l)
echo "Generated $COUNT4 seasonal forecasts with HOLT_WINTERS"
echo ""

# Test 5: Calculate Safety Stock
echo "TEST 5: Calculate Safety Stock (95% service level)"
echo "----------------------------------------------------"
RESULT5=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"query { calculateSafetyStock(input: { tenantId: \\\"$TENANT_ID\\\", facilityId: \\\"$FACILITY_ID\\\", materialId: \\\"$MATERIAL_MA\\\", serviceLevel: 0.95 }) { materialId safetyStockQuantity reorderPoint economicOrderQuantity calculationMethod avgDailyDemand demandStdDev avgLeadTimeDays leadTimeStdDev serviceLevel zScore } }\"}")
echo "$RESULT5" | python3 -m json.tool
echo ""

# Test 6: Get Material Forecasts
echo "TEST 6: Get Material Forecasts (retrieve generated forecasts)"
echo "--------------------------------------------------------------"
RESULT6=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"query { getMaterialForecasts(tenantId: \\\"$TENANT_ID\\\", facilityId: \\\"$FACILITY_ID\\\", materialId: \\\"$MATERIAL_MA\\\", startDate: \\\"2025-12-28\\\", endDate: \\\"2026-01-15\\\", forecastStatus: ACTIVE) { forecastId forecastDate forecastedDemandQuantity forecastAlgorithm } }\"}")
echo "$RESULT6" | python3 -m json.tool | head -30
echo ""

# Test 7: Get Forecast Accuracy Summary
echo "TEST 7: Get Forecast Accuracy Summary"
echo "--------------------------------------"
RESULT7=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"query { getForecastAccuracySummary(tenantId: \\\"$TENANT_ID\\\", facilityId: \\\"$FACILITY_ID\\\", materialIds: [\\\"$MATERIAL_MA\\\", \\\"$MATERIAL_ES\\\", \\\"$MATERIAL_HW\\\"]) { materialId last30DaysMape last60DaysMape last90DaysMape totalForecastsGenerated totalActualDemandRecorded currentForecastAlgorithm lastForecastGenerationDate } }\"}")
echo "$RESULT7" | python3 -m json.tool
echo ""

# Test 8: Generate Replenishment Recommendations
echo "TEST 8: Generate Replenishment Recommendations"
echo "-----------------------------------------------"
RESULT8=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"mutation { generateReplenishmentRecommendations(input: { tenantId: \\\"$TENANT_ID\\\", facilityId: \\\"$FACILITY_ID\\\", materialIds: [\\\"$MATERIAL_MA\\\", \\\"$MATERIAL_ES\\\"] }) { suggestionId materialId recommendedOrderQuantity urgencyLevel daysUntilStockout forecastedDemand30Days safetyStockQuantity reorderPointQuantity currentOnHandQuantity } }\"}")
echo "$RESULT8" | python3 -m json.tool | head -40
echo ""

# Test 9: Get Replenishment Recommendations  
echo "TEST 9: Get Replenishment Recommendations (retrieve)"
echo "-----------------------------------------------------"
RESULT9=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"query { getReplenishmentRecommendations(tenantId: \\\"$TENANT_ID\\\", facilityId: \\\"$FACILITY_ID\\\", status: PENDING) { suggestionId materialId urgencyLevel daysUntilStockout recommendedOrderQuantity } }\"}")
COUNT9=$(echo "$RESULT9" | grep -o "suggestionId" | wc -l)
echo "Retrieved $COUNT9 replenishment recommendations"
echo "$RESULT9" | python3 -m json.tool | head -30
echo ""

echo "=========================================="
echo "TEST SUITE COMPLETE"
echo "=========================================="
echo ""
echo "SUMMARY:"
echo "- Test 1: Demand History Retrieval"
echo "- Test 2: Moving Average Forecasting"
echo "- Test 3: Exponential Smoothing Forecasting"
echo "- Test 4: Holt-Winters Seasonal Forecasting"
echo "- Test 5: Safety Stock Calculation"
echo "- Test 6: Forecast Retrieval"
echo "- Test 7: Forecast Accuracy Metrics"
echo "- Test 8: Replenishment Recommendations Generation"
echo "- Test 9: Replenishment Recommendations Retrieval"
echo "=========================================="
