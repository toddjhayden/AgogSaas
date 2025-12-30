#!/bin/bash
# QA Test Suite for Inventory Forecasting (REQ-STRATEGIC-AUTO-1735405200000)
# Author: Billy (QA Specialist)
# Date: 2025-12-28

set -e

GRAPHQL_URL="http://localhost:4000/graphql"
TENANT_ID="018d0001-0001-7000-8000-000000000001"
FACILITY_ID="018d0001-0001-7000-8000-000000000002"
MATERIAL_MA="018d0001-0002-7000-8000-000000000001"  # MAT-FCST-001 (Moving Average)
MATERIAL_ES="018d0001-0003-7000-8000-000000000001"  # MAT-FCST-002 (Exponential Smoothing)
MATERIAL_HW="018d0001-0004-7000-8000-000000000001"  # MAT-FCST-003 (Holt-Winters)

echo "============================================"
echo "INVENTORY FORECASTING QA TEST SUITE"
echo "REQ: REQ-STRATEGIC-AUTO-1735405200000"
echo "============================================"
echo ""

# Test 1: Get Demand History
echo "Test 1: Get Demand History for MAT-FCST-001"
echo "-------------------------------------------"
QUERY1='{
  "query": "query GetDemandHistory { getDemandHistory(tenantId: \"'$TENANT_ID'\", facilityId: \"'$FACILITY_ID'\", materialId: \"'$MATERIAL_MA'\", startDate: \"2024-09-01\", endDate: \"2025-12-28\") { demandHistoryId demandDate actualDemandQuantity demandUom forecastError } }"
}'
RESULT1=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "$QUERY1")
echo "$RESULT1" | jq -r '.data.getDemandHistory | length' > /tmp/test1_count.txt
COUNT1=$(cat /tmp/test1_count.txt)
if [ "$COUNT1" -gt "80" ]; then
  echo "✅ PASS - Retrieved $COUNT1 demand history records"
else
  echo "❌ FAIL - Expected >80 records, got $COUNT1"
fi
echo ""

# Test 2: Generate Forecasts - Moving Average
echo "Test 2: Generate Forecasts - Moving Average Algorithm"
echo "-------------------------------------------------------"
QUERY2='{
  "query": "mutation GenerateForecastsMA { generateForecasts(input: { tenantId: \"'$TENANT_ID'\", facilityId: \"'$FACILITY_ID'\", materialIds: [\"'$MATERIAL_MA'\"], forecastHorizonDays: 30, forecastAlgorithm: MOVING_AVERAGE }) { forecastId materialId forecastDate forecastedDemandQuantity forecastAlgorithm lowerBound80Pct upperBound80Pct } }"
}'
RESULT2=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "$QUERY2")
echo "$RESULT2" | jq -r '.data.generateForecasts | length' > /tmp/test2_count.txt
COUNT2=$(cat /tmp/test2_count.txt)
if [ "$COUNT2" -eq "30" ]; then
  echo "✅ PASS - Generated $COUNT2 forecasts"
  echo "$RESULT2" | jq -r '.data.generateForecasts[0]'
else
  echo "❌ FAIL - Expected 30 forecasts, got $COUNT2"
  echo "$RESULT2"
fi
echo ""

# Test 3: Get Material Forecasts
echo "Test 3: Get Material Forecasts"
echo "-------------------------------"
QUERY3='{
  "query": "query GetMaterialForecasts { getMaterialForecasts(tenantId: \"'$TENANT_ID'\", facilityId: \"'$FACILITY_ID'\", materialId: \"'$MATERIAL_MA'\", startDate: \"2025-12-28\", endDate: \"2026-01-31\", forecastStatus: ACTIVE) { forecastId forecastDate forecastedDemandQuantity forecastAlgorithm } }"
}'
RESULT3=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "$QUERY3")
COUNT3=$(echo "$RESULT3" | jq -r '.data.getMaterialForecasts | length')
if [ "$COUNT3" -gt "0" ]; then
  echo "✅ PASS - Retrieved $COUNT3 active forecasts"
else
  echo "❌ FAIL - Expected >0 forecasts, got $COUNT3"
fi
echo ""

# Test 4: Calculate Safety Stock
echo "Test 4: Calculate Safety Stock"
echo "-------------------------------"
QUERY4='{
  "query": "query CalculateSafetyStock { calculateSafetyStock(input: { tenantId: \"'$TENANT_ID'\", facilityId: \"'$FACILITY_ID'\", materialId: \"'$MATERIAL_MA'\", serviceLevel: 0.95 }) { materialId safetyStockQuantity reorderPoint economicOrderQuantity calculationMethod avgDailyDemand demandStdDev serviceLevel zScore } }"
}'
RESULT4=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "$QUERY4")
SAFETY_STOCK=$(echo "$RESULT4" | jq -r '.data.calculateSafetyStock.safetyStockQuantity')
if [ "$SAFETY_STOCK" != "null" ] && [ "$SAFETY_STOCK" != "" ]; then
  echo "✅ PASS - Safety stock calculated: $SAFETY_STOCK units"
  echo "$RESULT4" | jq -r '.data.calculateSafetyStock'
else
  echo "❌ FAIL - Safety stock calculation failed"
  echo "$RESULT4"
fi
echo ""

