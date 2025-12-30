import { gql } from '@apollo/client';

/**
 * GraphQL queries for Bin Utilization Optimization
 * REQ-STRATEGIC-AUTO-1766436689295
 * REQ-STRATEGIC-AUTO-1766476803478 - Enhanced Algorithm
 * REQ-STRATEGIC-AUTO-1766600259419 - Optimization Enhancements (OPP-1, OPP-2)
 */

/**
 * Query to get putaway location recommendation
 */
export const SUGGEST_PUTAWAY_LOCATION = gql`
  query SuggestPutawayLocation(
    $materialId: ID!
    $lotNumber: String!
    $quantity: Float!
    $dimensions: ItemDimensionsInput
  ) {
    suggestPutawayLocation(
      materialId: $materialId
      lotNumber: $lotNumber
      quantity: $quantity
      dimensions: $dimensions
    ) {
      primary {
        locationId
        locationCode
        locationType
        algorithm
        confidenceScore
        reason
        utilizationAfterPlacement
        availableCapacityAfter
        pickSequence
      }
      alternatives {
        locationId
        locationCode
        locationType
        algorithm
        confidenceScore
        reason
        utilizationAfterPlacement
        availableCapacityAfter
        pickSequence
      }
      capacityCheck {
        canFit
        dimensionCheck
        weightCheck
        cubicCheck
        violationReasons
      }
    }
  }
`;

/**
 * Query to analyze bin utilization metrics
 */
export const ANALYZE_BIN_UTILIZATION = gql`
  query AnalyzeBinUtilization(
    $facilityId: ID!
    $locationId: ID
  ) {
    analyzeBinUtilization(
      facilityId: $facilityId
      locationId: $locationId
    ) {
      locationId
      locationCode
      volumeUtilization
      weightUtilization
      slotUtilization
      availableVolume
      availableWeight
      abcClassification
      pickFrequency
      optimizationScore
      recommendations
    }
  }
`;

/**
 * Query to get optimization recommendations
 */
export const GET_OPTIMIZATION_RECOMMENDATIONS = gql`
  query GetOptimizationRecommendations(
    $facilityId: ID!
    $threshold: Float
  ) {
    getOptimizationRecommendations(
      facilityId: $facilityId
      threshold: $threshold
    ) {
      type
      priority
      sourceBinId
      sourceBinCode
      targetBinId
      targetBinCode
      materialId
      materialName
      reason
      expectedImpact
      currentUtilization
      velocityChange
    }
  }
`;

/**
 * Query to analyze warehouse-wide utilization
 */
export const ANALYZE_WAREHOUSE_UTILIZATION = gql`
  query AnalyzeWarehouseUtilization(
    $facilityId: ID!
    $zoneCode: String
  ) {
    analyzeWarehouseUtilization(
      facilityId: $facilityId
      zoneCode: $zoneCode
    ) {
      facilityId
      totalLocations
      activeLocations
      averageUtilization
      utilizationByZone {
        zoneCode
        totalLocations
        averageUtilization
        totalCubicFeet
        usedCubicFeet
      }
      underutilizedLocations {
        locationId
        locationCode
        locationType
        totalCubicFeet
        usedCubicFeet
        availableCubicFeet
        maxWeightLbs
        currentWeightLbs
        availableWeightLbs
        utilizationPercentage
        abcClassification
        pickSequence
      }
      overutilizedLocations {
        locationId
        locationCode
        locationType
        totalCubicFeet
        usedCubicFeet
        availableCubicFeet
        maxWeightLbs
        currentWeightLbs
        availableWeightLbs
        utilizationPercentage
        abcClassification
        pickSequence
      }
      recommendations {
        type
        priority
        sourceBinId
        sourceBinCode
        targetBinId
        targetBinCode
        materialId
        materialName
        reason
        expectedImpact
        currentUtilization
        velocityChange
      }
    }
  }
`;

/**
 * Enhanced Bin Utilization Queries - REQ-STRATEGIC-AUTO-1766476803478
 */

/**
 * Get batch putaway recommendations using Best Fit Decreasing algorithm
 */
