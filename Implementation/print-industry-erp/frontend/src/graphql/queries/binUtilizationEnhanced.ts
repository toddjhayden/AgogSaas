import { gql } from '@apollo/client';

/**
 * Enhanced GraphQL queries for Bin Utilization Optimization
 * REQ-STRATEGIC-AUTO-1766476803478 - Optimize Bin Utilization Algorithm
 *
 * These queries integrate with Roy's backend implementation:
 * - Best Fit Decreasing (FFD) algorithm
 * - Congestion avoidance
 * - Cross-dock detection
 * - ML confidence adjustment
 * - Event-driven re-slotting
 */

/**
 * Query to get enhanced batch putaway recommendations (FFD algorithm)
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
            reason
            salesOrderId
            urgency
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
 * Query to get real-time aisle congestion metrics
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
 * Query to detect cross-dock opportunity
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
 * Query to get bin utilization cache (materialized view - 100x faster)
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
 * Query to get re-slotting triggers from velocity analysis
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
 * Query to get material velocity analysis
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
 * Query to get ML model accuracy metrics
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
 * Mutation to refresh bin utilization cache
 */
export const REFRESH_BIN_UTILIZATION_CACHE = gql`
  mutation RefreshBinUtilizationCache($locationId: ID) {
    refreshBinUtilizationCache(locationId: $locationId)
  }
`;

/**
 * Mutation to record putaway decision for ML training
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
 * Mutation to trigger ML model training
 */
export const TRAIN_ML_MODEL = gql`
  mutation TrainMLModel {
    trainMLModel
  }
`;

/**
 * Mutation to execute automated re-slotting
 */
export const EXECUTE_AUTOMATED_RESLOTTING = gql`
  mutation ExecuteAutomatedReSlotting($facilityId: ID!, $materialIds: [ID!]) {
    executeAutomatedReSlotting(facilityId: $facilityId, materialIds: $materialIds)
  }
`;
