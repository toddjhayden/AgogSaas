import { gql } from '@apollo/client';

// =====================================================
// INVENTORY FORECASTING QUERIES
// =====================================================

export const GET_DEMAND_HISTORY = gql`
  query GetDemandHistory(
    $tenantId: ID!
    $facilityId: ID!
    $materialId: ID!
    $startDate: Date!
    $endDate: Date!
  ) {
    getDemandHistory(
      tenantId: $tenantId
      facilityId: $facilityId
      materialId: $materialId
      startDate: $startDate
      endDate: $endDate
    ) {
      demandHistoryId
      demandDate
      year
      month
      weekOfYear
      dayOfWeek
      quarter
      isHoliday
      isPromotionalPeriod
      actualDemandQuantity
      forecastedDemandQuantity
      demandUom
      salesOrderDemand
      productionOrderDemand
      transferOrderDemand
      scrapAdjustment
      avgUnitPrice
      promotionalDiscountPct
      marketingCampaignActive
      forecastError
      absolutePercentageError
      createdAt
    }
  }
`;

export const GET_MATERIAL_FORECASTS = gql`
  query GetMaterialForecasts(
    $tenantId: ID!
    $facilityId: ID!
    $materialId: ID!
    $startDate: Date!
    $endDate: Date!
    $forecastStatus: ForecastStatus
  ) {
    getMaterialForecasts(
      tenantId: $tenantId
      facilityId: $facilityId
      materialId: $materialId
      startDate: $startDate
      endDate: $endDate
      forecastStatus: $forecastStatus
    ) {
      forecastId
      forecastGenerationTimestamp
      forecastVersion
      forecastHorizonType
      forecastAlgorithm
      forecastDate
      forecastYear
      forecastMonth
      forecastWeekOfYear
      forecastedDemandQuantity
      forecastUom
      lowerBound80Pct
      upperBound80Pct
      lowerBound95Pct
      upperBound95Pct
      modelConfidenceScore
      isManuallyOverridden
      manualOverrideQuantity
      manualOverrideBy
      manualOverrideReason
      forecastStatus
      createdAt
    }
  }
`;

export const CALCULATE_SAFETY_STOCK = gql`
  query CalculateSafetyStock($input: CalculateSafetyStockInput!) {
    calculateSafetyStock(input: $input) {
      materialId
      safetyStockQuantity
      reorderPoint
      economicOrderQuantity
      calculationMethod
      avgDailyDemand
      demandStdDev
      avgLeadTimeDays
      leadTimeStdDev
      serviceLevel
      zScore
    }
  }
`;

export const GET_FORECAST_ACCURACY_SUMMARY = gql`
  query GetForecastAccuracySummary(
    $tenantId: ID!
    $facilityId: ID!
    $materialIds: [ID!]
  ) {
    getForecastAccuracySummary(
      tenantId: $tenantId
      facilityId: $facilityId
      materialIds: $materialIds
    ) {
      materialId
      last30DaysMape
      last60DaysMape
      last90DaysMape
      last30DaysBias
      last60DaysBias
      last90DaysBias
      totalForecastsGenerated
      totalActualDemandRecorded
      currentForecastAlgorithm
      lastForecastGenerationDate
    }
  }
`;

// =====================================================
// INVENTORY FORECASTING MUTATIONS
// =====================================================

export const GENERATE_FORECASTS = gql`
  mutation GenerateForecasts($input: GenerateForecastInput!) {
    generateForecasts(input: $input) {
      forecastId
      materialId
      forecastGenerationTimestamp
      forecastVersion
      forecastHorizonType
      forecastAlgorithm
      forecastDate
      forecastedDemandQuantity
      forecastUom
      lowerBound80Pct
      upperBound80Pct
      lowerBound95Pct
      upperBound95Pct
      modelConfidenceScore
      forecastStatus
      createdAt
    }
  }
`;

export const RECORD_DEMAND = gql`
  mutation RecordDemand($input: RecordDemandInput!) {
    recordDemand(input: $input) {
      demandHistoryId
      demandDate
      actualDemandQuantity
      demandUom
      salesOrderDemand
      productionOrderDemand
      transferOrderDemand
      scrapAdjustment
      createdAt
    }
  }
`;

export const BACKFILL_DEMAND_HISTORY = gql`
  mutation BackfillDemandHistory(
    $tenantId: ID!
    $facilityId: ID!
    $startDate: Date!
    $endDate: Date!
  ) {
    backfillDemandHistory(
      tenantId: $tenantId
      facilityId: $facilityId
      startDate: $startDate
      endDate: $endDate
    )
  }
`;

export const GET_REPLENISHMENT_RECOMMENDATIONS = gql`
  query GetReplenishmentRecommendations(
    $tenantId: ID!
    $facilityId: ID!
    $materialId: ID
    $status: RecommendationStatus
  ) {
    getReplenishmentRecommendations(
      tenantId: $tenantId
      facilityId: $facilityId
      materialId: $materialId
      status: $status
    ) {
      suggestionId
      materialId
      suggestionGenerationTimestamp
      suggestionStatus
      currentOnHandQuantity
      currentAllocatedQuantity
      currentAvailableQuantity
      currentOnOrderQuantity
      safetyStockQuantity
      reorderPointQuantity
      economicOrderQuantity
      forecastedDemand30Days
      forecastedDemand60Days
      forecastedDemand90Days
      projectedStockoutDate
      recommendedOrderQuantity
      recommendedOrderUom
      recommendedOrderDate
      recommendedDeliveryDate
      estimatedUnitCost
      estimatedTotalCost
      vendorLeadTimeDays
      suggestionReason
      calculationMethod
      urgencyLevel
      daysUntilStockout
      createdAt
    }
  }
`;

export const GENERATE_REPLENISHMENT_RECOMMENDATIONS = gql`
  mutation GenerateReplenishmentRecommendations($input: GenerateRecommendationsInput!) {
    generateReplenishmentRecommendations(input: $input) {
      suggestionId
      materialId
      suggestionGenerationTimestamp
      suggestionStatus
      recommendedOrderQuantity
      recommendedOrderUom
      recommendedOrderDate
      urgencyLevel
      daysUntilStockout
      suggestionReason
    }
  }
`;

// =====================================================
// MATERIALS QUERY FOR AUTOCOMPLETE
// =====================================================

export const GET_MATERIALS = gql`
  query GetMaterials(
    $tenantId: ID!
    $materialType: MaterialType
    $materialCategory: String
    $isActive: Boolean
    $limit: Int
    $offset: Int
  ) {
    materials(
      tenantId: $tenantId
      materialType: $materialType
      materialCategory: $materialCategory
      isActive: $isActive
      limit: $limit
      offset: $offset
    ) {
      id
      materialCode
      materialName
      description
      materialType
      materialCategory
      primaryUom
      isActive
    }
  }
`;