export const GET_BATCH_PUTAWAY_RECOMMENDATIONS = gql`
  query GetBatchPutawayRecommendations($input: BatchPutawayInput!) {
    getBatchPutawayRecommendations(input: $input) {
      recommendations {
        lotNumber
        materialId
        recommendation {
          locationId
          locationCode
          locationType
          algorithm
          confidenceScore
          mlAdjustedConfidence
          reason
          utilizationAfterPlacement
          availableCapacityAfter
          pickSequence
          congestionPenalty
          crossDockRecommendation {
            shouldCrossDock
            urgency
            reason
            salesOrderId
          }
        }
      }
      totalItems
      avgConfidenceScore
      crossDockOpportunities
      processingTimeMs
    }
  }
`;

/**
 * Get real-time aisle congestion metrics
 */
export const GET_AISLE_CONGESTION_METRICS = gql`
  query GetAisleCongestionMetrics($facilityId: ID!) {
    getAisleCongestionMetrics(facilityId: $facilityId) {
      aisleCode
      currentActivePickLists
      avgPickTimeMinutes
      congestionScore
      congestionLevel
    }
  }
`;

/**
 * Detect cross-dock opportunity for a material
 */
export const DETECT_CROSS_DOCK_OPPORTUNITY = gql`
  query DetectCrossDockOpportunity($materialId: ID!, $quantity: Float!) {
    detectCrossDockOpportunity(materialId: $materialId, quantity: $quantity) {
      shouldCrossDock
      reason
      salesOrderId
      urgency
    }
  }
`;

/**
 * Get bin utilization from cache (fast lookup)
 */
export const GET_BIN_UTILIZATION_CACHE = gql`
  query GetBinUtilizationCache(
    $facilityId: ID!
    $locationId: ID
    $utilizationStatus: UtilizationStatus
  ) {
    getBinUtilizationCache(
      facilityId: $facilityId
      locationId: $locationId
      utilizationStatus: $utilizationStatus
    ) {
      locationId
      locationCode
      locationType
      zoneCode
      aisleCode
      volumeUtilizationPct
      weightUtilizationPct
      utilizationStatus
      availableCubicFeet
      availableWeight
      lotCount
      materialCount
      lastUpdated
    }
  }
`;

/**
 * Get re-slotting triggers based on velocity changes
 */
export const GET_RESLOTTING_TRIGGERS = gql`
  query GetReSlottingTriggers($facilityId: ID!) {
    getReSlottingTriggers(facilityId: $facilityId) {
      type
      materialId
      materialName
      currentABCClass
      calculatedABCClass
      velocityChange
      triggeredAt
      priority
    }
  }
`;

/**
 * Get material velocity analysis
 */
export const GET_MATERIAL_VELOCITY_ANALYSIS = gql`
  query GetMaterialVelocityAnalysis(
    $facilityId: ID!
    $minVelocityChangePct: Float
  ) {
    getMaterialVelocityAnalysis(
      facilityId: $facilityId
      minVelocityChangePct: $minVelocityChangePct
    ) {
      materialId
      materialName
      currentABC
      recentPicks30d
      recentValue30d
      historicalPicks150d
      historicalValue150d
      velocityChangePct
      velocitySpike
      velocityDrop
      recommendedAction
    }
  }
`;

/**
 * Get ML model accuracy metrics
 */
export const GET_ML_ACCURACY_METRICS = gql`
  query GetMLAccuracyMetrics {
    getMLAccuracyMetrics {
      overallAccuracy
      totalRecommendations
      byAlgorithm {
        algorithm
        accuracy
        count
      }
      lastUpdated
    }
  }
`;

/**
 * Get enhanced optimization recommendations
 */
export const GET_ENHANCED_OPTIMIZATION_RECOMMENDATIONS = gql`
  query GetEnhancedOptimizationRecommendations($facilityId: ID!, $limit: Int) {
    getOptimizationRecommendations(facilityId: $facilityId, limit: $limit) {
      type
      priority
      locationId
      locationCode
      currentUtilization
      reason
      expectedImpact
      materialId
      materialName
    }
  }
`;

