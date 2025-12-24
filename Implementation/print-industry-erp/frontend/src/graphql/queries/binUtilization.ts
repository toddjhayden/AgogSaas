import { gql } from '@apollo/client';

/**
 * GraphQL queries for Bin Utilization Optimization
 * REQ-STRATEGIC-AUTO-1766436689295
 * REQ-STRATEGIC-AUTO-1766476803478 - Enhanced Algorithm
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
