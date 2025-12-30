import { gql } from '@apollo/client';

/**
 * GraphQL queries and mutations for WMS Data Quality
 * REQ-STRATEGIC-AUTO-1766545799451
 * Author: Jen (Frontend Developer)
 *
 * Purpose: Frontend API integration for bin optimization data quality features
 * Reference: Roy's backend implementation
 */

// =====================================================
// QUERIES
// =====================================================

/**
 * Get data quality metrics for a facility
 */
export const GET_DATA_QUALITY_METRICS = gql`
  query GetDataQualityMetrics($facilityId: ID) {
    getDataQualityMetrics(facilityId: $facilityId) {
      facilityId
      facilityName
      materialsVerifiedCount
      materialsWithVariance
      avgCubicFeetVariancePct
      avgWeightVariancePct
      capacityFailuresCount
      unresolvedFailuresCount
      crossdockCancellationsCount
      pendingRelocationsCount
      autoRemediationCount
      failedRemediationCount
    }
  }
`;

/**
 * Get dimension verifications for a material
 */
export const GET_MATERIAL_DIMENSION_VERIFICATIONS = gql`
  query GetMaterialDimensionVerifications(
    $materialId: ID!
    $facilityId: ID
    $limit: Int
  ) {
    getMaterialDimensionVerifications(
      materialId: $materialId
      facilityId: $facilityId
      limit: $limit
    ) {
      verificationId
      materialId
      facilityId
      masterCubicFeet
      masterWeightLbs
      measuredCubicFeet
      measuredWeightLbs
      cubicFeetVariancePct
      weightVariancePct
      verificationStatus
      varianceThresholdExceeded
      autoUpdatedMasterData
      verifiedBy
      verifiedAt
      notes
    }
  }
`;

/**
 * Get capacity validation failures (unresolved by default)
 */
export const GET_CAPACITY_VALIDATION_FAILURES = gql`
  query GetCapacityValidationFailures(
    $facilityId: ID
    $resolved: Boolean
    $limit: Int
  ) {
    getCapacityValidationFailures(
      facilityId: $facilityId
      resolved: $resolved
      limit: $limit
    ) {
      failureId
      locationId
      locationCode
      materialId
      materialCode
      lotNumber
      requiredCubicFeet
      availableCubicFeet
      requiredWeightLbs
      availableWeightLbs
      failureType
      cubicFeetOverflowPct
      weightOverflowPct
      alertSent
      resolved
      createdAt
    }
  }
`;

/**
 * Get cross-dock cancellations (pending relocation by default)
 */
export const GET_CROSS_DOCK_CANCELLATIONS = gql`
  query GetCrossDockCancellations(
    $facilityId: ID
    $relocationCompleted: Boolean
    $limit: Int
  ) {
    getCrossDockCancellations(
      facilityId: $facilityId
      relocationCompleted: $relocationCompleted
      limit: $limit
    ) {
      cancellationId
      materialId
      materialCode
      lotNumber
      cancellationReason
      newRecommendedLocationId
      newRecommendedLocationCode
      relocationCompleted
      cancelledAt
      cancelledBy
      notes
    }
  }
`;

/**
 * Get bin optimization health with auto-remediation
 */
export const GET_BIN_OPTIMIZATION_HEALTH_ENHANCED = gql`
  query GetBinOptimizationHealthEnhanced($autoRemediate: Boolean) {
    getBinOptimizationHealthEnhanced(autoRemediate: $autoRemediate) {
      status
      message
      remediationActions {
        action
        successful
        preActionMetric
        postActionMetric
        errorMessage
      }
      timestamp
    }
  }
`;

// =====================================================
// MUTATIONS
// =====================================================

/**
 * Verify material dimensions and update master data if variance is acceptable
 */
export const VERIFY_MATERIAL_DIMENSIONS = gql`
  mutation VerifyMaterialDimensions($input: DimensionVerificationInput!) {
    verifyMaterialDimensions(input: $input) {
      verificationId
      success
      cubicFeetVariancePct
      weightVariancePct
      varianceThresholdExceeded
      autoUpdatedMasterData
      verificationStatus
      message
    }
  }
`;

/**
 * Cancel cross-docking and get new putaway location
 */
export const CANCEL_CROSS_DOCKING = gql`
  mutation CancelCrossDocking($input: CrossDockCancellationInput!) {
    cancelCrossDocking(input: $input) {
      cancellationId
      success
      newRecommendedLocation {
        locationId
        locationCode
      }
      message
    }
  }
`;

/**
 * Resolve a capacity validation failure
 */
export const RESOLVE_CAPACITY_FAILURE = gql`
  mutation ResolveCapacityFailure($failureId: ID!, $resolutionNotes: String) {
    resolveCapacityFailure(failureId: $failureId, resolutionNotes: $resolutionNotes)
  }
`;

/**
 * Mark cross-dock relocation as completed
 */
export const COMPLETE_CROSS_DOCK_RELOCATION = gql`
  mutation CompleteCrossDockRelocation($cancellationId: ID!, $actualLocationId: ID!) {
    completeCrossDockRelocation(
      cancellationId: $cancellationId
      actualLocationId: $actualLocationId
    )
  }
`;