/**
 * Mutations for Enhanced Bin Utilization
 */

/**
 * Record putaway decision for ML training
 */
export const RECORD_PUTAWAY_DECISION = gql`
  mutation RecordPutawayDecision(
    $recommendationId: ID!
    $accepted: Boolean!
    $actualLocationId: ID
  ) {
    recordPutawayDecision(
      recommendationId: $recommendationId
      accepted: $accepted
      actualLocationId: $actualLocationId
    )
  }
`;

/**
 * Trigger ML model training
 */
export const TRAIN_ML_MODEL = gql`
  mutation TrainMLModel {
    trainMLModel
  }
`;

/**
 * Refresh bin utilization cache
 */
export const REFRESH_BIN_UTILIZATION_CACHE = gql`
  mutation RefreshBinUtilizationCache($locationId: ID) {
    refreshBinUtilizationCache(locationId: $locationId)
  }
`;

/**
 * Execute automated re-slotting
 */
export const EXECUTE_AUTOMATED_RESLOTTING = gql`
  mutation ExecuteAutomatedReSlotting($facilityId: ID!, $materialIds: [ID!]) {
    executeAutomatedReSlotting(facilityId: $facilityId, materialIds: $materialIds)
  }
`;

/**
 * Get cache refresh status (materialized view performance monitoring)
 * REQ-STRATEGIC-AUTO-1766527796497 - Marcus's Implementation
 */
export const GET_CACHE_REFRESH_STATUS = gql`
  query GetCacheRefreshStatus {
    getCacheRefreshStatus {
      cacheName
      lastRefreshAt
      lastRefreshDurationMs
      refreshCount
      lastError
      lastErrorAt
    }
  }
`;

/**
 * Force refresh bin utilization cache (admin function)
 * REQ-STRATEGIC-AUTO-1766527796497 - Marcus's Implementation
 */
export const FORCE_REFRESH_CACHE = gql`
  mutation ForceRefreshCache {
    forceRefreshBinUtilizationCache {
      durationMs
      rowCount
      status
    }
  }
`;

/**
 * Fragmentation Monitoring Queries
 * REQ-STRATEGIC-AUTO-1766584106655 - Bin Utilization Algorithm Optimization
 */

/**
 * Get facility fragmentation metrics
 */
export const GET_FACILITY_FRAGMENTATION = gql`
  query GetFacilityFragmentation($facilityId: ID!) {
    getFacilityFragmentation(facilityId: $facilityId) {
      facilityId
      fragmentationIndex
      fragmentationLevel
      totalBins
      fragmentedBins
      requiresConsolidation
      estimatedSpaceRecovery
      trend {
        direction
        sevenDayAverage
        thirtyDayAverage
      }
    }
  }
`;

/**
 * Get zone-level fragmentation metrics
 */
export const GET_ZONE_FRAGMENTATION = gql`
  query GetZoneFragmentation($facilityId: ID!, $zoneCode: String!) {
    getZoneFragmentation(facilityId: $facilityId, zoneCode: $zoneCode) {
      zoneCode
      fragmentationIndex
      fragmentationLevel
      totalBins
      fragmentedBins
    }
  }
`;

/**
 * Get consolidation opportunities
 */
export const GET_CONSOLIDATION_OPPORTUNITIES = gql`
  query GetConsolidationOpportunities($facilityId: ID!) {
    getConsolidationOpportunities(facilityId: $facilityId) {
      materialId
      materialName
      sourceLocationIds
      sourceLocationCodes
      targetLocationId
      targetLocationCode
      quantityToMove
      spaceRecovered
      estimatedLaborHours
      priority
    }
  }
`;

/**
 * Get fragmentation history
 */
export const GET_FRAGMENTATION_HISTORY = gql`
  query GetFragmentationHistory($facilityId: ID!, $daysBack: Int) {
    getFragmentationHistory(facilityId: $facilityId, daysBack: $daysBack) {
      timestamp
      fragmentationIndex
      fragmentationLevel
      totalBins
      fragmentedBins
    }
  }
`;