# Test 5: Get Forecast Accuracy Summary
echo "Test 5: Get Forecast Accuracy Summary"
echo "--------------------------------------"
QUERY5='{
  "query": "query GetForecastAccuracySummary { getForecastAccuracySummary(tenantId: \"'$TENANT_ID'\", facilityId: \"'$FACILITY_ID'\", materialIds: [\"'$MATERIAL_MA'\"]) { materialId last30DaysMape last60DaysMape last90DaysMape totalForecastsGenerated totalActualDemandRecorded currentForecastAlgorithm } }"
}'
RESULT5=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "$QUERY5")
TOTAL_FORECASTS=$(echo "$RESULT5" | jq -r '.data.getForecastAccuracySummary[0].totalForecastsGenerated')
if [ "$TOTAL_FORECASTS" != "null" ]; then
  echo "✅ PASS - Forecast accuracy summary retrieved"
  echo "$RESULT5" | jq -r '.data.getForecastAccuracySummary[0]'
else
  echo "❌ FAIL - Forecast accuracy summary failed"
  echo "$RESULT5"
fi
echo ""

# Test 6: Generate Replenishment Recommendations
echo "Test 6: Generate Replenishment Recommendations"
echo "-----------------------------------------------"
QUERY6='{
  "query": "mutation GenerateReplenishmentRecommendations { generateReplenishmentRecommendations(input: { tenantId: \"'$TENANT_ID'\", facilityId: \"'$FACILITY_ID'\", materialIds: [\"'$MATERIAL_MA'\"] }) { suggestionId materialId recommendedOrderQuantity urgencyLevel daysUntilStockout forecastedDemand30Days safetyStockQuantity reorderPointQuantity } }"
}'
RESULT6=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "$QUERY6")
REPL_COUNT=$(echo "$RESULT6" | jq -r '.data.generateReplenishmentRecommendations | length')
if [ "$REPL_COUNT" != "null" ]; then
  echo "✅ PASS - Generated $REPL_COUNT replenishment recommendations"
  if [ "$REPL_COUNT" -gt "0" ]; then
    echo "$RESULT6" | jq -r '.data.generateReplenishmentRecommendations[0]'
  fi
else
  echo "❌ FAIL - Replenishment recommendations generation failed"
  echo "$RESULT6"
fi
echo ""

# Test 7: Get Replenishment Recommendations
echo "Test 7: Get Replenishment Recommendations"
echo "------------------------------------------"
QUERY7='{
  "query": "query GetReplenishmentRecommendations { getReplenishmentRecommendations(tenantId: \"'$TENANT_ID'\", facilityId: \"'$FACILITY_ID'\", status: PENDING) { suggestionId materialId urgencyLevel daysUntilStockout recommendedOrderQuantity } }"
}'
RESULT7=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "$QUERY7")
REPL_FETCH_COUNT=$(echo "$RESULT7" | jq -r '.data.getReplenishmentRecommendations | length')
if [ "$REPL_FETCH_COUNT" != "null" ]; then
  echo "✅ PASS - Retrieved $REPL_FETCH_COUNT replenishment recommendations"
else
  echo "❌ FAIL - Failed to retrieve replenishment recommendations"
  echo "$RESULT7"
fi
echo ""

# Test 8: Test Exponential Smoothing Algorithm
echo "Test 8: Generate Forecasts - Exponential Smoothing"
echo "---------------------------------------------------"
QUERY8='{
  "query": "mutation GenerateForecastsES { generateForecasts(input: { tenantId: \"'$TENANT_ID'\", facilityId: \"'$FACILITY_ID'\", materialIds: [\"'$MATERIAL_ES'\"], forecastHorizonDays: 30, forecastAlgorithm: EXP_SMOOTHING }) { forecastId materialId forecastedDemandQuantity forecastAlgorithm } }"
}'
RESULT8=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "$QUERY8")
COUNT8=$(echo "$RESULT8" | jq -r '.data.generateForecasts | length')
if [ "$COUNT8" -eq "30" ]; then
  echo "✅ PASS - Generated $COUNT8 forecasts with EXP_SMOOTHING"
else
  echo "❌ FAIL - Expected 30 forecasts, got $COUNT8"
  echo "$RESULT8"
fi
echo ""

# Test 9: Test Holt-Winters Algorithm
echo "Test 9: Generate Forecasts - Holt-Winters (Seasonal)"
echo "-----------------------------------------------------"
QUERY9='{
  "query": "mutation GenerateForecastsHW { generateForecasts(input: { tenantId: \"'$TENANT_ID'\", facilityId: \"'$FACILITY_ID'\", materialIds: [\"'$MATERIAL_HW'\"], forecastHorizonDays: 90, forecastAlgorithm: HOLT_WINTERS }) { forecastId materialId forecastedDemandQuantity forecastAlgorithm } }"
}'
RESULT9=$(curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d "$QUERY9")
COUNT9=$(echo "$RESULT9" | jq -r '.data.generateForecasts | length')
if [ "$COUNT9" -eq "90" ]; then
  echo "✅ PASS - Generated $COUNT9 seasonal forecasts with HOLT_WINTERS"
else
  echo "❌ FAIL - Expected 90 forecasts, got $COUNT9"
  echo "$RESULT9"
fi
echo ""

echo "============================================"
echo "TEST SUITE COMPLETE"
echo "============================================"