/**
 * 3D Proximity Optimization Queries
 * REQ-STRATEGIC-AUTO-1766584106655 - Bin Utilization Algorithm Optimization
 */

/**
 * Get 3D SKU affinity data
 */
export const GET_3D_SKU_AFFINITY = gql`
  query Get3DSKUAffinity($materialA: ID!, $materialB: ID) {
    get3DSKUAffinity(materialA: $materialA, materialB: $materialB) {
      materialA
      materialB
      coPickCount
      shelfLevelA
      shelfLevelB
      shelfLevelDifference
      affinity3DBonus
      affinityLevel
    }
  }
`;

/**
 * Get ABC ergonomic recommendations
 */
export const GET_ABC_ERGONOMIC_RECOMMENDATIONS = gql`
  query GetABCErgonomicRecommendations($facilityId: ID!) {
    getABCErgonomicRecommendations(facilityId: $facilityId) {
      abcClass
      avgWeightLbs
      recommendedErgonomicZone
      reason
      materialCount
    }
  }
`;

/**
 * Get 3D optimization metrics
 */
export const GET_3D_OPTIMIZATION_METRICS = gql`
  query Get3DOptimizationMetrics($facilityId: ID!) {
    get3DOptimizationMetrics(facilityId: $facilityId) {
      facilityId
      totalPicks
      ergonomicZonePicks {
        zone
        pickCount
        percentage
      }
      verticalTravelReduction
      ergonomicCompliance
      measurementPeriod
    }
  }
`;

/**
 * Get material shelf placement recommendations
 */
export const GET_SHELF_PLACEMENT_RECOMMENDATIONS = gql`
  query GetShelfPlacementRecommendations($materialId: ID!) {
    getShelfPlacementRecommendations(materialId: $materialId) {
      materialId
      materialName
      abcClass
      avgWeightLbs
      currentShelfLevel
      currentErgonomicZone
      recommendedShelfLevel
      recommendedErgonomicZone
      reason
      expectedPickTravelReduction
    }
  }
`;

/**
 * OPP-1: Real-Time Utilization Prediction Queries
 * REQ-STRATEGIC-AUTO-1766600259419
 */

/**
 * Get utilization predictions for a facility
 */
export const GET_UTILIZATION_PREDICTIONS = gql`
  query GetUtilizationPredictions(
    $facilityId: ID!
    $horizonDays: Int
  ) {
    getUtilizationPredictions(
      facilityId: $facilityId
      horizonDays: $horizonDays
    ) {
      predictionId
      facilityId
      predictionDate
      predictionHorizonDays
      predictedAvgUtilization
      predictedLocationsOptimal
      confidenceLevel
      modelVersion
      createdAt
    }
  }
`;

/**
 * Get utilization prediction trends over time
 */
export const GET_UTILIZATION_PREDICTION_TRENDS = gql`
  query GetUtilizationPredictionTrends(
    $facilityId: ID!
    $startDate: String!
    $endDate: String!
  ) {
    getUtilizationPredictionTrends(
      facilityId: $facilityId
      startDate: $startDate
      endDate: $endDate
    ) {
      date
      actual7DayUtilization
      predicted7DayUtilization
      actual14DayUtilization
      predicted14DayUtilization
      actual30DayUtilization
      predicted30DayUtilization
      predictionAccuracy
    }
  }
`;

/**
 * Get seasonal adjustment recommendations
 */
export const GET_SEASONAL_ADJUSTMENTS = gql`
  query GetSeasonalAdjustments($facilityId: ID!) {
    getSeasonalAdjustments(facilityId: $facilityId) {
      materialId
      materialName
      currentABCClass
      seasonalPattern
      peakMonths
      recommendedABCAdjustment
      expectedUtilizationImpact
      suggestedReslotDate
      priority
    }
  }
`;

/**
 * OPP-2: Multi-Objective Optimization Queries
 * REQ-STRATEGIC-AUTO-1766600259419
 */

/**
 * Get optimization weight configurations for a facility
 */
export const GET_OPTIMIZATION_WEIGHT_CONFIGS = gql`
  query GetOptimizationWeightConfigs($facilityId: ID!) {
    getOptimizationWeightConfigs(facilityId: $facilityId) {
      weightConfigId
      facilityId
      configName
      isActive
      spaceUtilizationWeight
      travelDistanceWeight
      putawayTimeWeight
      fragmentationWeight
      ergonomicWeight
      recommendationsGenerated
      acceptanceRate
      avgConfidenceScore
      createdAt
      updatedAt
    }
  }
`;

/**
 * Get active optimization weight configuration
 */
export const GET_ACTIVE_OPTIMIZATION_WEIGHTS = gql`
  query GetActiveOptimizationWeights($facilityId: ID!) {
    getActiveOptimizationWeights(facilityId: $facilityId) {
      weightConfigId
      configName
      spaceUtilizationWeight
      travelDistanceWeight
      putawayTimeWeight
      fragmentationWeight
      ergonomicWeight
      acceptanceRate
      avgConfidenceScore
    }
  }
`;

/**
 * Get Pareto frontier analysis for location recommendations
 */
export const GET_PARETO_FRONTIER = gql`
  query GetParetoFrontier(
    $materialId: ID!
    $lotNumber: String!
    $quantity: Float!
    $facilityId: ID!
  ) {
    getParetoFrontier(
      materialId: $materialId
      lotNumber: $lotNumber
      quantity: $quantity
      facilityId: $facilityId
    ) {
      locationId
      locationCode
      isDominated
      objectiveScores {
        spaceUtilization
        travelDistance
        putawayTime
        fragmentation
        ergonomicScore
      }
      compositeScore
      rank
    }
  }
`;

/**
 * Get optimization weight performance comparison
 */
export const GET_WEIGHT_PERFORMANCE_COMPARISON = gql`
  query GetWeightPerformanceComparison($facilityId: ID!) {
    getWeightPerformanceComparison(facilityId: $facilityId) {
      configName
      timeRange
      metrics {
        avgSpaceUtilization
        avgPickTravelTime
        avgPutawayTime
        fragmentationIndex
        ergonomicCompliance
        recommendationAcceptanceRate
        overallSatisfactionScore
      }
      isCurrentConfig
    }
  }
`;

/**
 * Mutations for Optimization Weight Configuration
 */

/**
 * Create or update optimization weight configuration
 */
export const SAVE_OPTIMIZATION_WEIGHTS = gql`
  mutation SaveOptimizationWeights(
    $facilityId: ID!
    $configName: String!
    $spaceUtilizationWeight: Float!
    $travelDistanceWeight: Float!
    $putawayTimeWeight: Float!
    $fragmentationWeight: Float!
    $ergonomicWeight: Float!
    $setActive: Boolean
  ) {
    saveOptimizationWeights(
      facilityId: $facilityId
      configName: $configName
      spaceUtilizationWeight: $spaceUtilizationWeight
      travelDistanceWeight: $travelDistanceWeight
      putawayTimeWeight: $putawayTimeWeight
      fragmentationWeight: $fragmentationWeight
      ergonomicWeight: $ergonomicWeight
      setActive: $setActive
    ) {
      weightConfigId
      configName
      isActive
      acceptanceRate
    }
  }
`;

/**
 * Activate an optimization weight configuration
 */
export const ACTIVATE_OPTIMIZATION_WEIGHTS = gql`
  mutation ActivateOptimizationWeights(
    $weightConfigId: ID!
  ) {
    activateOptimizationWeights(weightConfigId: $weightConfigId) {
      weightConfigId
      configName
      isActive
    }
  }
`;

/**
 * Run A/B test between two weight configurations
 */
export const START_OPTIMIZATION_AB_TEST = gql`
  mutation StartOptimizationABTest(
    $facilityId: ID!
    $controlConfigId: ID!
    $treatmentConfigId: ID!
    $testDurationDays: Int!
  ) {
    startOptimizationABTest(
      facilityId: $facilityId
      controlConfigId: $controlConfigId
      treatmentConfigId: $treatmentConfigId
      testDurationDays: $testDurationDays
    ) {
      testId
      status
      startDate
      endDate
    }
  }
`;
